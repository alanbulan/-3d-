import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { DEVICE_CATEGORIES } from '../simulation/agriSimEngine';
import { groundHeightAt } from '../simulation/geoProjection';
import {
  RIVER_EMBANKMENT_HALF_WIDTH,
  RIVER_HALF_WIDTH,
  SOLID_OBSTACLE_BOXES,
  riverCenterXAtZ,
} from '../simulation/spatialClearance';
import { AgriPlot, IoTDeviceNode, SimCropKey } from '../types/agri';

function normalizeToNonIndexedWithColor(geo: THREE.BufferGeometry, shade = 1): THREE.BufferGeometry {
  const nonIdx = geo.index ? geo.toNonIndexed() : geo.clone();
  nonIdx.deleteAttribute('uv');
  const count = nonIdx.attributes.position.count;
  if (!nonIdx.attributes.color) {
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = shade;
      cols[i * 3 + 1] = shade;
      cols[i * 3 + 2] = shade;
    }
    nonIdx.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  nonIdx.computeVertexNormals();
  return nonIdx;
}

/**
 * 1. Germinating Soil Seed-Mound + Tiny Sprout Tip (Bottom-pivoted at y = 0)
 * Visible during Seed Stage (种子期) and Early Emergence (出苗期)
 */
export function createSeedMoundGeometry(): THREE.BufferGeometry {
  const mound = new THREE.ConeGeometry(0.28, 0.16, 7, 1);
  mound.translate(0, 0.08, 0);
  const nib = new THREE.ConeGeometry(0.055, 0.14, 5, 1);
  nib.translate(0, 0.19, 0);

  const merged = BufferGeometryUtils.mergeGeometries([
    normalizeToNonIndexedWithColor(mound, 0.78),
    normalizeToNonIndexedWithColor(nib, 1.08),
  ]);
  mound.dispose();
  nib.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 2. Rice / Wheat Vegetative Clump Geometry (LOD0 High vs LOD1 Low, bottom-pivoted at y = 0)
 */
export function createCerealFoliageGeometry(detail: 'high' | 'low'): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vOffset = 0;

  const bladeCount = detail === 'high' ? 6 : 3;
  const segs = detail === 'high' ? 3 : 1;

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + (b % 2) * 0.26;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpZ = cos;
    const leanOut = 0.32 + (b % 3) * 0.06;
    const height = 0.94 + (b % 2) * 0.14;
    const widthBase = detail === 'high' ? 0.15 : 0.21;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const arch = Math.pow(t, 1.45) * leanOut;
      const cx = cos * arch;
      const cz = sin * arch;
      const cy = height * t;
      const halfW = widthBase * (1 - t * 0.72) * 0.5;

      positions.push(cx - perpX * halfW, cy, cz - perpZ * halfW);
      positions.push(cx + perpX * halfW, cy, cz + perpZ * halfW);
      normals.push(cos * 0.35, 0.9, sin * 0.35);
      normals.push(cos * 0.35, 0.9, sin * 0.35);

      const shade = 0.52 + t * 0.54;
      colors.push(shade, shade, shade * 0.95);
      colors.push(shade, shade, shade * 0.95);
    }

    for (let s = 0; s < segs; s++) {
      const i0 = vOffset + s * 2;
      indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
    vOffset += (segs + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 3. Rice Drooping Panicle vs Wheat Upright Spike Organ Geometry (pivoted at plant base y = 0)
 */
export function createCerealPanicleGeometry(isRice: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.35;
    const spike = new THREE.ConeGeometry(isRice ? 0.085 : 0.075, isRice ? 0.42 : 0.34, 5, 1);
    if (isRice) {
      spike.rotateZ(-0.62); // Graceful drooping rice grain panicle
      spike.rotateY(a);
      spike.translate(Math.cos(a) * 0.2, 0.98, Math.sin(a) * 0.2);
    } else {
      spike.rotateZ(-0.12); // Upright awned wheat ear
      spike.rotateY(a);
      spike.translate(Math.cos(a) * 0.12, 0.96, Math.sin(a) * 0.12);
    }
    parts.push(normalizeToNonIndexedWithColor(spike, 0.95 + (i % 2) * 0.1));
    spike.dispose();
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 4. Corn Tall Segmented Stalk + Broad Opposite Arching Leaves (LOD0 High vs LOD1 Low)
 */
export function createCornStalkGeometry(detail: 'high' | 'low'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const stalk = new THREE.CylinderGeometry(0.045, 0.075, 1.35, detail === 'high' ? 6 : 4);
  stalk.translate(0, 0.675, 0);
  parts.push(normalizeToNonIndexedWithColor(stalk, 0.76));
  stalk.dispose();

  const leafCount = detail === 'high' ? 6 : 3;
  for (let i = 0; i < leafCount; i++) {
    const t = (i + 1) / (leafCount + 1);
    const angle = i * 2.35;
    const leaf = new THREE.BoxGeometry(0.52, 0.022, detail === 'high' ? 0.16 : 0.2);
    leaf.translate(0.24, 0, 0);
    leaf.rotateZ(0.32 - t * 0.22);
    leaf.rotateY(angle);
    leaf.translate(0, 0.26 + t * 0.92, 0);
    parts.push(normalizeToNonIndexedWithColor(leaf, 0.68 + t * 0.36));
    leaf.dispose();
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 5. Corn Top Male Tassel + Mid-Stalk Plump Golden Cob Ear
 */
export function createCornReproductiveGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Top tassel plume
  const tassel = new THREE.ConeGeometry(0.12, 0.28, 5);
  tassel.translate(0, 1.46, 0);
  parts.push(normalizeToNonIndexedWithColor(tassel, 1.05));
  tassel.dispose();

  // Two side corn ears angled outward from mid-stalk nodes
  for (const side of [-1, 1]) {
    const cob = new THREE.CylinderGeometry(0.068, 0.082, 0.32, 6);
    cob.rotateZ(side * -0.46);
    cob.translate(side * 0.13, 0.78 + (side > 0 ? 0.08 : -0.04), 0.03);
    parts.push(normalizeToNonIndexedWithColor(cob, 0.98));
    cob.dispose();
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 6. Tomato Trellis Stake + Compound Bushy Vine Foliage (LOD0 High vs LOD1 Low)
 */
export function createTomatoVineGeometry(detail: 'high' | 'low'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Central wooden/galvanized trellis stake (shaded warm neutral)
  const stake = new THREE.CylinderGeometry(0.028, 0.032, 1.24, 5);
  stake.translate(0, 0.62, 0);
  parts.push(normalizeToNonIndexedWithColor(stake, 0.58));
  stake.dispose();

  // Tiered bushy compound leaf clusters
  const tiers = detail === 'high' ? 4 : 2;
  for (let i = 0; i < tiers; i++) {
    const y = 0.28 + i * (detail === 'high' ? 0.24 : 0.42);
    const r = 0.24 - i * 0.025;
    const tuft = new THREE.DodecahedronGeometry(r, 0);
    tuft.scale(1.15, 0.65, 1.15);
    tuft.rotateY(i * 1.1);
    tuft.translate((i % 2 === 0 ? 1 : -1) * 0.04, y, 0);
    parts.push(normalizeToNonIndexedWithColor(tuft, 0.72 + i * 0.08));
    tuft.dispose();
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 7. Tomato Blossom / Hanging Berry Fruit Trusses (Yellow flower -> Green fruit -> Crimson tomato)
 */
export function createTomatoTrussGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const offsets = [
    { x: 0.18, y: 0.42, z: 0.12, r: 0.095 },
    { x: -0.17, y: 0.58, z: 0.14, r: 0.092 },
    { x: 0.14, y: 0.76, z: -0.15, r: 0.088 },
    { x: -0.13, y: 0.92, z: -0.11, r: 0.082 },
  ];
  for (const o of offsets) {
    const fruit = new THREE.IcosahedronGeometry(o.r, 0);
    fruit.scale(1.06, 0.92, 1.06);
    fruit.translate(o.x, o.y, o.z);
    parts.push(normalizeToNonIndexedWithColor(fruit, 1.02));
    fruit.dispose();
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

export interface CropGeometryLibrary {
  seedMound: THREE.BufferGeometry;
  foliageHigh: Record<SimCropKey, THREE.BufferGeometry>;
  foliageLow: Record<SimCropKey, THREE.BufferGeometry>;
  reproductive: Record<SimCropKey, THREE.BufferGeometry>;
  disposeAll: () => void;
}

export function createCropGeometryLibrary(): CropGeometryLibrary {
  const seedMound = createSeedMoundGeometry();
  const cerealHigh = createCerealFoliageGeometry('high');
  const cerealLow = createCerealFoliageGeometry('low');
  const ricePanicle = createCerealPanicleGeometry(true);
  const wheatSpike = createCerealPanicleGeometry(false);
  const cornHigh = createCornStalkGeometry('high');
  const cornLow = createCornStalkGeometry('low');
  const cornOrgan = createCornReproductiveGeometry();
  const tomatoHigh = createTomatoVineGeometry('high');
  const tomatoLow = createTomatoVineGeometry('low');
  const tomatoTruss = createTomatoTrussGeometry();

  return {
    seedMound,
    foliageHigh: {
      rice: cerealHigh,
      wheat: cerealHigh,
      corn: cornHigh,
      tomato: tomatoHigh,
    },
    foliageLow: {
      rice: cerealLow,
      wheat: cerealLow,
      corn: cornLow,
      tomato: tomatoLow,
    },
    reproductive: {
      rice: ricePanicle,
      wheat: wheatSpike,
      corn: cornOrgan,
      tomato: tomatoTruss,
    },
    disposeAll: () => {
      seedMound.dispose();
      cerealHigh.dispose();
      cerealLow.dispose();
      ricePanicle.dispose();
      wheatSpike.dispose();
      cornHigh.dispose();
      cornLow.dispose();
      cornOrgan.dispose();
      tomatoHigh.dispose();
      tomatoLow.dispose();
      tomatoTruss.dispose();
    },
  };
}

export interface MergedStaticBatchesResult {
  group: THREE.Group;
  batchCount: number;
  disposeAll: () => void;
}

/**
 * Merges static earthen plot ridges, river stone embankments, bridge decks/piers/rails, and eastern village
 * houses by material into 5 single-draw-call BufferGeometries with zero corner/surface interpenetration.
 */
export function createMergedStaticEnvironmentBatches(
  plots: ReadonlyArray<AgriPlot>,
): MergedStaticBatchesResult {
  const group = new THREE.Group();
  const ridgeGeos: THREE.BufferGeometry[] = [];
  const stoneGeos: THREE.BufferGeometry[] = [];
  const bridgeDeckGeos: THREE.BufferGeometry[] = [];
  const wallGeos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];

  // 1. Mitered Earthen Plot Ridges (strictly wrapping outside plot bed without corner overlap)
  const rt = 0.56;
  const rh = 0.24;
  for (const p of plots) {
    const outerW = p.width + rt * 2;
    const nR = new THREE.BoxGeometry(outerW, rh, rt);
    nR.translate(p.centerX, rh * 0.5, p.centerZ - p.depth * 0.5 - rt * 0.5);
    const sR = new THREE.BoxGeometry(outerW, rh, rt);
    sR.translate(p.centerX, rh * 0.5, p.centerZ + p.depth * 0.5 + rt * 0.5);
    const wR = new THREE.BoxGeometry(rt, rh, p.depth);
    wR.translate(p.centerX - p.width * 0.5 - rt * 0.5, rh * 0.5, p.centerZ);
    const eR = new THREE.BoxGeometry(rt, rh, p.depth);
    eR.translate(p.centerX + p.width * 0.5 + rt * 0.5, rh * 0.5, p.centerZ);
    ridgeGeos.push(nR, sR, wR, eR);
  }

  // 2. Segmented River Stone Embankments following riverCenterXAtZ(z) with clean cutouts at the 2 bridges
  const bridgeZs = [-14.7, 12.7];
  const zMin = -54;
  const zMax = 54;
  const segCount = 18;
  const segLen = (zMax - zMin) / segCount;
  const riverYaw = -Math.atan(0.14);

  for (let s = 0; s < segCount; s++) {
    const cz = zMin + (s + 0.5) * segLen;
    const nearBridge = bridgeZs.some((bz) => Math.abs(cz - bz) < 3.4);
    if (nearBridge) continue;
    const rcx = riverCenterXAtZ(cz);
    for (const side of [-1, 1]) {
      const bank = new THREE.BoxGeometry(1.3, 0.42, segLen + 0.15);
      bank.rotateY(riverYaw);
      bank.translate(
        rcx + side * (RIVER_HALF_WIDTH + 0.65),
        0.16,
        cz,
      );
      stoneGeos.push(bank);
    }
  }

  // 3. Two Canal Girder Bridges at z = -14.7 & z = +12.7 with sloped approach ramps (zero road step clipping)
  for (const bz of bridgeZs) {
    const rcx = riverCenterXAtZ(bz);
    const spanW = RIVER_EMBANKMENT_HALF_WIDTH * 2 + 2.4; // ~17.2m span

    const deck = new THREE.BoxGeometry(spanW, 0.44, 4.6);
    deck.translate(rcx, 0.58, bz);
    bridgeDeckGeos.push(deck);

    // West & East sloped approach ramps down to y = 0.065 road level
    for (const side of [-1, 1]) {
      const ramp = new THREE.BoxGeometry(3.8, 0.24, 4.4);
      ramp.rotateZ(side * 0.12);
      ramp.translate(rcx + side * (spanW * 0.5 + 1.75), 0.3, bz);
      bridgeDeckGeos.push(ramp);
    }

    // Bridge stone piers anchored into riverbed (-0.52..0.38)
    for (const px of [-4.6, 0, 4.6]) {
      const pier = new THREE.BoxGeometry(1.05, 0.92, 4.2);
      pier.translate(rcx + px, -0.06, bz);
      stoneGeos.push(pier);
    }

    // Bridge guardrails cleanly above deck
    for (const rz of [-2.12, 2.12]) {
      const rail = new THREE.BoxGeometry(spanW, 0.62, 0.16);
      rail.translate(rcx, 1.11, bz + rz);
      wallGeos.push(rail);
    }
  }

  // 4. Eastern Dongba Village Houses grounded flush on groundHeightAt(cx, cz)
  for (const box of SOLID_OBSTACLE_BOXES) {
    if (!box.id.startsWith('village-h')) continue;
    const cx = (box.minX + box.maxX) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;
    const w = box.maxX - box.minX - 0.8;
    const d = box.maxZ - box.minZ - 0.8;
    const gy = groundHeightAt(cx, cz);

    const body = new THREE.BoxGeometry(w, 3.6, d);
    body.translate(cx, gy + 1.8, cz);
    wallGeos.push(body);

    const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.54, 1.75, 4);
    roof.rotateY(Math.PI * 0.25);
    roof.translate(cx, gy + 3.6 + 0.875, cz);
    roofGeos.push(roof);
  }

  const ridgeMerged = BufferGeometryUtils.mergeGeometries(ridgeGeos);
  const stoneMerged = BufferGeometryUtils.mergeGeometries(stoneGeos);
  const deckMerged = BufferGeometryUtils.mergeGeometries(bridgeDeckGeos);
  const wallMerged = BufferGeometryUtils.mergeGeometries(wallGeos);
  const roofMerged = BufferGeometryUtils.mergeGeometries(roofGeos);

  [...ridgeGeos, ...stoneGeos, ...bridgeDeckGeos, ...wallGeos, ...roofGeos].forEach((g) =>
    g.dispose(),
  );

  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x566d46,
    roughness: 0.88,
    metalness: 0.02,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x7c8b9e,
    roughness: 0.82,
    metalness: 0.06,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.74,
    metalness: 0.08,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.74,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.62,
    metalness: 0.14,
  });

  const meshes = [
    new THREE.Mesh(ridgeMerged, ridgeMat),
    new THREE.Mesh(stoneMerged, stoneMat),
    new THREE.Mesh(deckMerged, deckMat),
    new THREE.Mesh(wallMerged, wallMat),
    new THREE.Mesh(roofMerged, roofMat),
  ];
  for (const m of meshes) {
    m.receiveShadow = true;
    m.castShadow = true;
    m.geometry.computeBoundingSphere();
    group.add(m);
  }

  return {
    group,
    batchCount: meshes.length,
    disposeAll: () => {
      ridgeMerged.dispose();
      stoneMerged.dispose();
      deckMerged.dispose();
      wallMerged.dispose();
      roofMerged.dispose();
      ridgeMat.dispose();
      stoneMat.dispose();
      deckMat.dispose();
      wallMat.dispose();
      roofMat.dispose();
    },
  };
}

export interface DroneModelHandles {
  root: THREE.Group;
  rotors: THREE.Object3D[];
  scanBeam: THREE.Mesh;
  scanRing: THREE.Mesh;
}

/**
 * 10-part composite Agricultural Plant-Protection & Multispectral UAV
 * Scan cone is unit-height (top at 0, base at -1) so AgriScene3D scales it dynamically to exact ground/roof clearance!
 */
export function createAgriDroneModel(): DroneModelHandles {
  const root = new THREE.Group();
  const rotors: THREE.Object3D[] = [];

  const hullShape = new THREE.Shape();
  const r = 0.68;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 1.18;
    if (i === 0) hullShape.moveTo(px, py);
    else hullShape.lineTo(px, py);
  }
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.36,
    metalness: 0.65,
  });
  const whiteShellMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.18,
    metalness: 0.15,
  });
  const cyanAccentMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.4,
  });

  const hullMesh = new THREE.Mesh(hullGeo, carbonMat);
  hullMesh.position.y = 0.16;
  root.add(hullMesh);

  const canopyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 16, 12),
    whiteShellMat,
  );
  canopyMesh.scale.set(0.95, 0.42, 1.18);
  canopyMesh.position.y = 0.24;
  root.add(canopyMesh);

  const rtkStalkGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8);
  const rtkCapGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.07, 12);
  for (const side of [-0.26, 0.26]) {
    const stalk = new THREE.Mesh(rtkStalkGeo, carbonMat);
    stalk.position.set(side, 0.42, -0.25);
    const cap = new THREE.Mesh(rtkCapGeo, whiteShellMat);
    cap.position.set(side, 0.56, -0.25);
    root.add(stalk, cap);
  }

  const tankMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.32, 0.76),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.1 }),
  );
  tankMesh.position.set(0, -0.18, -0.05);
  root.add(tankMesh);

  const gimbalHousing = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 14, 14),
    carbonMat,
  );
  gimbalHousing.position.set(0, -0.24, 0.46);
  const lensMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12),
    cyanAccentMat,
  );
  lensMesh.rotation.x = Math.PI / 2.6;
  lensMesh.position.set(0, -0.32, 0.58);
  root.add(gimbalHousing, lensMesh);

  const skidMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.5,
  });
  for (const sx of [-0.52, 0.52]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), skidMat);
    leg.position.set(sx * 0.82, -0.32, 0);
    leg.rotation.z = sx > 0 ? -0.22 : 0.22;
    const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.45, 8), skidMat);
    runner.rotation.x = Math.PI / 2;
    runner.position.set(sx, -0.6, 0);
    root.add(leg, runner);
  }

  const armOffsets = [
    { x: -1.35, z: 1.35, navColor: 0x10b981 },
    { x: 1.35, z: 1.35, navColor: 0x10b981 },
    { x: -1.35, z: -1.35, navColor: 0xf59e0b },
    { x: 1.35, z: -1.35, navColor: 0xf59e0b },
  ];
  const rotorBlurMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.28,
    roughness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.3,
  });

  for (const arm of armOffsets) {
    const length = Math.hypot(arm.x, arm.z);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, length, 8), carbonMat);
    boom.position.set(arm.x * 0.5, 0.1, arm.z * 0.5);
    boom.rotation.z = Math.PI / 2;
    boom.rotation.y = -Math.atan2(arm.z, arm.x);
    root.add(boom);

    const motorPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.2, 12),
      cyanAccentMat,
    );
    motorPod.position.set(arm.x, 0.16, arm.z);
    root.add(motorPod);

    const navLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: arm.navColor }),
    );
    navLed.position.set(arm.x, 0.03, arm.z);
    root.add(navLed);

    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(arm.x, 0.29, arm.z);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.02, 0.11), bladeMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 1.42), bladeMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), rotorBlurMat);
    disc.rotation.x = -Math.PI / 2;
    rotorPivot.add(blade1, blade2, disc);
    root.add(rotorPivot);
    rotors.push(rotorPivot);
  }

  // Unit-height scan cone (apex at 0, base at y = -1) scaled dynamically to ground/structure surface
  const coneGeo = new THREE.ConeGeometry(4.4, 1.0, 20, 1, true);
  coneGeo.translate(0, -0.5, 0);
  const scanBeam = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  root.add(scanBeam);

  const ringGeo = new THREE.RingGeometry(4.8, 5.4, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const scanRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  scanRing.position.y = 0.32;

  root.scale.setScalar(1.22);
  return { root, rotors, scanBeam, scanRing };
}

/**
 * 9-part Autonomous Smart Tractor with tires flush at local y = 0 (zero road sinking/floating)
 */
export function createAutonomousTractorModel(contactShadowTex: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  const greenBodyMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.28,
    metalness: 0.35,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.45,
  });
  const glassCabMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.2,
    depthWrite: false,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.35,
    metalness: 0.4,
  });

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 5.4),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 3.2), chassisMat);
  chassis.position.set(0, 0.72, 0);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.84, 1.58), greenBodyMat);
  hood.position.set(0, 1.32, 0.76);
  group.add(chassis, hood);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.44, 1.24, 1.4), glassCabMat);
  cab.renderOrder = 2;
  cab.position.set(0, 1.88, -0.66);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.15, 1.56), greenBodyMat);
  roof.position.set(0, 2.57, -0.66);
  const rtkDome = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.15, 12), rimMat);
  rtkDome.position.set(0, 2.72, -0.35);
  group.add(cab, roof, rtkDome);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.3, 8), chassisMat);
  exhaust.position.set(0.56, 1.92, 0.44);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (const lx of [-0.4, 0.4]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.07), lightMat);
    hl.position.set(lx, 1.26, 1.58);
    group.add(hl);
  }
  group.add(exhaust);

  const rearWheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.46, 18);
  rearWheelGeo.rotateZ(Math.PI / 2);
  const rearRimGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.49, 14);
  rearRimGeo.rotateZ(Math.PI / 2);
  for (const side of [-0.94, 0.94]) {
    const rw = new THREE.Mesh(rearWheelGeo, tireMat);
    rw.position.set(side, 0.9, -0.8);
    const rr = new THREE.Mesh(rearRimGeo, rimMat);
    rr.position.set(side, 0.9, -0.8);
    group.add(rw, rr);
  }

  const frontWheelGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.34, 16);
  frontWheelGeo.rotateZ(Math.PI / 2);
  const frontRimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.37, 12);
  frontRimGeo.rotateZ(Math.PI / 2);
  for (const side of [-0.84, 0.84]) {
    const fw = new THREE.Mesh(frontWheelGeo, tireMat);
    fw.position.set(side, 0.56, 1.12);
    const fr = new THREE.Mesh(frontRimGeo, rimMat);
    fr.position.set(side, 0.56, 1.12);
    group.add(fw, fr);
  }

  const tillerBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.34, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.42, metalness: 0.35 }),
  );
  tillerBar.position.set(0, 0.5, -2.02);
  group.add(tillerBar);

  group.scale.setScalar(0.68); // Fits cleanly inside 2.0m farm lane with ample margin
  return group;
}

/**
 * 7-part Smart Arched Greenhouse with HollowPerimeter Foundation & Low Substrate Troughs
 * so indoor cherry-tomato vines grow cleanly inside the vault without intersecting walls or glass.
 */
export function createBreedingGreenhouseModel(width = 5.6, length = 15.2): THREE.Group {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.82,
    metalness: 0.1,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.32,
    metalness: 0.78,
  });
  const polyMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.36,
    roughness: 0.14,
    metalness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const troughMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.78,
    metalness: 0.12,
  });

  // 1. Perimeter foundation curb walls (0.42m high)
  const wallThick = 0.24;
  const sideCurbGeo = new THREE.BoxGeometry(wallThick, 0.42, length);
  for (const sx of [-width * 0.5 + wallThick * 0.5, width * 0.5 - wallThick * 0.5]) {
    const curb = new THREE.Mesh(sideCurbGeo, plinthMat);
    curb.position.set(sx, 0.21, 0);
    group.add(curb);
  }
  const endCurbGeo = new THREE.BoxGeometry(width - wallThick * 2, 0.42, wallThick);
  for (const sz of [-length * 0.5 + wallThick * 0.5, length * 0.5 - wallThick * 0.5]) {
    const curb = new THREE.Mesh(endCurbGeo, plinthMat);
    curb.position.set(0, 0.21, sz);
    group.add(curb);
  }

  // 2. Two internal low hydroponic substrate troughs (y = 0..0.22) where tomato vines stand cleanly
  for (const offsetX of [-width * 0.24, width * 0.24]) {
    const trough = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.28, 0.22, length - 1.6),
      troughMat,
    );
    trough.position.set(offsetX, 0.11, 0);
    group.add(trough);
  }

  // 3. Arched Polycarbonate Vault (radius = width * 0.5, offset inside steel ribs to avoid Z-fight)
  const vaultRadius = width * 0.5 - 0.03;
  const vaultGeo = new THREE.CylinderGeometry(
    vaultRadius,
    vaultRadius,
    length,
    18,
    1,
    false,
    0,
    Math.PI,
  );
  vaultGeo.rotateZ(Math.PI / 2);
  vaultGeo.rotateY(Math.PI / 2);
  const vault = new THREE.Mesh(vaultGeo, polyMat);
  vault.position.y = 0.42;
  vault.renderOrder = 3;
  group.add(vault);

  // 4. Exterior Galvanized Steel Arch Ribs (radius = width * 0.5 + 0.04 -> strictly disjoint from vault)
  const ribCount = 5;
  for (let i = 0; i <= ribCount; i++) {
    const z = -length * 0.5 + (i / ribCount) * length;
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(width * 0.5 + 0.04, 0.055, 6, 18, Math.PI),
      ribMat,
    );
    rib.position.set(0, 0.42, z);
    group.add(rib);
  }

  // 5. Front Entrance Door Jambs & Rear Climate Exhaust Fans
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.0, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.4, metalness: 0.4 }),
  );
  doorFrame.position.set(0, 1.0, length * 0.5 + 0.06);
  group.add(doorFrame);

  for (const fx of [-1.2, 1.2]) {
    const fanBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.32), ribMat);
    fanBox.position.set(fx, 1.25, -length * 0.5 - 0.18);
    group.add(fanBox);
  }

  return group;
}

/**
 * 9-part Grain Drying Silo Complex + Smart River Pump Station
 * Sized cleanly inside plot-op (centerX=45, centerZ=-1, width=18, depth=22) with intake pipes reaching river edge
 */
export function createSiloAndPumpComplex(
  corrugatedBump: THREE.Texture,
  contactShadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();

  const siloMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.3,
    metalness: 0.72,
    bumpMap: corrugatedBump,
    bumpScale: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    roughness: 0.42,
    metalness: 0.45,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.85,
    metalness: 0.05,
  });
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.35,
    metalness: 0.55,
  });

  // Base Concrete Pad strictly within plot-op (16.2 x 20.2)
  const pad = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.32, 20.2), concreteMat);
  pad.position.y = 0.16;
  group.add(pad);

  // 3 Tall Corrugated Grain Silos
  const siloPositions = [
    { x: -4.0, z: -5.2 },
    { x: 2.0, z: -5.2 },
    { x: -4.0, z: 1.4 },
  ];
  for (const pos of siloPositions) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(pos.x, 0.34, pos.z);
    group.add(shadow);

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 8.6, 20), siloMat);
    cyl.position.set(pos.x, 4.62, pos.z);
    cyl.castShadow = true;
    cyl.receiveShadow = true;

    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.42, 1.85, 20), roofMat);
    cone.position.set(pos.x, 9.84, pos.z);
    group.add(cyl, cone);
  }

  // Bucket Elevator Tower + Connected Overhead Conveyor Bridges (no floating beams!)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.75, 11.8, 1.75), siloMat);
  tower.position.set(2.0, 6.22, 1.4);
  const bridgeEW = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.62, 0.78), roofMat);
  bridgeEW.position.set(-1.0, 10.6, 1.4);
  const bridgeNS = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 6.8), roofMat);
  bridgeNS.position.set(2.0, 10.6, -1.9);
  group.add(tower, bridgeEW, bridgeNS);

  // Smart Irrigation Pump House + Blue Intake Manifold Pipes
  const pumpHouse = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 3.4, 4.4),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7, metalness: 0.1 }),
  );
  pumpHouse.position.set(3.2, 2.02, 7.2);
  const pumpRoof = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.36, 4.8), roofMat);
  pumpRoof.position.set(3.2, 3.9, 7.2);
  group.add(pumpHouse, pumpRoof);

  for (const pz of [6.2, 8.2]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 11.5, 12), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(12.2, 0.85, pz);
    group.add(pipe);
  }

  return group;
}

export interface IoTStationHandles {
  root: THREE.Group;
  lod: THREE.LOD;
  collider: THREE.Mesh;
  spinner?: THREE.Object3D;
  beaconRing: THREE.Mesh;
}

/**
 * Category-specific composite 3D IoT Field Station wrapped in a 3-tier THREE.LOD (0m / 72m / 132m)
 * Grounded flush at groundHeightAt(device.x, device.z) with zero floating pedestals.
 */
export function createIoTStationModel(
  device: IoTDeviceNode,
  ledTexture: THREE.Texture,
): IoTStationHandles {
  const root = new THREE.Group();
  root.position.set(device.x, groundHeightAt(device.x, device.z), device.z);

  const meta = DEVICE_CATEGORIES.find((m) => m.key === device.category)!;
  const accentColor = new THREE.Color(meta.colorHex);

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.32,
    metalness: 0.72,
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.2,
    metalness: 0.65,
  });
  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.45,
    metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.3,
    metalness: 0.35,
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });

  // Tier 0: Full Multi-Part High-Detail Station
  const highGroup = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.32, 10), baseMat);
  base.position.y = 0.16;
  highGroup.add(base);

  let spinner: THREE.Object3D | undefined;
  let approxHeight = 3.6;

  if (device.category === 'weather') {
    approxHeight = 4.6;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), poleMat);
    mast.position.y = 2.26;
    const solar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.62), solarMat);
    solar.position.set(0, 2.7, 0.34);
    solar.rotation.x = 0.45;
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.46, 12), cabinetMat);
    shield.position.set(0.34, 3.4, 0);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.07, 0.07), poleMat);
    crossbar.position.set(0, 4.32, 0);

    const cupGroup = new THREE.Group();
    cupGroup.position.set(-0.46, 4.46, 0);
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), poleMat);
      arm.rotation.y = a;
      arm.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), accentMat);
      cup.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
      cupGroup.add(arm, cup);
    }
    spinner = cupGroup;
    highGroup.add(mast, solar, shield, crossbar, cupGroup);
  } else if (device.category === 'pest_lamp') {
    approxHeight = 4.1;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 8), poleMat);
    mast.position.y = 2.06;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.08), poleMat);
    arm.position.set(0.36, 3.72, 0);
    const uvLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: device.status === 'offline' ? 0x000000 : 0x7e22ce,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      }),
    );
    uvLamp.position.set(0.68, 3.28, 0);
    const funnel = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }),
    );
    funnel.rotation.x = Math.PI;
    funnel.position.set(0.68, 2.76, 0);
    const solar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.72), solarMat);
    solar.position.set(0, 4.08, 0);
    solar.rotation.x = 0.4;
    highGroup.add(mast, arm, uvLamp, funnel, solar);
  } else if (device.category === 'led_screen') {
    approxHeight = 3.9;
    for (const px of [-1.15, 1.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.5, 8), poleMat);
      post.position.set(px, 1.9, 0);
      highGroup.add(post);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.95, 1.65, 0.24), poleMat);
    frame.position.set(0, 2.98, 0);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.72, 1.4),
      new THREE.MeshBasicMaterial({ map: ledTexture }),
    );
    screen.position.set(0, 2.98, 0.13);
    highGroup.add(frame, screen);
  } else if (device.category === 'base_station') {
    approxHeight = 7.2;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 6.6, 6), poleMat);
    tower.position.y = 3.46;
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2;
      const sector = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.08, 0.12), cabinetMat);
      sector.position.set(Math.cos(a) * 0.36, 6.1, Math.sin(a) * 0.36);
      sector.rotation.y = -a + Math.PI / 2;
      highGroup.add(sector);
    }
    const rtkTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), accentMat);
    rtkTop.position.y = 6.95;
    highGroup.add(tower, rtkTop);
  } else if (
    device.category === 'water_valve' ||
    device.category === 'butterfly_valve' ||
    device.category === 'controller'
  ) {
    approxHeight = 1.9;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 10), accentMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.y = 0.72;
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.28, 0.56), cabinetMat);
    cabinet.position.set(0, 0.96, -0.32);
    const actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.34, 10), poleMat);
    actuator.position.set(0, 1.08, 0);
    highGroup.add(pipe, cabinet, actuator);
  } else {
    approxHeight = 3.6;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8), poleMat);
    mast.position.y = 1.76;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.34), cabinetMat);
    box.position.set(0, 1.86, 0.18);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), accentMat);
    head.position.set(0, 3.48, 0.16);
    const solar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.54), solarMat);
    solar.position.set(0, 3.1, -0.22);
    solar.rotation.x = 0.42;
    highGroup.add(mast, box, head, solar);
  }

  // Tier 1 (Mid distance >= 72m): 2-mesh silhouette proxy
  const midGroup = new THREE.Group();
  const midMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, approxHeight * 0.9, 6),
    poleMat,
  );
  midMast.position.y = approxHeight * 0.45;
  const midCap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.56), accentMat);
  midCap.position.y = approxHeight * 0.88;
  midGroup.add(midMast, midCap);

  // Tier 2 (Far distance >= 132m): 1-mesh low-poly beacon post
  const farGroup = new THREE.Group();
  const farPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, approxHeight * 0.88, 4),
    accentMat,
  );
  farPost.position.y = approxHeight * 0.44;
  farGroup.add(farPost);

  const lod = new THREE.LOD();
  lod.addLevel(highGroup, 0);
  lod.addLevel(midGroup, 72);
  lod.addLevel(farGroup, 132);
  root.add(lod);

  // Disjoint ground status ring (y = 0.035 + polygonOffset so zero Z-fight)
  const statusColor =
    device.status === 'online'
      ? meta.colorHex
      : device.status === 'warning'
        ? '#f59e0b'
        : '#ef4444';
  const ringGeo = new THREE.RingGeometry(0.62, 0.88, 22);
  ringGeo.rotateX(-Math.PI / 2);
  const beaconRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: statusColor,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  beaconRing.position.y = 0.035;
  root.add(beaconRing);

  const collider = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.55, Math.max(4.8, approxHeight), 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.position.y = Math.max(2.4, approxHeight * 0.5);
  collider.layers.set(1);
  collider.userData = { kind: 'device', deviceId: device.id };
  root.add(collider);

  return { root, lod, collider, spinner, beaconRing };
}
