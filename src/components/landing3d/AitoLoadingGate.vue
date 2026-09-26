<template>
  <Transition name="aito-loader-fade" @after-leave="emit('complete')">
    <section v-if="visible" class="aito-loader" :class="{ 'is-ready': ready, 'is-starting': starting }" aria-label="Loading AitoSoftwares">
      <div class="aito-loader__focus" aria-hidden="true"></div>
      <div class="aito-loader__hud" aria-live="polite">
        <strong>AITOSOFTWARES</strong>
        <i><b :style="{ transform: `scaleX(${progress})` }"></b></i>
      </div>
    </section>
  </Transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  ready: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false }
})

const emit = defineEmits(['reveal', 'complete'])

const visible = ref(true)
const starting = ref(false)
const progress = ref(0.18)

const MIN_VISIBLE_TIME = 5000
const HANDOFF_DURATION = 1280

let animationFrame = 0
let autoStartTimer = 0
let exitTimer = 0
let startedAt = 0
let destroyed = false

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const lerp = (start, end, amount) => start + (end - start) * amount

function tick(time) {
  if (destroyed || !visible.value) return

  const elapsed = startedAt ? performance.now() - startedAt : 0
  const target = props.ready ? clamp(elapsed / MIN_VISIBLE_TIME, 0.18, 1) : Math.min(0.88, clamp(elapsed / MIN_VISIBLE_TIME, 0.18, 1))
  progress.value = lerp(progress.value, target, props.ready ? 0.08 : 0.04)
  animationFrame = window.requestAnimationFrame(tick)
}

function startExitAnimation() {
  if (!props.ready || exitTimer || !visible.value) return

  starting.value = true
  progress.value = 1
  emit('reveal')

  exitTimer = window.setTimeout(() => {
    visible.value = false
  }, props.reducedMotion ? 80 : HANDOFF_DURATION)
}

function scheduleAutoStart() {
  if (!props.ready || destroyed || starting.value || autoStartTimer || exitTimer || !visible.value || !startedAt) return

  const elapsed = performance.now() - startedAt
  autoStartTimer = window.setTimeout(() => {
    autoStartTimer = 0
    startExitAnimation()
  }, Math.max(MIN_VISIBLE_TIME - elapsed, 0))
}

watch(() => props.ready, (isReady) => {
  if (isReady) scheduleAutoStart()
}, { immediate: true })

onMounted(() => {
  startedAt = performance.now()
  animationFrame = window.requestAnimationFrame(tick)
  scheduleAutoStart()
})

onBeforeUnmount(() => {
  destroyed = true
  window.cancelAnimationFrame(animationFrame)
  window.clearTimeout(autoStartTimer)
  window.clearTimeout(exitTimer)
})
</script>

<style scoped>
.aito-loader {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #f5fffd;
  background: radial-gradient(circle at center, rgba(0, 9, 10, 0.22) 0 12rem, rgba(0, 0, 0, 0.74) 48%, rgba(0, 0, 0, 0.96) 100%);
  isolation: isolate;
  pointer-events: none;
  transition: opacity 1280ms cubic-bezier(0.2, 0.8, 0.2, 1), background 1280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.aito-loader::before,
.aito-loader::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  transition: opacity 1100ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.aito-loader::before {
  z-index: -2;
  background: radial-gradient(circle at center, rgba(19, 188, 157, 0.18), transparent 25rem), linear-gradient(180deg, #000 0%, transparent 100%);
}

.aito-loader::after {
  z-index: -1;
  opacity: 0.22;
  background: linear-gradient(rgba(19, 188, 157, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(19, 188, 157, 0.11) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, #000 0 34%, transparent 72%);
}

.aito-loader.is-starting {
  opacity: 0;
  background: transparent;
}

.aito-loader.is-starting::before,
.aito-loader.is-starting::after {
  opacity: 0;
}

.aito-loader__focus {
  position: absolute;
  width: min(58vmin, 480px);
  aspect-ratio: 1;
  border: 1px solid rgba(143, 255, 238, 0.18);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(19, 188, 157, 0.05), inset 0 0 70px rgba(19, 188, 157, 0.08), 0 0 70px rgba(19, 188, 157, 0.12);
  opacity: 0.5;
  transform: scale(0.88);
  transition: opacity 800ms ease, transform 1280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.aito-loader__focus::before,
.aito-loader__focus::after {
  position: absolute;
  inset: 13%;
  border: 1px solid rgba(19, 188, 157, 0.17);
  border-radius: inherit;
  content: '';
}

.aito-loader__focus::after {
  inset: 27%;
  border-color: rgba(143, 255, 238, 0.16);
}

.aito-loader.is-starting .aito-loader__focus {
  opacity: 0;
  transform: scale(1.18);
}

.aito-loader__hud {
  position: absolute;
  right: clamp(1rem, 4vw, 4rem);
  bottom: clamp(1rem, 2vw, 1.5rem);
  left: clamp(1rem, 4vw, 4rem);
  display: grid;
  gap: 0.5rem;
  justify-items: center;
  color: rgba(229, 255, 250, 0.72);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-align: center;
  text-transform: uppercase;
  transition: opacity 500ms ease, transform 500ms ease;
}

.aito-loader__hud strong { color: #f8fffd; font-family: "Tomorrow", system-ui, sans-serif; font-size: clamp(0.9rem, 2vw, 1.22rem); letter-spacing: 0.22em; }
.aito-loader__hud i { display: block; width: min(100%, 14rem); height: 2px; overflow: hidden; background: rgba(229, 255, 250, 0.12); border-radius: 99px; }
.aito-loader__hud b { display: block; width: 100%; height: 100%; background: linear-gradient(90deg, #13bc9d, #12ad89); border-radius: inherit; box-shadow: 0 0 18px rgba(19, 188, 157, 0.7); transform-origin: left center; transition: transform 180ms ease; }
.aito-loader.is-starting .aito-loader__hud { opacity: 0; transform: translateY(12px); }

@media (max-width: 640px) {
  .aito-loader__focus { width: min(78vmin, 360px); }
  .aito-loader__hud { bottom: 1.25rem; font-size: 0.61rem; }
}

@media (prefers-reduced-motion: reduce) {
  .aito-loader, .aito-loader__focus, .aito-loader__hud, .aito-loader::before, .aito-loader::after { transition-duration: 0.01ms; }
}

.aito-loader-fade-leave-active {
  transition: opacity 520ms ease, filter 520ms ease;
}

.aito-loader-fade-leave-to {
  opacity: 0;
  filter: blur(8px);
}
</style>
