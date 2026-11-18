import React, { useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  MapMouseEvent,
  Polygon,
  Polyline,
} from '@vis.gl/react-google-maps';
import { Columns2, Compass, Crosshair, Globe, Minimize2, Navigation } from 'lucide-react';
import { DRONE_WAYPOINTS } from '../simulation/agriSimEngine';
import {
  GEO_ORIGIN_LAT,
  GEO_ORIGIN_LNG,
  REAL_BOUNDARY_COORDINATES_LNG_LAT,
  REAL_BOUNDARY_LATLNG_PATH,
  computeRealBoundaryArea,
  isLngLatInsideBoundary,
  lngLatToSceneXZ,
  sceneRectToLatLngPolygon,
  sceneXZToLngLat,
} from '../simulation/geoProjection';
import { AgriPlot, CropGrowthMap, DroneTelemetryState } from '../types/agri';

export type GisOverlayMode = 'mini' | 'split' | 'hidden' | 'sheet';

interface RealGeoMapOverlayProps {
  mode: GisOverlayMode;
  plots: AgriPlot[];
  growthMap: CropGrowthMap;
  selectedPlotId: string | null;
  droneTelemetry: DroneTelemetryState;
  zenMode?: boolean;
  onChangeMode: (nextMode: 'mini' | 'split' | 'hidden') => void;
  onSelectPlot: (plotId: string) => void;
  onDispatchDroneTo: (x: number, z: number, label: string) => void;
}

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

export const RealGeoMapOverlay: React.FC<RealGeoMapOverlayProps> = ({
  mode,
  plots,
  growthMap,
  selectedPlotId,
  droneTelemetry,
  zenMode = false,
  onChangeMode,
  onSelectPlot,
  onDispatchDroneTo,
}) => {
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid');
  const boundaryMetrics = useMemo(() => computeRealBoundaryArea(), []);

  const plotPolygons = useMemo(
    () =>
      plots.map((plot) => {
        const path = sceneRectToLatLngPolygon(plot.centerX, plot.centerZ, plot.width, plot.depth);
        const fillHex =
          plot.cropType === 'facility'
            ? '#38bdf8'
            : growthMap[plot.cropType]?.colorHex ?? '#10b981';
        return { plot, path, fillHex };
      }),
    [plots, growthMap],
  );

  const patrolPathLatLng = useMemo(() => {
    const pts = DRONE_WAYPOINTS.map((wp) => sceneXZToLngLat(wp.x, wp.z));
    if (pts.length > 0) {
      pts.push(pts[0]);
    }
    return pts;
  }, []);

  if (mode === 'hidden') {
    return (
      <button
        type="button"
        onClick={() => onChangeMode('mini')}
        className={`hidden lg:flex items-center gap-1.5 fixed top-14 z-20 px-3 py-1.5 rounded-lg bg-[#062622]/95 border border-teal-400/35 text-xs font-medium text-emerald-200 hover:text-white hover:bg-[#093832] shadow-lg cursor-pointer ${
          zenMode ? 'left-3' : 'left-[332px] xl:left-[354px]'
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
        <span>开启真实地理鹰眼</span>
      </button>
    );
  }

  const handleMapClick = (e: MapMouseEvent) => {
    if (mode === 'mini') return;
    const latLng = e.detail?.latLng;
    if (!latLng) return;
    if (!isLngLatInsideBoundary(latLng.lng, latLng.lat)) return;
    const xz = lngLatToSceneXZ(latLng.lng, latLng.lat);
    onDispatchDroneTo(
      xz.x,
      xz.z,
      `地理坐标 (${latLng.lng.toFixed(4)}°E, ${latLng.lat.toFixed(4)}°N)`,
    );
  };

  const renderMapSurface = () => {
    if (!MAPS_API_KEY) {
      // Fallback WGS84 vector schematic when API key is absent
      const minLng = 118.4975;
      const maxLng = 118.53;
      const minLat = 31.2652;
      const maxLat = 31.2822;
      const toSvg = (lng: number, lat: number) => ({
        sx: ((lng - minLng) / (maxLng - minLng)) * 360,
        sy: ((maxLat - lat) / (maxLat - minLat)) * 220,
      });
      const ringPoints = REAL_BOUNDARY_COORDINATES_LNG_LAT.map(([lng, lat]) => {
        const { sx, sy } = toSvg(lng, lat);
        return `${sx.toFixed(1)},${sy.toFixed(1)}`;
      }).join(' ');
      const uavSvg = toSvg(droneTelemetry.lng, droneTelemetry.lat);

      return (
        <div className="relative w-full h-full bg-[#041d19] flex flex-col items-center justify-center p-2">
          <svg viewBox="0 0 360 220" className="w-full h-full">
            <polygon
              points={ringPoints}
              fill="rgba(16, 185, 129, 0.14)"
              stroke="#2dd4bf"
              strokeWidth="2"
            />
            {plotPolygons.map(({ plot, path, fillHex }) => {
              const pts = path
                .map((p) => {
                  const { sx, sy } = toSvg(p.lng, p.lat);
                  return `${sx.toFixed(1)},${sy.toFixed(1)}`;
                })
                .join(' ');
              const isSel = selectedPlotId === plot.id;
              return (
                <polygon
                  key={plot.id}
                  points={pts}
                  fill={fillHex}
                  fillOpacity={isSel ? 0.72 : 0.42}
                  stroke={isSel ? '#fbbf24' : '#99f6e4'}
                  strokeWidth={isSel ? 2 : 0.9}
                  className="cursor-pointer"
                  onClick={() => onSelectPlot(plot.id)}
                />
              );
            })}
            <circle cx={uavSvg.sx} cy={uavSvg.sy} r="5" fill="#fbbf24" stroke="#041b18" strokeWidth="1.5" />
          </svg>
        </div>
      );
    }

    return (
      <APIProvider apiKey={MAPS_API_KEY} language="zh-CN" region="CN">
        <GoogleMap
          id={`dongba-gis-${mode}`}
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: GEO_ORIGIN_LAT, lng: GEO_ORIGIN_LNG }}
          defaultZoom={mode === 'mini' ? 13.6 : 14.8}
          mapTypeId={mapType}
          gestureHandling="greedy"
          disableDefaultUI={mode === 'mini'}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onClick={handleMapClick}
          className="w-full h-full"
        >
          {/* User-specified Wuhu Dongba real WGS84 polygon boundary */}
          <Polygon
            paths={REAL_BOUNDARY_LATLNG_PATH}
            strokeColor="#2dd4bf"
            strokeOpacity={0.96}
            strokeWeight={2.6}
            fillColor="#0d9488"
            fillOpacity={0.1}
            clickable={false}
          />

          {/* Synchronized 3D Agricultural Plots in Real WGS84 Coordinates */}
          {plotPolygons.map(({ plot, path, fillHex }) => {
            const isSelected = selectedPlotId === plot.id;
            return (
              <Polygon
                key={plot.id}
                paths={path}
                strokeColor={isSelected ? '#fbbf24' : '#ccfbf1'}
                strokeOpacity={isSelected ? 1 : 0.78}
                strokeWeight={isSelected ? 2.6 : 1.2}
                fillColor={fillHex}
                fillOpacity={isSelected ? 0.58 : 0.34}
                onClick={() => onSelectPlot(plot.id)}
              />
            );
          })}

          {/* Synchronized UAV Patrol Flight Corridor */}
          <Polyline
            path={patrolPathLatLng}
            strokeColor="#38bdf8"
            strokeOpacity={0.78}
            strokeWeight={2}
            clickable={false}
          />

          {/* Live Real-Time UAV Position Marker */}
          <AdvancedMarker
            position={{ lat: droneTelemetry.lat, lng: droneTelemetry.lng }}
            anchorLeft="-50%"
            anchorTop="-50%"
            title={`植保多光谱无人机 (${droneTelemetry.lng.toFixed(5)}°E, ${droneTelemetry.lat.toFixed(5)}°N)`}
          >
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 border border-slate-950 shadow-md text-[10px] font-bold whitespace-nowrap">
              <Navigation className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>无人机</span>
            </div>
          </AdvancedMarker>
        </GoogleMap>
      </APIProvider>
    );
  };

  if (mode === 'sheet') {
    return (
      <div className="rounded-xl bg-[#062622] border border-teal-400/30 overflow-hidden flex flex-col h-[52vh] min-h-[320px]">
        <div className="flex items-center justify-between px-3 py-2 bg-[#05201c] border-b border-teal-400/20 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-emerald-100 truncate">
              芜湖湾沚东八产区 · 真实卫星地理映射
            </span>
          </div>
          <span className="font-mono text-[11px] text-teal-200 tabular-nums shrink-0">
            围栏 {boundaryMetrics.areaHectares} 公顷
          </span>
        </div>

        <div className="relative flex-1 min-h-0">{renderMapSurface()}</div>

        <div className="px-3 py-2 bg-[#05201c] border-t border-teal-400/20 flex items-center justify-between gap-2 text-[11px] text-teal-100 tabular-nums">
          <span className="truncate">
            无人机实时经纬：{droneTelemetry.lng.toFixed(5)}°E, {droneTelemetry.lat.toFixed(5)}°N
          </span>
          <span className="text-emerald-300 shrink-0">点选田块或地图联动巡检</span>
        </div>
      </div>
    );
  }

  if (mode === 'split') {
    return (
      <section
        aria-label="真实卫星地理双屏联动视图"
        className="relative w-full h-full flex flex-col bg-[#041b18] border-l border-teal-400/35"
      >
        <div className="h-12 shrink-0 hidden lg:block" />
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#062622]/96 border-b border-teal-400/25 text-xs z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">
                真实地理卫星正射影像 · 东八村核心示范围栏
              </div>
              <div className="text-[11px] text-teal-200/80 font-mono tabular-nums truncate">
                范围 118.4984°E-118.5289°E · 31.2662°N-31.2812°N ({boundaryMetrics.eastWestKm}km ×{' '}
                {boundaryMetrics.northSouthKm}km)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMapType((prev) => (prev === 'hybrid' ? 'roadmap' : 'hybrid'))}
              className="px-2.5 py-1.5 rounded bg-[#093832] hover:bg-teal-800 border border-teal-400/25 text-xs font-medium text-emerald-200 cursor-pointer whitespace-nowrap"
            >
              {mapType === 'hybrid' ? '切换电子路网' : '切换卫星影像'}
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('mini')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-teal-800 hover:bg-teal-700 text-xs font-medium text-teal-50 cursor-pointer whitespace-nowrap"
            >
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>切回鹰眼小窗</span>
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">{renderMapSurface()}</div>

        <div className="px-3.5 py-2 bg-[#05201c]/96 border-t border-teal-400/25 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <div className="flex items-center gap-2 text-teal-100">
            <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              无人机坐标：{droneTelemetry.lng.toFixed(6)}°E, {droneTelemetry.lat.toFixed(6)}°N
            </span>
          </div>
          <span className="text-[11px] text-emerald-300">
            点击红线内任意真实地理位置可派遣三维无人机前往巡检
          </span>
        </div>
      </section>
    );
  }

  // Default desktop 'mini' Eagle-Eye GIS Window tucked cleanly beside LeftCommandPanel
  return (
    <aside
      aria-label="真实地理环境卫星鹰眼窗"
      className={`hidden lg:flex flex-col fixed top-14 z-20 w-[258px] xl:w-[276px] rounded-lg bg-[#062622]/96 border border-teal-400/35 shadow-2xl overflow-hidden ${
        zenMode ? 'left-3' : 'left-[332px] xl:left-[354px]'
      }`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#05201c] border-b border-teal-400/20 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-emerald-100 truncate">真实地理围栏 (芜湖湾沚)</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMapType((prev) => (prev === 'hybrid' ? 'roadmap' : 'hybrid'))}
            className="px-1.5 py-0.5 rounded bg-[#093832] hover:bg-teal-800 text-[10px] text-emerald-200 cursor-pointer"
          >
            {mapType === 'hybrid' ? '路网' : '卫星'}
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('split')}
            title="开启三维与真实卫星双屏联动"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-medium text-white cursor-pointer"
          >
            <Columns2 className="w-3 h-3" aria-hidden="true" />
            <span>双屏</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('hidden')}
            className="px-1.5 py-0.5 rounded bg-[#093832] hover:bg-teal-800 text-[10px] text-teal-200 cursor-pointer"
          >
            收起
          </button>
        </div>
      </div>

      <div className="relative w-full h-[146px]">{renderMapSurface()}</div>

      <div className="px-2.5 py-1 bg-[#05201c] border-t border-teal-400/20 flex items-center justify-between text-[10px] font-mono text-teal-200/90 tabular-nums">
        <span>{droneTelemetry.lng.toFixed(4)}°E</span>
        <span>{droneTelemetry.lat.toFixed(4)}°N</span>
        <span className="text-emerald-300">点击田块定位</span>
      </div>
    </aside>
  );
};
