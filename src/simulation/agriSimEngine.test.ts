import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_ALERTS,
  INITIAL_IOT_DEVICES,
  INITIAL_PLOTS,
  VILLAGE_PRESETS,
  computeAllCropGrowth,
  computeCropGrowthMetrics,
  computeDashboardSummary,
  computeDeviceHealthSummary,
  generateHourlyTelemetry,
  repairDeviceAndAlerts,
  stepDroneKinematics,
  stepPlotMoisture,
} from './agriSimEngine';
import {
  REAL_BOUNDARY_COORDINATES_LNG_LAT,
  computeRealBoundaryArea,
  groundHeightAt,
  isLngLatInsideBoundary,
  lngLatToSceneXZ,
  sceneRectToLatLngPolygon,
  sceneXZToLngLat,
} from './geoProjection';
import {
  SCENE_CORRIDORS,
  SOLID_OBSTACLE_BOXES,
  doRectsOverlap,
  generateCollisionFreeTrees,
  isPointClearForProp,
  resolveCameraAntiClip,
} from './spatialClearance';
import { DroneFlightMode, DroneTelemetryState } from '../types/agri';

test('total base area across all plots equals 626 mu and sits strictly inside user WGS84 polygon', () => {
  const sumMu = INITIAL_PLOTS.reduce((acc, p) => acc + p.areaMu, 0);
  assert.equal(sumMu, 626);

  const areaStats = computeRealBoundaryArea();
  assert.ok(areaStats.areaHectares > 250 && areaStats.areaMu > 3800);

  // Round-trip projection precision on user polygon vertices
  for (const [lng, lat] of REAL_BOUNDARY_COORDINATES_LNG_LAT) {
    const xz = lngLatToSceneXZ(lng, lat);
    const back = sceneXZToLngLat(xz.x, xz.z);
    assert.ok(Math.abs(back.lng - lng) < 0.0001);
    assert.ok(Math.abs(back.lat - lat) < 0.0001);
  }

  // Every plot center + 4 corners lie inside user WGS84 boundary
  for (const p of INITIAL_PLOTS) {
    const centerGeo = sceneXZToLngLat(p.centerX, p.centerZ);
    assert.equal(
      isLngLatInsideBoundary(centerGeo.lng, centerGeo.lat),
      true,
      `Plot center ${p.id} outside boundary`,
    );
    const corners = sceneRectToLatLngPolygon(p.centerX, p.centerZ, p.width, p.depth);
    for (const c of corners) {
      assert.equal(
        isLngLatInsideBoundary(c.lng, c.lat),
        true,
        `Plot corner of ${p.id} outside boundary`,
      );
    }
  }

  // Every IoT station lies inside user WGS84 boundary
  for (const d of INITIAL_IOT_DEVICES) {
    const geo = sceneXZToLngLat(d.x, d.z);
    assert.equal(
      isLngLatInsideBoundary(geo.lng, geo.lat),
      true,
      `IoT device ${d.id} outside boundary`,
    );
  }
});

test('strict zero-interpenetration invariants across plots, roads, canals, IoT stations, trees, UAV, and camera', () => {
  // 1. Pairwise plots never overlap (including 0.55m ridge margin)
  for (let i = 0; i < INITIAL_PLOTS.length; i++) {
    const a = INITIAL_PLOTS[i];
    assert.equal(groundHeightAt(a.centerX, a.centerZ), 0, `Plot ${a.id} not on flat polder`);
    for (let j = i + 1; j < INITIAL_PLOTS.length; j++) {
      const b = INITIAL_PLOTS[j];
      const overlap = doRectsOverlap(
        a.centerX - a.width * 0.5 - 0.55,
        a.centerX + a.width * 0.5 + 0.55,
        a.centerZ - a.depth * 0.5 - 0.55,
        a.centerZ + a.depth * 0.5 + 0.55,
        b.centerX - b.width * 0.5 - 0.55,
        b.centerX + b.width * 0.5 + 0.55,
        b.centerZ - b.depth * 0.5 - 0.55,
        b.centerZ + b.depth * 0.5 + 0.55,
      );
      assert.equal(overlap, false, `Plots ${a.id} and ${b.id} overlap!`);
    }
  }

  // 2. Plots never overlap roads or irrigation canals
  for (const p of INITIAL_PLOTS) {
    for (const c of SCENE_CORRIDORS) {
      const overlap = doRectsOverlap(
        p.centerX - p.width * 0.5,
        p.centerX + p.width * 0.5,
        p.centerZ - p.depth * 0.5,
        p.centerZ + p.depth * 0.5,
        c.centerX - c.width * 0.5,
        c.centerX + c.width * 0.5,
        c.centerZ - c.depth * 0.5,
        c.centerZ + c.depth * 0.5,
      );
      assert.equal(overlap, false, `Plot ${p.id} overlaps corridor ${c.id}!`);
    }
  }

  // 3. IoT station pedestals never overlap plots, roads, canals, silos, or greenhouses
  const stationPad = 0.45;
  for (const d of INITIAL_IOT_DEVICES) {
    for (const p of INITIAL_PLOTS) {
      const hitPlot = doRectsOverlap(
        d.x - stationPad,
        d.x + stationPad,
        d.z - stationPad,
        d.z + stationPad,
        p.centerX - p.width * 0.5,
        p.centerX + p.width * 0.5,
        p.centerZ - p.depth * 0.5,
        p.centerZ + p.depth * 0.5,
      );
      assert.equal(hitPlot, false, `IoT ${d.id} clips inside plot ${p.id}`);
    }
    for (const c of SCENE_CORRIDORS) {
      const hitCorridor = doRectsOverlap(
        d.x - stationPad,
        d.x + stationPad,
        d.z - stationPad,
        d.z + stationPad,
        c.centerX - c.width * 0.5,
        c.centerX + c.width * 0.5,
        c.centerZ - c.depth * 0.5,
        c.centerZ + c.depth * 0.5,
      );
      assert.equal(hitCorridor, false, `IoT ${d.id} clips corridor ${c.id}`);
    }
    for (const b of SOLID_OBSTACLE_BOXES) {
      if (d.id === 'dev-09' && b.id === 'rtk-tower') continue; // dev-09 IS the RTK tower
      const hitBox = doRectsOverlap(
        d.x - stationPad,
        d.x + stationPad,
        d.z - stationPad,
        d.z + stationPad,
        b.minX,
        b.maxX,
        b.minZ,
        b.maxZ,
      );
      assert.equal(hitBox, false, `IoT ${d.id} clips building ${b.id}`);
    }
  }

  // 4. Generated shelterbelt trees have zero collisions
  const trees = generateCollisionFreeTrees(INITIAL_PLOTS, INITIAL_IOT_DEVICES);
  assert.ok(trees.length >= 30);
  for (const t of trees) {
    assert.equal(
      isPointClearForProp(t.x, t.z, 1.9, INITIAL_PLOTS, INITIAL_IOT_DEVICES),
      true,
      `Tree at (${t.x}, ${t.z}) clips an obstacle`,
    );
  }

  // 5. Camera anti-clipping pushes camera out of solid silos and above terrain
  const resolvedCam = resolveCameraAntiClip(45, 6, -1, 0);
  const stillInsideSilo =
    resolvedCam.x > 37.2 &&
    resolvedCam.x < 50.8 &&
    resolvedCam.z > -9.8 &&
    resolvedCam.z < 4.2 &&
    resolvedCam.y < 12.8;
  assert.equal(stillInsideSilo, false);
});

test('multi-crop 6-stage growth simulation progresses cleanly across rice, corn, tomato, and wheat', () => {
  const riceSeed = computeCropGrowthMetrics('rice', 2, 22, 75);
  const riceHeading = computeCropGrowthMetrics('rice', 82, 22, 75);
  const riceMature = computeCropGrowthMetrics('rice', 130, 22, 75);

  assert.equal(riceSeed.stageName, '种子期');
  assert.equal(riceSeed.seedMoundScale, 1);
  assert.equal(riceSeed.reproductiveScale, 0);
  assert.equal(riceHeading.stageName, '抽穗扬花期');
  assert.ok(riceHeading.reproductiveScale > 0);
  assert.equal(riceMature.stageName, '成熟收获期');
  assert.equal(riceMature.daysToNextStage, 0);
  assert.ok(riceMature.panicleDroop > 0.8);

  const cornMature = computeCropGrowthMetrics('corn', 110, 25, 68);
  const tomatoFlower = computeCropGrowthMetrics('tomato', 54, 24, 74);
  const tomatoMature = computeCropGrowthMetrics('tomato', 95, 24, 74);
  const wheatMature = computeCropGrowthMetrics('wheat', 205, 18, 62);

  // Species height hierarchy: Corn > Tomato > Rice > Wheat
  assert.ok(cornMature.plantHeightCm > tomatoMature.plantHeightCm);
  assert.ok(tomatoMature.plantHeightCm > riceMature.plantHeightCm);
  assert.ok(riceMature.plantHeightCm > wheatMature.plantHeightCm);

  // Tomato flower yellow -> mature crimson fruit
  assert.equal(tomatoFlower.organColorHex, '#facc15');
  assert.notEqual(tomatoFlower.organColorHex, tomatoMature.organColorHex);
});

test('dashboard summary aggregates regional temp/humidity and multi-crop yield prediction', () => {
  const growthMap = computeAllCropGrowth(
    { rice: 106, corn: 88, tomato: 90, wheat: 198 },
    19.6,
    74.2,
  );
  const report = computeDashboardSummary(
    INITIAL_PLOTS,
    growthMap,
    VILLAGE_PRESETS.dongba,
    '17:30:00',
  );
  assert.equal(report.totalPlantedMu, 591);
  assert.equal(report.totalFacilityMu, 35);
  assert.equal(report.zones.length, 4);
  assert.equal(report.yieldRows.length, 4);
  assert.ok(report.totalPredictedTons > 500);
  assert.ok(report.totalPredictedRevenueWanYuan > 100);
});

test('IoT device health summary matches 20 total sensors and resolves faults cleanly', () => {
  const initialSummary = computeDeviceHealthSummary(INITIAL_IOT_DEVICES);
  assert.equal(initialSummary.totalCount, 20);
  assert.equal(initialSummary.onlineCount, 17);
  assert.equal(initialSummary.warningCount, 2);
  assert.equal(initialSummary.offlineCount, 1);

  const repaired = repairDeviceAndAlerts(INITIAL_IOT_DEVICES, INITIAL_ALERTS, 'dev-16');
  const nextSummary = computeDeviceHealthSummary(repaired.devices);
  assert.equal(nextSummary.onlineCount, 18);
  assert.equal(nextSummary.offlineCount, 0);
  assert.equal(repaired.alerts.find((a) => a.deviceId === 'dev-16')?.resolved, true);
});

test('smart irrigation increases soil moisture on active plots while inactive plots slowly transpire', () => {
  const stepped = stepPlotMoisture(INITIAL_PLOTS, 2.0);
  const irrigatedPlot = stepped.find((p) => p.id === 'plot-c1')!;
  const dryPlot = stepped.find((p) => p.id === 'plot-n1')!;
  const origIrrigated = INITIAL_PLOTS.find((p) => p.id === 'plot-c1')!;
  const origDry = INITIAL_PLOTS.find((p) => p.id === 'plot-n1')!;

  assert.ok(irrigatedPlot.baseSoilMoisture > origIrrigated.baseSoilMoisture);
  assert.ok(dryPlot.baseSoilMoisture <= origDry.baseSoilMoisture);
});

test('24h village telemetry generates 12 two-hour diurnal samples within valid bounds', () => {
  const series = generateHourlyTelemetry(VILLAGE_PRESETS.dongba);
  assert.equal(series.length, 12);
  for (const pt of series) {
    assert.ok(pt.airTempC > 5 && pt.airTempC < 40);
    assert.ok(pt.airHumidityPct >= 40 && pt.airHumidityPct <= 95);
  }
});

test('drone kinematics advances smoothly, outputs real WGS84 lat/lng, and never clips into tall silos', () => {
  const growthMap = computeAllCropGrowth({ rice: 90, corn: 80, tomato: 75, wheat: 170 });
  const initialDrone: DroneTelemetryState = {
    x: 44,
    y: 13.0,
    z: -1,
    lat: 31.2737,
    lng: 118.5137,
    headingRad: 0,
    speedMs: 0,
    altitudeM: 13,
    batteryPct: 92,
    flightMode: DroneFlightMode.ManualControl,
    activeWaypointIndex: 0,
    targetX: 44,
    targetZ: -1,
    targetLabel: '手动遥控巡航',
    ndviIndex: 0.78,
    canopyTempC: 19.2,
    pestRiskLevel: '低风险',
    scanningPlotId: 'plot-op',
  };

  // Command manual descent directly over 12.8m grain silo tower -> anti-clipping floor must lift UAV >= 15.4m
  const next = stepDroneKinematics(
    initialDrone,
    0.1,
    { forward: 0, right: 0, up: -1 },
    INITIAL_PLOTS,
    growthMap,
  );
  assert.ok(next.y >= 15.4, `UAV altitude ${next.y} clipped silo tower!`);
  assert.equal(isLngLatInsideBoundary(next.lng, next.lat), true);
});
