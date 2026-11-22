<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AitoVideoModelPreview from 'components/AitoVideoModelPreview.vue'

const props = defineProps({ cards: { type: Array, required: true }, selectedId: String, active: Boolean, disabled: Boolean })
const emit = defineEmits(['select'])
const shell = ref(null)
const viewport = ref(null)
const looping = ref(false)
const reducedMotion = ref(true)
const paused = ref(false)
const hovering = ref(false)
const focused = ref(false)
const dragging = ref(false)
const visible = ref(false)
const hoveredPreview = ref('')
const focusedPreview = ref('')
const blocks = computed(() => looping.value ? [-1, 0, 1] : [0])
const preview = computed(() => !props.active || reducedMotion.value || dragging.value ? '' : hoveredPreview.value || focusedPreview.value)
const cardIds = computed(() => props.cards.map(card => card.id).join('|'))
let middle
let motion
let resizeObserver
let viewportObserver
let advanceTimer
let scrollTimer
let ignoreClick = false
let clickTimer
let startPointer
let touching = false
let mounted = false

function setMiddle(element) {
  if (middle === element) return
  if (middle) resizeObserver?.unobserve(middle)
  middle = element
  if (middle) resizeObserver?.observe(middle)
}
function previewKey(block, id) { return `${block}:${id}` }

function syncLayout(centerSelection = false) {
  const element = viewport.value
  if (!props.active || !middle || !element?.clientWidth) return
  const shouldLoop = props.cards.length > 1 && middle.offsetWidth > element.clientWidth + 1
  if (shouldLoop !== looping.value) {
    looping.value = shouldLoop
    void nextTick(() => syncLayout(true))
    return
  }
  if (!shouldLoop) element.scrollLeft = 0
  else if (centerSelection) {
    const index = props.cards.findIndex(card => card.id === props.selectedId)
    element.scrollLeft = index < 0 ? middle.offsetLeft : middle.children[index].offsetLeft
  } else normalize()
  schedule()
}

function cycleWidth() { return middle?.nextElementSibling ? middle.nextElementSibling.offsetLeft - middle.offsetLeft : 0 }
function normalize() {
  const element = viewport.value
  const cycle = cycleWidth()
  if (!element || !cycle) return
  const offset = element.scrollLeft - middle.offsetLeft
  if (offset < 0 || offset >= cycle) {
    element.scrollLeft = middle.offsetLeft + ((offset % cycle + cycle) % cycle)
  }
}

function schedule() {
  clearTimeout(advanceTimer)
  if (!mounted || !props.active || !looping.value || !visible.value || document.hidden ||
      reducedMotion.value || paused.value || hovering.value || focused.value || dragging.value || touching) return
  advanceTimer = setTimeout(() => move(1), 4400)
}

function move(direction) {
  const element = viewport.value
  if (!element || !looping.value || !middle?.children[1]) return
  normalize()
  const pitch = middle.children[1].offsetLeft - middle.children[0].offsetLeft
  if (!pitch) return
  const current = (element.scrollLeft - middle.offsetLeft) / pitch
  const step = direction > 0 ? Math.floor(current + .04) + 1 : Math.ceil(current - .04) - 1
  element.scrollTo({ left: middle.offsetLeft + pitch * step, behavior: reducedMotion.value ? 'instant' : 'smooth' })
  schedule()
}

function settle() {
  clearTimeout(scrollTimer)
  if (!dragging.value && !touching) normalize()
  schedule()
}

function onScroll() {
  clearTimeout(advanceTimer)
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(settle, 110)
}

function beginDrag(event) {
  if (!looping.value || !event.isPrimary || event.button !== 0) return
  clearTimeout(advanceTimer)
  if (event.pointerType === 'touch') { touching = true; return }
  startPointer = { id: event.pointerId, x: event.clientX, scroll: viewport.value.scrollLeft }
}

function drag(event) {
  if (startPointer?.id !== event.pointerId) return
  const distance = event.clientX - startPointer.x
  if (!dragging.value && Math.abs(distance) < 6) return
  if (!dragging.value) {
    dragging.value = true
    hoveredPreview.value = ''
    viewport.value.setPointerCapture(event.pointerId)
  }
  event.preventDefault()
  viewport.value.scrollLeft = startPointer.scroll - distance
}

function endDrag(event) {
  if (event.pointerType === 'touch') touching = false
  if (startPointer?.id === event.pointerId) {
    startPointer = undefined
    if (dragging.value) {
      dragging.value = false
      ignoreClick = true
      clearTimeout(clickTimer)
      clickTimer = setTimeout(() => { ignoreClick = false }, 180)
    }
  }
  settle()
}

function skipDragClick(event) {
  if (!ignoreClick) return
  event.preventDefault()
  event.stopPropagation()
}

function trackFocus(event) {
  focused.value = event.target.matches('.model-carousel__card-action:focus-visible')
}

function releaseFocus(event) {
  if (!event.relatedTarget?.matches?.('.model-carousel__card-action:focus-visible')) focused.value = false
}

function setFocusPreview(event, block, item) {
  if (event.currentTarget.matches(':focus-visible')) focusedPreview.value = previewKey(block, item.id)
}

function syncMotion() {
  reducedMotion.value = Boolean(motion?.matches)
  schedule()
}

watch([cardIds, () => props.active], async () => {
  hoveredPreview.value = ''
  focusedPreview.value = ''
  await nextTick()
  syncLayout(true)
  schedule()
})
watch([paused, hovering, focused, visible, dragging], schedule)
onMounted(() => {
  mounted = true
  motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  syncMotion()
  motion?.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', schedule)
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => syncLayout())
    resizeObserver.observe(viewport.value)
    if (middle) resizeObserver.observe(middle)
  }
  if (window.IntersectionObserver) {
    viewportObserver = new IntersectionObserver(([entry]) => { visible.value = entry.isIntersecting })
    viewportObserver.observe(shell.value)
  } else visible.value = true
  syncLayout(true)
})
onBeforeUnmount(() => {
  mounted = false
  clearTimeout(advanceTimer)
  clearTimeout(scrollTimer)
  clearTimeout(clickTimer)
  resizeObserver?.disconnect()
  viewportObserver?.disconnect()
  motion?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', schedule)
})
</script>

<template>
  <div ref="shell" class="model-carousel" role="region" aria-roledescription="carrossel" aria-label="Modelos disponíveis"
    @focusin="trackFocus" @focusout="releaseFocus"
    @keydown.left.prevent="move(-1)" @keydown.right.prevent="move(1)">
    <button v-if="looping" type="button" class="model-carousel__control" aria-label="Modelos anteriores" @click="move(-1)">
      <q-icon name="mdi-chevron-left" size="22px" />
    </button>
    <div ref="viewport" class="model-carousel__viewport" :class="{ 'model-carousel__viewport--looping': looping, 'model-carousel__viewport--dragging': dragging }"
      @scroll.passive="onScroll" @pointerdown="beginDrag" @pointermove="drag" @pointerup="endDrag" @pointercancel="endDrag"
      @pointerenter="hovering = $event.pointerType !== 'touch'"
      @pointerleave="hovering = false; if (!dragging && $event.pointerType !== 'touch') endDrag($event)" @click.capture="skipDragClick" @dragstart.prevent>
      <div class="model-carousel__track">
        <div v-for="block in blocks" :key="block" :ref="block === 0 ? setMiddle : undefined" class="model-carousel__group"
          :aria-hidden="block === 0 ? undefined : 'true'">
          <article v-for="item in cards" :key="item.id" class="model-carousel__card"
            :class="{ 'model-carousel__card--selected': selectedId === item.id }"
            @pointerenter="$event.pointerType !== 'touch' && !dragging && (hoveredPreview = previewKey(block, item.id))"
            @pointerleave="hoveredPreview = ''">
            <AitoVideoModelPreview :files="item.preview" :fallback-position="item.poster" :type="item.type"
              :animate="preview === previewKey(block, item.id)" />
            <div class="model-carousel__content">
              <div><span class="model-carousel__maker">{{ item.maker }}</span><h3>{{ item.name }}</h3></div>
              <p>{{ item.summary }}</p>
              <div class="model-carousel__meta">
                <span v-if="item.perSecond" class="model-carousel__rate" title="Custo de referência do estúdio">A partir de {{ item.perSecond }}/s</span>
                <span>{{ item.requirement }}</span>
              </div>
            </div>
            <button type="button" class="model-carousel__card-action" :disabled="disabled" :tabindex="block === 0 ? undefined : -1"
              :aria-label="`Selecionar ${item.name}`" :aria-pressed="selectedId === item.id"
              @focus="setFocusPreview($event, block, item)" @blur="focusedPreview = ''" @click="emit('select', item.id)">
              <q-tooltip :delay="350">{{ item.summary }}</q-tooltip>
              <q-icon :name="selectedId === item.id ? 'mdi-check-circle' : 'mdi-arrow-top-right'" size="18px" aria-hidden="true" />
            </button>
          </article>
        </div>
      </div>
    </div>
    <div v-if="looping" class="model-carousel__controls">
      <button type="button" class="model-carousel__control" aria-label="Próximos modelos" @click="move(1)">
        <q-icon name="mdi-chevron-right" size="22px" />
      </button>
      <button v-if="!reducedMotion" type="button" class="model-carousel__control model-carousel__pause"
        :aria-label="paused ? 'Retomar carrossel' : 'Pausar carrossel'" @click="paused = !paused">
        <q-icon :name="paused ? 'mdi-play' : 'mdi-pause'" size="17px" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.model-carousel { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 8px 9px; }
.model-carousel__viewport { position: relative; flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain; container-type: inline-size; scrollbar-width: none; }
.model-carousel__viewport--looping, .model-carousel__viewport--looping .model-carousel__card-action:not(:disabled) { cursor: grab; }
.model-carousel__viewport--dragging, .model-carousel__viewport--dragging .model-carousel__card-action:not(:disabled) { cursor: grabbing; user-select: none; }
.model-carousel__track, .model-carousel__group { display: flex; width: max-content; gap: 8px; }
.model-carousel__card { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; width: clamp(min(200px, 100cqw), 29cqw, 270px); padding: 5px; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-surface); }
.model-carousel__card--selected, .model-carousel__card:has(.model-carousel__card-action:not(:disabled):is(:hover, :focus-visible)) { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-panel); }
.model-carousel__content { display: grid; flex: 1; grid-template-rows: auto 1fr auto; gap: 5px; padding: 7px 6px 5px; }
.model-carousel__maker { color: var(--aito-ai-muted); font-size: .74rem; }
.model-carousel__content h3 { margin: 2px 0 0; font-size: .97rem; line-height: 1.2; font-weight: 710; overflow-wrap: anywhere; }
.model-carousel__content p { display: -webkit-box; margin: 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--aito-ai-muted); font-size: .79rem; line-height: 1.35; }
.model-carousel__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 7px; color: var(--aito-ai-accent); font-size: .72rem; }
.model-carousel__rate { padding: 2px 5px; border-radius: 4px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); font-weight: 650; }
.model-carousel__card-action { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: flex-start; padding: 10px; border: 0; border-radius: inherit; color: var(--aito-ai-text); background: transparent; cursor: pointer; }
.model-carousel__card-action:focus-visible { outline: 2px solid var(--aito-ai-purple); outline-offset: -2px; }
.model-carousel__card-action :deep(.q-icon) { width: 27px; height: 27px; border-radius: 7px; background: var(--aito-ai-overlay); }
html[data-aito-ia-theme='light'] .model-carousel__card-action :deep(.q-icon) { background: var(--aito-ai-panel); }
.model-carousel__card-action[aria-pressed='true'] :deep(.q-icon) { color: var(--aito-ai-accent); }
.model-carousel__controls { position: relative; align-self: stretch; display: grid; align-items: center; }
.model-carousel__control { display: inline-grid; width: 34px; height: 36px; flex: 0 0 auto; place-items: center; padding: 0; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-accent); background: var(--aito-ai-panel); cursor: pointer; }
.model-carousel__control:hover { border-color: var(--aito-ai-accent-strong); }
.model-carousel__pause { position: absolute; bottom: 0; height: 28px; color: var(--aito-ai-muted); }
@media (max-width: 480px) {
  .model-carousel { gap: 4px; padding-inline: 6px; }
  .model-carousel__control { width: 30px; }
}
</style>
