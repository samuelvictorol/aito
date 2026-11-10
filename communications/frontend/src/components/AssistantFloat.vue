<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  kind: { type: String, default: 'admin' },
  expanded: Boolean,
  loading: Boolean,
  disabled: Boolean,
  chatMode: Boolean,
})
const emit = defineEmits(['toggle'])
const button = ref(null)
const position = ref(null)
let drag = null
let ignoreClick = false

function place(left, top, rect) {
  const pad = 6
  const x = Math.max(pad, Math.min(window.innerWidth - rect.width - pad, left))
  const y = Math.max(pad, Math.min(window.innerHeight - rect.height - pad, top))
  if (props.kind !== 'admin') {
    const peer = [...document.querySelectorAll('[data-studio-float]')].find(element => element !== button.value)
    const other = peer?.getBoundingClientRect()
    if (other && x < other.right + pad && x + rect.width + pad > other.left
      && y < other.bottom + pad && y + rect.height + pad > other.top) return false
  }
  position.value = { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' }
  return true
}

function pointerDown(event) {
  if (event.button !== 0 || event.isPrimary === false) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: button.value.getBoundingClientRect(), moved: false }
  ignoreClick = false
  button.value.setPointerCapture?.(event.pointerId)
}

function pointerMove(event) {
  if (!drag || event.pointerId !== drag.id) return
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y
  if (!drag.moved && Math.hypot(dx, dy) < 6) return
  drag.moved = true
  place(drag.rect.left + dx, drag.rect.top + dy, drag.rect)
}

function pointerUp(event) {
  if (event.pointerId !== drag?.id) return
  ignoreClick = drag.moved
  drag = null
}

function activate(event) {
  if (props.disabled) return
  if (event.detail && ignoreClick) {
    ignoreClick = false
    return
  }
  emit('toggle')
}

function resize() {
  if (!position.value || !button.value) return
  const rect = button.value.getBoundingClientRect()
  if (!place(rect.left, rect.top, rect)) {
    const edge = props.kind === 'chatbot' ? 12 : window.innerWidth - rect.width - 12
    const base = window.innerHeight - rect.height - 16
    if (!place(edge, base, rect)) place(edge, base - rect.height - 12, rect)
  }
}

onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<template>
  <button
    ref="button" type="button" class="assistant-float"
    :class="['assistant-float--' + kind, { 'assistant-float--chat': chatMode }]"
    :data-studio-float="kind !== 'admin' ? '' : undefined"
    :style="position" :aria-label="label" :aria-expanded="expanded" :aria-disabled="disabled || undefined" :disabled="loading"
    @dragstart.prevent @pointerdown="pointerDown" @pointermove="pointerMove"
    @pointerup="pointerUp" @pointercancel="pointerUp" @click="activate"
  >
    <q-spinner v-if="loading" />
    <slot v-else />
    <q-tooltip>{{ label }}</q-tooltip>
  </button>
</template>

<style scoped>
.assistant-float{position:fixed;right:20px;bottom:calc(42px + env(safe-area-inset-bottom,0px));z-index:1800;display:grid;place-items:center;width:4.15rem;height:4.15rem;padding:0;border:1px solid #13bc9d8c;border-radius:1.15rem;background:linear-gradient(135deg,#13bc9d,#12ad89);color:white;box-shadow:0 12px 25px #0d514b36;touch-action:none;cursor:grab}
.assistant-float:active{cursor:grabbing}
.assistant-float:focus-visible{outline:3px solid #176e6c;outline-offset:4px}
.assistant-float:hover{filter:brightness(1.06)}
.assistant-float :deep(img){width:3rem;height:3rem;object-fit:contain}
.assistant-float--admin.assistant-float--chat{bottom:calc(140px + env(safe-area-inset-bottom,0px))}
.assistant-float--chatbot,.assistant-float--simulator{z-index:4500;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:3.55rem;height:3.55rem;font-size:1.55rem;color:#134d3b}
.assistant-float--chatbot{left:20px;right:auto;border-color:#96dbc0;background:linear-gradient(140deg,#ecfff5,#90dfbd)}
.assistant-float--simulator{border-color:#98c7ef;background:linear-gradient(140deg,#eaf6ff,#b7dbfa);color:#19578a}
.assistant-float[aria-expanded=true]{border-color:currentColor}
.assistant-float[aria-disabled=true]{opacity:.62}
@media(max-width:700px){
  .assistant-float{right:12px;width:3.65rem;height:3.65rem}
  .assistant-float--chatbot{left:12px;right:auto}
  .assistant-float--chatbot,.assistant-float--simulator{width:3.25rem;height:3.25rem}
}
</style>
