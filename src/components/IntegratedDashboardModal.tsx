import React from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Cpu,
  Droplets,
  Gauge,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Sprout,
  Thermometer,
  Wrench,
  X,
} from 'lucide-react';
import {
  DeviceHealthSummary,
  INITIAL_GROWTH_PRESETS,
  SIM_CROP_LIST,
} from '../simulation/agriSimEngine';
import { computeRealBoundaryArea } from '../simulation/geoProjection';
import {
  AgriPlot,
  CropGrowthMap,
  DashboardAggregateReport,
  DeviceAlertItem,
  InitialGrowthPresetKey,
  ScenePerformanceStats,
  SimCropKey,
  TelemetryPoint,
} from '../types/agri';

interface IntegratedDashboardModalProps {
  open: boolean;
  report: DashboardAggregateReport;
  growthMap: CropGrowthMap;
  plots: AgriPlot[];
  healthSummary: DeviceHealthSummary;
  alerts: DeviceAlertItem[];
  telemetrySeries: TelemetryPoint[];
  perfStats: ScenePerformanceStats;
  autoRefresh: boolean;
  autoGrowPlaying: boolean;
  growthSpeed: 1 | 2 | 5 | 10;
  initialPreset: InitialGrowthPresetKey;
  onClose: () => void;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  onApplyGrowthPreset: (preset: InitialGrowthPresetKey) => void;
  onChangeGrowthDay: (crop: SimCropKey, day: number) => void;
  onToggleAutoGrow: () => void;
  onChangeGrowthSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onTogglePlotIrrigation: (plotId: string) => void;
  onRepairDevice: (deviceId: string) => void;
}

const QUALITY_LABELS: Record<ScenePerformanceStats['qualityTier'], string> = {
  high: '桌面高精渲染档',
  balanced: '均衡稳帧档',
  mobile_eco: '移动高帧率节能档',
};

export const IntegratedDashboardModal: React.FC<IntegratedDashboardModalProps> = ({
  open,
  report,
  growthMap,
  plots,
  healthSummary,
  alerts,
  telemetrySeries,
  perfStats,
  autoRefresh,
  autoGrowPlaying,
  growthSpeed,
  initialPreset,
  onClose,
  onToggleAutoRefresh,
  onManualRefresh,
  onApplyGrowthPreset,
  onChangeGrowthDay,
  onToggleAutoGrow,
  onChangeGrowthSpeed,
  onTogglePlotIrrigation,
  onRepairDevice,
}) => {
  if (!open) return null;

  const geoMetrics = computeRealBoundaryArea();
  const maxYieldTons = Math.max(1, ...report.yieldRows.map((r) => r.totalTons));

  const chartW = 360;
  const chartH = 88;
  const padX = 12;
  const padY = 10;
  const tempPath = telemetrySeries
    .map((pt, i) => {
      const x = padX + (i / Math.max(1, telemetrySeries.length - 1)) * (chartW - padX * 2);
      const y =
        chartH - padY - Math.max(0, Math.min(1, (pt.airTempC - 10) / 20)) * (chartH - padY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const humPath = telemetrySeries
    .map((pt, i) => {
      const x = padX + (i / Math.max(1, telemetrySeries.length - 1)) * (chartW - padX * 2);
      const y =
        chartH -
        padY -
        Math.max(0, Math.min(1, (pt.airHumidityPct - 35) / 65)) * (chartH - padY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="智慧农业综合数据大屏"
      className="fixed inset-0 z-50 bg-[#031714]/96 text-[#e6f7f3] flex flex-col overflow-hidden"
    >
      {/* Top Command Ribbon */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6 py-3 bg-[#052420] border-b border-teal-400/30 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <BarChart3 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-base lg:text-lg font-bold tracking-wide text-white truncate">
              安徽省芜湖大米及多元轮作产业集群 · 综合数据决策大屏
            </h2>
            <p className="text-[11px] text-teal-200/80 tabular-nums truncate">
              真实地理测绘围栏：{geoMetrics.eastWestKm}km × {geoMetrics.northSouthKm}km (折合总围栏{' '}
              {geoMetrics.areaHectares} 公顷 · 核心示范田 {report.totalPlantedMu + report.totalFacilityMu} 亩)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs text-teal-200/85 font-mono tabular-nums">
            数据同步：{report.refreshedAtLabel}
          </span>

          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              autoRefresh
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
            }`}
          >
            模式：{autoRefresh ? '实时自动更新' : '按需手动刷新'}
          </button>

          <button
            type="button"
            onClick={onManualRefresh}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-800 hover:bg-teal-700 border border-teal-400/30 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
            <span>立即刷新</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span>返回三维沙盘</span>
          </button>
        </div>
      </header>

      {/* Responsive Scrollable Body */}
      <div className="flex-1 overflow-y-auto agri-scroll p-3.5 lg:p-5 space-y-4">
        {/* Top 6 Core KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">核心种植总面积</div>
            <div className="mt-1 text-xl font-bold text-white tabular-nums">
              {report.totalPlantedMu}{' '}
              <span className="text-xs font-normal text-teal-200">亩</span>
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-300 tabular-nums">
              配套泵站烘干 {report.totalFacilityMu} 亩
            </div>
          </div>

          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">整体作物生长进度</div>
            <div className="mt-1 text-xl font-bold text-emerald-300 tabular-nums">
              {report.overallGrowthProgressPct}%
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-teal-950 overflow-hidden">
              <div
                className="h-full bg-emerald-400 origin-left"
                style={{ transform: `scaleX(${report.overallGrowthProgressPct / 100})` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">本季预计总产量</div>
            <div className="mt-1 text-xl font-bold text-amber-300 tabular-nums">
              {report.totalPredictedTons}{' '}
              <span className="text-xs font-normal text-teal-200">吨</span>
            </div>
            <div className="mt-0.5 text-[11px] text-teal-200/80">覆盖水稻/玉米/番茄/小麦</div>
          </div>

          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">预计综合农业产值</div>
            <div className="mt-1 text-xl font-bold text-cyan-300 tabular-nums">
              {report.totalPredictedRevenueWanYuan}{' '}
              <span className="text-xs font-normal text-teal-200">万元</span>
            </div>
            <div className="mt-0.5 text-[11px] text-teal-200/80">按产地订单指导价测算</div>
          </div>

          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">物联网传感器在线率</div>
            <div className="mt-1 text-xl font-bold text-emerald-300 tabular-nums">
              {healthSummary.onlineRatePct}%
            </div>
            <div className="mt-0.5 text-[11px] text-teal-200/80 tabular-nums">
              在线 {healthSummary.onlineCount} / 总计 {healthSummary.totalCount} 台
            </div>
          </div>

          <div className="rounded-lg bg-[#062924] border border-teal-400/25 p-3">
            <div className="text-xs text-teal-200/75">智能灌溉瞬时总流量</div>
            <div className="mt-1 text-xl font-bold text-sky-300 tabular-nums">
              {report.totalFlowM3PerHour}{' '}
              <span className="text-xs font-normal text-teal-200">m³/h</span>
            </div>
            <div className="mt-0.5 text-[11px] text-teal-200/80 tabular-nums">
              当前开启喷滴灌 {report.activeIrrigationCount} 片区
            </div>
          </div>
        </div>

        {/* Main 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left 7 Columns: Multi-Crop Refined Growth Simulation + Yield Prediction */}
          <div className="xl:col-span-7 space-y-4">
            {/* Panel A: Multi-Crop Growth Status & Direct Simulation Controls */}
            <section className="rounded-xl bg-[#062924] border border-teal-400/25 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-400/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-white">
                    多作物全周期生长状态总览与实时调控 (种子至成熟六阶段)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <label htmlFor="dashboard-preset-select" className="sr-only">
                    选择农时初始状态预设
                  </label>
                  <select
                    id="dashboard-preset-select"
                    value={initialPreset}
                    onChange={(e) =>
                      onApplyGrowthPreset(e.target.value as InitialGrowthPresetKey)
                    }
                    className="rounded bg-[#083831] border border-teal-400/30 px-2 py-1 text-xs text-emerald-100 cursor-pointer"
                  >
                    {INITIAL_GROWTH_PRESETS.map((preset) => (
                      <option key={preset.key} value={preset.key} className="bg-[#062622]">
                        初始态：{preset.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center rounded bg-[#041d19] p-0.5 border border-teal-400/20">
                    {([1, 2, 5, 10] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onChangeGrowthSpeed(spd)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          growthSpeed === spd
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'text-teal-200 hover:text-white'
                        }`}
                      >
                        {spd}倍速
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onToggleAutoGrow}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                      autoGrowPlaying
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {autoGrowPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>暂停时间流逝</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>启动时间流逝</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SIM_CROP_LIST.map((meta) => {
                  const snap = growthMap[meta.key];
                  return (
                    <div
                      key={meta.key}
                      className="rounded-lg bg-[#083530]/90 border border-teal-400/20 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm border border-white/30 shrink-0"
                            style={{ backgroundColor: snap.colorHex }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-bold text-white">
                            {snap.cropLabel} · {snap.stageName}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-emerald-300 tabular-nums">
                          第 {snap.day}/{snap.totalDays} 天 ({snap.progressPct}%)
                        </span>
                      </div>

                      <div className="text-[11px] text-teal-100/85 truncate">
                        三维形态：{snap.morphologyNote}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px] tabular-nums">
                        <div className="rounded bg-[#05231f] px-2 py-1">
                          <span className="text-teal-200/70">株高 </span>
                          <span className="font-semibold text-white">{snap.plantHeightCm}cm</span>
                        </div>
                        <div className="rounded bg-[#05231f] px-2 py-1">
                          <span className="text-teal-200/70">叶面积 </span>
                          <span className="font-semibold text-cyan-300">{snap.leafAreaIndex}</span>
                        </div>
                        <div className="rounded bg-[#05231f] px-2 py-1">
                          <span className="text-teal-200/70">叶绿素 </span>
                          <span className="font-semibold text-amber-300">
                            {snap.chlorophyllSpad}
                          </span>
                        </div>
                      </div>

                      <input
                        aria-label={`${snap.cropLabel}生长天数调节`}
                        type="range"
                        min={0}
                        max={snap.totalDays}
                        value={snap.day}
                        onChange={(e) => onChangeGrowthDay(meta.key, Number(e.target.value))}
                        className="w-full agri-slider"
                      />

                      <div className="grid grid-cols-6 gap-1">
                        {meta.stageShortLabels.map((lbl, idx) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => onChangeGrowthDay(meta.key, meta.stagePresetDays[idx])}
                            className={`py-1 rounded text-[10px] font-medium cursor-pointer truncate ${
                              snap.stageIndex === idx
                                ? 'bg-emerald-500 text-slate-950 font-semibold'
                                : 'bg-[#05231f] text-teal-200 hover:bg-teal-800'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Panel B: Multi-Crop Yield & Economic Value Forecast Table */}
            <section className="rounded-xl bg-[#062924] border border-teal-400/25 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-400/20 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-white">
                    多品种单产测算与总产量、产值预测明细
                  </h3>
                </div>
                <span className="text-xs text-teal-200/80 tabular-nums">
                  结合实时温湿度、土壤墒情与物候期动态修正
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-teal-400/20 text-teal-200/80">
                      <th className="py-2 pr-3 font-medium">作物品种</th>
                      <th className="py-2 px-2 font-medium">种植面积</th>
                      <th className="py-2 px-2 font-medium">当前物候期</th>
                      <th className="py-2 px-2 font-medium">预计亩产</th>
                      <th className="py-2 px-2 font-medium">预计总产</th>
                      <th className="py-2 pl-2 font-medium text-right">预计产值</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-400/10">
                    {report.yieldRows.map((row) => (
                      <tr key={row.cropType} className="hover:bg-[#083530]/60">
                        <td className="py-2.5 pr-3 font-semibold text-white">{row.cropLabel}</td>
                        <td className="py-2.5 px-2 text-teal-100">{row.plantedAreaMu} 亩</td>
                        <td className="py-2.5 px-2 text-emerald-300">
                          {row.stageName} ({row.progressPct}%)
                        </td>
                        <td className="py-2.5 px-2 text-teal-100">{row.yieldKgPerMu} kg/亩</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-amber-300 w-14">
                              {row.totalTons} 吨
                            </span>
                            <div className="hidden sm:block w-20 h-1.5 rounded-full bg-teal-950 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 origin-left"
                                style={{
                                  transform: `scaleX(${Math.min(1, row.totalTons / maxYieldTons)})`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pl-2 text-right font-bold text-cyan-300">
                          {row.estimatedRevenueWanYuan.toFixed(2)} 万元
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right 5 Columns: Regional Temp/Humidity Matrix + IoT/Irrigation + 3D Performance Telemetry */}
          <div className="xl:col-span-5 space-y-4">
            {/* Panel C: 4-Zone Average Temperature, Humidity & Soil Moisture Matrix */}
            <section className="rounded-xl bg-[#062924] border border-teal-400/25 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-400/20 pb-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-white">
                    各区域平均温湿度与土壤墒情矩阵
                  </h3>
                </div>
                <span className="text-xs text-teal-200/75">四大地理分区实时均值</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {report.zones.map((z) => (
                  <div
                    key={z.zoneId}
                    className="rounded-lg bg-[#083530]/90 border border-teal-400/20 p-2.5 text-xs space-y-1.5 tabular-nums"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{z.zoneLabel}</span>
                      <span className="text-[11px] text-teal-200/80">{z.areaMu} 亩</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="rounded bg-[#05231f] px-2 py-1">
                        <span className="text-teal-200/70">气温/湿度：</span>
                        <span className="font-semibold text-amber-300">
                          {z.avgAirTempC}°C / {z.avgAirHumidityPct}%
                        </span>
                      </div>
                      <div className="rounded bg-[#05231f] px-2 py-1">
                        <span className="text-teal-200/70">土温/墒情：</span>
                        <span className="font-semibold text-cyan-300">
                          {z.avgSoilTempC}°C / {z.avgSoilMoisturePct}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 24h Microclimate Trend Curve */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] text-teal-200/80 mb-1">
                  <span>全产区 24 小时气温 (黄) 与相对湿度 (青) 双轴曲线</span>
                  <span>自动气象站实测</span>
                </div>
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full h-20 rounded bg-[#041d19] border border-teal-400/15"
                >
                  <line
                    x1={padX}
                    y1={chartH * 0.5}
                    x2={chartW - padX}
                    y2={chartH * 0.5}
                    stroke="rgba(45,212,191,0.14)"
                    strokeDasharray="3 3"
                  />
                  <path d={humPath} fill="none" stroke="#22d3ee" strokeWidth="2.2" />
                  <path d={tempPath} fill="none" stroke="#fbbf24" strokeWidth="2.2" />
                </svg>
              </div>
            </section>

            {/* Panel D: Irrigation Valves & IoT Alert Quick Control */}
            <section className="rounded-xl bg-[#062924] border border-teal-400/25 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-400/20 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-white">
                    智能灌溉水阀联动与异常设备处置
                  </h3>
                </div>
                <span className="text-xs text-emerald-300 tabular-nums">
                  待处理告警 {alerts.filter((a) => !a.resolved).length} 项
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto agri-scroll pr-1">
                {plots
                  .filter((p) => p.cropType !== 'facility')
                  .map((plot) => (
                    <div
                      key={plot.id}
                      className="flex items-center justify-between rounded bg-[#083530]/90 border border-teal-400/15 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate pr-2 text-teal-50">{plot.name}</span>
                      <button
                        type="button"
                        onClick={() => onTogglePlotIrrigation(plot.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer shrink-0 ${
                          plot.irrigationActive
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-teal-900 text-teal-100 hover:bg-teal-800'
                        }`}
                      >
                        <Droplets className="w-3 h-3" aria-hidden="true" />
                        <span>{plot.irrigationActive ? '灌溉中' : '开启'}</span>
                      </button>
                    </div>
                  ))}
              </div>

              <div className="space-y-1.5">
                {alerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="flex items-center justify-between gap-2 rounded bg-[#05231f] border border-teal-400/15 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-teal-100">{alt.title}</span>
                    {alt.resolved ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>正常</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRepairDevice(alt.deviceId)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        <Wrench className="w-3 h-3" aria-hidden="true" />
                        <span>排障</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Panel E: Three.js 60FPS Performance Optimization Telemetry */}
            <section className="rounded-xl bg-[#062924] border border-teal-400/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-teal-400/20 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-white">
                    三维引擎渲染管线与移动设备性能优化状态
                  </h3>
                </div>
                <span className="flex items-center gap-1 text-xs font-mono text-emerald-300 tabular-nums">
                  <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{perfStats.fps} 帧/秒</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs tabular-nums">
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">自适应画质策略</div>
                  <div className="font-semibold text-emerald-300 mt-0.5 truncate">
                    {QUALITY_LABELS[perfStats.qualityTier]}
                  </div>
                </div>
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">单帧绘制批次</div>
                  <div className="font-semibold text-white mt-0.5">
                    {perfStats.drawCalls} 次 (静态合并 {perfStats.mergedStaticBatches} 批)
                  </div>
                </div>
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">多级细节层次</div>
                  <div className="font-semibold text-cyan-300 mt-0.5 truncate">
                    {perfStats.activeLodSummary}
                  </div>
                </div>
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">视锥与遮挡剔除</div>
                  <div className="font-semibold text-amber-300 mt-0.5">
                    实时剔除 {perfStats.culledCount} 组对象
                  </div>
                </div>
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">实时三角面数</div>
                  <div className="font-semibold text-white mt-0.5">
                    {perfStats.triangles.toLocaleString()} 面
                  </div>
                </div>
                <div className="rounded bg-[#083530] p-2">
                  <div className="text-[11px] text-teal-200/70">压缩程序纹理显存</div>
                  <div className="font-semibold text-emerald-300 mt-0.5">
                    {perfStats.textureMemoryKb} KB
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
