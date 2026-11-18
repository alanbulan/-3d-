export enum NavModule {
  Overview = 'overview',
  SoilMoisture = 'soil',
  PestControl = 'pest',
  SmartIrrigation = 'irrigation',
  SocialService = 'service',
  MarketPrice = 'market',
}

export enum CameraViewMode {
  OrbitOverview = 'orbit',
  DroneChase = 'drone_chase',
  DroneFpv = 'drone_fpv',
  PlotFocus = 'plot_focus',
}

export enum DroneFlightMode {
  AutoPatrol = 'auto_patrol',
  TargetInspect = 'target_inspect',
  ManualControl = 'manual_control',
}

export enum SurfaceOverlayMode {
  Natural = 'natural',
  SoilMoisture = 'moisture_heatmap',
  CanopyTemp = 'temp_heatmap',
}

export enum LightingPreset {
  SunnyDay = 'sunny_day',
  GoldenDusk = 'golden_dusk',
}

export type SimCropKey = 'rice' | 'corn' | 'tomato' | 'wheat';
export type CropVariety = SimCropKey | 'facility';

export type InitialGrowthPresetKey =
  | 'mixed_season'
  | 'all_seed'
  | 'all_sprout'
  | 'all_vegetative'
  | 'all_flowering'
  | 'all_mature';

export type DeviceCategoryKey =
  | 'camera'
  | 'weather'
  | 'soil'
  | 'water_valve'
  | 'butterfly_valve'
  | 'pest_lamp'
  | 'led_screen'
  | 'gateway'
  | 'controller'
  | 'base_station'
  | 'greenhouse'
  | 'multispectral';

export type DeviceHealthStatus = 'online' | 'warning' | 'offline';

export interface DeviceCategoryMeta {
  key: DeviceCategoryKey;
  label: string;
  fullLabel: string;
  colorHex: string;
}

export type AgriZoneId = 'north' | 'central' | 'south' | 'east';

export interface AgriPlot {
  id: string;
  name: string;
  code: string;
  zoneId: AgriZoneId;
  zoneLabel: string;
  areaMu: number;
  cropType: CropVariety;
  varietyName: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  baseSoilMoisture: number;
  baseSoilTemp: number;
  irrigationActive: boolean;
  soilPh: number;
  nitrogenMgKg: number;
}

export interface IoTDeviceNode {
  id: string;
  name: string;
  category: DeviceCategoryKey;
  plotId: string;
  x: number;
  z: number;
  status: DeviceHealthStatus;
  batteryPct: number;
  signalDbm: number;
  lastUpdated: string;
  readingLabel: string;
  readingValue: string;
}

export interface DeviceAlertItem {
  id: string;
  deviceId: string;
  plotId: string;
  timestamp: string;
  title: string;
  severity: 'high' | 'medium';
  resolved: boolean;
}

export interface TelemetryPoint {
  hourLabel: string;
  airTempC: number;
  airHumidityPct: number;
  soilTempC: number;
  soilMoisturePct: number;
  lightLux: number;
}

export interface VillageWeatherSnapshot {
  villageId: string;
  villageName: string;
  weatherCondition: string;
  airTempC: number;
  airHumidityPct: number;
  soilTempC: number;
  soilMoisturePct: number;
  co2Ppm: number;
  pressureKpa: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  windDirectionLabel: string;
  rainfallMm: number;
  pm25: number;
}

export interface CropGrowthSnapshot {
  cropType: SimCropKey;
  cropLabel: string;
  day: number;
  totalDays: number;
  progressPct: number;
  stageIndex: number;
  stageName: string;
  morphologyNote: string;
  daysToNextStage: number;
  plantHeightCm: number;
  leafAreaIndex: number;
  canopyCoverPct: number;
  panicleDroop: number;
  chlorophyllSpad: number;
  estimatedYieldKgPerMu: number;
  // 3D Morphological Organ Transform Parameters
  seedMoundScale: number;
  stalkScaleY: number;
  canopyDensityScale: number;
  reproductiveScale: number;
  colorHex: string;
  organColorHex: string;
}

export type CropGrowthMap = Record<SimCropKey, CropGrowthSnapshot>;

export interface ZoneEnvironmentSummary {
  zoneId: AgriZoneId;
  zoneLabel: string;
  plotCount: number;
  areaMu: number;
  avgAirTempC: number;
  avgAirHumidityPct: number;
  avgSoilTempC: number;
  avgSoilMoisturePct: number;
  irrigatingPlots: number;
}

export interface CropYieldForecastRow {
  cropType: SimCropKey;
  cropLabel: string;
  plantedAreaMu: number;
  stageName: string;
  progressPct: number;
  yieldKgPerMu: number;
  totalTons: number;
  unitPricePerKg: number;
  estimatedRevenueWanYuan: number;
}

export interface DashboardAggregateReport {
  refreshedAtLabel: string;
  totalPlantedMu: number;
  totalFacilityMu: number;
  overallGrowthProgressPct: number;
  totalPredictedTons: number;
  totalPredictedRevenueWanYuan: number;
  activeIrrigationCount: number;
  totalFlowM3PerHour: number;
  zones: ZoneEnvironmentSummary[];
  yieldRows: CropYieldForecastRow[];
}

export interface ScenePerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  activeLodSummary: string;
  culledCount: number;
  mergedStaticBatches: number;
  textureMemoryKb: number;
  qualityTier: 'high' | 'balanced' | 'mobile_eco';
}

export interface DroneTelemetryState {
  x: number;
  y: number;
  z: number;
  lat: number;
  lng: number;
  headingRad: number;
  speedMs: number;
  altitudeM: number;
  batteryPct: number;
  flightMode: DroneFlightMode;
  activeWaypointIndex: number;
  targetX: number;
  targetZ: number;
  targetLabel: string;
  ndviIndex: number;
  canopyTempC: number;
  pestRiskLevel: '低风险' | '中度关注' | '重点防控';
  scanningPlotId: string;
}

export interface MarketQuoteItem {
  name: string;
  spec: string;
  pricePerJin: number;
  weeklyDeltaPct: number;
  origin: string;
}
