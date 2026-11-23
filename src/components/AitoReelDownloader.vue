<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { instagramLink, reelDate, reelIsPending, reelStatus, reelTokens } from 'src/services/instagramReel'

const props = defineProps({
  url: { type: String, default: '' },
  jobId: { type: String, default: '' },
  savedPreview: { type: Object, default: null },
  autoPreview: { type: Boolean, default: true },
  source: { type: String, default: 'studio' },
  access: { type: Function, required: true },
  signedIn: Boolean,
  walletId: { type: String, default: 'web' },
  accountId: { type: String, default: '' },
})
const emit = defineEmits(['preview', 'job', 'dismiss', 'balance', 'login', 'wallet'])
const base = '/aitoia/reels'
const input = ref(''), inputField = ref(null), preview = shallowRef(null), job = shallowRef(null), recent = shallowRef([])
const busy = ref(''), error = ref(''), insufficient = ref(false), canceled = ref(false)
const videoUrl = ref(''), videoFile = shallowRef(null)
const isStudio = computed(() => props.source === 'studio')
const cost = computed(() => preview.value?.costTokens ?? 1000)
const canShare = computed(() => !!videoFile.value && navigator.canShare?.({ files: [videoFile.value] }))
let session, controller, timer, previousAccount = '', requestedPreview = false

function clearFile() {
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = ''
  videoFile.value = null
}
function stop() {
  clearTimeout(timer)
  controller?.abort()
  controller = null
  session = null
  clearFile()
}
function current(signal) { return signal === controller?.signal && !signal.aborted && session?.current() }
function options(timeout = 25000) { return { signal: controller.signal, timeout } }
function apiError(cause, fallback) {
  return typeof cause?.response?.data?.message === 'string' ? cause.response.data.message : fallback
}
function needsLogin() {
  if (!props.signedIn) emit('login')
  else if (session?.current()) return false
  else error.value = 'Aguarde enquanto carregamos sua conta.'
  return true
}
function selectJob(next) {
  if (next.id !== job.value?.id) clearFile()
  if (next.status === 'failed' && reelIsPending(job.value)) emit('balance')
  job.value = next
  preview.value = null
  if (isStudio.value) recent.value = [next, ...recent.value.filter(item => item.id !== next.id)]
}
function scheduleRefresh(delay = 4000) {
  clearTimeout(timer)
  if (controller && (isStudio.value || reelIsPending(job.value))) timer = setTimeout(refresh, delay)
}
async function refresh() {
  if (!controller || !session?.current()) return
  const signal = controller.signal
  try {
    if (isStudio.value) {
      const { data } = await session.get(base + '/jobs', options())
      if (!current(signal)) return
      recent.value = data.data.jobs
      const active = recent.value.find(row => row.id === job.value?.id)
      if (active) selectJob(active)
    } else if (job.value) {
      const requested = job.value.id
      const { data } = await session.get(base + '/jobs/' + encodeURIComponent(requested), options())
      if (current(signal) && job.value?.id === requested) selectJob(data.data)
    }
    if (current(signal)) scheduleRefresh()
  } catch (cause) {
    if (!current(signal)) return
    if (!isStudio.value && [404, 410].includes(cause.response?.status)) {
      job.value = { ...job.value, status: 'expired' }
      return
    }
    if ([401, 403].includes(cause.response?.status)) {
      error.value = apiError(cause, 'Entre novamente para consultar a fila.')
      return
    }
    scheduleRefresh(10000)
  }
}
async function loadPreview() {
  if (busy.value) return
  const link = instagramLink(props.url || input.value)
  if (!link) { error.value = 'Cole um link de vídeo ou Reel do Instagram.'; inputField.value?.focus(); return }
  if (needsLogin()) { requestedPreview = true; return }
  const signal = controller.signal
  const previous = preview.value
  clearFile()
  input.value = link
  error.value = ''
  insufficient.value = false
  canceled.value = false
  busy.value = 'preview'
  try {
    const { data } = await session.post(base + '/preview', { url: link }, options(75000))
    if (!current(signal)) return
    const item = data.data
    if (!item.previewToken || !Number.isFinite(item.costTokens)) throw Error('Prévia inválida.')
    const { previewToken, title, costTokens, expiresAt } =
      previous && Date.parse(previous.expiresAt) > Date.now() ? previous : item
    const metadata = { previewToken, title, costTokens, expiresAt }
    const thumbnailUrl = /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(item.thumbnailUrl || '') ? item.thumbnailUrl : ''
    preview.value = { ...metadata, thumbnailUrl }
    job.value = null
    emit('preview', metadata)
  } catch (cause) {
    if (current(signal)) error.value = apiError(cause, 'Não foi possível buscar a prévia desse Reel.')
  } finally { if (current(signal)) busy.value = '' }
}
async function confirm() {
  if (busy.value || !preview.value || needsLogin()) return
  if (Date.parse(preview.value.expiresAt) <= Date.now()) {
    preview.value = null
    error.value = 'A prévia expirou. Consulte a capa novamente.'
    return
  }
  const signal = controller.signal
  busy.value = 'confirm'
  error.value = ''
  insufficient.value = false
  try {
    const { data } = await session.post(base + '/jobs', {
      previewToken: preview.value.previewToken, source: props.source, walletId: props.walletId,
    }, options(35000))
    if (!current(signal)) return
    selectJob(data.data)
    emit('job', job.value.id)
    emit('balance')
    scheduleRefresh(1500)
  } catch (cause) {
    if (!current(signal)) return
    const status = cause.response?.status
    if (status === 410) preview.value = null
    insufficient.value = status === 402
    error.value = apiError(cause, 'Não foi possível confirmar a conversão. Tente novamente.')
  } finally { if (current(signal)) busy.value = '' }
}
function resetSelection() {
  clearFile()
  preview.value = null; job.value = null; error.value = ''; insufficient.value = false
  if (isStudio.value) { input.value = ''; inputField.value?.focus() }
  else { canceled.value = true; emit('dismiss') }
}
async function pasteLink() {
  try {
    const value = instagramLink(await navigator.clipboard.readText())
    if (!value) { error.value = 'Copie o link de uma publicação do Instagram.'; return }
    input.value = value
    error.value = ''
  } catch { error.value = 'Use a opção Colar do navegador no campo do link.' }
  finally { inputField.value?.focus() }
}
function pasteNative(event) {
  const value = instagramLink(event.clipboardData?.getData('text/plain'))
  if (value) { event.preventDefault(); input.value = value }
}
async function loadFile(download) {
  if (busy.value || !job.value || job.value.status !== 'ready' || needsLogin()) return
  const signal = controller.signal
  busy.value = 'download'
  error.value = ''
  try {
    if (!videoFile.value) {
      const { data: blob } = await session.get(base + '/jobs/' + encodeURIComponent(job.value.id) + '/video',
        { ...options(120000), responseType: 'blob' })
      if (!current(signal)) return
      if (!blob?.size || blob.type?.split(';')[0] !== 'video/mp4') throw Error('Arquivo incompleto.')
      videoFile.value = new File([blob], 'reel-' + job.value.id + '.mp4', { type: 'video/mp4' })
      videoUrl.value = URL.createObjectURL(videoFile.value)
    }
    if (download) {
      const anchor = document.createElement('a')
      anchor.href = videoUrl.value; anchor.download = videoFile.value.name
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
    }
  } catch (cause) {
    if (!current(signal)) return
    if ([404, 410].includes(cause.response?.status)) {
      await refresh()
      if (current(signal)) error.value = 'O arquivo temporário já expirou.'
    } else error.value = 'Não foi possível receber o vídeo completo. Tente baixar novamente.'
  } finally { if (current(signal)) busy.value = '' }
}
async function shareFile() {
  try { await navigator.share({ files: [videoFile.value], title: job.value.title || 'Reel' }) }
  catch (cause) { if (cause.name !== 'AbortError') error.value = 'Use Baixar MP4 para salvar o vídeo.' }
}
function init() {
  const draft = previousAccount ? '' : input.value
  previousAccount = props.accountId
  stop()
  input.value = props.url || draft
  canceled.value = false; recent.value = []; job.value = null; preview.value = null; busy.value = ''; error.value = ''; insufficient.value = false
  if (!props.signedIn || !props.accountId) return
  session = props.access()
  controller = new AbortController()
  if (props.jobId) { job.value = { id: props.jobId, status: 'queued' }; void refresh(); return }
  if (props.savedPreview && Date.parse(props.savedPreview.expiresAt) > Date.now()) preview.value = props.savedPreview
  else if (requestedPreview || (props.url && props.autoPreview)) {
    requestedPreview = false
    void loadPreview()
  }
  if (isStudio.value) void refresh()
}
watch([() => props.signedIn, () => props.accountId, () => props.url], init, { immediate: true })
watch(() => props.jobId, id => { if (id && id !== job.value?.id) init() })
onBeforeUnmount(stop)
</script>

<template>
  <section class="reel-tool" aria-label="Baixar Reels">
    <form v-if="isStudio && !job && !preview" class="reel-tool__form" @submit.prevent="loadPreview">
      <label>Link do Instagram
        <span class="reel-tool__input">
          <input ref="inputField" v-model="input" inputmode="url" placeholder="https://www.instagram.com/reel/…" maxlength="2048"
            autocomplete="off" autocapitalize="none" :spellcheck="false" :disabled="Boolean(busy)" @paste="pasteNative">
          <button type="button" title="Colar link" aria-label="Colar link" :disabled="Boolean(busy)" @click="pasteLink"><q-icon name="mdi-content-paste" /></button>
        </span>
      </label>
      <button type="submit" class="reel-tool__primary" :disabled="Boolean(busy) || !input.trim()">
        <q-spinner v-if="busy === 'preview'" size="17px" /><q-icon v-else name="mdi-image-search-outline" />
        {{ busy === 'preview' ? 'Buscando capa…' : 'Ver prévia' }}
      </button>
    </form>
    <button v-else-if="!isStudio && !job && !preview && !canceled" type="button" :disabled="Boolean(busy)" @click="loadPreview">
      <q-spinner v-if="busy === 'preview'" size="17px" /><q-icon v-else name="mdi-instagram" /> {{ busy === 'preview' ? 'Buscando capa…' : 'Ver prévia do Reel' }}
    </button>
    <p v-if="canceled" class="reel-tool__muted">Conversão cancelada.</p>
    <div v-if="preview" class="reel-tool__preview">
      <img v-if="preview.thumbnailUrl" :src="preview.thumbnailUrl" alt="Capa do Reel">
      <div>
        <strong>{{ preview.title || 'Reel do Instagram' }}</strong>
        <button v-if="!preview.thumbnailUrl" type="button" :disabled="Boolean(busy)" @click="loadPreview">Buscar capa</button>
        <p>{{ cost ? 'A conversão custa ' + reelTokens(cost) + ' AitoTokens.' : 'Conversão administrativa gratuita.' }}</p>
        <div class="reel-tool__actions">
          <button type="button" class="reel-tool__primary" :disabled="Boolean(busy)" @click="confirm">
            <q-spinner v-if="busy === 'confirm'" size="17px" /><q-icon v-else name="mdi-playlist-plus" /> Confirmar e entrar na fila
          </button>
          <button type="button" :disabled="Boolean(busy)" @click="resetSelection">Cancelar</button>
        </div>
      </div>
    </div>
    <article v-if="job" class="reel-tool__job">
      <strong>{{ job.title || 'Reel do Instagram' }}</strong>
      <p role="status"><q-spinner v-if="reelIsPending(job)" size="16px" /> {{ reelStatus(job.status) }}<span v-if="job.status === 'queued' && job.position"> · {{ job.position }}º na fila</span></p>
      <p v-if="job.status === 'failed'" class="reel-tool__muted">{{ job.message || 'A conversão falhou.' }} <span v-if="job.billingStatus === 'released'">Os AitoTokens foram liberados na carteira.</span></p>
      <small v-if="job.status === 'ready' && job.expiresAt">Disponível até {{ reelDate(job.expiresAt) }}</small>
      <video v-if="videoUrl" controls playsinline preload="metadata" :src="videoUrl" />
      <div class="reel-tool__actions">
        <template v-if="job.status === 'ready'">
          <button type="button" class="reel-tool__primary" :disabled="Boolean(busy)" @click="loadFile(true)"><q-spinner v-if="busy === 'download'" size="17px" /><q-icon v-else name="mdi-download" /> Baixar MP4</button>
          <button v-if="!videoUrl" type="button" :disabled="Boolean(busy)" @click="loadFile(false)">Ver vídeo</button>
          <button v-if="canShare" type="button" @click="shareFile">Salvar no Fotos / compartilhar</button>
        </template>
        <button v-if="isStudio" type="button" :disabled="Boolean(busy)" @click="resetSelection">Outro Reel</button>
        <button v-else-if="['failed', 'expired'].includes(job.status)" type="button" :disabled="Boolean(busy)" @click="loadPreview">Consultar nova prévia</button>
      </div>
    </article>
    <div v-if="error" class="reel-tool__error" role="alert">{{ error }} <button v-if="insufficient" type="button" @click="emit('wallet')">Recarregar AitoTokens</button></div>
    <div v-if="isStudio && recent.some(row => row.id !== job?.id)" class="reel-tool__recent">
      <strong>Minhas conversões</strong>
      <button v-for="item in recent.filter(row => row.id !== job?.id)" :key="item.id" type="button" :disabled="Boolean(busy)" @click="selectJob(item); error = ''; insufficient = false">
        <span>{{ item.title || 'Reel do Instagram' }}</span><small>{{ reelStatus(item.status) }}</small><q-icon name="mdi-chevron-right" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.reel-tool { display: grid; gap: 14px; min-width: 0; color: var(--aito-ai-text, inherit); font-size: .9rem; }
.reel-tool button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 7px 12px; border: 1px solid var(--aito-ai-line, #809691); border-radius: 9px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.reel-tool button:disabled { cursor: default; opacity: .6; }
.reel-tool button:focus-visible, .reel-tool input:focus-visible { outline: 2px solid var(--aito-ai-accent, #167d6e); outline-offset: 2px; }
.reel-tool .reel-tool__primary { border-color: #106456; background: #106456; color: #fff; font-weight: 650; }
.reel-tool__form, .reel-tool__recent, .reel-tool__job, .reel-tool label { display: grid; gap: 8px; }
.reel-tool__form>button, .reel-tool>button { justify-self: start; }
.reel-tool__input { display: flex; align-items: center; min-width: 0; padding: 3px; border: 1px solid var(--aito-ai-line, #809691); border-radius: 9px; }
.reel-tool__input input { flex: 1; width: 0; padding: 8px; border: none; background: transparent; color: inherit; font: inherit; }
.reel-tool__input button { border: 0; }
.reel-tool__preview { display: flex; align-items: start; gap: 15px; flex-wrap: wrap; }
.reel-tool__preview>div { flex: 1 1 185px; min-width: 0; }
.reel-tool__preview img { display: block; width: 110px; max-width: 40%; aspect-ratio: 3/4; object-fit: cover; border-radius: 9px; }
.reel-tool__preview p { margin: 7px 0 12px; }
.reel-tool__job p, .reel-tool__muted { margin: 0; }
.reel-tool__actions { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.reel-tool__job video { width: 100%; max-height: 330px; border-radius: 10px; background: #131918; }
.reel-tool__muted, .reel-tool small { color: var(--aito-ai-muted, inherit); }
.reel-tool__recent { padding-top: 10px; border-top: 1px solid var(--aito-ai-line, #809691); }
.reel-tool__recent button { justify-content: space-between; text-align: left; }
.reel-tool__recent button span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reel-tool__error { padding: 9px 12px; border-left: 3px solid #b95252; }
.reel-tool strong { overflow-wrap: anywhere; }
</style>
