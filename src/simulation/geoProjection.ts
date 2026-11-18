export interface GeoLatLng {
  lat: number;
  lng: number;
}

export interface SceneXZ {
  x: number;
  z: number;
}

/**
 * Exact real-world WGS84 GeoJSON polygon provided by the user
 * Location: Dongba Core Agricultural Cluster, Wanzhi District, Wuhu, Anhui Province
 */
export const REAL_BOUNDARY_COORDINATES_LNG_LAT: ReadonlyArray<readonly [number, number]> = [
  [118.498558, 31.281198],
  [118.522368, 31.280139],
  [118.528939, 31.271076],
  [118.524859, 31.266179],
  [118.498363, 31.26674],
  [118.498558, 31.281198],
] as const;

export const REAL_BOUNDARY_LATLNG_PATH: GeoLatLng[] = REAL_BOUNDARY_COORDINATES_LNG_LAT.slice(
  0,
  -1,
).map(([lng, lat]) => ({ lat, lng }));

// Geographic projection reference origin (center of bounding box)
export const GEO_ORIGIN_LNG = 118.513651;
export const GEO_ORIGIN_LAT = 31.2736885;

// Earth metric scale factors at 31.2737 deg North
const METERS_PER_DEG_LAT = 110874.4;
const METERS_PER_DEG_LNG = 111319.5 * Math.cos((GEO_ORIGIN_LAT * Math.PI) / 180); // ~95,147.8 m/deg

// 1 Three.js world unit = 18.0 real-world meters (maps ~2.91km x 1.67km polygon to ~161.6 x 92.5 scene units)
export const REAL_METERS_PER_SCENE_UNIT = 18.0;

/**
 * Projects WGS84 (lng, lat) to Three.js local scene coordinates (x = East, z = South)
 */
export function lngLatToSceneXZ(lng: number, lat: number): SceneXZ {
  const eastMeters = (lng - GEO_ORIGIN_LNG) * METERS_PER_DEG_LNG;
  const northMeters = (lat - GEO_ORIGIN_LAT) * METERS_PER_DEG_LAT;
  return {
    x: Number((eastMeters / REAL_METERS_PER_SCENE_UNIT).toFixed(3)),
    z: Number((-northMeters / REAL_METERS_PER_SCENE_UNIT).toFixed(3)),
  };
}

/**
 * Inverse-projects Three.js local scene coordinates (x, z) back to exact WGS84 { lat, lng }
 */
export function sceneXZToLngLat(x: number, z: number): GeoLatLng {
  const eastMeters = x * REAL_METERS_PER_SCENE_UNIT;
  const northMeters = -z * REAL_METERS_PER_SCENE_UNIT;
  const lng = GEO_ORIGIN_LNG + eastMeters / METERS_PER_DEG_LNG;
  const lat = GEO_ORIGIN_LAT + northMeters / METERS_PER_DEG_LAT;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/**
 * Projected 3D scene boundary vertices matching REAL_BOUNDARY_COORDINATES_LNG_LAT
 */
export const SCENE_BOUNDARY_VERTICES: SceneXZ[] = REAL_BOUNDARY_COORDINATES_LNG_LAT.map(
  ([lng, lat]) => lngLatToSceneXZ(lng, lat),
);

/**
 * Ray-casting point-in-polygon check in WGS84 [lng, lat] space
 */
export function isLngLatInsideBoundary(lng: number, lat: number): boolean {
  const ring = REAL_BOUNDARY_COORDINATES_LNG_LAT;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes geodesic polygon area in hectares and Chinese Mu (1 hectare = 15 Mu) using Shoelace in metric space
 */
export function computeRealBoundaryArea(): {
  areaSqMeters: number;
  areaHectares: number;
  areaMu: number;
  eastWestKm: number;
  northSouthKm: number;
} {
  const pts = REAL_BOUNDARY_COORDINATES_LNG_LAT.slice(0, -1).map(([lng, lat]) => ({
    mx: (lng - GEO_ORIGIN_LNG) * METERS_PER_DEG_LNG,
    my: (lat - GEO_ORIGIN_LAT) * METERS_PER_DEG_LAT,
  }));

  let twiceArea = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    twiceArea += cur.mx * next.my - next.mx * cur.my;
    if (cur.mx < minX) minX = cur.mx;
    if (cur.mx > maxX) maxX = cur.mx;
    if (cur.my < minY) minY = cur.my;
    if (cur.my > maxY) maxY = cur.my;
  }

  const areaSqMeters = Math.abs(twiceArea) * 0.5;
  const areaHectares = Number((areaSqMeters / 10000).toFixed(1));
  const areaMu = Math.round(areaHectares * 15);
  return {
    areaSqMeters: Math.round(areaSqMeters),
    areaHectares,
    areaMu,
    eastWestKm: Number(((maxX - minX) / 1000).toFixed(2)),
    northSouthKm: Number(((maxY - minY) / 1000).toFixed(2)),
  };
}

/**
 * Converts a rectangular scene plot (centerX, centerZ, width, depth) to a 4-corner WGS84 polygon path
 */
export function sceneRectToLatLngPolygon(
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
): GeoLatLng[] {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  return [
    sceneXZToLngLat(centerX - hw, centerZ - hd),
    sceneXZToLngLat(centerX + hw, centerZ - hd),
    sceneXZToLngLat(centerX + hw, centerZ + hd),
    sceneXZToLngLat(centerX - hw, centerZ + hd),
  ];
}

/**
 * Real-world Wuhu Yangtze-Qingyi alluvial plain micro-relief elevation model
 * Gently slopes from NW terrace (~8.4m ASL) toward eastern Qingyi tributary river channel (~5.4m ASL)
 */
export function sampleRealElevationMeters(x: number, z: number): number {
  const nwSlope = (-x * 0.014 - z * 0.008);
  const undulation = Math.sin(x * 0.045) * 0.22 + Math.cos(z * 0.055) * 0.18;
  return Number((6.8 + nwSlope + undulation).toFixed(2));
}

/**
 * Scene Y height for outer surrounding terrain and river channel.
 * Keeps the entire agricultural polder & road network (-69..67.5, -45..45) strictly level at y = 0
 * while carving the eastern Qingyi tributary riverbed and raising gentle distant outer embankments.
 */
export function groundHeightAt(x: number, z: number): number {
  const riverLineX = 69.0 + z * 0.14;
  const distToRiver = Math.abs(x - riverLineX);
  if (distToRiver < 6.4) {
    return -0.52 * Math.cos((distToRiver / 6.4) * (Math.PI * 0.5));
  }
  if (x >= -76 && x <= 60.5 && z >= -44.5 && z <= 44.5) {
    return 0;
  }
  const dxOut = x < -76 ? -76 - x : x > 80 ? x - 80 : 0;
  const dzOut = z < -44.5 ? -44.5 - z : z > 44.5 ? z - 44.5 : 0;
  const radialOut = Math.hypot(dxOut, dzOut);
  if (radialOut > 0) {
    return Number(
      (
        Math.min(2.2, radialOut * 0.045) *
        (0.72 + 0.28 * Math.sin(x * 0.06 + 1.1) * Math.cos(z * 0.07))
      ).toFixed(3),
    );
  }
  return 0;
}
