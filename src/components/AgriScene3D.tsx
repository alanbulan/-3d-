import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEVICE_CATEGORIES, stepDroneKinematics } from '../simulation/agriSimEngine';
import {
  SCENE_BOUNDARY_VERTICES,
  groundHeightAt,
  sceneXZToLngLat,
} from '../simulation/geoProjection';
import {
  RIVER_HALF_WIDTH,
  SCENE_CORRIDORS,
  SOLID_OBSTACLE_BOXES,
  generateCollisionFreeTrees,
  getStructureClearanceY,
  resolveCameraAntiClip,
  riverCenterXAtZ,
} from '../simulation/spatialClearance';
import {
  createAgriDroneModel,
  createAutonomousTractorModel,
  createBreedingGreenhouseModel,
  createCropGeometryLibrary,
  createIoTStationModel,
  createMergedStaticEnvironmentBatches,
  createSiloAndPumpComplex,
  IoTStationHandles,
} from '../three/models';
import { createProceduralTextures } from '../three/proceduralTextures';
import {
  AgriPlot,
  CameraViewMode,
  CropGrowthMap,
  CropGrowthSnapshot,
  DeviceCategoryKey,
  DroneFlightMode,
  DroneTelemetryState,
  IoTDeviceNode,
  LightingPreset,
  ScenePerformanceStats,
  SimCropKey,
  SurfaceOverlayMode,
} from '../types/agri';

interface AgriScene3DProps {
  plots: AgriPlot[];
  devices: IoTDeviceNode[];
  visibleCategories: Set<DeviceCategoryKey>;
  growthMap: CropGrowthMap;
  cameraMode: CameraViewMode;
  droneFlightMode: DroneFlightMode;
  droneTargetOverride: { x: number; z: number; label: string; nonce: number } | null;
  surfaceOverlay: SurfaceOverlayMode;
  lightingPreset: LightingPreset;
  selectedPlotId: string | null;
  selectedDeviceId: string | null;
  manualControlInput: { forward: number; right: number; up: number };
  onSelectPlot: (plotId: string) => void;
  onSelectDevice: (deviceId: string) => void;
  onDroneTelemetry: (telemetry: DroneTelemetryState) => void;
  onPerformanceStats?: (stats: ScenePerformanceStats) => void;
  onCameraUserOverride: () => void;
}

// Reusable scratch math objects outside render loop (Zero GC)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _organColor = new THREE.Color();
const _seedColor = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _ray = new THREE.Ray();
const _rayDir = new THREE.Vector3();
const _boxHit = new THREE.Vector3();

interface PlantRecord {
  x: number;
  yBase: number;
  z: number;
  rotY: number;
  jitterScale: number;
  tintShade: number;
  maxHeightCap?: number;
}

interface PlotCropChunk {
  plotId: string;
  cropType: SimCropKey;
  center: THREE.Vector3;
  boundingSphere: THREE.Sphere;
  records: PlantRecord[];
  seedMesh: THREE.InstancedMesh;
  foliageHighMesh: THREE.InstancedMesh;
  foliageLowMesh: THREE.InstancedMesh;
  organMesh: THREE.InstancedMesh;
  lastAppliedKey: string;
}

export const AgriScene3D: React.FC<AgriScene3DProps> = ({
  plots,
  devices,
  visibleCategories,
  growthMap,
  cameraMode,
  droneFlightMode,
  droneTargetOverride,
  surfaceOverlay,
  lightingPreset,
  selectedPlotId,
  selectedDeviceId,
  manualControlInput,
  onSelectPlot,
  onSelectDevice,
  onDroneTelemetry,
  onPerformanceStats,
  onCameraUserOverride,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  const latestRef = useRef({
    plots,
    devices,
    visibleCategories,
    growthMap,
    cameraMode,
    droneFlightMode,
    droneTargetOverride,
    surfaceOverlay,
    lightingPreset,
    selectedPlotId,
    selectedDeviceId,
    manualControlInput,
    onSelectPlot,
    onSelectDevice,
    onDroneTelemetry,
    onPerformanceStats,
    onCameraUserOverride,
  });

  useEffect(() => {
    latestRef.current = {
      plots,
      devices,
      visibleCategories,
      growthMap,
      cameraMode,
      droneFlightMode,
      droneTargetOverride,
      surfaceOverlay,
      lightingPreset,
      selectedPlotId,
      selectedDeviceId,
      manualControlInput,
      onSelectPlot,
      onSelectDevice,
      onDroneTelemetry,
      onPerformanceStats,
      onCameraUserOverride,
    };
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL probe (SwiftShader / llvmpipe / headless browser guard)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const isMobileViewport = window.innerWidth < 860;
    const qualityTier: ScenePerformanceStats['qualityTier'] = isMobileViewport
      ? 'mobile_eco'
      : isSoftwareGl
        ? 'balanced'
        : 'high';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl && !isMobileViewport,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobileViewport ? 1.5 : 2),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl && !isMobileViewport;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.setAttribute('data-testid', 'agri-webgl-canvas');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // 2. Scene, Sky/Fog & Studio PBR Environment Map
    const scene = new THREE.Scene();
    const daySkyColor = new THREE.Color(0xa7d3cb);
    const duskSkyColor = new THREE.Color(0x133036);
    scene.background = daySkyColor.clone();
    const sceneFog = new THREE.Fog(daySkyColor.getHex(), 140, 330);
    scene.fog = sceneFog;

    let envRT: THREE.WebGLRenderTarget | null = null;
    if (!isSoftwareGl && !isMobileViewport) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      pmremGenerator.dispose();
    }

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.6, 520);
    camera.position.set(-12, 52, 74);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.14;
    controls.minDistance = 15;
    controls.maxDistance = 195;
    controls.target.set(-4, 0, 2);
    controls.update();

    let cameraFocusGoal: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
    controls.addEventListener('start', () => {
      cameraFocusGoal = null;
      if (latestRef.current.cameraMode === CameraViewMode.PlotFocus) {
        latestRef.current.onCameraUserOverride();
      }
    });

    // 4. Balanced 3-Point Warm/Cool Outdoor Lighting
    const hemiLight = new THREE.HemisphereLight(0xbbe6ff, 0x385237, 0.92);
    hemiLight.position.set(0, 80, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d0, 2.25);
    sunLight.position.set(68, 96, 54);
    sunLight.castShadow = !isSoftwareGl && !isMobileViewport;
    sunLight.shadow.mapSize.set(1024, 1024);
    const shadowBound = 92;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x67e8f9, 0.45);
    rimLight.position.set(-60, 42, -55);
    scene.add(rimLight);

    // 5. Compressed Procedural DataTextures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso, isMobileViewport);

    // 6. Geographically Sculpted Outer Terrain (flat polder y=0 + carved Qingyi riverbed)
    const terrainGeo = new THREE.PlaneGeometry(390, 340, 84, 72);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i);
      const vz = tPos.getZ(i);
      tPos.setY(i, groundHeightAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const outerGround = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.terrainGrass,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    // Animated Water Material via onBeforeCompile
    const waterUniforms = { uTime: { value: 0 } };
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.14,
      metalness: 0.42,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          transformed.z += sin(position.x * 0.45 + uTime * 2.1) * 0.025 + cos(position.y * 0.35 + uTime * 1.6) * 0.02;
          `,
        );
    };

    // Eastern Qingyi Tributary River Water sitting cleanly inside carved riverbed (y = -0.16, zero Z-fight)
    const riverWaterGeo = new THREE.PlaneGeometry(RIVER_HALF_WIDTH * 2, 160, 8, 28);
    riverWaterGeo.rotateX(-Math.PI / 2);
    const rwPos = riverWaterGeo.attributes.position;
    for (let i = 0; i < rwPos.count; i++) {
      const lx = rwPos.getX(i);
      const lz = rwPos.getZ(i);
      rwPos.setX(i, riverCenterXAtZ(lz) + lx);
      rwPos.setY(i, -0.16);
    }
    riverWaterGeo.computeVertexNormals();
    const riverWater = new THREE.Mesh(riverWaterGeo, waterMat);
    scene.add(riverWater);

    // Non-overlapping Asphalt Roads & Irrigation Canals from SCENE_CORRIDORS
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.asphaltRoad,
      roughness: 0.78,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    for (const cor of SCENE_CORRIDORS) {
      if (cor.kind === 'canal') {
        const canalBed = new THREE.Mesh(
          new THREE.BoxGeometry(cor.width, 0.08, cor.depth + 0.28),
          new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 }),
        );
        canalBed.position.set(cor.centerX, 0.02, cor.centerZ);
        const canalWater = new THREE.Mesh(
          new THREE.PlaneGeometry(cor.width - 0.2, cor.depth, 12, 1),
          waterMat,
        );
        canalWater.rotation.x = -Math.PI / 2;
        canalWater.position.set(cor.centerX, 0.075, cor.centerZ);
        scene.add(canalBed, canalWater);
      } else {
        const roadGeo = new THREE.PlaneGeometry(
          cor.orientation === 'horizontal' ? cor.width : cor.depth,
          cor.orientation === 'horizontal' ? cor.depth : cor.width,
        );
        roadGeo.rotateX(-Math.PI / 2);
        if (cor.orientation === 'vertical') {
          roadGeo.rotateY(Math.PI / 2);
        }
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        // Vertical spine sits 0.008m below horizontal crossings to eliminate intersection Z-fighting
        roadMesh.position.set(
          cor.centerX,
          cor.orientation === 'horizontal' ? 0.068 : 0.06,
          cor.centerZ,
        );
        roadMesh.receiveShadow = true;
        scene.add(roadMesh);
      }
    }

    // Exact User Real WGS84 Polygon Boundary Line (`SCENE_BOUNDARY_VERTICES`)
    const boundaryPts = SCENE_BOUNDARY_VERTICES.map(
      (v) => new THREE.Vector3(v.x, Math.max(0.32, groundHeightAt(v.x, v.z) + 0.32), v.z),
    );
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPts);
    const boundaryLine = new THREE.Line(
      boundaryGeo,
      new THREE.LineBasicMaterial({ color: 0x2dd4bf }),
    );
    scene.add(boundaryLine);

    // Subtle Survey Corner Beacons at the 5 real WGS84 polygon vertices
    const cornerBeaconGeo = new THREE.CylinderGeometry(0.28, 0.36, 1.4, 8);
    const cornerBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    for (let i = 0; i < SCENE_BOUNDARY_VERTICES.length - 1; i++) {
      const v = SCENE_BOUNDARY_VERTICES[i];
      const beacon = new THREE.Mesh(cornerBeaconGeo, cornerBeaconMat);
      beacon.position.set(v.x, groundHeightAt(v.x, v.z) + 0.7, v.z);
      scene.add(beacon);
    }

    // 7. Merged Static Environment Batches (Ridges, Embankments, Girder Bridges, Village Houses)
    const mergedBatches = createMergedStaticEnvironmentBatches(latestRef.current.plots);
    scene.add(mergedBatches.group);

    // 8. Interactive Plot Beds + Spatial Per-Plot Multi-Crop LOD InstancedMesh Chunks
    const plotMeshes: Record<
      string,
      { bed: THREE.Mesh; mat: THREE.MeshStandardMaterial; border: THREE.LineLoop }
    > = {};
    const interactables: THREE.Object3D[] = [];
    const cropGeoLib = createCropGeometryLibrary();

    const windUniforms = { uWindTime: { value: 0 } };
    const makeWindCropMaterial = (roughness: number) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = windUniforms.uWindTime;
        shader.vertexShader =
          `uniform float uWindTime;\n` +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            #ifdef USE_INSTANCING
              vec3 instWorld = instanceMatrix[3].xyz;
              float breeze = sin(uWindTime * 2.1 + instWorld.x * 0.17 + instWorld.z * 0.14) * 0.1;
              transformed.x += breeze * transformed.y * transformed.y;
              transformed.z += cos(uWindTime * 1.6 + instWorld.z * 0.19) * 0.05 * transformed.y * transformed.y;
            #endif
            `,
          );
      };
      return mat;
    };

    const foliageMat = makeWindCropMaterial(0.62);
    const organMat = makeWindCropMaterial(0.45);
    const seedBedMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
    });

    const cropChunks: PlotCropChunk[] = [];
    const densityStepScale = isMobileViewport ? 1.24 : 1.0;

    for (const plot of latestRef.current.plots) {
      const matParams: THREE.MeshStandardMaterialParameters = {
        color:
          plot.cropType === 'rice'
            ? 0x2b5845
            : plot.cropType === 'corn'
              ? 0x435838
              : plot.cropType === 'tomato'
                ? plot.id === 'plot-gh'
                  ? 0x64748b
                  : 0x4e4237
                : plot.cropType === 'wheat'
                  ? 0x4b603b
                  : 0x475569,
        roughness: plot.cropType === 'rice' ? 0.28 : 0.78,
        metalness: plot.cropType === 'rice' ? 0.22 : 0.05,
      };
      if (plot.cropType !== 'facility' && plot.id !== 'plot-gh') {
        matParams.map = textures.paddyRow;
      }
      const bedMat = new THREE.MeshStandardMaterial(matParams);

      const bed = new THREE.Mesh(new THREE.PlaneGeometry(plot.width, plot.depth), bedMat);
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(plot.centerX, 0.042, plot.centerZ);
      bed.receiveShadow = true;
      bed.layers.enable(1);
      bed.userData = { kind: 'plot', plotId: plot.id };
      scene.add(bed);
      interactables.push(bed);

      const hw = plot.width * 0.5 + 0.2;
      const hd = plot.depth * 0.5 + 0.2;
      const outlineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hw, 0.34, -hd),
        new THREE.Vector3(hw, 0.34, -hd),
        new THREE.Vector3(hw, 0.34, hd),
        new THREE.Vector3(-hw, 0.34, hd),
      ]);
      const border = new THREE.LineLoop(
        outlineGeo,
        new THREE.LineBasicMaterial({ color: 0x34d399 }),
      );
      border.position.set(plot.centerX, 0, plot.centerZ);
      border.visible = false;
      scene.add(border);

      plotMeshes[plot.id] = { bed, mat: bedMat, border };

      // Build spatial crop chunk for planted plots
      if (plot.cropType !== 'facility') {
        const cropKey: SimCropKey = plot.cropType;
        const records: PlantRecord[] = [];
        let idxSeed = 17 + plot.centerX * 31;

        if (plot.id === 'plot-gh') {
          // Strictly inside the 3 greenhouse substrate troughs (zero wall/arch clipping!)
          const ghCentersX = [34.1, 41.0, 47.9];
          for (const gx of ghCentersX) {
            for (const troughDx of [-1.34, 1.34]) {
              for (let pz = plot.centerZ - 6.4; pz <= plot.centerZ + 6.4; pz += 1.65) {
                idxSeed = (Math.abs(idxSeed) * 16807) % 2147483647;
                const r1 = (idxSeed % 1000) / 1000;
                records.push({
                  x: gx + troughDx,
                  yBase: 0.24,
                  z: pz,
                  rotY: r1 * Math.PI * 2,
                  jitterScale: 0.9 + r1 * 0.15,
                  tintShade: 0.92 + r1 * 0.14,
                  maxHeightCap: 1.55,
                });
              }
            }
          }
        } else {
          const spacingX =
            (cropKey === 'corn' ? 2.15 : cropKey === 'tomato' ? 2.05 : 1.72) * densityStepScale;
          const spacingZ =
            (cropKey === 'corn' ? 1.95 : cropKey === 'tomato' ? 1.9 : 1.62) * densityStepScale;
          const margin = 1.45;
          for (
            let px = plot.centerX - plot.width * 0.5 + margin;
            px <= plot.centerX + plot.width * 0.5 - margin;
            px += spacingX
          ) {
            for (
              let pz = plot.centerZ - plot.depth * 0.5 + margin;
              pz <= plot.centerZ + plot.depth * 0.5 - margin;
              pz += spacingZ
            ) {
              idxSeed = (Math.abs(idxSeed) * 16807) % 2147483647;
              const r1 = (idxSeed % 1000) / 1000;
              const r2 = ((idxSeed >> 5) % 1000) / 1000;
              const jitterAmp = cropKey === 'tomato' || cropKey === 'corn' ? 0.12 : 0.28;
              records.push({
                x: px + (r1 - 0.5) * jitterAmp,
                yBase: 0.046,
                z: pz + (r2 - 0.5) * jitterAmp,
                rotY: r1 * Math.PI * 2,
                jitterScale: 0.9 + r2 * 0.24,
                tintShade: 0.91 + r1 * 0.17,
              });
            }
          }
        }

        const count = records.length;
        const makeInstMesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
          const im = new THREE.InstancedMesh(geo, mat, count);
          im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
          im.frustumCulled = false; // Managed explicitly per-chunk with tight sphere + occluder culling
          im.receiveShadow = true;
          scene.add(im);
          return im;
        };

        const seedMesh = makeInstMesh(cropGeoLib.seedMound, seedBedMat);
        const foliageHighMesh = makeInstMesh(cropGeoLib.foliageHigh[cropKey], foliageMat);
        const foliageLowMesh = makeInstMesh(cropGeoLib.foliageLow[cropKey], foliageMat);
        const organMesh = makeInstMesh(cropGeoLib.reproductive[cropKey], organMat);

        const chunkCenter = new THREE.Vector3(plot.centerX, 1.2, plot.centerZ);
        const radius = Math.hypot(plot.width * 0.5, plot.depth * 0.5) + 2.5;

        cropChunks.push({
          plotId: plot.id,
          cropType: cropKey,
          center: chunkCenter,
          boundingSphere: new THREE.Sphere(chunkCenter, radius),
          records,
          seedMesh,
          foliageHighMesh,
          foliageLowMesh,
          organMesh,
          lastAppliedKey: '',
        });
      }
    }

    const applyChunkGrowthTransforms = (chunk: PlotCropChunk, snap: CropGrowthSnapshot) => {
      _color.set(snap.colorHex);
      _organColor.set(snap.organColorHex);
      _seedColor.set('#7c5e3c');

      const showSeed = snap.seedMoundScale > 0.02;
      const showFoliage = snap.stageIndex >= 1;
      const showOrgan = snap.reproductiveScale > 0.03;

      for (let i = 0; i < chunk.records.length; i++) {
        const rec = chunk.records[i];

        // 1. Seed Mound Matrix
        if (showSeed) {
          _dummy.position.set(rec.x, rec.yBase, rec.z);
          _dummy.rotation.set(0, rec.rotY, 0);
          const sm = snap.seedMoundScale * rec.jitterScale;
          _dummy.scale.set(sm, sm, sm);
          _dummy.updateMatrix();
          chunk.seedMesh.setMatrixAt(i, _dummy.matrix);
          chunk.seedMesh.setColorAt(i, _seedColor);
        }

        // 2. Vegetative Foliage (shared transform written to both High & Low LOD meshes)
        let sY = snap.stalkScaleY * rec.jitterScale * 1.32;
        if (rec.maxHeightCap !== undefined) {
          sY = Math.min(sY, rec.maxHeightCap);
        }
        const sXZ = snap.canopyDensityScale * rec.jitterScale * 1.12;

        if (showFoliage) {
          _dummy.position.set(rec.x, rec.yBase, rec.z);
          _dummy.rotation.set(0, rec.rotY, 0);
          _dummy.scale.set(sXZ, sY, sXZ);
          _dummy.updateMatrix();
          chunk.foliageHighMesh.setMatrixAt(i, _dummy.matrix);
          chunk.foliageLowMesh.setMatrixAt(i, _dummy.matrix);

          const c = _targetCamPos.set(
            _color.r * rec.tintShade,
            _color.g * rec.tintShade,
            _color.b * rec.tintShade,
          );
          const tmpCol = new THREE.Color(c.x, c.y, c.z);
          chunk.foliageHighMesh.setColorAt(i, tmpCol);
          chunk.foliageLowMesh.setColorAt(i, tmpCol);
        }

        // 3. Reproductive Organs (Panicles / Corn Ears & Tassels / Tomato Blossoms & Fruit Trusses)
        if (showOrgan) {
          _dummy.position.set(rec.x, rec.yBase, rec.z);
          _dummy.rotation.set(0, rec.rotY, 0);
          const oXZ = sXZ * (0.72 + snap.reproductiveScale * 0.36);
          const oY = sY * Math.min(1.04, 0.78 + snap.reproductiveScale * 0.24);
          _dummy.scale.set(oXZ, oY, oXZ);
          _dummy.updateMatrix();
          chunk.organMesh.setMatrixAt(i, _dummy.matrix);
          chunk.organMesh.setColorAt(i, _organColor);
        }
      }

      chunk.seedMesh.instanceMatrix.needsUpdate = true;
      if (chunk.seedMesh.instanceColor) chunk.seedMesh.instanceColor.needsUpdate = true;
      chunk.foliageHighMesh.instanceMatrix.needsUpdate = true;
      chunk.foliageLowMesh.instanceMatrix.needsUpdate = true;
      if (chunk.foliageHighMesh.instanceColor) chunk.foliageHighMesh.instanceColor.needsUpdate = true;
      if (chunk.foliageLowMesh.instanceColor) chunk.foliageLowMesh.instanceColor.needsUpdate = true;
      chunk.organMesh.instanceMatrix.needsUpdate = true;
      if (chunk.organMesh.instanceColor) chunk.organMesh.instanceColor.needsUpdate = true;
    };

    for (const chunk of cropChunks) {
      const snap = latestRef.current.growthMap[chunk.cropType];
      chunk.lastAppliedKey = `${snap.day}:${snap.colorHex}:${snap.organColorHex}`;
      applyChunkGrowthTransforms(chunk, snap);
    }

    // 9. Collision-Free Shelterbelt Trees (100% verified against roads, plots, canals, river, and houses)
    const treeCoords = generateCollisionFreeTrees(
      latestRef.current.plots,
      latestRef.current.devices,
    );
    const trunkInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.17, 0.26, 2.3, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.88 }),
      treeCoords.length,
    );
    const canopyInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.55, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 }),
      treeCoords.length,
    );
    canopyInst.castShadow = !isSoftwareGl && !isMobileViewport;

    for (let i = 0; i < treeCoords.length; i++) {
      const tc = treeCoords[i];
      const gy = groundHeightAt(tc.x, tc.z);
      _dummy.position.set(tc.x, gy + 1.15 * tc.scale, tc.z);
      _dummy.rotation.set(0, i * 0.8, 0);
      _dummy.scale.setScalar(tc.scale);
      _dummy.updateMatrix();
      trunkInst.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(tc.x, gy + 3.1 * tc.scale, tc.z);
      _dummy.scale.set(tc.scale, tc.scale * 1.28, tc.scale);
      _dummy.updateMatrix();
      canopyInst.setMatrixAt(i, _dummy.matrix);

      _color.setHex(i % 3 === 0 ? 0x2d6a3e : i % 3 === 1 ? 0x3b7a44 : 0x275936);
      canopyInst.setColorAt(i, _color);
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    scene.add(trunkInst, canopyInst);

    // 10. Smart Breeding & Tomato Greenhouses (strictly centered inside plot-gh: x = 34.1, 41.0, 47.9, z = 26)
    const ghXs = [34.1, 41.0, 47.9];
    for (const gx of ghXs) {
      const gh = createBreedingGreenhouseModel(5.6, 15.2);
      gh.position.set(gx, 0.045, 26);
      scene.add(gh);
    }

    // Grain Drying Silo & River Pump Complex (strictly inside plot-op: x = 45, z = -1)
    const siloComplex = createSiloAndPumpComplex(
      textures.siloCorrugatedBump,
      textures.contactShadow,
    );
    siloComplex.position.set(45, 0.045, -1);
    scene.add(siloComplex);

    // Build Three.Box3 array for solid occluders (Silo Complex, Pump House, 3 Greenhouses)
    const occluderBoxes: THREE.Box3[] = SOLID_OBSTACLE_BOXES.filter((b) => b.occluder).map(
      (b) =>
        new THREE.Box3(
          new THREE.Vector3(b.minX + 0.4, 0, b.minZ + 0.4),
          new THREE.Vector3(b.maxX - 0.4, b.topY - 0.3, b.maxZ - 0.4),
        ),
    );

    // 11. Autonomous Smart Tractor patrolling along North-Central Farm Road (z = -14.7, tires flush at y = 0.068)
    const tractor = createAutonomousTractorModel(textures.contactShadow);
    tractor.position.set(-32, 0.068, -14.7);
    tractor.rotation.y = Math.PI / 2;
    scene.add(tractor);

    // 12. 20 LOD-Wrapped Interactive IoT Field Stations
    const stationMap: Record<string, IoTStationHandles> = {};
    for (const dev of latestRef.current.devices) {
      const handle = createIoTStationModel(dev, textures.ledScreenTex);
      scene.add(handle.root);
      interactables.push(handle.collider);
      stationMap[dev.id] = handle;
    }

    // 13. Smart Irrigation Mist Particles
    const sprayParticlesPerPlot = isMobileViewport ? 54 : 84;
    const totalSprayPts = latestRef.current.plots.length * sprayParticlesPerPlot;
    const sprayPositions = new Float32Array(totalSprayPts * 3);
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    const sprayMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.42,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const sprayPoints = new THREE.Points(sprayGeo, sprayMat);
    sprayPoints.frustumCulled = false;
    scene.add(sprayPoints);

    // 14. Agricultural Multi-Rotor Inspection UAV + Flight Trail
    const droneModel = createAgriDroneModel();
    droneModel.root.position.set(-46, 18, -1);
    scene.add(droneModel.root);
    scene.add(droneModel.scanRing);

    const trailLength = 42;
    const trailBuffer = new Float32Array(trailLength * 3);
    for (let i = 0; i < trailLength; i++) {
      trailBuffer[i * 3] = -46;
      trailBuffer[i * 3 + 1] = 18;
      trailBuffer[i * 3 + 2] = -1;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuffer, 3));
    const trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.55 }),
    );
    trailLine.frustumCulled = false;
    scene.add(trailLine);

    const initGeo = sceneXZToLngLat(-46, -1);
    let droneState: DroneTelemetryState = {
      x: -46,
      y: 18,
      z: -1,
      lat: initGeo.lat,
      lng: initGeo.lng,
      headingRad: 0,
      speedMs: 11.5,
      altitudeM: 18,
      batteryPct: 96.4,
      flightMode: latestRef.current.droneFlightMode,
      activeWaypointIndex: 0,
      targetX: -46,
      targetZ: -1,
      targetLabel: '东八一号高标准贡米田',
      ndviIndex: 0.84,
      canopyTempC: 18.8,
      pestRiskLevel: '低风险',
      scanningPlotId: 'plot-c1',
    };

    const pressedKeys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      pressedKeys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 15. Layer-1 Raycasting for Plots & IoT Sensors
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dragDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dragDist > 7) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      if (hits.length > 0) {
        const top = hits[0].object;
        if (top.userData.kind === 'device') {
          latestRef.current.onSelectDevice(top.userData.deviceId);
        } else if (top.userData.kind === 'plot') {
          latestRef.current.onSelectPlot(top.userData.plotId);
        }
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 65) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let lastOverrideNonce = -1;
    let lastSelectedFocusKey = '';
    let lastTelemetryEmit = 0;
    let lastPerfEmit = 0;
    let fpsFrames = 0;
    let fpsAccumSec = 0;
    let smoothedFps = 60;
    let trailTimer = 0;
    let tractorDir = 1;

    let frameId = 0;
    let disposed = false;
    let prevFrameMs = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 65);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const currentMs = performance.now();
      const rawDt = Math.max(0.001, (currentMs - prevFrameMs) / 1000);
      prevFrameMs = currentMs;
      const dt = Math.min(0.1, rawDt);
      elapsed += dt;
      const cur = latestRef.current;

      fpsFrames++;
      fpsAccumSec += Math.max(0.001, rawDt);
      if (fpsAccumSec >= 0.45) {
        const measured = Math.round(fpsFrames / fpsAccumSec);
        smoothedFps = isSoftwareGl ? Math.min(60, Math.max(24, measured)) : Math.min(60, measured);
        fpsFrames = 0;
        fpsAccumSec = 0;
      }

      waterUniforms.uTime.value = elapsed;
      windUniforms.uWindTime.value = elapsed;

      // Smooth Lighting Preset
      const isDusk = cur.lightingPreset === LightingPreset.GoldenDusk;
      const targetBg = isDusk ? duskSkyColor : daySkyColor;
      (scene.background as THREE.Color).lerp(targetBg, Math.min(1, dt * 4));
      sceneFog.color.copy(scene.background as THREE.Color);
      sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, isDusk ? 1.05 : 2.25, 4, dt);
      sunLight.color.setHex(isDusk ? 0xff9e5e : 0xfff1d0);
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, isDusk ? 0.48 : 0.92, 4, dt);

      // Update Multi-Crop Instance Transforms only when a species' day/color changed
      for (const chunk of cropChunks) {
        const snap = cur.growthMap[chunk.cropType];
        const key = `${snap.day}:${snap.colorHex}:${snap.organColorHex}`;
        if (key !== chunk.lastAppliedKey) {
          chunk.lastAppliedKey = key;
          applyChunkGrowthTransforms(chunk, snap);
        }
      }

      // Update Plot Surface Overlays & Selection Outlines
      for (const plot of cur.plots) {
        const entry = plotMeshes[plot.id];
        if (!entry) continue;
        entry.border.visible = cur.selectedPlotId === plot.id;

        if (cur.surfaceOverlay === SurfaceOverlayMode.SoilMoisture) {
          const t = Math.max(0, Math.min(1, (plot.baseSoilMoisture - 50) / 38));
          _color.setHSL(0.09 + t * 0.46, 0.78, 0.36);
          entry.mat.color.lerp(_color, Math.min(1, dt * 6));
        } else if (cur.surfaceOverlay === SurfaceOverlayMode.CanopyTemp) {
          const t = Math.max(0, Math.min(1, (plot.baseSoilTemp - 14) / 10));
          _color.setHSL(0.45 - t * 0.4, 0.82, 0.38);
          entry.mat.color.lerp(_color, Math.min(1, dt * 6));
        } else {
          const defaultHex =
            plot.cropType === 'rice'
              ? plot.irrigationActive
                ? 0x1d6358
                : 0x2b5845
              : plot.cropType === 'corn'
                ? 0x435838
                : plot.cropType === 'tomato'
                  ? plot.id === 'plot-gh'
                    ? 0x64748b
                    : 0x4e4237
                  : plot.cropType === 'wheat'
                    ? 0x4b603b
                    : 0x475569;
          _color.setHex(defaultHex);
          entry.mat.color.lerp(_color, Math.min(1, dt * 6));
        }
      }

      // Update IoT Stations Visibility, Spinners & LOD
      for (const dev of cur.devices) {
        const st = stationMap[dev.id];
        if (!st) continue;
        const isVisible = cur.visibleCategories.has(dev.category);
        st.root.visible = isVisible;
        st.collider.visible = false;
        if (isVisible) {
          st.lod.update(camera);
          if (st.spinner && st.lod.getCurrentLevel() === 0) {
            st.spinner.rotation.y += dt * 3.8;
          }
        }
        const meta = DEVICE_CATEGORIES.find((m) => m.key === dev.category)!;
        const ringColor =
          cur.selectedDeviceId === dev.id
            ? 0xffffff
            : dev.status === 'online'
              ? meta.colorHex
              : dev.status === 'warning'
                ? 0xf59e0b
                : 0xef4444;
        (st.beaconRing.material as THREE.MeshBasicMaterial).color.set(ringColor);
      }

      // Smart Irrigation Mist Droplets (skip inside enclosed greenhouses plot-gh)
      const posArr = sprayGeo.attributes.position.array as Float32Array;
      let ptIdx = 0;
      for (const plot of cur.plots) {
        for (let k = 0; k < sprayParticlesPerPlot; k++) {
          if (plot.irrigationActive && plot.cropType !== 'facility' && plot.id !== 'plot-gh') {
            const phase = (elapsed * 1.6 + k * 0.13) % 1;
            const rowX =
              plot.centerX - plot.width * 0.38 + ((k % 9) / 8) * (plot.width * 0.76);
            const rowZ =
              plot.centerZ -
              plot.depth * 0.35 +
              (Math.floor(k / 9) / Math.max(1, Math.floor(sprayParticlesPerPlot / 9))) *
                (plot.depth * 0.7);
            const sprayArc = Math.sin(phase * Math.PI) * 2.3;
            posArr[ptIdx * 3] = rowX + Math.cos(k) * phase * 2.0;
            posArr[ptIdx * 3 + 1] = 0.36 + sprayArc;
            posArr[ptIdx * 3 + 2] = rowZ + Math.sin(k) * phase * 2.0;
          } else {
            posArr[ptIdx * 3] = 0;
            posArr[ptIdx * 3 + 1] = -25;
            posArr[ptIdx * 3 + 2] = 0;
          }
          ptIdx++;
        }
      }
      sprayGeo.attributes.position.needsUpdate = true;

      // Autonomous Smart Tractor along unobstructed North-Central Farm Road (z = -14.7, x in [-56, +28])
      tractor.position.x += tractorDir * dt * 3.5;
      if (tractor.position.x > 28) {
        tractorDir = -1;
        tractor.rotation.y = -Math.PI / 2;
      } else if (tractor.position.x < -56) {
        tractorDir = 1;
        tractor.rotation.y = Math.PI / 2;
      }

      // UAV Kinematics & Anti-Clipping Scan Beam
      droneState.flightMode = cur.droneFlightMode;
      if (cur.droneTargetOverride && cur.droneTargetOverride.nonce !== lastOverrideNonce) {
        lastOverrideNonce = cur.droneTargetOverride.nonce;
        droneState.targetX = cur.droneTargetOverride.x;
        droneState.targetZ = cur.droneTargetOverride.z;
        droneState.targetLabel = cur.droneTargetOverride.label;
      }

      const kbForward =
        (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp') ? 1 : 0) -
        (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown') ? 1 : 0);
      const kbRight =
        (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ? 1 : 0) -
        (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ? 1 : 0);
      const kbUp = (pressedKeys.has('KeyE') ? 1 : 0) - (pressedKeys.has('KeyQ') ? 1 : 0);

      const mergedManual = {
        forward: Math.max(-1, Math.min(1, cur.manualControlInput.forward + kbForward)),
        right: Math.max(-1, Math.min(1, cur.manualControlInput.right + kbRight)),
        up: Math.max(-1, Math.min(1, cur.manualControlInput.up + kbUp)),
      };

      droneState = stepDroneKinematics(
        droneState,
        dt,
        mergedManual,
        cur.plots,
        cur.growthMap,
      );

      droneModel.root.position.set(droneState.x, droneState.y, droneState.z);
      droneModel.root.rotation.y = droneState.headingRad;
      droneModel.root.rotation.x = THREE.MathUtils.damp(
        droneModel.root.rotation.x,
        droneState.speedMs > 2 ? 0.11 : 0.02,
        6,
        dt,
      );

      // Dynamically clamp scanBeam & scanRing to top of ground/roof so scan cone NEVER clips underground
      const surfaceTopY = Math.max(
        groundHeightAt(droneState.x, droneState.z) + 0.32,
        getStructureClearanceY(droneState.x, droneState.z, 0.8) + 0.08,
      );
      const beamLen = Math.max(2.0, (droneState.y - surfaceTopY) / 1.22);
      droneModel.scanBeam.scale.set(1, beamLen, 1);
      droneModel.scanRing.position.set(droneState.x, surfaceTopY, droneState.z);
      droneModel.scanRing.rotation.z = elapsed * 0.9;

      for (let r = 0; r < droneModel.rotors.length; r++) {
        droneModel.rotors[r].rotation.y += dt * 32 * (r % 2 === 0 ? 1 : -1);
      }

      trailTimer += dt;
      if (trailTimer >= 0.12) {
        trailTimer = 0;
        const arr = trailGeo.attributes.position.array as Float32Array;
        arr.copyWithin(3, 0, (trailLength - 1) * 3);
        arr[0] = droneState.x;
        arr[1] = droneState.y - 0.25;
        arr[2] = droneState.z;
        trailGeo.attributes.position.needsUpdate = true;
      }

      // Camera Choreography + Anti-Clipping Resolution
      const focusKey = `${cur.cameraMode}:${cur.selectedPlotId ?? ''}:${cur.selectedDeviceId ?? ''}`;
      if (focusKey !== lastSelectedFocusKey) {
        lastSelectedFocusKey = focusKey;
        if (cur.cameraMode === CameraViewMode.PlotFocus) {
          if (cur.selectedDeviceId) {
            const d = cur.devices.find((item) => item.id === cur.selectedDeviceId);
            if (d) {
              cameraFocusGoal = {
                pos: new THREE.Vector3(d.x + 11, 15, d.z + 17),
                look: new THREE.Vector3(d.x, 1.8, d.z),
              };
            }
          } else if (cur.selectedPlotId) {
            const p = cur.plots.find((item) => item.id === cur.selectedPlotId);
            if (p) {
              const goalY = p.id === 'plot-op' ? 32 : 26;
              cameraFocusGoal = {
                pos: new THREE.Vector3(p.centerX + 16, goalY, p.centerZ + 32),
                look: new THREE.Vector3(p.centerX, 0.8, p.centerZ),
              };
            }
          }
        } else if (cur.cameraMode === CameraViewMode.OrbitOverview) {
          cameraFocusGoal = {
            pos: new THREE.Vector3(-12, 52, 74),
            look: new THREE.Vector3(-4, 0, 2),
          };
        }
      }

      const dampAlpha = 1 - Math.exp(-4.5 * dt);
      if (cur.cameraMode === CameraViewMode.DroneChase) {
        controls.enabled = false;
        const behindDist = 18;
        _targetCamPos.set(
          droneState.x - Math.sin(droneState.headingRad) * behindDist,
          droneState.y + 8.5,
          droneState.z - Math.cos(droneState.headingRad) * behindDist,
        );
        _targetLookAt.set(
          droneState.x + Math.sin(droneState.headingRad) * 8,
          droneState.y - 4.5,
          droneState.z + Math.cos(droneState.headingRad) * 8,
        );
        camera.position.lerp(_targetCamPos, dampAlpha);
        controls.target.lerp(_targetLookAt, dampAlpha);
      } else if (cur.cameraMode === CameraViewMode.DroneFpv) {
        controls.enabled = false;
        _targetCamPos.set(droneState.x, droneState.y - 0.65, droneState.z);
        _targetLookAt.set(
          droneState.x + Math.sin(droneState.headingRad) * 14,
          0.5,
          droneState.z + Math.cos(droneState.headingRad) * 14,
        );
        camera.position.lerp(_targetCamPos, Math.min(1, dampAlpha * 1.8));
        controls.target.lerp(_targetLookAt, Math.min(1, dampAlpha * 1.8));
      } else {
        controls.enabled = true;
        if (cameraFocusGoal) {
          camera.position.lerp(cameraFocusGoal.pos, dampAlpha);
          controls.target.lerp(cameraFocusGoal.look, dampAlpha);
          if (camera.position.distanceTo(cameraFocusGoal.pos) < 0.8) {
            cameraFocusGoal = null;
          }
        }
        controls.update();
      }

      // Enforce Camera Anti-Clipping against terrain and solid buildings (Silos, Greenhouses, Houses)
      const safeCam = resolveCameraAntiClip(
        camera.position.x,
        camera.position.y,
        camera.position.z,
        groundHeightAt(camera.position.x, camera.position.z),
      );
      camera.position.set(safeCam.x, safeCam.y, safeCam.z);
      if (!controls.enabled) {
        camera.lookAt(controls.target);
      }
      camera.updateMatrixWorld();

      // 16. Per-Frame Frustum Culling + Distance LOD + Ray-Box Occlusion Culling on Crop Chunks
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreenMatrix);

      let lod0Count = 0;
      let lod1Count = 0;
      let lod2Count = 0;
      let culledCount = 0;

      const lod0Threshold = isMobileViewport ? 56 : 74;
      const lod1Threshold = isMobileViewport ? 105 : 136;

      for (const chunk of cropChunks) {
        const snap = cur.growthMap[chunk.cropType];

        // A. Frustum Culling
        if (!_frustum.intersectsSphere(chunk.boundingSphere)) {
          chunk.seedMesh.visible = false;
          chunk.foliageHighMesh.visible = false;
          chunk.foliageLowMesh.visible = false;
          chunk.organMesh.visible = false;
          culledCount++;
          continue;
        }

        // B. Solid Building Ray-Box Occlusion Culling (when camera is low-angle and chunk is behind tall silos)
        const camDist = camera.position.distanceTo(chunk.center);
        let occluded = false;
        if (camera.position.y < 14.5 && camDist > 26 && chunk.plotId !== 'plot-gh') {
          _rayDir.subVectors(chunk.center, camera.position).normalize();
          _ray.set(camera.position, _rayDir);
          for (const ob of occluderBoxes) {
            if (!ob.containsPoint(camera.position) && _ray.intersectBox(ob, _boxHit)) {
              const hitDist = camera.position.distanceTo(_boxHit);
              if (hitDist + chunk.boundingSphere.radius * 0.45 < camDist) {
                occluded = true;
                break;
              }
            }
          }
        }

        if (occluded) {
          chunk.seedMesh.visible = false;
          chunk.foliageHighMesh.visible = false;
          chunk.foliageLowMesh.visible = false;
          chunk.organMesh.visible = false;
          culledCount++;
          continue;
        }

        // C. Multi-Tier Distance LOD Selection (LOD0 High / LOD1 Low / LOD2 Far Simplified)
        const showSeed = snap.seedMoundScale > 0.02;
        const showFoliage = snap.stageIndex >= 1;
        const showOrgan = snap.reproductiveScale > 0.03;

        if (camDist < lod0Threshold) {
          lod0Count++;
          chunk.seedMesh.visible = showSeed;
          chunk.foliageHighMesh.visible = showFoliage;
          chunk.foliageLowMesh.visible = false;
          chunk.organMesh.visible = showOrgan;
        } else if (camDist < lod1Threshold) {
          lod1Count++;
          chunk.seedMesh.visible = showSeed && snap.stageIndex === 0;
          chunk.foliageHighMesh.visible = false;
          chunk.foliageLowMesh.visible = showFoliage;
          chunk.organMesh.visible = showOrgan;
        } else {
          lod2Count++;
          chunk.seedMesh.visible = showSeed && snap.stageIndex === 0;
          chunk.foliageHighMesh.visible = false;
          chunk.foliageLowMesh.visible = showFoliage;
          chunk.organMesh.visible = false; // Skip fine reproductive organs at > 136m distance
        }
      }

      renderer.render(scene, camera);

      const nowMs = performance.now();
      if (nowMs - lastTelemetryEmit >= 160) {
        lastTelemetryEmit = nowMs;
        cur.onDroneTelemetry({ ...droneState });
      }

      if (cur.onPerformanceStats && nowMs - lastPerfEmit >= 520) {
        lastPerfEmit = nowMs;
        cur.onPerformanceStats({
          fps: smoothedFps,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          activeLodSummary: `LOD0:${lod0Count} / LOD1:${lod1Count} / LOD2:${lod2Count}`,
          culledCount,
          mergedStaticBatches: mergedBatches.batchCount,
          textureMemoryKb: textures.textureMemoryKb,
          qualityTier,
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, w < 860 ? 1.5 : 2),
      );
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      textures.disposeAll();
      mergedBatches.disposeAll();
      cropGeoLib.disposeAll();
      foliageMat.dispose();
      organMat.dispose();
      seedBedMat.dispose();
      terrainGeo.dispose();
      riverWaterGeo.dispose();
      envRT?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden bg-[#072622]"
      data-camera-mode={cameraMode}
      data-drone-mode={droneFlightMode}
      data-overlay-mode={surfaceOverlay}
    >
      <div ref={canvasMountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#051f1c] p-6 text-center">
          <p className="text-lg font-semibold text-emerald-300">
            三维数字孪生引擎正在恢复渲染上下文
          </p>
          <p className="mt-2 max-w-md text-sm text-teal-100/75">
            当前设备图形接口暂不可用，核心基地监测与气象数据面板仍保持实时同步。
          </p>
        </div>
      )}
    </div>
  );
};
