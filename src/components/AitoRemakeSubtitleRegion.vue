<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  url: { type: String, required: true },
  duration: { type: Number, required: true },
  region: Object,
})
const emit = defineEmits(['close', 'save'])
const video = ref(null)
const position = ref(0)
const aspect = ref(1)
const ready = ref(false)
const region = ref(props.region ? { ...props.region } : { x: .12, y: .76, width: .76, height: .16 })
const rectangle = computed(() => ({ left: `${region.value.x * 100}%`, top: `${region.value.y * 100}%`,
  width: `${region.value.width * 100}%`, height: `${region.value.height * 100}%` }))
const previewWidth = computed(() => `min(100%, ${310 * aspect.value}px)`)
const clamp = (value, maximum, minimum = 0) => Math.min(maximum, Math.max(minimum, value))
let drag

function loaded() {
  const { videoWidth, videoHeight } = video.value
  if (!videoWidth || !videoHeight) return
  aspect.value = videoWidth / videoHeight
  ready.value = true
  seek(Math.min(.5, props.duration / 5))
}

function seek(value) {
  position.value = Number(value)
  if (ready.value) video.value.currentTime = Math.min(position.value, video.value.duration)
}

function point(event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: clamp((event.clientX - bounds.left) / bounds.width, 1), y: clamp((event.clientY - bounds.top) / bounds.height, 1) }
}

function begin(event) {
  if (!ready.value || event.button !== 0 || drag) return
  drag = { ...point(event), id: event.pointerId, previous: { ...region.value } }
  event.currentTarget.setPointerCapture(event.pointerId)
}

function draw(event) {
  if (drag?.id !== event.pointerId) return
  const { x, y } = point(event)
  region.value = { x: Math.min(x, drag.x), y: Math.min(y, drag.y), width: Math.abs(x - drag.x), height: Math.abs(y - drag.y) }
}

function end(event, cancelled = false) {
  if (drag?.id !== event.pointerId) return
  if (!cancelled) draw(event)
  if (cancelled || region.value.width < .02 || region.value.height < .02) region.value = drag.previous
  drag = undefined
}

function adjust(event) {
  const offset = { ArrowLeft: [-.015, 0], ArrowRight: [.015, 0], ArrowUp: [0, -.015], ArrowDown: [0, .015] }[event.key]
  if (!offset || !ready.value) return
  event.preventDefault()
  const [horizontal, vertical] = offset
  const { x, y, width, height } = region.value
  region.value = event.shiftKey
    ? { x, y, width: clamp(width + horizontal, 1 - x, .02), height: clamp(height + vertical, 1 - y, .02) }
    : { x: clamp(x + horizontal, 1 - width), y: clamp(y + vertical, 1 - height), width, height }
}
</script>

<template>
  <q-dialog :model-value="true" @update:model-value="value => { if (!value) emit('close') }">
    <q-card dark class="remake-subtitles" aria-labelledby="remake-subtitle-title">
      <q-card-section class="remake-subtitles__head">
        <h2 id="remake-subtitle-title">Remover legenda gravada</h2>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar seleção" @click="emit('close')" />
        <p>Arraste sobre toda a legenda, com uma pequena margem. Use o controle abaixo para conferir outros quadros.</p>
      </q-card-section>
      <q-card-section class="remake-subtitles__body">
        <div class="remake-subtitles__preview" :style="{ width: previewWidth, aspectRatio: aspect }" tabindex="0" role="group"
          aria-label="Área da legenda. Use as setas para mover e Shift com as setas para ajustar o tamanho."
          @pointerdown="begin" @pointermove="draw" @pointerup="end" @pointercancel="end($event, true)" @keydown="adjust">
          <video ref="video" :src="url" muted playsinline preload="auto" aria-hidden="true" @loadedmetadata="loaded" />
          <div v-if="ready" class="remake-subtitles__rectangle" :style="rectangle" />
        </div>
        <label>Quadro da cena
          <input type="range" min="0" :max="Math.max(0, duration - .05)" step=".05" :value="position" :disabled="!ready" @input="seek($event.target.value)" />
        </label>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-if="props.region" flat no-caps label="Limpar seleção" @click="emit('save', null)" />
        <q-btn flat no-caps label="Cancelar" @click="emit('close')" />
        <q-btn unelevated no-caps color="teal-8" label="Aplicar área" :disable="!ready" @click="emit('save', region)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.remake-subtitles { width: min(560px, 95vw); color: #effffb; background: #0c2628; }
.remake-subtitles__head { display: grid; grid-template-columns: 1fr auto; column-gap: 8px; align-items: center; }
.remake-subtitles__head h2 { margin: 0; font-size: 1.15rem; line-height: 1.3; font-weight: 730; }
.remake-subtitles__head p { grid-column: 1 / -1; margin: 6px 0 0; color: #c2ded8; }
.remake-subtitles__body { display: grid; gap: 12px; padding-block: 0; }
.remake-subtitles__preview { position: relative; justify-self: center; background: #04090b; cursor: crosshair; touch-action: none; }
.remake-subtitles__preview:focus-visible { outline: 2px solid #8bffe2; outline-offset: 4px; }
.remake-subtitles__preview video { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.remake-subtitles__rectangle { position: absolute; border: 2px solid #8bffe2; background: #00ffc135; box-shadow: 0 0 0 1px #061211; pointer-events: none; }
.remake-subtitles__body input { display: block; width: 100%; margin: 4px 0 0; accent-color: #70f3d4; }
</style>
