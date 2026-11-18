import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CloudSun,
  Crosshair,
  Pause,
  Play,
  Sprout,
  Thermometer,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  INITIAL_GROWTH_PRESETS,
  MARKET_QUOTES,
  SIM_CROP_LIST,
  VILLAGE_PRESETS,
} from '../simulation/agriSimEngine';
import {
  CropGrowthMap,
  CropGrowthSnapshot,
  DeviceAlertItem,
  InitialGrowthPresetKey,
  NavModule,
  SimCropKey,
  TelemetryPoint,
  VillageWeatherSnapshot,
} from '../types/agri';

interface RightCommandPanelProps {
  activeNav: NavModule;
  selectedVillageId: string;
  weather: VillageWeatherSnapshot;
  telemetrySeries: TelemetryPoint[];
  growthMap: CropGrowthMap;
  activeSimCrop: SimCropKey;
  initialPreset: InitialGrowthPresetKey;
  growthSpeed: 1 | 2 | 5 | 10;
  autoGrowPlaying: boolean;
  alerts: DeviceAlertItem[];
  onChangeVillage: (villageId: string) => void;
  onSelectSimCrop: (crop: SimCropKey) => void;
  onApplyGrowthPreset: (preset: InitialGrowthPresetKey) => void;
  onChangeGrowthDay: (crop: SimCropKey, day: number) => void;
  onToggleAutoGrow: () => void;
  onChangeGrowthSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onOpenDashboard: () => void;
  onInspectAlertDevice: (deviceId: string, plotId: string) => void;
  onRepairDevice: (deviceId: string) => void;
}

const BotanicalStageGraphic: React.FC<{
  snapshot: CropGrowthSnapshot;
}> = ({ snapshot }) => {
  const { cropType, stageIndex, progressPct, stageName, colorHex, organColorHex } = snapshot;
  const isSeed = stageIndex === 0;
  const stemHeight = isSeed ? 4 : 10 + (progressPct / 100) * 32;
  const showOrgan = stageIndex >= 3;

  return (
    <div className="w-13 h-17 rounded bg-slate-50 border border-teal-500/30 flex flex-col items-center justify-between p-1 shrink-0">
      <svg viewBox="0 0 60 56" className="w-10 h-11 overflow-visible" aria-hidden="true">
        <line x1="6" y1="51" x2="54" y2="51" stroke="#94a3b8" strokeWidth="2" />
        {isSeed ? (
          <g transform="translate(30, 50)">
            <ellipse cx="-10" cy="-2" rx="4.5" ry="2.8" fill="#8b6d45" />
            <ellipse cx="0" cy="-2.5" rx="5" ry="3.2" fill="#7c5e38" />
            <ellipse cx="10" cy="-2" rx="4.5" ry="2.8" fill="#8b6d45" />
          </g>
        ) : cropType === 'tomato' ? (
          <g transform="translate(30, 51)">
            <line x1="0" y1="0" x2="0" y2="-40" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
            <path
              d={`M -2 0 Q 4 ${-stemHeight * 0.5} -1 ${-stemHeight}`}
              fill="none"
              stroke={colorHex}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d={`M 0 ${-stemHeight * 0.35} Q -11 ${-stemHeight * 0.45} -14 ${-stemHeight * 0.38}`}
              fill="none"
              stroke={colorHex}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={`M 0 ${-stemHeight * 0.65} Q 11 ${-stemHeight * 0.75} 14 ${-stemHeight * 0.66}`}
              fill="none"
              stroke={colorHex}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {showOrgan && (
              <>
                <circle cx="-6" cy={-stemHeight * 0.45} r={stageIndex >= 4 ? 3.5 : 2.3} fill={organColorHex} />
                <circle cx="6" cy={-stemHeight * 0.72} r={stageIndex >= 4 ? 3.8 : 2.3} fill={organColorHex} />
                <circle cx="2" cy={-stemHeight * 0.55} r={stageIndex >= 4 ? 3.2 : 2.1} fill={organColorHex} />
              </>
            )}
          </g>
        ) : cropType === 'corn' ? (
          <g transform="translate(30, 51)">
            <line x1="0" y1="0" x2="0" y2={-stemHeight} stroke={colorHex} strokeWidth="3.2" strokeLinecap="round" />
            <path
              d={`M 0 ${-stemHeight * 0.38} Q -13 ${-stemHeight * 0.56} -17 ${-stemHeight * 0.36}`}
              fill="none"
              stroke={colorHex}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d={`M 0 ${-stemHeight * 0.62} Q 13 ${-stemHeight * 0.8} 17 ${-stemHeight * 0.6}`}
              fill="none"
              stroke={colorHex}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {showOrgan && (
              <>
                <path
                  d={`M 0 ${-stemHeight} L -4 ${-stemHeight - 6} M 0 ${-stemHeight} L 0 ${-stemHeight - 7} M 0 ${-stemHeight} L 4 ${-stemHeight - 6}`}
                  stroke="#eab308"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {stageIndex >= 4 && (
                  <ellipse
                    cx="4.5"
                    cy={-stemHeight * 0.52}
                    rx="2.8"
                    ry="5.2"
                    transform={`rotate(22 4.5 ${-stemHeight * 0.52})`}
                    fill={organColorHex}
                  />
                )}
              </>
            )}
          </g>
        ) : (
          [-10, 0, 10].map((dx, idx) => {
            const h = stemHeight * (idx === 1 ? 1.06 : 0.88);
            return (
              <g key={dx} transform={`translate(${30 + dx}, 51)`}>
                <path
                  d={`M 0 0 Q ${dx * 0.22} ${-h * 0.55} ${dx * 0.42} ${-h}`}
                  fill="none"
                  stroke={colorHex}
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
                <path
                  d={`M 0 ${-h * 0.4} Q -8 ${-h * 0.62} -11 ${-h * 0.74}`}
                  fill="none"
                  stroke={colorHex}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                {showOrgan && (
                  <path
                    d={
                      cropType === 'rice'
                        ? `M ${dx * 0.42} ${-h} Q ${dx * 0.42 + 7} ${-h - 3} ${dx * 0.42 + 11} ${-h + 5}`
                        : `M ${dx * 0.42} ${-h} L ${dx * 0.42} ${-h - 7}`
                    }
                    fill="none"
                    stroke={organColorHex}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })
        )}
      </svg>
      <span className="text-[10px] font-semibold text-slate-700 leading-none truncate max-w-full">
        {stageName}
      </span>
    </div>
  );
};

export const RightCommandPanel: React.FC<RightCommandPanelProps> = ({
  activeNav,
  selectedVillageId,
  weather,
  telemetrySeries,
  growthMap,
  activeSimCrop,
  initialPreset,
  growthSpeed,
  autoGrowPlaying,
  alerts,
  onChangeVillage,
  onSelectSimCrop,
  onApplyGrowthPreset,
  onChangeGrowthDay,
  onToggleAutoGrow,
  onChangeGrowthSpeed,
  onOpenDashboard,
  onInspectAlertDevice,
  onRepairDevice,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const activeCropMeta =
    SIM_CROP_LIST.find((c) => c.key === activeSimCrop) ?? SIM_CROP_LIST[0];
  const activeGrowth = growthMap[activeSimCrop];

  const chartW = 280;
  const chartH = 52;
  const padX = 8;
  const padY = 6;

  const tempPoints = telemetrySeries.map((pt, i) => {
    const x = padX + (i / (telemetrySeries.length - 1)) * (chartW - padX * 2);
    const normT = (pt.airTempC - 10) / 20;
    const y = chartH - padY - Math.max(0, Math.min(1, normT)) * (chartH - padY * 2);
    return { x, y };
  });

  const humPoints = telemetrySeries.map((pt, i) => {
    const x = padX + (i / (telemetrySeries.length - 1)) * (chartW - padX * 2);
    const normH = (pt.airHumidityPct - 35) / 65;
    const y = chartH - padY - Math.max(0, Math.min(1, normH)) * (chartH - padY * 2);
    return { x, y };
  });

  const tempPath = tempPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const humPath = humPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const inspectedSample =
    hoverIdx !== null && telemetrySeries[hoverIdx]
      ? telemetrySeries[hoverIdx]
      : telemetrySeries[telemetrySeries.length - 3];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto agri-scroll pl-0.5">
      {/* Section 1: Real-time Weather + 24h Temperature & Humidity Curve */}
      <section
        aria-label="实时气象与温湿度监测"
        className="rounded-lg bg-[#062622]/95 border border-teal-400/25 p-3 shrink-0"
      >
        <div className="flex items-center justify-between border-b border-teal-400/20 pb-1.5">
          <div className="flex items-center gap-1.5">
            <CloudSun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-emerald-100 whitespace-nowrap">
              实时气象与温湿度
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenDashboard}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-teal-800/90 hover:bg-teal-700 text-[11px] text-emerald-200 cursor-pointer whitespace-nowrap"
          >
            <BarChart3 className="w-3 h-3" aria-hidden="true" />
            <span>综合数据大屏</span>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <label htmlFor="village-select" className="sr-only">
              选择监测片区
            </label>
            <select
              id="village-select"
              value={selectedVillageId}
              onChange={(e) => onChangeVillage(e.target.value)}
              className="rounded bg-[#093832] border border-teal-400/30 px-2 py-1 text-xs font-medium text-emerald-100 focus:outline-none focus:border-emerald-400 cursor-pointer shrink-0"
            >
              {Object.values(VILLAGE_PRESETS).map((v) => (
                <option key={v.villageId} value={v.villageId} className="bg-[#062622]">
                  {v.villageName}
                </option>
              ))}
            </select>
            <span className="text-xs text-teal-200/80 whitespace-nowrap truncate">
              {weather.weatherCondition}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs tabular-nums whitespace-nowrap shrink-0">
            <span className="flex items-center gap-0.5 font-semibold text-amber-300">
              <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
              {weather.airTempC.toFixed(1)}°C
            </span>
            <span className="text-teal-500" aria-hidden="true">·</span>
            <span className="font-semibold text-cyan-300">湿度 {weather.airHumidityPct}%</span>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
          <div className="rounded bg-[#083530]/90 px-2 py-1 border border-teal-400/15">
            <div className="text-teal-200/70 whitespace-nowrap">二氧化碳</div>
            <div className="font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
              {weather.co2Ppm} PPM
            </div>
          </div>
          <div className="rounded bg-[#083530]/90 px-2 py-1 border border-teal-400/15">
            <div className="text-teal-200/70 whitespace-nowrap">土壤均温</div>
            <div className="font-semibold text-amber-300 tabular-nums whitespace-nowrap">
              {weather.soilTempC}°C
            </div>
          </div>
          <div className="rounded bg-[#083530]/90 px-2 py-1 border border-teal-400/15">
            <div className="text-teal-200/70 whitespace-nowrap">大气压力</div>
            <div className="font-semibold text-cyan-300 tabular-nums whitespace-nowrap">
              {weather.pressureKpa} kPa
            </div>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-teal-400/15">
          <div className="flex items-center justify-between text-[11px] mb-1 gap-1">
            <span className="text-teal-200/80 font-medium whitespace-nowrap">
              24小时温湿度曲线
            </span>
            <span className="font-mono text-[11px] text-teal-100 tabular-nums whitespace-nowrap">
              {inspectedSample.hourLabel} · {inspectedSample.airTempC}°C / {inspectedSample.airHumidityPct}%
            </span>
          </div>
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-12 rounded bg-[#051f1c] border border-teal-400/15"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <line
              x1={padX}
              y1={chartH * 0.5}
              x2={chartW - padX}
              y2={chartH * 0.5}
              stroke="rgba(45,212,191,0.12)"
              strokeDasharray="3 3"
            />
            <path d={humPath} fill="none" stroke="#22d3ee" strokeWidth="2" />
            <path d={tempPath} fill="none" stroke="#fbbf24" strokeWidth="2" />
            {telemetrySeries.map((pt, i) => {
              const x = tempPoints[i].x;
              return (
                <g key={pt.hourLabel}>
                  <circle
                    cx={x}
                    cy={tempPoints[i].y}
                    r={hoverIdx === i ? 3.5 : 1.8}
                    fill="#fbbf24"
                  />
                  <circle
                    cx={x}
                    cy={humPoints[i].y}
                    r={hoverIdx === i ? 3.5 : 1.8}
                    fill="#22d3ee"
                  />
                  <rect
                    x={x - 10}
                    y={0}
                    width={20}
                    height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Section 2: Multi-Crop Refined 3D Growth Simulator (Rice, Corn, Tomato, Wheat) */}
      <section
        aria-label="多品种精细化生长模拟"
        className="rounded-lg bg-[#062622]/95 border border-teal-400/25 p-3 shrink-0 space-y-2"
      >
        <div className="flex items-center justify-between border-b border-teal-400/20 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-emerald-100 whitespace-nowrap">
              多作物生长模拟系统
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggleAutoGrow}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoGrowPlaying
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {autoGrowPlaying ? (
              <>
                <Pause className="w-3 h-3" aria-hidden="true" />
                <span>暂停推演</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" aria-hidden="true" />
                <span>自动推演</span>
              </>
            )}
          </button>
        </div>

        {/* Initial State Preset + Time-Lapse Speed Row */}
        <div className="flex items-center justify-between gap-1.5">
          <label htmlFor="side-preset-select" className="sr-only">
            选择农时初始状态
          </label>
          <select
            id="side-preset-select"
            value={initialPreset}
            onChange={(e) => onApplyGrowthPreset(e.target.value as InitialGrowthPresetKey)}
            className="flex-1 min-w-0 rounded bg-[#083530] border border-teal-400/25 px-2 py-1 text-[11px] text-emerald-100 cursor-pointer"
          >
            {INITIAL_GROWTH_PRESETS.map((p) => (
              <option key={p.key} value={p.key} className="bg-[#062622]">
                {p.label}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-[#041d19] rounded p-0.5 border border-teal-400/20 shrink-0">
            {([1, 2, 5, 10] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeGrowthSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                  growthSpeed === spd
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-teal-200 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* 4-Crop Selector Grid */}
        <div className="grid grid-cols-4 gap-1">
          {SIM_CROP_LIST.map((crop) => {
            const snap = growthMap[crop.key];
            const active = activeSimCrop === crop.key;
            return (
              <button
                key={crop.key}
                type="button"
                onClick={() => onSelectSimCrop(crop.key)}
                className={`rounded px-1.5 py-1.5 text-left border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0b423b] border-emerald-400/60 text-white'
                    : 'bg-[#08322c]/80 border-teal-400/15 text-teal-100/85 hover:bg-[#0a3933]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>{crop.label}</span>
                  <span className="font-mono text-[10px] text-emerald-300">{snap.progressPct}%</span>
                </div>
                <div className="text-[10px] text-teal-200/80 truncate mt-0.5">
                  {snap.stageName}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Crop Detailed Card */}
        <div className="flex items-center gap-2.5 rounded bg-[#083530]/90 border border-teal-400/20 p-2">
          <BotanicalStageGraphic snapshot={activeGrowth} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white truncate">
                {activeGrowth.cropLabel} · {activeGrowth.stageName}
              </span>
              <span className="font-mono text-[11px] text-emerald-300 tabular-nums shrink-0">
                第 {activeGrowth.day}/{activeGrowth.totalDays} 天
              </span>
            </div>
            <div className="text-[11px] text-amber-200/95 truncate">
              {activeGrowth.morphologyNote}
            </div>
            <div className="flex items-center justify-between text-[11px] text-teal-100 tabular-nums">
              <span>株高 {activeGrowth.plantHeightCm}cm</span>
              <span>叶指 {activeGrowth.leafAreaIndex}</span>
              <span className="text-emerald-300">估产 {activeGrowth.estimatedYieldKgPerMu}kg/亩</span>
            </div>
          </div>
        </div>

        {/* Day Slider + 6 Stage Buttons (Seed -> Maturity) */}
        <div className="space-y-1.5">
          <input
            id="growth-day-slider"
            aria-label={`${activeGrowth.cropLabel}生长周期天数滑块`}
            type="range"
            min={0}
            max={activeGrowth.totalDays}
            value={activeGrowth.day}
            onChange={(e) => onChangeGrowthDay(activeSimCrop, Number(e.target.value))}
            className="w-full agri-slider"
          />

          <div className="grid grid-cols-6 gap-1">
            {activeCropMeta.stageShortLabels.map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                onClick={() =>
                  onChangeGrowthDay(activeSimCrop, activeCropMeta.stagePresetDays[idx])
                }
                className={`py-1 rounded text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                  activeGrowth.stageIndex === idx
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-[#083530] text-teal-200 hover:bg-[#0d4a43]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Device Alerts OR Agricultural Market Quotes (Guaranteed visible height, never collapses) */}
      <section
        aria-label={activeNav === NavModule.MarketPrice ? '农产品行情监测' : '设备警告与智能处置'}
        className="rounded-lg bg-[#062622]/95 border border-teal-400/25 p-3 shrink-0"
      >
        {activeNav === NavModule.MarketPrice ? (
          <>
            <div className="flex items-center justify-between border-b border-teal-400/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold tracking-wide text-emerald-100 whitespace-nowrap">
                  芜湖大米及轮作粮行情
                </h2>
              </div>
              <span className="text-[11px] text-teal-200/75 whitespace-nowrap">产地收购均价</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {MARKET_QUOTES.map((q) => (
                <div
                  key={q.name}
                  className="rounded bg-[#083530]/90 border border-teal-400/15 px-2.5 py-1.5 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-white truncate">{q.name}</div>
                    <div className="text-[11px] text-teal-200/70 truncate">
                      {q.origin} · {q.spec}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="font-bold text-emerald-300">
                      {q.pricePerJin.toFixed(2)} 元/斤
                    </div>
                    <div className="text-[11px] text-amber-300">周环比 +{q.weeklyDeltaPct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-teal-400/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold tracking-wide text-emerald-100 whitespace-nowrap">
                  设备警告
                </h2>
              </div>
              <span className="text-[11px] text-teal-200/75 tabular-nums whitespace-nowrap">
                待处理 {alerts.filter((a) => !a.resolved).length} 项
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded border px-2.5 py-2 text-xs transition-colors ${
                    alert.resolved
                      ? 'bg-[#072e29]/60 border-teal-400/15 text-teal-200/60'
                      : 'bg-[#093832] border-amber-400/30 text-teal-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-teal-200/75 tabular-nums">
                    <span>{alert.timestamp}</span>
                    <span>{alert.resolved ? '已恢复正常' : '实时告警'}</span>
                  </div>
                  <div
                    className={`mt-0.5 font-medium truncate ${
                      alert.resolved
                        ? 'text-teal-200/70'
                        : alert.severity === 'high'
                          ? 'text-amber-300'
                          : 'text-teal-50'
                    }`}
                  >
                    {alert.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectAlertDevice(alert.deviceId, alert.plotId)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-teal-800/90 hover:bg-teal-700 text-[11px] text-teal-100 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Crosshair className="w-3 h-3" aria-hidden="true" />
                      <span>派无人机巡检</span>
                    </button>
                    {!alert.resolved ? (
                      <button
                        type="button"
                        onClick={() => onRepairDevice(alert.deviceId)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] text-white font-medium cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Wrench className="w-3 h-3" aria-hidden="true" />
                        <span>远程排障</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>已闭环</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
