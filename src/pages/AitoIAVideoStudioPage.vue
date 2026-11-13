<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import AitoIAModeSwitch from 'components/AitoIAModeSwitch.vue'
import AitoStudioProjectPicker from 'components/AitoStudioProjectPicker.vue'
import AitoVideoProgress from 'components/AitoVideoProgress.vue'
import { aitoTokens, useAitoIA, usd } from 'src/composables/useAitoIA'
import { useAitoStudioProjects } from 'src/composables/useAitoStudioProjects'
import { useAitoWorkGuard } from 'src/composables/useAitoWorkGuard'
import { readAnswer } from 'src/services/aitoiaChat'
import { downloadAitoIAFile, zipAitoIAFiles } from 'src/services/aitoiaArchive'
import { AITOIA_RETENTION_MS } from 'src/services/aitoiaLocal'
import { clearVideoDraft, readVideoDraft } from 'src/services/aitoiaVideoDraft'
import { closeStudioMedia, cutDuration, cutStudioScene, drawStudioFrame, maxStudioScenes, openStudioMedia, parseStudioScript,
  recordStudioVideo, sceneSeconds, splitStudioClip, studioFrame, studioNarration, studioRenderSize, studioSubtitles, studioTimeline, studioVideoExports, videoFormats } from 'src/services/aitoiaVideo'
import { captureTransitionFrame, checkImageReference, checkVideoReference, putImageReference, putVideoReference, readGeneratedClipForJob, safeVideoUrl, sampleVideoFrames } from 'src/services/aitoiaVideoRemote'
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
  { id: 'genjutsu-light', maker: 'Higgsfield', name: 'Genjutsu Light', summary: 'Transfere o movimento de um vídeo para outra cena.', poster: '100% 0%', mode: 'genjutsu-light' },
  { id: 'genjutsu', maker: 'Higgsfield', name: 'Genjutsu', summary: 'Troca elementos ou estilos mantendo o movimento original.', poster: '0% 33.3333%', mode: 'genjutsu' },
  { id: 'kling-4.0', maker: 'Kling', name: 'Kling 4.0', summary: 'Cenas cinematográficas com ações e enquadramentos detalhados.', poster: '100% 33.3333%' },
  { id: 'kling-4.0-flash', maker: 'Kling', name: 'Kling 4.0 Flash', summary: 'Clipes rápidos em 720p para experimentar uma ideia.', poster: '0% 66.6667%' },
  { id: 'minimax-h3', maker: 'MiniMax', name: 'MiniMax H3', summary: 'Movimento de personagem e detalhes em alta resolução.', poster: '100% 66.6667%' },
  { id: 'wan-3.0-prime', maker: 'Alibaba', name: 'Wan 3.0 Prime', summary: 'Geração rápida para cenas em movimento e estilos variados.', poster: '0% 100%' },
  { id: 'grok-imagine-2.0', maker: 'xAI', name: 'Grok Imagine 2.0', summary: 'Cria e edita imagens com atenção aos detalhes.', poster: '100% 100%', type: 'image', limitation: 'Geração de imagem' },
]
const title = ref('Meu vídeo')
const tab = ref(useRoute().query.tab === 'ai' ? 'ai' : 'scenes')
const formatId = ref(videoFormats[0].id)
const format = computed(() => videoFormats.find(item => item.id === formatId.value))
const freshScene = (fields = {}) => ({ id: crypto.randomUUID(), duration: 5, offset: 0, heading: '', caption: '', media: null, ...fields })
const scenes = shallowRef([freshScene()])
const sceneId = ref(scenes.value[0].id)
const selectedScene = computed(() => scenes.value.find(scene => scene.id === sceneId.value))
const timeline = computed(() => studioTimeline(scenes.value))
const selectedSegment = computed(() => timeline.value.segments.find(({ scene }) => scene.id === sceneId.value))
const range = computed(() => previewMode.value === 'scene' && selectedSegment.value
  ? selectedSegment.value : { start: 0, end: timeline.value.duration })
const narrationText = ref('')
const narration = shallowRef(null)
const voicePreview = shallowRef(null)
const recording = shallowRef(null)
const generated = shallowRef(null)
const clipLibrary = shallowRef([])
const generatedDuration = ref(0)
const activeJob = shallowRef(null)
const prompt = ref('')
const scriptPrompt = ref('')
const audio = ref(null)
const canvas = ref(null)
const imageInput = ref(null)
const importInput = ref(null)
const audioInput = ref(null)
const referenceInput = ref(null)
const imageReferenceInput = ref(null)
const playhead = ref(0)
const playing = ref(false)
const previewMode = ref('all')
const inventoryOpen = ref(false)
const inventoryQuery = ref('')
const inventoryProject = ref('')
const inventoryClips = shallowRef([])
const inventoryLoading = ref(false)
const inventoryError = ref('')
const projectComponents = shallowRef([])
const componentTypes = ref(['Personagens', 'Cenas', 'Modelos de cena', 'Cenários', 'Roteiros'])
const componentType = ref('Cenas')
const componentOpen = ref(false)
const componentForm = shallowRef(null)
const componentPosters = shallowRef(new Map())
const componentTypeName = ref('')
const confirmDeleteClip = ref(false)
const saveClipOpen = ref(false)
const destinationProject = ref('')
const savingClip = ref(false)
const projectsOpen = ref(false)
const draft = shallowRef(null)
const dragItem = ref(null)
const dragTarget = ref(null)
const history = shallowRef([])
const sourceFrames = shallowRef([])
const insertionAfter = ref(null)
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
const generationMode = ref('text')
const reference = shallowRef(null)
const referenceImages = shallowRef([])
const transitionClips = shallowRef([null, null])
const transitionLabels = ['1. Clipe de saída', '2. Clipe de entrada']
const referenceAnalysis = ref('')
const videoQuote = shallowRef(null)
const generationModes = [
  { id: 'text', label: 'Criar por texto', icon: 'mdi-text-box-outline' },
  { id: 'edit', label: 'Editar vídeo-base', icon: 'mdi-filmstrip-box-multiple' },
  { id: 'reference', label: 'Remixar com referência', icon: 'mdi-movie-open-edit-outline' },
  { id: 'transition', label: 'Transição entre vídeos', icon: 'mdi-transition' },
  { id: 'continuation', label: 'Continuar cena', icon: 'mdi-movie-open-outline' },
  { id: 'genjutsu', label: 'Genjutsu', icon: 'mdi-motion-play-outline' },
  { id: 'genjutsu-light', label: 'Genjutsu Light', icon: 'mdi-motion-play-outline' },
]
const clipPrompt = ref(null)
const transitionMode = computed(() => generationMode.value === 'transition')
const continuationMode = computed(() => generationMode.value === 'continuation')
const videoModelConfig = computed(() => options.value?.videoModels?.find(item => item.id === videoModel.value))
const modelOffers = computed(() => new Map((options.value?.videoModels || []).map(item => [item.id, item.options])))
const referenceModel = computed(() => transitionMode.value ? options.value?.transitionModel :
  options.value?.referenceModels?.find(item => item.mode === generationMode.value))
const hasReference = computed(() => Boolean(reference.value || (generationMode.value === 'reference' && referenceImages.value.length)))
const maxImageReferences = computed(() => transitionMode.value ? (sourceFrames.value.length ? 8 : 0) :
  (generationMode.value === 'text' ? videoModelConfig.value?.maxImageReferences : referenceModel.value?.maxImageReferences) ?? 0)
const canQuoteVideo = computed(() => Boolean(offer.value && (prompt.value.trim() || referenceModel.value?.sourceDuration) &&
  (transitionMode.value ? sourceFrames.value.length === 2 || transitionClips.value.every(Boolean) :
    continuationMode.value ? sourceFrames.value.length === 1 :
      (generationMode.value === 'text' || hasReference.value) &&
      (!referenceModel.value?.sourceDuration || referenceImages.value.length) && referenceImages.value.length <= maxImageReferences.value)))
const modelOptions = computed(() => (generationMode.value === 'text' ? modelOffers.value.get(videoModel.value) : referenceModel.value?.options) || [])
const offer = computed(() => modelOptions.value.find(item => item.id === videoOption.value))
const selectedModel = computed(() => generationMode.value === 'text' ? videoCatalog.find(item => item.id === videoModel.value) :
  referenceModel.value && { name: referenceModel.value.label })
const modelCards = computed(() => videoCatalog.map(item => {
  const offers = item.mode ? options.value?.referenceModels?.find(model => model.mode === item.mode)?.options || [] : modelOffers.value.get(item.id) || []
  const available = offers.length > 0
  const perSecond = available && !item.mode ? Math.min(...offers.map(option => option.priceUsdCents / option.seconds)) : 0
  const availability = item.limitation ? 'Fora do Estúdio' : available ? (item.mode ? 'Vídeo + imagens' : 'Texto para vídeo') :
    !signedIn.value ? 'Entre para usar' : optionsLoading.value ? 'Consultando' : 'Indisponível'
  return { ...item, available, perSecond, availability, selectable: available || (!signedIn.value && !item.limitation) }
}))
const optionResolution = item => item?.resolution || '720p'
const videoAspects = computed(() => [...new Set(modelOptions.value.map(item => item.format))])
const videoResolutions = computed(() => [...new Set(modelOptions.value.filter(item => item.format === offer.value?.format).map(optionResolution))])
const videoDurations = computed(() => modelOptions.value.filter(item =>
  item.format === offer.value?.format && optionResolution(item) === optionResolution(offer.value)))
const maxNarration = computed(() => options.value?.voice?.maxCharacters || 4096)
function speechPrice(text) {
  const rate = options.value?.voice?.priceUsdCentsPerCharacter || 0
  return Math.ceil(Array.from(text.trim()).length * rate * 10000 - 1e-8) / 10000
}
const voicePrice = computed(() => speechPrice(narrationText.value))
const sample = 'Olá. Esta é uma amostra da minha voz em português.'
const samplePrice = computed(() => speechPrice(sample))
function projectMediaBytes(entries = scenes.value) {
  const files = new Set(entries.flatMap(scene => scene.media ? [scene.media.file] : []))
  return [...files].reduce((sum, file) => sum + file.size, narration.value?.file.size || 0)
}
const mediaBytes = computed(() => projectMediaBytes())
const exportFormats = ref([])
const exportFormat = ref('')
const exportScope = ref('all')
const resolution = ref('medium')
const exportSize = computed(() => studioRenderSize(format.value, resolution.value))
const subtitles = computed(() => studioSubtitles(timeline.value))
const canRecord = computed(() => exportFormats.value.length > 0)
const mayEdit = computed(() => (!busy.value || ['video', 'render'].includes(busy.value)) && !projectLoading.value && (!signedIn.value || Boolean(accountId.value)))
const guarded = computed(() => Boolean(busy.value))
const blockedExit = ref(false)
useAitoWorkGuard(guarded, () => { blockedExit.value = true })
const durationLabel = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
let videoFrame
let displayedVideo
let activeOperation
let optionsRequest
let mounted = false
const jobStorageKey = 'aitoia-video-jobs'
const jobLifetime = 24 * 60 * 60 * 1000

watch(accountId, (next, previous) => {
  if (!previous) return
  activeOperation?.abort()
  optionsRequest?.abort()
  if (next && signedIn.value) loadOptions()
})

const { projects, records, activeId, loading: projectLoading, storageError, cloudState, createProject, openProject,
  resolveProject, deleteProject, saveProject } = useAitoStudioProjects({
  studio: 'video', accountId, busy, defaultName: 'Meu vídeo', snapshot: snapshotProject, restore: restoreProject,
  watch: [title, formatId, scenes, sceneId, narrationText, narration, scriptPrompt, prompt, generationMode,
    reference, referenceImages, transitionClips, sourceFrames, insertionAfter, referenceAnalysis, clipLibrary, generated, recording,
    activeJob, projectComponents, componentTypes],
})

function showAuth(mode = 'register') { authMode.value = mode; authOpen.value = true }
function selectVideoModel(item) {
  changeGenerationMode(item.mode || 'text')
  if (!item.mode) videoModel.value = item.id
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
const displayDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const activeProject = computed(() => projects.value.find(item => item.id === activeId.value))
const nearingExpiry = computed(() => activeProject.value?.expiresAt - Date.now() < 86400000)
let expireTimer
const draftReady = computed(() => Boolean(draft.value && !projectLoading.value && !busy.value))
const clipExpiry = clip => Number(clip.expiresAt) || Date.now() + AITOIA_RETENTION_MS
const unavailableScene = scene => scene.missingMedia || Boolean(scene.expiresAt && scene.expiresAt <= Date.now())
const inventory = computed(() => {
  const local = clipLibrary.value.map(clip => ({ ...clip, projectId: activeId.value, project: title.value }))
  const other = [...records.value.filter(project => project.id !== activeId.value && !project.cloudOnly), ...inventoryClips.value].flatMap(project =>
    (project.clips || []).map(clip => ({ ...clip, expiresAt: clip.expiresAt || project.expiresAt, projectId: project.id, project: project.title })))
  const query = inventoryQuery.value.trim().toLocaleLowerCase('pt-BR')
  return [...local, ...other].filter(clip => (!inventoryProject.value || clip.projectId === inventoryProject.value) && clip.expiresAt > Date.now() && clip.file &&
    (!query || `${clip.title || 'Clipe ' + clip.number} ${clip.project}`.toLocaleLowerCase('pt-BR').includes(query)))
})
function openInventory() {
  inventoryQuery.value = ''
  inventoryProject.value = ''
  inventoryClips.value = []
  inventoryError.value = ''
  inventoryOpen.value = true
}
watch(inventoryProject, async id => {
  inventoryError.value = ''
  inventoryLoading.value = false
  inventoryClips.value = []
  const holder = records.value.find(item => item.id === id)
  if (!holder?.cloudOnly) return
  inventoryLoading.value = true
  try {
    const record = await resolveProject(id)
    if (record && inventoryProject.value === id) inventoryClips.value = [record]
  } catch (cause) {
    if (inventoryProject.value === id) inventoryError.value = cause.message || 'Não foi possível consultar as mídias deste projeto.'
  } finally {
    if (inventoryProject.value === id) inventoryLoading.value = false
  }
})
const matchingComponents = computed(() => projectComponents.value.filter(item => item.type === componentType.value &&
  (!inventoryQuery.value || `${item.title} ${item.prompt}`.toLocaleLowerCase('pt-BR').includes(inventoryQuery.value.toLocaleLowerCase('pt-BR')))))
const missingArchiveItems = computed(() => scenes.value.filter(unavailableScene).length +
  clipLibrary.value.filter(clip => clip.expired || !clip.file).length)
function openComponents(type) { componentType.value = type; inventoryQuery.value = ''; componentForm.value = null; componentOpen.value = true }
function editComponent(item) {
  componentForm.value = item ? { ...item } : { id: crypto.randomUUID(), type: componentType.value, title: '', prompt: '', file: null }
}
function updateComponentForm(values) { componentForm.value = { ...componentForm.value, ...values } }
function saveComponent() {
  const item = componentForm.value
  if (!item.title.trim()) return
  projectComponents.value = projectComponents.value.some(row => row.id === item.id)
    ? projectComponents.value.map(row => row.id === item.id ? item : row) : [...projectComponents.value, item]
  componentForm.value = null
}
watch(projectComponents, items => {
  const existing = componentPosters.value
  const next = new Map(items.filter(item => item.file).map(item => [item.file, existing.get(item.file) || URL.createObjectURL(item.file)]))
  existing.forEach((url, file) => { if (!next.has(file)) URL.revokeObjectURL(url) })
  componentPosters.value = next
}, { flush: 'sync' })
function setComponentImage(file) {
  if (!file) return
  try { checkImageReference(file); updateComponentForm({ file }) }
  catch (cause) { error.value = cause.message }
}
function addComponentType() {
  const type = componentTypeName.value.trim()
  if (!type || componentTypes.value.includes(type) || componentTypes.value.length >= 20) return
  componentTypes.value = [...componentTypes.value, type]
  componentTypeName.value = ''
  openComponents(type)
}
function changeCustomType(delta, rename) {
  const index = componentTypes.value.indexOf(componentType.value)
  if (index < 5) return
  const next = [...componentTypes.value]
  if (rename) {
    const name = componentTypeName.value.trim()
    if (!name || next.includes(name)) return
    next[index] = name
    projectComponents.value = projectComponents.value.map(item => item.type === componentType.value ? { ...item, type: name } : item)
    componentType.value = name
    componentTypeName.value = ''
  } else {
    if (!next[index + delta] || index + delta < 5) return
    next.splice(index + delta, 0, next.splice(index, 1)[0])
  }
  componentTypes.value = next
}
function useComponent(item, variation = false) {
  if (item.file) chooseReferenceImages([item.file])
  prompt.value = [prompt.value.trim(), item.prompt || item.title].filter(Boolean).join('\n').slice(0, 2000)
  if (variation) prompt.value = `Crie uma variação: ${item.prompt || item.title}`.slice(0, 2000)
  componentOpen.value = false
  createForScene()
}
watch(accountId, async id => {
  draft.value = null
  if (!id) return
  const incoming = await readVideoDraft(id).catch(() => null)
  if (id === accountId.value) draft.value = incoming || null
}, { immediate: true })

async function applyDraft(fresh = false) {
  if (!draftReady.value) return
  const incoming = draft.value
  const owner = accountId.value
  if (fresh) await createProject()
  if (!activeId.value || accountId.value !== owner || !mayEdit.value) return
  if (incoming.generated || incoming.purpose === 'save-clip') {
    const asset = incoming.generated || incoming.attachments[0]
    const file = asset && new File([asset.blob], asset.name, { type: asset.mime })
    if (!file || !file.type.startsWith('video/')) return
    storeClip({ id: asset.id || crypto.randomUUID(), file, expiresAt: Number(asset.expiresAt) || Date.parse(asset.expiresAt) || clipExpiry(asset) })
    tab.value = 'ai'
    notice.value = 'Clipe salvo no projeto.'
  } else {
    prompt.value = incoming.prompt || ''
    tab.value = 'ai'
    generationMode.value = 'text'
    const files = (incoming.attachments || []).map(asset => new File([asset.blob], asset.name, { type: asset.mime }))
    const firstVideo = files.find(file => file.type === 'video/mp4')
    if (firstVideo) chooseReference(firstVideo)
    const images = files.filter(file => file.type.startsWith('image/'))
    if (images.length) {
      referenceImages.value.forEach(image => URL.revokeObjectURL(image.url))
      referenceImages.value = images.filter(file => { try { checkImageReference(file); return true } catch { return false } })
        .slice(0, 6).map(file => ({ file, url: URL.createObjectURL(file) }))
    }
    notice.value = 'Rascunho do chat carregado. Confira o prompt e as referências.'
  }
  await saveProject()
  await clearVideoDraft(owner).catch(() => {})
  if (draft.value === incoming) draft.value = null
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
  if (cause.response?.status === 409 && response?.code === 'AITO_MEDIA_PRICE_CHANGED') await loadOptions()
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
    if (activeOperation === controller) { activeOperation = null; busy.value = ''; progress.value = 0; blockedExit.value = false }
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
    restoreJob()
  } catch (cause) {
    if (!controller.signal.aborted) optionsError.value = cause.response?.data?.message || 'Não foi possível consultar o catálogo.'
  } finally { if (optionsRequest === controller) optionsLoading.value = false }
}
watch(modelOptions, list => { if (!list.some(item => item.id === videoOption.value)) videoOption.value = list[0]?.id || '' })
watch([generationMode, videoModel, videoOption, prompt, reference, referenceImages, transitionClips, sourceFrames, walletId], () => { videoQuote.value = null })
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
function keepJob(job, finished = false) {
  if (!accountId.value || !activeId.value) return
  jobStorage(entries => {
    const saved = entries[accountId.value]
    if (!finished || !saved || saved.id === job.id) entries[accountId.value] = {
      id: job.id, projectId: activeId.value, finished, expiresAt: Date.now() + jobLifetime,
      afterSceneId: job.afterSceneId, kind: job.kind,
    }
  })
}
function restoreJob() {
  if (!accountId.value || !activeId.value || projectLoading.value || activeJob.value) return
  const saved = jobStorage(entries => entries[accountId.value])
  if (saved?.finished || saved?.projectId && saved.projectId !== activeId.value) return
  const recoverable = saved || options.value?.recoverableGeneration
  if (recoverable?.id && !clipLibrary.value.some(clip => clip.id === recoverable.id)) {
    activeJob.value = { id: recoverable.id, status: 'queued', afterSceneId: recoverable.afterSceneId, kind: recoverable.kind }
    keepJob(activeJob.value)
    tab.value = 'ai'
  }
}
watch([activeId, projectLoading], restoreJob)

function syncVideo(media, offset, animate) {
  const element = media?.isVideo ? media.element : null
  const changed = element !== displayedVideo
  if (changed) displayedVideo?.pause()
  displayedVideo = element
  if (!element) return
  const time = Math.max(0, Math.min(offset, element.duration - 0.04))
  if (changed || Math.abs(element.currentTime - time) > (animate ? .38 : .03)) element.currentTime = time
  if (animate && offset < element.duration && element.paused) {
    element.muted = false
    element.play().catch(() => { element.muted = true; return element.play().catch(() => {}) })
  }
  if ((!animate || offset >= element.duration) && !element.paused) element.pause()
}
function paint(time, animate = false, target = canvas.value) {
  const frame = studioFrame(timeline.value, time)
  if (!frame) {
    syncVideo(null, 0, false)
    target?.getContext('2d')?.clearRect(0, 0, target.width, target.height)
    return
  }
  syncVideo(frame.scene.media, frame.time + (frame.scene.offset || 0), animate)
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
  playhead.value = Math.min(range.value.end, Math.max(range.value.start, Number(time) || 0))
  paint(Math.min(playhead.value, Math.max(range.value.start, range.value.end - .001)))
}
function play() {
  if (playing.value) return pause()
  if (!mayEdit.value) return
  if (playhead.value >= range.value.end) seek(range.value.start)
  const start = performance.now() - playhead.value * 1000
  playing.value = true
  if (audio.value?.readyState > 0 && playhead.value < audio.value.duration) {
    audio.value.currentTime = playhead.value
    audio.value.play().catch(() => {})
  }
  const tick = now => {
    if (!playing.value) return
    playhead.value = Math.min((now - start) / 1000, range.value.end)
    paint(Math.min(playhead.value, Math.max(range.value.start, range.value.end - .001)), true)
    if (playhead.value >= range.value.end) pause()
    else videoFrame = requestAnimationFrame(tick)
  }
  videoFrame = requestAnimationFrame(tick)
}
function selectScene(id) {
  sceneId.value = id
  const segment = timeline.value.segments.find(item => item.scene.id === id)
  seek(segment?.start || 0)
}
function editScene(values, id = sceneId.value) {
  replaceScenes(scenes.value.map(scene => scene.id === id ? { ...scene, ...values } : scene))
}
function replaceScenes(next, { remember = true } = {}) {
  const previous = new Set([scenes.value, ...history.value].flatMap(list => list.map(scene => scene.media)))
  if (remember) history.value = [...history.value.slice(-11), scenes.value]
  const retained = new Set([next, ...history.value].flatMap(list => list.map(scene => scene.media)))
  for (const media of previous) if (!retained.has(media)) closeStudioMedia(media)
  scenes.value = next
}
function undoEdit() {
  if (!history.value.length) return
  const previous = history.value.at(-1)
  history.value = history.value.slice(0, -1)
  replaceScenes(previous, { remember: false })
  selectScene(previous.some(scene => scene.id === sceneId.value) ? sceneId.value : previous[0]?.id || '')
}
function addScene() {
  if (!mayEdit.value || scenes.value.length >= maxStudioScenes) return
  const scene = freshScene()
  replaceScenes([...scenes.value, scene])
  selectScene(scene.id)
}
function deleteScene() {
  if (!selectedScene.value || !mayEdit.value) return
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  replaceScenes(scenes.value.filter(scene => scene.id !== sceneId.value))
  selectScene(scenes.value[Math.max(0, index - 1)]?.id || '')
}
function duplicateScene() {
  if (!selectedScene.value || !mayEdit.value || scenes.value.length >= maxStudioScenes) return
  const scene = { ...selectedScene.value, id: crypto.randomUUID() }
  const index = scenes.value.findIndex(item => item.id === sceneId.value)
  replaceScenes([...scenes.value.slice(0, index + 1), scene, ...scenes.value.slice(index + 1)])
  selectScene(scene.id)
}
function moveScene(delta) {
  if (!mayEdit.value) return
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  const target = scenes.value[index + delta]
  if (target) moveTo(sceneId.value, target.id)
}
function moveTo(id, target) {
  const list = [...scenes.value]
  const from = list.findIndex(scene => scene.id === id)
  const to = list.findIndex(scene => scene.id === target)
  if (!mayEdit.value || from < 0 || to < 0 || from === to) return
  list.splice(to, 0, list.splice(from, 1)[0])
  replaceScenes(list)
  selectScene(id)
}
function cancelDrag() { dragItem.value = null; dragTarget.value = null }
function finishDrag(id) { moveTo(dragItem.value, id); cancelDrag() }
function updateCut(field, input) {
  const scene = selectedScene.value
  if (!scene?.media?.isVideo) return
  const end = (scene.offset || 0) + cutDuration(scene)
  editScene(field === 'start' ? cutStudioScene(scene, input, end) : cutStudioScene(scene, scene.offset || 0, input))
}
const splitTime = computed(() => selectedSegment.value ? playhead.value - selectedSegment.value.start : 0)
const maySplit = computed(() => selectedScene.value && scenes.value.length < maxStudioScenes && splitTime.value > .1 &&
  selectedSegment.value.end - playhead.value > .1)
function splitAtPlayhead() {
  if (!maySplit.value) return
  const scene = selectedScene.value
  const index = scenes.value.indexOf(scene)
  const second = { ...scene, id: crypto.randomUUID(), offset: (scene.offset || 0) + splitTime.value,
    cut: true, duration: cutDuration(scene) - splitTime.value }
  replaceScenes([...scenes.value.slice(0, index), { ...scene, cut: true, duration: splitTime.value }, second, ...scenes.value.slice(index + 1)])
  selectScene(second.id)
}
function removeMedia() {
  editScene({ media: null, offset: 0, cut: false, clipId: null, expiresAt: null, missingMedia: false })
}
async function setSceneMedia(file, signal, id = sceneId.value) {
  const current = scenes.value.find(scene => scene.id === id)
  if (!current || !file) return
  const next = await openStudioMedia(file, projectMediaBytes(scenes.value.filter(scene => scene.id !== id)), signal)
  if (signal.aborted || !mounted) { closeStudioMedia(next); return }
  editScene({ media: next, offset: 0, clipId: null, expiresAt: null, missingMedia: false,
    cut: next.isVideo, duration: next.isVideo ? Math.min(next.element.duration, cutDuration(current)) : sceneSeconds(current.duration) }, id)
}
function attach(file) { if (file) run('media', signal => setSceneMedia(file, signal)) }
function importClip(file) {
  if (file) run('media', signal => insertClip(file, signal))
}
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
  if (!canRecord.value || !timeline.value.duration) return
  const segment = exportScope.value === 'scene' ? timeline.value.segments.find(item => item.scene.id === sceneId.value) : null
  const start = segment?.start || 0
  const duration = segment ? segment.end - segment.start : timeline.value.duration
  const mimeType = exportFormats.value.find(item => item.extension === exportFormat.value)?.mime
  const edit = timeline.value
  const sourceSegments = segment ? [segment] : edit.segments
  const narrationFile = narration.value?.file
  const expired = sourceSegments.find(({ scene }) => unavailableScene(scene))
  if (expired) { error.value = `Substitua ou remova a mídia da cena “${expired.scene.heading || (edit.segments.indexOf(expired) + 1)}” antes de exportar.`; return }
  await run('render', async signal => {
    const output = document.createElement('canvas')
    output.width = exportSize.value.width
    output.height = exportSize.value.height
    const opened = new Map()
    let renderVideoElement = null
    try {
      for (const { scene } of sourceSegments) {
        if (scene.media && !opened.has(scene.media)) {
          opened.set(scene.media, await openStudioMedia(scene.media.file, 0, signal))
        }
      }
      const clipAudio = sourceSegments.filter(({ scene }) => scene.media?.isVideo).map(({ scene, start: at, end }) => ({
        file: scene.media.file, position: at - start, offset: scene.offset || 0, duration: end - at,
      }))
      const result = await recordStudioVideo(output, duration, { narration: narrationFile, audioOffset: start, mimeType, signal,
        clipAudio, render(time) {
          const frame = studioFrame(edit, start + Math.min(time, duration - .001))
          const media = opened.get(frame.scene.media)
          const element = media?.isVideo ? media.element : null
          const target = frame.time + (frame.scene.offset || 0)
          if (renderVideoElement !== element) renderVideoElement?.pause()
          if (element) {
            if (renderVideoElement !== element || Math.abs(element.currentTime - target) > .22) element.currentTime = Math.min(target, element.duration - .01)
            if (element.paused) element.play().catch(() => {})
          }
          renderVideoElement = element
          drawStudioFrame(output, { ...frame.scene, media })
          progress.value = time / duration
        } })
      if (mounted && !signal.aborted) { updateRecording(result); notice.value = 'Seu vídeo está pronto para baixar.' }
    } finally { opened.forEach(closeStudioMedia) }
  })
}
function downloadSubtitles() {
  if (subtitles.value) downloadAitoIAFile(new Blob([subtitles.value], { type: 'text/plain;charset=utf-8' }), 'aitoia-legendas.srt')
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
      script.scenes = script.scenes.map((scene, index) => {
        const old = previous[index]
        if (!old) return freshScene(scene)
        return { ...old, ...scene, ...(old.media?.isVideo && { duration: cutDuration(old) }) }
      })
      replaceScenes(script.scenes)
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
  const { data } = await api.post('/aitoia/video/voice', { text, voice: voice.value, walletId: walletId.value,
    maxBilledUsdCents: speechPrice(text) },
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
const temporaryJobFailure = cause => !cause.response || ['AITO_MEDIA_RETRY', 'AITO_PROVIDER_BUSY'].includes(cause.response?.data?.code) ||
  [429, 502, 503, 504].includes(cause.response.status) && !['AITO_MEDIA_EXPIRED', 'AITO_MEDIA_UNAVAILABLE'].includes(cause.response.data?.code)

function generatedFile(clip, signal) {
  return readGeneratedClipForJob(clip, signal, (url, options) => api.get(url, { ...options, headers: authorization() }))
}

function localClip(clip) {
  return { ...clip, expiresAt: clipExpiry(clip), url: clip.file ? URL.createObjectURL(clip.file) : safeVideoUrl(clip.remoteUrl) }
}

function disposeClip(clip) { if (clip.file) URL.revokeObjectURL(clip.url) }
function storeClip(asset) {
  const previous = clipLibrary.value.find(item => item.id === asset.id)
  const clip = localClip({ ...asset, number: previous?.number || ((clipLibrary.value[0]?.number || 0) + 1) })
  if (previous) disposeClip(previous)
  clipLibrary.value = [clip, ...clipLibrary.value.filter(item => item.id !== clip.id)]
  selectGenerated(clip)
  return clip
}

async function readJob(job, signal) {
  const expires = Date.now() + 12 * 60_000
  let current = job
  let consecutiveFailures = 0
  const headers = authorization()
  while (['queued', 'in_progress'].includes(current.status)) {
    activeJob.value = current
    if (Date.now() >= expires) throw new Error('O provedor ainda está gerando o clipe. Confira o resultado novamente.')
    await waitForJob(signal)
    try {
      const { data } = await api.get(`/aitoia/video/generations/${encodeURIComponent(current.id)}`, { headers, signal })
      current = { ...current, ...data.data }
      consecutiveFailures = 0
    } catch (cause) {
      if ([404, 410].includes(cause.response?.status)) {
        activeJob.value = null
        keepJob(current, true)
      }
      if (!signal.aborted && temporaryJobFailure(cause) && ++consecutiveFailures < 6) continue
      throw cause
    }
  }
  if (current.status !== 'completed') {
    activeJob.value = null
    keepJob(current, true)
    throw new Error(current.message || 'O provedor não conseguiu gerar o vídeo.')
  }
  activeJob.value = current
  const previous = clipLibrary.value.find(item => item.id === current.id)
  const asset = { id: current.id, remoteUrl: current.url, expiresAt: Date.parse(current.expiresAt) || Date.now() + AITOIA_RETENTION_MS,
    afterSceneId: job.afterSceneId, kind: job.kind || 'scene' }
  try { asset.file = previous?.file || await generatedFile(asset, signal) }
  catch { signal.throwIfAborted() }
  storeClip(asset)
  activeJob.value = null
  keepJob(current, true)
  await saveProject()
  signal.throwIfAborted()
  notice.value = asset.file && !storageError.value ? 'Clipe salvo no projeto.' : 'Clipe pronto. Baixe o original para guardar uma cópia.'
}
function selectGenerated(clip) {
  generatedDuration.value = 0
  generated.value = clip
}
function checkJob() {
  if (!activeJob.value || !accountId.value) return
  run('video', signal => readJob(activeJob.value, signal))
}
function removeGenerated() {
  if (!mayEdit.value || !generated.value) return
  const clip = generated.value
  disposeClip(clip)
  clipLibrary.value = clipLibrary.value.filter(item => item.id !== clip.id)
  selectGenerated(clipLibrary.value[0] || null)
}
const clipReferences = computed(() => scenes.value.filter(scene => scene.clipId === generated.value?.id).length)
function shareClip() {
  destinationProject.value = projects.value.find(project => project.id !== activeId.value)?.id || 'new'
  saveClipOpen.value = true
}
async function saveClipInProject() {
  if (savingClip.value || busy.value || !generated.value || !destinationProject.value) return
  const clip = generated.value
  if (clip.expired || clip.expiresAt <= Date.now()) return
  const owner = accountId.value
  const destination = destinationProject.value
  savingClip.value = true
  error.value = ''
  try {
    const file = await generatedFile(clip, AbortSignal.timeout(30000))
    if (owner !== accountId.value) return
    const previous = activeId.value
    if (destination === 'new') await createProject()
    else await openProject(destination)
    if (owner !== accountId.value) return
    if (!activeId.value || activeId.value === previous || (destination !== 'new' && activeId.value !== destination)) {
      throw new Error('Não foi possível abrir o projeto escolhido.')
    }
    storeClip({ id: clip.id, file, expiresAt: clip.expiresAt, kind: clip.kind })
    await saveProject()
    tab.value = 'ai'
    notice.value = 'Clipe salvo no projeto escolhido.'
    saveClipOpen.value = false
  } catch (cause) { await report(cause) }
  finally { savingClip.value = false }
}
function clipVariation() {
  if (!generated.value?.file) return
  chooseReference(generated.value.file)
  if (reference.value?.file !== generated.value.file) return
  changeGenerationMode('edit')
  prompt.value = 'Crie uma variação deste clipe. '
  createForScene()
}
function clearSourceFrames() {
  sourceFrames.value.forEach(frame => URL.revokeObjectURL(frame.url))
  sourceFrames.value = []
}
function changeGenerationMode(mode) {
  if (mode === generationMode.value) return
  clearSourceFrames()
  insertionAfter.value = null
  generationMode.value = mode
}
const nextScene = computed(() => {
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  return index >= 0 ? scenes.value[index + 1] : null
})
async function buildContinuity(transition) {
  const from = selectedScene.value
  const to = nextScene.value
  if (!from?.media?.isVideo || (transition && !to?.media?.isVideo)) return
  if (!signedIn.value) { showAuth(); return }
  if (signedIn.value && !options.value) await loadOptions()
  if (transition ? !options.value?.transitionModel : !options.value?.referenceModels?.some(item => item.mode === 'continuation')) {
    error.value = 'Para usar os quadros da linha do tempo, entre com acesso aos modelos Kling 4.0.'
    return
  }
  run('frames', async signal => {
    const files = await Promise.all([
      captureTransitionFrame(from.media.file, 'end', format.value.label, '720p', signal, (from.offset || 0) + cutDuration(from) - .04),
      ...(transition ? [captureTransitionFrame(to.media.file, 'start', format.value.label, '720p', signal, to.offset || 0)] : []),
    ])
    signal.throwIfAborted()
    changeGenerationMode(transition ? 'transition' : 'continuation')
    clearSourceFrames()
    sourceFrames.value = files.map(file => ({ file, url: URL.createObjectURL(file) }))
    insertionAfter.value = from.id
    referenceImages.value.forEach(item => URL.revokeObjectURL(item.url))
    referenceImages.value = []
    if (transition) prompt.value = ''
    else prompt.value = [from.heading, from.caption].filter(Boolean).join('. ')
    tab.value = 'ai'
    const matching = modelOptions.value.find(item => item.format === format.value.label)
    if (matching) videoOption.value = matching.id
    nextTick(() => clipPrompt.value?.focus())
  })
}
function chooseReference(file) {
  if (!file || !mayEdit.value) return
  try {
    checkVideoReference(file)
    clearReference()
    reference.value = { file, url: URL.createObjectURL(file) }
    error.value = ''
  } catch (cause) { error.value = cause.message }
}
function clearReference() {
  if (reference.value) URL.revokeObjectURL(reference.value.url)
  reference.value = null
  referenceAnalysis.value = ''
}
function setTransitionClip(index, file) {
  if (!mayEdit.value) return
  try {
    if (file) checkVideoReference(file)
    const old = transitionClips.value[index]
    const clip = file ? { file, url: URL.createObjectURL(file) } : null
    if (old) URL.revokeObjectURL(old.url)
    transitionClips.value = transitionClips.value.map((item, position) => position === index ? clip : item)
    error.value = ''
  } catch (cause) { error.value = cause.message }
}

function chooseReferenceImages(source) {
  const files = Array.from(source || [])
  if (!files.length || !mayEdit.value) return
  if (referenceImages.value.length + files.length > maxImageReferences.value) {
    error.value = `Use até ${maxImageReferences.value} imagens neste modo.`
    return
  }
  try {
    files.forEach(checkImageReference)
    referenceImages.value = [...referenceImages.value, ...files.map(file => ({ file, url: URL.createObjectURL(file) }))]
    error.value = ''
  } catch (cause) { error.value = cause.message }
}
function removeReferenceImage(image) {
  URL.revokeObjectURL(image.url)
  referenceImages.value = referenceImages.value.filter(item => item !== image)
}
function useSceneReference() {
  const file = selectedScene.value?.media?.file
  chooseReference(file)
  if (reference.value?.file === file) {
    changeGenerationMode('edit')
    tab.value = 'ai'
  }
}
async function analyzeReference() {
  if (!reference.value || !useCredits()) return
  await run('analysis', async signal => {
    try {
      const model = models.value.find(item => item.id === 'gpt-6.1-sol') || models.value[0]
      if (!model) throw new Error('O modelo de análise está temporariamente indisponível.')
      const frames = await sampleVideoFrames(reference.value.file, signal)
      const content = [{ type: 'input_text', text: `Analise os quadros amostrados de um vídeo-base em português brasileiro. Identifique ações visíveis, personagens, enquadramento, iluminação e composição. Sugira um prompt curto para editar o clipe conforme o pedido do usuário. Não infira falas, identidade ou eventos entre quadros. Pedido: ${prompt.value.trim() || 'preservar o movimento da cena'}` },
        ...frames.flatMap(frame => [{ type: 'input_text', text: `Quadro em ${frame.second}s` }, { type: 'input_image', image_url: frame.url }])]
      const { data } = await api.post('/aitoia/responses', { model: model.id, walletId: walletId.value,
        reasoning: { effort: model.efforts.includes('medium') ? 'medium' : model.efforts[0] }, input: [{ role: 'user', content }] },
      { headers: authorization({ 'X-Aito-Request-Id': crypto.randomUUID() }), signal })
      signal.throwIfAborted()
      referenceAnalysis.value = readAnswer(data).slice(0, 6000)
      if (!referenceAnalysis.value) throw new Error('A análise não retornou texto. Tente novamente.')
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
function useReferenceAnalysis() {
  const direction = [prompt.value.trim(), referenceAnalysis.value.trim()].filter(Boolean).join('\n\n')
  prompt.value = direction.slice(0, 2000)
  nextTick(() => clipPrompt.value?.focus())
}
async function quoteVideo() {
  if (!canQuoteVideo.value || !useCredits()) return
  await run('quote', async signal => {
    videoQuote.value = null
    if (referenceModel.value?.sourceDuration && reference.value) {
      const source = await openStudioMedia(reference.value.file, 0, signal)
      const duration = source.element.duration
      closeStudioMedia(source)
      if (duration < 4) throw new Error('O Genjutsu exige um vídeo-base com pelo menos 4 segundos.')
    }
    async function upload(file, contentType, put) {
      const { data } = await api.post('/aitoia/video/references', { contentType, sizeBytes: file.size, walletId: walletId.value },
        { headers: authorization(), signal })
      return put(file, data.data, signal)
    }
    const referenceToken = !transitionMode.value && !continuationMode.value && reference.value && await upload(reference.value.file, 'video/mp4', putVideoReference)
    const imageReferenceTokens = []
    if (sourceFrames.value.length) {
      const first = sourceFrames.value[0]
      const last = sourceFrames.value[1]
      imageReferenceTokens.push(await upload(first.file, 'image/jpeg', putImageReference))
      for (const { file } of referenceImages.value) imageReferenceTokens.push(await upload(file, checkImageReference(file), putImageReference))
      if (last) imageReferenceTokens.push(await upload(last.file, 'image/jpeg', putImageReference))
    } else if (transitionMode.value) {
      const [from, to] = transitionClips.value
      const { format, resolution } = offer.value
      const frames = await Promise.all([captureTransitionFrame(from.file, 'end', format, resolution, signal),
        captureTransitionFrame(to.file, 'start', format, resolution, signal)])
      for (const file of frames) imageReferenceTokens.push(await upload(file, 'image/jpeg', putImageReference))
    } else {
      for (const { file } of referenceImages.value) imageReferenceTokens.push(await upload(file, checkImageReference(file), putImageReference))
    }
    const tokens = { ...(referenceToken && { referenceToken }), ...(imageReferenceTokens.length && { imageReferenceTokens }) }
    const body = { model: generationMode.value === 'text' ? videoModel.value : referenceModel.value.id,
      option: videoOption.value, prompt: prompt.value.trim(), walletId: walletId.value, ...tokens }
    const quote = await api.post('/aitoia/video/generations/quote', body, { headers: authorization(), signal })
    signal.throwIfAborted()
    videoQuote.value = { ...quote.data.data, ...tokens, requestId: crypto.randomUUID() }
  })
}
async function makeVideo() {
  if (busy.value || activeJob.value || !canQuoteVideo.value || !useCredits()) return
  if (!videoQuote.value) return quoteVideo()
  await run('video', async signal => {
    try {
      const body = { model: generationMode.value === 'text' ? videoModel.value : referenceModel.value?.id, option: videoOption.value,
        prompt: prompt.value.trim(), walletId: walletId.value }
      const { quoteToken, referenceToken, imageReferenceTokens, requestId } = videoQuote.value
      Object.assign(body, { quoteToken, ...(referenceToken && { referenceToken }), ...(imageReferenceTokens && { imageReferenceTokens }) })
      const placement = { afterSceneId: insertionAfter.value, kind: transitionMode.value ? 'transition' : 'scene' }
      const { data } = await api.post('/aitoia/video/generations', body, { headers: authorization({ 'X-Aito-Request-Id': requestId }), signal })
      signal.throwIfAborted()
      videoQuote.value = null
      const job = { ...data.data, ...placement }
      activeJob.value = job
      keepJob(job)
      void saveProject()
      wallet.refreshStatus({ silent: true })
      await readJob(job, signal)
    } catch (cause) {
      if (cause.response?.status === 409) videoQuote.value = null
      throw cause
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
function downloadGenerated() {
  if (!generated.value) return
  run('media', async signal => {
    const previous = generated.value
    if (previous.expiresAt <= Date.now()) throw new Error('Este clipe atingiu o prazo de retenção.')
    const file = await generatedFile(previous, signal)
    signal.throwIfAborted()
    if (!previous.file) {
      const clip = localClip({ ...previous, file })
      clipLibrary.value = clipLibrary.value.map(item => item.id === clip.id ? clip : item)
      selectGenerated(clip)
    }
    downloadAitoIAFile(file, file.name)
  })
}
function addGenerated() {
  if (!generated.value) return
  run('media', async signal => {
    const clip = generated.value
    if (clip.expiresAt <= Date.now()) throw new Error('Este clipe atingiu o prazo de retenção.')
    const file = await generatedFile(clip, signal)
    signal.throwIfAborted()
    if (!selectedScene.value) addSceneForClip()
    await setSceneMedia(file, signal)
    signal.throwIfAborted()
    const duration = selectedScene.value?.media?.element.duration
    editScene({ duration: Math.min(15, duration), cut: true, clipId: clip.id, expiresAt: clip.expiresAt })
    if (duration > 15) notice.value = 'A cena usa os primeiros 15 segundos. O clipe completo continua disponível para download.'
    tab.value = 'scenes'
  })
}
function addSceneForClip() {
  const scene = freshScene()
  replaceScenes([scene])
  selectScene(scene.id)
}
function addGeneratedSequence(clip = generated.value) {
  if (!clip) return
  run('media', async signal => {
    if (clip.expiresAt && clip.expiresAt <= Date.now()) throw new Error('Este clipe atingiu o prazo de retenção.')
    const file = await generatedFile(clip, signal)
    await insertClip(file, signal, clip)
  })
}
async function insertClip(file, signal, clip) {
  const first = scenes.value[0]
  const emptyTimeline = scenes.value.length === 1 && !first.heading && !first.caption && !first.media && !first.missingMedia
  const base = emptyTimeline ? [] : scenes.value
  const media = await openStudioMedia(file, projectMediaBytes(base), signal)
  if (signal.aborted || !mounted) { closeStudioMedia(media); return }
  const segments = media.isVideo ? splitStudioClip(media.element.duration) : [{ duration: 5, offset: 0 }]
  if (!segments.length || base.length + segments.length > maxStudioScenes) {
    closeStudioMedia(media)
    throw new Error(`O clipe precisa de ${segments.length} cenas livres na linha do tempo.`)
  }
  const appended = segments.map(segment => freshScene({ ...segment, media, cut: media.isVideo,
    clipId: clip?.id || null, expiresAt: clip?.expiresAt || null, kind: clip?.kind }))
  const index = clip?.afterSceneId ? base.findIndex(scene => scene.id === clip.afterSceneId) + 1 : 0
  replaceScenes(index ? [...base.slice(0, index), ...appended, ...base.slice(index)] : [...base, ...appended])
  tab.value = 'scenes'
  inventoryOpen.value = false
  selectScene(appended[0].id)
  notice.value = appended.length > 1 ? `Clipe dividido em ${appended.length} cenas no vídeo master.` : 'Mídia adicionada ao vídeo master.'
}
async function archiveProject() {
  await run('archive', async signal => {
    const files = []
    const archived = new Map()
    function add(file, prefix) {
      if (!file) return undefined
      if (archived.has(file)) return archived.get(file)
      const safe = String(file.name || 'arquivo').replace(/[^\p{L}\p{N} ._-]/gu, '_').replace(/^[. ]+/, '').slice(0, 120) || 'arquivo'
      const name = `midias/${prefix}-${safe}`
      files.push({ name, blob: file })
      archived.set(file, name)
      return name
    }
    const metadata = { format: 'aitoia-video', version: 3, title: title.value, aspectRatio: format.value.label,
      expiresAt: activeProject.value?.expiresAt,
      scenes: scenes.value.map(({ media, ...scene }, index) => ({
        ...scene, media: unavailableScene(scene) ? undefined : add(media?.file, `cena-${index + 1}`),
      })),
      narration: { text: narrationText.value, media: add(narration.value?.file, 'locucao') },
      components: projectComponents.value.map(({ file, ...item }, index) => ({ ...item, media: add(file, `componente-${index + 1}`) })),
      componentTypes: componentTypes.value,
      configuration: { prompt: prompt.value, scriptPrompt: scriptPrompt.value, mode: generationMode.value, model: videoModel.value },
      references: { video: add(reference.value?.file, 'referencia'), images: referenceImages.value.map((item, index) => add(item.file, `imagem-${index + 1}`)),
        transition: transitionClips.value.map((clip, index) => add(clip?.file, `transicao-${index + 1}`)),
        keyframes: sourceFrames.value.map((frame, index) => add(frame.file, `quadro-${index + 1}`)) },
      clips: clipLibrary.value.map(({ id, number, file, kind, expiresAt }) => ({ id, number, kind, expiresAt,
        media: expiresAt > Date.now() ? add(file, `clipe-${number}`) : undefined })) }
    if (recording.value) files.push({ name: recording.value.filename, blob: recording.value.blob })
    if (subtitles.value) files.push({ name: 'aitoia-legendas.srt', blob: new Blob([subtitles.value], { type: 'text/plain' }) })
    const manifest = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json;charset=utf-8' })
    const archive = await zipAitoIAFiles([{ name: 'projeto.json', blob: manifest }, ...files])
    signal.throwIfAborted()
    downloadAitoIAFile(archive, 'aitoia-projeto-video.zip')
  })
}
function resetProject() {
  pause()
  removeNarration()
  clearVoicePreview()
  clearReference()
  referenceImages.value.forEach(image => URL.revokeObjectURL(image.url))
  referenceImages.value = []
  transitionClips.value.forEach(clip => { if (clip) URL.revokeObjectURL(clip.url) })
  transitionClips.value = [null, null]
  clearSourceFrames()
  insertionAfter.value = null
  videoQuote.value = null
  updateRecording(null)
  clipLibrary.value.forEach(disposeClip)
  generated.value = null
  clipLibrary.value = []
  projectComponents.value = []
  componentTypes.value = ['Personagens', 'Cenas', 'Modelos de cena', 'Cenários', 'Roteiros']
  activeJob.value = null
  scriptPrompt.value = ''
  prompt.value = ''
  narrationText.value = ''
  title.value = 'Meu vídeo'
  formatId.value = videoFormats[0].id
  generationMode.value = 'text'
  const oldMedia = new Set([scenes.value, ...history.value].flatMap(list => list.map(scene => scene.media)))
  history.value = []
  oldMedia.forEach(closeStudioMedia)
  displayedVideo = null
  scenes.value = [freshScene()]
  selectScene(scenes.value[0].id)
}

function snapshotProject() {
  return { title: title.value, formatId: formatId.value, sceneId: sceneId.value,
    scenes: scenes.value.map(({ media, ...scene }) => ({ ...scene, file: media?.file })),
    narrationText: narrationText.value, narration: narration.value?.file, recording: recording.value?.blob,
    prompt: prompt.value, scriptPrompt: scriptPrompt.value, generationMode: generationMode.value,
    reference: reference.value?.file, referenceImages: referenceImages.value.map(item => item.file), referenceAnalysis: referenceAnalysis.value,
    transitionClips: transitionClips.value.map(clip => clip?.file || null), sourceFrames: sourceFrames.value.map(frame => frame.file),
    insertionAfter: insertionAfter.value, componentTypes: componentTypes.value, components: projectComponents.value,
    clips: clipLibrary.value.map(({ url, ...clip }) => ({ ...clip, ...(clip.expiresAt <= Date.now() && { file: undefined, remoteUrl: undefined, expired: true }) })),
    selectedClipId: generated.value?.id, activeJob: activeJob.value }
}

async function restoreProject(project, signal) {
  resetProject()
  if (!Array.isArray(project?.scenes)) return
  const localMedia = new Map()
  let opened = false
  try {
    for (const { file, expiresAt } of project.scenes) {
      if (!file || localMedia.has(file) || (expiresAt && expiresAt <= Date.now())) continue
      try { localMedia.set(file, await openStudioMedia(file, 0, signal)) }
      catch { signal.throwIfAborted(); localMedia.set(file, null) }
    }
    signal.throwIfAborted()
    opened = true
    title.value = project.title
    if (videoFormats.some(item => item.id === project.formatId)) formatId.value = project.formatId
    replaceScenes(project.scenes.map(({ file, ...scene }) => ({ ...scene, media: localMedia.get(file) || null,
      missingMedia: scene.missingMedia || Boolean(file && !localMedia.get(file)) })), { remember: false })
    selectScene(scenes.value.some(scene => scene.id === project.sceneId) ? project.sceneId : scenes.value[0]?.id || '')
    narrationText.value = project.narrationText || ''
    if (project.narration) replaceNarration(project.narration)
    updateRecording(project.recording)
    prompt.value = project.prompt || ''
    scriptPrompt.value = project.scriptPrompt || ''
    generationMode.value = project.generationMode || 'text'
    reference.value = project.reference ? { file: project.reference, url: URL.createObjectURL(project.reference) } : null
    referenceImages.value = (project.referenceImages || []).map(file => ({ file, url: URL.createObjectURL(file) }))
    transitionClips.value = [0, 1].map(index => {
      const file = project.transitionClips?.[index]
      return file ? { file, url: URL.createObjectURL(file) } : null
    })
    sourceFrames.value = (project.sourceFrames || []).map(file => ({ file, url: URL.createObjectURL(file) }))
    insertionAfter.value = project.insertionAfter || null
    if (project.componentTypes?.length) componentTypes.value = project.componentTypes
    projectComponents.value = project.components || []
    referenceAnalysis.value = project.referenceAnalysis || ''
    clipLibrary.value = (project.clips || []).flatMap(clip => {
      try {
        const expiresAt = clip.expiresAt || project.expiresAt
        return [clip.expired || expiresAt <= Date.now()
          ? { id: clip.id, number: clip.number, expiresAt, expired: true }
          : localClip({ ...clip, expiresAt })]
      } catch { return [] }
    })
    selectGenerated(clipLibrary.value.find(item => item.id === project.selectedClipId) || clipLibrary.value[0] || null)
    activeJob.value = project.activeJob || null
  } finally {
    if (!opened) localMedia.forEach(closeStudioMedia)
  }
}
function expireCurrentMedia() {
  const time = Date.now()
  const expired = scenes.value.some(scene => scene.media && scene.expiresAt && scene.expiresAt <= time)
  if (expired) {
    const previous = new Set(history.value.flatMap(list => list.map(scene => scene.media)))
    history.value = []
    replaceScenes(scenes.value.map(scene => scene.expiresAt && scene.expiresAt <= time
      ? { ...scene, media: null, missingMedia: true } : scene), { remember: false })
    const currentMedia = new Set(scenes.value.map(scene => scene.media))
    previous.forEach(media => { if (!currentMedia.has(media)) closeStudioMedia(media) })
  }
  if (clipLibrary.value.some(clip => !clip.expired && clip.expiresAt <= time)) {
    clipLibrary.value = clipLibrary.value.map(clip => {
      if (clip.expired || clip.expiresAt > time) return clip
      disposeClip(clip)
      return { id: clip.id, number: clip.number, expiresAt: clip.expiresAt, expired: true }
    })
    if (generated.value) selectGenerated(clipLibrary.value.find(clip => clip.id === generated.value.id) || null)
  }
}

function createForScene() {
  if (!prompt.value.trim()) prompt.value = [selectedScene.value?.heading, selectedScene.value?.caption].filter(Boolean).join('. ')
  tab.value = 'ai'
  nextTick(() => clipPrompt.value?.focus())
}

function pasteStudioMedia(event) {
  if (tab.value !== 'ai') return pasteMedia(event)
  if (transitionMode.value && !sourceFrames.value.length) return
  const images = Array.from(event.clipboardData?.files || []).filter(item => item.type.startsWith('image/'))
  if (images.length) { event.preventDefault(); chooseReferenceImages(images) }
}

watch([timeline, format, previewMode], () => { if (mounted) seek(playhead.value) }, { flush: 'post' })
watch(tab, () => { if (mounted) paint(playhead.value) }, { flush: 'post' })
onMounted(async () => {
  mounted = true
  exportFormats.value = studioVideoExports()
  exportFormat.value = exportFormats.value[0]?.extension || ''
  expireTimer = setInterval(expireCurrentMedia, 10000)
  await nextTick()
  paint(0)
})
onBeforeUnmount(() => { mounted = false; clearInterval(expireTimer); activeOperation?.abort(); optionsRequest?.abort(); resetProject() })
</script>

<template>
  <div class="aito-ai-theme video-studio">
    <header class="video-studio__bar">
      <router-link to="/" class="video-studio__brand" aria-label="Site AitoSoftwares"><img src="/ia.gif" width="37" height="37" alt="" /> <strong>AitoIA</strong></router-link>
      <div class="video-studio__mode"><AitoIAModeSwitch mode="video" :busy="guarded" /></div>
      <div class="video-studio__account">
        <button v-if="signedIn" class="video-studio__balance" type="button" aria-label="Abrir carteira AitoTokens" :disabled="guarded" @click="showWallet"><img src="/aitotokens.svg" width="26" height="26" alt="" /><span>{{ status ? `${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }}</span><q-icon name="mdi-plus" size="16px" /></button>
        <template v-else><button class="video-studio__login" type="button" @click="showAuth('login')">Entrar</button><button class="video-studio__primary" type="button" @click="showAuth()">Criar conta</button></template>
      </div>
    </header>

    <main class="video-studio__main" @paste="pasteStudioMedia">
      <div class="video-studio__intro">
        <div><h1>Estúdio de vídeo</h1><p>Gere cenas, monte seu vídeo e exporte o resultado.</p></div>
        <div class="video-studio__zip">
          <span v-if="missingArchiveItems" class="video-studio__hint">{{ missingArchiveItems }} mídia(s) indisponível(is) ficarão fora do ZIP.</span>
          <button :class="nearingExpiry ? 'video-studio__primary' : 'video-studio__secondary'" type="button" :disabled="!mayEdit || Boolean(busy)" @click="archiveProject"><q-icon name="mdi-folder-zip-outline" size="20px" /> Baixar projeto ZIP</button>
        </div>
      </div>
      <p v-if="!signedIn" class="video-studio__notice"><q-icon name="mdi-gift-outline" size="20px" /> Crie sua conta para ganhar US$ 1 em AitoTokens e começar a criar.</p>
      <p v-if="error" role="alert" class="video-studio__notice video-studio__notice--error"><q-icon name="mdi-alert-circle-outline" size="20px" /> {{ error }}</p>
      <p v-else-if="blockedExit" role="status" class="video-studio__notice"><q-icon name="mdi-progress-clock" size="20px" /> Aguarde a conclusão do trabalho antes de sair do estúdio.</p>
      <p v-else-if="notice" role="status" class="video-studio__notice"><q-icon name="mdi-check-circle-outline" size="20px" /> {{ notice }}</p>

      <div v-if="draft" class="video-studio__notice video-studio__draft">
        <q-icon name="mdi-message-arrow-right-outline" size="22px" />
        <strong>{{ draft.purpose === 'save-clip' || draft.generated ? 'Clipe do chat' : 'Rascunho do chat' }}</strong>
        <button type="button" class="video-studio__secondary" :disabled="!draftReady" @click="applyDraft()">Usar neste projeto</button>
        <button type="button" class="video-studio__primary" :disabled="!draftReady" @click="applyDraft(true)">Criar projeto</button>
      </div>

      <div class="video-studio__grid" :class="{ 'video-studio__grid--generate': tab === 'ai' }">
        <aside class="video-studio__panel video-studio__sidebar" aria-label="Projetos e componentes">
          <button class="video-studio__secondary video-studio__sidebar-toggle" type="button" :aria-expanded="projectsOpen" @click="projectsOpen = !projectsOpen"><q-icon name="mdi-folder-multiple-outline" /> Projetos e componentes</button>
          <div class="video-studio__sidebar-content" :class="{ 'video-studio__sidebar-content--open': projectsOpen }">
            <AitoStudioProjectPicker v-if="signedIn" :projects="projects" :active-id="activeId" :loading="projectLoading"
              :storage-error="storageError" :cloud-state="cloudState" :disabled="!accountId || !mayEdit || Boolean(busy)" @create="createProject" @open="openProject" @remove="deleteProject" />
            <label>Nome do projeto<input v-model="title" maxlength="80" :disabled="!mayEdit" /></label>
            <div class="video-studio__sidebar-components">
              <h2>Componentes</h2>
              <button v-for="type in componentTypes" :key="type" type="button" class="video-studio__secondary" @click="openComponents(type)">{{ type }}</button>
              <label>Novo tipo<input v-model.trim="componentTypeName" maxlength="32" @keydown.enter.prevent="addComponentType" /></label>
              <button type="button" class="video-studio__secondary" :disabled="!componentTypeName" @click="addComponentType"><q-icon name="mdi-plus" /> Criar tipo</button>
            </div>
          </div>
        </aside>
        <div class="video-studio__tabs" role="group" aria-label="Ferramentas do editor"><button v-for="item in tabs" :key="item.id" type="button" :aria-pressed="tab === item.id" :disabled="!mayEdit" @click="tab = item.id"><q-icon :name="item.icon" size="20px" /> {{ item.label }}</button></div>

        <section v-if="tab === 'ai'" class="video-studio__catalog" aria-label="Modo de geração">
          <div class="video-studio__catalog-header">
            <div><h2>Criar com Higgsfield</h2><p>Gere um clipe a partir de um prompt e referências opcionais.</p></div>
            <button v-if="signedIn" class="video-studio__icon" type="button" aria-label="Atualizar catálogo de vídeos" :disabled="optionsLoading || !mayEdit" @click="loadOptions"><q-icon name="mdi-refresh" size="21px" /></button>
          </div>
          <div class="video-studio__generation-modes" role="group" aria-label="Como criar o clipe">
            <button v-for="item in generationModes.filter(mode => mode.id !== 'continuation' || generationMode === mode.id)" :key="item.id" class="video-studio__secondary" type="button" :aria-pressed="generationMode === item.id" :disabled="!mayEdit" @click="changeGenerationMode(item.id)">
              <q-icon :name="item.icon" size="19px" /> {{ item.label }}
            </button>
          </div>
          <details v-if="generationMode === 'text'" class="video-studio__catalog-models">
            <summary><q-icon name="mdi-movie-open-outline" size="19px" /> Modelos de vídeo <strong v-if="selectedModel">{{ selectedModel.name }}</strong></summary>
            <div class="video-studio__model-grid"><article v-for="item in modelCards" :key="item.id" class="video-studio__model-card" :class="{ 'video-studio__model-card--selected': videoModel === item.id && item.selectable }">
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
            </article></div>
          </details>
        </section>

        <section class="video-studio__panel video-studio__timeline" aria-labelledby="video-studio-timeline">
          <div class="video-studio__scene-heading">
            <h2 id="video-studio-timeline">Vídeo master</h2>
            <span class="video-studio__hint">{{ durationLabel(timeline.duration) }}</span>
          </div>
          <div class="video-studio__actions">
            <button class="video-studio__primary" type="button" :disabled="!mayEdit" @click="createForScene"><q-icon name="mdi-creation-outline" size="18px" /> Gerar cena</button>
            <input ref="importInput" type="file" accept="video/*" hidden @change="fileFrom($event, importClip)" />
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="importInput?.click()"><q-icon name="mdi-upload-outline" size="18px" /> Importar vídeo</button>
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="openInventory"><q-icon name="mdi-folder-multiple-outline" size="18px" /> Adicionar do projeto</button>
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit || scenes.length >= maxStudioScenes" @click="addScene"><q-icon name="mdi-plus" size="18px" /> Cena vazia</button>
            <button class="video-studio__icon" type="button" aria-label="Desfazer edição" :disabled="!mayEdit || !history.length" @click="undoEdit"><q-icon name="mdi-undo" size="20px" /></button>
          </div>
          <div v-if="scenes.length" class="video-studio__scenes" role="group" aria-label="Cenas" @dragover.prevent @drop.prevent="dragItem ? cancelDrag() : importClip($event.dataTransfer.files[0])">
            <button v-for="({ scene, start, end }, index) in timeline.segments" :key="scene.id" type="button" :aria-pressed="sceneId === scene.id" :disabled="!mayEdit"
              :draggable="mayEdit" :class="{ 'video-studio__scene-drop': dragTarget === scene.id && dragItem !== scene.id }"
              @dragstart="dragItem = scene.id; $event.dataTransfer.setData('text/plain', scene.id)" @dragend="cancelDrag"
              @dragover.prevent="dragTarget = scene.id" @drop="dragItem && finishDrag(scene.id)" @click="selectScene(scene.id); tab = 'scenes'">
              <span class="video-studio__scene-thumb"><img v-if="scene.media?.poster || (scene.media && !scene.media.isVideo)" :src="scene.media.poster || scene.media.url" alt="" loading="lazy" /><q-icon v-else :name="scene.media ? 'mdi-filmstrip' : 'mdi-image-outline'" size="20px" /></span>
              <span class="video-studio__scene-label"><strong>{{ scene.heading || (scene.kind === 'transition' ? 'Transição' : `Cena ${index + 1}`) }}</strong><small>{{ durationLabel(start) }} · {{ (end - start).toFixed(1) }} s</small><small v-if="unavailableScene(scene)">Mídia indisponível</small></span>
            </button>
          </div>
          <p v-else class="video-studio__hint">Adicione uma cena ou gere um clipe com IA para começar.</p>
        </section>

        <section class="video-studio__panel video-studio__editor" aria-label="Editor do projeto">

          <div v-if="tab === 'scenes'" class="video-studio__section">
            <template v-if="selectedScene">
              <h2>Editar cena {{ scenes.findIndex(scene => scene.id === sceneId) + 1 }}</h2>
              <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/*" hidden @change="fileFrom($event, attach)" />
              <button class="video-studio__drop" type="button" :disabled="!mayEdit" @dragover.prevent @drop.prevent="attach($event.dataTransfer.files[0])" @click="imageInput?.click()"><q-icon name="mdi-image-plus-outline" size="24px" /><span><strong>{{ selectedScene.media?.file.name || 'Adicionar imagem ou vídeo' }}</strong><small>{{ busy === 'media' ? 'Abrindo arquivo…' : 'Clique, arraste ou cole uma imagem.' }}</small></span></button>
              <div class="video-studio__actions">
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="createForScene"><q-icon name="mdi-creation-outline" size="18px" /> Gerar vídeo com IA</button>
                <button v-if="selectedScene.media" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="removeMedia"><q-icon name="mdi-close" size="18px" /> Remover mídia</button>
                <button v-if="selectedScene.media?.isVideo && selectedScene.media.file.type === 'video/mp4'" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="useSceneReference"><q-icon name="mdi-movie-open-edit-outline" size="18px" /> Editar vídeo com IA</button>
              </div>
              <div class="video-studio__fields">
                <label>Título na cena<input :value="selectedScene.heading" maxlength="110" placeholder="Ex. Tudo em um só lugar" :disabled="!mayEdit" @input="editScene({ heading: $event.target.value })" /></label>
                <label v-if="!selectedScene.media?.isVideo">Duração (s)<input :value="selectedScene.duration" type="number" min="1" max="15" :disabled="!mayEdit" @change="editScene({ cut: false, duration: sceneSeconds($event.target.value) }); $event.target.value = sceneSeconds($event.target.value)" /></label>
              </div>
              <div v-if="selectedScene.media?.isVideo" class="video-studio__fields video-studio__fields--equal">
                <label>Corte inicial (s)<input :value="(selectedScene.offset || 0).toFixed(2)" type="number" min="0" :max="selectedScene.media.element.duration" step=".1" :disabled="!mayEdit" @change="updateCut('start', $event.target.value)" /></label>
                <label>Corte final (s)<input :value="((selectedScene.offset || 0) + cutDuration(selectedScene)).toFixed(2)" type="number" min="0" :max="selectedScene.media.element.duration" step=".1" :disabled="!mayEdit" @change="updateCut('end', $event.target.value)" /></label>
              </div>
              <label>Legenda<textarea :value="selectedScene.caption" rows="2" maxlength="180" placeholder="Complemento opcional" :disabled="!mayEdit" @input="editScene({ caption: $event.target.value })" /></label>
              <div class="video-studio__scene-actions">
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit || !maySplit" @click="splitAtPlayhead"><q-icon name="mdi-content-cut" size="17px" /> Dividir no marcador</button>
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit || scenes.length >= maxStudioScenes" @click="duplicateScene"><q-icon name="mdi-content-copy" size="17px" /> Duplicar</button>
                <span class="video-studio__spacer" />
                <button class="video-studio__icon" type="button" aria-label="Mover cena para trás" :disabled="!mayEdit || scenes[0].id === sceneId" @click="moveScene(-1)"><q-icon name="mdi-chevron-left" size="22px" /></button>
                <button class="video-studio__icon" type="button" aria-label="Mover cena para frente" :disabled="!mayEdit || scenes.at(-1).id === sceneId" @click="moveScene(1)"><q-icon name="mdi-chevron-right" size="22px" /></button>
                <button class="video-studio__icon" type="button" aria-label="Remover cena do vídeo master" :disabled="!mayEdit" @click="deleteScene"><q-icon name="mdi-delete-outline" size="20px" /></button>
              </div>
              <div class="video-studio__actions">
                <button class="video-studio__secondary" type="button" :disabled="!selectedScene.media?.isVideo || Boolean(busy)" @click="buildContinuity(false)"><q-icon name="mdi-movie-open-outline" size="18px" /> Gerar próxima cena</button>
                <button class="video-studio__secondary" type="button" :disabled="!selectedScene.media?.isVideo || !nextScene?.media?.isVideo || Boolean(busy)" @click="buildContinuity(true)"><q-icon name="mdi-transition" size="18px" /> Gerar transição</button>
                <span v-if="!nextScene?.media?.isVideo" class="video-studio__hint">Adicione um vídeo na próxima cena para criar a transição.</span>
              </div>
            </template>
            <details class="video-studio__script">
              <summary><q-icon name="mdi-creation-outline" size="19px" /> Criar roteiro com IA</summary>
              <label>Briefing<textarea v-model="scriptPrompt" rows="3" maxlength="3000" placeholder="Descreva o assunto, o público e a duração desejada…" :disabled="!mayEdit" /></label>
              <button type="button" class="video-studio__secondary" :disabled="!scriptPrompt.trim() || !mayEdit" @click="makeScript"><q-spinner v-if="busy === 'script'" size="18px" /><q-icon v-else name="mdi-creation-outline" size="18px" /> {{ busy === 'script' ? 'Escrevendo…' : 'Gerar roteiro' }}</button>
              <small>O roteiro preenche as cenas e a locução.</small>
            </details>
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
            <div class="video-studio__scene-heading"><h2>{{ transitionMode ? 'Gerar transição' : 'Gerar clipe' }}</h2><span v-if="selectedModel" class="video-studio__selected-model">{{ selectedModel.name }}</span></div>
            <label>{{ transitionMode ? 'Como a transição deve acontecer?' : 'Descrição do clipe' }}
              <textarea ref="clipPrompt" v-model="prompt" rows="5" maxlength="2000" :placeholder="transitionMode ? 'Ex.: faça a câmera avançar entre as duas cenas com um movimento suave…' : 'Descreva o cenário, o movimento de câmera e o estilo…'" :disabled="!mayEdit" />
            </label>
            <div v-if="sourceFrames.length" class="video-studio__reference">
              <h3>{{ transitionMode ? 'Quadros dos cortes' : 'Quadro de partida' }}</h3>
              <div class="video-studio__reference-images">
                <img v-for="(frame, index) in sourceFrames" :key="frame.url" :src="frame.url" :alt="index ? 'Primeiro quadro da próxima cena' : 'Último quadro da cena selecionada'" />
              </div>
              <div class="video-studio__actions">
                <input ref="imageReferenceInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="chooseReferenceImages($event.target.files); $event.target.value = ''" />
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit || referenceImages.length >= maxImageReferences" @click="imageReferenceInput?.click()">Anexar quadros intermediários ({{ referenceImages.length }}/{{ maxImageReferences }})</button>
                <div class="video-studio__reference-images"><div v-for="image in referenceImages" :key="image.url"><img :src="image.url" :alt="image.file.name" /><button class="video-studio__icon" type="button" :aria-label="`Remover ${image.file.name}`" @click="removeReferenceImage(image)"><q-icon name="mdi-close" size="18px" /></button></div></div>
              </div>
            </div>
            <div v-else-if="transitionMode" class="video-studio__reference">
              <h3>Clipes de origem</h3>
              <div class="video-studio__transition">
                <div v-for="(label, index) in transitionLabels" :key="label" class="video-studio__transition-clip">
                  <label class="video-studio__drop" @dragover.prevent @drop.prevent="setTransitionClip(index, $event.dataTransfer.files[0])">
                    <q-icon name="mdi-file-video-outline" size="22px" />
                    <span><strong>{{ label }}</strong><small>{{ transitionClips[index]?.file.name || 'MP4 de até 60 MB' }}</small></span>
                    <input class="video-studio__transition-input" type="file" accept="video/mp4,.mp4" :aria-label="label"
                      :disabled="!mayEdit" @change="fileFrom($event, file => { if (file) setTransitionClip(index, file) })" />
                  </label>
                  <template v-if="transitionClips[index]">
                    <video class="video-studio__reference-preview" :src="transitionClips[index].url" controls playsinline preload="metadata" :aria-label="label" />
                    <button class="video-studio__secondary" type="button" :disabled="!mayEdit" :aria-label="'Remover ' + label" @click="setTransitionClip(index, null)">Remover</button>
                  </template>
                </div>
              </div>
              <p class="video-studio__hint">Ao cotar, enviamos à Higgsfield apenas um quadro do fim do primeiro clipe e outro do início do segundo. A transição aparece como um novo clipe para adicionar à sequência.</p>
            </div>
            <div v-else-if="!continuationMode && (maxImageReferences || generationMode !== 'text' || referenceImages.length)" class="video-studio__reference">
              <h3>{{ generationMode === 'text' ? 'Referências opcionais' : 'Referências' }}</h3>
              <input ref="referenceInput" type="file" accept="video/mp4,.mp4" hidden @change="fileFrom($event, chooseReference)" />
              <button class="video-studio__drop" type="button" :disabled="!mayEdit" @dragover.prevent @drop.prevent="chooseReference($event.dataTransfer.files[0])" @click="referenceInput?.click()"><q-icon name="mdi-file-video-outline" size="24px" /><span><strong>{{ reference?.file.name || 'Anexar vídeo-base' }}</strong><small>{{ referenceModel?.sourceDuration ? 'MP4 de 4 segundos ou mais, até 60 MB' : 'MP4 de até 60 MB' }}</small></span></button>
              <video v-if="reference" class="video-studio__reference-preview" :src="reference.url" controls playsinline preload="metadata" aria-label="Vídeo-base selecionado" />
              <div v-if="reference" class="video-studio__actions">
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="analyzeReference"><q-spinner v-if="busy === 'analysis'" size="18px" /><q-icon v-else name="mdi-creation-outline" size="18px" /> {{ busy === 'analysis' ? 'Analisando quadros…' : 'Analisar quadros com IA' }}</button>
                <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="clearReference">Remover referência</button>
              </div>
              <input ref="imageReferenceInput" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden @change="chooseReferenceImages($event.target.files); $event.target.value = ''" />
              <button v-if="maxImageReferences" class="video-studio__drop" type="button" :disabled="!mayEdit || referenceImages.length >= maxImageReferences"
                @dragover.prevent @drop.prevent="chooseReferenceImages($event.dataTransfer.files)" @click="imageReferenceInput?.click()">
                <q-icon name="mdi-image-multiple-outline" size="24px" /><span><strong>Adicionar imagens ({{ referenceImages.length }}/{{ maxImageReferences }})</strong><small>JPEG, PNG ou WebP. Clique, arraste ou cole.</small></span>
              </button>
              <div v-if="referenceImages.length" class="video-studio__reference-images" aria-label="Imagens de referência">
                <div v-for="image in referenceImages" :key="image.url"><img :src="image.url" :alt="image.file.name" /><button class="video-studio__icon" type="button" :aria-label="`Remover ${image.file.name}`" :disabled="!mayEdit" @click="removeReferenceImage(image)"><q-icon name="mdi-close" size="18px" /></button></div>
              </div>
              <p v-if="referenceImages.length > maxImageReferences" class="video-studio__hint">Remova imagens para respeitar o limite de {{ maxImageReferences }} neste modo.</p>
              <p v-else-if="reference || referenceImages.length" class="video-studio__hint">As referências são enviadas à Higgsfield ao consultar o preço.</p>
              <div v-if="referenceAnalysis" class="video-studio__analysis"><h3>Análise do vídeo-base</h3><p>{{ referenceAnalysis }}</p><button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="useReferenceAnalysis">Adicionar ao prompt</button></div>
            </div>
            <label v-if="offer && referenceModel?.sourceDuration">Resolução<select v-model="videoOption" :disabled="!mayEdit"><option v-for="item in modelOptions" :key="item.id" :value="item.id">{{ item.label }}</option></select><small>A duração e a proporção seguem o vídeo-base.</small></label>
            <div v-else-if="offer" class="video-studio__fields video-studio__fields--clip">
              <label>Formato<select :value="offer.format" :disabled="!mayEdit" @change="changeVideoConfiguration('format', $event.target.value)"><option v-for="aspect in videoAspects" :key="aspect">{{ aspect }}</option></select></label>
              <label>Resolução<select :value="optionResolution(offer)" :disabled="!mayEdit" @change="changeVideoConfiguration('resolution', $event.target.value)"><option v-for="resolution in videoResolutions" :key="resolution" :value="resolution">{{ resolution }}</option></select></label>
              <label>Duração<select v-model="videoOption" :disabled="!mayEdit"><option v-for="item in videoDurations" :key="item.id" :value="item.id">{{ item.seconds }} s</option></select></label>
            </div>
            <p v-else-if="signedIn && !activeJob && !generated" class="video-studio__hint">{{ optionsLoading ? 'Carregando modelos de vídeo…' : optionsError || 'A geração de clipes está temporariamente indisponível.' }}</p>
            <div class="video-studio__actions">
              <button v-if="!signedIn" class="video-studio__primary" type="button" @click="showAuth()">Criar conta para usar IA</button>
              <button v-else-if="activeJob && !busy" class="video-studio__primary" type="button" @click="checkJob"><q-icon name="mdi-refresh" size="20px" /> Verificar geração</button>
              <button v-else class="video-studio__primary" type="button" :disabled="!mayEdit || Boolean(busy) || !canQuoteVideo" @click="makeVideo"><q-spinner v-if="busy === 'video' || busy === 'quote'" size="19px" /><q-icon v-else :name="videoQuote ? 'mdi-movie-open-play-outline' : 'mdi-calculator-variant-outline'" size="19px" /> {{ busy === 'video' ? 'Gerando clipe…' : busy === 'quote' ? 'Consultando preço…' : videoQuote ? 'Gerar clipe' : 'Consultar preço' }}<span v-if="videoQuote && !busy"> · Até {{ usd(videoQuote.billedUsdCents) }}</span></button>
            </div>
          </div>
        </section>

        <section v-if="tab === 'ai'" class="video-studio__panel video-studio__preview video-studio__preview--clips" aria-label="Clipes do projeto">
            <header><h2>Clipes do projeto</h2><span v-if="clipLibrary.length">{{ clipLibrary.length }} {{ clipLibrary.length === 1 ? 'clipe' : 'clipes' }}</span></header>
            <div v-if="generated" class="video-studio__generated">
              <div class="video-studio__clip-list" role="group" aria-label="Clipes gerados"><button v-for="clip in clipLibrary" :key="clip.id" class="video-studio__secondary" type="button" :aria-pressed="clip.id === generated.id" :disabled="!mayEdit" @click="selectGenerated(clip)">Clipe {{ clip.number }}</button></div>
              <p v-if="generated.expired" class="video-studio__hint">Este clipe expirou. Baixe os demais clipes ou gere uma nova cena.</p>
              <video v-else :src="generated.url" controls playsinline preload="metadata" referrerpolicy="no-referrer" aria-label="Clipe gerado com IA" @loadedmetadata="generatedDuration = $event.target.duration" />
              <small v-if="!generated.expired" class="video-studio__hint">Disponível até {{ displayDate.format(generated.expiresAt) }}</small>
              <div class="video-studio__actions">
                <button v-if="!generated.expired" class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="downloadGenerated"><q-icon name="mdi-download-outline" size="18px" /> Baixar original</button>
                <button v-if="!generated.expired" class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="addGenerated"><q-icon name="mdi-swap-horizontal" size="18px" /> Usar na cena atual</button>
                <button v-if="!generated.expired" class="video-studio__primary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="addGeneratedSequence()"><q-icon name="mdi-playlist-plus" size="18px" /> Adicionar ao vídeo master</button>
                <button v-if="signedIn && !generated.expired" class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="shareClip"><q-icon name="mdi-folder-plus-outline" size="18px" /> Salvar em projeto</button>
                <button v-if="!generated.expired && generated.file?.type === 'video/mp4'" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="clipVariation"><q-icon name="mdi-creation-outline" size="18px" /> Gerar variação</button>
                <button class="video-studio__icon" type="button" aria-label="Excluir clipe do projeto" :disabled="!mayEdit" @click="confirmDeleteClip = true"><q-icon name="mdi-delete-outline" size="20px" /></button>
              </div>
              <p v-if="generatedDuration > 15" class="video-studio__hint">Ao adicionar à sequência, o clipe é dividido em cenas de até 15 s.</p>
            </div>
            <div v-if="!generated || busy === 'video'" class="video-studio__clip-empty" role="status">
              <q-spinner v-if="busy === 'video'" size="30px" /><q-icon v-else name="mdi-filmstrip-box-multiple" size="32px" />
              <AitoVideoProgress v-if="busy === 'video'" :stage="activeJob?.status || 'submitting'" />
              <p v-else-if="activeJob">Geração pendente. Clique em Verificar geração para acompanhar.</p>
              <p v-else>Os vídeos gerados aparecem aqui.</p>
            </div>
        </section>

        <section v-else class="video-studio__panel video-studio__preview" aria-labelledby="video-studio-preview">
          <header><h2 id="video-studio-preview">Prévia</h2><span>{{ format.label }} · {{ durationLabel(timeline.duration) }}</span></header>
          <div class="video-studio__screen"><canvas ref="canvas" :width="format.width" :height="format.height" aria-label="Prévia da composição do vídeo" /></div>
          <div class="video-studio__actions" role="group" aria-label="Reproduzir">
            <button type="button" class="video-studio__secondary" :aria-pressed="previewMode === 'all'" @click="previewMode = 'all'">Vídeo master</button>
            <button type="button" class="video-studio__secondary" :disabled="!selectedScene" :aria-pressed="previewMode === 'scene'" @click="previewMode = 'scene'">Cena selecionada</button>
          </div>
          <div class="video-studio__transport"><button class="video-studio__icon" type="button" :disabled="!mayEdit || !timeline.duration" :aria-label="playing ? 'Pausar prévia' : 'Reproduzir prévia'" @click="play"><q-icon :name="playing ? 'mdi-pause' : 'mdi-play'" size="23px" /></button><input aria-label="Posição da prévia em segundos" type="range" :min="range.start" :max="range.end" step="0.1" :value="playhead" :disabled="!mayEdit || !timeline.duration" @input="seek($event.target.value)" /><span>{{ durationLabel(playhead - range.start) }} / {{ durationLabel(range.end - range.start) }}</span></div>
          <label>Formato da composição<select v-model="formatId" :disabled="!mayEdit"><option v-for="item in videoFormats" :key="item.id" :value="item.id">{{ item.title }} {{ item.label }}</option></select></label>
          <audio v-if="narration" v-show="tab === 'voice'" ref="audio" class="video-studio__audio" :src="narration.url" preload="metadata" controls aria-label="Ouvir locução" />
          <div v-if="canRecord" class="video-studio__fields video-studio__fields--equal">
            <label>Exportar<select v-model="exportScope" :disabled="Boolean(busy)"><option value="all">Vídeo master</option><option value="scene">Cena selecionada</option></select></label>
            <label>Arquivo<select v-model="exportFormat" :disabled="!mayEdit"><option v-for="item in exportFormats" :key="item.extension" :value="item.extension">{{ item.label }}</option></select></label>
            <label>Qualidade<select v-model="resolution" :disabled="Boolean(busy)"><option value="medium">Resolução média</option><option value="high">Resolução alta</option></select><small>{{ exportSize.width }} × {{ exportSize.height }} px</small></label>
          </div>
          <div class="video-studio__actions">
            <button class="video-studio__primary" type="button" :disabled="!canRecord || !mayEdit || Boolean(busy) || !timeline.duration" @click="renderVideo"><q-icon name="mdi-movie-open-outline" size="19px" /> {{ busy === 'render' ? 'Exportando…' : 'Exportar vídeo final' }}</button>
            <button v-if="busy === 'render'" class="video-studio__secondary" type="button" @click="activeOperation?.abort()">Cancelar</button>
            <a v-if="recording" class="video-studio__secondary" :href="recording.url" :download="recording.filename"><q-icon name="mdi-download-outline" size="19px" /> Baixar vídeo</a>
            <button v-if="subtitles" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="downloadSubtitles"><q-icon name="mdi-subtitles-outline" size="19px" /> Legendas SRT</button>
          </div>
          <q-linear-progress v-if="busy === 'render'" rounded :value="progress" color="teal-4" aria-label="Progresso de exportação" />
          <p v-else-if="!canRecord" class="video-studio__hint">A exportação de vídeo depende do suporte do navegador.</p>
          <video v-if="recording" class="video-studio__rendered" :src="recording.url" controls playsinline preload="metadata" aria-label="Vídeo exportado" />
          <p v-if="!signedIn" class="video-studio__hint"><q-icon name="mdi-shield-lock-outline" size="17px" /> Entre para salvar projetos por até 7 dias.</p>
        </section>
      </div>
    </main>
    <q-dialog v-model="inventoryOpen">
      <q-card class="aito-ai-theme video-studio__dialog">
        <q-card-section class="video-studio__scene-heading"><h2>Adicionar do projeto</h2><q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar lista de clipes" /></q-card-section>
        <q-card-section class="video-studio__dialog-list">
          <label>Buscar clipe ou projeto<input v-model="inventoryQuery" type="search" /></label>
          <label v-if="projects.length">Projeto<select v-model="inventoryProject"><option value="">Disponíveis neste navegador</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select></label>
          <p v-if="inventoryLoading" role="status" class="video-studio__hint">Carregando mídias do projeto…</p>
          <p v-else-if="inventoryError" role="alert" class="video-studio__hint">{{ inventoryError }}</p>
          <p v-else-if="!inventory.length" class="video-studio__hint">Nenhum clipe disponível neste projeto.</p>
          <div v-for="clip in inventory" :key="`${clip.projectId}:${clip.id}`" class="video-studio__inventory-item">
            <q-icon name="mdi-filmstrip" size="23px" /><span><strong>{{ clip.title || `Clipe ${clip.number}` }}</strong><small>{{ clip.project }} · Até {{ displayDate.format(clip.expiresAt) }}</small></span>
            <button type="button" class="video-studio__primary" :disabled="Boolean(busy)" @click="addGeneratedSequence(clip)"><q-icon name="mdi-playlist-plus" /> Adicionar</button>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="componentOpen">
      <q-card class="aito-ai-theme video-studio__dialog">
        <q-card-section class="video-studio__scene-heading"><h2>{{ componentType }}</h2><q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar componentes" /></q-card-section>
        <q-card-section class="video-studio__dialog-list">
          <template v-if="componentForm">
            <label>Nome<input :value="componentForm.title" maxlength="80" @input="updateComponentForm({ title: $event.target.value })" /></label>
            <label>Descrição ou prompt<textarea :value="componentForm.prompt" rows="3" maxlength="2000" @input="updateComponentForm({ prompt: $event.target.value })" /></label>
            <label>Imagem de referência<input type="file" accept="image/jpeg,image/png,image/webp" @change="fileFrom($event, setComponentImage)" /></label>
            <span v-if="componentForm.file" class="video-studio__hint">{{ componentForm.file.name }}</span>
            <div class="video-studio__actions">
              <button type="button" class="video-studio__secondary" @click="componentForm = null">Cancelar</button>
              <button type="button" class="video-studio__primary" :disabled="!componentForm.title.trim()" @click="saveComponent">Salvar componente</button>
            </div>
          </template>
          <template v-else>
            <label>Buscar componente<input v-model="inventoryQuery" type="search" /></label>
            <div class="video-studio__actions">
              <button type="button" class="video-studio__primary" @click="editComponent()"><q-icon name="mdi-plus" /> Novo componente</button>
              <button v-if="componentType === 'Cenas'" type="button" class="video-studio__secondary" @click="componentOpen = false; openInventory()">Ver clipes prontos</button>
            </div>
            <div v-if="componentTypes.indexOf(componentType) >= 5" class="video-studio__actions">
              <label>Renomear tipo<input v-model.trim="componentTypeName" maxlength="32" /></label>
              <button type="button" class="video-studio__secondary" :disabled="!componentTypeName" @click="changeCustomType(0, true)">Renomear</button>
              <button type="button" class="video-studio__icon" aria-label="Mover tipo para cima" @click="changeCustomType(-1)"><q-icon name="mdi-chevron-up" /></button>
              <button type="button" class="video-studio__icon" aria-label="Mover tipo para baixo" @click="changeCustomType(1)"><q-icon name="mdi-chevron-down" /></button>
            </div>
            <div v-for="item in matchingComponents" :key="item.id" class="video-studio__inventory-item">
              <img v-if="componentPosters.has(item.file)" :src="componentPosters.get(item.file)" class="video-studio__component-thumb" alt="" loading="lazy" /><q-icon v-else name="mdi-image-text" size="23px" />
              <span><strong>{{ item.title }}</strong><small>{{ item.prompt }}</small></span>
              <button type="button" class="video-studio__secondary" @click="useComponent(item)">Usar</button>
              <button type="button" class="video-studio__secondary" @click="useComponent(item, true)">Gerar variação</button>
              <button type="button" class="video-studio__icon" :aria-label="`Editar ${item.title}`" @click="editComponent(item)"><q-icon name="mdi-pencil-outline" /></button>
              <button type="button" class="video-studio__icon" :aria-label="`Excluir ${item.title}`" @click="projectComponents = projectComponents.filter(row => row.id !== item.id)"><q-icon name="mdi-delete-outline" /></button>
            </div>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="confirmDeleteClip">
      <q-card class="aito-ai-theme video-studio__dialog">
        <q-card-section><h2>Excluir clipe do projeto?</h2><p>{{ clipReferences ? `${clipReferences} cena(s) do vídeo master continuam usando a mídia até expirar. As cópias usadas em outros projetos permanecem disponíveis pelo prazo original.` : 'O clipe sairá da biblioteca deste projeto. As cópias usadas em outros projetos permanecem disponíveis pelo prazo original.' }}</p></q-card-section>
        <q-card-actions align="right"><q-btn v-close-popup flat no-caps label="Cancelar" /><q-btn v-close-popup unelevated no-caps color="red-9" label="Excluir" @click="removeGenerated" /></q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="saveClipOpen" :persistent="savingClip">
      <q-card class="aito-ai-theme video-studio__dialog">
        <q-card-section><h2>Salvar clipe em projeto</h2><label>Projeto
          <select v-model="destinationProject" :disabled="savingClip">
            <option value="new">Criar novo projeto</option>
            <option v-for="project in projects.filter(item => item.id !== activeId)" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select>
        </label></q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancelar" :disable="savingClip" />
          <q-btn unelevated no-caps color="teal-8" label="Salvar" :loading="savingClip" @click="saveClipInProject" />
        </q-card-actions>
      </q-card>
    </q-dialog>
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
.video-studio__brand, .video-studio__mode, .video-studio__account, .video-studio__balance { display: flex; align-items: center; }
.video-studio__brand { width: max-content; gap: 6px; color: var(--aito-ai-text); font-size: 1.12rem; }
.video-studio__mode { justify-content: center; }
.video-studio__account { justify-self: end; gap: 8px; }
.video-studio__balance { gap: 6px; min-height: 36px; padding: 4px 7px; border: 1px solid var(--aito-ai-gold-line); border-radius: 8px; background: var(--aito-ai-gold-soft); color: var(--aito-ai-gold); cursor: pointer; white-space: nowrap; }
.video-studio__login, .video-studio__icon { border: 0; padding: 5px; border-radius: 7px; background: transparent; color: var(--aito-ai-muted); cursor: pointer; }
.video-studio__icon { display: inline-grid; width: 35px; height: 35px; place-items: center; }
.video-studio__icon:not(:disabled):hover, .video-studio__login:hover { color: var(--aito-ai-accent); background: var(--aito-ai-raised); }
.video-studio__main { width: min(1660px, 100%); margin: 0 auto; padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 36px) 45px; }
.video-studio__intro { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 25px; }
.video-studio__intro h1 { font-size: clamp(2rem, 4vw, 3.15rem); line-height: 1.05; font-weight: 780; letter-spacing: -.045em; }
.video-studio__intro p { margin-top: 10px; color: var(--aito-ai-muted); }
.video-studio__zip { display: grid; gap: 5px; justify-items: end; }
.video-studio__grid { display: grid; grid-template-columns: clamp(176px, 17%, 238px) minmax(0, 1.18fr) minmax(0, .82fr); align-items: start; gap: 14px; }
.video-studio__panel { min-width: 0; border: 1px solid var(--aito-ai-line); border-radius: 16px; background: var(--aito-ai-surface); }
.video-studio__sidebar { grid-column: 1; grid-row: 1 / span 4; padding: 11px; }
.video-studio__sidebar-content, .video-studio__sidebar-components { display: grid; min-width: 0; gap: 9px; }
.video-studio__sidebar-components { margin-top: 5px; padding-top: 11px; border-top: 1px solid var(--aito-ai-line); }
.video-studio__sidebar-components .video-studio__secondary { width: 100%; justify-content: flex-start; }
.video-studio__sidebar-toggle { display: none; }
.video-studio__editor { grid-column: 3; grid-row: 2; overflow: hidden; }
.video-studio__tabs { grid-column: 2 / -1; grid-row: 1; display: grid; width: min(620px, 100%); grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 7px; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-panel); }
.video-studio__tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--aito-ai-muted); cursor: pointer; white-space: nowrap; }
.video-studio__tabs button[aria-pressed=true] { border-color: var(--aito-ai-line); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); font-weight: 650; }
.video-studio__section, .video-studio__preview { display: grid; gap: 14px; padding: clamp(13px, 2vw, 20px); }
.video-studio__preview { grid-column: 2; grid-row: 2; }
.video-studio__grid--generate .video-studio__editor { grid-column: 2; grid-row: 3; }
.video-studio__preview--clips { grid-column: 3; grid-row: 3; }
.video-studio__scene-heading, .video-studio__preview header, .video-studio__audio-meta { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.video-studio h2 { font-size: 1.13rem; font-weight: 730; line-height: 1.2; }
.video-studio h3 { font-size: 1rem; font-weight: 700; line-height: 1.2; }
.video-studio__preview header span, .video-studio__hint, .video-studio__script small { color: var(--aito-ai-muted); font-size: .84rem; }
.video-studio__fields { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, .9fr); gap: 10px; }
.video-studio__fields--clip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.video-studio__catalog { grid-column: 2 / -1; grid-row: 2; min-width: 0; display: grid; gap: 12px; }
.video-studio__catalog-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.video-studio__catalog-header p { margin-top: 4px; color: var(--aito-ai-muted); font-size: .9rem; }
.video-studio__catalog-models { padding: 9px 12px; border: 1px solid var(--aito-ai-line); border-radius: 11px; background: var(--aito-ai-surface); }
.video-studio__catalog-models summary { cursor: pointer; color: var(--aito-ai-muted); }
.video-studio__catalog-models summary strong { margin-inline-start: 8px; color: var(--aito-ai-accent); }
.video-studio__catalog-models[open] summary { margin-bottom: 11px; }
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
.video-studio__timeline { grid-column: 2 / -1; grid-row: 3; display: grid; min-width: 0; gap: 10px; padding: 12px clamp(13px, 2vw, 20px); }
.video-studio__grid--generate .video-studio__timeline { grid-row: 4; }
.video-studio__scenes { display: flex; overflow-x: auto; gap: 8px; padding: 3px 2px 5px; }
.video-studio__scenes button { display: flex; flex: 0 0 clamp(126px, 18vw, 178px); align-items: center; gap: 7px; min-width: 0; padding: 6px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); cursor: pointer; text-align: left; }
.video-studio__scene-thumb { display: grid; flex: 0 0 43px; height: 34px; place-items: center; overflow: hidden; border-radius: 5px; background: var(--aito-ai-bg); }
.video-studio__scene-thumb img { width: 100%; height: 100%; object-fit: cover; }
.video-studio__scene-label { display: grid; min-width: 0; gap: 1px; }
.video-studio__scene-label strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .84rem; }
.video-studio__scene-label small { font-size: .72rem; }
.video-studio__scenes button[aria-pressed=true] { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.video-studio__scenes .video-studio__scene-drop { border-color: var(--aito-ai-gold); box-shadow: -3px 0 var(--aito-ai-gold); }
.video-studio__drop { display: flex; width: 100%; align-items: center; gap: 9px; padding: 12px; border: 1px dashed var(--aito-ai-accent-strong); border-radius: 9px; color: var(--aito-ai-accent); background: var(--aito-ai-panel); text-align: left; cursor: pointer; }
.video-studio__drop span { min-width: 0; overflow-wrap: anywhere; }
.video-studio__drop small { display: block; margin-top: 3px; color: var(--aito-ai-muted); }
.video-studio__transition { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 10px; }
.video-studio__transition-clip { min-width: 0; display: grid; align-content: start; gap: 7px; }
.video-studio__transition-clip .video-studio__drop { position: relative; }
.video-studio__transition-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.video-studio__transition-clip .video-studio__drop:focus-within { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
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
.video-studio__clip-empty { display: grid; min-height: 160px; gap: 8px; padding: 14px; align-content: center; justify-items: center; border: 1px dashed var(--aito-ai-line); border-radius: 10px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); text-align: center; }
.video-studio__generation-modes, .video-studio__clip-list { display: flex; flex-wrap: wrap; gap: 7px; }
.video-studio__generation-modes { margin: 0 0 10px; }
.video-studio__generation-modes [aria-pressed=true], .video-studio__clip-list [aria-pressed=true] { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.video-studio__reference, .video-studio__analysis { display: grid; gap: 8px; min-width: 0; }
.video-studio__reference-images { display: flex; flex-wrap: wrap; gap: 6px; }
.video-studio__reference-images div { position: relative; }
.video-studio__reference-images img { display: block; width: 90px; height: 68px; border: 1px solid var(--aito-ai-line); border-radius: 7px; object-fit: cover; }
.video-studio__reference-images > img { width: min(44%, 190px); height: auto; aspect-ratio: 16 / 9; }
.video-studio__reference-images button { position: absolute; inset: 3px 3px auto auto; background: var(--aito-ai-bg); }
.video-studio__analysis { padding: 10px; border: 1px solid var(--aito-ai-purple-line); border-radius: 8px; background: var(--aito-ai-purple-soft); }
.video-studio__analysis p { max-height: 240px; overflow: auto; overflow-wrap: anywhere; white-space: pre-wrap; }
.video-studio__analysis button { justify-self: start; }
.video-studio__generated video, .video-studio__rendered, .video-studio__reference-preview { display: block; width: 100%; max-height: 420px; border-radius: 8px; background: var(--aito-ai-bg); }
.video-studio__reference-preview { max-height: 220px; }
@media (max-width: 960px) { .video-studio__model-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.video-studio__dialog { width: min(620px, 95vw); background: var(--aito-ai-surface); color: var(--aito-ai-text); }
.video-studio__dialog h2 { margin: 0 0 8px; font-size: 1.15rem; }
.video-studio__dialog-list { display: grid; gap: 10px; }
.video-studio__dialog label { display: grid; gap: 5px; }
.video-studio__dialog input, .video-studio__dialog textarea, .video-studio__dialog select { padding: 9px; min-width: 0; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-bg); }
.video-studio__inventory-item { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 8px 4px; border-bottom: 1px solid var(--aito-ai-line); }
.video-studio__inventory-item span { display: grid; flex: 1; min-width: 95px; overflow-wrap: anywhere; color: var(--aito-ai-muted); }
.video-studio__inventory-item span strong { color: var(--aito-ai-text); }
.video-studio__component-thumb { width: 48px; height: 42px; border-radius: 6px; object-fit: cover; }
.video-studio__actions [aria-pressed=true] { color: var(--aito-ai-accent); border-color: var(--aito-ai-accent-strong); }
.video-studio__draft { flex-wrap: wrap; }
@media (max-width: 900px) {
  .video-studio__grid, .video-studio__grid--generate { grid-template-columns: minmax(0, 1fr); }
  .video-studio__grid > * { grid-column: 1 !important; grid-row: auto !important; }
  .video-studio__sidebar { order: 0; }
  .video-studio__sidebar-toggle { display: inline-flex; width: 100%; }
  .video-studio__sidebar-content { display: none; margin-top: 10px; }
  .video-studio__sidebar-content--open { display: grid; }
  .video-studio__tabs { order: 1; }
  .video-studio__catalog { order: 2; }
  .video-studio__preview { order: 3; }
  .video-studio__timeline { order: 4; }
  .video-studio__editor { order: 5; }
  .video-studio__grid--generate .video-studio__editor { order: 3; }
  .video-studio__preview--clips { order: 4; }
  .video-studio__grid--generate .video-studio__timeline { order: 5; }
}
@media (max-width: 640px) { .video-studio__model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .video-studio__model-content { padding-inline: 5px; } }
@media (max-width: 560px) { .video-studio__bar { grid-template-columns: 1fr auto; padding: 7px 10px; gap: 6px; } .video-studio__mode { grid-row: 2; grid-column: 1 / -1; } .video-studio__intro { align-items: flex-start; flex-direction: column; } .video-studio__tabs button { font-size: .8rem; } .video-studio__tabs :deep(.q-icon) { font-size: 17px !important; } }
</style>
