<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({ label: String, kind: String })
const emit = defineEmits(['close'])
const panel = ref(null)
const bounds = ref(null)
const edges = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const margin = 8
let gesture = null

const style = computed(() => {
  if (!bounds.value) return undefined
  const { left, top, width, height } = bounds.value
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, right: 'auto', bottom: 'auto' }
})

const clamp = (value, lower, upper) => Math.max(lower, Math.min(value, upper))
const minimumWidth = () => Math.min(340, window.innerWidth - margin * 2)
const minimumHeight = () => Math.min(300, window.innerHeight - margin * 2)

function start(event, edge = '') {
  if (gesture || event.button !== 0 || event.isPrimary === false) return
  if (!edge && event.target.closest('button, a, input, select, textarea, [role="button"]')) return
  event.preventDefault()
  const target = event.currentTarget
  const { left, top, right, bottom, width, height } = panel.value.getBoundingClientRect()
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, edge, left, top, right, bottom, width, height }
  target.setPointerCapture(event.pointerId)
}

function move(event) {
  if (gesture?.id !== event.pointerId) return
  const { edge, x, y, width, height } = gesture
  let { left, top, right, bottom } = gesture
  const dx = event.clientX - x, dy = event.clientY - y
  if (!edge) {
    bounds.value = {
      left: clamp(left + dx, margin, window.innerWidth - width - margin),
      top: clamp(top + dy, margin, window.innerHeight - height - margin),
      width, height,
    }
    return
  }
  if (edge.includes('w')) left = clamp(left + dx, margin, right - minimumWidth())
  if (edge.includes('e')) right = clamp(right + dx, left + minimumWidth(), window.innerWidth - margin)
  if (edge.includes('n')) top = clamp(top + dy, margin, bottom - minimumHeight())
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + minimumHeight(), window.innerHeight - margin)
  bounds.value = { left, top, width: right - left, height: bottom - top }
}

function end(event) {
  if (gesture?.id === event.pointerId) gesture = null
}

function fitViewport() {
  if (!bounds.value) return
  gesture = null
  const { left, top } = bounds.value
  const width = Math.min(bounds.value.width, window.innerWidth - margin * 2)
  const height = Math.min(bounds.value.height, window.innerHeight - margin * 2)
  bounds.value = {
    left: clamp(left, margin, window.innerWidth - width - margin),
    top: clamp(top, margin, window.innerHeight - height - margin),
    width, height,
  }
}

onMounted(() => window.addEventListener('resize', fitViewport))
onBeforeUnmount(() => window.removeEventListener('resize', fitViewport))
</script>

<template>
  <section ref="panel" :class="['assistant-panel', 'assistant-panel--' + kind]" :style="style"
    role="region" :aria-label="label" @pointermove="move" @pointerup="end"
    @pointercancel="end" @lostpointercapture="end" @keydown.esc.stop="emit('close')">
    <slot :startMove="start" />
    <span v-for="edge in edges" :key="edge" :class="['assistant-resize', 'assistant-resize--' + edge]"
      aria-hidden="true" @pointerdown="start($event, edge)" />
  </section>
</template>

<style scoped>
.assistant-panel{position:fixed;right:14px;bottom:calc(120px + env(safe-area-inset-bottom,0px));z-index:1799;width:min(510px,calc(100vw - 28px));height:min(720px,calc(100dvh - 135px - env(safe-area-inset-bottom,0px)))}
.assistant-panel--campaign,.assistant-panel--chatbot{bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:4300;width:min(445px,calc(100vw - 28px));height:min(680px,calc(100dvh - 96px - env(safe-area-inset-bottom,0px)))}
.assistant-panel--chatbot{left:14px;right:auto}
.assistant-resize{position:absolute;z-index:24;touch-action:none}
.assistant-resize--n,.assistant-resize--s{height:12px;left:14px;right:14px;cursor:ns-resize}
.assistant-resize--n{top:-5px}.assistant-resize--s{bottom:-5px}
.assistant-resize--e,.assistant-resize--w{width:12px;top:14px;bottom:14px;cursor:ew-resize}
.assistant-resize--e{right:-5px}.assistant-resize--w{left:-5px}
.assistant-resize--ne,.assistant-resize--nw,.assistant-resize--se,.assistant-resize--sw{width:18px;height:18px}
.assistant-resize--ne,.assistant-resize--sw{cursor:nesw-resize}
.assistant-resize--nw,.assistant-resize--se{cursor:nwse-resize}
.assistant-resize--ne,.assistant-resize--nw{top:-5px}.assistant-resize--se,.assistant-resize--sw{bottom:-5px}
.assistant-resize--ne,.assistant-resize--se{right:-5px}.assistant-resize--nw,.assistant-resize--sw{left:-5px}
@media(max-width:600px){.assistant-panel{height:min(560px,calc(100dvh - 135px));width:calc(100vw - 28px)}.assistant-panel--campaign,.assistant-panel--chatbot{height:min(66dvh,calc(100dvh - 96px))}}
</style>
