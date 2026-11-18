import { AgriPlot, IoTDeviceNode } from '../types/agri';

export interface CorridorBand {
  id: string;
  kind: 'road' | 'canal';
  orientation: 'horizontal' | 'vertical';
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface ObstacleBox3D {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  occluder: boolean;
}

/**
 * Non-overlapping road and irrigation canal corridors positioned strictly inside generous inter-plot gaps:
 * - North plots span z in [-37, -19]
 * - Central plots span z in [-12, +10]  -> 7.0u Gap z in [-19, -12]
 * - South plots span z in [+17, +35]    -> 7.0u Gap z in [+10, +17]
 * - Left plots end at x = -23, Right plots start at x = -12 -> 11.0u Vertical Gap x in [-23, -12]
 */
export const SCENE_CORRIDORS: ReadonlyArray<CorridorBand> = [
  // North irrigation canal (z in [-18.2, -17.0])
  {
    id: 'canal-north',
    kind: 'canal',
    orientation: 'horizontal',
    centerX: -10,
    centerZ: -17.6,
    width: 124,
    depth: 1.2,
  },
  // North-Central main farm road where autonomous tractor patrols (z in [-15.7, -13.7])
  {
    id: 'road-north-central',
    kind: 'road',
    orientation: 'horizontal',
    centerX: -6,
    centerZ: -14.7,
    width: 132,
    depth: 2.0,
  },
  // Central-South service road (z in [11.7, 13.7])
  {
    id: 'road-central-south',
    kind: 'road',
    orientation: 'horizontal',
    centerX: -6,
    centerZ: 12.7,
    width: 132,
    depth: 2.0,
  },
  // South irrigation canal (z in [14.8, 16.0])
  {
    id: 'canal-south',
    kind: 'canal',
    orientation: 'horizontal',
    centerX: -10,
    centerZ: 15.4,
    width: 124,
    depth: 1.2,
  },
  // Southern perimeter trunk road (z in [37.5, 39.7], south of z=35 plots and inside SW/SE polygon)
  {
    id: 'road-south-perimeter',
    kind: 'road',
    orientation: 'horizontal',
    centerX: -10,
    centerZ: 38.6,
    width: 132,
    depth: 2.2,
  },
  // Central North-South spine road through 11u inter-plot X gap [-23, -12] (x in [-18.7, -16.3])
  {
    id: 'road-ns-spine',
    kind: 'road',
    orientation: 'vertical',
    centerX: -17.5,
    centerZ: 0.8,
    width: 2.4,
    depth: 79.0,
  },
];

/**
 * Eastern Qingyi Tributary River centerline X at a given scene Z.
 * Hugs the eastern perimeter outside all plots (max plot X = 54).
 */
export function riverCenterXAtZ(z: number): number {
  return 69.0 + z * 0.14;
}

export const RIVER_HALF_WIDTH = 5.8;
export const RIVER_EMBANKMENT_HALF_WIDTH = 7.4;

/**
 * Solid 3D architectural structures used for both anti-clipping (camera & UAV) and AABB occlusion culling
 */
export const SOLID_OBSTACLE_BOXES: ReadonlyArray<ObstacleBox3D> = [
  // Grain Drying Silos & Elevator Tower Complex on plot-op (centerX=45, centerZ=-1, width=18, depth=22 -> x in [36, 54], z in [-12, 10])
  {
    id: 'silo-tower-cluster',
    label: '低温循环谷物烘干塔群',
    minX: 37.2,
    maxX: 50.8,
    minZ: -9.8,
    maxZ: 4.2,
    topY: 12.8,
    occluder: true,
  },
  // River Intake Pump Station on plot-op
  {
    id: 'pump-station-house',
    label: '沿江智能提水泵站',
    minX: 43.8,
    maxX: 52.8,
    minZ: 4.4,
    maxZ: 9.2,
    topY: 4.6,
    occluder: true,
  },
  // 3 Smart Breeding & Cherry Tomato Greenhouses cleanly inside plot-gh (centerX=41, centerZ=26, width=22, depth=18 -> x in [30, 52], z in [17, 35])
  {
    id: 'greenhouse-west',
    label: '一号智能育苗温室',
    minX: 31.3,
    maxX: 36.9,
    minZ: 18.4,
    maxZ: 33.6,
    topY: 3.4,
    occluder: true,
  },
  {
    id: 'greenhouse-center',
    label: '二号串收番茄温室',
    minX: 38.2,
    maxX: 43.8,
    minZ: 18.4,
    maxZ: 33.6,
    topY: 3.4,
    occluder: true,
  },
  {
    id: 'greenhouse-east',
    label: '三号恒温驯化温室',
    minX: 45.1,
    maxX: 50.7,
    minZ: 18.4,
    maxZ: 33.6,
    topY: 3.4,
    occluder: true,
  },
  // Beidou RTK Differential Base Station Tower (in x=[30,36] gap at (33.0, -9.0))
  {
    id: 'rtk-tower',
    label: '北斗RTK差分基站塔',
    minX: 31.8,
    maxX: 34.2,
    minZ: -10.2,
    maxZ: -7.8,
    topY: 7.4,
    occluder: false,
  },
  // Eastern Dongba Village Houses (east of river embankment > 84)
  {
    id: 'village-h1',
    label: '东八民居1',
    minX: 84.5,
    maxX: 91.5,
    minZ: -39.5,
    maxZ: -33.5,
    topY: 5.8,
    occluder: false,
  },
  {
    id: 'village-h2',
    label: '东八民居2',
    minX: 92.0,
    maxX: 99.0,
    minZ: -27.5,
    maxZ: -21.5,
    topY: 5.8,
    occluder: false,
  },
  {
    id: 'village-h3',
    label: '东八民居3',
    minX: 87.5,
    maxX: 94.5,
    minZ: -11.5,
    maxZ: -5.5,
    topY: 5.8,
    occluder: false,
  },
  {
    id: 'village-h4',
    label: '东八民居4',
    minX: 94.5,
    maxX: 101.5,
    minZ: 2.5,
    maxZ: 8.5,
    topY: 5.8,
    occluder: false,
  },
  {
    id: 'village-h5',
    label: '东八民居5',
    minX: 90.5,
    maxX: 97.5,
    minZ: 17.5,
    maxZ: 23.5,
    topY: 5.8,
    occluder: false,
  },
];

export function doRectsOverlap(
  aMinX: number,
  aMaxX: number,
  aMinZ: number,
  aMaxZ: number,
  bMinX: number,
  bMaxX: number,
  bMinZ: number,
  bMaxZ: number,
): boolean {
  return aMinX < bMaxX && aMaxX > bMinX && aMinZ < bMaxZ && aMaxZ > bMinZ;
}

/**
 * Checks if a candidate circle (x, z, radius) collides with any plot, road, canal, river, IoT station, or building.
 */
export function isPointClearForProp(
  x: number,
  z: number,
  radius: number,
  plots: ReadonlyArray<AgriPlot>,
  devices: ReadonlyArray<IoTDeviceNode>,
): boolean {
  const minX = x - radius;
  const maxX = x + radius;
  const minZ = z - radius;
  const maxZ = z + radius;

  for (const p of plots) {
    const pMinX = p.centerX - p.width * 0.5 - 0.8;
    const pMaxX = p.centerX + p.width * 0.5 + 0.8;
    const pMinZ = p.centerZ - p.depth * 0.5 - 0.8;
    const pMaxZ = p.centerZ + p.depth * 0.5 + 0.8;
    if (doRectsOverlap(minX, maxX, minZ, maxZ, pMinX, pMaxX, pMinZ, pMaxZ)) {
      return false;
    }
  }

  for (const c of SCENE_CORRIDORS) {
    const cMinX = c.centerX - c.width * 0.5 - 0.35;
    const cMaxX = c.centerX + c.width * 0.5 + 0.35;
    const cMinZ = c.centerZ - c.depth * 0.5 - 0.35;
    const cMaxZ = c.centerZ + c.depth * 0.5 + 0.35;
    if (doRectsOverlap(minX, maxX, minZ, maxZ, cMinX, cMaxX, cMinZ, cMaxZ)) {
      return false;
    }
  }

  const rcx = riverCenterXAtZ(z);
  if (Math.abs(x - rcx) < RIVER_EMBANKMENT_HALF_WIDTH + radius + 0.6) {
    return false;
  }
  if (
    (Math.abs(z - -14.7) < 3.6 + radius || Math.abs(z - 12.7) < 3.6 + radius) &&
    x > 55 &&
    x < 85
  ) {
    return false;
  }

  for (const b of SOLID_OBSTACLE_BOXES) {
    if (
      doRectsOverlap(
        minX,
        maxX,
        minZ,
        maxZ,
        b.minX - 0.6,
        b.maxX + 0.6,
        b.minZ - 0.6,
        b.maxZ + 0.6,
      )
    ) {
      return false;
    }
  }

  for (const d of devices) {
    if (Math.hypot(x - d.x, z - d.z) < radius + 1.8) {
      return false;
    }
  }

  return true;
}

export function generateCollisionFreeTrees(
  plots: ReadonlyArray<AgriPlot>,
  devices: ReadonlyArray<IoTDeviceNode>,
): Array<{ x: number; z: number; scale: number }> {
  const candidates: Array<{ x: number; z: number; scale: number }> = [];

  for (let tx = -72; tx <= 40; tx += 6.6) {
    candidates.push({ x: tx, z: -40.8, scale: 0.88 + ((Math.abs(tx) * 7) % 10) * 0.025 });
  }
  for (let tz = -36; tz <= 36; tz += 6.6) {
    candidates.push({ x: -73.2, z: tz, scale: 0.9 + ((Math.abs(tz) * 11) % 10) * 0.025 });
  }
  for (let tx = -72; tx <= 52; tx += 7.0) {
    candidates.push({ x: tx, z: 42.6, scale: 0.92 + ((Math.abs(tx) * 13) % 10) * 0.025 });
  }
  for (let tz = -35; tz <= 35; tz += 7.2) {
    const rx = riverCenterXAtZ(tz) - RIVER_EMBANKMENT_HALF_WIDTH - 2.6;
    candidates.push({
      x: Number(rx.toFixed(2)),
      z: tz,
      scale: 0.86 + ((Math.abs(tz) * 17) % 10) * 0.025,
    });
  }
  for (let tz = -36; tz <= 34; tz += 7.8) {
    const rx = riverCenterXAtZ(tz) + RIVER_EMBANKMENT_HALF_WIDTH + 2.8;
    candidates.push({
      x: Number(rx.toFixed(2)),
      z: tz,
      scale: 0.88 + ((Math.abs(tz) * 19) % 10) * 0.025,
    });
  }

  const accepted: Array<{ x: number; z: number; scale: number }> = [];
  const treeCanopyRadius = 1.95;

  for (const c of candidates) {
    if (!isPointClearForProp(c.x, c.z, treeCanopyRadius, plots, devices)) {
      continue;
    }
    const tooCloseToOtherTree = accepted.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < 4.2);
    if (!tooCloseToOtherTree) {
      accepted.push(c);
    }
  }

  return accepted;
}

export function getStructureClearanceY(x: number, z: number, padRadius = 2.0): number {
  let maxTop = 0;
  for (const b of SOLID_OBSTACLE_BOXES) {
    if (
      x >= b.minX - padRadius &&
      x <= b.maxX + padRadius &&
      z >= b.minZ - padRadius &&
      z <= b.maxZ + padRadius
    ) {
      if (b.topY > maxTop) maxTop = b.topY;
    }
  }
  return maxTop;
}

export function resolveCameraAntiClip(
  camX: number,
  camY: number,
  camZ: number,
  groundY: number,
): { x: number; y: number; z: number } {
  let x = camX;
  let y = Math.max(camY, groundY + 2.2);
  let z = camZ;

  const camPad = 1.6;
  for (const b of SOLID_OBSTACLE_BOXES) {
    const insideXZ =
      x > b.minX - camPad &&
      x < b.maxX + camPad &&
      z > b.minZ - camPad &&
      z < b.maxZ + camPad;
    if (insideXZ && y < b.topY + 1.5) {
      const liftDelta = b.topY + 1.5 - y;
      const dLeft = Math.abs(x - (b.minX - camPad));
      const dRight = Math.abs(b.maxX + camPad - x);
      const dFront = Math.abs(z - (b.minZ - camPad));
      const dBack = Math.abs(b.maxZ + camPad - z);
      const minHoriz = Math.min(dLeft, dRight, dFront, dBack);

      if (liftDelta <= minHoriz * 1.35) {
        y = b.topY + 1.5;
      } else if (minHoriz === dLeft) {
        x = b.minX - camPad;
      } else if (minHoriz === dRight) {
        x = b.maxX + camPad;
      } else if (minHoriz === dFront) {
        z = b.minZ - camPad;
      } else {
        z = b.maxZ + camPad;
      }
    }
  }

  return { x, y, z };
}
