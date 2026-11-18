import React from 'react';
import {
  Activity,
  Droplets,
  Layers,
  MapPin,
  ShieldCheck,
  Sprout,
  Tractor,
} from 'lucide-react';
import { DeviceHealthSummary } from '../simulation/agriSimEngine';
import { AgriPlot, DeviceCategoryKey, NavModule } from '../types/agri';

interface LeftCommandPanelProps {
  activeNav: NavModule;
  plots: AgriPlot[];
  selectedPlotId: string | null;
  healthSummary: DeviceHealthSummary;
  onSelectPlot: (plotId: string) => void;
  onFocusCategory: (category: DeviceCategoryKey) => void;
  onTogglePlotIrrigation: (plotId: string) => void;
}

export const LeftCommandPanel: React.FC<LeftCommandPanelProps> = ({
  activeNav,
  plots,
  selectedPlotId,
  healthSummary,
  onSelectPlot,
  onFocusCategory,
  onTogglePlotIrrigation,
}) => {
  const totalAreaMu = plots.reduce((acc, p) => acc + p.areaMu, 0);
  const riceMu = plots
    .filter((p) => p.cropType === 'rice')
    .reduce((acc, p) => acc + p.areaMu, 0);
  const cornMu = plots
    .filter((p) => p.cropType === 'corn')
    .reduce((acc, p) => acc + p.areaMu, 0);
  const tomatoMu = plots
    .filter((p) => p.cropType === 'tomato')
    .reduce((acc, p) => acc + p.areaMu, 0);
  const wheatMu = plots
    .filter((p) => p.cropType === 'wheat')
    .reduce((acc, p) => acc + p.areaMu, 0);
  const facilityMu = plots
    .filter((p) => p.cropType === 'facility')
    .reduce((acc, p) => acc + p.areaMu, 0);

  // Semi-circular gauge arc calculation for onlineRatePct
  const gaugeRadius = 52;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeOffset =
    gaugeCircumference * (1 - Math.max(0, Math.min(100, healthSummary.onlineRatePct)) / 100);

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto agri-scroll pr-0.5">
      {/* Section 1: Total Base Area & Real Geographic Plot Distribution */}
      <section
        aria-label="基地总面积概览"
        className="rounded-lg bg-[#062622]/95 border border-teal-400/25 p-3 shrink-0"
      >
        <div className="flex items-center justify-between border-b border-teal-400/20 pb-1.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-emerald-100">
              基地总面积与品种结构
            </h2>
          </div>
          <span className="text-[11px] text-teal-200/75 tabular-nums">
            湾沚东八 · {plots.length} 地块
          </span>
        </div>

        <div className="mt-1.5 rounded bg-[#051f1c] border border-teal-400/15 px-2 py-1 flex items-center justify-between text-[10px] font-mono text-teal-200/85 tabular-nums">
          <span>真实测绘围栏：118.50°E-118.53°E</span>
          <span>31.27°N-31.28°N</span>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          {/* Concentric Ring Gauge */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="rgba(20, 184, 166, 0.16)"
                strokeWidth="9"
              />
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="#10b981"
                strokeWidth="9"
                strokeDasharray={`${((riceMu + cornMu) / totalAreaMu) * 301.6} 301.6`}
                strokeLinecap="round"
              />
              <circle
                cx="60"
                cy="60"
                r="36"
                fill="none"
                stroke="rgba(6, 182, 212, 0.18)"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r="36"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="6"
                strokeDasharray={`${((riceMu + cornMu + tomatoMu + wheatMu) / totalAreaMu) * 226.2} 226.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <Sprout className="w-4 h-4 text-emerald-400 mb-0.5" aria-hidden="true" />
              <span className="text-sm font-bold text-white tabular-nums leading-tight">
                {totalAreaMu}亩
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1 text-xs">
            <div className="flex items-center justify-between border-b border-teal-400/15 pb-1">
              <span className="text-teal-100/80">优质贡米水稻</span>
              <span className="font-semibold text-emerald-300 tabular-nums">{riceMu} 亩</span>
            </div>
            <div className="flex items-center justify-between border-b border-teal-400/15 pb-1">
              <span className="text-teal-100/80">数字高产玉米</span>
              <span className="font-semibold text-amber-300 tabular-nums">{cornMu} 亩</span>
            </div>
            <div className="flex items-center justify-between border-b border-teal-400/15 pb-1">
              <span className="text-teal-100/80">设施与露地番茄</span>
              <span className="font-semibold text-rose-300 tabular-nums">{tomatoMu} 亩</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-teal-100/80">轮作麦田 / 泵站</span>
              <span className="font-semibold text-cyan-300 tabular-nums">
                {wheatMu} / {facilityMu} 亩
              </span>
            </div>
          </div>
        </div>

        {/* Contextual Plot Soil Moisture / Irrigation Quick Table */}
        <div className="mt-2.5 pt-2 border-t border-teal-400/15">
          <div className="flex items-center justify-between text-[11px] text-teal-200/70 mb-1.5">
            <span>
              {activeNav === NavModule.SmartIrrigation
                ? '田块智能水阀联动控制'
                : '核心田块实时墒情速览 (点击定位)'}
            </span>
            <span>含水率 / 操作</span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto agri-scroll pr-1">
            {plots.map((plot) => {
              const isSelected = selectedPlotId === plot.id;
              return (
                <div
                  key={plot.id}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/25 border border-emerald-400/50 text-white'
                      : 'bg-[#08332e]/80 hover:bg-[#0b423b] text-teal-100/90'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPlot(plot.id)}
                    className="flex items-center gap-1.5 text-left truncate flex-1 min-h-[26px] cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{plot.name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-emerald-300 tabular-nums">
                      {plot.baseSoilMoisture.toFixed(1)}%
                    </span>
                    {plot.cropType !== 'facility' ? (
                      <button
                        type="button"
                        onClick={() => onTogglePlotIrrigation(plot.id)}
                        aria-label={`${plot.irrigationActive ? '关闭' : '开启'}${plot.name}灌溉`}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          plot.irrigationActive
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-teal-900/90 text-teal-200 hover:bg-teal-800'
                        }`}
                      >
                        {plot.irrigationActive ? '喷灌中' : '开阀'}
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-teal-200/70">
                        枢纽
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Real-Time IoT Device Health Monitoring */}
      <section
        aria-label="设备实时监测"
        className="rounded-lg bg-[#062622]/95 border border-teal-400/25 p-3.5 shrink-0"
      >
        <div className="flex items-center justify-between border-b border-teal-400/20 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-emerald-100">
              {activeNav === NavModule.SocialService ? '农机与社会化服务监测' : '设备实时监测'}
            </h2>
          </div>
          <span className="text-xs text-teal-200/75 tabular-nums">
            传感器总数 {healthSummary.totalCount}
          </span>
        </div>

        {/* Semi-circular Online Rate Gauge + Autonomous Machinery Summary */}
        <div className="mt-3 grid grid-cols-2 gap-2 items-center">
          <div className="flex flex-col items-center">
            <svg viewBox="0 0 130 78" className="w-32 h-20">
              <path
                d="M 13 68 A 52 52 0 0 1 117 68"
                fill="none"
                stroke="rgba(20, 184, 166, 0.18)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 13 68 A 52 52 0 0 1 117 68"
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray={`${gaugeCircumference}`}
                strokeDashoffset={`${gaugeOffset}`}
                strokeLinecap="round"
              />
              <text
                x="65"
                y="54"
                textAnchor="middle"
                className="fill-emerald-400 text-lg font-bold font-mono"
              >
                {healthSummary.onlineRatePct}%
              </text>
              <text x="65" y="71" textAnchor="middle" className="fill-teal-100/80 text-[11px]">
                在线率
              </text>
            </svg>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded bg-[#083530] px-2.5 py-1.5 border border-teal-400/15">
              <Tractor className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[11px] text-teal-200/75 truncate">北斗无人农机</div>
                <div className="text-xs font-semibold text-white tabular-nums">
                  作业中 1 台 · 待命 3 台
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="rounded bg-[#083530] py-1.5 border border-teal-400/15">
                <div className="text-[11px] text-teal-200/75">在线设备</div>
                <div className="text-sm font-bold text-emerald-300 tabular-nums">
                  {healthSummary.onlineCount}
                </div>
              </div>
              <div className="rounded bg-[#083530] py-1.5 border border-teal-400/15">
                <div className="text-[11px] text-teal-200/75">预警/离线</div>
                <div className="text-sm font-bold text-amber-300 tabular-nums">
                  {healthSummary.warningCount + healthSummary.offlineCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Device Health Table matching reference screenshot */}
        <div className="mt-3 flex items-center justify-between text-xs text-teal-200/80 mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>设备健康明细 (点击筛选定位)</span>
          </span>
          {activeNav === NavModule.PestControl && (
            <span className="text-amber-300 text-[11px]">绿色诱控优先</span>
          )}
        </div>

        <div className="space-y-1.5 overflow-y-auto agri-scroll flex-1 pr-1">
          {healthSummary.rows.map((row) => (
            <button
              key={row.category}
              type="button"
              onClick={() => onFocusCategory(row.category)}
              className="w-full flex items-center justify-between rounded bg-[#083530]/90 hover:bg-[#0c4740] border border-teal-400/15 px-2.5 py-2 text-xs transition-colors cursor-pointer text-left"
            >
              <span className="font-medium text-teal-50 truncate pr-2">{row.fullLabel}</span>
              <span className="flex items-center gap-2.5 shrink-0 tabular-nums text-[11px]">
                <span className="text-emerald-300">在线 {row.online}</span>
                <span className="text-teal-500" aria-hidden="true">·</span>
                <span className={row.warning > 0 ? 'text-amber-300 font-semibold' : 'text-teal-200/60'}>
                  报警 {row.warning}
                </span>
                <span className="text-teal-500" aria-hidden="true">·</span>
                <span className={row.offline > 0 ? 'text-rose-400 font-semibold' : 'text-teal-200/60'}>
                  离线 {row.offline}
                </span>
              </span>
            </button>
          ))}

          {activeNav === NavModule.SmartIrrigation && (
            <div className="mt-2 rounded bg-cyan-950/60 border border-cyan-400/25 p-2.5 text-xs text-cyan-100 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-300 shrink-0" aria-hidden="true" />
              <span>青弋江支渠引水流量稳定，田间管网变频恒压运行中。</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
