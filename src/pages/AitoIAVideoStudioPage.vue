<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMeta } from 'quasar'
import { api } from 'boot/axios'
import { useAitoIA, usd } from 'src/composables/useAitoIA'
import { readAnswer } from 'src/services/aitoiaChat'
import { downloadAitoIAFile, zipAitoIAFiles } from 'src/services/aitoiaArchive'
import { closeStudioMedia, drawStudioFrame, maxStudioScenes, openStudioMedia, parseStudioScript,
  recordStudioVideo, sceneSeconds, studioFrame, studioNarration, studioTimeline, studioVideoMime, videoFormats } from 'src/services/aitoiaVideo'
import 'src/css/aitoia-theme.css'

const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const AitoIAWallet = defineAsyncComponent(() => import('components/AitoIAWallet.vue'))
useMeta({ title: 'AitoIA | Estúdio de vídeo', meta: { description: { name: 'description', content: 'Crie roteiros, narrações e vídeos com AitoIA. Monte cenas e exporte no navegador.' } } })
const wallet = useAitoIA({ chatHistory: false })
const { signedIn, status, walletId, accountId, models } = wallet
const authOpen = ref(false)
const authMode = ref('register')
const walletOpen = ref(false)
const tabs = [
  { id: 'scenes', label: 'Cenas', icon: 'mdi-view-dashboard-outline' },
  { id: 'voice', label: 'Locução', icon: 'mdi-waveform' },
  { id: 'ai', label: 'Vídeo com IA', icon: 'mdi-movie-open-play-outline' },
]
const videoCatalog = [
  { id: 'seedance-2.5', maker: 'ByteDance', name: 'Seedance 2.5', summary: 'Sequências com movimento de câmera e direção de cena.', poster: '0% 0%' },
  { id: 'genjutsu-light', maker: 'Higgsfield', name: 'Genjutsu Light', summary: 'Transfere o movimento de um vídeo para outra cena.', poster: '100% 0%', limitation: 'Requer vídeo de referência' },
  { id: 'genjutsu', maker: 'Higgsfield', name: 'Genjutsu', summary: 'Troca elementos ou estilos mantendo o movimento original.', poster: '0% 33.3333%', limitation: 'Requer vídeo de referência' },
  { id: 'kling-4.0', maker: 'Kling', name: 'Kling 4.0', summary: 'Cenas cinematográficas com ações e enquadramentos detalhados.', poster: '100% 33.3333%' },
  { id: 'kling-4.0-flash', maker: 'Kling', name: 'Kling 4.0 Flash', summary: 'Clipes rápidos em 720p para experimentar uma ideia.', poster: '0% 66.6667%' },
  { id: 'minimax-h3', maker: 'MiniMax', name: 'MiniMax H3', summary: 'Movimento de personagem e detalhes em alta resolução.', poster: '100% 66.6667%' },
  { id: 'wan-3.0-prime', maker: 'Alibaba', name: 'Wan 3.0 Prime', summary: 'Geração rápida para cenas em movimento e estilos variados.', poster: '0% 100%' },
  { id: 'grok-imagine-2.0', maker: 'xAI', name: 'Grok Imagine 2.0', summary: 'Cria e edita imagens com atenção aos detalhes.', poster: '100% 100%', type: 'image', limitation: 'Geração de imagem' },
]
const title = ref('Meu vídeo')
const tab = ref('scenes')
const formatId = ref(videoFormats[0].id)
const format = computed(() => videoFormats.find(item => item.id === formatId.value))
const freshScene = (fields = {}) => ({ id: crypto.randomUUID(), duration: 5, heading: '', caption: '', media: null, ...fields })
const scenes = shallowRef([freshScene()])
const sceneId = ref(scenes.value[0].id)
const selectedScene = computed(() => scenes.value.find(scene => scene.id === sceneId.value))
const timeline = computed(() => studioTimeline(scenes.value))
const narrationText = ref('')
const narration = shallowRef(null)
const voicePreview = shallowRef(null)
const recording = shallowRef(null)
const generated = shallowRef(null)
const generatedDuration = ref(0)
const activeJob = shallowRef(null)
const prompt = ref('')
const scriptPrompt = ref('')
const audio = ref(null)
const canvas = ref(null)
const imageInput = ref(null)
const audioInput = ref(null)
const playhead = ref(0)
const playing = ref(false)
const progress = ref(0)
const busy = ref('')
const error = ref('')
const notice = ref('')
const options = shallowRef(null)
const optionsLoading = ref(false)
const optionsError = ref('')
const voice = ref('')
const videoModel = ref('')
const videoOption = ref('')
const clipPrompt = ref(null)
const modelOffers = computed(() => new Map((options.value?.videoModels || []).map(item => [item.id, item.options])))
const modelOptions = computed(() => modelOffers.value.get(videoModel.value) || [])
const offer = computed(() => modelOptions.value.find(item => item.id === videoOption.value))
const selectedModel = computed(() => videoCatalog.find(item => item.id === videoModel.value))
const modelCards = computed(() => videoCatalog.map(item => {
  const offers = modelOffers.value.get(item.id) || []
  const available = offers.length > 0
  const perSecond = available ? Math.min(...offers.map(option => option.priceUsdCents / option.seconds)) : 0
  const availability = item.limitation ? 'Fora do Estúdio' : available ? 'Texto para vídeo' :
    !signedIn.value ? 'Entre para usar' : optionsLoading.value ? 'Consultando' : 'Indisponível'
  return { ...item, available, perSecond, availability, selectable: available || (!signedIn.value && !item.limitation) }
}))
const optionResolution = item => item?.resolution || '720p'
const videoAspects = computed(() => [...new Set(modelOptions.value.map(item => item.format))])
const videoResolutions = computed(() => [...new Set(modelOptions.value.filter(item => item.format === offer.value?.format).map(optionResolution))])
const videoDurations = computed(() => modelOptions.value.filter(item =>
  item.format === offer.value?.format && optionResolution(item) === optionResolution(offer.value)))
const maxNarration = computed(() => options.value?.voice?.maxCharacters || 4096)
const voicePrice = computed(() => narrationText.value.trim().length * (options.value?.voice?.priceUsdCentsPerCharacter || 0))
const sample = 'Olá. Esta é uma amostra da minha voz em português.'
const samplePrice = computed(() => sample.length * (options.value?.voice?.priceUsdCentsPerCharacter || 0))
const mediaBytes = computed(() => scenes.value.reduce((sum, scene) => sum + (scene.media?.file.size || 0), narration.value?.file.size || 0))
const canRecord = ref(false)
const mayEdit = computed(() => !busy.value)
const durationLabel = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
let videoFrame
let displayedVideo
let activeOperation
let optionsRequest
let mounted = false
const jobStorageKey = 'aitoia-video-jobs'
const jobLifetime = 24 * 60 * 60 * 1000

function showAuth(mode = 'register') { authMode.value = mode; authOpen.value = true }
function selectVideoModel(item) {
  videoModel.value = item.id
  nextTick(() => clipPrompt.value?.focus())
}
function changeVideoConfiguration(field, value) {
  const current = offer.value
  const currentResolution = optionResolution(current)
  const matching = modelOptions.value.filter(item => field === 'format' ? item.format === value
    : item.format === current.format && optionResolution(item) === value)
  const next = matching.find(item => optionResolution(item) === currentResolution && item.seconds === current.seconds) ||
    matching.find(item => item.seconds === current.seconds) || matching[0]
  if (next) videoOption.value = next.id
}
function showWallet() {
  if (!signedIn.value) return showAuth()
  walletOpen.value = true
  wallet.refreshStatus()
  wallet.loadHistory()
}
function authorization(extra = {}) {
  return { Authorization: `Bearer ${localStorage.getItem('aito_user_token') || ''}`, ...extra }
}
function isAbort(cause) { return cause?.name === 'AbortError' || cause?.code === 'ERR_CANCELED' }
async function report(cause) {
  if (isAbort(cause)) return
  if (cause.response?.status === 402) showWallet()
  if (cause.response?.status === 401) {
    await wallet.refreshStatus()
    if (!signedIn.value) showAuth('login')
  }
  const body = cause.response?.data
  const response = body instanceof Blob ? await body.text().then(text => JSON.parse(text)).catch(() => ({})) : body
  error.value = response?.message || (cause.response ? 'Não foi possível concluir a solicitação.' : cause.message) || 'Ocorreu um erro. Tente novamente.'
}
async function run(kind, action) {
  if (busy.value) return
  pause()
  error.value = ''
  notice.value = ''
  const controller = new AbortController()
  activeOperation = controller
  busy.value = kind
  try { await action(controller.signal) } catch (cause) { if (mounted && !controller.signal.aborted) await report(cause) }
  finally {
    if (activeOperation === controller) { activeOperation = null; busy.value = ''; progress.value = 0 }
  }
}
async function loadOptions() {
  if (!signedIn.value) return
  optionsRequest?.abort()
  const controller = new AbortController()
  optionsRequest = controller
  optionsLoading.value = true
  optionsError.value = ''
  try {
    const { data } = await api.get('/aitoia/video/options', { headers: authorization(), signal: controller.signal })
    if (controller.signal.aborted) return
    options.value = data.data
    if (!options.value?.voices?.some(item => item.id === voice.value)) voice.value = options.value?.voices?.[0]?.id || ''
    if (!modelOffers.value.get(videoModel.value)?.length) {
      videoModel.value = modelOffers.value.get('kling-4.0-flash')?.length ? 'kling-4.0-flash' : options.value?.videoModels?.[0]?.id || ''
    }
    restoreJob(accountId.value, options.value?.recoverableGeneration)
  } catch (cause) {
    if (!controller.signal.aborted) optionsError.value = cause.response?.data?.message || 'Não foi possível consultar o catálogo.'
  } finally { if (optionsRequest === controller) optionsLoading.value = false }
}
watch(modelOptions, list => { if (!list.some(item => item.id === videoOption.value)) videoOption.value = list[0]?.id || '' })
watch(signedIn, active => { if (active) loadOptions(); else { optionsRequest?.abort(); options.value = null; optionsLoading.value = false } })
function jobStorage(change) {
  try {
    const saved = JSON.parse(localStorage.getItem(jobStorageKey) || '{}')
    const now = Date.now()
    const entries = Object.fromEntries(Object.entries(saved).filter(([id, item]) => /^[a-f0-9]{24}$/i.test(id) &&
      typeof item?.id === 'string' && item.id.length <= 1500 && item.expiresAt > now && item.expiresAt <= now + jobLifetime))
    const result = change(entries)
    localStorage.setItem(jobStorageKey, JSON.stringify(entries))
    return result
  } catch { return undefined }
}
function restoreJob(id, recoverable) {
  if (!id || activeJob.value || generated.value) return
  const saved = jobStorage(entries => entries[id]) || recoverable
  if (saved?.id) { activeJob.value = { id: saved.id, status: 'queued' }; tab.value = 'ai' }
}
watch(accountId, (next, previous) => {
  if (previous) {
    activeOperation?.abort()
    optionsRequest?.abort()
    resetProject()
    if (signedIn.value) loadOptions()
  }
  if (next) restoreJob(next, previous ? null : options.value?.recoverableGeneration)
})

function syncVideo(media, offset, animate) {
  const element = media?.isVideo ? media.element : null
  const changed = element !== displayedVideo
  if (changed) displayedVideo?.pause()
  displayedVideo = element
  if (!element) return
  const time = Math.max(0, Math.min(offset, element.duration - 0.04))
  if (changed || Math.abs(element.currentTime - time) > (animate ? .38 : .03)) element.currentTime = time
  if (animate && offset < element.duration && element.paused) element.play().catch(() => {})
  if ((!animate || offset >= element.duration) && !element.paused) element.pause()
}
function paint(time, animate = false, target = canvas.value) {
  const frame = studioFrame(timeline.value, time)
  if (!frame) return
  syncVideo(frame.scene.media, frame.time, animate)
  drawStudioFrame(target, frame.scene)
  if (!animate && displayedVideo?.seeking) {
    const source = displayedVideo
    source.onseeked = () => {
      source.onseeked = null
      if (!playing.value && busy.value !== 'render' && displayedVideo === source) drawStudioFrame(target, studioFrame(timeline.value, playhead.value)?.scene)
    }
  }
}
function pause() {
  playing.value = false
  cancelAnimationFrame(videoFrame)
  displayedVideo?.pause()
  audio.value?.pause()
}
function seek(time) {
  pause()
  playhead.value = Math.min(timeline.value.duration, Math.max(0, Number(time) || 0))
  paint(playhead.value)
}
function play() {
  if (playing.value) return pause()
  if (!mayEdit.value) return
  if (playhead.value >= timeline.value.duration) seek(0)
  const start = performance.now() - playhead.value * 1000
  playing.value = true
  if (audio.value?.readyState > 0 && playhead.value < audio.value.duration) {
    audio.value.currentTime = playhead.value
    audio.value.play().catch(() => {})
  }
  const tick = now => {
    if (!playing.value) return
    playhead.value = Math.min((now - start) / 1000, timeline.value.duration)
    paint(playhead.value, true)
    if (playhead.value >= timeline.value.duration) pause()
    else videoFrame = requestAnimationFrame(tick)
  }
  videoFrame = requestAnimationFrame(tick)
}
function selectScene(id) {
  sceneId.value = id
  const segment = timeline.value.segments.find(item => item.scene.id === id)
  if (segment) seek(segment.start)
}
function editScene(values, id = sceneId.value) {
  scenes.value = scenes.value.map(scene => scene.id === id ? { ...scene, ...values } : scene)
}
function addScene() {
  if (!mayEdit.value || scenes.value.length >= maxStudioScenes) return
  const scene = freshScene()
  scenes.value = [...scenes.value, scene]
  selectScene(scene.id)
}
function deleteScene() {
  if (scenes.value.length === 1 || !mayEdit.value) return
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  closeStudioMedia(selectedScene.value?.media)
  scenes.value = scenes.value.filter(scene => scene.id !== sceneId.value)
  selectScene(scenes.value[Math.max(0, index - 1)].id)
}
function moveScene(delta) {
  if (!mayEdit.value) return
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  const list = [...scenes.value]
  if (!list[index + delta]) return
  ;[list[index + delta], list[index]] = [list[index], list[index + delta]]
  scenes.value = list
  selectScene(sceneId.value)
}
function removeMedia() {
  closeStudioMedia(selectedScene.value?.media)
  editScene({ media: null })
}
async function setSceneMedia(file, signal, id = sceneId.value) {
  const current = scenes.value.find(scene => scene.id === id)
  if (!current || !file) return
  const next = await openStudioMedia(file, mediaBytes.value - (current.media?.file.size || 0), signal)
  if (signal.aborted || !mounted) { closeStudioMedia(next); return }
  closeStudioMedia(current.media)
  editScene({ media: next }, id)
}
function attach(file) { if (file) run('media', signal => setSceneMedia(file, signal)) }
function fileFrom(event, callback) { callback(event.target.files[0]); event.target.value = '' }
function pasteMedia(event) {
  const file = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith('image/'))
  if (file) { event.preventDefault(); attach(file) }
}
function replaceNarration(file) {
  const next = studioNarration(file, mediaBytes.value - (narration.value?.file.size || 0))
  if (narration.value) URL.revokeObjectURL(narration.value.url)
  narration.value = next
}
function removeNarration() {
  pause()
  if (narration.value) URL.revokeObjectURL(narration.value.url)
  narration.value = null
}
function updateRecording(blob) {
  if (recording.value) URL.revokeObjectURL(recording.value.url)
  recording.value = blob ? { blob, url: URL.createObjectURL(blob), filename: `aitoia-video.${blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}` } : null
}
async function renderVideo() {
  if (!canRecord.value) return
  const duration = timeline.value.duration
  await run('render', async signal => {
    const output = document.createElement('canvas')
    output.width = format.value.width
    output.height = format.value.height
    try {
      const result = await recordStudioVideo(output, duration, { narration: narration.value?.file, signal,
        render(time) { paint(time, true, output); progress.value = time / duration } })
      if (mounted && !signal.aborted) { updateRecording(result); notice.value = 'Seu vídeo está pronto para baixar.' }
    } finally { seek(playhead.value) }
  })
}

function useCredits() {
  if (!signedIn.value) { showAuth(); return false }
  if (!accountId.value || !status.value) return false
  if (status.value.balanceUsdCents <= 0) { showWallet(); return false }
  return true
}
async function makeScript() {
  if (!scriptPrompt.value.trim() || !useCredits()) return
  await run('script', async signal => {
    try {
      const model = models.value.find(item => item.id === 'gpt-6.1-sol') || models.value[0]
      if (!model) throw new Error('O roteiro com IA está temporariamente indisponível.')
      const { data } = await api.post('/aitoia/responses', {
        model: model.id, walletId: walletId.value, reasoning: { effort: model.efforts.includes('medium') ? 'medium' : model.efforts[0] },
        input: [{ role: 'user', content: `Crie um roteiro em português com base no briefing abaixo. Responda somente com JSON válido no formato {"title":"","scenes":[{"heading":"","caption":"","duration":5}],"narration":""}. Use de 3 a ${maxStudioScenes} cenas, cada uma de 1 a 15 segundos, texto curto na tela e narração em português brasileiro. Formato ${format.value.label}. Briefing:\n${scriptPrompt.value.trim()}` }],
      }, { headers: authorization({ 'X-Aito-Request-Id': crypto.randomUUID() }), signal })
      const script = parseStudioScript(readAnswer(data))
      const previous = scenes.value
      script.scenes = script.scenes.map((scene, index) => freshScene({ ...scene, media: previous[index]?.media || null }))
      previous.slice(script.scenes.length).forEach(scene => closeStudioMedia(scene.media))
      scenes.value = script.scenes
      title.value = script.title || title.value
      narrationText.value = script.narration
      selectScene(scenes.value[0].id)
      notice.value = 'Roteiro gerado. Revise as cenas antes de exportar.'
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
async function makeVoice() {
  const text = narrationText.value.trim()
  if (!voice.value || !text || !useCredits()) return
  await run('voice', async signal => {
    try {
      replaceNarration(await requestSpeech(text, signal))
      notice.value = 'Locução pronta. Ouça no player abaixo.'
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
async function requestSpeech(text, signal) {
  const { data } = await api.post('/aitoia/video/voice', { text, voice: voice.value, walletId: walletId.value },
    { headers: authorization({ 'X-Aito-Request-Id': crypto.randomUUID() }), responseType: 'blob', signal })
  signal.throwIfAborted()
  return new File([data], 'locucao-aitoia.mp3', { type: 'audio/mpeg' })
}
function clearVoicePreview() {
  if (voicePreview.value) URL.revokeObjectURL(voicePreview.value.url)
  voicePreview.value = null
}
watch(voice, clearVoicePreview)
async function makeVoicePreview() {
  if (!voice.value || !useCredits()) return
  await run('sample', async signal => {
    try {
      const file = await requestSpeech(sample, signal)
      clearVoicePreview()
      voicePreview.value = { url: URL.createObjectURL(file) }
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
function waitForJob(signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, 4000)
    function cancel() { clearTimeout(timer); reject(signal.reason) }
    signal.addEventListener('abort', cancel, { once: true })
  })
}
async function readJob(job, signal) {
  const expires = Date.now() + 12 * 60_000
  let current = job
  const headers = authorization()
  while (['queued', 'in_progress'].includes(current.status)) {
    activeJob.value = current
    if (Date.now() >= expires) throw new Error('O provedor ainda está gerando o clipe. Confira o resultado novamente.')
    await waitForJob(signal)
    try {
      const { data } = await api.get(`/aitoia/video/generations/${encodeURIComponent(current.id)}`, { headers, signal })
      current = { ...current, ...data.data }
    } catch (cause) {
      if ([404, 410].includes(cause.response?.status)) {
        activeJob.value = null
        jobStorage(entries => { delete entries[accountId.value] })
      }
      throw cause
    }
  }
  activeJob.value = null
  if (current.status !== 'completed') {
    jobStorage(entries => { delete entries[accountId.value] })
    throw new Error(current.message || 'O provedor não conseguiu gerar o vídeo.')
  }
  const url = new URL(current.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('O provedor retornou um endereço de vídeo inválido.')
  generatedDuration.value = 0
  generated.value = { ...current, url: url.href }
  notice.value = 'Clipe pronto. Baixe o arquivo ou adicione-o à sua cena.'
}
function checkJob() {
  if (!activeJob.value || !accountId.value) return
  run('video', signal => readJob(activeJob.value, signal))
}
async function makeVideo() {
  if (!prompt.value.trim() || !offer.value || !useCredits()) return
  await run('video', async signal => {
    try {
      const { data } = await api.post('/aitoia/video/generations', { model: videoModel.value, option: videoOption.value,
        prompt: prompt.value.trim(), walletId: walletId.value }, { headers: authorization({ 'X-Aito-Request-Id': crypto.randomUUID() }), signal })
      signal.throwIfAborted()
      jobStorage(entries => { entries[accountId.value] = { id: data.data.id, expiresAt: Date.now() + jobLifetime } })
      wallet.refreshStatus({ silent: true })
      await readJob(data.data, signal)
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
async function fetchGenerated(signal) {
  const response = await fetch(generated.value.url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim()
  if (!response.ok || !type.startsWith('video/')) throw new Error('Abra o clipe no provedor para baixar o arquivo.')
  if (!response.body) throw new Error('O navegador não conseguiu ler o clipe.')
  const reader = response.body.getReader()
  const parts = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 60 * 1024 * 1024) throw new Error('O clipe excede 60 MB. Abra o arquivo no provedor para baixá-lo.')
      parts.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  return new File(parts, `clipe-aitoia.${type === 'video/webm' ? 'webm' : 'mp4'}`, { type })
}
function downloadGenerated() {
  if (!generated.value) return
  run('media', async signal => {
    const file = await fetchGenerated(signal)
    signal.throwIfAborted()
    downloadAitoIAFile(file, file.name)
  })
}
function addGenerated() {
  if (!generated.value) return
  run('media', async signal => {
    await setSceneMedia(await fetchGenerated(signal), signal)
    signal.throwIfAborted()
    const duration = selectedScene.value?.media?.element.duration
    editScene({ duration: sceneSeconds(duration) })
    if (duration > 15) notice.value = 'A cena usa os primeiros 15 segundos. O clipe completo continua disponível para download.'
    tab.value = 'scenes'
  })
}
async function archiveProject() {
  await run('archive', async signal => {
    const files = []
    function add(file, prefix) {
      if (!file) return undefined
      const safe = String(file.name || 'arquivo').replace(/[^\p{L}\p{N} ._-]/gu, '_').replace(/^[. ]+/, '').slice(0, 120) || 'arquivo'
      const name = `midias/${prefix}-${safe}`
      files.push({ name, blob: file })
      return name
    }
    const metadata = { format: 'aitoia-video', version: 1, title: title.value, aspectRatio: format.value.label,
      scenes: scenes.value.map(({ media, id, ...scene }, index) => ({ ...scene, media: add(media?.file, `cena-${index + 1}`) })),
      narration: { text: narrationText.value, media: add(narration.value?.file, 'locucao') } }
    if (recording.value) files.push({ name: recording.value.filename, blob: recording.value.blob })
    const manifest = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json;charset=utf-8' })
    const archive = await zipAitoIAFiles([{ name: 'projeto.json', blob: manifest }, ...files])
    signal.throwIfAborted()
    downloadAitoIAFile(archive, 'aitoia-projeto-video.zip')
  })
}
function resetProject() {
  pause()
  scenes.value.forEach(scene => closeStudioMedia(scene.media))
  removeNarration()
  clearVoicePreview()
  updateRecording(null)
  generated.value = null
  activeJob.value = null
  scriptPrompt.value = ''
  prompt.value = ''
  narrationText.value = ''
  title.value = 'Meu vídeo'
  scenes.value = [freshScene()]
  selectScene(scenes.value[0].id)
}
watch([timeline, format], () => { if (mounted && busy.value !== 'render') seek(playhead.value) }, { flush: 'post' })
onMounted(async () => { mounted = true; canRecord.value = Boolean(studioVideoMime()); await nextTick(); paint(0) })
onBeforeUnmount(() => { mounted = false; activeOperation?.abort(); optionsRequest?.abort(); resetProject() })
</script>

<template>
  <div class="aito-ai-theme video-studio">
    <header class="video-studio__bar">
      <router-link to="/" class="video-studio__brand" aria-label="Site AitoSoftwares"><img src="/aito-logo-restored.png" width="37" height="37" alt="" /> <strong>AitoIA</strong></router-link>
      <nav class="video-studio__nav" aria-label="Ferramentas AitoIA">
        <router-link :to="{ name: 'aito-ia' }"><q-icon name="mdi-message-text-outline" size="19px" /> <span>Chat</span></router-link>
        <router-link :to="{ name: 'aito-ia-video-studio' }"><q-icon name="mdi-movie-open-play-outline" size="19px" /> <span>Estúdio de vídeo</span></router-link>
      </nav>
      <div class="video-studio__account">
        <button v-if="signedIn" class="video-studio__balance" type="button" aria-label="Abrir carteira AitoTokens" @click="showWallet"><img src="/aitotokens.svg" width="26" height="26" alt="" /><span>{{ status ? usd(status.balanceUsdCents) : 'AitoTokens' }}</span><q-icon name="mdi-plus" size="16px" /></button>
        <template v-else><button class="video-studio__login" type="button" @click="showAuth('login')">Entrar</button><button class="video-studio__primary" type="button" @click="showAuth()">Criar conta</button></template>
      </div>
    </header>

    <main class="video-studio__main" @paste="pasteMedia">
      <div class="video-studio__intro">
        <div><h1>Estúdio de vídeo</h1><p>Escreva o roteiro, dê voz à ideia e monte seu vídeo no navegador.</p></div>
        <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="archiveProject"><q-icon name="mdi-folder-zip-outline" size="20px" /> Baixar projeto ZIP</button>
      </div>
      <p v-if="error" role="alert" class="video-studio__notice video-studio__notice--error"><q-icon name="mdi-alert-circle-outline" size="20px" /> {{ error }}</p>
      <p v-else-if="notice" role="status" class="video-studio__notice"><q-icon name="mdi-check-circle-outline" size="20px" /> {{ notice }}</p>

      <div class="video-studio__grid">
        <div class="video-studio__tabs" role="group" aria-label="Ferramentas do editor"><button v-for="item in tabs" :key="item.id" type="button" :aria-pressed="tab === item.id" :disabled="!mayEdit" @click="tab = item.id"><q-icon :name="item.icon" size="20px" /> {{ item.label }}</button></div>

        <section v-if="tab === 'ai'" class="video-studio__catalog" aria-labelledby="video-studio-models">
          <div class="video-studio__catalog-header">
            <div><h2 id="video-studio-models">Modelos de geração</h2><p>Escolha um modelo para configurar seu clipe.</p></div>
            <button v-if="signedIn" class="video-studio__icon" type="button" aria-label="Atualizar catálogo de vídeos" :disabled="optionsLoading || !mayEdit" @click="loadOptions"><q-icon name="mdi-refresh" size="21px" /></button>
          </div>
          <div class="video-studio__model-grid">
            <article v-for="item in modelCards" :key="item.id" class="video-studio__model-card" :class="{ 'video-studio__model-card--selected': videoModel === item.id && item.selectable }">
              <div class="video-studio__model-poster" :style="{ backgroundPosition: item.poster }" aria-hidden="true">
                <span class="video-studio__model-type" :class="{ 'video-studio__model-type--image': item.type === 'image' }"><q-icon :name="item.type === 'image' ? 'mdi-image-outline' : 'mdi-play-box-outline'" size="15px" /> {{ item.type === 'image' ? 'Imagem' : 'Vídeo' }}</span>
              </div>
              <div class="video-studio__model-content">
                <div><span class="video-studio__model-maker">{{ item.maker }}</span><h3>{{ item.name }}</h3></div>
                <p>{{ item.summary }}</p>
                <div class="video-studio__model-meta">
                  <span v-if="item.available" class="video-studio__model-rate" title="Preço de referência do estúdio">A partir de {{ usd(item.perSecond) }}/s</span>
                  <span :class="{ 'video-studio__model-status--available': item.available }">{{ item.availability }}</span>
                </div>
              </div>
              <button v-if="item.selectable" class="video-studio__model-hit" type="button" :disabled="!mayEdit" :aria-label="`Selecionar ${item.name}`" :aria-pressed="videoModel === item.id" @click="selectVideoModel(item)">
                <q-icon :name="videoModel === item.id ? 'mdi-check-circle' : 'mdi-arrow-top-right'" size="18px" aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>

        <section class="video-studio__panel video-studio__editor" aria-label="Editor do projeto">

          <div v-if="tab === 'scenes'" class="video-studio__section">
            <div class="video-studio__fields">
              <label>Nome do projeto<input v-model="title" maxlength="80" :disabled="!mayEdit" /></label>
              <label>Formato<select v-model="formatId" :disabled="!mayEdit"><option v-for="item in videoFormats" :key="item.id" :value="item.id">{{ item.title }} {{ item.label }}</option></select></label>
            </div>
            <details class="video-studio__script">
              <summary><q-icon name="mdi-creation-outline" size="19px" /> Criar roteiro com IA</summary>
              <label>Briefing<textarea v-model="scriptPrompt" rows="3" maxlength="3000" placeholder="Descreva o assunto, o público e a duração desejada…" :disabled="!mayEdit" /></label>
              <button type="button" class="video-studio__secondary" :disabled="!scriptPrompt.trim() || !mayEdit" @click="makeScript"><q-spinner v-if="busy === 'script'" size="18px" /><q-icon v-else name="mdi-creation-outline" size="18px" /> {{ busy === 'script' ? 'Escrevendo…' : 'Gerar roteiro' }}</button>
              <small>O roteiro preenche o texto das cenas e da locução. Consumo conforme o modelo OpenAI.</small>
            </details>
            <div class="video-studio__scene-heading"><h2>Cenas</h2><button class="video-studio__secondary" type="button" :disabled="!mayEdit || scenes.length >= maxStudioScenes" @click="addScene"><q-icon name="mdi-plus" size="18px" /> Adicionar</button></div>
            <div class="video-studio__scenes" role="group" aria-label="Cenas">
              <button v-for="(scene, index) in scenes" :key="scene.id" type="button" :aria-pressed="sceneId === scene.id" :disabled="!mayEdit" @click="selectScene(scene.id)"><strong>{{ index + 1 }}</strong><span>{{ scene.duration }} s</span></button>
            </div>
            <template v-if="selectedScene">
              <div class="video-studio__fields">
                <label>Título na cena<input :value="selectedScene.heading" maxlength="110" placeholder="Ex. Tudo em um só lugar" :disabled="!mayEdit" @input="editScene({ heading: $event.target.value })" /></label>
                <label>Duração (s)<input :value="selectedScene.duration" type="number" min="1" max="15" :disabled="!mayEdit" @change="editScene({ duration: sceneSeconds($event.target.value) }); $event.target.value = sceneSeconds($event.target.value)" /></label>
              </div>
              <label>Legenda<textarea :value="selectedScene.caption" rows="2" maxlength="180" placeholder="Complemento opcional" :disabled="!mayEdit" @input="editScene({ caption: $event.target.value })" /></label>
              <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/*" hidden @change="fileFrom($event, attach)" />
              <button class="video-studio__drop" type="button" :disabled="!mayEdit" @dragover.prevent @drop.prevent="attach($event.dataTransfer.files[0])" @click="imageInput?.click()"><q-icon name="mdi-image-plus-outline" size="24px" /><span><strong>{{ selectedScene.media?.file.name || 'Adicione uma imagem ou vídeo' }}</strong><small>{{ busy === 'media' ? 'Abrindo arquivo…' : 'Clique, arraste ou cole uma imagem.' }}</small></span></button>
              <div class="video-studio__scene-actions">
                <button v-if="selectedScene.media" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="removeMedia">Remover mídia</button>
                <span class="video-studio__spacer" />
                <button class="video-studio__icon" type="button" aria-label="Mover cena para trás" :disabled="!mayEdit || scenes[0].id === sceneId" @click="moveScene(-1)"><q-icon name="mdi-chevron-left" size="22px" /></button>
                <button class="video-studio__icon" type="button" aria-label="Mover cena para frente" :disabled="!mayEdit || scenes.at(-1).id === sceneId" @click="moveScene(1)"><q-icon name="mdi-chevron-right" size="22px" /></button>
                <button class="video-studio__icon" type="button" aria-label="Excluir cena" :disabled="!mayEdit || scenes.length === 1" @click="deleteScene"><q-icon name="mdi-delete-outline" size="20px" /></button>
              </div>
            </template>
          </div>

          <div v-else-if="tab === 'voice'" class="video-studio__section">
            <div class="video-studio__scene-heading"><h2>Locução</h2><button v-if="signedIn" class="video-studio__icon" type="button" aria-label="Atualizar catálogo de vozes" :disabled="optionsLoading || !mayEdit" @click="loadOptions"><q-icon name="mdi-refresh" size="21px" /></button></div>
            <label>Texto da locução<textarea v-model="narrationText" rows="5" :maxlength="maxNarration" placeholder="Digite o texto que será narrado…" :disabled="!mayEdit" /></label>
            <div v-if="options?.voices?.length" class="video-studio__voices" role="group" aria-label="Vozes OpenAI">
              <button v-for="(item, index) in options.voices" :key="item.id" type="button" :style="{ '--voice-hue': [162, 195, 266, 41, 325][index % 5] }" :aria-pressed="voice === item.id" :disabled="!mayEdit" @click="voice = item.id"><span class="video-studio__voice-dot" aria-hidden="true" /> {{ item.label }}</button>
            </div>
            <p v-else-if="signedIn" class="video-studio__hint">{{ optionsLoading ? 'Carregando vozes…' : optionsError || 'A geração de locução está temporariamente indisponível.' }}</p>
            <div class="video-studio__actions">
              <button v-if="!signedIn" class="video-studio__primary" type="button" @click="showAuth()">Criar conta para usar IA</button>
              <button v-else class="video-studio__primary" type="button" :disabled="!mayEdit || !voice || !narrationText.trim()" @click="makeVoice"><q-spinner v-if="busy === 'voice'" size="19px" /><q-icon v-else name="mdi-waveform" size="19px" /> {{ busy === 'voice' ? 'Gerando…' : 'Gerar locução' }}<span v-if="voicePrice > 0"> · {{ usd(voicePrice) }}</span></button>
              <button v-if="voice && !voicePreview" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="makeVoicePreview"><q-spinner v-if="busy === 'sample'" size="18px" /><q-icon v-else name="mdi-volume-high" size="18px" /> {{ busy === 'sample' ? 'Gerando amostra…' : 'Ouvir amostra' }}<span v-if="samplePrice > 0"> · {{ usd(samplePrice) }}</span></button>
              <input ref="audioInput" type="file" accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.aac,.flac" hidden @change="fileFrom($event, file => { if (file) run('media', () => replaceNarration(file)) })" />
              <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="audioInput?.click()"><q-icon name="mdi-upload-outline" size="18px" /> Importar áudio</button>
            </div>
            <audio v-if="voicePreview" class="video-studio__audio" :src="voicePreview.url" preload="metadata" controls aria-label="Amostra da voz selecionada" />
            <div v-if="narration" class="video-studio__audio-meta">
              <strong>{{ narration.file.name }}</strong><span class="video-studio__spacer" /><a class="video-studio__icon" :href="narration.url" :download="narration.file.name" aria-label="Baixar locução"><q-icon name="mdi-download-outline" size="20px" /></a><button class="video-studio__icon" type="button" aria-label="Remover locução" :disabled="!mayEdit" @click="removeNarration"><q-icon name="mdi-delete-outline" size="20px" /></button>
            </div>
          </div>

          <div v-else class="video-studio__section">
            <div class="video-studio__scene-heading"><h2>Gerar clipe</h2><span v-if="selectedModel" class="video-studio__selected-model">{{ selectedModel.name }}</span></div>
            <label>Descrição do clipe<textarea ref="clipPrompt" v-model="prompt" rows="5" maxlength="2000" placeholder="Descreva o cenário, o movimento de câmera e o estilo…" :disabled="!mayEdit" /></label>
            <div v-if="offer" class="video-studio__fields video-studio__fields--clip">
              <label>Formato<select :value="offer.format" :disabled="!mayEdit" @change="changeVideoConfiguration('format', $event.target.value)"><option v-for="aspect in videoAspects" :key="aspect">{{ aspect }}</option></select></label>
              <label>Resolução<select :value="optionResolution(offer)" :disabled="!mayEdit" @change="changeVideoConfiguration('resolution', $event.target.value)"><option v-for="resolution in videoResolutions" :key="resolution" :value="resolution">{{ resolution }}</option></select></label>
              <label>Duração<select v-model="videoOption" :disabled="!mayEdit"><option v-for="item in videoDurations" :key="item.id" :value="item.id">{{ item.seconds }} s</option></select></label>
            </div>
            <p v-else-if="signedIn && !activeJob && !generated" class="video-studio__hint">{{ optionsLoading ? 'Carregando modelos de vídeo…' : optionsError || 'A geração de clipes está temporariamente indisponível.' }}</p>
            <div class="video-studio__actions">
              <button v-if="!signedIn" class="video-studio__primary" type="button" @click="showAuth()">Criar conta para usar IA</button>
              <button v-else-if="activeJob && !busy" class="video-studio__primary" type="button" @click="checkJob"><q-icon name="mdi-refresh" size="20px" /> Verificar geração</button>
              <button v-else class="video-studio__primary" type="button" :disabled="!mayEdit || !offer || !prompt.trim()" @click="makeVideo"><q-spinner v-if="busy === 'video'" size="19px" /><q-icon v-else name="mdi-movie-open-play-outline" size="19px" /> {{ busy === 'video' ? 'Gerando clipe…' : 'Gerar clipe' }}<span v-if="offer && busy !== 'video'"> · Até {{ usd(offer.priceUsdCents) }}</span></button>
            </div>
            <p v-if="busy === 'video'" class="video-studio__hint" role="status">{{ activeJob?.status === 'in_progress' ? 'O provedor está produzindo seu clipe.' : 'Aguardando o provedor…' }}</p>
            <div v-if="generated" class="video-studio__generated">
              <h3>Clipe gerado</h3>
              <video :src="generated.url" controls playsinline preload="metadata" referrerpolicy="no-referrer" aria-label="Clipe gerado com IA" @loadedmetadata="generatedDuration = $event.target.duration" />
              <div class="video-studio__actions">
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="downloadGenerated"><q-icon name="mdi-download-outline" size="18px" /> Baixar clipe</button>
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="addGenerated"><q-icon name="mdi-plus" size="18px" /> {{ generatedDuration > 15 ? 'Usar primeiros 15 s na cena' : 'Usar na cena' }}</button>
                <a class="video-studio__secondary" :href="generated.url" target="_blank" rel="noopener noreferrer"><q-icon name="mdi-open-in-new" size="17px" /> Abrir arquivo</a>
              </div>
              <p v-if="generatedDuration > 15" class="video-studio__hint">Baixar clipe salva o vídeo completo.</p>
            </div>
          </div>
        </section>

        <section class="video-studio__panel video-studio__preview" aria-labelledby="video-studio-preview">
          <header><h2 id="video-studio-preview">Prévia</h2><span>{{ format.label }} · {{ durationLabel(timeline.duration) }}</span></header>
          <div class="video-studio__screen"><canvas ref="canvas" :width="format.width" :height="format.height" aria-label="Prévia da composição do vídeo" /></div>
          <div class="video-studio__transport"><button class="video-studio__icon" type="button" :disabled="!mayEdit" :aria-label="playing ? 'Pausar prévia' : 'Reproduzir prévia'" @click="play"><q-icon :name="playing ? 'mdi-pause' : 'mdi-play'" size="23px" /></button><input aria-label="Posição da prévia em segundos" type="range" min="0" :max="timeline.duration" step="0.1" :value="playhead" :disabled="!mayEdit" @input="seek($event.target.value)" /><span>{{ durationLabel(playhead) }} / {{ durationLabel(timeline.duration) }}</span></div>
          <audio v-if="narration" v-show="tab === 'voice'" ref="audio" class="video-studio__audio" :src="narration.url" preload="metadata" controls aria-label="Ouvir locução" />
          <div class="video-studio__actions">
            <button class="video-studio__primary" type="button" :disabled="!canRecord || !mayEdit" @click="renderVideo"><q-icon name="mdi-movie-open-outline" size="19px" /> {{ busy === 'render' ? 'Exportando…' : 'Exportar vídeo' }}</button>
            <button v-if="busy === 'render'" class="video-studio__secondary" type="button" @click="activeOperation?.abort()">Cancelar</button>
            <a v-if="recording" class="video-studio__secondary" :href="recording.url" :download="recording.filename"><q-icon name="mdi-download-outline" size="19px" /> Baixar vídeo</a>
          </div>
          <q-linear-progress v-if="busy === 'render'" rounded :value="progress" color="teal-4" aria-label="Progresso de exportação" />
          <p v-else-if="!canRecord" class="video-studio__hint">A exportação de vídeo depende do suporte do navegador.</p>
          <video v-if="recording" class="video-studio__rendered" :src="recording.url" controls playsinline preload="metadata" aria-label="Vídeo exportado" />
          <p class="video-studio__hint"><q-icon name="mdi-shield-lock-outline" size="17px" /> Seu projeto fica nesta aba. Baixe o ZIP para guardar as cenas e as mídias.</p>
        </section>
      </div>
    </main>
    <AuthDialog v-if="authOpen" v-model="authOpen" :initial-mode="authMode" return-path="/aitoia-video-studio" :show-project-login="false" @authenticated="wallet.syncSession()" />
    <AitoIAWallet v-if="walletOpen" v-model="walletOpen" :state="wallet" />
  </div>
</template>

<style scoped>
.video-studio { min-height: 100dvh; color: var(--aito-ai-text); background: var(--aito-ai-glow), var(--aito-ai-bg); font-family: var(--aito-ai-font); }
.video-studio button, .video-studio input, .video-studio textarea, .video-studio select { font: inherit; }
.video-studio button, .video-studio a { -webkit-tap-highlight-color: transparent; }
.video-studio button:focus-visible, .video-studio a:focus-visible, .video-studio input:focus-visible, .video-studio select:focus-visible, .video-studio textarea:focus-visible, .video-studio summary:focus-visible { outline: 2px solid var(--aito-ai-purple); outline-offset: 3px; }
.video-studio button:disabled { cursor: not-allowed; opacity: .54; }
.video-studio a { text-decoration: none; }
.video-studio h1, .video-studio h2, .video-studio h3, .video-studio p { margin: 0; }
.video-studio__bar { position: sticky; top: 0; z-index: 4; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 10px clamp(14px, 4vw, 52px); border-bottom: 1px solid var(--aito-ai-line); background: var(--aito-ai-surface); }
.video-studio__brand, .video-studio__nav, .video-studio__nav a, .video-studio__account, .video-studio__balance { display: flex; align-items: center; }
.video-studio__brand { width: max-content; gap: 6px; color: var(--aito-ai-text); font-size: 1.12rem; }
.video-studio__nav { gap: 3px; padding: 3px; border: 1px solid var(--aito-ai-line); border-radius: 11px; background: var(--aito-ai-bg); }
.video-studio__nav a { gap: 7px; padding: 6px 10px; border-radius: 7px; color: var(--aito-ai-muted); white-space: nowrap; font-weight: 650; }
.video-studio__nav a.router-link-exact-active { background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.video-studio__account { justify-self: end; gap: 8px; }
.video-studio__balance { gap: 6px; min-height: 36px; padding: 4px 7px; border: 1px solid var(--aito-ai-gold-line); border-radius: 8px; background: var(--aito-ai-gold-soft); color: var(--aito-ai-gold); cursor: pointer; white-space: nowrap; }
.video-studio__login, .video-studio__icon { border: 0; padding: 5px; border-radius: 7px; background: transparent; color: var(--aito-ai-muted); cursor: pointer; }
.video-studio__icon { display: inline-grid; width: 35px; height: 35px; place-items: center; }
.video-studio__icon:not(:disabled):hover, .video-studio__login:hover { color: var(--aito-ai-accent); background: var(--aito-ai-raised); }
.video-studio__main { width: min(1340px, 100%); margin: 0 auto; padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 36px) 45px; }
.video-studio__intro { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 25px; }
.video-studio__intro h1 { font-size: clamp(2rem, 4vw, 3.15rem); line-height: 1.05; font-weight: 780; letter-spacing: -.045em; }
.video-studio__intro p { margin-top: 10px; color: var(--aito-ai-muted); }
.video-studio__grid { display: grid; grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr); align-items: start; gap: 16px; }
.video-studio__panel { min-width: 0; border: 1px solid var(--aito-ai-line); border-radius: 16px; background: var(--aito-ai-surface); }
.video-studio__editor { overflow: hidden; }
.video-studio__tabs { grid-column: 1 / -1; display: grid; width: min(620px, 100%); grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 7px; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-panel); }
.video-studio__tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--aito-ai-muted); cursor: pointer; white-space: nowrap; }
.video-studio__tabs button[aria-pressed=true] { border-color: var(--aito-ai-line); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); font-weight: 650; }
.video-studio__section, .video-studio__preview { display: grid; gap: 14px; padding: clamp(13px, 2vw, 20px); }
.video-studio__preview { position: sticky; top: 78px; }
.video-studio__scene-heading, .video-studio__preview header, .video-studio__audio-meta { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.video-studio h2 { font-size: 1.13rem; font-weight: 730; line-height: 1.2; }
.video-studio h3 { font-size: 1rem; font-weight: 700; line-height: 1.2; }
.video-studio__preview header span, .video-studio__hint, .video-studio__script small { color: var(--aito-ai-muted); font-size: .84rem; }
.video-studio__fields { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, .9fr); gap: 10px; }
.video-studio__fields--clip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.video-studio__catalog { grid-column: 1 / -1; min-width: 0; display: grid; gap: 12px; }
.video-studio__catalog-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.video-studio__catalog-header p { margin-top: 4px; color: var(--aito-ai-muted); font-size: .9rem; }
.video-studio__model-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.video-studio__model-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 5px; border: 1px solid var(--aito-ai-line); border-radius: 13px; background: var(--aito-ai-surface); }
.video-studio__model-card--selected, .video-studio__model-card:has(.video-studio__model-hit:not(:disabled):hover) { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-panel); }
.video-studio__model-poster { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background-color: var(--aito-ai-panel); background-image: url('/aitoia-model-posters.webp'); background-size: 200% 400%; }
.video-studio__model-type { position: absolute; top: 8px; left: 8px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; background: #281d3aeb; color: #f7dff9; font-size: .69rem; font-weight: 700; }
.video-studio__model-type--image { background: #082f25eb; color: #d7ffed; }
.video-studio__model-content { display: grid; flex: 1; grid-template-rows: auto 1fr auto; gap: 6px; padding: 9px 8px 6px; }
.video-studio__model-maker { color: var(--aito-ai-muted); font-size: .76rem; }
.video-studio__model-content h3 { margin-top: 2px; overflow-wrap: anywhere; }
.video-studio__model-content p { color: var(--aito-ai-muted); font-size: .82rem; line-height: 1.35; }
.video-studio__model-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 7px; color: var(--aito-ai-muted); font-size: .73rem; }
.video-studio__model-rate { padding: 2px 5px; border-radius: 4px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); font-weight: 650; }
.video-studio__model-status--available, .video-studio__selected-model { color: var(--aito-ai-accent); }
.video-studio__selected-model { font-size: .86rem; font-weight: 650; text-align: right; }
.video-studio__model-hit { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: flex-start; padding: 10px; border: 0; border-radius: inherit; color: var(--aito-ai-text); background: transparent; cursor: pointer; }
.video-studio__model-hit :deep(.q-icon) { width: 27px; height: 27px; border-radius: 7px; background: #092322eb; }
.video-studio__model-hit[aria-pressed=true] :deep(.q-icon) { color: var(--aito-ai-accent); }
.video-studio label { display: grid; min-width: 0; gap: 6px; color: var(--aito-ai-muted); font-weight: 620; font-size: .84rem; }
.video-studio input:not([type=range]), .video-studio textarea, .video-studio select { width: 100%; padding: 9px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-bg); }
.video-studio textarea { min-height: 60px; resize: vertical; }
.video-studio input::placeholder, .video-studio textarea::placeholder { color: var(--aito-ai-muted); opacity: .75; }
.video-studio__script { padding: 8px 10px; border: 1px solid var(--aito-ai-purple-line); border-radius: 9px; background: var(--aito-ai-purple-soft); }
.video-studio__script summary { color: var(--aito-ai-purple); cursor: pointer; font-weight: 650; }
.video-studio__script[open] summary, .video-studio__script label, .video-studio__script button { margin-bottom: 8px; }
.video-studio__script small { display: block; }
.video-studio__scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(47px, 1fr)); gap: 6px; }
.video-studio__scenes button { display: grid; justify-items: center; gap: 2px; padding: 6px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); cursor: pointer; }
.video-studio__scenes button span { font-size: .72rem; }
.video-studio__scenes button[aria-pressed=true] { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.video-studio__drop { display: flex; width: 100%; align-items: center; gap: 9px; padding: 12px; border: 1px dashed var(--aito-ai-accent-strong); border-radius: 9px; color: var(--aito-ai-accent); background: var(--aito-ai-panel); text-align: left; cursor: pointer; }
.video-studio__drop span { min-width: 0; overflow-wrap: anywhere; }
.video-studio__drop small { display: block; margin-top: 3px; color: var(--aito-ai-muted); }
.video-studio__screen { display: grid; place-items: center; overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-bg); }
.video-studio__screen canvas { display: block; width: auto; height: auto; max-width: 100%; max-height: min(53vh, 450px); }
.video-studio__transport { display: flex; align-items: center; gap: 9px; color: var(--aito-ai-muted); font-size: .8rem; }
.video-studio__transport input { flex: 1; min-width: 0; accent-color: var(--aito-ai-accent-strong); }
.video-studio__transport span { white-space: nowrap; font-variant-numeric: tabular-nums; }
.video-studio__actions, .video-studio__scene-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.video-studio__spacer { flex: 1; }
.video-studio__primary, .video-studio__secondary { display: inline-flex; min-height: 36px; gap: 5px; align-items: center; justify-content: center; padding: 6px 9px; border: 1px solid transparent; border-radius: 8px; font-weight: 690 !important; cursor: pointer; text-align: center; }
.video-studio__primary { background: var(--aito-ai-gradient); color: var(--aito-ai-ink); }
.video-studio__secondary { border-color: var(--aito-ai-line); background: var(--aito-ai-panel); color: var(--aito-ai-text); }
.video-studio__primary:not(:disabled):hover, .video-studio__secondary:not(:disabled):hover { filter: brightness(1.17); }
.video-studio__notice { display: flex; align-items: center; gap: 8px; margin-bottom: 12px !important; padding: 10px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); }
.video-studio__notice--error { color: var(--aito-ai-error); border-color: var(--aito-ai-error-line); background: var(--aito-ai-error-soft); }
.video-studio__voices { display: flex; flex-wrap: wrap; gap: 6px; }
.video-studio__voices button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid var(--aito-ai-line); border-radius: 20px; color: var(--aito-ai-text); background: var(--aito-ai-panel); cursor: pointer; }
.video-studio__voices button[aria-pressed=true] { border-color: var(--aito-ai-purple); color: var(--aito-ai-purple); background: var(--aito-ai-purple-soft); }
.video-studio__voice-dot { width: 17px; height: 17px; border-radius: 50%; background: radial-gradient(circle at 68% 31%, hsl(var(--voice-hue) 91% 81%), hsl(var(--voice-hue) 62% 42%) 75%); }
.video-studio__audio { width: 100%; max-width: 100%; }
.video-studio__audio-meta strong { overflow-wrap: anywhere; }
.video-studio__generated { display: grid; gap: 8px; }
.video-studio__generated video, .video-studio__rendered { display: block; width: 100%; max-height: 420px; border-radius: 8px; background: var(--aito-ai-bg); }
@media (max-width: 960px) { .video-studio__model-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 850px) { .video-studio__grid { grid-template-columns: minmax(0, 1fr); } .video-studio__preview { position: static; } }
@media (max-width: 640px) { .video-studio__model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .video-studio__model-content { padding-inline: 5px; } }
@media (max-width: 480px) { .video-studio__bar { grid-template-columns: 1fr auto; padding: 7px 10px; gap: 6px; } .video-studio__nav { grid-row: 2; grid-column: 1 / -1; justify-content: center; } .video-studio__nav a { justify-content: center; flex: 1; } .video-studio__intro { align-items: flex-start; flex-direction: column; } .video-studio__tabs button { font-size: .8rem; } .video-studio__tabs :deep(.q-icon) { font-size: 17px !important; } }
</style>
