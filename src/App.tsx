import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CloudSun,
  Compass,
  Globe,
  Navigation,
  Sprout,
  Sun,
  X,
} from 'lucide-react';
import { AgriScene3D } from './components/AgriScene3D';
import { BottomControlDock } from './components/BottomControlDock';
import { IntegratedDashboardModal } from './components/IntegratedDashboardModal';
import { LeftCommandPanel } from './components/LeftCommandPanel';
import { PlotDeviceInspector } from './components/PlotDeviceInspector';
import { RealGeoMapOverlay } from './components/RealGeoMapOverlay';
import { RightCommandPanel } from './components/RightCommandPanel';
import {
  DEVICE_CATEGORIES,
  INITIAL_ALERTS,
  INITIAL_GROWTH_PRESETS,
  INITIAL_IOT_DEVICES,
  INITIAL_PLOTS,
  SIM_CROP_LIST,
  VILLAGE_PRESETS,
  computeAllCropGrowth,
  computeDashboardSummary,
  computeDeviceHealthSummary,
  generateHourlyTelemetry,
  repairDeviceAndAlerts,
  stepPlotMoisture,
} from './simulation/agriSimEngine';
import { sceneXZToLngLat } from './simulation/geoProjection';
import {
  AgriPlot,
  CameraViewMode,
  DashboardAggregateReport,
  DeviceAlertItem,
  DeviceCategoryKey,
  DroneFlightMode,
  DroneTelemetryState,
  InitialGrowthPresetKey,
  IoTDeviceNode,
  LightingPreset,
  NavModule,
  ScenePerformanceStats,
  SimCropKey,
  SurfaceOverlayMode,
} from './types/agri';

type MobileSheetTab = 'sandbox' | 'geo_map' | 'sim_drone' | 'weather_alert';

const LEFT_NAV_ITEMS: Array<{ key: NavModule; label: string }> = [
  { key: NavModule.Overview, label: '态势总览' },
  { key: NavModule.SoilMoisture, label: '土壤墒情' },
  { key: NavModule.PestControl, label: '绿色防控' },
];

const RIGHT_NAV_ITEMS: Array<{ key: NavModule; label: string }> = [
  { key: NavModule.SmartIrrigation, label: '智能灌溉' },
  { key: NavModule.SocialService, label: '社会化服务' },
  { key: NavModule.MarketPrice, label: '农产品行情' },
];

function formatTimeHMS(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavModule>(NavModule.Overview);
  const [plots, setPlots] = useState<AgriPlot[]>(INITIAL_PLOTS);
  const [devices, setDevices] = useState<IoTDeviceNode[]>(INITIAL_IOT_DEVICES);
  const [alerts, setAlerts] = useState<DeviceAlertItem[]>(INITIAL_ALERTS);

  const [visibleCategories, setVisibleCategories] = useState<Set<DeviceCategoryKey>>(
    () => new Set(DEVICE_CATEGORIES.map((c) => c.key)),
  );

  // Multi-Crop Refined Growth Simulation State (Rice, Corn, Tomato, Wheat)
  const [initialPreset, setInitialPreset] = useState<InitialGrowthPresetKey>('mixed_season');
  const [cropDays, setCropDays] = useState<Record<SimCropKey, number>>(
    () => ({ ...INITIAL_GROWTH_PRESETS[0].days }),
  );
  const [activeSimCrop, setActiveSimCrop] = useState<SimCropKey>('rice');
  const [growthSpeed, setGrowthSpeed] = useState<1 | 2 | 5 | 10>(2);
  const [autoGrowPlaying, setAutoGrowPlaying] = useState<boolean>(false);

  // Meteorology & Village Selection
  const [selectedVillageId, setSelectedVillageId] = useState<string>('dongba');
  const weather = VILLAGE_PRESETS[selectedVillageId] ?? VILLAGE_PRESETS.dongba;
  const telemetrySeries = useMemo(() => generateHourlyTelemetry(weather), [weather]);

  // 3D Camera, Drone, Surface Heatmap, GIS Overlay & Lighting States
  const [cameraMode, setCameraMode] = useState<CameraViewMode>(CameraViewMode.OrbitOverview);
  const [droneFlightMode, setDroneFlightMode] = useState<DroneFlightMode>(
    DroneFlightMode.AutoPatrol,
  );
  const [droneTargetOverride, setDroneTargetOverride] = useState<{
    x: number;
    z: number;
    label: string;
    nonce: number;
  } | null>(null);
  const [manualControlInput, setManualControlInput] = useState<{
    forward: number;
    right: number;
    up: number;
  }>({ forward: 0, right: 0, up: 0 });

  const [surfaceOverlay, setSurfaceOverlay] = useState<SurfaceOverlayMode>(
    SurfaceOverlayMode.Natural,
  );
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>(LightingPreset.SunnyDay);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [gisMode, setGisMode] = useState<'mini' | 'split' | 'hidden'>('mini');

  // Integrated Chinese Data Big-Screen Modal & Refresh Controls
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(false);
  const [autoRefreshDashboard, setAutoRefreshDashboard] = useState<boolean>(true);
  const [refreshClockLabel, setRefreshClockLabel] = useState<string>(() => formatTimeHMS());
  const [frozenReport, setFrozenReport] = useState<DashboardAggregateReport | null>(null);

  // Conditional Google Maps Demo Key Quota Banner
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Selected 3D Plot / IoT Sensor
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Mobile Bottom Navigation Tab
  const [mobileTab, setMobileTab] = useState<MobileSheetTab>('sandbox');

  const initialDroneGeo = useMemo(() => sceneXZToLngLat(-46, -1), []);
  const [droneTelemetry, setDroneTelemetry] = useState<DroneTelemetryState>({
    x: -46,
    y: 18,
    z: -1,
    lat: initialDroneGeo.lat,
    lng: initialDroneGeo.lng,
    headingRad: 0,
    speedMs: 11.5,
    altitudeM: 18,
    batteryPct: 96,
    flightMode: DroneFlightMode.AutoPatrol,
    activeWaypointIndex: 0,
    targetX: -46,
    targetZ: -1,
    targetLabel: '东八一号高标准贡米田',
    ndviIndex: 0.84,
    canopyTempC: 18.8,
    pestRiskLevel: '低风险',
    scanningPlotId: 'plot-c1',
  });

  const [perfStats, setPerfStats] = useState<ScenePerformanceStats>({
    fps: 60,
    drawCalls: 42,
    triangles: 48200,
    activeLodSummary: '近景高模 4 / 中景中模 3 / 远景简模 0',
    culledCount: 0,
    mergedStaticBatches: 5,
    textureMemoryKb: 1680,
    qualityTier: 'high',
  });

  // Compute deterministic 4-species crop growth snapshots
  const growthMap = useMemo(
    () => computeAllCropGrowth(cropDays, weather.airTempC, weather.soilMoisturePct),
    [cropDays, weather.airTempC, weather.soilMoisturePct],
  );

  const healthSummary = useMemo(() => computeDeviceHealthSummary(devices), [devices]);

  const liveDashboardReport = useMemo(
    () => computeDashboardSummary(plots, growthMap, weather, refreshClockLabel),
    [plots, growthMap, weather, refreshClockLabel],
  );

  const displayedDashboardReport =
    autoRefreshDashboard || !frozenReport ? liveDashboardReport : frozenReport;

  // Periodic timestamp tick when auto-refresh is enabled
  useEffect(() => {
    if (!autoRefreshDashboard) return;
    const timer = window.setInterval(() => {
      setRefreshClockLabel(formatTimeHMS());
    }, 3000);
    return () => window.clearInterval(timer);
  }, [autoRefreshDashboard]);

  // Multi-Crop Auto Time-Lapse Simulation Loop (advances all 4 crops proportionally)
  useEffect(() => {
    if (!autoGrowPlaying) return;
    const intervalMs = Math.max(90, Math.round(420 / growthSpeed));
    const timer = window.setInterval(() => {
      setCropDays((prev) => ({
        rice: prev.rice >= 135 ? 1 : prev.rice + 1,
        corn: prev.corn >= 115 ? 1 : prev.corn + 1,
        tomato: prev.tomato >= 100 ? 1 : prev.tomato + 1,
        wheat: prev.wheat >= 210 ? 2 : prev.wheat + 2,
      }));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoGrowPlaying, growthSpeed]);

  // Live Soil Moisture Irrigation Step Loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlots((prev) => stepPlotMoisture(prev, 1.5));
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefreshDashboard((prev) => {
      const next = !prev;
      if (!next) {
        const nowStr = formatTimeHMS();
        setFrozenReport(computeDashboardSummary(plots, growthMap, weather, nowStr));
      } else {
        setRefreshClockLabel(formatTimeHMS());
        setFrozenReport(null);
      }
      return next;
    });
  }, [plots, growthMap, weather]);

  const handleManualRefreshDashboard = useCallback(() => {
    const nowStr = formatTimeHMS();
    setRefreshClockLabel(nowStr);
    const snap = computeDashboardSummary(plots, growthMap, weather, nowStr);
    if (!autoRefreshDashboard) {
      setFrozenReport(snap);
    }
  }, [autoRefreshDashboard, plots, growthMap, weather]);

  // Switch Top Navigation Domain & Synchronize 3D Scene Layers
  const handleSelectNav = useCallback((nav: NavModule) => {
    setActiveNav(nav);
    if (nav === NavModule.SoilMoisture) {
      setSurfaceOverlay(SurfaceOverlayMode.SoilMoisture);
      setVisibleCategories(new Set(['soil', 'weather', 'multispectral', 'gateway']));
    } else if (nav === NavModule.PestControl) {
      setSurfaceOverlay(SurfaceOverlayMode.Natural);
      setVisibleCategories(new Set(['pest_lamp', 'camera', 'multispectral', 'weather']));
      setDroneFlightMode(DroneFlightMode.TargetInspect);
      setDroneTargetOverride((prev) => ({
        x: -46,
        z: 26,
        label: '东八三号鲜食玉米示范田',
        nonce: (prev?.nonce ?? 0) + 1,
      }));
    } else if (nav === NavModule.SmartIrrigation) {
      setSurfaceOverlay(SurfaceOverlayMode.SoilMoisture);
      setVisibleCategories(new Set(['water_valve', 'butterfly_valve', 'controller', 'soil']));
    } else {
      setSurfaceOverlay(SurfaceOverlayMode.Natural);
      setVisibleCategories(new Set(DEVICE_CATEGORIES.map((c) => c.key)));
    }
  }, []);

  const handleSelectPlot = useCallback((plotId: string) => {
    setSelectedDeviceId(null);
    setSelectedPlotId(plotId);
    setCameraMode(CameraViewMode.PlotFocus);
  }, []);

  const handleSelectDevice = useCallback((deviceId: string) => {
    setSelectedPlotId(null);
    setSelectedDeviceId(deviceId);
    setCameraMode(CameraViewMode.PlotFocus);
  }, []);

  const handleFocusCategory = useCallback(
    (category: DeviceCategoryKey) => {
      setVisibleCategories((prev) => {
        const next = new Set(prev);
        next.add(category);
        return next;
      });
      const targetDev = devices.find((d) => d.category === category);
      if (targetDev) {
        setSelectedPlotId(null);
        setSelectedDeviceId(targetDev.id);
        setCameraMode(CameraViewMode.PlotFocus);
      }
    },
    [devices],
  );

  const handleTogglePlotIrrigation = useCallback((plotId: string) => {
    setPlots((prev) =>
      prev.map((p) =>
        p.id === plotId ? { ...p, irrigationActive: !p.irrigationActive } : p,
      ),
    );
  }, []);

  const handleApplyGrowthPreset = useCallback((presetKey: InitialGrowthPresetKey) => {
    setInitialPreset(presetKey);
    const found = INITIAL_GROWTH_PRESETS.find((p) => p.key === presetKey);
    if (found) {
      setCropDays({ ...found.days });
    }
  }, []);

  const handleChangeGrowthDay = useCallback((crop: SimCropKey, day: number) => {
    setCropDays((prev) => ({ ...prev, [crop]: day }));
  }, []);

  const handleDispatchDroneTo = useCallback((x: number, z: number, label: string) => {
    setDroneFlightMode(DroneFlightMode.TargetInspect);
    setDroneTargetOverride((prev) => ({
      x,
      z,
      label,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
    setCameraMode(CameraViewMode.DroneChase);
  }, []);

  const handleInspectAlertDevice = useCallback(
    (deviceId: string, plotId: string) => {
      const dev = devices.find((d) => d.id === deviceId);
      if (dev) {
        setSelectedPlotId(plotId);
        setSelectedDeviceId(dev.id);
        handleDispatchDroneTo(dev.x, dev.z, dev.name);
      }
    },
    [devices, handleDispatchDroneTo],
  );

  const handleRepairDevice = useCallback(
    (deviceId: string) => {
      setDevices((prevDevs) => {
        const res = repairDeviceAndAlerts(prevDevs, alerts, deviceId);
        setAlerts(res.alerts);
        return res.devices;
      });
    },
    [alerts],
  );

  const handleToggleCategory = useCallback((cat: DeviceCategoryKey) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleSetAllCategories = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setVisibleCategories(new Set(DEVICE_CATEGORIES.map((c) => c.key)));
    } else {
      setVisibleCategories(new Set());
    }
  }, []);

  const selectedPlot = useMemo(
    () => plots.find((p) => p.id === selectedPlotId) ?? null,
    [plots, selectedPlotId],
  );
  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const gisSplitActive = gisMode === 'split';
  const mobileActiveGrowth = growthMap[activeSimCrop];
  const mobileActiveMeta =
    SIM_CROP_LIST.find((c) => c.key === activeSimCrop) ?? SIM_CROP_LIST[0];

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#041b18] text-[#e6f7f3]">
      {/* Conditional Google Maps Demo Key Quota Banner (renders ONLY if gmp-quota-exceeded fires) */}
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="fixed top-0 inset-x-0 z-50 bg-amber-950/96 border-b border-amber-400/50 px-4 py-1.5 text-xs text-amber-100 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              当前演示用地图密钥配额已达上限。如需持续加载高精度卫星影像，请绑定自有云项目密钥：
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noreferrer"
                className="underline text-amber-300 ml-1"
              >
                查看配置指南
              </a>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            className="px-2 py-0.5 rounded bg-amber-900 text-amber-100 cursor-pointer shrink-0"
          >
            关闭
          </button>
        </div>
      )}

      {/* Full-Viewport or Dual-Screen Split 3D Digital Twin + Real Google Maps Satellite GIS */}
      <main className="absolute inset-0 z-0 flex flex-row">
        <div className={gisSplitActive ? 'relative w-full lg:w-[56%] h-full' : 'relative w-full h-full'}>
          <AgriScene3D
            plots={plots}
            devices={devices}
            visibleCategories={visibleCategories}
            growthMap={growthMap}
            cameraMode={cameraMode}
            droneFlightMode={droneFlightMode}
            droneTargetOverride={droneTargetOverride}
            surfaceOverlay={surfaceOverlay}
            lightingPreset={lightingPreset}
            selectedPlotId={selectedPlotId}
            selectedDeviceId={selectedDeviceId}
            manualControlInput={manualControlInput}
            onSelectPlot={handleSelectPlot}
            onSelectDevice={handleSelectDevice}
            onDroneTelemetry={setDroneTelemetry}
            onPerformanceStats={setPerfStats}
            onCameraUserOverride={() => setCameraMode(CameraViewMode.OrbitOverview)}
          />
        </div>

        {gisSplitActive && (
          <div className="hidden lg:block lg:w-[44%] h-full">
            <RealGeoMapOverlay
              mode="split"
              plots={plots}
              growthMap={growthMap}
              selectedPlotId={selectedPlotId}
              droneTelemetry={droneTelemetry}
              zenMode={zenMode}
              onChangeMode={setGisMode}
              onSelectPlot={handleSelectPlot}
              onDispatchDroneTo={handleDispatchDroneTo}
            />
          </div>
        )}
      </main>

      {/* Desktop Eagle-Eye Satellite GIS Overlay when not in full Split Mode */}
      {!gisSplitActive && (
        <RealGeoMapOverlay
          mode={gisMode}
          plots={plots}
          growthMap={growthMap}
          selectedPlotId={selectedPlotId}
          droneTelemetry={droneTelemetry}
          zenMode={zenMode}
          onChangeMode={setGisMode}
          onSelectPlot={handleSelectPlot}
          onDispatchDroneTo={handleDispatchDroneTo}
        />
      )}

      {/* Desktop Command-Center Header Crown (>= 1024px) */}
      <header className="hidden lg:flex items-center justify-between gap-4 px-5 h-12 relative z-20 bg-gradient-to-b from-[#041e1b] via-[#062a25]/95 to-transparent border-b border-teal-400/30">
        <nav aria-label="主业务导航左侧" className="flex items-center gap-5">
          {LEFT_NAV_ITEMS.map((item) => {
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectNav(item.key)}
                className={`relative py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-emerald-300 font-semibold'
                    : 'text-teal-100/75 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <h1 className="text-lg xl:text-2xl font-bold tracking-wider text-white whitespace-nowrap shrink-0">
          安徽省芜湖大米特色产业集群综合指挥中心
        </h1>

        <nav aria-label="主业务导航右侧" className="flex items-center gap-4">
          {RIGHT_NAV_ITEMS.map((item) => {
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectNav(item.key)}
                className={`relative py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-emerald-300 font-semibold'
                    : 'text-teal-100/75 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400 rounded-full" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setDashboardOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>数据大屏</span>
          </button>
        </nav>
      </header>

      {/* Mobile Compact Header (< 1024px, 48px height) */}
      <header className="flex lg:hidden items-center justify-between px-3 h-12 relative z-20 bg-[#05221e]/95 border-b border-teal-400/25">
        <h1 className="text-sm font-bold tracking-wide text-white truncate pr-2">
          芜湖大米特色产业集群指挥中心
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setDashboardOpen(true)}
            className="min-h-[34px] px-2.5 rounded bg-teal-800 border border-teal-400/30 text-xs font-medium text-emerald-200 whitespace-nowrap"
          >
            数据大屏
          </button>
          <button
            type="button"
            onClick={() =>
              setCameraMode((prev) =>
                prev === CameraViewMode.OrbitOverview
                  ? CameraViewMode.DroneChase
                  : CameraViewMode.OrbitOverview,
              )
            }
            className="min-h-[34px] px-2.5 rounded bg-emerald-600 text-xs font-medium text-white whitespace-nowrap"
          >
            {cameraMode === CameraViewMode.OrbitOverview ? '无人机视角' : '全局鸟瞰'}
          </button>
        </div>
      </header>

      {/* Desktop Left & Right Data-Screen Flanks (Hidden in Zen 3D Mode, Split GIS Mode & Mobile) */}
      {!zenMode && !gisSplitActive && (
        <>
          <aside
            aria-label="左侧基地与设备监测大屏"
            className="hidden lg:block fixed top-14 bottom-3 left-3 z-10 w-[315px] xl:w-[336px]"
          >
            <LeftCommandPanel
              activeNav={activeNav}
              plots={plots}
              selectedPlotId={selectedPlotId}
              healthSummary={healthSummary}
              onSelectPlot={handleSelectPlot}
              onFocusCategory={handleFocusCategory}
              onTogglePlotIrrigation={handleTogglePlotIrrigation}
            />
          </aside>

          <aside
            aria-label="右侧气象、生长模拟与告警大屏"
            className="hidden lg:block fixed top-14 bottom-3 right-3 z-10 w-[315px] xl:w-[336px]"
          >
            <RightCommandPanel
              activeNav={activeNav}
              selectedVillageId={selectedVillageId}
              weather={weather}
              telemetrySeries={telemetrySeries}
              growthMap={growthMap}
              activeSimCrop={activeSimCrop}
              initialPreset={initialPreset}
              growthSpeed={growthSpeed}
              autoGrowPlaying={autoGrowPlaying}
              alerts={alerts}
              onChangeVillage={setSelectedVillageId}
              onSelectSimCrop={setActiveSimCrop}
              onApplyGrowthPreset={handleApplyGrowthPreset}
              onChangeGrowthDay={handleChangeGrowthDay}
              onToggleAutoGrow={() => setAutoGrowPlaying((v) => !v)}
              onChangeGrowthSpeed={setGrowthSpeed}
              onOpenDashboard={() => setDashboardOpen(true)}
              onInspectAlertDevice={handleInspectAlertDevice}
              onRepairDevice={handleRepairDevice}
            />
          </aside>
        </>
      )}

      {/* Selected 3D Plot / IoT Sensor Inspector & FPV HUD */}
      <PlotDeviceInspector
        selectedPlot={selectedPlot}
        selectedDevice={selectedDevice}
        growthMap={growthMap}
        cameraMode={cameraMode}
        droneTelemetry={droneTelemetry}
        gisSplitActive={gisSplitActive}
        zenMode={zenMode}
        onClose={() => {
          setSelectedPlotId(null);
          setSelectedDeviceId(null);
        }}
        onDispatchDroneTo={handleDispatchDroneTo}
        onTogglePlotIrrigation={handleTogglePlotIrrigation}
        onRepairDevice={handleRepairDevice}
        onResetCamera={() => setCameraMode(CameraViewMode.OrbitOverview)}
      />

      {/* Desktop Consolidated Bottom Dock */}
      <BottomControlDock
        cameraMode={cameraMode}
        droneFlightMode={droneFlightMode}
        droneTelemetry={droneTelemetry}
        perfStats={perfStats}
        surfaceOverlay={surfaceOverlay}
        lightingPreset={lightingPreset}
        visibleCategories={visibleCategories}
        zenMode={zenMode}
        gisSplitActive={gisSplitActive}
        onChangeCameraMode={setCameraMode}
        onChangeDroneFlightMode={setDroneFlightMode}
        onChangeSurfaceOverlay={setSurfaceOverlay}
        onChangeLightingPreset={setLightingPreset}
        onToggleCategory={handleToggleCategory}
        onSetAllCategories={handleSetAllCategories}
        onToggleZenMode={() => setZenMode((v) => !v)}
        onToggleSplitGis={() =>
          setGisMode((prev) => (prev === 'split' ? 'mini' : 'split'))
        }
        onOpenDashboard={() => setDashboardOpen(true)}
        onManualNudge={setManualControlInput}
      />

      {/* Mobile Floating Quick Layer Controls when in Sandbox 3D Mode */}
      {mobileTab === 'sandbox' && (
        <div className="flex lg:hidden items-center justify-between gap-2 fixed bottom-16 inset-x-3 z-20 pointer-events-none">
          <div className="pointer-events-auto rounded-lg bg-[#062622]/94 border border-teal-400/30 px-2.5 py-1.5 text-[11px] tabular-nums">
            <div className="text-emerald-300 font-semibold">
              626亩 · 水稻{growthMap.rice.stageName} · {perfStats.fps}帧
            </div>
            <div className="text-teal-100/80 font-mono text-[10px]">
              {droneTelemetry.lng.toFixed(4)}°E, {droneTelemetry.lat.toFixed(4)}°N
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSurfaceOverlay((prev) =>
                  prev === SurfaceOverlayMode.Natural
                    ? SurfaceOverlayMode.SoilMoisture
                    : SurfaceOverlayMode.Natural,
                )
              }
              className="min-h-[44px] px-3 rounded-lg bg-[#062622]/94 border border-teal-400/30 text-xs font-medium text-teal-100 flex items-center gap-1"
            >
              <Compass className="w-4 h-4 text-cyan-300" aria-hidden="true" />
              <span>{surfaceOverlay === SurfaceOverlayMode.Natural ? '实景' : '墒情'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setLightingPreset((prev) =>
                  prev === LightingPreset.SunnyDay
                    ? LightingPreset.GoldenDusk
                    : LightingPreset.SunnyDay,
                )
              }
              aria-label="移动端切换光照模式"
              className="min-h-[44px] min-w-[44px] rounded-lg bg-[#062622]/94 border border-teal-400/30 text-xs text-amber-300 flex items-center justify-center"
            >
              <Sun className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Scrollable Bottom Sheet Drawer (< 1024px) */}
      {mobileTab !== 'sandbox' && (
        <div
          role="dialog"
          aria-label="移动端智慧农业数据与控制抽屉"
          className="lg:hidden fixed inset-x-0 bottom-14 z-30 max-h-[72vh] rounded-t-2xl bg-[#05221e]/98 border-t border-teal-400/35 flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-teal-400/20 shrink-0">
            <span className="text-sm font-semibold text-emerald-200">
              {mobileTab === 'geo_map'
                ? '真实卫星地理围栏与田块映射'
                : mobileTab === 'sim_drone'
                  ? '多作物生长模拟与无人机巡检'
                  : '基地监测、实时气象与告警处置'}
            </span>
            <button
              type="button"
              onClick={() => setMobileTab('sandbox')}
              aria-label="关闭抽屉返回三维沙盘"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-teal-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 overflow-y-auto agri-scroll flex-1 space-y-3">
            {mobileTab === 'geo_map' && (
              <RealGeoMapOverlay
                mode="sheet"
                plots={plots}
                growthMap={growthMap}
                selectedPlotId={selectedPlotId}
                droneTelemetry={droneTelemetry}
                onChangeMode={setGisMode}
                onSelectPlot={(id) => {
                  handleSelectPlot(id);
                  setMobileTab('sandbox');
                }}
                onDispatchDroneTo={(x, z, label) => {
                  handleDispatchDroneTo(x, z, label);
                  setMobileTab('sandbox');
                }}
              />
            )}

            {mobileTab === 'sim_drone' && (
              <>
                {/* Mobile Multi-Crop Growth Controls */}
                <div className="rounded-lg bg-[#083530] border border-teal-400/25 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      多作物生长模拟 ({mobileActiveGrowth.cropLabel} · {mobileActiveGrowth.stageName})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoGrowPlaying((v) => !v)}
                      className="min-h-[38px] px-3 rounded-lg bg-emerald-600 text-xs font-medium text-white"
                    >
                      {autoGrowPlaying ? '暂停推演' : '启动推演'}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {SIM_CROP_LIST.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setActiveSimCrop(c.key)}
                        className={`min-h-[38px] rounded text-xs font-medium ${
                          activeSimCrop === c.key
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'bg-[#05221e] text-teal-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-teal-100/85 tabular-nums">
                    第 {mobileActiveGrowth.day}/{mobileActiveGrowth.totalDays} 天 · 株高{' '}
                    {mobileActiveGrowth.plantHeightCm}cm · 预计亩产{' '}
                    {mobileActiveGrowth.estimatedYieldKgPerMu}kg
                  </div>

                  <input
                    aria-label="移动端作物生长天数调节"
                    type="range"
                    min={0}
                    max={mobileActiveGrowth.totalDays}
                    value={mobileActiveGrowth.day}
                    onChange={(e) => handleChangeGrowthDay(activeSimCrop, Number(e.target.value))}
                    className="w-full agri-slider"
                  />

                  <div className="grid grid-cols-6 gap-1">
                    {mobileActiveMeta.stageShortLabels.map((lbl, idx) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() =>
                          handleChangeGrowthDay(
                            activeSimCrop,
                            mobileActiveMeta.stagePresetDays[idx],
                          )
                        }
                        className={`min-h-[34px] rounded text-[10px] font-medium ${
                          mobileActiveGrowth.stageIndex === idx
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'bg-[#05221e] text-teal-200'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Drone Controls */}
                <div className="rounded-lg bg-[#083530] border border-teal-400/25 p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">多光谱无人机巡检控制</span>
                    <span className="font-mono text-emerald-300 tabular-nums">
                      植被指数 {droneTelemetry.ndviIndex.toFixed(2)} · 高度 {droneTelemetry.altitudeM}m
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { mode: DroneFlightMode.AutoPatrol, label: '自动航线' },
                        { mode: DroneFlightMode.TargetInspect, label: '指点巡检' },
                        { mode: DroneFlightMode.ManualControl, label: '手动遥控' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.mode}
                        type="button"
                        onClick={() => setDroneFlightMode(m.mode)}
                        className={`min-h-[44px] rounded-lg text-xs font-medium ${
                          droneFlightMode === m.mode
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'bg-[#05221e] text-teal-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { mode: CameraViewMode.OrbitOverview, label: '全局鸟瞰' },
                        { mode: CameraViewMode.DroneChase, label: '跟随视角' },
                        { mode: CameraViewMode.DroneFpv, label: '机载云台' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.mode}
                        type="button"
                        onClick={() => {
                          setCameraMode(c.mode);
                          setMobileTab('sandbox');
                        }}
                        className={`min-h-[44px] rounded-lg text-xs font-medium ${
                          cameraMode === c.mode
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-[#05221e] text-teal-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {mobileTab === 'weather_alert' && (
              <>
                <LeftCommandPanel
                  activeNav={activeNav}
                  plots={plots}
                  selectedPlotId={selectedPlotId}
                  healthSummary={healthSummary}
                  onSelectPlot={(id) => {
                    handleSelectPlot(id);
                    setMobileTab('sandbox');
                  }}
                  onFocusCategory={(cat) => {
                    handleFocusCategory(cat);
                    setMobileTab('sandbox');
                  }}
                  onTogglePlotIrrigation={handleTogglePlotIrrigation}
                />
                <RightCommandPanel
                  activeNav={activeNav}
                  selectedVillageId={selectedVillageId}
                  weather={weather}
                  telemetrySeries={telemetrySeries}
                  growthMap={growthMap}
                  activeSimCrop={activeSimCrop}
                  initialPreset={initialPreset}
                  growthSpeed={growthSpeed}
                  autoGrowPlaying={autoGrowPlaying}
                  alerts={alerts}
                  onChangeVillage={setSelectedVillageId}
                  onSelectSimCrop={setActiveSimCrop}
                  onApplyGrowthPreset={handleApplyGrowthPreset}
                  onChangeGrowthDay={handleChangeGrowthDay}
                  onToggleAutoGrow={() => setAutoGrowPlaying((v) => !v)}
                  onChangeGrowthSpeed={setGrowthSpeed}
                  onOpenDashboard={() => setDashboardOpen(true)}
                  onInspectAlertDevice={(dId, pId) => {
                    handleInspectAlertDevice(dId, pId);
                    setMobileTab('sandbox');
                  }}
                  onRepairDevice={handleRepairDevice}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom 5-Tab Navigation Bar (< 1024px, 56px height) */}
      <nav
        aria-label="移动端底部主导航"
        className="grid lg:hidden grid-cols-5 items-center fixed bottom-0 inset-x-0 h-14 z-40 bg-[#041d19] border-t border-teal-400/25"
      >
        {(
          [
            { key: 'sandbox', label: '三维沙盘', Icon: Navigation },
            { key: 'geo_map', label: '卫星地理', Icon: Globe },
            { key: 'sim_drone', label: '生长巡检', Icon: Sprout },
            { key: 'weather_alert', label: '基地气象', Icon: CloudSun },
          ] as const
        ).map(({ key, label, Icon }) => {
          const active = mobileTab === key && !dashboardOpen;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setDashboardOpen(false);
                setMobileTab(key);
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center text-[11px] font-medium transition-colors ${
                active ? 'text-emerald-400' : 'text-teal-200/70'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="mt-0.5">{label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDashboardOpen(true)}
          className={`min-h-[48px] flex flex-col items-center justify-center text-[11px] font-medium transition-colors ${
            dashboardOpen ? 'text-emerald-400' : 'text-teal-200/70'
          }`}
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          <span className="mt-0.5">数据大屏</span>
        </button>
      </nav>

      {/* Full-Screen Responsive Integrated Chinese Data Dashboard */}
      <IntegratedDashboardModal
        open={dashboardOpen}
        report={displayedDashboardReport}
        growthMap={growthMap}
        plots={plots}
        healthSummary={healthSummary}
        alerts={alerts}
        telemetrySeries={telemetrySeries}
        perfStats={perfStats}
        autoRefresh={autoRefreshDashboard}
        autoGrowPlaying={autoGrowPlaying}
        growthSpeed={growthSpeed}
        initialPreset={initialPreset}
        onClose={() => setDashboardOpen(false)}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        onManualRefresh={handleManualRefreshDashboard}
        onApplyGrowthPreset={handleApplyGrowthPreset}
        onChangeGrowthDay={handleChangeGrowthDay}
        onToggleAutoGrow={() => setAutoGrowPlaying((v) => !v)}
        onChangeGrowthSpeed={setGrowthSpeed}
        onTogglePlotIrrigation={handleTogglePlotIrrigation}
        onRepairDevice={handleRepairDevice}
      />
    </div>
  );
}
