import {
  AgriPlot,
  AgriZoneId,
  CropGrowthMap,
  CropGrowthSnapshot,
  CropYieldForecastRow,
  DashboardAggregateReport,
  DeviceAlertItem,
  DeviceCategoryKey,
  DeviceCategoryMeta,
  DroneFlightMode,
  DroneTelemetryState,
  InitialGrowthPresetKey,
  IoTDeviceNode,
  MarketQuoteItem,
  SimCropKey,
  TelemetryPoint,
  VillageWeatherSnapshot,
  ZoneEnvironmentSummary,
} from '../types/agri';
import { sceneXZToLngLat } from './geoProjection';
import { getStructureClearanceY } from './spatialClearance';

export const DEVICE_CATEGORIES: DeviceCategoryMeta[] = [
  { key: 'camera', label: '摄像头', fullLabel: '田间苗情视频监测设备', colorHex: '#0ea5e9' },
  { key: 'weather', label: '气象站', fullLabel: '田间一体化监测站', colorHex: '#06b6d4' },
  { key: 'soil', label: '土壤墒情', fullLabel: '无线土壤传感器', colorHex: '#a855f7' },
  { key: 'water_valve', label: '水阀', fullLabel: '电动球阀', colorHex: '#10b981' },
  { key: 'butterfly_valve', label: '蝶阀', fullLabel: '渠道智能蝶阀', colorHex: '#14b8a6' },
  { key: 'pest_lamp', label: '杀虫灯', fullLabel: '远程虫情测报与杀虫灯', colorHex: '#f59e0b' },
  { key: 'led_screen', label: 'LED屏', fullLabel: '田间信息发布终端', colorHex: '#ef4444' },
  { key: 'gateway', label: '网关', fullLabel: '物联网边缘网关', colorHex: '#64748b' },
  { key: 'controller', label: '控制器', fullLabel: '水肥一体机', colorHex: '#8b5cf6' },
  { key: 'base_station', label: '基站', fullLabel: '北斗RTK差分基站', colorHex: '#3b82f6' },
  { key: 'greenhouse', label: '温室监测', fullLabel: '恒温育苗与番茄环控终端', colorHex: '#22c55e' },
  { key: 'multispectral', label: '多光谱', fullLabel: '冠层多光谱监测仪', colorHex: '#6366f1' },
];

export const SIM_CROP_LIST: ReadonlyArray<{
  key: SimCropKey;
  label: string;
  totalDays: number;
  unitPricePerKg: number;
  stagePresetDays: readonly [number, number, number, number, number, number];
  stageShortLabels: readonly [string, string, string, string, string, string];
}> = [
  {
    key: 'rice',
    label: '水稻',
    totalDays: 135,
    unitPricePerKg: 3.45,
    stagePresetDays: [3, 16, 46, 80, 106, 128],
    stageShortLabels: ['种子期', '出苗期', '分蘖期', '抽穗期', '灌浆期', '成熟期'],
  },
  {
    key: 'corn',
    label: '玉米',
    totalDays: 115,
    unitPricePerKg: 2.68,
    stagePresetDays: [3, 14, 38, 66, 88, 108],
    stageShortLabels: ['种子期', '出苗期', '拔节期', '抽雄期', '结棒期', '成熟期'],
  },
  {
    key: 'tomato',
    label: '番茄',
    totalDays: 100,
    unitPricePerKg: 4.85,
    stagePresetDays: [2, 14, 34, 55, 74, 92],
    stageShortLabels: ['种子期', '幼苗期', '蔓生期', '盛花期', '绿熟期', '成熟期'],
  },
  {
    key: 'wheat',
    label: '小麦',
    totalDays: 210,
    unitPricePerKg: 2.64,
    stagePresetDays: [5, 38, 100, 146, 178, 202],
    stageShortLabels: ['种子期', '出苗期', '拔节期', '抽穗期', '灌浆期', '成熟期'],
  },
] as const;

export const INITIAL_GROWTH_PRESETS: ReadonlyArray<{
  key: InitialGrowthPresetKey;
  label: string;
  days: Record<SimCropKey, number>;
}> = [
  {
    key: 'mixed_season',
    label: '真实农时多季态',
    days: { rice: 106, corn: 88, tomato: 90, wheat: 198 },
  },
  {
    key: 'all_seed',
    label: '全品种种子播栽期',
    days: { rice: 2, corn: 2, tomato: 2, wheat: 4 },
  },
  {
    key: 'all_sprout',
    label: '全品种破土出苗期',
    days: { rice: 16, corn: 14, tomato: 14, wheat: 36 },
  },
  {
    key: 'all_vegetative',
    label: '全品种营养拔节期',
    days: { rice: 48, corn: 40, tomato: 35, wheat: 105 },
  },
  {
    key: 'all_flowering',
    label: '全品种抽穗盛花期',
    days: { rice: 80, corn: 66, tomato: 55, wheat: 148 },
  },
  {
    key: 'all_mature',
    label: '全品种丰收成熟期',
    days: { rice: 130, corn: 110, tomato: 95, wheat: 204 },
  },
];

// Core demonstration plots strictly projected inside the user's Wuhu Dongba WGS84 polygon (Total = 626 Mu)
export const INITIAL_PLOTS: AgriPlot[] = [
  {
    id: 'plot-n1',
    name: '北片一号稻麦轮作田',
    code: 'DB-N01',
    zoneId: 'north',
    zoneLabel: '北区轮作示范片',
    areaMu: 92,
    cropType: 'wheat',
    varietyName: '皖麦38号',
    centerX: -46,
    centerZ: -28,
    width: 46,
    depth: 18,
    baseSoilMoisture: 61.5,
    baseSoilTemp: 15.8,
    irrigationActive: false,
    soilPh: 6.7,
    nitrogenMgKg: 138,
  },
  {
    id: 'plot-n2',
    name: '北片二号数字玉米田',
    code: 'DB-N02',
    zoneId: 'north',
    zoneLabel: '北区轮作示范片',
    areaMu: 84,
    cropType: 'corn',
    varietyName: '郑单958高产玉米',
    centerX: 10,
    centerZ: -28,
    width: 44,
    depth: 18,
    baseSoilMoisture: 64.2,
    baseSoilTemp: 16.6,
    irrigationActive: false,
    soilPh: 6.6,
    nitrogenMgKg: 152,
  },
  {
    id: 'plot-c1',
    name: '东八一号高标准贡米田',
    code: 'DB-C01',
    zoneId: 'central',
    zoneLabel: '中区核心贡米片',
    areaMu: 112,
    cropType: 'rice',
    varietyName: '芜湖贡米·皖稻153',
    centerX: -46,
    centerZ: -1,
    width: 46,
    depth: 22,
    baseSoilMoisture: 78.4,
    baseSoilTemp: 17.6,
    irrigationActive: true,
    soilPh: 6.4,
    nitrogenMgKg: 162,
  },
  {
    id: 'plot-c2',
    name: '东八二号智慧水肥稻田',
    code: 'DB-C02',
    zoneId: 'central',
    zoneLabel: '中区核心贡米片',
    areaMu: 86,
    cropType: 'rice',
    varietyName: '徽两优丝苗',
    centerX: 9,
    centerZ: -1,
    width: 42,
    depth: 22,
    baseSoilMoisture: 74.1,
    baseSoilTemp: 17.9,
    irrigationActive: false,
    soilPh: 6.5,
    nitrogenMgKg: 158,
  },
  {
    id: 'plot-s1',
    name: '东八三号鲜食玉米示范田',
    code: 'DB-S01',
    zoneId: 'south',
    zoneLabel: '南区果蔬杂粮片',
    areaMu: 94,
    cropType: 'corn',
    varietyName: '皖糯玉米2000',
    centerX: -46,
    centerZ: 26,
    width: 46,
    depth: 18,
    baseSoilMoisture: 68.8,
    baseSoilTemp: 18.4,
    irrigationActive: false,
    soilPh: 6.5,
    nitrogenMgKg: 156,
  },
  {
    id: 'plot-s2',
    name: '东八四号精品番茄种植园',
    code: 'DB-S02',
    zoneId: 'south',
    zoneLabel: '南区果蔬杂粮片',
    areaMu: 78,
    cropType: 'tomato',
    varietyName: '皖粉番茄8号',
    centerX: 6,
    centerZ: 26,
    width: 36,
    depth: 18,
    baseSoilMoisture: 72.5,
    baseSoilTemp: 19.8,
    irrigationActive: true,
    soilPh: 6.3,
    nitrogenMgKg: 174,
  },
  {
    id: 'plot-gh',
    name: '南片智能番茄与育苗温室群',
    code: 'DB-GH01',
    zoneId: 'south',
    zoneLabel: '南区果蔬杂粮片',
    areaMu: 45,
    cropType: 'tomato',
    varietyName: '串收红果樱桃番茄',
    centerX: 41,
    centerZ: 26,
    width: 22,
    depth: 18,
    baseSoilMoisture: 80.5,
    baseSoilTemp: 22.6,
    irrigationActive: true,
    soilPh: 6.2,
    nitrogenMgKg: 182,
  },
  {
    id: 'plot-op',
    name: '东片沿江泵站与烘干中心',
    code: 'DB-OP01',
    zoneId: 'east',
    zoneLabel: '东区沿江灌排片',
    areaMu: 35,
    cropType: 'facility',
    varietyName: '低温循环谷物烘干与泵站',
    centerX: 45,
    centerZ: -1,
    width: 18,
    depth: 22,
    baseSoilMoisture: 68.0,
    baseSoilTemp: 17.0,
    irrigationActive: false,
    soilPh: 6.9,
    nitrogenMgKg: 120,
  },
];

// 20 IoT stations positioned on dedicated roadside berms strictly outside plots, canals, roads, and buildings
export const INITIAL_IOT_DEVICES: IoTDeviceNode[] = [
  {
    id: 'dev-01',
    name: '北片1号高清球机',
    category: 'camera',
    plotId: 'plot-n1',
    x: -56,
    z: -16.35,
    status: 'online',
    batteryPct: 98,
    signalDbm: -64,
    lastUpdated: '17:27:40',
    readingLabel: '苗情覆盖度',
    readingValue: '89.2%',
  },
  {
    id: 'dev-02',
    name: '北片太阳能杀虫灯',
    category: 'pest_lamp',
    plotId: 'plot-n2',
    x: 10,
    z: -16.35,
    status: 'online',
    batteryPct: 91,
    signalDbm: -68,
    lastUpdated: '17:27:35',
    readingLabel: '今日诱捕计数',
    readingValue: '42 头',
  },
  {
    id: 'dev-03',
    name: '中渠1号电动球阀',
    category: 'water_valve',
    plotId: 'plot-c1',
    x: -58,
    z: -12.85,
    status: 'online',
    batteryPct: 95,
    signalDbm: -61,
    lastUpdated: '17:27:50',
    readingLabel: '瞬时流量',
    readingValue: '46.8 m³/h',
  },
  {
    id: 'dev-04',
    name: '中渠2号智能蝶阀',
    category: 'butterfly_valve',
    plotId: 'plot-c1',
    x: -42,
    z: -12.85,
    status: 'online',
    batteryPct: 93,
    signalDbm: -65,
    lastUpdated: '17:27:48',
    readingLabel: '阀门开度',
    readingValue: '75%',
  },
  {
    id: 'dev-05',
    name: '东八主气象监测站',
    category: 'weather',
    plotId: 'plot-c1',
    x: -26,
    z: -12.85,
    status: 'online',
    batteryPct: 100,
    signalDbm: -55,
    lastUpdated: '17:27:55',
    readingLabel: '实时风速/气温',
    readingValue: '2.4m/s · 19.6°C',
  },
  {
    id: 'dev-06',
    name: '核心田1号土壤墒情仪',
    category: 'soil',
    plotId: 'plot-c1',
    x: -20.6,
    z: -4.0,
    status: 'online',
    batteryPct: 87,
    signalDbm: -70,
    lastUpdated: '17:27:42',
    readingLabel: '20cm含水率',
    readingValue: '78.4%',
  },
  {
    id: 'dev-07',
    name: '核心田多光谱冠层仪',
    category: 'multispectral',
    plotId: 'plot-c2',
    x: 2,
    z: -12.85,
    status: 'online',
    batteryPct: 94,
    signalDbm: -62,
    lastUpdated: '17:27:51',
    readingLabel: '冠层NDVI指数',
    readingValue: '0.84',
  },
  {
    id: 'dev-08',
    name: '东八水肥一体机主机',
    category: 'controller',
    plotId: 'plot-c2',
    x: 20,
    z: -12.85,
    status: 'warning',
    batteryPct: 100,
    signalDbm: -59,
    lastUpdated: '17:26:12',
    readingLabel: '管网水泵压力',
    readingValue: '0.49 MPa (偏高)',
  },
  {
    id: 'dev-09',
    name: '东片北斗RTK差分基站',
    category: 'base_station',
    plotId: 'plot-op',
    x: 33.0,
    z: -9.0,
    status: 'online',
    batteryPct: 100,
    signalDbm: -48,
    lastUpdated: '17:27:55',
    readingLabel: '定位精度',
    readingValue: '±1.2 cm',
  },
  {
    id: 'dev-10',
    name: '东片田间LED信息大屏',
    category: 'led_screen',
    plotId: 'plot-op',
    x: 33.0,
    z: 7.5,
    status: 'online',
    batteryPct: 100,
    signalDbm: -53,
    lastUpdated: '17:27:50',
    readingLabel: '播报状态',
    readingValue: '实时墒情轮播中',
  },
  {
    id: 'dev-11',
    name: '中南路1号苗情鹰眼',
    category: 'camera',
    plotId: 'plot-c1',
    x: -36,
    z: 10.85,
    status: 'online',
    batteryPct: 92,
    signalDbm: -66,
    lastUpdated: '17:27:39',
    readingLabel: '视频流状态',
    readingValue: '1080P 正常',
  },
  {
    id: 'dev-12',
    name: '中南路LoRa边缘网关',
    category: 'gateway',
    plotId: 'plot-c2',
    x: -14.4,
    z: 4.0,
    status: 'online',
    batteryPct: 99,
    signalDbm: -54,
    lastUpdated: '17:27:54',
    readingLabel: '下挂节点数',
    readingValue: '19 在线',
  },
  {
    id: 'dev-13',
    name: '试验田2号无线土壤传感器',
    category: 'soil',
    plotId: 'plot-c2',
    x: 4,
    z: 10.85,
    status: 'warning',
    batteryPct: 14,
    signalDbm: -79,
    lastUpdated: '17:24:18',
    readingLabel: '电池电压预警',
    readingValue: '电量 14% · 墒情 74.1%',
  },
  {
    id: 'dev-14',
    name: '中南路微气象监测仪',
    category: 'weather',
    plotId: 'plot-c2',
    x: 20,
    z: 10.85,
    status: 'online',
    batteryPct: 96,
    signalDbm: -63,
    lastUpdated: '17:27:47',
    readingLabel: '光合有效辐射',
    readingValue: '640 μmol/m²·s',
  },
  {
    id: 'dev-15',
    name: '南片1号电动排水阀',
    category: 'water_valve',
    plotId: 'plot-s1',
    x: -54,
    z: 36.25,
    status: 'online',
    batteryPct: 90,
    signalDbm: -69,
    lastUpdated: '17:27:33',
    readingLabel: '滴灌管网水压',
    readingValue: '0.28 MPa',
  },
  {
    id: 'dev-16',
    name: '南片远程虫情测报仪',
    category: 'pest_lamp',
    plotId: 'plot-s1',
    x: -34,
    z: 36.25,
    status: 'offline',
    batteryPct: 0,
    signalDbm: -110,
    lastUpdated: '16:40:57',
    readingLabel: '链路心跳超时',
    readingValue: '离线待检修',
  },
  {
    id: 'dev-17',
    name: '示范田3号土壤温湿度计',
    category: 'soil',
    plotId: 'plot-s1',
    x: -20.6,
    z: 26.0,
    status: 'online',
    batteryPct: 88,
    signalDbm: -67,
    lastUpdated: '17:27:45',
    readingLabel: '土壤温湿度',
    readingValue: '18.4°C · 68.8%',
  },
  {
    id: 'dev-18',
    name: '番茄园智能滴灌水阀',
    category: 'water_valve',
    plotId: 'plot-s2',
    x: 4,
    z: 36.25,
    status: 'online',
    batteryPct: 95,
    signalDbm: -64,
    lastUpdated: '17:27:49',
    readingLabel: '滴灌状态',
    readingValue: '精准水肥供给中',
  },
  {
    id: 'dev-19',
    name: '番茄园冠层多光谱站',
    category: 'multispectral',
    plotId: 'plot-s2',
    x: 18,
    z: 36.25,
    status: 'online',
    batteryPct: 91,
    signalDbm: -65,
    lastUpdated: '17:27:44',
    readingLabel: '叶绿素SPAD',
    readingValue: '43.8',
  },
  {
    id: 'dev-20',
    name: '南片温室群环控主机',
    category: 'greenhouse',
    plotId: 'plot-gh',
    x: 27.0,
    z: 26.0,
    status: 'online',
    batteryPct: 100,
    signalDbm: -51,
    lastUpdated: '17:27:55',
    readingLabel: '棚内恒温恒湿',
    readingValue: '24.5°C · 81%',
  },
];

export const INITIAL_ALERTS: DeviceAlertItem[] = [
  {
    id: 'alt-1',
    deviceId: 'dev-08',
    plotId: 'plot-c2',
    timestamp: '2026-11-18 16:42:15',
    title: '水泵压力异常：东八水肥一体机管网压力偏高',
    severity: 'high',
    resolved: false,
  },
  {
    id: 'alt-2',
    deviceId: 'dev-13',
    plotId: 'plot-c2',
    timestamp: '2026-11-18 17:05:32',
    title: '电池电量低：试验田2号无线土壤传感器 (14%)',
    severity: 'medium',
    resolved: false,
  },
  {
    id: 'alt-3',
    deviceId: 'dev-16',
    plotId: 'plot-s1',
    timestamp: '2026-11-18 17:18:40',
    title: '设备离线：南片远程虫情测报仪通信中断',
    severity: 'high',
    resolved: false,
  },
];

export const VILLAGE_PRESETS: Record<string, VillageWeatherSnapshot> = {
  dongba: {
    villageId: 'dongba',
    villageName: '东八村核心片',
    weatherCondition: '多云间晴',
    airTempC: 19.6,
    airHumidityPct: 68,
    soilTempC: 17.8,
    soilMoisturePct: 74.2,
    co2Ppm: 418,
    pressureKpa: 101.6,
    windSpeedMs: 2.4,
    windDirectionDeg: 115,
    windDirectionLabel: '东南风',
    rainfallMm: 0.0,
    pm25: 24,
  },
  wanzhi: {
    villageId: 'wanzhi',
    villageName: '湾沚沿江灌片',
    weatherCondition: '晴朗微风',
    airTempC: 20.3,
    airHumidityPct: 64,
    soilTempC: 18.2,
    soilMoisturePct: 71.5,
    co2Ppm: 412,
    pressureKpa: 101.5,
    windSpeedMs: 1.9,
    windDirectionDeg: 95,
    windDirectionLabel: '东风',
    rainfallMm: 0.0,
    pm25: 21,
  },
  hongyang: {
    villageId: 'hongyang',
    villageName: '红杨果蔬温室片',
    weatherCondition: '局部轻雾',
    airTempC: 18.8,
    airHumidityPct: 75,
    soilTempC: 17.3,
    soilMoisturePct: 78.6,
    co2Ppm: 426,
    pressureKpa: 101.8,
    windSpeedMs: 3.1,
    windDirectionDeg: 135,
    windDirectionLabel: '东南风',
    rainfallMm: 0.4,
    pm25: 19,
  },
};

export const MARKET_QUOTES: MarketQuoteItem[] = [
  {
    name: '芜湖虾稻贡米 (特级)',
    spec: 'GB/T 1354 晚籼新米',
    pricePerJin: 4.85,
    weeklyDeltaPct: 3.2,
    origin: '湾沚东八核心产区',
  },
  {
    name: '皖糯鲜食甜糯玉米',
    spec: '单穗≥280g · 一级鲜穗',
    pricePerJin: 2.15,
    weeklyDeltaPct: 2.6,
    origin: '东八南片示范园',
  },
  {
    name: '串收精品樱桃番茄',
    spec: '糖度≥8.5% · 冷链直供',
    pricePerJin: 3.95,
    weeklyDeltaPct: 4.1,
    origin: '东八智能温室群',
  },
  {
    name: '皖南弱筋优质冬小麦',
    spec: '容重≥790g/L',
    pricePerJin: 1.32,
    weeklyDeltaPct: 0.6,
    origin: '东八北片轮作区',
  },
];

interface StageSpec {
  name: string;
  startDay: number;
  endDay: number;
  note: string;
}

const CROP_STAGE_TABLES: Record<SimCropKey, StageSpec[]> = {
  rice: [
    { name: '种子期', startDay: 0, endDay: 8, note: '催芽播栽入泥，胚根向下扎根' },
    { name: '出苗期', startDay: 8, endDay: 24, note: '翠绿针叶破水而出，三叶一心' },
    { name: '分蘖拔节期', startDay: 24, endDay: 68, note: '有效分蘖扩冠，茎秆快速拔高' },
    { name: '抽穗扬花期', startDay: 68, endDay: 92, note: '剑叶封行，嫩绿稻穗挺拔抽出' },
    { name: '灌浆乳熟期', startDay: 92, endDay: 118, note: '籽粒充实增重，穗头渐次弯曲' },
    { name: '成熟收获期', startDay: 118, endDay: 135, note: '金黄稻穗低垂饱满，适期机收' },
  ],
  corn: [
    { name: '种子期', startDay: 0, endDay: 7, note: '精量穴播覆土，种胚吸水萌动' },
    { name: '出苗期', startDay: 7, endDay: 20, note: '锥形嫩芽破土，初生宽叶舒展' },
    { name: '拔节喇叭口期', startDay: 20, endDay: 56, note: '粗壮茎秆拔高，宽大披针叶交错' },
    { name: '抽雄吐丝期', startDay: 56, endDay: 76, note: '顶端雄穗开花散粉，中部雌穗吐丝' },
    { name: '乳熟结棒期', startDay: 76, endDay: 98, note: '果穗迅速膨大充实，苞叶紧裹青穗' },
    { name: '成熟收获期', startDay: 98, endDay: 115, note: '黄金玉米棒硕大饱满，籽粒硬化成熟' },
  ],
  tomato: [
    { name: '种子期', startDay: 0, endDay: 6, note: '基质穴盘点播，温湿催芽破壳' },
    { name: '幼苗期', startDay: 6, endDay: 22, note: '子叶平展，锯齿羽状真叶萌生' },
    { name: '蔓生上架期', startDay: 22, endDay: 46, note: '主蔓攀附立架，侧枝叶片繁茂' },
    { name: '盛花坐果期', startDay: 46, endDay: 64, note: '金黄色聚伞花序盛开，幼果初坐' },
    { name: '绿熟膨果期', startDay: 64, endDay: 83, note: '成串青果迅速膨大，果肩泛粉转色' },
    { name: '成熟采收期', startDay: 83, endDay: 100, note: '鲜红圆润番茄成串垂挂，糖酸比达峰' },
  ],
  wheat: [
    { name: '种子期', startDay: 0, endDay: 12, note: '机械条播覆土，种芽扎根立针' },
    { name: '出苗分蘖期', startDay: 12, endDay: 65, note: '冬前分蘖盘墩，绿茵覆盖垄面' },
    { name: '返青拔节期', startDay: 65, endDay: 130, note: '春暖返青起身，主茎快速拔节' },
    { name: '抽穗扬花期', startDay: 130, endDay: 162, note: '直立麦芒齐穗，扬花授粉结实' },
    { name: '灌浆乳熟期', startDay: 162, endDay: 192, note: '麦粒淀粉积累，茎叶由绿转黄' },
    { name: '成熟收获期', startDay: 192, endDay: 210, note: '金黄麦浪蜡熟完熟，联合收割窗口' },
  ],
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const numA = parseInt(hexA.replace('#', ''), 16);
  const numB = parseInt(hexB.replace('#', ''), 16);
  const rA = (numA >> 16) & 255;
  const gA = (numA >> 8) & 255;
  const bA = numA & 255;
  const rB = (numB >> 16) & 255;
  const gB = (numB >> 8) & 255;
  const bB = numB & 255;
  const r = Math.round(rA + (rB - rA) * clamped);
  const g = Math.round(gA + (gB - gA) * clamped);
  const b = Math.round(bA + (bB - bA) * clamped);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Pure multi-crop agronomic phenology & 3D morphological organ parameter calculator
 * Supports seed-to-maturity simulation across Rice, Corn, Tomato, and Wheat
 */
export function computeCropGrowthMetrics(
  cropType: SimCropKey,
  rawDay: number,
  airTempC = 20,
  soilMoisturePct = 74,
): CropGrowthSnapshot {
  const meta = SIM_CROP_LIST.find((c) => c.key === cropType)!;
  const totalDays = meta.totalDays;
  const day = Math.max(0, Math.min(totalDays, Math.round(rawDay)));
  const progress = day / totalDays;
  const progressPct = Math.round(progress * 100);
  const stages = CROP_STAGE_TABLES[cropType];

  let stageIndex = stages.length - 1;
  for (let i = 0; i < stages.length; i++) {
    if (day < stages[i].endDay || i === stages.length - 1) {
      stageIndex = i;
      break;
    }
  }
  const activeStage = stages[stageIndex];
  const daysToNextStage =
    stageIndex === stages.length - 1 ? 0 : Math.max(0, activeStage.endDay - day);

  // Species-specific maximum plant heights (cm) and yield potentials (kg/Mu)
  const speciesParams: Record<
    SimCropKey,
    {
      minH: number;
      maxH: number;
      laiPeak: number;
      optTemp: number;
      optMoist: number;
      baseYieldKg: number;
    }
  > = {
    rice: { minH: 1.5, maxH: 112, laiPeak: 6.8, optTemp: 23, optMoist: 76, baseYieldKg: 672 },
    corn: { minH: 2.0, maxH: 236, laiPeak: 5.4, optTemp: 25, optMoist: 68, baseYieldKg: 845 },
    tomato: { minH: 1.8, maxH: 154, laiPeak: 4.9, optTemp: 24, optMoist: 74, baseYieldKg: 4280 },
    wheat: { minH: 1.5, maxH: 88, laiPeak: 5.6, optTemp: 17, optMoist: 62, baseYieldKg: 498 },
  };
  const sp = speciesParams[cropType];

  // Seed phase keeps height near soil surface, followed by logistic vegetative elongation
  const seedCutoff = stages[0].endDay / totalDays;
  const logisticRaw =
    progress <= seedCutoff
      ? (progress / Math.max(0.01, seedCutoff)) * 0.03
      : 1 / (1 + Math.exp(-9.2 * (progress - 0.36)));

  const plantHeightCm = Number((sp.minH + (sp.maxH - sp.minH) * logisticRaw).toFixed(1));

  const laiCurve =
    progress <= seedCutoff
      ? 0.05
      : progress < 0.68
        ? Math.sin(((progress - seedCutoff) / (0.68 - seedCutoff)) * (Math.PI / 2))
        : 1 - (progress - 0.68) * 0.52;
  const leafAreaIndex = Number(Math.max(0.12, sp.laiPeak * laiCurve).toFixed(2));
  const canopyCoverPct = Math.round(Math.min(96, Math.max(4, 4 + logisticRaw * 91)));

  const panicleDroop =
    progress < 0.56 ? 0 : Number(Math.min(1, (progress - 0.56) / 0.38).toFixed(2));

  const chlorophyllSpad =
    progress <= seedCutoff
      ? 12.0
      : progress < 0.65
        ? Number(lerp(28, 46.2, (progress - seedCutoff) / (0.65 - seedCutoff)).toFixed(1))
        : Number(
            lerp(46.2, cropType === 'tomato' ? 38.5 : 22.4, (progress - 0.65) / 0.35).toFixed(1),
          );

  // Environmental comfort & phenological maturity factor for yield projection
  const tempPenalty = Math.min(0.16, Math.abs(airTempC - sp.optTemp) * 0.008);
  const moisturePenalty = Math.min(0.18, Math.abs(soilMoisturePct - sp.optMoist) * 0.006);
  const vigorBonus = 0.94 + Math.min(0.08, progress * 0.08);
  const estimatedYieldKgPerMu = Math.round(
    sp.baseYieldKg * vigorBonus * (1 - tempPenalty - moisturePenalty),
  );

  // 3D Morphological Organ Scales (0..1+)
  const seedMoundScale =
    stageIndex === 0
      ? 1.0
      : stageIndex === 1
        ? Number(lerp(0.85, 0.25, (day - stages[1].startDay) / (stages[1].endDay - stages[1].startDay)).toFixed(3))
        : 0.0;

  const stalkScaleY =
    stageIndex === 0
      ? 0.035
      : Number((0.14 + logisticRaw * (cropType === 'corn' ? 1.48 : cropType === 'tomato' ? 1.15 : 0.98)).toFixed(3));

  const canopyDensityScale =
    stageIndex === 0
      ? 0.05
      : Number((0.24 + Math.min(1, progress * 1.42) * (cropType === 'tomato' ? 0.92 : 0.78)).toFixed(3));

  // Reproductive organs (panicles, corn tassels/ears, tomato blossoms/fruit trusses) emerge at stage 3+
  const reproStart = stages[3].startDay / totalDays;
  const reproductiveScale =
    progress < reproStart * 0.92
      ? 0
      : Number(Math.min(1.08, ((progress - reproStart * 0.92) / (1 - reproStart * 0.92)) * 1.12).toFixed(3));

  // Species-authentic foliage & fruit/ear color transitions
  let colorHex = '#4ade80';
  let organColorHex = '#fde047';

  if (stageIndex === 0) {
    colorHex = '#8b6d45'; // Earthy seedbed / germinating hull
    organColorHex = '#a18057';
  } else if (cropType === 'tomato') {
    // Tomato vines stay lush deep green while reproductive organs shift Yellow Flower -> Jade Green Fruit -> Crimson Red Tomato
    colorHex =
      progress < 0.3
        ? lerpHexColor('#84cc16', '#16a34a', progress / 0.3)
        : lerpHexColor('#16a34a', '#166534', (progress - 0.3) / 0.7);
    if (stageIndex <= 3) {
      organColorHex = '#facc15'; // Bright yellow tomato flowers
    } else if (stageIndex === 4) {
      const subT = (day - stages[4].startDay) / Math.max(1, stages[4].endDay - stages[4].startDay);
      organColorHex = lerpHexColor('#86efac', '#fb923c', subT); // Green fruit turning orange-blush
    } else {
      const subT = (day - stages[5].startDay) / Math.max(1, stages[5].endDay - stages[5].startDay);
      organColorHex = lerpHexColor('#f97316', '#dc2626', subT); // Ripe crimson-red tomatoes
    }
  } else if (cropType === 'corn') {
    if (progress < 0.38) {
      colorHex = lerpHexColor('#84cc16', '#15803d', progress / 0.38);
    } else if (progress < 0.78) {
      colorHex = lerpHexColor('#15803d', '#166534', (progress - 0.38) / 0.4);
    } else {
      colorHex = lerpHexColor('#166534', '#9ca93b', (progress - 0.78) / 0.22);
    }
    organColorHex =
      stageIndex <= 3
        ? '#fde047'
        : stageIndex === 4
          ? lerpHexColor('#bef264', '#fbbf24', 0.65)
          : '#f59e0b';
  } else {
    // Rice & Wheat: lime sprout -> emerald tillering -> warm golden harvest
    if (progress < 0.35) {
      colorHex = lerpHexColor('#84cc16', '#228b42', progress / 0.35);
    } else if (progress < 0.68) {
      colorHex = lerpHexColor('#228b42', '#1d7838', (progress - 0.35) / 0.33);
    } else if (progress < 0.86) {
      colorHex = lerpHexColor('#1d7838', '#c2a130', (progress - 0.68) / 0.18);
    } else {
      colorHex = lerpHexColor('#c2a130', '#eab308', (progress - 0.86) / 0.14);
    }
    organColorHex =
      stageIndex <= 3
        ? '#bef264'
        : stageIndex === 4
          ? '#eab308'
          : cropType === 'wheat'
            ? '#d97706'
            : '#facc15';
  }

  return {
    cropType,
    cropLabel: meta.label,
    day,
    totalDays,
    progressPct,
    stageIndex,
    stageName: activeStage.name,
    morphologyNote: activeStage.note,
    daysToNextStage,
    plantHeightCm,
    leafAreaIndex,
    canopyCoverPct,
    panicleDroop,
    chlorophyllSpad,
    estimatedYieldKgPerMu,
    seedMoundScale,
    stalkScaleY,
    canopyDensityScale,
    reproductiveScale,
    colorHex,
    organColorHex,
  };
}

/**
 * Computes all 4 crop growth snapshots simultaneously
 */
export function computeAllCropGrowth(
  cropDays: Record<SimCropKey, number>,
  airTempC = 20,
  soilMoisturePct = 74,
): CropGrowthMap {
  return {
    rice: computeCropGrowthMetrics('rice', cropDays.rice, airTempC, soilMoisturePct),
    corn: computeCropGrowthMetrics('corn', cropDays.corn, airTempC, soilMoisturePct),
    tomato: computeCropGrowthMetrics('tomato', cropDays.tomato, airTempC, soilMoisturePct),
    wheat: computeCropGrowthMetrics('wheat', cropDays.wheat, airTempC, soilMoisturePct),
  };
}

/**
 * Aggregates multi-zone microclimate, irrigation, and multi-crop yield forecast for the Integrated Chinese Dashboard
 */
export function computeDashboardSummary(
  plots: AgriPlot[],
  growthMap: CropGrowthMap,
  weather: VillageWeatherSnapshot,
  refreshedAtLabel: string,
): DashboardAggregateReport {
  const zoneOrder: Array<{ id: AgriZoneId; label: string; tempOffset: number; humOffset: number }> = [
    { id: 'north', label: '北区轮作示范片', tempOffset: -0.4, humOffset: -2 },
    { id: 'central', label: '中区核心贡米片', tempOffset: 0.0, humOffset: 2 },
    { id: 'south', label: '南区果蔬温室片', tempOffset: 1.1, humOffset: 4 },
    { id: 'east', label: '东区沿江灌排片', tempOffset: -0.6, humOffset: 5 },
  ];

  const zones: ZoneEnvironmentSummary[] = zoneOrder.map((z) => {
    const subset = plots.filter((p) => p.zoneId === z.id);
    const count = Math.max(1, subset.length);
    const areaMu = subset.reduce((s, p) => s + p.areaMu, 0);
    const avgSoilTempC = Number(
      (subset.reduce((s, p) => s + p.baseSoilTemp, 0) / count).toFixed(1),
    );
    const avgSoilMoisturePct = Number(
      (subset.reduce((s, p) => s + p.baseSoilMoisture, 0) / count).toFixed(1),
    );
    const irrigatingPlots = subset.filter((p) => p.irrigationActive).length;

    return {
      zoneId: z.id,
      zoneLabel: z.label,
      plotCount: subset.length,
      areaMu,
      avgAirTempC: Number((weather.airTempC + z.tempOffset).toFixed(1)),
      avgAirHumidityPct: Math.max(38, Math.min(96, Math.round(weather.airHumidityPct + z.humOffset))),
      avgSoilTempC,
      avgSoilMoisturePct,
      irrigatingPlots,
    };
  });

  const yieldRows: CropYieldForecastRow[] = SIM_CROP_LIST.map((meta) => {
    const snap = growthMap[meta.key];
    const plantedAreaMu = plots
      .filter((p) => p.cropType === meta.key)
      .reduce((s, p) => s + p.areaMu, 0);
    const totalTons = Number(((plantedAreaMu * snap.estimatedYieldKgPerMu) / 1000).toFixed(1));
    const estimatedRevenueWanYuan = Number(
      ((totalTons * 1000 * meta.unitPricePerKg) / 10000).toFixed(2),
    );
    return {
      cropType: meta.key,
      cropLabel: meta.label,
      plantedAreaMu,
      stageName: snap.stageName,
      progressPct: snap.progressPct,
      yieldKgPerMu: snap.estimatedYieldKgPerMu,
      totalTons,
      unitPricePerKg: meta.unitPricePerKg,
      estimatedRevenueWanYuan,
    };
  });

  const totalPlantedMu = yieldRows.reduce((s, r) => s + r.plantedAreaMu, 0);
  const totalFacilityMu = plots
    .filter((p) => p.cropType === 'facility')
    .reduce((s, p) => s + p.areaMu, 0);

  const weightedProgress =
    totalPlantedMu > 0
      ? Math.round(
          yieldRows.reduce((s, r) => s + r.progressPct * r.plantedAreaMu, 0) / totalPlantedMu,
        )
      : 0;

  const totalPredictedTons = Number(
    yieldRows.reduce((s, r) => s + r.totalTons, 0).toFixed(1),
  );
  const totalPredictedRevenueWanYuan = Number(
    yieldRows.reduce((s, r) => s + r.estimatedRevenueWanYuan, 0).toFixed(2),
  );

  const activeIrrigationCount = plots.filter(
    (p) => p.irrigationActive && p.cropType !== 'facility',
  ).length;
  const totalFlowM3PerHour = Number((activeIrrigationCount * 44.6).toFixed(1));

  return {
    refreshedAtLabel,
    totalPlantedMu,
    totalFacilityMu,
    overallGrowthProgressPct: weightedProgress,
    totalPredictedTons,
    totalPredictedRevenueWanYuan,
    activeIrrigationCount,
    totalFlowM3PerHour,
    zones,
    yieldRows,
  };
}

/**
 * Generates deterministic 24-hour diurnal microclimate telemetry series
 */
export function generateHourlyTelemetry(village: VillageWeatherSnapshot): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  for (let h = 0; h < 24; h += 2) {
    const hourStr = `${String(h).padStart(2, '0')}:00`;
    const phase = ((h - 5) / 24) * Math.PI * 2;
    const diurnalWave = -Math.cos(phase);
    const airTempC = Number((village.airTempC - 1.4 + diurnalWave * 4.6).toFixed(1));
    const airHumidityPct = Math.round(
      Math.max(42, Math.min(94, village.airHumidityPct + 4 - diurnalWave * 14)),
    );
    const soilTempC = Number((village.soilTempC - 0.6 + diurnalWave * 2.1).toFixed(1));
    const soilMoisturePct = Number(
      Math.max(45, Math.min(92, village.soilMoisturePct - diurnalWave * 2.2)).toFixed(1),
    );
    const daylight = h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) : 0;
    const lightLux = Math.round(daylight * 48500);

    points.push({
      hourLabel: hourStr,
      airTempC,
      airHumidityPct,
      soilTempC,
      soilMoisturePct,
      lightLux,
    });
  }
  return points;
}

export interface CategoryHealthRow {
  category: DeviceCategoryKey;
  fullLabel: string;
  online: number;
  warning: number;
  offline: number;
  total: number;
}

export interface DeviceHealthSummary {
  totalCount: number;
  onlineCount: number;
  warningCount: number;
  offlineCount: number;
  onlineRatePct: number;
  rows: CategoryHealthRow[];
}

export function computeDeviceHealthSummary(devices: IoTDeviceNode[]): DeviceHealthSummary {
  const totalCount = devices.length;
  let onlineCount = 0;
  let warningCount = 0;
  let offlineCount = 0;

  for (const d of devices) {
    if (d.status === 'online') onlineCount++;
    else if (d.status === 'warning') warningCount++;
    else offlineCount++;
  }

  const onlineRatePct = totalCount === 0 ? 0 : Math.round((onlineCount / totalCount) * 100);

  const featuredCategories: DeviceCategoryKey[] = [
    'controller',
    'soil',
    'weather',
    'water_valve',
    'camera',
    'pest_lamp',
  ];

  const rows: CategoryHealthRow[] = featuredCategories.map((catKey) => {
    const meta = DEVICE_CATEGORIES.find((m) => m.key === catKey)!;
    const subset = devices.filter((d) => d.category === catKey);
    return {
      category: catKey,
      fullLabel: meta.fullLabel,
      online: subset.filter((d) => d.status === 'online').length,
      warning: subset.filter((d) => d.status === 'warning').length,
      offline: subset.filter((d) => d.status === 'offline').length,
      total: subset.length,
    };
  });

  return {
    totalCount,
    onlineCount,
    warningCount,
    offlineCount,
    onlineRatePct,
    rows,
  };
}

export function repairDeviceAndAlerts(
  devices: IoTDeviceNode[],
  alerts: DeviceAlertItem[],
  deviceId: string,
): { devices: IoTDeviceNode[]; alerts: DeviceAlertItem[] } {
  const nextDevices = devices.map((d) => {
    if (d.id !== deviceId) return d;
    return {
      ...d,
      status: 'online' as const,
      batteryPct: Math.max(d.batteryPct, 96),
      signalDbm: Math.max(d.signalDbm, -62),
      readingValue:
        d.category === 'controller'
          ? '0.32 MPa (正常)'
          : d.category === 'soil'
            ? '电量 96% · 墒情 74.1%'
            : '在线巡检正常',
    };
  });

  const nextAlerts = alerts.map((a) =>
    a.deviceId === deviceId ? { ...a, resolved: true } : a,
  );

  return { devices: nextDevices, alerts: nextAlerts };
}

export function stepPlotMoisture(plots: AgriPlot[], deltaSec: number): AgriPlot[] {
  return plots.map((plot) => {
    if (plot.cropType === 'facility') return plot;
    const target = plot.irrigationActive
      ? Math.min(89.5, plot.baseSoilMoisture + 0.55 * deltaSec)
      : Math.max(52.0, plot.baseSoilMoisture - 0.04 * deltaSec);
    return {
      ...plot,
      baseSoilMoisture: Number(target.toFixed(1)),
    };
  });
}

export const DRONE_WAYPOINTS: Array<{ x: number; z: number; plotId: string; label: string }> = [
  { x: -46, z: -1, plotId: 'plot-c1', label: '东八一号高标准贡米田' },
  { x: 9, z: -1, plotId: 'plot-c2', label: '东八二号智慧水肥稻田' },
  { x: 41, z: 26, plotId: 'plot-gh', label: '南片智能番茄与育苗温室群' },
  { x: 6, z: 26, plotId: 'plot-s2', label: '东八四号精品番茄种植园' },
  { x: -46, z: 26, plotId: 'plot-s1', label: '东八三号鲜食玉米示范田' },
  { x: -46, z: -28, plotId: 'plot-n1', label: '北片一号稻麦轮作田' },
  { x: 10, z: -28, plotId: 'plot-n2', label: '北片二号数字玉米田' },
];

export function stepDroneKinematics(
  state: DroneTelemetryState,
  dt: number,
  manualInput: { forward: number; right: number; up: number },
  plots: AgriPlot[],
  growthMap: CropGrowthMap,
): DroneTelemetryState {
  const clampedDt = Math.min(0.1, Math.max(0.001, dt));
  let { x, y, z, headingRad, activeWaypointIndex, targetX, targetZ, targetLabel, flightMode } =
    state;
  let speedMs = 0;

  if (flightMode === DroneFlightMode.ManualControl) {
    const moveSpeed = 18;
    const vx = manualInput.right * moveSpeed;
    const vz = -manualInput.forward * moveSpeed;
    const vy = manualInput.up * 8;
    x = Math.max(-70, Math.min(78, x + vx * clampedDt));
    z = Math.max(-44, Math.min(42, z + vz * clampedDt));
    y = Math.max(8, Math.min(38, y + vy * clampedDt));
    speedMs = Number(Math.hypot(vx, vz).toFixed(1));
    if (speedMs > 0.5) {
      headingRad = Math.atan2(vx, vz);
    }
    targetX = x;
    targetZ = z;
    targetLabel = '手动遥控巡航';
  } else {
    if (flightMode === DroneFlightMode.AutoPatrol) {
      const wp = DRONE_WAYPOINTS[activeWaypointIndex % DRONE_WAYPOINTS.length];
      targetX = wp.x;
      targetZ = wp.z;
      targetLabel = wp.label;
    }

    const dx = targetX - x;
    const dz = targetZ - z;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.2) {
      if (flightMode === DroneFlightMode.AutoPatrol) {
        activeWaypointIndex = (activeWaypointIndex + 1) % DRONE_WAYPOINTS.length;
        const nextWp = DRONE_WAYPOINTS[activeWaypointIndex];
        targetX = nextWp.x;
        targetZ = nextWp.z;
        targetLabel = nextWp.label;
      }
      speedMs = 0.6;
    } else {
      const cruiseSpeed = flightMode === DroneFlightMode.TargetInspect ? 16.5 : 11.5;
      const stepDist = Math.min(dist, cruiseSpeed * clampedDt);
      x += (dx / dist) * stepDist;
      z += (dz / dist) * stepDist;
      speedMs = cruiseSpeed;
      const desiredHeading = Math.atan2(dx, dz);
      let diff = desiredHeading - headingRad;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      headingRad += diff * Math.min(1, clampedDt * 5.5);
    }

    const minClearanceAlt = getStructureClearanceY(x, z, 2.8) + 2.8;
    const desiredAlt = Math.max(
      minClearanceAlt,
      flightMode === DroneFlightMode.TargetInspect ? 14.5 : 18.0,
    );
    y += (desiredAlt - y) * Math.min(1, clampedDt * 3.2);
  }

  // Hard anti-interpenetration floor above all ground & 3D structures (silos, RTK tower, greenhouses)
  const hardFloorY = Math.max(8.5, getStructureClearanceY(x, z, 2.8) + 2.6);
  if (y < hardFloorY) {
    y = hardFloorY;
  }

  let closestPlot = plots[0];
  let bestDist = Infinity;
  for (const p of plots) {
    const d = Math.hypot(p.centerX - x, p.centerZ - z);
    if (d < bestDist) {
      bestDist = d;
      closestPlot = p;
    }
  }

  const plotGrowth =
    closestPlot.cropType === 'facility'
      ? null
      : growthMap[closestPlot.cropType];

  const baseNdvi =
    !plotGrowth
      ? 0.34
      : Math.min(0.92, 0.28 + (plotGrowth.leafAreaIndex / 6.8) * 0.58);
  const moistureBonus = (closestPlot.baseSoilMoisture - 65) * 0.0015;
  const ndviIndex = Number(Math.max(0.24, Math.min(0.94, baseNdvi + moistureBonus)).toFixed(2));
  const canopyTempC = Number(
    (closestPlot.baseSoilTemp + 1.4 - (closestPlot.irrigationActive ? 1.1 : 0)).toFixed(1),
  );

  const pestRiskLevel: DroneTelemetryState['pestRiskLevel'] =
    closestPlot.id === 'plot-s1'
      ? '重点防控'
      : closestPlot.baseSoilMoisture > 80
        ? '中度关注'
        : '低风险';

  let batteryPct = state.batteryPct - clampedDt * 0.08;
  if (batteryPct < 24) batteryPct = 98;

  const geoPos = sceneXZToLngLat(x, z);

  return {
    x,
    y,
    z,
    lat: geoPos.lat,
    lng: geoPos.lng,
    headingRad,
    speedMs,
    altitudeM: Number(y.toFixed(1)),
    batteryPct: Number(batteryPct.toFixed(1)),
    flightMode,
    activeWaypointIndex,
    targetX,
    targetZ,
    targetLabel,
    ndviIndex,
    canopyTempC,
    pestRiskLevel,
    scanningPlotId: closestPlot.id,
  };
}
