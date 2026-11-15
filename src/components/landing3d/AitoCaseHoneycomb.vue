<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  items: { type: Array, required: true },
  layer: { type: Object, default: null },
  introPhase: { type: String, default: 'complete' },
  reducedMotion: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])
const $q = useQuasar()
const grid = ref(null)
const columns = computed(() => $q.screen.width < 650 ? 3 : $q.screen.width < 1080 ? 5 : 7)
const rows = computed(() => {
  const result = []
  let start = 0
  while (start < props.items.length) {
    const size = columns.value - (result.length % 2)
    result.push(props.items.slice(start, start + size))
    start += size
  }
  return result
})

const dot = [[50, 0], [75, 7], [93, 25], [100, 50], [93, 75], [75, 93], [50, 100], [25, 93], [7, 75], [0, 50], [7, 25], [25, 7]]
const hex = [[50, 2], [75, 13.5], [100, 25], [100, 50], [100, 75], [75, 86.5], [50, 98], [25, 86.5], [0, 75], [0, 50], [0, 25], [25, 13.5]]
const clamp = value => Math.min(1, Math.max(0, value))
const mix = (a, b, amount) => a + (b - a) * amount
const ease = value => value * value * (3 - 2 * value)
const scatter = index => {
  const seed = Math.sin(index * 127.1 + 19.7) * 43758.5453 + .5
  return seed - Math.floor(seed)
}

let frame = 0
let layoutObserver
let dirty = true
let cells = []
let docked = false
let dockStartedAt = 0
let morphStartedAt = 0
let morph = props.introPhase === 'loading' ? 0 : 1
let lastShape = -1
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

function scheduleFrame() {
  if (!frame && props.layer) frame = window.requestAnimationFrame(draw)
}

function invalidateLayout() {
  dirty = true
  scheduleFrame()
}

function measureCells(gridRect) {
  const previous = new Map(cells.map(cell => [cell.particle.dataset.caseParticle, cell]))
  const particles = [...props.layer.querySelectorAll('[data-case-particle]')]
  cells = [...grid.value.querySelectorAll('[data-case-slot]')].map((slot, index) => {
    const particle = particles[index]
    const rect = slot.getBoundingClientRect()
    const prior = previous.get(particle.dataset.caseParticle)
    return {
      particle, slot, control: slot.firstElementChild,
      x: rect.left - gridRect.left + rect.width / 2,
      y: rect.top - gridRect.top + rect.height / 2,
      width: rect.width, height: rect.height,
      progress: prior?.progress ?? 0, from: prior?.from ?? 0,
      spreadX: scatter(index * 3), spreadY: scatter(index * 3 + 1),
      delay: scatter(index * 3 + 2) * 350,
    }
  })
  for (const { particle, width, height } of cells) {
    particle.style.width = `${width}px`
    particle.style.height = `${height}px`
  }
  dirty = false
}

function draw(now) {
  frame = 0
  const { layer, introPhase, reducedMotion } = props
  if (!layer || !grid.value) return
  const gridRect = grid.value.getBoundingClientRect()
  if (dirty) measureCells(gridRect)

  const width = layer.clientWidth
  const height = layer.clientHeight
  const shouldDock = introPhase !== 'loading' && gridRect.top < height * (docked ? .98 : .86) && gridRect.bottom > height * (docked ? .03 : .15)
  if (shouldDock !== docked) {
    docked = shouldDock
    dockStartedAt = now
    for (const cell of cells) cell.from = cell.progress
  }

  if (introPhase !== 'loading' && !morphStartedAt && morph < 1) morphStartedAt = now
  if (reducedMotion) morph = 1
  else if (morphStartedAt) morph = ease(clamp((now - morphStartedAt) / 1100))

  if (morph !== lastShape) {
    layer.style.setProperty('--case-light', `${(1 - morph) * 100}%`)
    layer.style.setProperty('--case-shape', `polygon(${dot.map(([x, y], index) =>
      `${mix(x, hex[index][0], morph)}% ${mix(y, hex[index][1], morph)}%`
    ).join(',')})`)
    lastShape = morph
  }

  pointer.x = mix(pointer.x, pointer.targetX, .09)
  pointer.y = mix(pointer.y, pointer.targetY, .09)
  const movingPointer = Math.hypot(pointer.targetX - pointer.x, pointer.targetY - pointer.y) > .002
  const scatterColumns = width < 650 ? 4 : 6
  const scatterRows = Math.ceil(cells.length / scatterColumns)
  let traveling = false

  for (const [index, cell] of cells.entries()) {
    const { particle, slot, control, spreadX, spreadY } = cell
    const time = clamp((now - dockStartedAt - cell.delay) / (docked ? 1120 : 940))
    const target = docked ? 1 : 0
    cell.progress = reducedMotion ? 1 : mix(cell.from, target, ease(time))
    traveling ||= cell.progress !== target
    const progress = control.matches(':focus-visible') ? 1 : cell.progress
    const backgroundX = width * (.045 + .91 * ((index % scatterColumns + .18 + spreadX * .64) / scatterColumns))
    const backgroundY = height * (.075 + .85 * ((Math.floor(index / scatterColumns) + .18 + spreadY * .64) / scatterRows))
    const x = mix(backgroundX + pointer.x * (11 + spreadY * 15) * morph, gridRect.left + cell.x, progress)
    const y = mix(backgroundY + pointer.y * (9 + spreadX * 11) * morph, gridRect.top + cell.y, progress) - Math.sin(progress * Math.PI) * (14 + spreadY * 27)
    const scale = mix(mix(3.5, 8 + spreadX * 5, morph) / (cell.width || 1), 1, progress)
    const rotate = (spreadX - .5) * 58 * morph * (1 - progress)
    const label = ease(clamp((progress - .72) / .28))

    particle.style.transform = `translate3d(${x - cell.width / 2}px,${y - cell.height / 2}px,0) rotate(${rotate}deg) scale(${scale})`
    particle.style.opacity = mix(.82, 1, progress)
    particle.style.setProperty('--case-fill', ease(clamp((progress - .15) / .7)))
    particle.classList.toggle('is-highlighted', label > .9 && control.matches(':hover, :focus-visible'))
    slot.style.setProperty('--case-label', label)
    slot.classList.toggle('is-arrived', progress >= .88)
  }

  if (!reducedMotion && (traveling || movingPointer || (morphStartedAt && morph < 1))) scheduleFrame()
}

function movePointer(event) {
  if (props.reducedMotion || event.pointerType === 'touch') return
  pointer.targetX = event.clientX / window.innerWidth * 2 - 1
  pointer.targetY = event.clientY / window.innerHeight * 2 - 1
  scheduleFrame()
}

function leaveViewport(event) {
  if (event.relatedTarget) return
  pointer.targetX = 0
  pointer.targetY = 0
  scheduleFrame()
}

watch([() => props.layer, columns, () => props.items], invalidateLayout, { flush: 'post' })
watch([() => props.introPhase, () => props.reducedMotion], scheduleFrame)

onMounted(() => {
  layoutObserver = new ResizeObserver(invalidateLayout)
  layoutObserver.observe(grid.value)
  window.addEventListener('resize', invalidateLayout, { passive: true })
  window.addEventListener('scroll', scheduleFrame, { passive: true })
  window.addEventListener('pointermove', movePointer, { passive: true })
  window.addEventListener('pointerout', leaveViewport, { passive: true })
  scheduleFrame()
})

onBeforeUnmount(() => {
  layoutObserver.disconnect()
  window.cancelAnimationFrame(frame)
  window.removeEventListener('resize', invalidateLayout)
  window.removeEventListener('scroll', scheduleFrame)
  window.removeEventListener('pointermove', movePointer)
  window.removeEventListener('pointerout', leaveViewport)
})
</script>

<template>
  <Teleport v-if="layer" :to="layer">
    <span v-for="item in items" :key="item.name" class="case-hive__particle" :data-case-particle="item.name"></span>
  </Teleport>
  <div ref="grid" class="case-hive" :style="{ '--columns': columns }" aria-label="Produtos e cases" @focusin="scheduleFrame" @focusout="scheduleFrame" @pointerover="scheduleFrame" @pointerout="scheduleFrame">
    <ul v-for="(row, index) in rows" :key="index" class="case-hive__row">
      <li v-for="item in row" :key="item.name" data-case-slot>
        <component
          :is="item.product ? 'router-link' : item.direct ? 'a' : 'button'"
          v-bind="item.product ? { to: item.href } : item.direct
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
            : { type: 'button' }"
          class="case-hive__cell"
          @click="!item.product && !item.direct && emit('select', item)"
        >
          <span class="case-hive__label"><img :src="'/' + item.imgUrl.replace(/^\//, '')" alt="" loading="lazy" width="48" height="48" /><strong>{{ item.name }}</strong></span>
        </component>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.case-hive{--cell-width:min(calc((100% - (var(--columns) - 1) * 7px) / var(--columns)),166px);width:min(1220px,100%);margin:0 auto;isolation:isolate}
.case-hive__row{display:flex;justify-content:center;gap:7px;list-style:none;margin:0;padding:0}.case-hive__row+.case-hive__row{margin-top:clamp(-29px,-2vw,-11px)}.case-hive__row>li{flex:0 0 var(--cell-width);min-width:0;aspect-ratio:1.03;position:relative}
.case-hive__cell{display:grid;place-items:center;width:100%;height:100%;padding:0;position:relative;border:0;background:none;color:#edf9f5;text-decoration:none;font:inherit;cursor:pointer;border-radius:18px}.case-hive__cell:focus-visible{outline:2px solid #bdffe9;outline-offset:2px;z-index:2}
.case-hive__row>li:not(.is-arrived) .case-hive__cell{pointer-events:none}
.case-hive__particle{position:absolute;top:0;left:0;clip-path:var(--case-shape);background:linear-gradient(150deg,#7ce4cb,#214942 75%);background:linear-gradient(150deg,color-mix(in srgb,#7ce4cb,#c6fff3 var(--case-light,0%)),color-mix(in srgb,#214942,#77f8d7 var(--case-light,0%)) 75%);pointer-events:none}
.case-hive__particle::before{content:'';position:absolute;inset:2px;background:radial-gradient(ellipse at 30% 10%,#26564c,#132b2d 72%);clip-path:inherit;opacity:var(--case-fill,0);transition:background .18s ease}
.case-hive__particle.is-highlighted::before{background:#285c4d}
.case-hive__label{display:grid;justify-items:center;align-content:center;gap:6px;z-index:1;width:87%;opacity:var(--case-label,0);color:inherit;font-size:clamp(.68rem,1vw,.93rem);line-height:1.1;text-align:center;overflow-wrap:anywhere}.case-hive__label img{width:clamp(30px,4vw,53px);height:clamp(30px,4vw,53px);object-fit:contain;border-radius:6px}.case-hive__label strong{font-weight:720}
.case-hive__cell:focus-visible .case-hive__label{opacity:1}
@media(max-width:650px){.case-hive{--cell-width:min(calc((100% - (var(--columns) - 1) * 7px) / var(--columns)),132px)}.case-hive__row+.case-hive__row{margin-top:-12px}.case-hive__label{font-size:.76rem}.case-hive__label img{width:33px;height:33px}}
</style>
