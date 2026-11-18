import * as THREE from 'three';

export interface ProceduralTexturePack {
  terrainGrass: THREE.DataTexture;
  paddyRow: THREE.DataTexture;
  asphaltRoad: THREE.DataTexture;
  siloCorrugatedBump: THREE.DataTexture;
  contactShadow: THREE.DataTexture;
  ledScreenTex: THREE.CanvasTexture;
  textureMemoryKb: number;
  disposeAll: () => void;
}

function hashByte(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) & 255;
}

/**
 * Generates compact power-of-2 Uint8Array DataTextures with mipmap chains and adaptive mobile sizing
 * to minimize GPU VRAM bandwidth while preserving crisp grazing-angle detail via anisotropy.
 */
export function createProceduralTextures(
  maxAnisotropy: number,
  isMobileTier = false,
): ProceduralTexturePack {
  const baseDim = isMobileTier ? 128 : 256;
  const subDim = isMobileTier ? 64 : 128;
  let totalBytes = 0;

  // 1. Countryside meadow & soil micro-relief DataTexture (RGBA8)
  const grassData = new Uint8Array(baseDim * baseDim * 4);
  for (let y = 0; y < baseDim; y++) {
    for (let x = 0; x < baseDim; x++) {
      const idx = (y * baseDim + x) * 4;
      const n = hashByte(x >> 1, y >> 1, 11);
      const fine = hashByte(x, y, 29);
      const delta = ((n - 128) * 0.14 + (fine - 128) * 0.06) | 0;
      grassData[idx] = Math.max(36, Math.min(96, 62 + delta));
      grassData[idx + 1] = Math.max(64, Math.min(132, 94 + delta));
      grassData[idx + 2] = Math.max(34, Math.min(88, 56 + delta));
      grassData[idx + 3] = 255;
    }
  }
  const terrainGrass = new THREE.DataTexture(grassData, baseDim, baseDim, THREE.RGBAFormat);
  terrainGrass.colorSpace = THREE.SRGBColorSpace;
  terrainGrass.wrapS = THREE.RepeatWrapping;
  terrainGrass.wrapT = THREE.RepeatWrapping;
  terrainGrass.repeat.set(28, 28);
  terrainGrass.generateMipmaps = true;
  terrainGrass.minFilter = THREE.LinearMipmapLinearFilter;
  terrainGrass.magFilter = THREE.LinearFilter;
  terrainGrass.anisotropy = maxAnisotropy;
  terrainGrass.needsUpdate = true;
  totalBytes += Math.round(grassData.byteLength * 1.33);

  // 2. Planted furrow soil/paddy DataTexture
  const paddyData = new Uint8Array(subDim * subDim * 4);
  const period = Math.max(6, subDim >> 4);
  for (let y = 0; y < subDim; y++) {
    const rowMod = y % period;
    const isFurrow = rowMod < Math.max(2, period >> 2);
    for (let x = 0; x < subDim; x++) {
      const idx = (y * subDim + x) * 4;
      const grain = ((hashByte(x, y, 53) - 128) * 0.08) | 0;
      paddyData[idx] = (isFurrow ? 34 : 52) + grain;
      paddyData[idx + 1] = (isFurrow ? 58 : 82) + grain;
      paddyData[idx + 2] = (isFurrow ? 46 : 64) + grain;
      paddyData[idx + 3] = 255;
    }
  }
  const paddyRow = new THREE.DataTexture(paddyData, subDim, subDim, THREE.RGBAFormat);
  paddyRow.colorSpace = THREE.SRGBColorSpace;
  paddyRow.wrapS = THREE.RepeatWrapping;
  paddyRow.wrapT = THREE.RepeatWrapping;
  paddyRow.repeat.set(6, 6);
  paddyRow.generateMipmaps = true;
  paddyRow.minFilter = THREE.LinearMipmapLinearFilter;
  paddyRow.magFilter = THREE.LinearFilter;
  paddyRow.anisotropy = maxAnisotropy;
  paddyRow.needsUpdate = true;
  totalBytes += Math.round(paddyData.byteLength * 1.33);

  // 3. Rural asphalt road DataTexture with crisp shoulders & dashed center line
  const roadW = baseDim;
  const roadH = subDim;
  const roadData = new Uint8Array(roadW * roadH * 4);
  for (let y = 0; y < roadH; y++) {
    const vNorm = y / roadH;
    const isShoulder = (vNorm > 0.06 && vNorm < 0.1) || (vNorm > 0.9 && vNorm < 0.94);
    const isCenterBand = vNorm > 0.48 && vNorm < 0.52;
    for (let x = 0; x < roadW; x++) {
      const idx = (y * roadW + x) * 4;
      const dashOn = isCenterBand && x % Math.max(16, roadW >> 3) < Math.max(9, roadW >> 4);
      const speckle = ((hashByte(x, y, 71) - 128) * 0.06) | 0;
      if (dashOn) {
        roadData[idx] = 234;
        roadData[idx + 1] = 179;
        roadData[idx + 2] = 8;
      } else if (isShoulder) {
        roadData[idx] = 203;
        roadData[idx + 1] = 213;
        roadData[idx + 2] = 225;
      } else {
        roadData[idx] = 52 + speckle;
        roadData[idx + 1] = 58 + speckle;
        roadData[idx + 2] = 68 + speckle;
      }
      roadData[idx + 3] = 255;
    }
  }
  const asphaltRoad = new THREE.DataTexture(roadData, roadW, roadH, THREE.RGBAFormat);
  asphaltRoad.colorSpace = THREE.SRGBColorSpace;
  asphaltRoad.wrapS = THREE.RepeatWrapping;
  asphaltRoad.wrapT = THREE.ClampToEdgeWrapping;
  asphaltRoad.repeat.set(18, 1);
  asphaltRoad.generateMipmaps = true;
  asphaltRoad.minFilter = THREE.LinearMipmapLinearFilter;
  asphaltRoad.magFilter = THREE.LinearFilter;
  asphaltRoad.anisotropy = maxAnisotropy;
  asphaltRoad.needsUpdate = true;
  totalBytes += Math.round(roadData.byteLength * 1.33);

  // 4. Linear grayscale corrugated bump DataTexture for grain silos (Linear NoColorSpace)
  const bumpW = 64;
  const bumpH = 128;
  const bumpData = new Uint8Array(bumpW * bumpH * 4);
  for (let y = 0; y < bumpH; y++) {
    const val = y % 4 < 2 ? 214 : 84;
    for (let x = 0; x < bumpW; x++) {
      const idx = (y * bumpW + x) * 4;
      bumpData[idx] = val;
      bumpData[idx + 1] = val;
      bumpData[idx + 2] = val;
      bumpData[idx + 3] = 255;
    }
  }
  const siloCorrugatedBump = new THREE.DataTexture(bumpData, bumpW, bumpH, THREE.RGBAFormat);
  siloCorrugatedBump.wrapS = THREE.RepeatWrapping;
  siloCorrugatedBump.wrapT = THREE.RepeatWrapping;
  siloCorrugatedBump.repeat.set(4, 6);
  siloCorrugatedBump.generateMipmaps = true;
  siloCorrugatedBump.minFilter = THREE.LinearMipmapLinearFilter;
  siloCorrugatedBump.needsUpdate = true;
  totalBytes += Math.round(bumpData.byteLength * 1.33);

  // 5. Soft radial contact shadow DataTexture
  const shDim = 64;
  const shData = new Uint8Array(shDim * shDim * 4);
  const half = shDim * 0.5;
  for (let y = 0; y < shDim; y++) {
    for (let x = 0; x < shDim; x++) {
      const idx = (y * shDim + x) * 4;
      const d = Math.min(1, Math.hypot(x + 0.5 - half, y + 0.5 - half) / half);
      const alpha = Math.round(Math.pow(1 - d, 1.85) * 148);
      shData[idx] = 5;
      shData[idx + 1] = 16;
      shData[idx + 2] = 14;
      shData[idx + 3] = alpha;
    }
  }
  const contactShadow = new THREE.DataTexture(shData, shDim, shDim, THREE.RGBAFormat);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.generateMipmaps = false;
  contactShadow.minFilter = THREE.LinearFilter;
  contactShadow.magFilter = THREE.LinearFilter;
  contactShadow.needsUpdate = true;
  totalBytes += shData.byteLength;

  // 6. Field LED Matrix Screen Texture (Chinese telemetry banner)
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 256;
  ledCanvas.height = 128;
  const lCtx = ledCanvas.getContext('2d')!;
  lCtx.fillStyle = '#091412';
  lCtx.fillRect(0, 0, 256, 128);
  lCtx.strokeStyle = '#10b981';
  lCtx.lineWidth = 4;
  lCtx.strokeRect(4, 4, 248, 120);
  lCtx.fillStyle = '#34d399';
  lCtx.font = 'bold 21px sans-serif';
  lCtx.fillText('芜湖大米东八核心示范区', 14, 40);
  lCtx.fillStyle = '#fbbf24';
  lCtx.font = 'bold 19px monospace';
  lCtx.fillText('实时气温 19.6°C  湿度 68%', 14, 76);
  lCtx.fillStyle = '#38bdf8';
  lCtx.fillText('多品种长势优良 · 灌溉正常', 14, 108);
  const ledScreenTex = new THREE.CanvasTexture(ledCanvas);
  ledScreenTex.colorSpace = THREE.SRGBColorSpace;
  ledScreenTex.anisotropy = maxAnisotropy;
  totalBytes += Math.round(256 * 128 * 4 * 1.33);

  return {
    terrainGrass,
    paddyRow,
    asphaltRoad,
    siloCorrugatedBump,
    contactShadow,
    ledScreenTex,
    textureMemoryKb: Math.round(totalBytes / 1024),
    disposeAll: () => {
      terrainGrass.dispose();
      paddyRow.dispose();
      asphaltRoad.dispose();
      siloCorrugatedBump.dispose();
      contactShadow.dispose();
      ledScreenTex.dispose();
    },
  };
}
