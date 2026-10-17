<template>
  <canvas
    ref="canvasElement"
    class="aito-three-scene"
    :class="{ 'is-interactive': surpriseStage }"
    @pointerdown="handlePointerDown"
    @click="handlePointerDown"
    aria-hidden="true"
  ></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { landing3dModels } from 'src/data/landing3dModels'

const props = defineProps({
  scrollProgress: {
    type: Number,
    default: 0
  },
  reducedMotion: {
    type: Boolean,
    default: false
  },
  sectionCount: {
    type: Number,
    default: 9
  },
  danceActive: {
    type: Boolean,
    default: false
  },
  soloDance: {
    type: Boolean,
    default: false
  },
  surpriseStage: {
    type: Boolean,
    default: false
  },
  courseStage: {
    type: Boolean,
    default: false
  },
  surpriseFocus: {
    type: String,
    default: 'obj4Dance'
  },
  surpriseZoom: {
    type: Number,
    default: 1
  },
  introPhase: {
    type: String,
    default: 'complete'
  }
})

const emit = defineEmits(['ready', 'model-select'])

const canvasElement = ref(null)

const bundledModelUrls = import.meta.glob([
  '../../3d-models/obj1.glb',
  '../../3d-models/obj1.desktop.glb',
  '../../3d-models/obj2.glb',
  '../../3d-models/obj2.desktop.glb',
  '../../3d-models/obj3.glb',
  '../../3d-models/obj3.desktop.glb',
  '../../3d-models/obj4.glb',
  '../../3d-models/obj4.desktop.glb',
  '../../3d-models/obj4 - dance.glb',
  '../../3d-models/obj4 - dance.desktop.glb',
  '../../3d-models/obj-samuel.glb',
  '../../3d-models/obj-samuel.desktop.glb',
  '../../3d-models/obj-samuel-dance.glb',
  '../../3d-models/obj-samuel-dance.desktop.glb',
  '../../3d-models/obj-dion.glb',
  '../../3d-models/obj-dion.desktop.glb',
  '../../3d-models/obj-dion-dance.glb',
  '../../3d-models/obj-dion-dance.desktop.glb'
], {
  eager: true,
  query: '?url',
  import: 'default'
})

const BRAND_TEAL = 0x089fa5
const BRAND_TEAL_SECONDARY = 0x0ea794
const BRAND_GREEN = 0x1cbd6b
const BRAND_NAVY = 0x0b1220
const STAR_COLORS = [0x1fb694, 0x23917d, 0x50dcc4, 0x8fffee]
const MODEL_LOAD_TIMEOUT_MS = 9000
const MODEL_LOAD_CONCURRENCY = 2
const LANDING_MODEL_KEYS = ['logo', 'obj2', 'obj3', 'obj4', 'samuel', 'dion']
const MOBILE_MODEL_BY_SECTION = [null, 'logo', 'obj2', null, 'obj3', 'samuel', 'dion', 'obj4']
const SURPRISE_MODEL_KEYS = ['obj4', 'obj4Dance', 'samuelDance', 'dionDance']
const COURSE_MODEL_KEYS = ['obj4']

const STATE_DEFAULTS = {
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  scale: 1,
  opacity: 1
}

const MODEL_KEYFRAMES = {
  intro: [
    { section: 0, x: 2.35, y: 0.05, ry: -0.35, rz: -0.08, scale: 1, opacity: 1 },
    { section: 1, x: 4.2, y: 0, scale: 0.42, opacity: 0 }
  ],
  logo: [
    { section: 0, x: 4.2, y: 0, scale: 0.42, opacity: 0 },
    { section: 1, x: 2.35, y: 0.05, ry: -0.35, rz: -0.08, scale: 1, opacity: 1 },
    { section: 2, x: -4.2, y: -1.7, rx: 0.65, ry: 1.7, scale: 0.62, opacity: 0 }
  ],
  obj2: [
    { section: 0, x: 4.3, y: 0.3, ry: -0.8, scale: 0.48, opacity: 0 },
    { section: 1, x: 4.3, y: 0.3, ry: -0.8, scale: 0.48, opacity: 0 },
    { section: 2, x: 2.4, y: 0.02, rx: -0.15, ry: -0.65, scale: 1, opacity: 1 },
    { section: 3, x: 3.8, y: -0.1, rx: 0.38, ry: -0.65, rz: -0.15, scale: 0.94, opacity: 0 },
    { section: 4, x: -4.1, y: -0.9, rx: 0.7, ry: 2.1, rz: -0.35, scale: 0.65, opacity: 0 }
  ],
  obj3: [
    { section: 0, x: 4.4, y: 0.1, scale: 0.5, opacity: 0 },
    { section: 3, x: 4.4, y: 0.1, scale: 0.5, opacity: 0 },
    { section: 4, x: 2.35, y: 0.05, rx: 0.2, ry: -0.45, scale: 1, opacity: 1 },
    { section: 5, x: -4.2, y: -0.8, rx: -0.7, ry: 1.5, scale: 0.65, opacity: 0 }
  ],
  obj4: [
    { section: 0, x: 4.5, y: 0.2, scale: 0.48, opacity: 0 },
    { section: 6, x: 4.5, y: 0.2, scale: 0.48, opacity: 0 },
    { section: 7, x: 0, y: 0.08, z: -0.25, rx: 0.04, ry: 0, rz: 0, scale: 1.05, opacity: 1 }
  ],
  obj4Dance: [
    { section: 0, x: 0, y: 0, scale: 0.48, opacity: 0 }
  ],
  samuelDance: [
    { section: 0, x: 4.2, y: 0, scale: 0.42, opacity: 0 }
  ],
  dionDance: [
    { section: 0, x: 4.2, y: 0, scale: 0.42, opacity: 0 }
  ],
  samuel: [
    { section: 0, x: 4.2, y: 0, scale: 0.42, opacity: 0 },
    { section: 4, x: 4.2, y: 0, scale: 0.42, opacity: 0 },
    { section: 5, x: 2.25, y: -0.08, rx: 0.04, ry: -0.2, scale: 1.02, opacity: 1 },
    { section: 6, x: -4.2, y: -0.5, rx: 0.4, ry: 1.3, scale: 0.62, opacity: 0 }
  ],
  dion: [
    { section: 0, x: 4.2, y: 0, scale: 0.42, opacity: 0 },
    { section: 5, x: 4.2, y: 0, scale: 0.42, opacity: 0 },
    { section: 6, x: -2.25, y: -0.08, rx: -0.04, ry: 0.2, scale: 1.02, opacity: 1 },
    { section: 7, x: -4.2, y: -0.5, rx: -0.4, ry: -1.3, scale: 0.62, opacity: 0 }
  ]
}

let scene
let camera
let renderer
let animationFrame = 0
let destroyed = false
let smoothProgress = 0
let starField
let starFieldIsDesktop = false
let modelEntries = {}
let modelLoader
let modelLoadQueue = []
let modelLoadActive = 0
const modelLoadPromises = new Map()
const modelLoadResolvers = new Map()
const modelSettledKeys = new Set()
let lastFrameTime = 0
let readyEmitted = false
let pageVisible = true
let webglContextLost = false
let baseCameraZ = 8.4
let surpriseFocusFrom = 'obj4Dance'
let surpriseFocusTarget = 'obj4Dance'
let surpriseFocusMix = 1
let introTransitionMix = props.introPhase === 'complete' ? 1 : 0

const pointerTarget = new THREE.Vector2()
const pointerCurrent = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const raycastPointer = new THREE.Vector2()
let danceYawTarget = 0
let danceYawCurrent = 0

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const lerp = (start, end, amount) => start + (end - start) * amount
const easeInOut = (value) => value * value * (3 - 2 * value)

function modelFileNames(fileName) {
  return Array.isArray(fileName) ? fileName : [fileName]
}

function describeModelFile(fileName) {
  return modelFileNames(fileName).join(' ou ')
}

function prefersHighQualityModels() {
  const width = window.innerWidth
  const navigatorConnection = navigator.connection
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const isSlowConnection = ['slow-2g', '2g'].includes(navigatorConnection?.effectiveType)
  const saveData = Boolean(navigatorConnection?.saveData)
  const hasDeviceMemory = Number.isFinite(Number(navigator.deviceMemory))
  const hasHardwareConcurrency = Number.isFinite(Number(navigator.hardwareConcurrency))
  const hasEnoughMemory = !hasDeviceMemory || Number(navigator.deviceMemory) >= 6
  const hasEnoughCores = !hasHardwareConcurrency || Number(navigator.hardwareConcurrency) >= 6

  return width >= 1024 &&
    !isCoarsePointer &&
    !isSlowConnection &&
    !saveData &&
    hasEnoughMemory &&
    hasEnoughCores
}

function modelFileCandidates(config) {
  const highQualityFiles = prefersHighQualityModels() && config.highQualityFileName
    ? modelFileNames(config.highQualityFileName)
    : []

  return [...highQualityFiles, ...modelFileNames(config.fileName)]
}

function sceneModelEntries() {
  const keys = props.surpriseStage
    ? SURPRISE_MODEL_KEYS
    : props.courseStage ? COURSE_MODEL_KEYS : LANDING_MODEL_KEYS
  return keys
    .map((key) => [key, landing3dModels[key]])
    .filter(([, config]) => config)
}

function resolveModelUrl(fileName) {
  for (const modelFileName of modelFileNames(fileName)) {
    const match = Object.entries(bundledModelUrls).find(([path]) =>
      path.replaceAll('\\', '/').endsWith(`/3d-models/${modelFileName}`)
    )

    if (match?.[1]) return match[1]
  }

  return undefined
}

function prepareMaterials(root, cloneMaterials = true) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    const materials = sourceMaterials.map((material) =>
      cloneMaterials ? material.clone() : material
    )

    materials.forEach((material) => {
      material.transparent = true
      material.userData.baseOpacity = material.opacity
      material.needsUpdate = true
    })

    child.material = Array.isArray(child.material) ? materials : materials[0]
  })
}

function setObjectOpacity(root, opacity) {
  root.visible = opacity > 0.004

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      const baseOpacity = material.userData.baseOpacity ?? 1
      material.opacity = baseOpacity * opacity
      material.depthWrite = opacity > 0.92
    })
  })
}

function brandMaterial(color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.55,
    roughness: options.roughness ?? 0.25,
    emissive: options.emissive ?? color,
    emissiveIntensity: options.emissiveIntensity ?? 0.08,
    transparent: true,
    opacity: options.opacity ?? 1,
    wireframe: options.wireframe ?? false,
    side: THREE.DoubleSide
  })

  material.userData.baseOpacity = material.opacity
  return material
}

function aquaMaterial(color, options = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? 0.16,
    roughness: options.roughness ?? 0.08,
    transmission: options.transmission ?? 0.36,
    thickness: options.thickness ?? 0.65,
    transparent: true,
    opacity: options.opacity ?? 0.78,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: options.emissive ?? color,
    emissiveIntensity: options.emissiveIntensity ?? 0.24,
    side: THREE.DoubleSide
  })

  material.userData.baseOpacity = material.opacity
  return material
}

function createLoaderObjectFallback() {
  const group = new THREE.Group()

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.02, 5),
    aquaMaterial(0x13bc9d, {
      opacity: 0.72,
      emissive: 0x0b6f63,
      emissiveIntensity: 0.22
    })
  )
  group.add(core)

  const inner = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.58, 0.085, 150, 18, 2, 5),
    aquaMaterial(0x12ad89, {
      metalness: 0.34,
      roughness: 0.12,
      transmission: 0.08,
      opacity: 0.82,
      emissiveIntensity: 0.5
    })
  )
  inner.rotation.set(0.45, -0.24, 0.12)
  group.add(inner)

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x13bc9d,
    metalness: 0.42,
    roughness: 0.16,
    emissive: 0x12ad89,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.72
  })
  ringMaterial.userData.baseOpacity = ringMaterial.opacity

  const ringAngles = [
    [1.42, Math.PI / 2.2, 0.16],
    [1.58, Math.PI / 2.8, -0.92],
    [1.74, Math.PI / 1.78, 0.64]
  ]

  ringAngles.forEach(([radius, x, y]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.022, 10, 180),
      ringMaterial.clone()
    )
    ring.material.userData.baseOpacity = ring.material.opacity
    ring.rotation.set(x, y, 0)
    group.add(ring)
  })

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.34, 1),
    new THREE.MeshBasicMaterial({
      color: 0x13bc9d,
      wireframe: true,
      transparent: true,
      opacity: 0.18
    })
  )
  shell.material.userData.baseOpacity = shell.material.opacity
  shell.rotation.set(0.22, 0.12, -0.08)
  group.add(shell)

  return group
}

function createCloudFallback() {
  const group = new THREE.Group()
  const teal = brandMaterial(BRAND_TEAL, { roughness: 0.18 })
  const tealLight = brandMaterial(BRAND_GREEN, {
    metalness: 0.35,
    roughness: 0.3,
    emissiveIntensity: 0.12
  })

  const lobes = [
    { radius: 0.72, position: [-0.62, -0.08, 0] },
    { radius: 0.9, position: [0.08, 0.25, 0.05] },
    { radius: 0.67, position: [0.78, -0.06, -0.02] },
    { radius: 0.58, position: [0.05, -0.48, 0.08] }
  ]

  lobes.forEach(({ radius, position }, index) => {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 3),
      index === 3 ? tealLight : teal
    )
    mesh.position.set(...position)
    group.add(mesh)
  })

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.025, 10, 120),
    brandMaterial(BRAND_GREEN, {
      metalness: 0.2,
      emissiveIntensity: 0.45,
      opacity: 0.72
    })
  )
  ring.rotation.x = Math.PI / 2.8
  ring.rotation.y = Math.PI / 7
  group.add(ring)

  return group
}

function createTorusKnotFallback() {
  const group = new THREE.Group()
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.94, 0.22, 180, 24, 2, 3),
    brandMaterial(BRAND_TEAL, {
      metalness: 0.78,
      roughness: 0.16,
      emissiveIntensity: 0.12
    })
  )
  group.add(knot)

  const wire = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.02, 0.025, 150, 8, 2, 3),
    brandMaterial(BRAND_GREEN, {
      metalness: 0.25,
      emissiveIntensity: 0.6,
      opacity: 0.65
    })
  )
  group.add(wire)

  return group
}

function createIcosahedronFallback() {
  const group = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.82, 2),
    brandMaterial(BRAND_NAVY, {
      metalness: 0.7,
      roughness: 0.18,
      emissive: BRAND_TEAL_SECONDARY,
      emissiveIntensity: 0.18
    })
  )
  group.add(core)

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.24, 1),
    brandMaterial(BRAND_GREEN, {
      metalness: 0.2,
      roughness: 0.18,
      emissiveIntensity: 0.5,
      opacity: 0.58,
      wireframe: true
    })
  )
  shell.rotation.set(0.3, 0.3, 0.1)
  group.add(shell)

  return group
}

function createOrbitalFallback() {
  const group = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 48, 48),
    brandMaterial(BRAND_TEAL, {
      metalness: 0.7,
      roughness: 0.14,
      emissiveIntensity: 0.24
    })
  )
  group.add(core)

  const ringMaterial = brandMaterial(BRAND_GREEN, {
    metalness: 0.3,
    roughness: 0.18,
    emissiveIntensity: 0.62,
    opacity: 0.74
  })

  ;[
    [1.28, 0, 0],
    [1.5, Math.PI / 2.6, Math.PI / 5],
    [1.74, Math.PI / 1.9, -Math.PI / 4]
  ].forEach(([radius, x, y]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.025, 10, 140),
      ringMaterial
    )
    ring.rotation.set(x, y, 0)
    group.add(ring)
  })

  return group
}

function createFounderFallback(variant) {
  const group = new THREE.Group()
  const primary = variant === 'samuel' ? BRAND_TEAL : BRAND_GREEN
  const secondary = variant === 'samuel' ? BRAND_GREEN : BRAND_TEAL
  const bodyMaterial = brandMaterial(primary, {
    metalness: 0.68,
    roughness: 0.2,
    emissiveIntensity: 0.16
  })
  const accentMaterial = brandMaterial(secondary, {
    metalness: 0.48,
    roughness: 0.16,
    emissiveIntensity: 0.36
  })
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: BRAND_NAVY,
    metalness: 0.72,
    roughness: 0.24
  })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.64, 1.08, 8, 18), bodyMaterial)
  torso.position.y = -0.22
  group.add(torso)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 22), accentMaterial)
  head.position.y = 0.92
  group.add(head)

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), darkMaterial)
  visor.scale.set(1.2, 0.62, 0.34)
  visor.position.set(0, 0.98, 0.45)
  group.add(visor)

  const shoulderGeometry = new THREE.SphereGeometry(0.22, 20, 14)
  const leftShoulder = new THREE.Mesh(shoulderGeometry, accentMaterial)
  leftShoulder.position.set(-0.78, 0.12, 0)
  const rightShoulder = leftShoulder.clone()
  rightShoulder.position.x = 0.78
  group.add(leftShoulder, rightShoulder)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.028, 10, 120),
    brandMaterial(secondary, { metalness: 0.24, emissiveIntensity: 0.7, opacity: 0.76 })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = -0.94
  group.add(ring)

  return group
}

function createFallback(type) {
  if (type === 'loader-object') return createLoaderObjectFallback()
  if (type === 'torus-knot') return createTorusKnotFallback()
  if (type === 'icosahedron') return createIcosahedronFallback()
  if (type === 'orbital') return createOrbitalFallback()
  if (type === 'founder-samuel') return createFounderFallback('samuel')
  if (type === 'founder-dion') return createFounderFallback('dion')
  return createCloudFallback()
}

function normalizeModel(model) {
  const bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const largestAxis = Math.max(size.x, size.y, size.z)
  const container = new THREE.Group()

  model.position.sub(center)
  container.add(model)

  if (Number.isFinite(largestAxis) && largestAxis > 0) {
    container.scale.setScalar(2.65 / largestAxis)
  }

  return container
}

function createModelRoots() {
  sceneModelEntries().forEach(([key, config]) => {
    const root = new THREE.Group()
    const fallback = createFallback(config.fallback)
    prepareMaterials(fallback, false)
    root.add(fallback)
    scene.add(root)

    if (props.soloDance && key !== 'obj4Dance') {
      setObjectOpacity(root, 0)
    }

    modelEntries[key] = {
      root,
      content: fallback,
      fallback,
      isLoaded: false,
      mixer: null,
      mixerRoot: null
    }
  })
}

function clearModelAnimation(entry) {
  if (!entry?.mixer) return

  entry.mixer.stopAllAction()
  if (entry.mixerRoot) entry.mixer.uncacheRoot(entry.mixerRoot)
  entry.mixer = null
  entry.mixerRoot = null
}

function playModelAnimations(entry, mixerRoot, clips) {
  if (!clips?.length) return

  const mixer = new THREE.AnimationMixer(mixerRoot)
  clips.forEach((clip) => {
    mixer.clipAction(clip).reset().play()
  })

  entry.mixer = mixer
  entry.mixerRoot = mixerRoot
}

function loadModelEntry(loader, key, config) {
  if (config.procedural) {
    return Promise.resolve({ key, status: 'fallback' })
  }

    const url = resolveModelUrl(modelFileCandidates(config))

    if (!url) {
      console.warn(
        `[Landing 3D] Modelo "${describeModelFile(config.fileName)}" não encontrado em src/3d-models. ` +
        `Usando fallback visual para "${key}".`
      )
      return Promise.resolve({ key, status: 'fallback' })
    }

    return new Promise((resolve) => {
      let settled = false
      const timeoutId = window.setTimeout(() => {
        settled = true
        console.warn(
          `[Landing 3D] O carregamento de "${describeModelFile(config.fileName)}" excedeu ` +
          `${MODEL_LOAD_TIMEOUT_MS}ms. O fallback de "${key}" continuara ativo.`
        )
        resolve({ key, status: 'timeout' })
      }, MODEL_LOAD_TIMEOUT_MS)

      const finish = (result) => {
        if (settled) return false
        settled = true
        window.clearTimeout(timeoutId)
        resolve(result)
        return true
      }

      loader.load(
        url,
        (gltf) => {
          if (settled) {
            disposeObject(gltf.scene)
            return
          }

          if (destroyed) {
            disposeObject(gltf.scene)
            finish({ key, status: 'disposed' })
            return
          }

          prepareMaterials(gltf.scene)
          const normalizedModel = normalizeModel(gltf.scene)
          const entry = modelEntries[key]

          clearModelAnimation(entry)
          disposeObject(entry.content)
          entry.root.clear()
          entry.root.add(normalizedModel)
          entry.content = normalizedModel
          entry.isLoaded = true
          playModelAnimations(entry, gltf.scene, gltf.animations)
          finish({ key, status: 'loaded' })
        },
        undefined,
        (error) => {
          if (settled) return

          console.warn(
            `[Landing 3D] Não foi possível carregar "${describeModelFile(config.fileName)}". ` +
            `O fallback de "${key}" continuará ativo.`,
            error
          )
          finish({ key, status: 'fallback' })
        }
      )
    })
}

function pumpModelLoadQueue() {
  while (modelLoader && modelLoadActive < MODEL_LOAD_CONCURRENCY && modelLoadQueue.length) {
    const key = modelLoadQueue.shift()
    const config = landing3dModels[key]
    if (!config || modelSettledKeys.has(key)) continue

    modelLoadActive += 1
    loadModelEntry(modelLoader, key, config)
      .then((result) => {
        modelSettledKeys.add(key)
        modelLoadResolvers.get(key)?.(result)
      })
      .catch((error) => {
        console.warn(`[Landing 3D] Falha inesperada ao carregar "${key}".`, error)
        modelSettledKeys.add(key)
        modelLoadResolvers.get(key)?.({ key, status: 'fallback' })
      })
      .finally(() => {
        modelLoadResolvers.delete(key)
        modelLoadPromises.delete(key)
        modelLoadActive -= 1
        pumpModelLoadQueue()
      })
  }
}

function queueModelLoad(key) {
  if (!landing3dModels[key] || !modelEntries[key] || modelSettledKeys.has(key)) {
    return Promise.resolve({ key, status: 'skipped' })
  }

  if (modelLoadPromises.has(key)) return modelLoadPromises.get(key)

  const promise = new Promise((resolve) => {
    modelLoadResolvers.set(key, resolve)
  })
  modelLoadPromises.set(key, promise)
  modelLoadQueue.push(key)
  pumpModelLoadQueue()
  return promise
}

function unloadModel(key) {
  const entry = modelEntries[key]
  if (!entry?.isLoaded || modelLoadPromises.has(key)) return

  clearModelAnimation(entry)
  disposeObject(entry.content)
  entry.root.clear()
  entry.root.add(entry.fallback)
  entry.content = entry.fallback
  entry.isLoaded = false
  modelSettledKeys.delete(key)
}

function queueNearbyModelLoads(sectionPosition) {
  if (props.surpriseStage) return

  if (props.courseStage) {
    COURSE_MODEL_KEYS.forEach(queueModelLoad)
    return
  }

  LANDING_MODEL_KEYS.forEach(queueModelLoad)
}

function loadModels() {
  modelLoader = new GLTFLoader()
  modelLoader.setMeshoptDecoder(MeshoptDecoder)

  const initialKeys = props.surpriseStage
    ? SURPRISE_MODEL_KEYS
    : props.courseStage ? COURSE_MODEL_KEYS : LANDING_MODEL_KEYS

  return Promise.all(initialKeys.map(queueModelLoad))
}

function emitSceneReady() {
  if (readyEmitted) return
  readyEmitted = true
  emit('ready')
}

function createStarLayer(count, size, opacity, spread, color) {
  const positions = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3
    positions[stride] = (Math.random() - 0.5) * spread
    positions[stride + 1] = (Math.random() - 0.5) * spread * 0.7
    positions[stride + 2] = -Math.random() * 22 + 5
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'float radius = length(gl_PointCoord - vec2(0.5)); if (radius > 0.5) discard; vec4 diffuseColor = vec4(diffuse, opacity * (1.0 - smoothstep(0.12, 0.5, radius)));')
  }
  return new THREE.Points(geometry, material)
}

function createThreadStarLayer(count, minLength, maxLength, opacity, spread) {
  const positions = new Float32Array(count * 6)
  const colors = new Float32Array(count * 6)
  const basePositions = new Float32Array(count * 3)
  const lengths = new Float32Array(count)
  const phases = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    const baseStride = index * 3
    const lineStride = index * 6
    const baseX = (Math.random() - 0.5) * spread
    const baseY = (Math.random() - 0.5) * spread * 0.7
    const baseZ = -Math.random() * 22 + 5
    const length = minLength + Math.random() * (maxLength - minLength)
    const color = new THREE.Color(
      STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    )

    basePositions[baseStride] = baseX
    basePositions[baseStride + 1] = baseY
    basePositions[baseStride + 2] = baseZ
    lengths[index] = length
    phases[index] = Math.random() * Math.PI * 2

    positions[lineStride] = baseX
    positions[lineStride + 1] = baseY - length * 0.5
    positions[lineStride + 2] = baseZ
    positions[lineStride + 3] = baseX
    positions[lineStride + 4] = baseY + length * 0.5
    positions[lineStride + 5] = baseZ
    color.toArray(colors, lineStride)
    color.toArray(colors, lineStride + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  const line = new THREE.LineSegments(geometry, material)
  line.frustumCulled = false
  const dots = createStarLayer(count, 0.065, opacity, spread, 0x8fffee)
  dots.geometry.setAttribute('position', new THREE.BufferAttribute(basePositions.slice(), 3))
  line.add(dots)
  line.userData.threadStars = { basePositions, lengths, phases, dots, opacity }
  return line
}

function createStarField() {
  const group = new THREE.Group()
  starFieldIsDesktop = window.innerWidth >= 768

  if (starFieldIsDesktop) {
    group.add(createThreadStarLayer(300, 0.05, 0.11, 0.52, 32))
    group.add(createThreadStarLayer(120, 0.08, 0.18, 0.62, 28))
    group.add(createThreadStarLayer(50, 0.12, 0.24, 0.78, 24))
  } else {
    group.add(createStarLayer(360, 0.025, 0.42, 32, 0xb8c9cc))
    group.add(createStarLayer(150, 0.045, 0.58, 28, BRAND_TEAL_SECONDARY))
    group.add(createStarLayer(55, 0.072, 0.68, 24, BRAND_GREEN))
  }

  return group
}

function updateThreadStarLayer(layer, elapsedTime, targetX, targetY) {
  const stars = layer.userData.threadStars
  if (!stars) return

  const positions = layer.geometry.getAttribute('position').array
  const { basePositions, lengths, phases } = stars

  for (let index = 0; index < lengths.length; index += 1) {
    const baseStride = index * 3
    const lineStride = index * 6
    const driftX = Math.sin(elapsedTime * 0.2 + phases[index]) * 0.012
    const driftY = Math.cos(elapsedTime * 0.17 + phases[index]) * 0.009
    const baseX = basePositions[baseStride] + driftX
    const baseY = basePositions[baseStride + 1] + driftY
    const baseZ = basePositions[baseStride + 2]
    let directionX = targetX - baseX
    let directionY = targetY - baseY
    const directionLength = Math.hypot(directionX, directionY)

    if (directionLength < 0.001) {
      directionX = 0
      directionY = -1
    } else {
      directionX /= directionLength
      directionY /= directionLength
    }

    const halfLength = lengths[index] * 0.5 * easeInOut(introTransitionMix)
    positions[lineStride] = baseX - directionX * halfLength
    positions[lineStride + 1] = baseY - directionY * halfLength
    positions[lineStride + 2] = baseZ
    positions[lineStride + 3] = baseX + directionX * halfLength
    positions[lineStride + 4] = baseY + directionY * halfLength
    positions[lineStride + 5] = baseZ
  }

  layer.material.opacity = stars.opacity * introTransitionMix
  stars.dots.material.opacity = stars.opacity * (1 - introTransitionMix)
  layer.geometry.getAttribute('position').needsUpdate = true
}

function createLights() {
  const ambient = new THREE.AmbientLight(0xdce8e9, 1.05)
  scene.add(ambient)

  const directional = new THREE.DirectionalLight(0xf2f7f7, 2.8)
  directional.position.set(4, 5, 7)
  scene.add(directional)

  const tealLight = new THREE.PointLight(BRAND_TEAL, 30, 13, 2)
  tealLight.position.set(3.8, 1.5, 3.5)
  scene.add(tealLight)

  const tealFillLight = new THREE.PointLight(BRAND_TEAL_SECONDARY, 22, 12, 2)
  tealFillLight.position.set(-3.5, -1.8, 2.8)
  scene.add(tealFillLight)
}

function sampleKeyframes(keyframes, sectionPosition) {
  if (sectionPosition <= keyframes[0].section) {
    return { ...STATE_DEFAULTS, ...keyframes[0] }
  }

  const last = keyframes[keyframes.length - 1]
  if (sectionPosition >= last.section) {
    return { ...STATE_DEFAULTS, ...last }
  }

  const rightIndex = keyframes.findIndex(
    (keyframe) => keyframe.section >= sectionPosition
  )
  const from = { ...STATE_DEFAULTS, ...keyframes[rightIndex - 1] }
  const to = { ...STATE_DEFAULTS, ...keyframes[rightIndex] }
  const range = Math.max(to.section - from.section, 0.0001)
  const amount = easeInOut(clamp((sectionPosition - from.section) / range, 0, 1))
  const result = {}

  Object.keys(STATE_DEFAULTS).forEach((property) => {
    result[property] = lerp(from[property], to[property], amount)
  })

  return result
}

function mouseFacingRotation(rotationX, rotationY, rotationZ, strength = 1) {
  return {
    x: rotationX - pointerCurrent.y * 0.42 * strength,
    y: rotationY + pointerCurrent.x * 0.82 * strength,
    z: rotationZ + pointerCurrent.x * pointerCurrent.y * 0.26 * strength
  }
}

function updateSurpriseStageModels(elapsedTime, isMobile) {
  const danceKeys = ['obj4Dance', 'samuelDance', 'dionDance']
  const requestedFocus = danceKeys.includes(props.surpriseFocus)
    ? props.surpriseFocus
    : 'obj4Dance'

  if (requestedFocus !== surpriseFocusTarget) {
    surpriseFocusFrom = surpriseFocusTarget
    surpriseFocusTarget = requestedFocus
    surpriseFocusMix = 0
  }

  surpriseFocusMix = lerp(surpriseFocusMix, 1, props.reducedMotion ? 0.18 : 0.085)

  const getSlotMap = (focus) => {
    const ordered = [focus, ...danceKeys.filter((key) => key !== focus)]
    return {
      [ordered[0]]: 0,
      [ordered[1]]: 1,
      [ordered[2]]: 2
    }
  }

  const fromSlots = getSlotMap(surpriseFocusFrom)
  const toSlots = getSlotMap(surpriseFocusTarget)
  const getSlotPosition = (slot) => {
    const sideX = isMobile ? 1.12 : 2.12
    const sideY = isMobile ? -1.03 : -0.92

    if (slot === 0) {
      return { x: 0, y: isMobile ? -0.06 : 0.02, z: -0.22 }
    }

    return {
      x: slot === 1 ? -sideX : sideX,
      y: sideY,
      z: -0.08
    }
  }

  Object.entries(modelEntries).forEach(([key, entry]) => {
    const isHero = key === 'obj4Dance'
    const isCloud = key === 'obj4'
    const isSamuel = key === 'samuelDance'
    const isDion = key === 'dionDance'

    if (!isHero && !isCloud && !isSamuel && !isDion) {
      setObjectOpacity(entry.root, 0)
      if (entry.mixer) entry.mixer.timeScale = 0
      return
    }

    let positionX = 0
    let positionY = 0
    let positionZ = -0.22
    let rotationX = 0
    let rotationY = 0
    let rotationZ = 0
    let scale = 1

    if (isHero || isSamuel || isDion) {
      const fromSlot = fromSlots[key]
      const toSlot = toSlots[key]
      const transition = easeInOut(surpriseFocusMix)
      const fromPosition = getSlotPosition(fromSlot)
      const toPosition = getSlotPosition(toSlot)
      const centerAmount = lerp(fromSlot === 0 ? 1 : 0, toSlot === 0 ? 1 : 0, transition)

      if (isHero) {
        const sideScale = isMobile ? 0.39 : 0.56
        const centerScale = isMobile ? 0.72 : window.innerWidth < 1100 ? 0.94 : 1.04
        scale = lerp(sideScale, centerScale, centerAmount)
      } else {
        const sideScale = isMobile ? 0.46 : 0.68
        scale = lerp(sideScale, sideScale * (isMobile ? 1.08 : 1.12), centerAmount)
      }

      positionX = lerp(fromPosition.x, toPosition.x, transition)
      positionY = lerp(fromPosition.y, toPosition.y, transition)
      positionZ = lerp(fromPosition.z, toPosition.z, transition)

      const sideDirection = positionX < 0 ? -1 : 1
      const baseRotationY = lerp(sideDirection * 0.1, 0, centerAmount)
      const baseRotationZ = lerp(-sideDirection * 0.035, 0, centerAmount)
      const facing = mouseFacingRotation(
        0,
        baseRotationY,
        baseRotationZ,
        lerp(0.82, 1, centerAmount)
      )
      rotationX = facing.x
      rotationY = facing.y
      rotationZ = facing.z

      if (!props.reducedMotion) {
        const phase = isHero ? 0 : key === 'samuelDance' ? 0.8 : 1.6
        positionY += Math.sin(elapsedTime * 5.2 + phase) * lerp(0.075, 0.07, centerAmount)
        rotationX += Math.sin(elapsedTime * 4.6 + phase) * lerp(0.06, 0.035, centerAmount)
        rotationY += Math.sin(elapsedTime * 3.2 + phase) * lerp(0.1, 0.12, centerAmount)
        rotationZ += Math.sin(elapsedTime * 6.4 + phase) * lerp(0.08, 0.075, centerAmount)
        scale *= 1 + Math.sin(elapsedTime * 5.2 + phase) * 0.018
      }

      if (entry.mixer) entry.mixer.timeScale = props.reducedMotion
        ? lerp(0.55, 0.6, centerAmount)
        : lerp(1.12, 1.18, centerAmount)
    } else if (isCloud) {
      positionY = isMobile ? 1.45 : 1.65
      positionZ = -0.78
      scale = isMobile ? 0.42 : 0.54
      const facing = mouseFacingRotation(0, 0, 0, 0.5)
      rotationX = facing.x
      rotationY = facing.y
      rotationZ = facing.z

      if (!props.reducedMotion) {
        positionY += Math.sin(elapsedTime * 1.6) * (isMobile ? 0.035 : 0.06)
        rotationZ += Math.sin(elapsedTime * 1.1) * 0.035
      }
      if (entry.mixer) entry.mixer.timeScale = props.reducedMotion ? 0.25 : 0.55
    }

    entry.root.position.set(positionX, positionY, positionZ)
    entry.root.rotation.set(rotationX, rotationY, rotationZ)
    entry.root.scale.setScalar(scale)
    setObjectOpacity(entry.root, 1)
  })
}

function updateCourseStageModels(elapsedTime, isMobile, sectionPosition) {
  const normalizedSection = clamp(sectionPosition, 0, Math.max(props.sectionCount - 1, 1))
  const facing = mouseFacingRotation(0.02, 0, 0, 0.72)

  Object.entries(modelEntries).forEach(([key, entry]) => {
    let opacity = 0
    let positionX = 0
    let positionY = isMobile ? -0.42 : 0.02
    let positionZ = -0.18
    let rotationX = facing.x
    let rotationY = facing.y
    let rotationZ = facing.z
    let scale = isMobile ? 0.68 : 0.98

    if (key === 'obj4') {
      opacity = 1
      positionY += Math.sin(elapsedTime * 1.7) * (isMobile ? 0.035 : 0.06)
      rotationZ += Math.sin(elapsedTime * 1.1) * 0.035
      scale *= 1 + Math.sin(elapsedTime * 1.8) * 0.018
    } else if (key === 'obj2') {
      const amount = clamp(1 - Math.abs(normalizedSection - 1.25) / 1.35, 0, 1)
      opacity = amount * 0.76
      positionX = isMobile ? 1.12 : 2.35
      positionY = isMobile ? 0.66 : 0.9
      positionZ = -0.72
      scale = (isMobile ? 0.28 : 0.48) * (0.86 + amount * 0.14)
      rotationX = facing.x + 0.1
      rotationY = facing.y - 0.2
    } else if (key === 'obj3') {
      const amount = clamp(1 - Math.abs(normalizedSection - 2.15) / 1.5, 0, 1)
      opacity = amount * 0.72
      positionX = isMobile ? -1.12 : -2.35
      positionY = isMobile ? 0.55 : 0.78
      positionZ = -0.64
      scale = (isMobile ? 0.3 : 0.5) * (0.86 + amount * 0.14)
      rotationX = facing.x - 0.08
      rotationY = facing.y + 0.2
    }

    if (entry.mixer) entry.mixer.timeScale = props.reducedMotion ? 0.35 : 0.72
    entry.root.position.set(positionX, positionY, positionZ)
    entry.root.rotation.set(rotationX, rotationY, rotationZ)
    entry.root.scale.setScalar(scale)
    setObjectOpacity(entry.root, opacity)
  })
}

function mobileActiveModelKey(sectionPosition) {
  const index = clamp(Math.round(sectionPosition), 0, MOBILE_MODEL_BY_SECTION.length - 1)
  return MOBILE_MODEL_BY_SECTION[index]
}

function updateModels(sectionPosition, elapsedTime) {
  const isMobile = window.innerWidth < 768

  if (props.surpriseStage) {
    updateSurpriseStageModels(elapsedTime, isMobile)
    return
  }

  if (props.courseStage) {
    updateCourseStageModels(elapsedTime, isMobile, sectionPosition)
    return
  }

  const horizontalScale = isMobile ? 0.28 : 1
  const verticalScale = isMobile ? 0.54 : 1
  const mobileYOffset = isMobile ? -0.72 : 0
  const modelScale = isMobile ? 0.7 : window.innerWidth < 1100 ? 0.84 : 1
  const rotationFactor = props.reducedMotion ? 0.22 : 1
  const lastSection = Math.max(props.sectionCount - 1, 0)
  const danceZoneAmount = clamp((sectionPosition - (lastSection - 0.72)) / 0.72, 0, 1)
  const danceZoneActive = danceZoneAmount > 0.01
  const activeMobileModel = isMobile ? mobileActiveModelKey(sectionPosition) : null

  Object.entries(modelEntries).forEach(([key, entry]) => {
    const keyframes = MODEL_KEYFRAMES[key]
    if (!keyframes) return
    if (key === 'intro' || props.introPhase === 'loading' || sectionPosition < 0.05 || (sectionPosition >= 2.5 && sectionPosition < 3.5)) {
      setObjectOpacity(entry.root, 0)
      return
    }

    if (isMobile && key !== activeMobileModel) {
      setObjectOpacity(entry.root, 0)
      if (entry.mixer) entry.mixer.timeScale = 0
      return
    }

    if (entry.mixer) entry.mixer.timeScale = props.reducedMotion ? 0.45 : 1

    const state = sampleKeyframes(keyframes, sectionPosition)
    if (key === 'intro') {
      const targetTransition = props.introPhase === 'loading' ? 0 : 1
      introTransitionMix = lerp(introTransitionMix, targetTransition, props.reducedMotion ? 0.12 : 0.055)
    }
    const isBaseDanceRobot = key === 'obj4'
    const isDanceRobot = key === 'obj4Dance'
    let positionY = state.y * verticalScale + mobileYOffset
    let rotationX = state.rx * rotationFactor
    let rotationY = state.ry * rotationFactor
    let rotationZ = state.rz * rotationFactor
    let scale = state.scale * modelScale
    let opacity = state.opacity

    if (key === 'intro') {
      const transition = easeInOut(introTransitionMix)
      positionY = lerp(0, positionY, transition)
      rotationX = lerp(0.08, rotationX, transition)
      rotationY = lerp(0, rotationY, transition)
      rotationZ = lerp(0, rotationZ, transition)
      scale = lerp(isMobile ? 0.88 : 1.04, scale, transition)
    }

    if (!props.soloDance) {
      const facing = mouseFacingRotation(rotationX, rotationY, rotationZ, rotationFactor)
      rotationX = facing.x
      rotationY = facing.y
      rotationZ = facing.z
    }

    if (props.soloDance) {
      if (!isDanceRobot) {
        setObjectOpacity(entry.root, 0)
        if (entry.mixer) entry.mixer.timeScale = 0
        return
      }

      const soloScale = isMobile ? 0.96 : window.innerWidth < 1100 ? 1.02 : 1.08
      positionY = isMobile ? -0.16 : 0.02
      rotationX = 0.02
      rotationY = danceYawCurrent
      rotationZ = 0
      scale = soloScale
      opacity = 1

      if (!props.reducedMotion) {
        positionY += Math.sin(elapsedTime * 5.8) * (isMobile ? 0.035 : 0.07)
        rotationX += Math.sin(elapsedTime * 4.6) * 0.035
        rotationY += Math.sin(elapsedTime * 3.2) * 0.16
        rotationZ += Math.sin(elapsedTime * 6.4) * 0.075
        scale *= 1 + Math.sin(elapsedTime * 5.2) * 0.018
      }

      if (entry.mixer) entry.mixer.timeScale = props.reducedMotion ? 0.6 : 1.18

      entry.root.position.set(0, positionY, -0.22)
      entry.root.rotation.set(rotationX, rotationY, rotationZ)
      entry.root.scale.setScalar(scale)
      setObjectOpacity(entry.root, opacity)
      return
    }

    if (danceZoneActive && (isBaseDanceRobot || isDanceRobot)) {
      if (isBaseDanceRobot) {
        opacity *= props.danceActive ? 1 - danceZoneAmount : 1
      } else {
        opacity *= props.danceActive ? danceZoneAmount : 0
      }
      positionY = state.y * verticalScale + (isMobile ? -0.1 : 0)
      scale *= lerp(1, isMobile ? 1.28 : 1.16, danceZoneAmount)

      if (props.danceActive && isDanceRobot && !props.reducedMotion) {
        positionY += Math.sin(elapsedTime * 5.8) * 0.07 * verticalScale
        rotationX += Math.sin(elapsedTime * 4.6) * 0.035
        rotationY += Math.sin(elapsedTime * 3.2) * 0.16
        rotationZ += Math.sin(elapsedTime * 6.4) * 0.075
        scale *= 1 + Math.sin(elapsedTime * 5.2) * 0.018
      }

      if (entry.mixer) {
        entry.mixer.timeScale = props.danceActive && isDanceRobot
          ? props.reducedMotion ? 0.6 : 1.18
          : isDanceRobot ? 0 : entry.mixer.timeScale
      }
    } else if (isDanceRobot) {
      opacity = 0
      if (entry.mixer) entry.mixer.timeScale = 0
    }

    entry.root.position.set(state.x * horizontalScale, positionY, state.z)
    entry.root.rotation.set(rotationX, rotationY, rotationZ)
    entry.root.scale.setScalar(scale)
    setObjectOpacity(entry.root, opacity)
  })
}

function updateScene(elapsedTime, deltaTime) {
  const smoothing = props.reducedMotion ? 0.16 : 0.075
  smoothProgress = lerp(smoothProgress, props.scrollProgress, smoothing)
  const sectionPosition = props.soloDance
    ? Math.max(props.sectionCount - 1, 9)
    : smoothProgress * Math.max(props.sectionCount - 1, 0)

  queueNearbyModelLoads(sectionPosition)

  pointerCurrent.lerp(pointerTarget, props.reducedMotion ? 0.03 : 0.055)
  danceYawCurrent = lerp(danceYawCurrent, danceYawTarget, props.reducedMotion ? 0.055 : 0.09)

  const zoom = props.surpriseStage ? clamp(props.surpriseZoom, 0.82, 1.34) : 1
  camera.position.z = baseCameraZ / zoom
  camera.position.x = pointerCurrent.x * (props.reducedMotion ? 0.025 : 0.16)
  camera.position.y = pointerCurrent.y * (props.reducedMotion ? 0.02 : 0.1)
  camera.lookAt(0, 0, 0)

  introTransitionMix = lerp(introTransitionMix, props.introPhase === 'loading' ? 0 : 1, props.reducedMotion ? 1 : 0.055)
  starField.rotation.y += deltaTime * (props.reducedMotion ? 0.0008 : 0.004)
  starField.rotation.x = pointerCurrent.y * 0.018
  starField.position.y = props.soloDance
    ? 0
    : -smoothProgress * (props.reducedMotion ? 0.25 : 1.35)
  starField.position.x = pointerCurrent.x * -0.22

  if (starFieldIsDesktop) {
    const targetX = pointerCurrent.x * 8 - starField.position.x
    const targetY = pointerCurrent.y * 4.2 - starField.position.y
    starField.children.forEach((layer) => {
      updateThreadStarLayer(layer, elapsedTime, targetX, targetY)
    })
  }

  Object.values(modelEntries).forEach((entry) => {
    entry.mixer?.update(deltaTime)
  })

  updateModels(sectionPosition, elapsedTime)
}

function renderFrame(time) {
  if (destroyed || !renderer || !pageVisible || webglContextLost) {
    animationFrame = 0
    return
  }

  const isMobile = window.innerWidth < 768
  const isLowPowerDevice = Number(navigator.deviceMemory || 4) <= 4 ||
    Number(navigator.hardwareConcurrency || 4) <= 4
  const frameInterval = isMobile
    ? 1000 / (isLowPowerDevice ? 30 : 45)
    : 1000 / 60

  if (lastFrameTime && time - lastFrameTime < frameInterval) {
    animationFrame = window.requestAnimationFrame(renderFrame)
    return
  }

  const deltaTime = Math.min((time - lastFrameTime) / 1000, 0.05)
  lastFrameTime = time
  updateScene(time / 1000, deltaTime)
  try {
    renderer.render(scene, camera)
  } catch (error) {
    webglContextLost = true
    animationFrame = 0
    console.warn('[Landing 3D] O navegador interrompeu a renderizacao WebGL. O conteudo HTML continuara disponivel.', error)
    emitSceneReady()
    return
  }
  animationFrame = window.requestAnimationFrame(renderFrame)
}

function rendererPixelRatio() {
  const isMobile = window.innerWidth < 768
  const deviceMemory = Number(navigator.deviceMemory || 4)
  const hardwareConcurrency = Number(navigator.hardwareConcurrency || 4)
  const maximum = isMobile
    ? deviceMemory <= 4 || hardwareConcurrency <= 4 ? 1 : 1.25
    : deviceMemory <= 4 ? 1.5 : 1.75
  return Math.min(window.devicePixelRatio || 1, maximum)
}

function handleResize() {
  if (!renderer || !camera) return

  const width = window.innerWidth
  const height = window.innerHeight

  if (starField && scene && starFieldIsDesktop !== (width >= 768)) {
    const previousStarField = starField
    starField = createStarField()
    scene.remove(previousStarField)
    disposeObject(previousStarField)
    scene.add(starField)
  }

  camera.aspect = width / Math.max(height, 1)
  baseCameraZ = width < 768 ? 9.4 : width < 1100 ? 9 : 8.4
  camera.position.z = baseCameraZ / (props.surpriseStage ? clamp(props.surpriseZoom, 0.82, 1.34) : 1)
  camera.updateProjectionMatrix()

  renderer.setPixelRatio(rendererPixelRatio())
  renderer.setSize(width, height, false)
}

function handlePointerMove(event) {
  const pointerX = (event.clientX / window.innerWidth) * 2 - 1
  const pointerY = -((event.clientY / window.innerHeight) * 2 - 1)

  pointerTarget.set(
    pointerX,
    pointerY
  )
  danceYawTarget = pointerX * Math.PI
}

function modelKeyFromObject(object) {
  let current = object

  while (current) {
    const entry = Object.entries(modelEntries).find(([, modelEntry]) => modelEntry.root === current)
    if (entry) return entry[0]
    current = current.parent
  }

  return null
}

function handlePointerDown(event) {
  if (
    !props.surpriseStage ||
    !readyEmitted ||
    (event.button !== undefined && event.button > 1)
  ) return

  const target = event.target
  if (target?.closest?.('button, a, input, textarea, select, [role="button"], .q-dialog')) return

  const width = Math.max(window.innerWidth, 1)
  const height = Math.max(window.innerHeight, 1)
  raycastPointer.set(
    (event.clientX / width) * 2 - 1,
    -((event.clientY / height) * 2 - 1)
  )
  raycaster.setFromCamera(raycastPointer, camera)

  const clickableRoots = ['obj4Dance', 'samuelDance', 'dionDance']
    .map((key) => modelEntries[key]?.root)
    .filter(Boolean)
  const intersections = raycaster.intersectObjects(clickableRoots, true)
  let selectedKey = intersections
    .map(({ object }) => modelKeyFromObject(object))
    .find((key) => ['obj4Dance', 'samuelDance', 'dionDance'].includes(key))

  if (!selectedKey) {
    const focus = ['obj4Dance', 'samuelDance', 'dionDance'].includes(props.surpriseFocus)
      ? props.surpriseFocus
      : 'obj4Dance'
    const orderedKeys = [
      focus,
      ...['obj4Dance', 'samuelDance', 'dionDance'].filter((key) => key !== focus)
    ]
    const normalizedX = event.clientX / width
    const normalizedY = event.clientY / height

    if (normalizedY > 0.3 && normalizedY < 0.8) {
      const slot = normalizedX < 0.33 ? 1 : normalizedX > 0.67 ? 2 : 0
      selectedKey = orderedKeys[slot]
    }
  }

  if (selectedKey) emit('model-select', selectedKey)
}

function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose()
  })
  material.dispose()
}

function disposeObject(root) {
  root?.traverse((child) => {
    child.geometry?.dispose()

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial)
    } else if (child.material) {
      disposeMaterial(child.material)
    }
  })
}

function handleVisibilityChange() {
  pageVisible = !document.hidden

  if (!pageVisible) {
    window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
    return
  }

  lastFrameTime = performance.now()
  if (!animationFrame && renderer && !destroyed && !webglContextLost) {
    animationFrame = window.requestAnimationFrame(renderFrame)
  }
}

function handleContextLost(event) {
  event.preventDefault()
  webglContextLost = true
  window.cancelAnimationFrame(animationFrame)
  animationFrame = 0
  emitSceneReady()
}

function handleContextRestored() {
  webglContextLost = false
  lastFrameTime = performance.now()
  if (!animationFrame && renderer && !destroyed && pageVisible) {
    animationFrame = window.requestAnimationFrame(renderFrame)
  }
}

function initializeScene() {
  pageVisible = !document.hidden
  webglContextLost = false
  pointerTarget.set(0, 0)
  pointerCurrent.set(0, 0)
  danceYawTarget = 0
  danceYawCurrent = 0

  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x05090c, 0.028)

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  baseCameraZ = 8.4
  camera.position.set(0, 0, baseCameraZ)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement.value,
    alpha: true,
    antialias: window.innerWidth >= 768,
    powerPreference: window.innerWidth < 768 ? 'low-power' : 'high-performance'
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03
  renderer.setClearColor(0x000000, 0)
  canvasElement.value?.addEventListener('webglcontextlost', handleContextLost, false)
  canvasElement.value?.addEventListener('webglcontextrestored', handleContextRestored, false)

  starField = createStarField()
  scene.add(starField)
  createLights()
  createModelRoots()
  loadModels()
    .then(() => {
      window.requestAnimationFrame(() => {
        if (!destroyed) emitSceneReady()
      })
    })
    .catch((error) => {
      console.warn('[Landing 3D] Houve uma falha ao preparar os objetos 3D.', error)
      emitSceneReady()
    })
  handleResize()
}

onMounted(() => {
  try {
    initializeScene()
  } catch (error) {
    console.warn(
      '[Landing 3D] WebGL não pôde ser inicializado. O conteúdo HTML continuará disponível.',
      error
    )
    window.setTimeout(emitSceneReady, 300)
    return
  }

  window.addEventListener('resize', handleResize, { passive: true })
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerdown', handlePointerDown, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  animationFrame = window.requestAnimationFrame(renderFrame)
})

onBeforeUnmount(() => {
  destroyed = true
  window.cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  canvasElement.value?.removeEventListener('webglcontextlost', handleContextLost)
  canvasElement.value?.removeEventListener('webglcontextrestored', handleContextRestored)
  Object.values(modelEntries).forEach(clearModelAnimation)
  disposeObject(scene)
  renderer?.renderLists?.dispose()
  renderer?.dispose()
  try {
    renderer?.forceContextLoss?.()
  } catch (error) {
    console.warn('[Landing 3D] Nao foi possivel liberar o contexto WebGL.', error)
  }

  scene = null
  camera = null
  renderer = null
  starField = null
  modelEntries = {}
  modelLoader = undefined
  modelLoadQueue = []
  modelLoadActive = 0
  modelLoadPromises.clear()
  modelLoadResolvers.clear()
  modelSettledKeys.clear()
})
</script>

<style scoped>
.aito-three-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.aito-three-scene.is-interactive {
  pointer-events: auto;
  touch-action: manipulation;
}
</style>
