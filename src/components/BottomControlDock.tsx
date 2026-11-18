import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Columns2,
  Compass,
  Eye,
  Filter,
  Gauge,
  Maximize2,
  Minimize2,
  Navigation,
  Sun,
  Sunset,
} from 'lucide-react';
import { DEVICE_CATEGORIES } from '../simulation/agriSimEngine';
import {
  CameraViewMode,
  DeviceCategoryKey,
  DroneFlightMode,
  DroneTelemetryState,
  LightingPreset,
  ScenePerformanceStats,
  SurfaceOverlayMode,
} from '../types/agri';

interface BottomControlDockProps {
  cameraMode: CameraViewMode;
  droneFlightMode: DroneFlightMode;
  droneTelemetry: DroneTelemetryState;
  perfStats: ScenePerformanceStats;
  surfaceOverlay: SurfaceOverlayMode;
  lightingPreset: LightingPreset;
  visibleCategories: Set<DeviceCategoryKey>;
  zenMode: boolean;
  gisSplitActive: boolean;
  onChangeCameraMode: (mode: CameraViewMode) => void;
  onChangeDroneFlightMode: (mode: DroneFlightMode) => void;
  onChangeSurfaceOverlay: (mode: SurfaceOverlayMode) => void;
  onChangeLightingPreset: (preset: LightingPreset) => void;
  onToggleCategory: (cat: DeviceCategoryKey) => void;
  onSetAllCategories: (selectAll: boolean) => void;
  onToggleZenMode: () => void;
  onToggleSplitGis: () => void;
  onOpenDashboard: () => void;
  onManualNudge: (delta: { forward: number; right: number; up: number }) => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  cameraMode,
  droneFlightMode,
  droneTelemetry,
  perfStats,
  surfaceOverlay,
  lightingPreset,
  visibleCategories,
  zenMode,
  gisSplitActive,
  onChangeCameraMode,
  onChangeDroneFlightMode,
  onChangeSurfaceOverlay,
  onChangeLightingPreset,
  onToggleCategory,
  onSetAllCategories,
  onToggleZenMode,
  onToggleSplitGis,
  onOpenDashboard,
  onManualNudge,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const allSelected = visibleCategories.size === DEVICE_CATEGORIES.length;

  return (
    <div
      className={`pointer-events-none fixed bottom-3 z-20 hidden lg:flex flex-col items-center w-full max-w-[740px] px-3 ${
        gisSplitActive ? 'left-[28%] -translate-x-1/2' : 'left-1/2 -translate-x-1/2'
      }`}
    >
      {/* Optional Pop-up IoT Device Legend Card */}
      {legendOpen && !dockCollapsed && (
        <div
          aria-label="设备图例过滤面板"
          className="pointer-events-auto mb-2 w-full max-w-[430px] self-end rounded-lg bg-[#062622]/96 border border-teal-400/30 p-3 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-teal-400/20 pb-2 mb-2.5">
            <span className="text-xs font-semibold text-emerald-100">
              设备图例与三维点位过滤
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSetAllCategories(!allSelected)}
                className="px-2.5 py-1 rounded bg-teal-800 hover:bg-teal-700 text-[11px] font-medium text-teal-100 cursor-pointer whitespace-nowrap"
              >
                {allSelected ? '全部不选' : '全部选中'}
              </button>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="px-2 py-1 rounded bg-[#093832] hover:bg-teal-800 text-[11px] text-teal-200 cursor-pointer"
              >
                收起
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {DEVICE_CATEGORIES.map((cat) => {
              const active = visibleCategories.has(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => onToggleCategory(cat.key)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#0b423b] border border-teal-400/35 text-white'
                      : 'bg-[#051f1c]/80 border border-teal-900/40 text-teal-200/45'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: active ? cat.colorHex : '#334155' }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapse / Expand, Dual-Screen GIS, Integrated Dashboard, Zen Mode & FPS Strip */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 mb-1">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-t-md bg-[#062622]/95 border border-b-0 border-teal-400/30 text-xs text-teal-100 hover:text-white cursor-pointer whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>展开控制台</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>收起控制台</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-1 px-2.5 py-1 rounded-t-md bg-[#062622]/95 border border-b-0 border-emerald-400/40 text-xs font-medium text-emerald-300 hover:text-white cursor-pointer whitespace-nowrap"
        >
          <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>综合数据大屏</span>
        </button>

        <button
          type="button"
          onClick={onToggleSplitGis}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-t-md border border-b-0 text-xs font-medium cursor-pointer whitespace-nowrap ${
            gisSplitActive
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
              : 'bg-[#062622]/95 border-teal-400/30 text-cyan-300 hover:text-white'
          }`}
        >
          <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{gisSplitActive ? '退出卫星双屏' : '三维+卫星双屏'}</span>
        </button>

        {!gisSplitActive && (
          <button
            type="button"
            onClick={onToggleZenMode}
            className="flex items-center gap-1 px-2.5 py-1 rounded-t-md bg-[#062622]/95 border border-b-0 border-teal-400/30 text-xs text-teal-100 hover:text-white cursor-pointer whitespace-nowrap"
          >
            {zenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>恢复侧栏</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>纯享三维</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-t-md bg-[#051f1c]/95 border border-b-0 border-teal-400/20 text-[11px] font-mono text-teal-200 tabular-nums whitespace-nowrap">
          <Gauge className="w-3 h-3 text-emerald-400" aria-hidden="true" />
          <span>{perfStats.fps}帧</span>
          <span className="text-teal-600">·</span>
          <span>批次{perfStats.drawCalls}</span>
        </div>
      </div>

      {/* Main Consolidated Bottom Dock */}
      {!dockCollapsed && (
        <div
          aria-label="无人机巡检与三维图层控制坞"
          className="pointer-events-auto w-full rounded-lg bg-[#062622]/96 border border-teal-400/30 px-3.5 py-2.5 shadow-2xl space-y-2"
        >
          {/* Row 1: Live UAV Telemetry Strip with Real WGS84 Coordinates */}
          <div className="flex items-center justify-between gap-2 border-b border-teal-400/15 pb-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Navigation className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-white whitespace-nowrap">
                多光谱无人机
              </span>
              <span className="text-teal-500" aria-hidden="true">·</span>
              <span className="text-teal-200 truncate">
                {droneTelemetry.targetLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
              <span className="text-teal-200 hidden xl:inline">
                {droneTelemetry.lng.toFixed(4)}°E,{droneTelemetry.lat.toFixed(4)}°N
              </span>
              <span className="text-emerald-300">植被指数 {droneTelemetry.ndviIndex.toFixed(2)}</span>
              <span className="text-teal-600" aria-hidden="true">/</span>
              <span className="text-amber-300">冠温 {droneTelemetry.canopyTempC}°C</span>
              <span className="text-teal-600" aria-hidden="true">/</span>
              <span className="text-cyan-300">高度 {droneTelemetry.altitudeM}m</span>
            </div>
          </div>

          {/* Row 2: Drone Flight Mode + Camera View + Layer Controls (Single Sleek Row) */}
          <div className="flex items-center justify-between gap-1.5">
            {/* Drone Flight Mode Group */}
            <div className="flex items-center gap-0.5 bg-[#041b18] p-0.5 rounded-md border border-teal-400/15 shrink-0">
              {(
                [
                  { mode: DroneFlightMode.AutoPatrol, label: '自动航线' },
                  { mode: DroneFlightMode.TargetInspect, label: '指点巡检' },
                  { mode: DroneFlightMode.ManualControl, label: '手动飞行' },
                ] as const
              ).map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => onChangeDroneFlightMode(item.mode)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    droneFlightMode === item.mode
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-teal-200 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Camera View Switcher */}
            <div className="flex items-center gap-0.5 bg-[#041b18] p-0.5 rounded-md border border-teal-400/15 shrink-0">
              <Eye className="w-3.5 h-3.5 text-teal-400 ml-1 mr-0.5 shrink-0" aria-hidden="true" />
              {(
                [
                  { mode: CameraViewMode.OrbitOverview, label: '全局鸟瞰' },
                  { mode: CameraViewMode.DroneChase, label: '无人机跟随' },
                  { mode: CameraViewMode.DroneFpv, label: '机载云台' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.mode}
                  type="button"
                  onClick={() => onChangeCameraMode(cam.mode)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    cameraMode === cam.mode
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'text-teal-200 hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            {/* 3D Heatmap Overlay + Day/Dusk + Legend Toggle */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onChangeSurfaceOverlay(
                    surfaceOverlay === SurfaceOverlayMode.Natural
                      ? SurfaceOverlayMode.SoilMoisture
                      : surfaceOverlay === SurfaceOverlayMode.SoilMoisture
                        ? SurfaceOverlayMode.CanopyTemp
                        : SurfaceOverlayMode.Natural,
                  )
                }
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#083530] hover:bg-[#0c4740] border border-teal-400/25 text-[11px] text-teal-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Compass className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                <span>
                  {surfaceOverlay === SurfaceOverlayMode.Natural
                    ? '实景农田'
                    : surfaceOverlay === SurfaceOverlayMode.SoilMoisture
                      ? '墒情热力'
                      : '冠温热力'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeLightingPreset(
                    lightingPreset === LightingPreset.SunnyDay
                      ? LightingPreset.GoldenDusk
                      : LightingPreset.SunnyDay,
                  )
                }
                aria-label="切换日间或黄昏光照环境"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#083530] hover:bg-[#0c4740] border border-teal-400/25 text-[11px] text-teal-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                {lightingPreset === LightingPreset.SunnyDay ? (
                  <>
                    <Sun className="w-3 h-3 text-amber-300" aria-hidden="true" />
                    <span>日间</span>
                  </>
                ) : (
                  <>
                    <Sunset className="w-3 h-3 text-orange-300" aria-hidden="true" />
                    <span>黄昏</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer whitespace-nowrap shrink-0 ${
                  legendOpen
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                    : 'bg-[#083530] hover:bg-[#0c4740] border-teal-400/25 text-teal-100'
                }`}
              >
                <Filter className="w-3 h-3" aria-hidden="true" />
                <span>设备图例 ({visibleCategories.size})</span>
              </button>
            </div>
          </div>

          {/* Row 3: Manual Flight Pad (shown when Manual Flight mode is active) */}
          {droneFlightMode === DroneFlightMode.ManualControl && (
            <div className="pt-1.5 border-t border-teal-400/15 flex items-center justify-between text-xs">
              <span className="text-teal-200/80">
                键盘 WASD / 方向键控制水平飞行，Q / E 调节高度，或长按右侧按钮：
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="无人机向前飞行"
                  onPointerDown={() => onManualNudge({ forward: 1, right: 0, up: 0 })}
                  onPointerUp={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  onPointerLeave={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  className="p-1.5 rounded bg-teal-800 hover:bg-teal-700 text-white cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="无人机向后飞行"
                  onPointerDown={() => onManualNudge({ forward: -1, right: 0, up: 0 })}
                  onPointerUp={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  onPointerLeave={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  className="p-1.5 rounded bg-teal-800 hover:bg-teal-700 text-white cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="无人机向左飞行"
                  onPointerDown={() => onManualNudge({ forward: 0, right: -1, up: 0 })}
                  onPointerUp={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  onPointerLeave={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  className="p-1.5 rounded bg-teal-800 hover:bg-teal-700 text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="无人机向右飞行"
                  onPointerDown={() => onManualNudge({ forward: 0, right: 1, up: 0 })}
                  onPointerUp={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  onPointerLeave={() => onManualNudge({ forward: 0, right: 0, up: 0 })}
                  className="p-1.5 rounded bg-teal-800 hover:bg-teal-700 text-white cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
