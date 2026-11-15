<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import AitoIAModeSwitch from 'components/AitoIAModeSwitch.vue'
import AitoStudioProjectPicker from 'components/AitoStudioProjectPicker.vue'
import AitoStudioVideoRemake from 'components/AitoStudioVideoRemake.vue'
import AitoVideoProgress from 'components/AitoVideoProgress.vue'
import { aitoTokenCost, aitoTokens, useAitoIA } from 'src/composables/useAitoIA'
import { useAitoStudioProjects } from 'src/composables/useAitoStudioProjects'
import { useAitoWorkGuard } from 'src/composables/useAitoWorkGuard'
import { videoCatalog } from 'src/data/aitoiaVideoCatalog'
import { readAnswer } from 'src/services/aitoiaChat'
import { downloadAitoIAFile, zipAitoIAFiles } from 'src/services/aitoiaArchive'
import { readStudioProject } from 'src/services/aitoiaStudioArchive'
import { AITOIA_RETENTION_MS } from 'src/services/aitoiaLocal'
import { clearVideoDraft, readVideoDraft } from 'src/services/aitoiaVideoDraft'
import { closeStudioMedia, cutDuration, cutStudioScene, drawStudioFrame, maxStudioScenes, openStudioMedia,
  recordStudioVideo, sceneSeconds, splitStudioClip, studioFrame, studioNarration, studioRenderSize, studioSubtitles, studioTimeline, studioVideoExports, videoFormats } from 'src/services/aitoiaVideo'
import { cleanSceneScript, normalizeVoiceReference, parseVideoPlan, sceneScriptSeconds, studioAiSeconds, voiceComponentType } from 'src/services/aitoiaVideoPlan'
import { captureTransitionFrame, checkImageReference, checkVideoReference, putImageReference, putVideoReference, putVoiceReference, readGeneratedClipForJob, safeVideoUrl, sampleVideoFrames } from 'src/services/aitoiaVideoRemote'
import 'src/css/aitoia-theme.css'

const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const AitoIAWallet = defineAsyncComponent(() => import('components/AitoIAWallet.vue'))
useMeta({ title: 'AitoIA | Estúdio de vídeo', meta: { description: { name: 'description', content: 'Crie roteiros, narrações e vídeos com AitoIA. Monte cenas e exporte no navegador.' } } })
const wallet = useAitoIA({ chatHistory: false, allowAdmin: true })
const { signedIn, adminMode, status, walletId, accountId, models } = wallet
const route = useRoute()
const authOpen = ref(false)
const authMode = ref('register')
const walletOpen = ref(false)
const tabs = [
  { id: 'scenes', label: 'Cenas', icon: 'mdi-view-dashboard-outline' },
  { id: 'voice', label: 'Locução', icon: 'mdi-waveform' },
  { id: 'ai', label: 'Vídeo com IA', icon: 'mdi-movie-open-play-outline' },
]
const defaultProjectName = 'Projeto Sem Nome'
const defaultProjectColor = '#13BC9D'
const title = ref(defaultProjectName)
const projectTitle = computed(() => title.value.trim() || defaultProjectName)
const projectColor = ref(defaultProjectColor)
const projectColorOpen = ref(false)
const tab = ref(route.query.tab === 'ai' ? 'ai' : 'scenes')
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
const masterScript = ref('')
const sceneScripts = shallowRef([])
const scriptOpen = ref(false)
const scriptTarget = shallowRef(null)
const scriptError = ref('')
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
const remakeDraft = shallowRef(null)
const remakeRevision = ref(0)
const remakeEditor = ref(null)
const builtInComponentNames = {
  Personagens: 'Personagem',
  Cenas: 'Cena',
  'Modelos de cena': 'Modelo de cena',
  Cenários: 'Cenário',
  Roteiros: 'Roteiro',
  [voiceComponentType]: 'Voz',
}
const builtInComponentTypes = Object.keys(builtInComponentNames)
const componentTypes = ref([...builtInComponentTypes])
const componentIcons = {
  Personagens: 'mdi-account-outline',
  Cenas: 'mdi-filmstrip',
  'Modelos de cena': 'mdi-view-dashboard-outline',
  Cenários: 'mdi-image-outline',
  Roteiros: 'mdi-script-text-outline',
  [voiceComponentType]: 'mdi-waveform',
}
const componentType = ref('Cenas')
const componentName = computed(() => Object.hasOwn(builtInComponentNames, componentType.value)
  ? builtInComponentNames[componentType.value] : componentType.value)
const componentOpen = ref(false)
const componentForm = shallowRef(null)
const editingComponent = ref(false)
const componentPosters = shallowRef(new Map())
const isRemakeReference = item => item.type === 'Personagens' || item.type === 'Cenários'
const remakeReferences = computed(() => projectComponents.value
  .filter(isRemakeReference)
  .map(item => ({ ...item, url: componentPosters.value.get(item.file) || '' })))
const componentVoicePreview = ref('')
const componentError = ref('')
const componentLoading = ref(false)
const voiceComponents = computed(() => projectComponents.value.filter(item => item.type === voiceComponentType && item.file))
const voiceReferenceId = ref('')
const voiceReference = computed(() => voiceComponents.value.find(item => item.id === voiceReferenceId.value))
const acceptsVoiceReference = computed(() => selectedConfig.value?.audioReference === true)
const componentTypeName = ref('')
const confirmDeleteClip = ref(false)
const saveClipOpen = ref(false)
const destinationProject = ref('')
const savingClip = ref(false)
const projectsOpen = ref(false)
const masterOpen = ref(true)
const modelListOpen = ref(true)
const studioHeader = ref(null)
const workspace = ref(null)
const headerHeight = ref(104)
let headerObserver
const draft = shallowRef(null)
const dragItem = ref(null)
const dragTarget = ref(null)
const history = shallowRef([])
const sourceFrames = shallowRef([])
const insertionAfter = ref(null)
const timelineTransition = shallowRef(null)
const transitionDialogOpen = ref(false)
const transitionFileInput = ref(null)
const maxTimelineTransitionFiles = 5
const transitionDialogOffer = computed(() => options.value?.transitionModel?.options.find(item =>
  item.format === format.value.label && item.resolution === '720p' && item.seconds === 3))
const progress = ref(0)
const busy = ref('')
const error = ref('')
const notice = ref('')
const options = shallowRef(null)
const optionsLoading = ref(false)
const optionsError = ref('')
const voice = ref('')
const videoModel = ref('')
const referenceModelId = ref('')
const videoOption = ref('')
const generationMode = ref('text')
const reference = shallowRef(null)
const referenceImages = shallowRef([])
const transitionClips = shallowRef([null, null])
const transitionLabels = ['1. Clipe de saída', '2. Clipe de entrada']
const referenceAnalysis = ref('')
const videoQuote = shallowRef(null)
const tokenCost = cents => aitoTokenCost(cents, status.value?.aitoTokensPerUsd)
const quoteCost = computed(() => tokenCost(videoQuote.value?.billedUsdCents))
const reservedCost = computed(() => tokenCost(generated.value?.reservedUsdCents))
const generationModes = [
  { id: 'text', label: 'Criar por texto', icon: 'mdi-text-box-outline' },
  { id: 'edit', label: 'Editar vídeo-base', icon: 'mdi-filmstrip-box-multiple' },
  { id: 'reference', label: 'Remixar com referência', icon: 'mdi-movie-open-edit-outline' },
  { id: 'transition', label: 'Transição entre vídeos', icon: 'mdi-transition' },
  { id: 'continuation', label: 'Continuar cena', icon: 'mdi-movie-open-outline' },
  { id: 'genjutsu', label: 'Genjutsu', icon: 'mdi-motion-play-outline' },
  { id: 'genjutsu-light', label: 'Genjutsu Light', icon: 'mdi-motion-play-outline' },
  { id: 'remake', label: 'Refazer vídeos', icon: 'mdi-movie-roll' },
]
const clipPrompt = ref(null)
const transitionMode = computed(() => generationMode.value === 'transition')
const continuationMode = computed(() => generationMode.value === 'continuation')
const remakeMode = computed(() => generationMode.value === 'remake')
const remakeBusy = ref(false)
const videoModelConfig = computed(() => options.value?.videoModels?.find(item => item.id === videoModel.value))
const modelOffers = computed(() => new Map((options.value?.videoModels || []).map(item => [item.id, item.options])))
const studioOffers = model => (model?.options || []).filter(item => model.sourceDuration || studioAiSeconds.includes(item.seconds))
const referenceChoices = computed(() => (options.value?.referenceModels || [])
  .filter(item => item.mode === generationMode.value && studioOffers(item).length))
const referenceModel = computed(() => transitionMode.value ? options.value?.transitionModel :
  referenceChoices.value.find(item => item.id === referenceModelId.value) || referenceChoices.value[0])
const selectedConfig = computed(() => generationMode.value === 'text' ? videoModelConfig.value : referenceModel.value)
const minimumImageReferences = computed(() => selectedConfig.value?.minImageReferences ?? (referenceModel.value?.sourceDuration ? 1 : 0))
const supportsVideoReference = computed(() => selectedConfig.value?.supportsVideo !== false)
const hasReference = computed(() => Boolean(reference.value || referenceImages.value.length || (acceptsVoiceReference.value && voiceReference.value)))
const maxImageReferences = computed(() => transitionMode.value ? (sourceFrames.value.length ? 8 : 0) :
  selectedConfig.value?.maxImageReferences ?? 0)
const canQuoteVideo = computed(() => Boolean(offer.value && (prompt.value.trim() || referenceModel.value?.sourceDuration) &&
  (transitionMode.value ? sourceFrames.value.length === 2 || transitionClips.value.every(Boolean) :
    continuationMode.value ? sourceFrames.value.length === 1 :
      (generationMode.value === 'text' || hasReference.value) &&
      (!referenceModel.value?.requiresVideo || reference.value) && (!reference.value || supportsVideoReference.value) &&
      referenceImages.value.length >= minimumImageReferences.value && referenceImages.value.length <= maxImageReferences.value)))
const modelOptions = computed(() => studioOffers(selectedConfig.value))
const offer = computed(() => modelOptions.value.find(item => item.id === videoOption.value) || modelOptions.value[0])
const selectedModel = computed(() => generationMode.value === 'text'
  ? videoCatalog.find(item => item.id === videoModel.value) || (selectedConfig.value && { name: selectedConfig.value.label })
  : referenceModel.value && { name: referenceModel.value.label })
const selectedReferenceVariant = computed(() => generationMode.value === 'text' && (options.value?.referenceModels || [])
  .find(model => model.familyId === videoModel.value && model.mode === 'reference' && studioOffers(model).length))
const modelCards = computed(() => videoCatalog.map(item => {
  const textModel = options.value?.videoModels?.find(model => model.id === item.id)
  const family = item.familyId || item.id
  const references = (options.value?.referenceModels || []).filter(model => model.mode !== 'continuation' &&
    (model.familyId ? model.familyId === family : model.id === family || model.id === `${family}-reference` || model.id === `${family}-edit`))
  const preferred = references.find(model => model.id === item.referenceId)
  const configuration = [textModel, preferred, ...references].find(model => studioOffers(model).length)
  const available = Boolean(configuration)
  const rates = studioOffers(configuration).map(option => option.priceUsdCents / option.seconds).filter(Number.isFinite)
  const perSecond = rates.length ? tokenCost(Math.min(...rates)) : ''
  const chatOptions = [textModel, ...references].flatMap(model => model?.options || []).filter(option => option.seconds > 5)
  const availability = item.limitation ? 'Fora do Estúdio' : available ? configuration.requiresVideo ? 'Requer vídeo-base'
    : configuration.minImageReferences ? 'Requer imagem' : configuration.mode ? 'Vídeo com referência' : 'Texto para vídeo'
    : chatOptions.length ? `A partir de ${Math.min(...chatOptions.map(option => option.seconds))} s · use Vídeo no chat`
      : !signedIn.value ? 'Entre para usar' : optionsLoading.value ? 'Consultando' : 'Indisponível na API'
  return { ...item, configuration, available, perSecond, availability, selectable: available || (!signedIn.value && !item.limitation) }
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
const voiceCost = computed(() => narrationText.value.trim() && tokenCost(speechPrice(narrationText.value)))
const paceLabels = { 0.85: 'Pausada', 1: 'Natural', 1.15: 'Dinâmica' }
const selectedVoice = computed(() => options.value?.voices?.find(item => item.id === voice.value))
const baseVoices = computed(() => options.value?.voices?.filter(item => item.id === (item.base || item.id)) || [])
const voicePaces = computed(() => options.value?.voices?.filter(item => item.base && item.base === selectedVoice.value?.base) || [])
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
const mayEdit = computed(() => !remakeBusy.value && (!busy.value || ['video', 'render'].includes(busy.value)) && !projectLoading.value && (!signedIn.value || Boolean(accountId.value)))
const guarded = computed(() => Boolean(busy.value || remakeBusy.value))
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
  if (previous) activeOperation?.abort()
  optionsRequest?.abort()
  if (next && signedIn.value) loadOptions()
  else { options.value = null; optionsLoading.value = false }
})

const { projects, records, activeId, loading: projectLoading, storageError, cloudState, createProject, openProject,
  resolveProject, deleteProject, renewProject, importProject, atLimit, saveProject } = useAitoStudioProjects({
  studio: 'video', accountId, localOnly: adminMode, busy, defaultName: defaultProjectName, snapshot: snapshotProject, restore: restoreProject,
  watch: [title, projectColor, formatId, scenes, sceneId, narrationText, narration, scriptPrompt, masterScript, sceneScripts, scriptTarget,
    voiceReferenceId, prompt, generationMode, videoModel, referenceModelId,
    reference, referenceImages, transitionClips, sourceFrames, insertionAfter, referenceAnalysis, clipLibrary, generated, recording,
    activeJob, projectComponents, componentTypes, remakeDraft],
})

function importArchive(file) {
  return importProject(options => readStudioProject(file, 'video', options))
}

function showAuth(mode = 'register') { authMode.value = mode; authOpen.value = true }
const compactViewport = () => window.matchMedia('(max-width: 900px)').matches
function closeMobilePanel(panel) {
  if (compactViewport()) panel.value = false
}
function chooseProject(id) {
  closeMobilePanel(projectsOpen)
  return id ? openProject(id) : createProject()
}
function chooseEditorTab(value) {
  if (value === 'ai' && tab.value !== 'ai') {
    modelListOpen.value = true
  }
  tab.value = value
  if (compactViewport() && workspace.value?.getBoundingClientRect().top < headerHeight.value) {
    workspace.value.scrollIntoView({ block: 'start' })
  }
}
function selectMasterScene(id) {
  selectScene(id)
  chooseEditorTab('scenes')
  closeMobilePanel(masterOpen)
}
function selectVideoModel(item) {
  const mode = item.configuration?.mode || item.mode || 'text'
  changeGenerationMode(mode)
  if (mode === 'text') videoModel.value = item.configuration?.id || item.id
  else referenceModelId.value = item.configuration?.id || ''
  nextTick(() => clipPrompt.value?.focus())
}
function selectReferenceVariant() {
  const model = selectedReferenceVariant.value
  if (!model) return
  changeGenerationMode(model.mode)
  referenceModelId.value = model.id
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
  closeMobilePanel(masterOpen)
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
const componentVideo = item => item.file?.type.startsWith('video/')
const missingArchiveItems = computed(() => scenes.value.filter(unavailableScene).length +
  clipLibrary.value.filter(clip => clip.expired || !clip.file).length)
function openComponents(type) {
  closeMobilePanel(projectsOpen)
  componentType.value = type
  inventoryQuery.value = ''
  componentForm.value = null
  componentError.value = ''
  componentOpen.value = true
}
function editComponent(item) {
  editingComponent.value = Boolean(item)
  componentError.value = ''
  componentForm.value = item ? { ...item } : { id: crypto.randomUUID(), type: componentType.value, title: '', prompt: '', file: null }
}
function updateComponentForm(values) { componentForm.value = { ...componentForm.value, ...values } }
function saveComponent() {
  const item = componentForm.value
  if (!item.title.trim() || (item.type === voiceComponentType && !item.file)) return
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
watch(() => componentForm.value?.file, file => {
  if (componentVoicePreview.value) URL.revokeObjectURL(componentVoicePreview.value)
  componentVoicePreview.value = file?.type.startsWith('audio/') ? URL.createObjectURL(file) : ''
}, { flush: 'sync' })
function setComponentImage(file) {
  if (!file) return
  try { checkImageReference(file); updateComponentForm({ file }); componentError.value = '' }
  catch (cause) { componentError.value = cause.message }
}
async function setComponentVoice(file) {
  if (!file) return
  const id = componentForm.value?.id
  componentLoading.value = true
  componentError.value = ''
  try {
    const audio = await normalizeVoiceReference(file)
    if (componentOpen.value && componentForm.value?.id === id) updateComponentForm({ file: audio })
  } catch (cause) { componentError.value = cause.message }
  finally { componentLoading.value = false }
}
function removeComponent(item) {
  if (voiceReferenceId.value === item.id) voiceReferenceId.value = ''
  projectComponents.value = projectComponents.value.filter(row => row.id !== item.id).map(row =>
    row.voiceId === item.id ? { ...row, voiceId: '' } : row)
  sceneScripts.value = sceneScripts.value.map(scene => ({ ...scene, componentIds: scene.componentIds.filter(id => id !== item.id) }))
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
  if (index < builtInComponentTypes.length) return
  const next = [...componentTypes.value]
  if (rename) {
    const name = componentTypeName.value.trim()
    if (!name || next.includes(name)) return
    next[index] = name
    projectComponents.value = projectComponents.value.map(item => item.type === componentType.value ? { ...item, type: name } : item)
    componentType.value = name
    componentTypeName.value = ''
  } else {
    if (!next[index + delta] || index + delta < builtInComponentTypes.length) return
    next.splice(index + delta, 0, next.splice(index, 1)[0])
  }
  componentTypes.value = next
}
function useComponent(item, variation = false) {
  if (remakeMode.value && isRemakeReference(item) && !variation) {
    chooseEditorTab('ai')
    if (remakeEditor.value?.addProjectReference(item.id)) {
      error.value = ''
      notice.value = `${item.title} foi adicionado às referências do prompt master em Refazer vídeos.`
    }
    componentOpen.value = false
    return
  }
  if (remakeMode.value) changeGenerationMode('text')
  if (componentVideo(item)) {
    componentOpen.value = false
    if (!variation) { addGeneratedSequence(item); return }
    chooseReference(item.file)
    if (reference.value?.file !== item.file) return
    changeGenerationMode('edit')
  }
  chooseEditorTab('ai')
  const sample = item.type === voiceComponentType ? item : voiceComponents.value.find(voice => voice.id === item.voiceId)
  if (sample && modelOffers.value.get('seedance-2.5')?.length) {
    changeGenerationMode('text')
    videoModel.value = 'seedance-2.5'
    voiceReferenceId.value = sample.id
  }
  if (item.file && item.type !== voiceComponentType && !componentVideo(item)) chooseReferenceImages([item.file])
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
  if (fresh) {
    if (atLimit.value) { error.value = 'Exclua um projeto para criar outro.'; return }
    const previous = activeId.value
    await createProject()
    if (activeId.value === previous) return
  }
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
    const { data } = await wallet.access().get('/aitoia/video/options', { signal: controller.signal })
    if (controller.signal.aborted) return
    options.value = data.data
    if (!options.value?.voices?.some(item => item.id === voice.value)) voice.value = options.value?.voices?.[0]?.id || ''
    const available = (options.value?.videoModels || []).filter(model => studioOffers(model).length)
    if (!available.some(model => model.id === videoModel.value)) {
      videoModel.value = available.find(model => model.id === 'kling-4.0-flash')?.id || available[0]?.id || ''
    }
    restoreJob()
  } catch (cause) {
    if (!controller.signal.aborted) optionsError.value = cause.response?.data?.message || 'Não foi possível consultar o catálogo.'
  } finally { if (optionsRequest === controller) optionsLoading.value = false }
}
watch(modelOptions, list => { if (!list.some(item => item.id === videoOption.value)) videoOption.value = list[0]?.id || '' })
watch([generationMode, videoModel, referenceModel, videoOption, prompt, reference, referenceImages, voiceReference, transitionClips, sourceFrames, walletId], () => { videoQuote.value = null })
function jobStorage(change) {
  try {
    const saved = JSON.parse(localStorage.getItem(jobStorageKey) || '{}')
    const now = Date.now()
    const entries = Object.fromEntries(Object.entries(saved).filter(([id, item]) => /^(?:admin:)?[a-f0-9]{24}$/i.test(id) &&
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
      afterSceneId: job.afterSceneId, kind: job.kind, scriptTarget: job.scriptTarget, timelineTransition: job.timelineTransition,
    }
  })
}
function restoreJob() {
  if (!accountId.value || !activeId.value || projectLoading.value || activeJob.value) return
  const saved = jobStorage(entries => entries[accountId.value])
  if (saved?.finished || saved?.projectId && saved.projectId !== activeId.value) return
  const recoverable = saved || options.value?.recoverableGeneration
  if (recoverable?.id && !clipLibrary.value.some(clip => clip.id === recoverable.id)) {
    activeJob.value = { id: recoverable.id, status: 'queued', afterSceneId: recoverable.afterSceneId, kind: recoverable.kind,
      scriptTarget: recoverable.scriptTarget, timelineTransition: recoverable.timelineTransition }
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
  if (!file) return
  closeMobilePanel(masterOpen)
  run('media', signal => insertClip(file, signal))
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
  const edit = timeline.value
  const segment = exportScope.value === 'scene' ? edit.segments.find(item => item.scene.id === sceneId.value) : null
  const mimeType = exportFormats.value.find(item => item.extension === exportFormat.value)?.mime
  await renderStudioEdit(edit, segment, { mimeType, narrationFile: narration.value?.file,
    onRendered(result) { updateRecording(result); notice.value = 'Seu vídeo está pronto para baixar.' } })
}

function downloadSelectedScene() {
  const scene = selectedScene.value
  const segment = selectedSegment.value
  if (!mayEdit.value || busy.value || !scene?.media?.file || !segment || unavailableScene(scene)) return
  const { file, isVideo, element } = scene.media
  const basename = `cena-${String(scenes.value.indexOf(scene) + 1).padStart(2, '0')}`
  const duration = segment.end - segment.start
  if (!isVideo || (!(scene.offset > .001) && Math.abs(element.duration - duration) < .04)) {
    downloadAitoIAFile(file, file.name || basename)
    return
  }
  const selected = exportFormats.value.find(item => item.extension === exportFormat.value) || exportFormats.value[0]
  if (!selected) { error.value = 'Este navegador não consegue exportar o recorte. Tente no Chrome ou Edge atualizado.'; return }
  void renderStudioEdit(timeline.value, segment, { mimeType: selected.mime,
    onRendered: result => downloadAitoIAFile(result, `${basename}.${selected.extension}`) })
}

async function renderStudioEdit(edit, segment, { mimeType, narrationFile, dimensions = exportSize.value, signal: outerSignal, onRendered }) {
  const start = segment?.start || 0
  const duration = segment ? segment.end - segment.start : edit.duration
  const sourceSegments = segment ? [segment] : edit.segments
  const expired = sourceSegments.find(({ scene }) => unavailableScene(scene))
  if (expired) { error.value = `Substitua ou remova a mídia da cena “${expired.scene.heading || (edit.segments.indexOf(expired) + 1)}” antes de exportar.`; return }
  const render = async signal => {
    const output = document.createElement('canvas')
    output.width = dimensions.width
    output.height = dimensions.height
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
      if (mounted && !signal.aborted) onRendered(result)
    } finally { opened.forEach(closeStudioMedia) }
  }
  if (outerSignal) await render(outerSignal)
  else await run('render', render)
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
function openProjectScript() {
  closeMobilePanel(projectsOpen)
  scriptError.value = ''
  scriptOpen.value = true
}
function updateScriptScene(id, values) {
  sceneScripts.value = sceneScripts.value.map(item => item.id === id ? cleanSceneScript({ ...item, ...values }) : item)
}
function addScriptScene() {
  if (sceneScripts.value.length < maxStudioScenes) sceneScripts.value = [...sceneScripts.value, cleanSceneScript()]
}
async function writeProjectScript(mode, item) {
  if (!useCredits()) return
  scriptError.value = ''
  await run('script', async signal => {
    try {
      const model = models.value.find(model => /mini/i.test(model.id)) ||
        models.value.find(model => model.id === 'gpt-6.1-sol') || models.value[0]
      if (!model) throw new Error('O roteiro com IA está temporariamente indisponível.')
      const components = projectComponents.value.slice(0, 30).map(({ id, title, type, prompt }) => ({ id, title, type, description: prompt.slice(0, 150) }))
      const directions = {
        master: 'Escreva somente o roteiro master em português, com premissa, tom e continuidade visual. Devolva texto simples.',
        scenes: `Divida em até ${maxStudioScenes} cenas. Responda somente com JSON {"scenes":[{"title":"","prompt":"","duration":5,"componentIds":[]}]}`,
        refine: 'Reescreva apenas a cena indicada. Responda somente com JSON {"scenes":[{"title":"","prompt":"","duration":5,"componentIds":[]}]}.',
      }
      const { data } = await wallet.access().post('/aitoia/responses', {
        model: model.id, walletId: walletId.value,
        reasoning: { effort: model.efforts.includes('low') ? 'low' : model.efforts[0] },
        input: [{ role: 'user', content: `${directions[mode]} Formato ${format.value.label}. Cada cena deve ter duração inteira de 1 a 5 segundos, uma ação principal, movimento de câmera simples e fala curta quando houver diálogo. Reutilize personagens e cenários entre tomadas. Em componentIds use apenas IDs dos componentes cadastrados abaixo que fazem parte da cena. Não invente IDs.\nBriefing: ${scriptPrompt.value.trim()}\nRoteiro master: ${masterScript.value.trim()}\nComponentes: ${JSON.stringify(components)}${item ? '\nCena atual: ' + JSON.stringify(item) : ''}` }],
      }, { headers: { 'X-Aito-Request-Id': crypto.randomUUID() }, signal })
      signal.throwIfAborted()
      const answer = readAnswer(data)
      if (!answer.trim()) throw new Error('A IA não retornou um roteiro. Tente novamente.')
      if (mode === 'master') { masterScript.value = answer.trim().slice(0, 6000); return }
      const plan = parseVideoPlan(answer, new Set(components.map(component => component.id)))
      if (item) updateScriptScene(item.id, { ...plan.scenes[0], id: item.id })
      else sceneScripts.value = plan.scenes.map((row, index) => ({ ...row, id: sceneScripts.value[index]?.id || row.id }))
    } catch (cause) {
      if (!isAbort(cause)) scriptError.value = cause.response?.data?.message || cause.message
      throw cause
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
}
async function prepareScriptScene(item) {
  if (busy.value || activeJob.value || !item.prompt.trim() || !useCredits()) return
  const owner = accountId.value
  const project = activeId.value
  const existing = scenes.value.find(scene => scene.scriptId === item.id)
  const empty = scenes.value.find(scene => !scene.scriptId && !scene.media && !scene.heading && !scene.caption)
  if (!existing && !empty && scenes.value.length >= maxStudioScenes) {
    scriptError.value = 'Remova uma cena do vídeo master para gerar outra.'
    return
  }
  if (!options.value) await loadOptions()
  if (owner !== accountId.value || project !== activeId.value) return
  const components = item.componentIds.map(id => projectComponents.value.find(component => component.id === id)).filter(Boolean)
  const sample = components.find(component => component.type === voiceComponentType && component.file) ||
    components.map(component => voiceComponents.value.find(voice => voice.id === component.voiceId)).find(Boolean)
  if (sample && !modelOffers.value.get('seedance-2.5')?.length) {
    scriptError.value = 'O Seedance 2.5 está indisponível para esta voz de referência.'
    return
  }
  changeGenerationMode('text')
  const aspect = format.value.label
  const order = [videoModel.value, ...videoCatalog.map(model => model.id)]
  const choices = [...new Set(sample ? ['seedance-2.5'] : order)].flatMap((id, rank) => (modelOffers.value.get(id) || [])
    .filter(option => option.format === aspect && studioAiSeconds.includes(option.seconds) && option.seconds >= item.duration &&
      !(options.value?.videoModels?.find(model => model.id === id)?.minImageReferences > 0))
    .map(option => ({ id, option, rank })))
  const match = choices.sort((left, right) => left.option.seconds - right.option.seconds ||
    left.option.priceUsdCents - right.option.priceUsdCents || left.rank - right.rank)[0]
  if (!match) { scriptError.value = 'Nenhum modelo disponível para gerar esta cena.'; return }
  clearReference()
  clearSourceFrames()
  insertionAfter.value = null
  referenceImages.value.forEach(image => URL.revokeObjectURL(image.url))
  referenceImages.value = []
  videoModel.value = match.id
  videoOption.value = match.option.id
  voiceReferenceId.value = sample?.id || ''
  const media = [...new Set(components.filter(component => component.file?.type.startsWith('image/')).map(component => component.file))]
  chooseReferenceImages(media.slice(0, maxImageReferences.value))
  const continuity = masterScript.value.trim().slice(0, 300)
  const characterNotes = components.map(component => `${component.title}: ${component.prompt}`).join('\n').slice(0, 260)
  prompt.value = [item.prompt.trim().slice(0, 1320), continuity && `Continuidade do projeto: ${continuity}`,
    characterNotes && `Referências da cena:\n${characterNotes}`,
    sample && 'Use o áudio somente como referência para a voz do personagem.'].filter(Boolean).join('\n\n').slice(0, 2000)
  scriptTarget.value = { id: item.id, sceneId: existing?.id || empty?.id, title: item.title, duration: item.duration }
  scriptOpen.value = false
  createForScene(true)
  await nextTick()
  if (canQuoteVideo.value) await quoteVideo()
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
  const { data } = await wallet.access().post('/aitoia/video/voice', { text, voice: voice.value, walletId: walletId.value,
    maxBilledUsdCents: speechPrice(text) },
    { headers: { 'X-Aito-Request-Id': crypto.randomUUID() }, responseType: 'blob', signal })
  signal.throwIfAborted()
  return new File([data], 'locucao-aitoia.mp3', { type: 'audio/mpeg' })
}
function clearVoicePreview() {
  if (voicePreview.value) URL.revokeObjectURL(voicePreview.value.url)
  voicePreview.value = null
}
watch(voice, clearVoicePreview)
async function makeVoicePreview() {
  const item = selectedVoice.value
  if (!item?.previewAvailable) return
  await run('sample', async signal => {
    const { data } = await wallet.access().get('/aitoia/video/voice/previews/' + encodeURIComponent(item.id), {
      responseType: 'blob', signal,
    })
    signal.throwIfAborted()
    if (voice.value !== item.id || !mounted) return
    clearVoicePreview()
    voicePreview.value = { url: URL.createObjectURL(data) }
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
  return readGeneratedClipForJob(clip, signal, wallet.access().get)
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

async function saveRemakeResult(asset) {
  storeClip(asset)
  await saveProject()
}
async function saveClipComponent(asset, direction = '') {
  if (!asset?.file || !activeId.value || projectLoading.value) return
  if (projectComponents.value.some(item => item.sourceClipId === asset.id)) {
    notice.value = 'O clipe já está em Componentes › Cenas.'
    return
  }
  const title = asset.title || `Clipe ${asset.number || projectComponents.value.length + 1}`
  projectComponents.value = [...projectComponents.value, { id: crypto.randomUUID(), sourceClipId: asset.id,
    type: 'Cenas', title, prompt: direction, file: asset.file, kind: asset.kind }]
  await saveProject()
  if (!storageError.value) notice.value = `${title} salvo em Componentes › Cenas.`
}

function appendRemakes(assets) {
  if (!mayEdit.value) return
  const emptyTimeline = scenes.value.length === 1 && !scenes.value[0].heading && !scenes.value[0].caption && !scenes.value[0].media && !scenes.value[0].missingMedia
  if (scenes.value.length - Number(emptyTimeline) + assets.length > maxStudioScenes) {
    error.value = `A linha do tempo precisa de ${assets.length} espaços livres para estas cenas.`
    return
  }
  run('media', async signal => {
    const base = emptyTimeline ? [] : scenes.value
    const appended = []
    let inserted = false
    try {
      for (const asset of assets) {
        const media = await openStudioMedia(asset.file, projectMediaBytes([...base, ...appended]), signal)
        appended.push(freshScene({ media, duration: Math.min(asset.duration, media.element.duration),
          cut: true, clipId: asset.id, expiresAt: asset.expiresAt, kind: asset.kind }))
      }
      signal.throwIfAborted()
      if (!mounted) return
      replaceScenes([...base, ...appended])
      inserted = true
      tab.value = 'scenes'
      selectScene(appended[0].id)
      notice.value = appended.length === 1 ? 'Cena adicionada ao vídeo master.' : 'Cenas adicionadas ao vídeo master em ordem.'
    } finally {
      if (!inserted) appended.forEach(scene => closeStudioMedia(scene.media))
    }
  })
}

async function downloadRemakes(assets, signal) {
  const selected = exportFormats.value[0]
  if (!selected) throw new Error('Seu navegador não oferece a exportação de vídeo.')
  progress.value = 0
  pause()
  const firstClip = await openStudioMedia(assets[0].file, 0, signal)
  const { videoWidth, videoHeight } = firstClip.element
  closeStudioMedia(firstClip)
  const dimensions = { width: 2 * Math.max(1, Math.floor(videoWidth / 2)), height: 2 * Math.max(1, Math.floor(videoHeight / 2)) }
  const edit = studioTimeline(assets.map(asset => freshScene({
    media: { file: asset.file, isVideo: true }, offset: 0, duration: asset.duration, cut: true, expiresAt: asset.expiresAt,
  })))
  try {
    await renderStudioEdit(edit, null, { mimeType: selected.mime, dimensions, signal,
      onRendered: result => downloadAitoIAFile(result, `aitoia-video-refeito.${selected.extension}`) })
  } finally { progress.value = 0 }
}

async function readJob(job, signal, { get } = wallet.access()) {
  const expires = Date.now() + 12 * 60_000
  let current = job
  let consecutiveFailures = 0
  while (['queued', 'in_progress'].includes(current.status)) {
    activeJob.value = current
    if (Date.now() >= expires) throw new Error('O provedor ainda está gerando o clipe. Confira o resultado novamente.')
    await waitForJob(signal)
    try {
      const { data } = await get(`/aitoia/video/generations/${encodeURIComponent(current.id)}`, { signal })
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
    afterSceneId: job.afterSceneId, kind: job.kind || 'scene',
    ...(current.billingPending && { reservedUsdCents: current.reservedUsdCents }) }
  try { asset.file = previous?.file || await readGeneratedClipForJob(asset, signal, get) }
  catch {
    signal.throwIfAborted()
    if (job.timelineTransition) throw new Error('A transição foi gerada, mas o clipe ainda está indisponível. Verifique novamente.')
  }
  if (job.timelineTransition) asset.title = job.timelineTransition.title
  storeClip(asset)
  let applied = false
  if (job.timelineTransition && asset.file) {
    const { beforeSceneId, prompt: direction } = job.timelineTransition
    await saveClipComponent(asset, direction)
    signal.throwIfAborted()
    const index = scenes.value.findIndex(scene => scene.id === job.afterSceneId)
    if (scenes.value.some(scene => scene.clipId === asset.id)) applied = true
    else if (index >= 0 && scenes.value[index + 1]?.id === beforeSceneId && scenes.value.length < maxStudioScenes) {
      try { await insertClip(asset.file, signal, asset); applied = true }
      catch { signal.throwIfAborted() }
    }
  }
  if (job.scriptTarget && asset.file) {
    try { applied = await applyGeneratedScriptScene(job.scriptTarget, asset, signal) }
    catch { signal.throwIfAborted() }
  }
  activeJob.value = null
  keepJob(current, true)
  await saveProject()
  signal.throwIfAborted()
  notice.value = job.timelineTransition && asset.file ? (applied ? 'Transição adicionada ao vídeo master e salva em Componentes › Cenas.' :
    'Transição salva em Componentes › Cenas. A posição original mudou ou a linha do tempo está cheia.') : applied ? 'Clipe aplicado à cena do roteiro.' :
    asset.file && !storageError.value ? 'Clipe salvo no projeto.' : 'Clipe pronto. Baixe o original para guardar uma cópia.'
}
async function applyGeneratedScriptScene(target, asset, signal) {
  const scriptIndex = sceneScripts.value.findIndex(item => item.id === target.id)
  if (scriptIndex < 0) return false
  const existing = scenes.value.find(scene => scene.scriptId === target.id) || scenes.value.find(scene => scene.id === target.sceneId)
  if (!existing && scenes.value.length >= maxStudioScenes) return false
  const media = await openStudioMedia(asset.file, projectMediaBytes(scenes.value.filter(scene => scene !== existing)), signal)
  if (signal.aborted || !mounted) { closeStudioMedia(media); return false }
  const fields = { scriptId: target.id, heading: target.title || existing?.heading || '', media, offset: 0,
    duration: Math.min(sceneScriptSeconds(target.duration), media.element.duration), cut: true, clipId: asset.id, expiresAt: asset.expiresAt, missingMedia: false }
  if (existing) { editScene(fields, existing.id); selectScene(existing.id) }
  else {
    const preceding = new Set(sceneScripts.value.slice(0, scriptIndex).map(item => item.id))
    const index = scenes.value.findLastIndex(scene => preceding.has(scene.scriptId))
    const next = freshScene(fields)
    const offset = index >= 0 ? index + 1 : scenes.value.findIndex(scene => scene.scriptId)
    const result = [...scenes.value]
    result.splice(offset < 0 ? result.length : offset, 0, next)
    replaceScenes(result)
    selectScene(next.id)
  }
  return true
}
function selectGenerated(clip) {
  generatedDuration.value = 0
  generated.value = clip
}
function checkJob() {
  if (!activeJob.value || !accountId.value) return
  const job = activeJob.value
  const access = wallet.access()
  void run(job.timelineTransition && transitionDialogOpen.value ? 'transition-generate' : 'video', async signal => {
    await readJob(job, signal, access)
    if (job.timelineTransition) transitionDialogOpen.value = false
  }).then(() => {
    if (error.value) updateTimelineTransition({ error: error.value })
  })
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
  scriptTarget.value = null
  referenceModelId.value = ''
  generationMode.value = mode
}
const nextScene = computed(() => {
  const index = scenes.value.findIndex(scene => scene.id === sceneId.value)
  return index >= 0 ? scenes.value[index + 1] : null
})
async function buildContinuity() {
  const from = selectedScene.value
  if (!from?.media?.isVideo) return
  const owner = accountId.value
  const project = activeId.value
  if (!signedIn.value) { showAuth(); return }
  if (signedIn.value && !options.value) await loadOptions()
  if (owner !== accountId.value || project !== activeId.value) return
  if (!options.value?.referenceModels?.some(item => item.mode === 'continuation')) {
    error.value = 'Para usar os quadros da linha do tempo, entre com acesso aos modelos Kling 4.0.'
    return
  }
  run('frames', async signal => {
    const file = await captureTransitionFrame(from.media.file, 'end', format.value.label, '720p', signal, (from.offset || 0) + cutDuration(from) - .04)
    signal.throwIfAborted()
    changeGenerationMode('continuation')
    clearSourceFrames()
    sourceFrames.value = [{ file, url: URL.createObjectURL(file) }]
    insertionAfter.value = from.id
    referenceImages.value.forEach(item => URL.revokeObjectURL(item.url))
    referenceImages.value = []
    prompt.value = [from.heading, from.caption].filter(Boolean).join('. ')
    tab.value = 'ai'
    const matching = modelOptions.value.find(item => item.format === format.value.label)
    if (matching) videoOption.value = matching.id
    nextTick(() => clipPrompt.value?.focus())
  })
}
const transitionReady = (before, after) => Boolean(before?.media && after?.media && !unavailableScene(before) && !unavailableScene(after))
function openTimelineTransition(index) {
  const before = scenes.value[index]
  const after = scenes.value[index + 1]
  if (!signedIn.value) { showAuth(); return }
  if (!mayEdit.value || busy.value || activeJob.value || !transitionReady(before, after) || scenes.value.length >= maxStudioScenes) return
  timelineTransition.value = { before, after, index, prompt: '', files: [], quote: null, error: '' }
  transitionDialogOpen.value = true
  if (!options.value && !optionsLoading.value) void loadOptions()
}
function updateTimelineTransition(values) {
  if (timelineTransition.value) timelineTransition.value = { ...timelineTransition.value, ...values }
}
function addTimelineTransitionFiles(source) {
  const files = Array.from(source || [])
  const draft = timelineTransition.value
  if (!files.length || !draft || busy.value) return
  try {
    if (draft.files.length + files.length > maxTimelineTransitionFiles) throw new Error('Use até cinco imagens adicionais.')
    files.forEach(checkImageReference)
    updateTimelineTransition({ files: [...draft.files, ...files], quote: null, error: '' })
  } catch (cause) { updateTimelineTransition({ error: cause.message }) }
}
function pasteTimelineTransitionFiles(event) {
  const files = event.clipboardData?.files
  if (!files?.length) return
  event.preventDefault()
  addTimelineTransitionFiles(files)
}
watch(walletId, () => updateTimelineTransition({ quote: null }))
async function createTimelineTransition() {
  const draft = timelineTransition.value
  const model = options.value?.transitionModel
  const preset = transitionDialogOffer.value
  if (!draft?.prompt.trim() || !model || !preset || activeJob.value || !useCredits()) return
  const access = wallet.access()
  const selectedWallet = walletId.value
  updateTimelineTransition({ error: '' })
  const request = { model: model.id, option: preset.id, walletId: selectedWallet, prompt: draft.prompt.trim() }
  function validateCut() {
    const index = scenes.value.indexOf(draft.before)
    if (index < 0 || scenes.value[index + 1] !== draft.after) throw new Error('A linha do tempo mudou. Abra a transição no corte desejado.')
  }
  if (!draft.quote) {
    await run('transition-quote', async signal => {
      validateCut()
      const { format, resolution } = preset
      const [from, to] = await Promise.all([
        captureTransitionFrame(draft.before.media.file, 'end', format, resolution, signal,
          (draft.before.offset || 0) + cutDuration(draft.before) - .04),
        captureTransitionFrame(draft.after.media.file, 'start', format, resolution, signal, draft.after.offset || 0),
      ])
      const tokens = []
      for (const file of [from, ...draft.files, to]) {
        tokens.push(await uploadVideoReference(access.post, file, checkImageReference(file), putImageReference, signal, selectedWallet))
      }
      const body = { ...request, imageReferenceTokens: tokens }
      const { data } = await access.post('/aitoia/video/studio/generations/quote', body, { signal })
      signal.throwIfAborted()
      if (walletId.value === selectedWallet) updateTimelineTransition({ quote: { ...data.data, body, requestId: crypto.randomUUID() } })
    })
    if (error.value) updateTimelineTransition({ error: error.value })
    return
  }
  await run('transition-generate', async signal => {
    validateCut()
    const { quote } = draft
    try {
      const { data } = await access.post('/aitoia/video/studio/generations', { ...quote.body, quoteToken: quote.quoteToken },
        { headers: { 'X-Aito-Request-Id': quote.requestId }, signal })
      signal.throwIfAborted()
      const job = { ...data.data, kind: 'transition', afterSceneId: draft.before.id,
        timelineTransition: { beforeSceneId: draft.after.id, title: `transition-${draft.index + 1}-${draft.index + 2}`, prompt: request.prompt } }
      updateTimelineTransition({ quote: null })
      activeJob.value = job
      keepJob(job)
      void saveProject()
      await readJob(job, signal, access)
      transitionDialogOpen.value = false
    } catch (cause) {
      if ([409, 410].includes(cause.response?.status)) updateTimelineTransition({ quote: null })
      throw cause
    } finally { if (mounted && !signal.aborted) wallet.refreshStatus({ silent: true }) }
  })
  if (error.value) updateTimelineTransition({ error: error.value })
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
  if (!files.length || !mayEdit.value || remakeMode.value) return
  if (!maxImageReferences.value) {
    error.value = 'Selecione um modelo que aceite imagens de referência.'
    return
  }
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
  const access = wallet.access()
  const selectedWallet = walletId.value
  await run('analysis', async signal => {
    try {
      const model = models.value.find(item => item.id === 'gpt-6.1-sol') || models.value[0]
      if (!model) throw new Error('O modelo de análise está temporariamente indisponível.')
      const frames = await sampleVideoFrames(reference.value.file, signal)
      const content = [{ type: 'input_text', text: `Analise os quadros amostrados de um vídeo-base em português brasileiro. Identifique ações visíveis, personagens, enquadramento, iluminação e composição. Sugira um prompt curto para editar o clipe conforme o pedido do usuário. Não infira falas, identidade ou eventos entre quadros. Pedido: ${prompt.value.trim() || 'preservar o movimento da cena'}` },
        ...frames.flatMap(frame => [{ type: 'input_text', text: `Quadro em ${frame.second}s` }, { type: 'input_image', image_url: frame.url }])]
      const { data } = await access.post('/aitoia/responses', { model: model.id, walletId: selectedWallet,
        reasoning: { effort: model.efforts.includes('medium') ? 'medium' : model.efforts[0] }, input: [{ role: 'user', content }] },
      { headers: { 'X-Aito-Request-Id': crypto.randomUUID() }, signal })
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
async function uploadVideoReference(post, file, contentType, put, signal, selectedWallet) {
  const { data } = await post('/aitoia/video/references', { contentType, sizeBytes: file.size, walletId: selectedWallet }, { signal })
  signal.throwIfAborted()
  return put(file, data.data, signal)
}
async function quoteVideo() {
  if (!canQuoteVideo.value || !useCredits()) return
  const access = wallet.access()
  const selectedWallet = walletId.value
  await run('quote', async signal => {
    videoQuote.value = null
    if (referenceModel.value?.sourceDuration && reference.value) {
      const source = await openStudioMedia(reference.value.file, 0, signal)
      const duration = source.element.duration
      closeStudioMedia(source)
      const min = referenceModel.value.sourceSecondsMin ?? 4
      const max = Math.min(referenceModel.value.sourceSecondsMax ?? 5, 5)
      if (duration < min || duration > max) throw new Error(`Use um vídeo-base de ${min} a ${max} segundos neste modo.`)
    }
    const upload = (file, contentType, put) => uploadVideoReference(access.post, file, contentType, put, signal, selectedWallet)
    const referenceToken = !transitionMode.value && !continuationMode.value && reference.value && await upload(reference.value.file, 'video/mp4', putVideoReference)
    const audioReferenceToken = acceptsVoiceReference.value && voiceReference.value &&
      await upload(voiceReference.value.file, 'audio/wav', putVoiceReference)
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
    const tokens = { ...(referenceToken && { referenceToken }), ...(imageReferenceTokens.length && { imageReferenceTokens }),
      ...(audioReferenceToken && { audioReferenceToken }) }
    const body = { model: generationMode.value === 'text' ? videoModel.value : referenceModel.value.id,
      option: offer.value.id, prompt: prompt.value.trim(), walletId: selectedWallet, ...tokens }
    const quote = await access.post('/aitoia/video/studio/generations/quote', body, { signal })
    signal.throwIfAborted()
    if (walletId.value === selectedWallet) videoQuote.value = { ...quote.data.data, body, requestId: crypto.randomUUID() }
  })
}
async function makeVideo() {
  if (busy.value || activeJob.value || !canQuoteVideo.value || !useCredits()) return
  if (!videoQuote.value) return quoteVideo()
  const access = wallet.access()
  await run('video', async signal => {
    try {
      const { quoteToken, body, requestId } = videoQuote.value
      const placement = { afterSceneId: insertionAfter.value, kind: transitionMode.value ? 'transition' : 'scene', scriptTarget: scriptTarget.value }
      const { data } = await access.post('/aitoia/video/studio/generations', { ...body, quoteToken }, { headers: { 'X-Aito-Request-Id': requestId }, signal })
      signal.throwIfAborted()
      videoQuote.value = null
      const job = { ...data.data, ...placement }
      activeJob.value = job
      keepJob(job)
      void saveProject()
      wallet.refreshStatus({ silent: true })
      await readJob(job, signal, access)
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
    const remake = remakeDraft.value
    const metadata = { format: 'aitoia-video', version: 5, title: projectTitle.value, projectColor: projectColor.value, aspectRatio: format.value.label,
      expiresAt: activeProject.value?.expiresAt,
      scenes: scenes.value.map(({ media, ...scene }, index) => ({
        ...scene, media: unavailableScene(scene) ? undefined : add(media?.file, `cena-${index + 1}`),
      })),
      narration: { text: narrationText.value, media: add(narration.value?.file, 'locucao') },
      components: projectComponents.value.map(({ file, ...item }, index) => ({ ...item, media: add(file, `componente-${index + 1}`) })),
      componentTypes: componentTypes.value,
      remake: remake && { ...remake, scenes: remake.scenes.map(({ file, result, pending: _pending, ...item }) => ({ ...item,
        media: add(file, `refazer-original-${item.index + 1}`),
        result: result && { id: result.id, title: result.title, captions: result.captions,
          media: add(result.file, `refazer-resultado-${item.index + 1}`) },
      })) },
      plan: { master: masterScript.value, scenes: sceneScripts.value },
      configuration: { prompt: prompt.value, scriptPrompt: scriptPrompt.value, mode: generationMode.value, model: videoModel.value, referenceModel: referenceModelId.value },
      references: { video: add(reference.value?.file, 'referencia'), images: referenceImages.value.map((item, index) => add(item.file, `imagem-${index + 1}`)),
        transition: transitionClips.value.map((clip, index) => add(clip?.file, `transicao-${index + 1}`)),
        keyframes: sourceFrames.value.map((frame, index) => add(frame.file, `quadro-${index + 1}`)) },
      clips: clipLibrary.value.map(({ id, number, file, title, kind, expiresAt }) => ({ id, number, title, kind, expiresAt,
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
  transitionDialogOpen.value = false
  timelineTransition.value = null
  videoQuote.value = null
  updateRecording(null)
  clipLibrary.value.forEach(disposeClip)
  generated.value = null
  clipLibrary.value = []
  projectComponents.value = []
  remakeDraft.value = null
  remakeRevision.value++
  componentTypes.value = [...builtInComponentTypes]
  componentForm.value = null
  voiceReferenceId.value = ''
  activeJob.value = null
  scriptPrompt.value = ''
  masterScript.value = ''
  sceneScripts.value = []
  scriptOpen.value = false
  scriptTarget.value = null
  prompt.value = ''
  narrationText.value = ''
  title.value = defaultProjectName
  projectColor.value = defaultProjectColor
  projectColorOpen.value = false
  formatId.value = videoFormats[0].id
  generationMode.value = 'text'
  referenceModelId.value = ''
  const oldMedia = new Set([scenes.value, ...history.value].flatMap(list => list.map(scene => scene.media)))
  history.value = []
  oldMedia.forEach(closeStudioMedia)
  displayedVideo = null
  scenes.value = [freshScene()]
  selectScene(scenes.value[0].id)
}

function setProjectColor(color) {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) projectColor.value = color.toUpperCase()
}

function snapshotProject() {
  return { title: projectTitle.value, projectColor: projectColor.value, formatId: formatId.value, sceneId: sceneId.value,
    scenes: scenes.value.map(({ media, ...scene }) => ({ ...scene, file: media?.file })),
    narrationText: narrationText.value, narration: narration.value?.file, recording: recording.value?.blob,
    prompt: prompt.value, scriptPrompt: scriptPrompt.value, masterScript: masterScript.value, sceneScripts: sceneScripts.value,
    scriptTarget: scriptTarget.value, voiceReferenceId: voiceReferenceId.value,
    generationMode: generationMode.value, videoModel: videoModel.value, referenceModelId: referenceModelId.value,
    reference: reference.value?.file, referenceImages: referenceImages.value.map(item => item.file), referenceAnalysis: referenceAnalysis.value,
    transitionClips: transitionClips.value.map(clip => clip?.file || null), sourceFrames: sourceFrames.value.map(frame => frame.file),
    insertionAfter: insertionAfter.value,
    componentTypes: componentTypes.value, components: projectComponents.value, remake: remakeDraft.value,
    clips: clipLibrary.value.map(({ url, ...clip }) => ({ ...clip, ...(clip.expiresAt <= Date.now() && { file: undefined, remoteUrl: undefined, expired: true }) })),
    selectedClipId: generated.value?.id, activeJob: activeJob.value }
}

async function restoreProject(project, signal) {
  resetProject()
  title.value = project?.title || defaultProjectName
  setProjectColor(project?.projectColor)
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
    if (videoFormats.some(item => item.id === project.formatId)) formatId.value = project.formatId
    replaceScenes(project.scenes.map(({ file, ...scene }) => freshScene({ ...scene, media: localMedia.get(file) || null,
      missingMedia: scene.missingMedia || Boolean(file && !localMedia.get(file)) })), { remember: false })
    selectScene(scenes.value.some(scene => scene.id === project.sceneId) ? project.sceneId : scenes.value[0]?.id || '')
    narrationText.value = project.narrationText || ''
    if (project.narration) replaceNarration(project.narration)
    updateRecording(project.recording)
    prompt.value = project.prompt || ''
    scriptPrompt.value = project.scriptPrompt || ''
    masterScript.value = project.masterScript || ''
    sceneScripts.value = (project.sceneScripts || []).map(cleanSceneScript)
    scriptTarget.value = project.scriptTarget || null
    voiceReferenceId.value = project.voiceReferenceId || ''
    generationMode.value = generationModes.some(mode => mode.id === project.generationMode) ? project.generationMode : 'text'
    if (videoCatalog.some(model => model.id === project.videoModel)) videoModel.value = project.videoModel
    referenceModelId.value = project.referenceModelId || ''
    reference.value = project.reference ? { file: project.reference, url: URL.createObjectURL(project.reference) } : null
    referenceImages.value = (project.referenceImages || []).map(file => ({ file, url: URL.createObjectURL(file) }))
    transitionClips.value = [0, 1].map(index => {
      const file = project.transitionClips?.[index]
      return file ? { file, url: URL.createObjectURL(file) } : null
    })
    sourceFrames.value = (project.sourceFrames || []).map(file => ({ file, url: URL.createObjectURL(file) }))
    insertionAfter.value = project.insertionAfter || null
    if (project.componentTypes?.length) {
      componentTypes.value = [...new Set([...builtInComponentTypes, ...project.componentTypes])].slice(0, 20)
    }
    projectComponents.value = project.components || []
    remakeDraft.value = project.remake || null
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

function createForScene(keepScriptTarget = false) {
  if (remakeMode.value) changeGenerationMode('text')
  if (keepScriptTarget !== true) scriptTarget.value = null
  if (!prompt.value.trim()) prompt.value = [selectedScene.value?.heading, selectedScene.value?.caption].filter(Boolean).join('. ')
  closeMobilePanel(masterOpen)
  chooseEditorTab('ai')
  nextTick(() => clipPrompt.value?.focus())
}

function pasteStudioMedia(event) {
  if (tab.value !== 'ai') return pasteMedia(event)
  if (remakeMode.value || (transitionMode.value && !sourceFrames.value.length)) return
  const images = Array.from(event.clipboardData?.files || []).filter(item => item.type.startsWith('image/'))
  if (images.length) { event.preventDefault(); chooseReferenceImages(images) }
}

watch([timeline, format, previewMode], () => { if (mounted) seek(playhead.value) }, { flush: 'post' })
watch(tab, () => { if (mounted) paint(playhead.value) }, { flush: 'post' })
onMounted(async () => {
  mounted = true
  if (route.query.auth === 'register' && !signedIn.value) showAuth()
  exportFormats.value = studioVideoExports()
  exportFormat.value = exportFormats.value[0]?.extension || ''
  expireTimer = setInterval(expireCurrentMedia, 10000)
  if (studioHeader.value && typeof ResizeObserver !== 'undefined') {
    headerObserver = new ResizeObserver(([entry]) => { headerHeight.value = Math.ceil(entry.target.getBoundingClientRect().height) })
    headerObserver.observe(studioHeader.value)
  }
  await nextTick()
  paint(0)
})
onBeforeUnmount(() => { mounted = false; clearInterval(expireTimer); headerObserver?.disconnect(); activeOperation?.abort(); optionsRequest?.abort(); resetProject() })
</script>

<template>
  <q-layout view="hHh Lpr lFf" class="aito-ai-theme video-studio" :style="{ '--video-header-height': headerHeight + 'px' }">
    <q-header class="video-studio__header">
      <header ref="studioHeader" class="video-studio__bar">
        <div class="video-studio__header-start">
          <q-btn flat round icon="mdi-menu" :aria-label="projectsOpen ? 'Fechar projetos e componentes' : 'Abrir projetos e componentes'"
            :aria-expanded="projectsOpen" aria-controls="video-studio-project-drawer" @click="projectsOpen = !projectsOpen" />
          <router-link to="/" class="video-studio__brand" aria-label="Site AitoSoftwares"><img src="/ia.gif" width="37" height="37" alt="" /> <strong>AitoIA</strong></router-link>
        </div>
        <div class="video-studio__mode"><AitoIAModeSwitch mode="video" :busy="guarded" /></div>
        <div class="video-studio__account">
          <button v-if="signedIn" class="video-studio__balance" type="button" :aria-label="adminMode ? 'Abrir saldo da plataforma' : 'Abrir carteira AitoTokens'" :disabled="guarded" @click="showWallet"><img src="/aitotokens.svg" width="26" height="26" alt="" /><span>{{ status ? `${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }}</span><q-icon :name="adminMode ? 'mdi-shield-account-outline' : 'mdi-plus'" size="16px" /></button>
          <template v-else><button class="video-studio__login" type="button" @click="showAuth('login')">Entrar</button><button class="video-studio__primary" type="button" @click="showAuth()">Criar conta</button></template>
        </div>
      </header>
    </q-header>
    <q-drawer v-model="projectsOpen" show-if-above dark bordered :breakpoint="900" :width="306" class="video-studio__drawer">
      <aside id="video-studio-project-drawer" class="video-studio__drawer-content" aria-label="Projetos e componentes">
        <header class="video-studio__drawer-heading">
          <div><span>Estúdio de vídeo</span><h2>Projetos e componentes</h2></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar painel de projetos" @click="projectsOpen = false" />
        </header>
        <div class="video-studio__drawer-section">
          <AitoStudioProjectPicker v-if="signedIn" drawer colored :projects="projects" :active-id="activeId" :loading="projectLoading"
            :storage-error="storageError" :cloud-state="cloudState" :disabled="!accountId || !mayEdit || Boolean(busy)"
            @create="chooseProject()" @open="chooseProject" @remove="deleteProject" @renew="renewProject" @import="importArchive" />
          <q-btn v-else outline no-caps color="teal-3" icon="mdi-login" label="Entrar para salvar projetos" @click="showAuth('login')" />
          <q-input v-if="signedIn && activeId" v-model="title" dark outlined dense label="Nome do projeto" maxlength="80" :disable="!mayEdit" />
          <q-btn outline no-caps class="video-studio__script-btn" icon="mdi-script-text-outline" label="Roteiro do projeto"
            :disable="!mayEdit || Boolean(busy)" @click="openProjectScript" />
        </div>
        <div class="video-studio__drawer-section">
          <h3>Componentes</h3>
          <q-list dark bordered separator class="video-studio__drawer-list">
            <q-item v-for="type in componentTypes" :key="type" clickable :disable="!mayEdit" @click="openComponents(type)">
              <q-item-section avatar><q-icon :name="componentIcons[type] || 'mdi-folder-outline'" size="20px" /></q-item-section>
              <q-item-section>{{ type }}</q-item-section><q-item-section side><q-icon name="mdi-chevron-right" size="18px" /></q-item-section>
            </q-item>
          </q-list>
          <q-form class="video-studio__drawer-add" @submit.prevent="addComponentType">
            <q-input v-model.trim="componentTypeName" dark outlined dense label="Novo tipo" maxlength="32" :disable="!mayEdit" />
            <q-btn outline color="teal-3" type="submit" round dense icon="mdi-plus" aria-label="Criar tipo de componente" :disable="!mayEdit || !componentTypeName" />
          </q-form>
        </div>
        <footer class="video-studio__drawer-footer">
          <q-btn v-if="signedIn" flat no-caps align="left" :icon="adminMode ? 'mdi-shield-account-outline' : 'mdi-account-circle-outline'" :label="adminMode ? 'Aito Admin' : 'Meu perfil'"
            :to="adminMode ? '/admin' : { path: '/app', query: { tab: 'profile' } }" :disable="guarded" />
          <q-btn v-else flat no-caps align="left" icon="mdi-account-circle-outline" label="Meu perfil" @click="showAuth('login')" />
        </footer>
      </aside>
    </q-drawer>
    <q-page-container>
    <main class="video-studio__main" @paste="pasteStudioMedia">
      <div class="video-studio__intro">
        <div class="video-studio__project-heading">
          <div class="video-studio__project-name">
            <q-btn flat round dense class="video-studio__color-button" aria-label="Escolher cor do projeto"
              :disable="!mayEdit" :aria-expanded="projectColorOpen" @click="projectColorOpen = true">
              <span class="video-studio__color-dot" :style="{ backgroundColor: projectColor }" aria-hidden="true" />
            </q-btn>
            <h1>{{ projectTitle }}</h1>
          </div>
          <p>Gere cenas, monte seu vídeo e exporte o resultado.</p>
        </div>
        <div class="video-studio__zip">
          <span v-if="missingArchiveItems" class="video-studio__hint">{{ missingArchiveItems }} mídia(s) indisponível(is) ficarão fora do ZIP.</span>
          <button :class="nearingExpiry ? 'video-studio__primary' : 'video-studio__secondary'" type="button" :disabled="!mayEdit || Boolean(busy)" @click="archiveProject"><q-icon name="mdi-folder-zip-outline" size="20px" /> Baixar projeto ZIP</button>
        </div>
      </div>
      <p v-if="route.query.maintenance === 'chat'" class="video-studio__notice" role="status"><img src="/ia.gif" width="30" height="30" alt="" /> O Chat AitoIA está em manutenção. Desculpe o transtorno. Estamos trazendo novas funcionalidades.</p>
      <p v-if="!signedIn" class="video-studio__notice"><q-icon name="mdi-gift-outline" size="20px" /> Ganhe 50.000 AitoTokens no primeiro cadastro.</p>
      <p v-if="error" role="alert" class="video-studio__notice video-studio__notice--error"><q-icon name="mdi-alert-circle-outline" size="20px" /> {{ error }}</p>
      <p v-else-if="blockedExit" role="status" class="video-studio__notice"><q-icon name="mdi-progress-clock" size="20px" /> Aguarde a conclusão do trabalho antes de sair do estúdio.</p>
      <p v-else-if="notice" role="status" class="video-studio__notice"><q-icon name="mdi-check-circle-outline" size="20px" /> {{ notice }}</p>
      <div v-if="activeJob?.timelineTransition && !transitionDialogOpen && !busy" class="video-studio__notice video-studio__draft">
        <q-icon name="mdi-transition" size="20px" /> <span>Há uma transição pendente neste projeto.</span>
        <button type="button" class="video-studio__secondary" :disabled="remakeBusy || projectLoading" @click="checkJob">Verificar transição</button>
      </div>

      <div v-if="draft" class="video-studio__notice video-studio__draft">
        <q-icon name="mdi-message-arrow-right-outline" size="22px" />
        <strong>{{ draft.purpose === 'save-clip' || draft.generated ? 'Clipe do chat' : 'Rascunho do chat' }}</strong>
        <button type="button" class="video-studio__secondary" :disabled="!draftReady" @click="applyDraft()">Usar neste projeto</button>
        <button type="button" class="video-studio__primary" :disabled="!draftReady || atLimit" @click="applyDraft(true)">Criar projeto</button>
      </div>

      <div ref="workspace" class="video-studio__grid" :class="{ 'video-studio__grid--generate': tab === 'ai' }">
        <nav class="video-studio__tabs" :class="`video-studio__tabs--${tab}`" aria-label="Ferramentas do editor">
          <q-tabs :model-value="tab" dark dense no-caps align="justify" indicator-color="transparent" active-color="teal-2" @update:model-value="chooseEditorTab">
            <q-tab v-for="item in tabs" :key="item.id" :name="item.id" :icon="item.icon" :label="item.label" :disable="!mayEdit" />
          </q-tabs>
        </nav>

        <section v-if="tab === 'ai'" class="video-studio__catalog" aria-label="Modo de geração">
          <div class="video-studio__catalog-header">
            <div><h2>{{ remakeMode ? 'Ferramentas de vídeo' : 'Criar com Higgsfield' }}</h2><p v-if="!remakeMode">Gere um clipe a partir de um prompt e referências opcionais.</p></div>
            <button v-if="signedIn" class="video-studio__icon" type="button" aria-label="Atualizar catálogo de vídeos" :disabled="optionsLoading || !mayEdit" @click="loadOptions"><q-icon name="mdi-refresh" size="21px" /></button>
          </div>
          <div class="video-studio__generation-modes" role="group" aria-label="Como criar o clipe">
            <button v-for="item in generationModes.filter(mode => mode.id !== 'continuation' || generationMode === mode.id)" :key="item.id" class="video-studio__secondary" :class="{ 'video-studio__remake-button': item.id === 'remake' }" type="button" :aria-pressed="generationMode === item.id" :disabled="!mayEdit" @click="changeGenerationMode(item.id)">
              <q-icon :name="item.icon" size="19px" /> {{ item.label }}
            </button>
          </div>
          <q-expansion-item v-if="generationMode === 'text'" v-model="modelListOpen" class="video-studio__catalog-models" icon="mdi-movie-open-outline" label="Modelos de vídeo" :caption="selectedModel?.name">
            <div class="video-studio__model-grid"><article v-for="item in modelCards" :key="item.id" class="video-studio__model-card" :class="{ 'video-studio__model-card--selected': videoModel === item.id && item.selectable }">
              <div class="video-studio__model-poster" :class="{ 'video-studio__model-poster--symbol': !item.poster }" :style="{ backgroundPosition: item.poster }" aria-hidden="true">
                <q-icon v-if="!item.poster" :name="item.type === 'workflow' ? 'mdi-movie-open-star-outline' : 'mdi-movie-open-play-outline'" size="36px" />
                <span class="video-studio__model-type" :class="{ 'video-studio__model-type--image': item.type === 'image' }"><q-icon :name="item.type === 'image' ? 'mdi-image-outline' : 'mdi-play-box-outline'" size="15px" /> {{ item.type === 'image' ? 'Imagem' : item.type === 'workflow' ? 'Fluxo' : 'Vídeo' }}</span>
              </div>
              <div class="video-studio__model-content">
                <div><span class="video-studio__model-maker">{{ item.maker }}</span><h3>{{ item.name }}</h3></div>
                <p>{{ item.summary }}</p>
                <div class="video-studio__model-meta">
                  <span v-if="item.perSecond" class="video-studio__model-rate" title="Custo de referência do estúdio">A partir de {{ item.perSecond }}/s</span>
                  <span :class="{ 'video-studio__model-status--available': item.available }">{{ item.availability }}</span>
                </div>
              </div>
              <button v-if="item.selectable" class="video-studio__model-hit" type="button" :disabled="!mayEdit" :aria-label="`Selecionar ${item.name}`" :aria-pressed="videoModel === item.id" @click="selectVideoModel(item)">
                <q-icon :name="videoModel === item.id ? 'mdi-check-circle' : 'mdi-arrow-top-right'" size="18px" aria-hidden="true" />
              </button>
            </article></div>
          </q-expansion-item>
        </section>

        <AitoStudioVideoRemake v-show="tab === 'ai' && remakeMode" ref="remakeEditor" :key="`${accountId || ''}:${activeId || ''}:${remakeRevision}`"
          :project-scope="accountId && activeId ? `${accountId}:${activeId}` : ''"
          :project-expires-at="activeProject?.expiresAt"
          :draft="remakeDraft" @draft="remakeDraft = $event"
          :references="remakeReferences" :wallet-id="walletId" :blocked="Boolean(busy) || projectLoading"
          :allow-credits="useCredits" :access="wallet.access" :save-result="saveRemakeResult"
          :export-results="downloadRemakes" :export-progress="progress"
          @busy="remakeBusy = $event; if (!$event) blockedExit = false"
          @recover="generationMode = 'remake'; tab = 'ai'"
          @balance="wallet.refreshStatus({ silent: true })" @wallet="showWallet" @login="showAuth('login')" @append="appendRemakes" @component="saveClipComponent" />

        <section v-if="tab !== 'ai' || !remakeMode" class="video-studio__panel video-studio__editor" aria-label="Editor do projeto">

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
                <button v-if="selectedScene.media && !unavailableScene(selectedScene)" class="video-studio__icon" type="button" aria-label="Baixar cena"
                  :disabled="!mayEdit || Boolean(busy)" @click="downloadSelectedScene"><q-icon name="mdi-download-outline" size="20px" /><q-tooltip>Baixar cena</q-tooltip></button>
                <button class="video-studio__icon" type="button" aria-label="Remover cena do vídeo master" :disabled="!mayEdit" @click="deleteScene"><q-icon name="mdi-delete-outline" size="20px" /></button>
              </div>
              <div class="video-studio__actions">
                <button class="video-studio__secondary" type="button" :disabled="!selectedScene.media?.isVideo || Boolean(busy)" @click="buildContinuity"><q-icon name="mdi-movie-open-outline" size="18px" /> Gerar próxima cena</button>
                <button class="video-studio__secondary" type="button" :disabled="!transitionReady(selectedScene, nextScene) || Boolean(busy) || Boolean(activeJob) || scenes.length >= maxStudioScenes" @click="openTimelineTransition(scenes.indexOf(selectedScene))"><q-icon name="mdi-transition" size="18px" /> Gerar transição</button>
                <span v-if="!transitionReady(selectedScene, nextScene)" class="video-studio__hint">Adicione mídia nas duas cenas para criar a transição.</span>
              </div>
            </template>
            <q-btn outline no-caps class="video-studio__script-btn" icon="mdi-script-text-outline" label="Abrir roteiro do projeto"
              :disable="!mayEdit || Boolean(busy)" @click="openProjectScript" />
          </div>

          <div v-else-if="tab === 'voice'" class="video-studio__section">
            <div class="video-studio__scene-heading"><h2>Locução</h2><button v-if="signedIn" class="video-studio__icon" type="button" aria-label="Atualizar catálogo de vozes" :disabled="optionsLoading || !mayEdit" @click="loadOptions"><q-icon name="mdi-refresh" size="21px" /></button></div>
            <label>Texto da locução<textarea v-model="narrationText" rows="5" :maxlength="maxNarration" placeholder="Digite o texto que será narrado…" :disabled="!mayEdit" /></label>
            <div v-if="baseVoices.length" class="video-studio__voices" role="group" aria-label="Vozes OpenAI">
              <button v-for="(item, index) in baseVoices" :key="item.id" type="button" :style="{ '--voice-hue': [162, 195, 266, 41, 325][index % 5] }" :aria-pressed="(selectedVoice?.base || voice) === item.id" :disabled="!mayEdit" @click="voice = item.id"><span class="video-studio__voice-dot" aria-hidden="true" /> {{ item.label }}</button>
            </div>
            <p v-else-if="signedIn" class="video-studio__hint">{{ optionsLoading ? 'Carregando vozes…' : optionsError || 'A geração de locução está temporariamente indisponível.' }}</p>
            <label v-if="voicePaces.length > 1">Ritmo da locução
              <select v-model="voice" :disabled="!mayEdit">
                <option v-for="item in voicePaces" :key="item.id" :value="item.id">{{ paceLabels[item.speed] || item.label }}</option>
              </select>
            </label>
            <div class="video-studio__actions">
              <button v-if="!signedIn" class="video-studio__primary" type="button" @click="showAuth()">Criar conta para usar IA</button>
              <button v-else class="video-studio__primary" type="button" :disabled="!mayEdit || !voice || !narrationText.trim()" @click="makeVoice"><q-spinner v-if="busy === 'voice'" size="19px" /><q-icon v-else name="mdi-waveform" size="19px" /> {{ busy === 'voice' ? 'Gerando…' : 'Gerar locução' }}<span v-if="voiceCost"> · {{ voiceCost }}</span></button>
              <button v-if="selectedVoice?.previewAvailable && !voicePreview" class="video-studio__secondary" type="button" :disabled="Boolean(busy)" @click="makeVoicePreview"><q-spinner v-if="busy === 'sample'" size="18px" /><q-icon v-else name="mdi-volume-high" size="18px" /> {{ busy === 'sample' ? 'Carregando amostra…' : 'Ouvir amostra grátis' }}</button>
              <input ref="audioInput" type="file" accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.aac,.flac" hidden @change="fileFrom($event, file => { if (file) run('media', () => replaceNarration(file)) })" />
              <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="audioInput?.click()"><q-icon name="mdi-upload-outline" size="18px" /> Importar áudio</button>
            </div>
            <p v-if="selectedVoice && !selectedVoice.previewAvailable" class="video-studio__hint">A amostra gratuita desta voz ainda está em preparação.</p>
            <p v-if="selectedVoice" class="video-studio__hint">As vozes de locução são geradas por IA.</p>
            <audio v-if="voicePreview" class="video-studio__audio" :src="voicePreview.url" preload="metadata" controls autoplay aria-label="Amostra da voz selecionada" />
            <div v-if="narration" class="video-studio__audio-meta">
              <strong>{{ narration.file.name }}</strong><span class="video-studio__spacer" /><a class="video-studio__icon" :href="narration.url" :download="narration.file.name" aria-label="Baixar locução"><q-icon name="mdi-download-outline" size="20px" /></a><button class="video-studio__icon" type="button" aria-label="Remover locução" :disabled="!mayEdit" @click="removeNarration"><q-icon name="mdi-delete-outline" size="20px" /></button>
            </div>
          </div>

          <div v-else class="video-studio__section">
            <div class="video-studio__scene-heading"><h2>{{ transitionMode ? 'Gerar transição' : 'Gerar clipe' }}</h2><span v-if="selectedModel" class="video-studio__selected-model">{{ selectedModel.name }}</span></div>
            <div v-if="selectedReferenceVariant && !maxImageReferences" class="video-studio__actions">
              <button class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="selectReferenceVariant"><q-icon name="mdi-image-multiple-outline" size="18px" /> Usar referências neste modelo</button>
            </div>
            <label v-if="referenceChoices.length > 1">Modelo neste modo
              <select :value="referenceModel?.id" :disabled="!mayEdit || Boolean(busy)" @change="referenceModelId = $event.target.value">
                <option v-for="model in referenceChoices" :key="model.id" :value="model.id">{{ model.label }}</option>
              </select>
            </label>
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
            <div v-else-if="!continuationMode && ((selectedConfig && supportsVideoReference) || maxImageReferences || reference || referenceImages.length)" class="video-studio__reference">
              <h3>{{ generationMode === 'text' ? 'Referências opcionais' : 'Referências' }}</h3>
              <input ref="referenceInput" type="file" accept="video/mp4,.mp4" hidden @change="fileFrom($event, chooseReference)" />
              <button v-if="supportsVideoReference" class="video-studio__drop" type="button" :disabled="!mayEdit" @dragover.prevent @drop.prevent="chooseReference($event.dataTransfer.files[0])" @click="referenceInput?.click()"><q-icon name="mdi-file-video-outline" size="24px" /><span><strong>{{ reference?.file.name || 'Anexar vídeo-base' }}</strong><small>{{ referenceModel?.sourceDuration ? `MP4 de ${referenceModel.sourceSecondsMin ?? 4} a 5 segundos, até 60 MB` : 'MP4 de até 60 MB' }}</small></span></button>
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
              <p v-if="reference && !supportsVideoReference" class="video-studio__hint">Remova o vídeo-base para usar este modelo.</p>
              <p v-else-if="referenceModel?.requiresVideo && !reference" class="video-studio__hint">Adicione o vídeo-base para usar este modelo.</p>
              <p v-else-if="referenceImages.length < minimumImageReferences" class="video-studio__hint">Adicione {{ minimumImageReferences === 1 ? 'uma imagem' : `pelo menos ${minimumImageReferences} imagens` }} para usar este modelo.</p>
              <p v-else-if="referenceImages.length > maxImageReferences" class="video-studio__hint">{{ maxImageReferences ? `Remova imagens para respeitar o limite de ${maxImageReferences} neste modo.` : 'Remova as imagens para usar este modelo.' }}</p>
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
            <label v-if="acceptsVoiceReference && voiceComponents.length">Voz de referência
              <select v-model="voiceReferenceId" :disabled="!mayEdit || Boolean(busy)">
                <option value="">Sem referência de voz</option>
                <option v-for="item in voiceComponents" :key="item.id" :value="item.id">{{ item.title }}</option>
              </select>
            </label>
            <p v-if="scriptTarget && offer && offer.seconds !== scriptTarget.duration" class="video-studio__hint">
              O modelo gera {{ offer.seconds }} s. A cena terá {{ scriptTarget.duration }} s no vídeo master.
            </p>
            <p v-if="videoQuote?.estimated" class="video-studio__estimate" role="status"><q-icon name="mdi-information-outline" size="18px" />
              O custo será confirmado após a geração.
            </p>
            <div class="video-studio__actions">
              <button v-if="!signedIn" class="video-studio__primary" type="button" @click="showAuth()">Criar conta para usar IA</button>
              <button v-else-if="activeJob && !busy" class="video-studio__primary" type="button" @click="checkJob"><q-icon name="mdi-refresh" size="20px" /> Verificar geração</button>
              <button v-else class="video-studio__primary" type="button" :disabled="!mayEdit || Boolean(busy) || !canQuoteVideo" @click="makeVideo"><q-spinner v-if="busy === 'video' || busy === 'quote'" size="19px" /><q-icon v-else :name="videoQuote ? 'mdi-movie-open-play-outline' : 'mdi-calculator-variant-outline'" size="19px" /> {{ busy === 'video' ? 'Gerando clipe…' : busy === 'quote' ? 'Consultando preço…' : videoQuote?.estimated ? 'Confirmar reserva e gerar' : videoQuote ? 'Confirmar geração' : 'Consultar preço' }}<span v-if="quoteCost && !busy"> · Até {{ quoteCost }}</span></button>
            </div>
          </div>
        </section>

        <section v-if="tab === 'ai' && !remakeMode" class="video-studio__panel video-studio__preview video-studio__preview--clips" aria-label="Clipes do projeto">
            <header><h2>Clipes do projeto</h2><span v-if="clipLibrary.length">{{ clipLibrary.length }} {{ clipLibrary.length === 1 ? 'clipe' : 'clipes' }}</span></header>
            <div v-if="generated" class="video-studio__generated">
              <div class="video-studio__clip-list" role="group" aria-label="Clipes gerados"><button v-for="clip in clipLibrary" :key="clip.id" class="video-studio__secondary" type="button" :aria-pressed="clip.id === generated.id" :disabled="!mayEdit" @click="selectGenerated(clip)">Clipe {{ clip.number }}</button></div>
              <p v-if="generated.expired" class="video-studio__hint">Este clipe expirou. Baixe os demais clipes ou gere uma nova cena.</p>
              <video v-else :src="generated.url" controls playsinline preload="metadata" referrerpolicy="no-referrer" aria-label="Clipe gerado com IA" @loadedmetadata="generatedDuration = $event.target.duration" />
              <small v-if="!generated.expired" class="video-studio__hint">Disponível até {{ displayDate.format(generated.expiresAt) }}</small>
              <p v-if="!generated.expired && generated.reservedUsdCents !== undefined" class="video-studio__estimate">
                <template v-if="reservedCost">Reserva inicial de {{ reservedCost }}. </template>{{ adminMode ? 'Consulte os logs do Aito Admin para conferir o custo.' : 'Consulte o histórico da carteira para conferir o custo.' }}
              </p>
              <div class="video-studio__actions">
                <button v-if="!generated.expired" class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="addGenerated"><q-icon name="mdi-swap-horizontal" size="18px" /> Usar na cena atual</button>
                <button v-if="!generated.expired" class="video-studio__primary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="addGeneratedSequence()"><q-icon name="mdi-playlist-plus" size="18px" /> Adicionar ao vídeo master</button>
                <button v-if="signedIn && !generated.expired" class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="shareClip"><q-icon name="mdi-folder-plus-outline" size="18px" /> Salvar em projeto</button>
                <button v-if="!generated.expired && generated.file?.type === 'video/mp4'" class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="clipVariation"><q-icon name="mdi-creation-outline" size="18px" /> Gerar variação</button>
                <button v-if="!generated.expired" class="video-studio__icon" type="button" aria-label="Baixar clipe original"
                  :disabled="!mayEdit || Boolean(busy)" @click="downloadGenerated"><q-icon name="mdi-download-outline" size="20px" /><q-tooltip>Baixar clipe original</q-tooltip></button>
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

        <section v-else-if="tab !== 'ai'" class="video-studio__panel video-studio__preview" aria-labelledby="video-studio-preview">
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
    </q-page-container>
    <q-footer class="video-studio__timeline" aria-label="Vídeo master" @paste="pasteStudioMedia">
      <div class="video-studio__master-inner">
        <q-btn class="video-studio__master-toggle" flat no-caps align="left" :aria-expanded="masterOpen" aria-controls="video-studio-master-controls"
          :aria-label="masterOpen ? 'Minimizar vídeo master' : 'Expandir vídeo master'" @click="masterOpen = !masterOpen">
          <q-icon name="mdi-filmstrip" size="20px" aria-hidden="true" />
          <strong>Vídeo master</strong>
          <span class="video-studio__master-count">{{ scenes.length }} {{ scenes.length === 1 ? 'cena' : 'cenas' }} · {{ durationLabel(timeline.duration) }}</span>
          <q-icon :name="masterOpen ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="23px" aria-hidden="true" />
        </q-btn>
        <div v-show="masterOpen" id="video-studio-master-controls" class="video-studio__master-controls">
          <div class="video-studio__actions">
            <button class="video-studio__primary" type="button" :disabled="!mayEdit" @click="createForScene"><q-icon name="mdi-creation-outline" size="18px" /> Gerar cena</button>
            <input ref="importInput" type="file" accept="video/*" hidden @change="fileFrom($event, importClip)" />
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit || Boolean(busy)" @click="importInput?.click()"><q-icon name="mdi-upload-outline" size="18px" /> Importar vídeo</button>
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit" @click="openInventory"><q-icon name="mdi-folder-multiple-outline" size="18px" /> Adicionar do projeto</button>
            <button class="video-studio__secondary" type="button" :disabled="!mayEdit || scenes.length >= maxStudioScenes" @click="addScene"><q-icon name="mdi-plus" size="18px" /> Cena vazia</button>
            <button class="video-studio__icon" type="button" aria-label="Desfazer edição" :disabled="!mayEdit || !history.length" @click="undoEdit"><q-icon name="mdi-undo" size="20px" /></button>
          </div>
          <div v-if="scenes.length" class="video-studio__scenes" role="group" aria-label="Cenas" @dragover.prevent @drop.prevent="dragItem ? cancelDrag() : importClip($event.dataTransfer.files[0])">
            <template v-for="({ scene, start, end }, index) in timeline.segments" :key="scene.id">
            <button type="button" :aria-pressed="sceneId === scene.id" :disabled="!mayEdit"
              :draggable="mayEdit" :class="{ 'video-studio__scene-drop': dragTarget === scene.id && dragItem !== scene.id }"
              @dragstart="dragItem = scene.id; $event.dataTransfer.setData('text/plain', scene.id)" @dragend="cancelDrag"
              @dragover.prevent="dragTarget = scene.id" @drop="dragItem && finishDrag(scene.id)" @click="selectMasterScene(scene.id)">
              <span class="video-studio__scene-thumb"><img v-if="scene.media?.poster || (scene.media && !scene.media.isVideo)" :src="scene.media.poster || scene.media.url" alt="" loading="lazy" /><q-icon v-else :name="scene.media ? 'mdi-filmstrip' : 'mdi-image-outline'" size="20px" /></span>
              <span class="video-studio__scene-label"><strong>{{ scene.heading || (scene.kind === 'transition' ? 'Transição' : `Cena ${index + 1}`) }}</strong><small>{{ durationLabel(start) }} · {{ (end - start).toFixed(1) }} s</small><small v-if="unavailableScene(scene)">Mídia indisponível</small></span>
            </button>
            <span v-if="index < scenes.length - 1" class="video-studio__transition-slot">
              <button type="button" class="video-studio__transition-add" :aria-label="`Adicionar transição entre cenas ${index + 1} e ${index + 2}`"
                :disabled="!mayEdit || Boolean(busy) || Boolean(activeJob) || scenes.length >= maxStudioScenes || !transitionReady(scene, scenes[index + 1])"
                @click="openTimelineTransition(index)"><q-icon name="mdi-plus" size="18px" /></button>
              <q-tooltip>{{ transitionReady(scene, scenes[index + 1]) ? (scenes.length >= maxStudioScenes ? 'Libere espaço no vídeo master' : 'Gerar transição com IA') : 'Adicione mídia nas duas cenas' }}</q-tooltip>
            </span>
            </template>
          </div>
          <p v-else class="video-studio__hint">Adicione uma cena ou gere um clipe com IA para começar.</p>
        </div>
      </div>
    </q-footer>
    <q-dialog v-model="transitionDialogOpen" :persistent="Boolean(busy)" aria-labelledby="video-transition-title" @hide="timelineTransition = null">
      <q-card v-if="timelineTransition" class="aito-ai-theme video-studio__dialog" @paste="pasteTimelineTransitionFiles">
        <q-card-section class="video-studio__scene-heading">
          <h2 id="video-transition-title">Transição entre cenas</h2>
          <q-btn v-close-popup flat round dense icon="mdi-close" :disable="Boolean(busy)" aria-label="Fechar transição" />
        </q-card-section>
        <q-card-section class="video-studio__dialog-list">
          <div class="video-studio__transition-boundaries">
            <span><strong>Quadro final</strong>{{ timelineTransition.before.heading || `Cena ${timelineTransition.index + 1}` }}</span>
            <q-icon name="mdi-arrow-right" size="21px" />
            <span><strong>Quadro inicial</strong>{{ timelineTransition.after.heading || `Cena ${timelineTransition.index + 2}` }}</span>
          </div>
          <label>Como conectar as cenas?<textarea :value="timelineTransition.prompt" rows="3" maxlength="2000" :disabled="Boolean(busy) || Boolean(activeJob)"
            placeholder="Ex.: A câmera passa pela porta e acompanha a personagem até a próxima cena."
            @input="updateTimelineTransition({ prompt: $event.target.value, quote: null, error: '' })" /></label>
          <input ref="transitionFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            @change="addTimelineTransitionFiles($event.target.files); $event.target.value = ''" />
          <button class="video-studio__secondary" type="button" :disabled="Boolean(busy) || Boolean(activeJob) || timelineTransition.files.length >= maxTimelineTransitionFiles"
            @click="transitionFileInput?.click()" @dragover.prevent @drop.prevent="addTimelineTransitionFiles($event.dataTransfer.files)">
            <q-icon name="mdi-paperclip" size="18px" /> Anexar imagens opcionais ({{ timelineTransition.files.length }}/{{ maxTimelineTransitionFiles }})
          </button>
          <ul v-if="timelineTransition.files.length" class="video-studio__transition-filelist">
            <li v-for="(file, index) in timelineTransition.files" :key="index">
              <span>{{ file.name }}</span>
              <q-btn flat round dense icon="mdi-close" :aria-label="`Remover ${file.name}`" :disable="Boolean(busy) || Boolean(activeJob)"
                @click="updateTimelineTransition({ files: timelineTransition.files.filter((_, row) => row !== index), quote: null, error: '' })" />
            </li>
          </ul>
          <p v-if="timelineTransition.error" class="video-studio__notice video-studio__notice--error" role="alert">{{ timelineTransition.error }}</p>
          <p v-else-if="optionsLoading" class="video-studio__hint" role="status">Consultando modelo de transição…</p>
          <p v-else-if="!transitionDialogOffer" class="video-studio__hint" role="status">O modelo de transição está indisponível para este formato.</p>
          <p v-if="timelineTransition.quote && !busy" class="video-studio__estimate" role="status">Até {{ tokenCost(timelineTransition.quote.billedUsdCents) }} · 3 s · 720p</p>
          <AitoVideoProgress v-if="busy === 'transition-generate'" :stage="activeJob?.status || 'submitting'" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Fechar" :disable="Boolean(busy)" />
          <q-btn v-if="activeJob?.timelineTransition" no-caps unelevated color="teal-8" icon="mdi-refresh" label="Verificar transição"
            :disable="Boolean(busy)" @click="checkJob" />
          <q-btn v-else no-caps unelevated color="teal-8" icon="mdi-transition"
            :label="timelineTransition.quote ? 'Confirmar e gerar' : 'Cotar transição'" :loading="busy === 'transition-quote'"
            :disable="Boolean(busy) || Boolean(activeJob) || !transitionDialogOffer || !timelineTransition.prompt.trim()" @click="createTimelineTransition" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="inventoryOpen" persistent>
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
    <q-dialog v-model="projectColorOpen" aria-labelledby="video-project-color">
      <q-card class="aito-ai-theme video-studio__dialog video-studio__color-dialog">
        <q-card-section class="video-studio__scene-heading"><h2 id="video-project-color">Cor do projeto</h2><q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar seletor de cor" /></q-card-section>
        <q-card-section><q-color dark flat bordered format-model="hex" class="full-width" :model-value="projectColor" @update:model-value="setProjectColor" /></q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="scriptOpen" :persistent="busy === 'script'">
      <q-card class="aito-ai-theme video-studio__dialog video-studio__plan">
        <q-card-section class="video-studio__plan-header">
          <div><h2>Roteiro do projeto</h2><p>{{ projectTitle }}</p></div>
          <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar roteiro" :disable="Boolean(busy)" />
        </q-card-section>
        <q-card-section class="scroll video-studio__plan-body">
          <p v-if="scriptError" role="alert" class="video-studio__notice video-studio__notice--error">{{ scriptError }}</p>
          <label>Briefing<textarea v-model="scriptPrompt" rows="2" maxlength="3000" placeholder="Ex.: Reels mostrando como uma ideia vira vídeo" :disabled="Boolean(busy)" /></label>
          <label>Roteiro master
            <span class="video-studio__plan-editor">
              <textarea v-model="masterScript" rows="5" maxlength="6000" placeholder="Escreva o panorama do vídeo e as referências que precisam se manter em todas as cenas." :disabled="Boolean(busy)" />
              <q-btn flat round dense icon="mdi-creation-outline" aria-label="Gerar roteiro master com IA" :loading="busy === 'script'"
                :disable="Boolean(busy) || !scriptPrompt.trim()" @click="writeProjectScript('master')"><q-tooltip>Gerar roteiro master com IA</q-tooltip></q-btn>
            </span>
          </label>
          <div class="video-studio__scene-heading video-studio__plan-actions">
            <h3>Roteiros de cena</h3>
            <div class="video-studio__actions">
              <q-btn outline no-caps icon="mdi-creation-outline" label="Dividir com IA" :loading="busy === 'script'"
                :disable="Boolean(busy) || (!scriptPrompt.trim() && !masterScript.trim())" @click="writeProjectScript('scenes')" />
              <q-btn outline no-caps icon="mdi-plus" label="Adicionar cena" :disable="Boolean(busy) || sceneScripts.length >= maxStudioScenes" @click="addScriptScene" />
            </div>
          </div>
          <article v-for="(item, index) in sceneScripts" :key="item.id" class="video-studio__plan-card">
            <div class="video-studio__scene-heading">
              <strong>Cena {{ index + 1 }}</strong>
              <q-btn flat round dense icon="mdi-delete-outline" :aria-label="`Excluir roteiro da cena ${index + 1}`" :disable="Boolean(busy)"
                @click="sceneScripts = sceneScripts.filter(row => row.id !== item.id)" />
            </div>
            <div class="video-studio__fields">
              <label>Título<input :value="item.title" maxlength="100" :disabled="Boolean(busy)" @input="updateScriptScene(item.id, { title: $event.target.value })" /></label>
              <label>Tempo aproximado<select :value="item.duration" :disabled="Boolean(busy)" @change="updateScriptScene(item.id, { duration: $event.target.value })">
                <option v-for="seconds in studioAiSeconds" :key="seconds" :value="seconds">{{ seconds }} s</option>
              </select></label>
            </div>
            <label>Roteiro da cena<textarea :value="item.prompt" rows="3" maxlength="1500" placeholder="Ação, enquadramento, expressão e fala" :disabled="Boolean(busy)"
              @input="updateScriptScene(item.id, { prompt: $event.target.value })" /></label>
            <q-select v-if="projectComponents.length" dense dark outlined multiple emit-value map-options use-chips label="Componentes da cena"
              :model-value="item.componentIds" :options="projectComponents" :max-values="12" option-label="title" option-value="id" :disable="Boolean(busy)"
              @update:model-value="value => updateScriptScene(item.id, { componentIds: value })" />
            <div class="video-studio__actions">
              <q-btn outline no-caps icon="mdi-creation-outline" label="Refinar com IA" :disable="Boolean(busy) || !item.prompt.trim()" @click="writeProjectScript('refine', item)" />
              <button type="button" class="video-studio__primary" :disabled="Boolean(busy) || Boolean(activeJob) || !item.prompt.trim()" @click="prepareScriptScene(item)">
                <q-icon name="mdi-movie-open-play-outline" size="18px" /> {{ scenes.some(scene => scene.scriptId === item.id) ? 'Gerar de novo' : 'Gerar cena' }}
              </button>
            </div>
          </article>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="componentOpen" persistent>
      <q-card class="aito-ai-theme video-studio__dialog">
        <q-card-section class="video-studio__scene-heading"><h2>{{ componentForm ? `${editingComponent ? 'Editar' : 'Adicionar'} ${componentName}` : componentType }}</h2><q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar componentes" /></q-card-section>
        <q-card-section class="video-studio__dialog-list">
          <template v-if="componentForm">
            <p v-if="componentError" role="alert" class="video-studio__notice video-studio__notice--error">{{ componentError }}</p>
            <label>Nome<input :value="componentForm.title" maxlength="80" @input="updateComponentForm({ title: $event.target.value })" /></label>
            <label>Descrição ou prompt<textarea :value="componentForm.prompt" rows="3" maxlength="2000" @input="updateComponentForm({ prompt: $event.target.value })" /></label>
            <label v-if="componentType === voiceComponentType">Arquivo de áudio de até 3 segundos
              <input type="file" accept="audio/*,.mp3,.wav,.m4a" :disabled="componentLoading" @change="fileFrom($event, setComponentVoice)" />
            </label>
            <video v-else-if="componentVideo(componentForm)" class="video-studio__reference-preview" :src="componentPosters.get(componentForm.file)" controls playsinline preload="metadata" aria-label="Clipe salvo" />
            <label v-else>Imagem de referência<input type="file" accept="image/jpeg,image/png,image/webp" @change="fileFrom($event, setComponentImage)" /></label>
            <label v-if="componentType === 'Personagens'">Voz do personagem
              <select :value="componentForm.voiceId || ''" @change="updateComponentForm({ voiceId: $event.target.value })">
                <option value="">Sem voz vinculada</option>
                <option v-for="sample in voiceComponents" :key="sample.id" :value="sample.id">{{ sample.title }}</option>
              </select>
            </label>
            <audio v-if="componentVoicePreview" class="video-studio__audio" controls preload="metadata" :src="componentVoicePreview" aria-label="Ouvir voz de referência" />
            <span v-if="componentForm.file" class="video-studio__hint">{{ componentForm.file.name }}</span>
            <div class="video-studio__actions">
              <button type="button" class="video-studio__secondary" @click="componentForm = null">Cancelar</button>
              <button type="button" class="video-studio__primary" :disabled="componentLoading || !componentForm.title.trim() || (componentType === voiceComponentType && !componentForm.file)" @click="saveComponent">Salvar</button>
            </div>
          </template>
          <template v-else>
            <label>Buscar componente<input v-model="inventoryQuery" type="search" /></label>
            <div class="video-studio__actions">
              <button type="button" class="video-studio__primary" @click="editComponent()"><q-icon name="mdi-plus" /> Adicionar {{ componentName }}</button>
              <button v-if="componentType === 'Cenas'" type="button" class="video-studio__secondary" @click="componentOpen = false; openInventory()">Ver clipes prontos</button>
            </div>
            <div v-if="!builtInComponentTypes.includes(componentType)" class="video-studio__actions">
              <label>Renomear tipo<input v-model.trim="componentTypeName" maxlength="32" /></label>
              <button type="button" class="video-studio__secondary" :disabled="!componentTypeName" @click="changeCustomType(0, true)">Renomear</button>
              <button type="button" class="video-studio__icon" aria-label="Mover tipo para cima" @click="changeCustomType(-1)"><q-icon name="mdi-chevron-up" /></button>
              <button type="button" class="video-studio__icon" aria-label="Mover tipo para baixo" @click="changeCustomType(1)"><q-icon name="mdi-chevron-down" /></button>
            </div>
            <div v-for="item in matchingComponents" :key="item.id" class="video-studio__inventory-item">
              <video v-if="componentVideo(item)" :src="componentPosters.get(item.file)" class="video-studio__component-thumb" muted playsinline preload="metadata" :aria-label="item.title" />
              <img v-else-if="item.type !== voiceComponentType && componentPosters.has(item.file)" :src="componentPosters.get(item.file)" class="video-studio__component-thumb" alt="" loading="lazy" /><q-icon v-else :name="item.type === voiceComponentType ? 'mdi-waveform' : 'mdi-image-text'" size="23px" />
              <span><strong>{{ item.title }}</strong><small>{{ item.prompt }}</small><small v-if="item.voiceId">{{ voiceComponents.find(voice => voice.id === item.voiceId)?.title }}</small></span>
              <button type="button" class="video-studio__secondary" @click="useComponent(item)">{{ remakeMode && isRemakeReference(item) ? 'Usar em Refazer vídeos' : 'Usar' }}</button>
              <button type="button" class="video-studio__secondary" @click="useComponent(item, true)">Gerar variação</button>
              <button type="button" class="video-studio__icon" :aria-label="`Editar ${item.title}`" @click="editComponent(item)"><q-icon name="mdi-pencil-outline" /></button>
              <button v-if="item.type === 'Cenas' && item.file" type="button" class="video-studio__icon" :aria-label="`Baixar ${item.title}`"
                @click="downloadAitoIAFile(item.file, item.file.name)"><q-icon name="mdi-download-outline" size="20px" /><q-tooltip>Baixar mídia da cena</q-tooltip></button>
              <button type="button" class="video-studio__icon" :aria-label="`Excluir ${item.title}`" @click="removeComponent(item)"><q-icon name="mdi-delete-outline" /></button>
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
  </q-layout>
</template>

<style scoped>
.video-studio { min-height: 100dvh; color: var(--aito-ai-text); background: radial-gradient(ellipse at 15% 28%, #663d7641, transparent 48%), radial-gradient(ellipse at 100% 45%, #154d6757, transparent 52%), var(--aito-ai-glow), var(--aito-ai-bg); font-family: var(--aito-ai-font); }
.video-studio button, .video-studio input, .video-studio textarea, .video-studio select { font: inherit; }
.video-studio button, .video-studio a { -webkit-tap-highlight-color: transparent; }
.video-studio button:focus-visible, .video-studio a:focus-visible, .video-studio input:focus-visible, .video-studio select:focus-visible, .video-studio textarea:focus-visible, .video-studio summary:focus-visible { outline: 2px solid var(--aito-ai-purple); outline-offset: 3px; }
.video-studio button:disabled { cursor: not-allowed; opacity: .54; }
.video-studio a { text-decoration: none; }
.video-studio h1, .video-studio h2, .video-studio h3, .video-studio p { margin: 0; }
.video-studio__header { background: var(--aito-ai-surface); color: var(--aito-ai-text); }
.video-studio__bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: calc(8px + env(safe-area-inset-top, 0px)) clamp(14px, 3vw, 40px) 8px; border-bottom: 1px solid var(--aito-ai-line); background: var(--aito-ai-surface); }
.video-studio__header-start, .video-studio__brand, .video-studio__mode, .video-studio__account, .video-studio__balance { display: flex; align-items: center; }
.video-studio__header-start { gap: 8px; min-width: 0; }
.video-studio__header-start .q-btn { color: var(--aito-ai-accent); }
.video-studio__brand { width: max-content; gap: 6px; color: var(--aito-ai-text); font-size: 1.12rem; }
.video-studio__mode { justify-content: center; }
.video-studio__account { justify-self: end; gap: 8px; }
.video-studio__balance { gap: 6px; min-height: 36px; padding: 4px 7px; border: 1px solid var(--aito-ai-gold-line); border-radius: 8px; background: var(--aito-ai-gold-soft); color: var(--aito-ai-gold); cursor: pointer; white-space: nowrap; }
.video-studio__login, .video-studio__icon { border: 0; padding: 5px; border-radius: 7px; background: transparent; color: var(--aito-ai-muted); cursor: pointer; }
.video-studio__icon { display: inline-grid; width: 35px; height: 35px; place-items: center; }
.video-studio__icon:not(:disabled):hover, .video-studio__login:hover { color: var(--aito-ai-accent); background: var(--aito-ai-raised); }
.video-studio__main { width: min(1660px, 100%); margin: 0 auto; padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 36px) 45px; }
.video-studio__intro { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 25px; }
.video-studio__project-heading { min-width: 0; }
.video-studio__project-name { display: flex; align-items: center; gap: 6px; }
.video-studio__intro h1 { font-size: clamp(2rem, 4vw, 3.15rem); line-height: 1.05; font-weight: 780; letter-spacing: -.045em; overflow-wrap: anywhere; }
.video-studio__color-button { flex: none; width: 44px; height: 44px; }
.video-studio__color-dot { display: block; width: 24px; height: 24px; border: 2px solid var(--aito-ai-line); border-radius: 50%; }
.video-studio__color-dialog { max-width: 350px; }
.video-studio__intro p { margin-top: 10px; color: var(--aito-ai-muted); }
.video-studio__zip { display: grid; gap: 5px; justify-items: end; }
.video-studio__grid { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(0, .82fr); align-items: start; gap: 14px; scroll-margin-top: calc(var(--video-header-height) + 6px); }
.video-studio__panel { min-width: 0; border: 1px solid var(--aito-ai-line); border-radius: 16px; background: linear-gradient(145deg, #1835356b, transparent 58%), var(--aito-ai-surface); }
.video-studio :deep(.video-studio__drawer) { color: var(--aito-ai-text); background: var(--aito-ai-surface); border-color: var(--aito-ai-line); }
.video-studio__drawer-content { display: flex; min-height: 100%; flex-direction: column; gap: 20px; padding: 20px 18px max(16px, env(safe-area-inset-bottom, 0px)); }
.video-studio__drawer-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.video-studio__drawer-heading span { display: block; margin-bottom: 4px; font-size: .76rem; color: var(--aito-ai-muted); }
.video-studio__drawer-section { display: grid; gap: 12px; padding-bottom: 19px; border-bottom: 1px solid var(--aito-ai-line); }
.video-studio__drawer-list { overflow: hidden; border-radius: 10px; border-color: var(--aito-ai-line); background: var(--aito-ai-panel); }
.video-studio__drawer-list :deep(.q-item) { min-height: 44px; padding: 7px 10px; }
.video-studio__drawer-list :deep(.q-item__section--avatar) { min-width: 33px; color: var(--aito-ai-accent); }
.video-studio__drawer-add { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.video-studio__drawer-footer { padding-top: 4px; margin-top: auto; }
.video-studio__drawer-footer .q-btn { width: 100%; border: 1px solid var(--aito-ai-line); color: var(--aito-ai-accent); }
.video-studio__editor { grid-column: 2; grid-row: 2; overflow: hidden; }
.video-studio__tabs { grid-column: 1 / -1; grid-row: 1; width: min(620px, 100%); padding: 5px; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-panel); }
.video-studio__tabs :deep(.q-tab) { min-height: 40px; min-width: 0; padding: 0 5px; color: var(--aito-ai-muted); border-radius: 8px; }
.video-studio__tabs :deep(.q-tab__content) { flex-direction: row; gap: 6px; min-width: 0; }
.video-studio__tabs :deep(.q-tab__icon) { width: 18px; height: 18px; font-size: 18px; }
.video-studio__tabs :deep(.q-tab--active) { color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); }
.video-studio__tabs--voice :deep(.q-tab--active) { color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); }
.video-studio__tabs--ai :deep(.q-tab--active) { color: var(--aito-ai-purple); background: var(--aito-ai-purple-soft); }
.video-studio__script-btn { color: var(--aito-ai-purple); border-radius: 8px; background: var(--aito-ai-purple-soft); }
.video-studio__section, .video-studio__preview { display: grid; gap: 14px; padding: clamp(13px, 2vw, 20px); }
.video-studio__preview { grid-column: 1; grid-row: 2; }
.video-studio__grid--generate .video-studio__editor { grid-column: 1; grid-row: 3; }
.video-studio__grid--generate > .aito-remake { grid-column: 1 / -1; grid-row: 3; order: 3; }
.video-studio__grid--generate .video-studio__editor { background: linear-gradient(140deg, #39305783, transparent 58%), var(--aito-ai-surface); }
.video-studio__preview--clips { grid-column: 2; grid-row: 3; }
.video-studio__scene-heading, .video-studio__preview header, .video-studio__audio-meta { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.video-studio h2 { font-size: 1.13rem; font-weight: 730; line-height: 1.2; }
.video-studio h3 { font-size: 1rem; font-weight: 700; line-height: 1.2; }
.video-studio__preview header span, .video-studio__hint { color: var(--aito-ai-muted); font-size: .84rem; }
.video-studio__fields { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, .9fr); gap: 10px; }
.video-studio__fields--clip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.video-studio__catalog { grid-column: 1 / -1; grid-row: 2; min-width: 0; display: grid; gap: 12px; }
.video-studio__catalog-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.video-studio__catalog-header p { margin-top: 4px; color: var(--aito-ai-muted); font-size: .9rem; }
.video-studio__catalog-models { overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 11px; background: var(--aito-ai-surface); }
.video-studio__catalog-models :deep(.q-item) { min-height: 49px; padding: 8px 12px; }
.video-studio__catalog-models :deep(.q-item__section--avatar) { min-width: 36px; color: var(--aito-ai-accent); }
.video-studio__catalog-models :deep(.q-item__label--caption) { color: var(--aito-ai-accent); }
.video-studio__model-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 5px 10px 10px; }
.video-studio__model-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 5px; border: 1px solid var(--aito-ai-line); border-radius: 13px; background: var(--aito-ai-surface); }
.video-studio__model-card--selected, .video-studio__model-card:has(.video-studio__model-hit:not(:disabled):hover) { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-panel); }
.video-studio__model-poster { position: relative; aspect-ratio: 2.35 / 1; max-height: 125px; overflow: hidden; border-radius: 8px; background-color: var(--aito-ai-panel); background-image: url('/aitoia-model-posters.webp'); background-size: 200% 400%; }
.video-studio__model-poster--symbol { display: grid; place-items: center; color: var(--aito-ai-accent); background: radial-gradient(ellipse at center, #34404d, #171a20 76%); }
.video-studio__model-type { position: absolute; top: 8px; left: 8px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; background: #281d3aeb; color: #f7dff9; font-size: .69rem; font-weight: 700; }
.video-studio__model-type--image { background: #082f25eb; color: #d7ffed; }
.video-studio__model-content { display: grid; flex: 1; grid-template-rows: auto 1fr auto; gap: 5px; padding: 7px 7px 5px; }
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
.video-studio input:not([type=range], .q-field__native), .video-studio textarea, .video-studio select { width: 100%; padding: 9px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-bg); }
.video-studio textarea { min-height: 60px; resize: vertical; }
.video-studio input::placeholder, .video-studio textarea::placeholder { color: var(--aito-ai-muted); opacity: .75; }
.video-studio__timeline { --aito-ai-bg: #0b0c0e; --aito-ai-panel: #1a1c20; --aito-ai-line: #3a3d43; --aito-ai-muted: #c6c9ce; --aito-ai-text: #f5f6f8; padding-bottom: env(safe-area-inset-bottom, 0px); border-top: 1px solid var(--aito-ai-line); background: linear-gradient(155deg, #26272b 0%, #141518 50%, #090a0b 100%); color: var(--aito-ai-text); box-shadow: 0 -6px 24px #0009; }
.video-studio__master-inner { width: min(1660px, 100%); min-width: 0; margin: 0 auto; padding-inline: max(10px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-right, 0px)); }
.video-studio__master-toggle { display: flex; width: 100%; min-height: 48px; color: var(--aito-ai-accent); }
.video-studio__master-toggle :deep(.q-btn__content) { width: 100%; flex-wrap: nowrap; gap: 7px; }
.video-studio__master-count { margin-inline-start: auto; color: var(--aito-ai-muted); white-space: nowrap; font-size: .76rem; }
.video-studio__master-controls { display: grid; gap: 10px; min-width: 0; max-height: min(36dvh, 260px); padding: 7px 6px 10px; border-top: 1px solid var(--aito-ai-line); overflow: auto; overscroll-behavior: contain; }
.video-studio__scenes { display: flex; overflow-x: auto; gap: 8px; padding: 3px 2px 5px; scroll-snap-type: x proximity; overscroll-behavior-inline: contain; }
.video-studio__scenes button { display: flex; flex: 0 0 clamp(126px, 18vw, 178px); align-items: center; gap: 7px; min-width: 0; padding: 6px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); cursor: pointer; text-align: left; }
.video-studio__scene-thumb { display: grid; flex: 0 0 43px; height: 34px; place-items: center; overflow: hidden; border-radius: 5px; background: var(--aito-ai-bg); }
.video-studio__scene-thumb img { width: 100%; height: 100%; object-fit: cover; }
.video-studio__scene-label { display: grid; min-width: 0; gap: 1px; }
.video-studio__scene-label strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .84rem; }
.video-studio__scene-label small { font-size: .72rem; }
.video-studio__scenes button[aria-pressed=true] { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.video-studio__scenes .video-studio__scene-drop { border-color: var(--aito-ai-gold); box-shadow: -3px 0 var(--aito-ai-gold); }
.video-studio__transition-slot { display: grid; flex: 0 0 auto; align-items: center; }
.video-studio__scenes .video-studio__transition-add { display: grid; min-width: 32px; min-height: 32px; place-items: center; padding: 3px; border-radius: 50%; border-style: dashed; color: var(--aito-ai-purple); background: var(--aito-ai-purple-soft); }
.video-studio__transition-boundaries { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 10px; text-align: center; }
.video-studio__transition-boundaries span { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; padding: 8px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); }
.video-studio__transition-boundaries strong, .video-studio__transition-boundaries .q-icon { color: var(--aito-ai-accent); }
.video-studio__transition-filelist { display: grid; gap: 4px; padding: 0; margin: 0; list-style: none; }
.video-studio__transition-filelist li { display: flex; align-items: center; justify-content: space-between; gap: 5px; min-width: 0; }
.video-studio__transition-filelist span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
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
.video-studio__generation-modes .video-studio__remake-button { border-color: var(--aito-ai-purple-line); color: var(--aito-ai-purple); }
.video-studio__generation-modes .video-studio__remake-button[aria-pressed=true] { background: var(--aito-ai-purple-soft); }
.video-studio__estimate { color: var(--aito-ai-gold); font-size: .85rem; }
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
.video-studio__plan { width: min(760px, 95vw); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--aito-ai-purple-line); }
.video-studio__plan-header { display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(130deg, var(--aito-ai-purple-soft), var(--aito-ai-panel)); }
.video-studio__plan-header p { margin: 0; color: var(--aito-ai-muted); }
.video-studio__plan-body { display: grid; gap: 16px; overflow-y: auto; max-height: min(72dvh, 760px); overscroll-behavior: contain; }
.video-studio__plan-editor { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: start; }
.video-studio__plan-editor .q-btn, .video-studio__plan-actions .q-btn { color: var(--aito-ai-purple); }
.video-studio__plan-actions { flex-wrap: wrap; }
.video-studio__plan-card { display: grid; gap: 9px; padding: 12px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-panel); }
.video-studio__plan-card .video-studio__scene-heading { color: var(--aito-ai-accent); }
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
  .video-studio__tabs { position: sticky; top: calc(var(--video-header-height) + 4px); z-index: 8; order: 1; width: 100%; box-shadow: 0 4px 14px #0009; }
  .video-studio__catalog { order: 2; }
  .video-studio__preview { order: 3; }
  .video-studio__master-controls .video-studio__actions :is(button, a) { min-height: 41px; }
  .video-studio__scenes > button { min-height: 52px; scroll-snap-align: start; }
  .video-studio__editor { order: 5; }
  .video-studio__grid--generate .video-studio__editor { order: 3; }
  .video-studio__preview--clips { order: 4; }
  .video-studio__screen canvas { max-height: min(42dvh, 390px); }
}
@media (max-width: 640px) { .video-studio__model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .video-studio__model-content { padding-inline: 5px; } }
@media (max-width: 640px) {
  .video-studio__bar { grid-template-columns: minmax(0, 1fr) auto; padding: calc(6px + env(safe-area-inset-top, 0px)) 8px 6px; gap: 5px; }
  .video-studio__header-start { gap: 2px; }
  .video-studio__header-start .q-btn { min-width: 38px; min-height: 40px; }
  .video-studio__brand { gap: 3px; font-size: .94rem; }
  .video-studio__brand img { width: 30px; height: 30px; }
  .video-studio__mode { grid-row: 2; grid-column: 1 / -1; }
  .video-studio__account { gap: 4px; }
  .video-studio__account :is(button, a) { white-space: nowrap; font-size: .76rem; }
  .video-studio__intro { align-items: flex-start; flex-direction: column; margin-bottom: 15px; }
  .video-studio__intro h1 { font-size: 1.85rem; }
  .video-studio__intro p { margin-top: 4px; }
  .video-studio__zip { justify-items: start; }
  .video-studio__tabs :deep(.q-tab__label) { font-size: .78rem; }
  .video-studio__tabs :deep(.q-tab__content) { gap: 4px; }
}
</style>
