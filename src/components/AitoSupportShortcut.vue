<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const position = ref(null)
const dragging = ref(false)
const shortcut = ref(null)
const dragThreshold = 6
const viewportMargin = 8
const positionKey = 'aito.support-shortcut.position'
let pointer
let ignorePointerClick = false

function moveWithinViewport(left, top) {
  if (!shortcut.value) return
  const { offsetWidth, offsetHeight } = shortcut.value
  position.value = {
    left: `${Math.max(viewportMargin, Math.min(left, window.innerWidth - offsetWidth - viewportMargin))}px`,
    top: `${Math.max(viewportMargin, Math.min(top, window.innerHeight - offsetHeight - viewportMargin))}px`,
    right: 'auto',
    bottom: 'auto'
  }
}

function startDrag(event) {
  if (!event.isPrimary || event.button !== 0) return
  const rect = event.currentTarget.getBoundingClientRect()
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  ignorePointerClick = false
  event.currentTarget.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
  if (pointer?.id !== event.pointerId) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!dragging.value && Math.hypot(dx, dy) < dragThreshold) return
  dragging.value = true
  moveWithinViewport(pointer.left + dx, pointer.top + dy)
}

function finishDrag(event, navigate) {
  if (pointer?.id !== event.pointerId) return
  const touchTap = event.type === 'pointerup' && event.pointerType === 'touch' && !dragging.value
  if (event.type === 'pointerup') {
    ignorePointerClick = dragging.value || touchTap
    if (dragging.value && shortcut.value) {
      const { left, top } = shortcut.value.getBoundingClientRect()
      try { sessionStorage.setItem(positionKey, JSON.stringify({ left, top })) } catch { /* Drag still works without storage. */ }
    }
  }
  pointer = null
  dragging.value = false
  if (touchTap) followShortcut(event, navigate)
}

function activate(event, navigate) {
  if (ignorePointerClick && event.detail > 0) {
    event.preventDefault()
    ignorePointerClick = false
    return
  }
  followShortcut(event, navigate)
}

function followShortcut(event, navigate) {
  if (route.name === 'user-app' && route.query.tab === 'tickets' &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault()
    document.getElementById('customer-support')?.focus()
    return
  }
  navigate(event)
}

function keepInViewport() {
  if (!position.value || !shortcut.value) return
  const rect = shortcut.value.getBoundingClientRect()
  moveWithinViewport(rect.left, rect.top)
}

onMounted(() => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(positionKey) || 'null')
    if (Number.isFinite(stored?.left) && Number.isFinite(stored?.top)) moveWithinViewport(stored.left, stored.top)
  } catch { /* Start from the default position when storage is unavailable. */ }
  window.addEventListener('resize', keepInViewport)
})
onBeforeUnmount(() => window.removeEventListener('resize', keepInViewport))
</script>

<template>
  <router-link
    v-slot="{ href, navigate }"
    :to="{ path: route.name === 'user-app' ? route.path : '/app', query: { tab: 'tickets' } }"
    custom
  >
    <a
      ref="shortcut"
      class="support-shortcut"
      :class="{ 'is-dragging': dragging }"
      :href="href"
      :style="position"
      aria-label="Abrir suporte"
      draggable="false"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="finishDrag($event, navigate)"
      @pointercancel="finishDrag"
      @lostpointercapture="finishDrag"
      @click="activate($event, navigate)"
    >
      <q-icon name="mdi-help-circle-outline" size="26px" aria-hidden="true" />
      <q-tooltip v-if="!dragging && !$q.platform.has.touch">Suporte</q-tooltip>
    </a>
  </router-link>
</template>

<style scoped>
.support-shortcut {
  position: fixed;
  z-index: 24;
  right: max(.75rem, env(safe-area-inset-right));
  bottom: 31%;
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid #63cdb7;
  border-radius: 100%;
  color: #b5fcee;
  background: linear-gradient(145deg, #143e3d, #081a1c);
  box-shadow: 0 5px 18px #0008;
  cursor: grab;
  touch-action: none;
  user-select: none;
  text-decoration: none;
}
.support-shortcut:focus-visible { outline: 2px solid #a4fce4; outline-offset: 3px; }
.support-shortcut:hover { color: white; border-color: #a4fce4; }
.support-shortcut.is-dragging { cursor: grabbing; }
</style>
