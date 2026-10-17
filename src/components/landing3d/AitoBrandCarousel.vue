<template>
  <div
    class="brand-carousel"
    role="region"
    aria-roledescription="carrossel"
    aria-label="Cases e produtos"
    @keydown.left.prevent="stepBrand(-1)"
    @keydown.right.prevent="stepBrand(1)"
    @keydown.home.prevent="focusBrand(0)"
    @keydown.end.prevent="focusBrand(normalizedBrands.length - 1)"
  >
    <canvas ref="canvas" class="brand-carousel__canvas" aria-hidden="true"></canvas>
    <div class="brand-carousel__hint">
      <q-icon name="mdi-gesture-swipe-horizontal" size="17px" aria-hidden="true" />
      <span>Arraste para explorar</span>
    </div>
    <button
      class="brand-carousel__active"
      type="button"
      :disabled="!activeBrand"
      :aria-label="activeBrand ? `Conhecer o projeto ${activeBrand.name}` : 'Nenhum projeto disponível'"
      @click="openSelectedBrand"
    >
      <span aria-live="polite" aria-atomic="true">{{ activeBrand?.name }}</span>
      <small>Conhecer projeto ↗</small>
    </button>
    <div class="brand-carousel__controls" aria-label="Navegação dos projetos">
      <button type="button" aria-label="Projeto anterior" :disabled="activeIndex <= 0" @click="stepBrand(-1)">
        <q-icon name="mdi-chevron-left" size="23px" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Próximo projeto" :disabled="activeIndex >= normalizedBrands.length - 1" @click="stepBrand(1)">
        <q-icon name="mdi-chevron-right" size="23px" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  brands: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select'])
const canvas = ref(null)
const activeIndex = ref(Math.floor(props.brands.length / 2))

const normalizedBrands = computed(() => props.brands.map((brand) => ({
  ...brand,
  shortLabel: brand.name.split(' ').slice(0, 2).join(' ')
})))
const activeBrand = computed(() => normalizedBrands.value[activeIndex.value])

let scene
let camera
let renderer
let carouselGroup
let animationFrame = 0
let destroyed = false
let targetOffset = 0
let currentOffset = 0
let pointerX = 0
let pointerY = 0
let dragStartX = 0
let dragStartY = 0
let dragStartOffset = 0
let dragDistance = 0
let isDragging = false
let lastFrame = 0
let resizeObserver
let raycaster
let pointer
let layoutRows = 0
let activeRow = 0
const coins = []

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const lerp = (start, end, amount) => start + (end - start) * amount

function carouselLayout() {
  const rows = window.innerWidth < 768 && coins.length > 1 ? 2 : 1
  const columns = Math.ceil(coins.length / rows)
  return { rows, columns, center: Math.max(columns - 1, 0) / 2 }
}

function limitOffset(offset) {
  const { center } = carouselLayout()
  return clamp(offset, -center, center)
}

function focusBrand(index) {
  if (!normalizedBrands.value.length) return
  const nextIndex = clamp(index, 0, normalizedBrands.value.length - 1)
  const { rows, center } = carouselLayout()
  activeRow = nextIndex % rows
  targetOffset = center - Math.floor(nextIndex / rows)
  activeIndex.value = nextIndex
}

function stepBrand(direction) {
  focusBrand(activeIndex.value + direction)
}

function openSelectedBrand() {
  if (activeBrand.value) emit('select', activeBrand.value)
}

function initials(label) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function createCoinTexture(brand) {
  const size = 512
  const surface = document.createElement('canvas')
  surface.width = size
  surface.height = size
  const context = surface.getContext('2d')
  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace

  const drawFallback = () => {
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#f7fffd')
    gradient.addColorStop(0.52, '#d2e8e5')
    gradient.addColorStop(1, '#6aa49d')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    context.fillStyle = '#062c2a'
    context.font = '800 112px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(initials(brand.name), size / 2, size / 2 - 4)
    context.font = '700 22px Arial'
    context.fillText(brand.name.slice(0, 22), size / 2, size - 60)
    texture.needsUpdate = true
  }

  drawFallback()

  if (brand.imgUrl) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const background = context.createLinearGradient(0, 0, size, size)
      background.addColorStop(0, '#ffffff')
      background.addColorStop(1, '#a9d6d0')
      context.fillStyle = background
      context.fillRect(0, 0, size, size)

      const inset = 82
      const ratio = Math.min((size - inset * 2) / image.width, (size - inset * 2) / image.height)
      const width = image.width * ratio
      const height = image.height * ratio
      context.drawImage(image, (size - width) / 2, (size - height) / 2 - 12, width, height)
      context.fillStyle = 'rgba(3, 36, 34, 0.72)'
      context.fillRect(0, size - 52, size, 52)
      context.fillStyle = '#dffff8'
      context.font = '700 20px Arial'
      context.textAlign = 'center'
      context.fillText(brand.name.slice(0, 26), size / 2, size - 20)
      texture.needsUpdate = true
    }
    image.onerror = () => {}
    image.src = brand.imgUrl
  }

  return texture
}

function createCoin(brand, index) {
  const group = new THREE.Group()
  group.userData.brand = brand
  group.userData.index = index
  group.userData.hoverLift = 0
  group.userData.hoverPush = 0
  group.userData.hoverTilt = 0

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 0.94, 0.16, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x13bc9d,
      metalness: 0.82,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: 0x063f3a,
      emissiveIntensity: 0.22
    })
  )
  body.rotation.x = Math.PI / 2
  group.add(body)

  const front = new THREE.Mesh(
    new THREE.CircleGeometry(0.83, 64),
    new THREE.MeshBasicMaterial({ map: createCoinTexture(brand), transparent: true })
  )
  front.position.z = 0.095
  group.add(front)

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.035, 12, 80),
    new THREE.MeshStandardMaterial({
      color: 0xc8fff6,
      metalness: 0.75,
      roughness: 0.18,
      emissive: 0x13bc9d,
      emissiveIntensity: 0.42
    })
  )
  rim.position.z = 0.11
  group.add(rim)

  carouselGroup.add(group)
  coins.push(group)
}

function updateCoins(time, delta) {
  const { rows, center } = carouselLayout()
  const mobile = rows === 2
  const spacing = mobile ? 2.02 : 2.08
  const depthStep = mobile ? 0.14 : 0.3
  const hoverIndex = coins.findIndex((coin) => coin.userData.hovered)
  const smoothAmount = 1 - Math.pow(0.0008, Math.max(delta, 0.001))

  coins.forEach((coin, index) => {
    const column = Math.floor(index / rows)
    const row = index % rows
    const offset = column - center + currentOffset
    const distance = Math.abs(offset)
    const hovered = index === hoverIndex
    const distanceFromHover = hoverIndex >= 0 ? column - Math.floor(hoverIndex / rows) : 0
    const pushDirection = Math.sign(distanceFromHover)
    const pushStrength = hoverIndex >= 0 && !hovered && row === hoverIndex % rows
      ? 0.38 * Math.exp(-Math.abs(distanceFromHover) * 0.9)
      : 0
    const hoverLiftTarget = hovered ? 0.13 : 0
    const hoverPushTarget = pushDirection * pushStrength
    const hoverTiltTarget = hovered ? -0.075 : 0

    coin.userData.hoverLift = lerp(coin.userData.hoverLift, hoverLiftTarget, smoothAmount)
    coin.userData.hoverPush = lerp(coin.userData.hoverPush, hoverPushTarget, smoothAmount)
    coin.userData.hoverTilt = lerp(coin.userData.hoverTilt, hoverTiltTarget, smoothAmount)

    coin.position.x = offset * spacing + coin.userData.hoverPush
    coin.position.y = (mobile ? (row === 0 ? 1.2 : -0.9) : 0.2 - offset * 0.035) + coin.userData.hoverLift
    coin.position.z = -0.36 - Math.min(distance, 4) * depthStep + coin.userData.hoverLift * 0.22
    coin.rotation.y = Math.sin(offset * 0.44) * (mobile ? 0.13 : 0.24) + pointerX * 0.06
    coin.rotation.x = coin.userData.hoverTilt + offset * 0.015
    coin.rotation.z = Math.sin(time * 0.6 + index) * 0.012
    const scale = mobile ? 0.91 : Math.max(0.72, 1.04 - distance * 0.055)
    const focused = distance < 0.46
    coin.scale.setScalar(focused ? scale * 1.025 : scale)
    coin.children[0].material.emissiveIntensity = focused ? 0.56 : 0.22
    coin.children[2].material.emissiveIntensity = focused ? 0.92 : 0.42
  })

  const columnIndex = clamp(Math.round(center - targetOffset), 0, Math.ceil(coins.length / rows) - 1)
  const nextIndex = Math.min(columnIndex * rows + activeRow, coins.length - 1)
  if (nextIndex !== activeIndex.value) activeIndex.value = nextIndex
}

function updatePointer(event) {
  const rect = canvas.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  pointerX = pointer.x
  pointerY = pointer.y
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(coins, true)[0]
  const hitCoin = getCoinFromHit(hit)
  coins.forEach((coin) => {
    coin.userData.hovered = coin === hitCoin
  })
}

function getCoinFromHit(hit) {
  let object = hit?.object

  while (object && object !== carouselGroup) {
    if (Number.isInteger(object.userData?.index)) return object
    object = object.parent
  }

  return null
}

function handlePointerDown(event) {
  updatePointer(event)
  isDragging = true
  dragDistance = 0
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartOffset = targetOffset
  canvas.value.setPointerCapture?.(event.pointerId)
}

function handlePointerMove(event) {
  updatePointer(event)
  if (!isDragging) return
  dragDistance = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY)
  const sensitivity = window.innerWidth < 768 ? 0.009 : 0.007
  targetOffset = limitOffset(dragStartOffset + (event.clientX - dragStartX) * sensitivity)
}

function handlePointerUp(event) {
  if (!isDragging) return
  isDragging = false
  canvas.value.releasePointerCapture?.(event.pointerId)

  if (dragDistance > 8) return

  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(coins, true)[0]
  const hitCoin = getCoinFromHit(hit)
  const index = hitCoin?.userData?.index
  if (Number.isInteger(index)) {
    focusBrand(index)
    openSelectedBrand()
  }
}

function handlePointerCancel(event) {
  if (!isDragging) return
  isDragging = false
  canvas.value.releasePointerCapture?.(event.pointerId)
}

function handlePointerLeave() {
  coins.forEach((coin) => {
    coin.userData.hovered = false
  })
}

function handleWheel(event) {
  // Vertical scrolling keeps navigating the landing page; horizontal gestures
  // and Shift + wheel explore the medals without changing sections.
  if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
  event.preventDefault()
  event.stopPropagation()
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  targetOffset = limitOffset(targetOffset - Math.sign(delta) * 0.58)
}

function handleResize() {
  if (!renderer || !camera || !canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const { rows, center } = carouselLayout()
  if (rows !== layoutRows) {
    layoutRows = rows
    activeRow = activeIndex.value % rows
    targetOffset = center - Math.floor(activeIndex.value / rows)
    currentOffset = targetOffset
  }
  camera.aspect = rect.width / Math.max(rect.height, 1)
  camera.position.z = rows === 2 ? 8.3 : 8
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(rect.width, rect.height, false)
}

function animate(time) {
  if (destroyed) return
  const delta = Math.min((time - lastFrame) / 1000, 0.05)
  lastFrame = time
  currentOffset = lerp(currentOffset, targetOffset, 1 - Math.pow(0.002, delta))
  carouselGroup.rotation.y = lerp(carouselGroup.rotation.y, pointerX * 0.06, 0.08)
  carouselGroup.position.y = lerp(carouselGroup.position.y, pointerY * 0.05, 0.08)
  updateCoins(time / 1000, delta)
  renderer.render(scene, camera)
  animationFrame = window.requestAnimationFrame(animate)
}

function initialize() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  camera.position.set(0, 0.1, 8)
  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.setClearColor(0x000000, 0)
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  carouselGroup = new THREE.Group()
  carouselGroup.position.y = 0.18
  scene.add(carouselGroup)
  normalizedBrands.value.forEach(createCoin)

  scene.add(new THREE.AmbientLight(0xc9f4ef, 1.4))
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
  keyLight.position.set(3, 5, 6)
  scene.add(keyLight)
  const tealLight = new THREE.PointLight(0x13bc9d, 28, 12, 2)
  tealLight.position.set(-3, 1.5, 3.8)
  scene.add(tealLight)

  handleResize()
  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(canvas.value)
  canvas.value.addEventListener('pointerdown', handlePointerDown)
  canvas.value.addEventListener('pointermove', handlePointerMove)
  canvas.value.addEventListener('pointerup', handlePointerUp)
  canvas.value.addEventListener('pointercancel', handlePointerCancel)
  canvas.value.addEventListener('pointerleave', handlePointerLeave)
  canvas.value.addEventListener('wheel', handleWheel, { passive: false })
  animationFrame = window.requestAnimationFrame(animate)
}

onMounted(() => {
  try {
    initialize()
  } catch (error) {
    console.warn('[Landing 3D] Nao foi possivel iniciar o carrossel de marcas.', error)
  }
})

onBeforeUnmount(() => {
  destroyed = true
  window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  canvas.value?.removeEventListener('pointerdown', handlePointerDown)
  canvas.value?.removeEventListener('pointermove', handlePointerMove)
  canvas.value?.removeEventListener('pointerup', handlePointerUp)
  canvas.value?.removeEventListener('pointercancel', handlePointerCancel)
  canvas.value?.removeEventListener('pointerleave', handlePointerLeave)
  canvas.value?.removeEventListener('wheel', handleWheel)
  scene?.traverse((child) => {
    child.geometry?.dispose()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else child.material?.dispose()
    child.material?.map?.dispose()
  })
  renderer?.dispose()
  renderer?.forceContextLoss()
})
</script>

<style scoped>
.brand-carousel {
  position: relative;
  width: 100%;
  min-height: min(58vh, 34rem);
  overflow: hidden;
}

.brand-carousel__canvas {
  display: block;
  width: 100%;
  height: min(58vh, 34rem);
  touch-action: pan-y;
  cursor: grab;
}

.brand-carousel__canvas:active {
  cursor: grabbing;
}

.brand-carousel__hint,
.brand-carousel__active {
  position: absolute;
  z-index: 2;
  border: 1px solid rgba(19, 188, 157, 0.28);
  color: rgba(223, 255, 248, 0.72);
  background: rgba(3, 17, 19, 0);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.brand-carousel__hint {
  right: 1rem;
  top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.58rem 0.8rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.02em;
}

.brand-carousel__hint .q-icon {
  color: #57d6be;
  font-size: 1rem;
}

.brand-carousel__active {
  left: 1rem;
  bottom: 0.8rem;
  display: grid;
  gap: 0.1rem;
  min-width: 9.5rem;
  padding: 0.58rem 0.8rem;
  border-radius: 0.75rem;
  max-width: calc(100% - 8rem);
  text-align: left;
  cursor: pointer;
}

.brand-carousel__controls {
  position: absolute;
  right: 1rem;
  bottom: 0.8rem;
  display: flex;
  gap: 0.4rem;
}

.brand-carousel__controls button {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(19, 188, 157, 0.4);
  border-radius: 50%;
  color: #dffff8;
  background: rgba(3, 17, 19, 0.85);
  cursor: pointer;
}

.brand-carousel__active:hover,
.brand-carousel__controls button:hover:not(:disabled) {
  border-color: #8fffee;
  background: rgba(19, 188, 157, 0.14);
}

.brand-carousel button:focus-visible {
  outline: 2px solid #8fffee;
  outline-offset: 3px;
}

.brand-carousel button:disabled {
  opacity: 0.38;
  cursor: default;
}

.brand-carousel__active span {
  color: #f3fffc;
  font-size: 0.82rem;
  font-weight: 800;
}

.brand-carousel__active small {
  color: #13bc9d;
  font-size: 0.62rem;
  text-transform: uppercase;
}

@media (max-width: 767px) {
  .brand-carousel,
  .brand-carousel__canvas {
    min-height: 22rem;
    height: 22rem;
  }

  .brand-carousel__hint {
    right: 0.7rem;
    top: 0.55rem;
    max-width: 10rem;
    font-size: 0.58rem;
  }

  .brand-carousel__active {
    left: 0.7rem;
    bottom: 0.55rem;
    min-width: 8rem;
    padding: 0.46rem 0.6rem;
  }

  .brand-carousel__controls {
    right: 0.7rem;
    bottom: 0.55rem;
  }

  .brand-carousel__hint span {
    display: none;
  }
}
</style>
