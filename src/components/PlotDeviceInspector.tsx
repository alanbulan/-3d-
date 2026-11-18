import React from 'react';
import { Crosshair, Droplets, RotateCcw, Wrench, X } from 'lucide-react';
import { DEVICE_CATEGORIES } from '../simulation/agriSimEngine';
import { sceneXZToLngLat } from '../simulation/geoProjection';
import {
  AgriPlot,
  CameraViewMode,
  CropGrowthMap,
  DroneTelemetryState,
  IoTDeviceNode,
} from '../types/agri';

interface PlotDeviceInspectorProps {
  selectedPlot: AgriPlot | null;
  selectedDevice: IoTDeviceNode | null;
  growthMap: CropGrowthMap;
  cameraMode: CameraViewMode;
  droneTelemetry: DroneTelemetryState;
  gisSplitActive?: boolean;
  zenMode?: boolean;
  onClose: () => void;
  onDispatchDroneTo: (x: number, z: number, label: string) => void;
  onTogglePlotIrrigation: (plotId: string) => void;
  onRepairDevice: (deviceId: string) => void;
  onResetCamera: () => void;
}

export const PlotDeviceInspector: React.FC<PlotDeviceInspectorProps> = ({
  selectedPlot,
  selectedDevice,
  growthMap,
  cameraMode,
  droneTelemetry,
  gisSplitActive = false,
  zenMode = false,
  onClose,
  onDispatchDroneTo,
  onTogglePlotIrrigation,
  onRepairDevice,
  onResetCamera,
}) => {
  return (
    <>
      {/* Gimbal FPV Multispectral Reticle HUD when in Drone FPV Camera */}
      {cameraMode === CameraViewMode.DroneFpv && (
        <div
          aria-label="无人机机载多光谱扫描视窗"
          className="pointer-events-none fixed inset-x-0 top-16 z-10 flex flex-col items-center"
        >
          <div className="rounded-md bg-[#041b18]/92 border border-emerald-400/40 px-4 py-1.5 text-xs flex flex-wrap items-center gap-2.5 tabular-nums shadow-lg">
            <span className="font-semibold text-emerald-300">机载多光谱云台视角</span>
            <span className="text-teal-500" aria-hidden="true">·</span>
            <span>
              经纬 {droneTelemetry.lng.toFixed(5)}°E, {droneTelemetry.lat.toFixed(5)}°N
            </span>
            <span className="text-teal-500" aria-hidden="true">·</span>
            <span>植被指数 {droneTelemetry.ndviIndex.toFixed(2)}</span>
            <span className="text-teal-500" aria-hidden="true">·</span>
            <span>叶面温度 {droneTelemetry.canopyTempC}°C</span>
            <span className="text-teal-500" aria-hidden="true">·</span>
            <span>虫情评估：{droneTelemetry.pestRiskLevel}</span>
            <button
              type="button"
              onClick={onResetCamera}
              className="pointer-events-auto ml-1 px-2 py-0.5 rounded bg-teal-800 hover:bg-teal-700 text-teal-100 cursor-pointer"
            >
              退出云台
            </button>
          </div>
        </div>
      )}

      {/* Selected 3D Plot or IoT Sensor Floating Inspector Card */}
      {(selectedPlot || selectedDevice) && (
        <div
          role="region"
          aria-label="三维选中对象详情面板"
          className={`pointer-events-auto fixed top-14 z-20 w-[92vw] max-w-[356px] rounded-lg bg-[#062622]/96 border border-emerald-400/40 p-3.5 shadow-2xl left-1/2 -translate-x-1/2 ${
            gisSplitActive
              ? 'lg:left-4 lg:translate-x-0'
              : zenMode
                ? 'lg:left-auto lg:right-4 lg:translate-x-0'
                : 'lg:left-auto lg:right-[332px] xl:right-[354px] lg:translate-x-0'
          }`}
        >
          {selectedDevice ? (
            (() => {
              const catMeta = DEVICE_CATEGORIES.find((c) => c.key === selectedDevice.category)!;
              const devGeo = sceneXZToLngLat(selectedDevice.x, selectedDevice.z);
              return (
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-teal-400/20 pb-2">
                    <div>
                      <div className="text-[11px] text-teal-300">
                        {catMeta.fullLabel} · 编号 {selectedDevice.id.toUpperCase()}
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {selectedDevice.name}
                      </h3>
                      <div className="text-[10px] font-mono text-teal-200/80 mt-0.5 tabular-nums">
                        地理坐标：{devGeo.lng.toFixed(6)}°E, {devGeo.lat.toFixed(6)}°N
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="关闭传感器详情面板"
                      className="p-1 rounded hover:bg-teal-800/60 text-teal-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs tabular-nums">
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">运行状态</div>
                      <div
                        className={`font-semibold mt-0.5 ${
                          selectedDevice.status === 'online'
                            ? 'text-emerald-300'
                            : selectedDevice.status === 'warning'
                              ? 'text-amber-300'
                              : 'text-rose-400'
                        }`}
                      >
                        {selectedDevice.status === 'online'
                          ? '在线正常'
                          : selectedDevice.status === 'warning'
                            ? '参数预警'
                            : '通信离线'}
                      </div>
                    </div>
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">电池电量</div>
                      <div className="font-semibold text-white mt-0.5">
                        {selectedDevice.batteryPct}%
                      </div>
                    </div>
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">信号强度</div>
                      <div className="font-semibold text-cyan-300 mt-0.5">
                        {selectedDevice.signalDbm} dBm
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded bg-[#083530]/80 px-2.5 py-1.5 text-xs flex items-center justify-between">
                    <span className="text-teal-200/80">{selectedDevice.readingLabel}</span>
                    <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                      {selectedDevice.readingValue}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onDispatchDroneTo(
                          selectedDevice.x,
                          selectedDevice.z,
                          selectedDevice.name,
                        )
                      }
                      className="flex-1 min-h-[36px] flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>派无人机悬停核查</span>
                    </button>

                    {selectedDevice.status !== 'online' && (
                      <button
                        type="button"
                        onClick={() => onRepairDevice(selectedDevice.id)}
                        className="min-h-[36px] px-3 flex items-center justify-center gap-1 rounded bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-slate-950 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>一键排障</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onResetCamera}
                      aria-label="重置全局视角"
                      className="min-h-[36px] px-2.5 flex items-center justify-center rounded bg-teal-900 hover:bg-teal-800 text-xs text-teal-100 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()
          ) : selectedPlot ? (
            (() => {
              const plotGeo = sceneXZToLngLat(selectedPlot.centerX, selectedPlot.centerZ);
              const cropSnap =
                selectedPlot.cropType === 'facility'
                  ? null
                  : growthMap[selectedPlot.cropType];
              return (
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-teal-400/20 pb-2">
                    <div>
                      <div className="text-[11px] text-teal-300 tabular-nums">
                        地块编码 {selectedPlot.code} · {selectedPlot.zoneLabel} · {selectedPlot.areaMu} 亩
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">{selectedPlot.name}</h3>
                      <div className="text-[10px] font-mono text-teal-200/80 mt-0.5 tabular-nums">
                        中心经纬：{plotGeo.lng.toFixed(6)}°E, {plotGeo.lat.toFixed(6)}°N
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="关闭地块详情面板"
                      className="p-1 rounded hover:bg-teal-800/60 text-teal-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs tabular-nums">
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">主栽品种</div>
                      <div className="font-semibold text-emerald-300 mt-0.5 truncate">
                        {selectedPlot.varietyName}
                      </div>
                    </div>
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">当前生长期</div>
                      <div className="font-semibold text-amber-300 mt-0.5 truncate">
                        {cropSnap
                          ? `${cropSnap.stageName} (${cropSnap.progressPct}%)`
                          : '恒温仓储与灌排运行'}
                      </div>
                    </div>
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">土壤含水率 / 温度</div>
                      <div className="font-semibold text-cyan-300 mt-0.5">
                        {selectedPlot.baseSoilMoisture.toFixed(1)}% · {selectedPlot.baseSoilTemp}°C
                      </div>
                    </div>
                    <div className="rounded bg-[#083530] p-2">
                      <div className="text-[11px] text-teal-200/70">
                        {cropSnap ? '株高 / 预计亩产' : '酸碱度 / 碱解氮'}
                      </div>
                      <div className="font-semibold text-white mt-0.5">
                        {cropSnap
                          ? `${cropSnap.plantHeightCm}cm · ${cropSnap.estimatedYieldKgPerMu}kg`
                          : `pH ${selectedPlot.soilPh} · ${selectedPlot.nitrogenMgKg}mg/kg`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {selectedPlot.cropType !== 'facility' && (
                      <button
                        type="button"
                        onClick={() => onTogglePlotIrrigation(selectedPlot.id)}
                        className={`flex-1 min-h-[36px] flex items-center justify-center gap-1.5 rounded text-xs font-medium cursor-pointer ${
                          selectedPlot.irrigationActive
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-teal-800 hover:bg-teal-700 text-white'
                        }`}
                      >
                        <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {selectedPlot.irrigationActive ? '关闭智能喷灌' : '开启智能喷灌'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onDispatchDroneTo(
                          selectedPlot.centerX,
                          selectedPlot.centerZ,
                          selectedPlot.name,
                        )
                      }
                      className="flex-1 min-h-[36px] flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>无人机巡检此田</span>
                    </button>
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>
      )}
    </>
  );
};
