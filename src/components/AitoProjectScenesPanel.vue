<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  clips: { type: Array, default: () => [] },
  disabled: Boolean,
  signedIn: Boolean,
})
const emit = defineEmits(['update:modelValue', 'select', 'use', 'add', 'save', 'variation', 'download', 'recover', 'remove', 'rename'])
const launcher = ref(null)
const panel = ref(null)
const openRows = shallowRef(new Set())
const editingId = ref('')
const editName = ref('')
const posters = shallowRef(new Map())
const playbackErrors = shallowRef(new Map())
const posterLimit = ref(10)
const launcherPosition = ref(null)
const panelPosition = ref(null)
const dragging = ref('')
const mobile = ref(false)
const viewportHeight = ref(typeof window === 'undefined' ? 800 : window.innerHeight)
const footerHeight = ref(64)
const now = ref(Date.now())
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const launcherStyle = computed(() => launcherPosition.value || { bottom: `${Math.min(viewportHeight.value - 80, footerHeight.value + 14)}px` })
const panelStyle = computed(() => mobile.value ? undefined : panelPosition.value)
let pointer
let ignoreClick = false
let clock
let footerObserver
let posterEpoch = 0
let posterAbort
let lastFocus

const clipName = clip => clip.title?.trim() || clip.file?.name || `Cena ${clip.number || props.clips.indexOf(clip) + 1}`
const expired = clip => Boolean(clip.expired || (clip.expiresAt && Number(clip.expiresAt) <= now.value))
const playable = clip => Boolean(!expired(clip) && clip.url)
const isOpen = clip => openRows.value.has(String(clip.id))
const poster = clip => posters.value.get(String(clip.id))?.url
const failedPlayback = clip => playbackErrors.value.get(String(clip.id)) === clip.url
function playbackFailed(clip) { playbackErrors.value = new Map(playbackErrors.value).set(String(clip.id), clip.url) }
function loadMorePosters(event) {
  const body = event.target
  if (body.scrollHeight - body.scrollTop - body.clientHeight < 160 && posterLimit.value < props.clips.length) {
    posterLimit.value += 10
    void syncPosters()
  }
}
function expiryLabel(clip) {
  const time = Number(clip.expiresAt)
  return Number.isFinite(time) && time > 0 ? `Disponível até ${date.format(time)}` : ''
}
function toggleRow(clip) {
  const next = new Set(openRows.value)
  if (next.has(String(clip.id))) next.delete(String(clip.id))
  else { next.add(String(clip.id)); emit('select', clip) }
  openRows.value = next
}
function beginRename(clip) {
  if (props.disabled) return
  editingId.value = String(clip.id)
  editName.value = clipName(clip)
  nextTick(() => {
    const input = panel.value?.querySelector('.project-scenes__name-input')
    input?.focus(); input?.select()
  })
}
function finishRename(clip, cancel = false) {
  if (editingId.value !== String(clip.id)) return
  const title = editName.value.trim()
  editingId.value = ''
  if (!cancel && !props.disabled && title && title !== clipName(clip)) emit('rename', { id: clip.id, title })
}
function action(name, clip) {
  if (props.disabled || (name !== 'remove' && expired(clip))) return
  emit(name, clip)
}
function setOpen(value) {
  emit('update:modelValue', value)
}
function close() { setOpen(false) }

function withinViewport(element, left, top) {
  const rect = element?.getBoundingClientRect()
  if (!rect) return null
  return {
    left: `${Math.max(8, Math.min(left, window.innerWidth - rect.width - 8))}px`,
    top: `${Math.max(8, Math.min(top, window.innerHeight - rect.height - 8))}px`,
    bottom: 'auto', right: 'auto',
  }
}
function beginDrag(event, target) {
  if (!event.isPrimary || event.button !== 0 || (target === 'panel' && mobile.value)) return
  if (target === 'panel' && event.target.closest('button, input, a')) return
  const element = target === 'launcher' ? launcher.value : panel.value
  const rect = element?.getBoundingClientRect()
  if (!rect) return
  pointer = { id: event.pointerId, target, element, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  ignoreClick = false
  event.currentTarget.setPointerCapture(event.pointerId)
}
function moveDrag(event) {
  if (pointer?.id !== event.pointerId) return
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
  if (!dragging.value && Math.hypot(dx, dy) < 6) return
  dragging.value = pointer.target
  const position = withinViewport(pointer.element, pointer.left + dx, pointer.top + dy)
  if (pointer.target === 'launcher') launcherPosition.value = position
  else panelPosition.value = position
}
function finishDrag(event) {
  if (pointer?.id !== event.pointerId) return
  ignoreClick = Boolean(dragging.value)
  pointer = null
  dragging.value = ''
}
function activateLauncher(event) {
  if (ignoreClick && event.detail > 0) { ignoreClick = false; return }
  setOpen(!props.modelValue)
}
function resize() {
  mobile.value = window.innerWidth <= 650
  viewportHeight.value = window.innerHeight
  if (launcherPosition.value && launcher.value) {
    const { left, top } = launcher.value.getBoundingClientRect()
    launcherPosition.value = withinViewport(launcher.value, left, top)
  }
  if (panelPosition.value && panel.value && !mobile.value) {
    const { left, top } = panel.value.getBoundingClientRect()
    panelPosition.value = withinViewport(panel.value, left, top)
  }
}
function keydown(event) {
  if (!props.modelValue || !panel.value) return
  if (event.key === 'Escape' && panel.value.contains(document.activeElement)) {
    event.preventDefault(); close(); return
  }
  if (event.key !== 'Tab' || !mobile.value) return
  const controls = [...panel.value.querySelectorAll('button:not(:disabled), input:not(:disabled), video[controls], a[href], [tabindex="0"]')]
    .filter(element => element.offsetWidth && element.offsetHeight)
  if (!controls.length) return
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.modelValue, async value => {
  if (value) {
    lastFocus = document.activeElement
    await nextTick()
    panel.value?.focus({ preventScroll: true })
    void syncPosters()
  } else {
    posterAbort?.abort()
    panel.value?.querySelectorAll('video').forEach(video => video.pause())
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true })
  }
})

function readPoster(clip, signal) {
  return new Promise(resolve => {
    const video = document.createElement('video')
    let source
    let timer
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      video.onloadeddata = video.onerror = null
      video.pause(); video.removeAttribute('src'); video.load()
      if (source) URL.revokeObjectURL(source)
      resolve(value)
    }
    const cancel = () => finish(null)
    if (signal.aborted) { finish(null); return }
    signal.addEventListener('abort', cancel, { once: true })
    video.preload = 'auto'; video.muted = true; video.playsInline = true
    if (clip.file instanceof Blob) source = URL.createObjectURL(clip.file)
    else video.crossOrigin = 'anonymous'
    video.onloadeddata = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(null)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.min(320, video.videoWidth)
        canvas.height = Math.max(1, Math.round(canvas.width * video.videoHeight / video.videoWidth))
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => finish(blob), 'image/jpeg', .78)
      } catch { finish(null) }
    }
    video.onerror = cancel
    timer = setTimeout(cancel, 8000)
    video.src = source || clip.url
  })
}
async function syncPosters() {
  if (!props.modelValue) return
  const epoch = ++posterEpoch
  posterAbort?.abort()
  const controller = new AbortController()
  posterAbort = controller
  const rows = props.clips.filter(clip => !expired(clip) && (clip.file instanceof Blob || clip.url)).slice(0, posterLimit.value)
  const cache = new Map(posters.value)
  for (const [id, cached] of cache) {
    const clip = rows.find(item => String(item.id) === id)
    const key = clip?.file || clip?.url
    if (!clip || cached.key !== key) { URL.revokeObjectURL(cached.url); cache.delete(id) }
  }
  posters.value = cache
  // Decode one local video at a time; never start a paid generation or download.
  for (const clip of rows) {
    const id = String(clip.id), key = clip.file || clip.url
    if (cache.get(id)?.key === key) continue
    const blob = await readPoster(clip, controller.signal)
    if (controller.signal.aborted || epoch !== posterEpoch) return
    if (blob) { cache.set(id, { key, url: URL.createObjectURL(blob) }); posters.value = new Map(cache) }
  }
}
watch(() => props.clips.map(clip => ({ id: clip.id, file: clip.file, url: clip.url, expired: clip.expired, expiresAt: clip.expiresAt })), () => {
  const ids = new Set(props.clips.map(clip => String(clip.id)))
  openRows.value = new Set([...openRows.value].filter(id => ids.has(id)))
  playbackErrors.value = new Map([...playbackErrors.value].filter(([id, url]) => props.clips.some(clip => String(clip.id) === id && clip.url === url)))
  void syncPosters()
}, { immediate: true })

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('keydown', keydown)
  clock = setInterval(() => { now.value = Date.now() }, 30000)
  const footer = document.querySelector('.video-studio__timeline')
  if (footer && typeof ResizeObserver !== 'undefined') {
    footerObserver = new ResizeObserver(() => { footerHeight.value = footer.getBoundingClientRect().height })
    footerObserver.observe(footer)
  }
})
onBeforeUnmount(() => {
  posterEpoch += 1; posterAbort?.abort()
  posters.value.forEach(cached => URL.revokeObjectURL(cached.url))
  footerObserver?.disconnect()
  clearInterval(clock)
  window.removeEventListener('resize', resize)
  document.removeEventListener('keydown', keydown)
})
</script>

<template>
  <Teleport to="body">
    <button ref="launcher" type="button" class="project-scenes__launcher aito-ai-theme" :class="{ 'is-dragging': dragging === 'launcher' }"
      :style="launcherStyle" :aria-expanded="modelValue" aria-controls="project-scenes-dialog" aria-haspopup="dialog" aria-label="Cenas do projeto. Arraste para mover o botão."
      @pointerdown="beginDrag($event, 'launcher')" @pointermove="moveDrag" @pointerup="finishDrag" @pointercancel="finishDrag" @lostpointercapture="finishDrag" @click="activateLauncher">
      <q-icon name="mdi-movie-open-play-outline" size="22px" /><span>Cenas do projeto</span><b>{{ clips.length }}</b>
    </button>
    <section v-if="modelValue" id="project-scenes-dialog" ref="panel" class="project-scenes aito-ai-theme" :class="{ 'is-dragging': dragging === 'panel' }"
      :style="panelStyle" role="dialog" :aria-modal="mobile ? 'true' : 'false'" aria-labelledby="project-scenes-heading" tabindex="-1">
      <header class="project-scenes__header" @pointerdown="beginDrag($event, 'panel')" @pointermove="moveDrag" @pointerup="finishDrag" @pointercancel="finishDrag" @lostpointercapture="finishDrag">
        <div><span class="project-scenes__eyebrow">BIBLIOTECA DO PROJETO</span><h2 id="project-scenes-heading">Cenas do projeto <small>{{ clips.length }}</small></h2></div>
        <button type="button" class="project-scenes__close" aria-label="Fechar cenas do projeto" @click="close"><q-icon name="mdi-close" size="23px" /></button>
      </header>
      <div class="project-scenes__body" @scroll.passive="loadMorePosters">
        <div v-if="$slots.pending" class="project-scenes__pending"><slot name="pending" /></div>
        <div v-if="!clips.length" class="project-scenes__empty"><q-icon name="mdi-filmstrip-box-multiple" size="34px" /><p>As cenas geradas ficam aqui.</p></div>
        <article v-for="clip in clips" :key="clip.id" class="project-scenes__row" :class="{ 'is-open': isOpen(clip), 'is-expired': expired(clip) }">
          <header class="project-scenes__row-head">
            <button type="button" class="project-scenes__row-toggle" :aria-expanded="isOpen(clip)" :aria-label="`${isOpen(clip) ? 'Recolher' : 'Abrir'} ${clipName(clip)}`" @click="toggleRow(clip)">
              <span class="project-scenes__cover"><img v-if="poster(clip)" :src="poster(clip)" alt="" /><q-icon v-else name="mdi-filmstrip" size="23px" /></span>
              <span v-if="editingId !== String(clip.id)" class="project-scenes__name"><strong>{{ clipName(clip) }}</strong><small>{{ expired(clip) ? 'Prazo de armazenamento encerrado' : expiryLabel(clip) }}</small></span>
              <span v-else class="project-scenes__name project-scenes__editing-space" aria-hidden="true" />
            </button>
            <input v-if="editingId === String(clip.id)" v-model="editName" class="project-scenes__name-input" maxlength="140" aria-label="Nome da cena" :disabled="disabled"
              @keydown.enter.prevent="finishRename(clip)" @keydown.esc.stop.prevent="finishRename(clip, true)" @blur="finishRename(clip)" />
            <button type="button" class="project-scenes__rename" :aria-label="`Renomear ${clipName(clip)}`" :disabled="disabled" @click="beginRename(clip)"><q-icon name="mdi-pencil-outline" size="18px" /></button>
            <button type="button" class="project-scenes__expand" :aria-expanded="isOpen(clip)" :aria-label="`${isOpen(clip) ? 'Recolher' : 'Expandir'} recursos de ${clipName(clip)}`" @click="toggleRow(clip)"><q-icon :name="isOpen(clip) ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="25px" /></button>
          </header>
          <div v-if="isOpen(clip)" class="project-scenes__content">
            <video v-if="playable(clip) && !failedPlayback(clip)" :src="clip.url" :poster="poster(clip)" controls playsinline preload="metadata" referrerpolicy="no-referrer" :aria-label="`Prévia de ${clipName(clip)}`" @error="playbackFailed(clip)" />
            <p v-else class="project-scenes__unavailable">{{ expired(clip) ? 'Esta cena expirou. Gere uma nova cena para continuar.' : failedPlayback(clip) ? 'Este dispositivo não conseguiu abrir a prévia. Recupere uma cópia compatível do vídeo.' : 'O vídeo ainda não está disponível para reprodução.' }}</p>
            <slot name="details" :clip="clip" />
            <div class="project-scenes__actions">
              <button v-if="!expired(clip) && (!playable(clip) || failedPlayback(clip))" type="button" :disabled="disabled" @click="action('recover', clip)"><q-icon name="mdi-refresh" size="18px" />Recuperar vídeo</button>
              <button v-if="!expired(clip)" type="button" :disabled="disabled" @click="action('use', clip)"><q-icon name="mdi-swap-horizontal" size="18px" />Usar na cena atual</button>
              <button v-if="!expired(clip)" type="button" class="project-scenes__primary" :disabled="disabled" @click="action('add', clip)"><q-icon name="mdi-playlist-plus" size="18px" />Adicionar ao vídeo master</button>
              <button v-if="signedIn && !expired(clip)" type="button" :disabled="disabled" @click="action('save', clip)"><q-icon name="mdi-folder-plus-outline" size="18px" />Salvar em projeto</button>
              <button v-if="!expired(clip) && clip.file?.type === 'video/mp4'" type="button" :disabled="disabled" @click="action('variation', clip)"><q-icon name="mdi-creation-outline" size="18px" />Gerar variação</button>
              <button v-if="!expired(clip)" type="button" class="project-scenes__icon-action" :aria-label="`Baixar ${clipName(clip)}`" :disabled="disabled" @click="action('download', clip)"><q-icon name="mdi-download-outline" size="21px" /></button>
              <button type="button" class="project-scenes__icon-action" :aria-label="`Excluir ${clipName(clip)}`" :disabled="disabled" @click="action('remove', clip)"><q-icon name="mdi-delete-outline" size="21px" /></button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.project-scenes__launcher { position: fixed; z-index: 2300; right: 24px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 48px; max-width: calc(100vw - 16px); padding: 11px 16px; border: 1px solid var(--aito-ai-line); border-radius: 16px; background: var(--aito-ai-surface); color: var(--aito-ai-text); box-shadow: 0 8px 30px var(--aito-ai-shadow); font: inherit; font-size: .85rem; font-weight: 700; cursor: grab; touch-action: none; user-select: none; }
.project-scenes__launcher b { display: grid; place-items: center; min-width: 25px; height: 25px; padding: 0 5px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-accent); background: var(--aito-ai-raised); font-size: .72rem; }
.project-scenes__launcher.is-dragging,.project-scenes.is-dragging .project-scenes__header { cursor: grabbing; }
.project-scenes { position: fixed; z-index: 2800; top: max(85px, 8dvh); right: 24px; display: flex; flex-direction: column; width: min(690px, calc(100vw - 32px)); max-height: calc(100dvh - 112px); overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 21px; outline: none; color: var(--aito-ai-text); background: var(--aito-ai-surface); box-shadow: 0 20px 70px var(--aito-ai-shadow); }
.project-scenes__header { display: flex; flex: none; justify-content: space-between; align-items: center; gap: 15px; padding: 18px 20px; border-bottom: 1px solid var(--aito-ai-line); background: var(--aito-ai-panel); cursor: grab; touch-action: none; user-select: none; }
.project-scenes__eyebrow { font-size: .58rem; letter-spacing: .13em; font-weight: 700; color: var(--aito-ai-muted); }
.project-scenes h2 { display: flex; align-items: center; gap: 10px; margin: 4px 0 0; font-size: clamp(1.15rem, 2.5vw, 1.4rem); font-weight: 750; line-height: 1.2; }
.project-scenes h2 small { display: grid; place-items: center; min-width: 24px; height: 24px; border: 1px solid var(--aito-ai-line); border-radius: 7px; color: var(--aito-ai-muted); font-size: .65rem; font-weight: 500; }
.project-scenes__close { display: grid; place-items: center; flex: none; width: 39px; height: 39px; border: 1px solid var(--aito-ai-line); border-radius: 11px; color: var(--aito-ai-text); background: var(--aito-ai-surface); cursor: pointer; }
.project-scenes__body { min-height: 0; padding: 15px; overflow: auto; overscroll-behavior: contain; }
.project-scenes__empty { display: grid; place-items: center; gap: 12px; min-height: 180px; color: var(--aito-ai-muted); text-align: center; font-size: .83rem; }
.project-scenes__empty p { margin: 0; }
.project-scenes__row { border: 1px solid var(--aito-ai-line); border-radius: 13px; overflow: hidden; background: var(--aito-ai-panel); }
.project-scenes__row + .project-scenes__row { margin-top: 10px; }
.project-scenes__row.is-open { background: var(--aito-ai-surface); }
.project-scenes__row-head { position: relative; display: flex; align-items: center; gap: 3px; min-height: 79px; padding: 8px; }
.project-scenes__row-toggle { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 0; padding: 0; border: 0; color: inherit; background: none; text-align: left; cursor: pointer; }
.project-scenes__cover { display: grid; flex: 0 0 77px; place-items: center; height: 58px; overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); background: var(--aito-ai-media-bg); }
.project-scenes__cover img { width: 100%; height: 100%; object-fit: cover; }
.project-scenes__name { display: grid; gap: 5px; min-width: 0; }
.project-scenes__name strong { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: .82rem; font-weight: 650; }
.project-scenes__name small { color: var(--aito-ai-muted); font-size: .64rem; line-height: 1.4; }
.project-scenes__editing-space { min-height: 43px; }
.project-scenes__name-input { position: absolute; top: 18px; left: 97px; width: calc(100% - 185px); min-width: 0; height: 38px; padding: 8px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font: inherit; font-size: .8rem; }
.project-scenes__rename,.project-scenes__expand { display: grid; flex: 0 0 33px; place-items: center; height: 37px; border: 0; border-radius: 8px; color: var(--aito-ai-muted); background: none; cursor: pointer; }
.project-scenes__content { display: grid; gap: 12px; padding: 0 13px 15px; }
.project-scenes__content > video { display: block; width: 100%; max-height: 360px; border-radius: 9px; background: #000; }
.project-scenes__unavailable { margin: 0; padding: 20px; border-radius: 10px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); font-size: .8rem; }
.project-scenes__actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.project-scenes__actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 39px; padding: 8px 11px; border: 1px solid var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font: inherit; font-size: .75rem; font-weight: 650; cursor: pointer; }
.project-scenes__actions .project-scenes__primary { color: var(--aito-ai-on-accent); background: var(--aito-ai-gradient); border-color: transparent; }
.project-scenes__actions .project-scenes__icon-action { width: 39px; padding: 7px; }
.project-scenes button:disabled { opacity: .45; cursor: default; }
.project-scenes button:hover:not(:disabled) { background: var(--aito-ai-raised); }
.project-scenes button:focus-visible,.project-scenes input:focus-visible,.project-scenes__launcher:focus-visible { outline: 2px solid var(--aito-ai-accent); outline-offset: 3px; }
@media (max-width: 650px) {
  .project-scenes { inset: 0; width: 100%; height: 100dvh; max-height: none; border: 0; border-radius: 0; }
  .project-scenes__header { padding: calc(12px + env(safe-area-inset-top)) 14px 13px; cursor: default; }
  .project-scenes__body { flex: 1; padding: 12px 10px calc(16px + env(safe-area-inset-bottom)); }
  .project-scenes__launcher { right: 14px; min-height: 44px; padding: 9px 12px; border-radius: 13px; font-size: .77rem; }
  .project-scenes__cover { flex-basis: 62px; height: 51px; }
  .project-scenes__row-toggle { gap: 9px; }
  .project-scenes__row-head { min-height: 71px; padding: 7px; }
  .project-scenes__name strong { font-size: .75rem; }
  .project-scenes__name small { font-size: .58rem; }
  .project-scenes__name-input { left: 79px; top: 17px; width: calc(100% - 160px); }
  .project-scenes__actions button { font-size: .71rem; padding: 8px 9px; }
}
@media (prefers-reduced-motion: reduce) { .project-scenes, .project-scenes__launcher { scroll-behavior: auto; } }
</style>
