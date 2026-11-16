<script setup>
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import AitoVideoProgress from './AitoVideoProgress.vue'
import AitoVideoModelSelect from './AitoVideoModelSelect.vue'
import AitoRemakeSubtitleRegion from './AitoRemakeSubtitleRegion.vue'
import { aitoTokens } from 'src/composables/useAitoIA'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { AITOIA_RETENTION_MS } from 'src/services/aitoiaLocal'
import { confirmStudioRemoval } from 'src/services/aitoiaStudioConfirm'
import { checkImageReference, putImageReference, putVideoReference, readGeneratedClipForJob } from 'src/services/aitoiaVideoRemote'
import { burnRemakeCaptions, maxRemakeInputBytes, maxRemakeSceneSeconds, prepareRemakeVideoReference,
  remakeInputAccept, remakeSplitDurations, removeRemakeSourceSubtitles, splitRemakeVideo } from 'src/services/aitoiaVideoRemakeSplit'
import { prepareRemakePlan, quoteRemakePlan } from 'src/services/aitoiaVideoRemakePlan'
import { canRetryVideoSubmission, listVideoGenerations, videoGenerationActive, videoGenerationExpiry } from 'src/services/aitoiaVideoJobs'

const props = defineProps({
  references: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  projectScope: String,
  projectExpiresAt: Number,
  draft: Object,
  walletId: String,
  blocked: Boolean,
  allowCredits: { type: Function, required: true },
  access: { type: Function, required: true },
  saveResult: { type: Function, required: true },
  exportResults: { type: Function, required: true },
  exportProgress: { type: Number, default: 0 },
})
const emit = defineEmits(['busy', 'balance', 'wallet', 'login', 'append', 'recover', 'draft', 'component'])
const root = '/aitoia/video/studio/remakes'
const pendingStorageKey = 'aitoia-video-remakes-pending'
const pendingLifetime = AITOIA_RETENTION_MS
const maxReferences = 6
const selectedFile = shallowRef(null)
const subtitleScene = shallowRef(null)
const referencePreview = shallowRef(null)
const splitDuration = ref(remakeSplitDurations[0])
const input = ref(null)
const inputError = ref('')
const action = shallowRef(null)
const progress = ref(0)
const scenes = shallowRef([])
const master = ref('')
const referenceIds = ref([])
const resolution = ref('480p')
let controller
let restoreDraft = false
let draftLoaded = false
let queueRequest
let queueTimer
let discoverJobs = true
let disposed = false
const discardedJobs = ref([])
const previousJobs = shallowRef([])
const projectId = computed(() => props.projectScope?.split(':').at(-1))

const locked = computed(() => Boolean(action.value || props.blocked))
const results = computed(() => scenes.value.filter(scene => scene.result).map(scene => scene.result))
const formatSeconds = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const seconds = value => formatSeconds.format(Math.max(0, Number(value) || 0))
const selectedReferences = ids => ids.map(id => props.references.find(item => item.id === id)).filter(Boolean)
const referencesFor = scene => selectedReferences(scene.referenceIds ?? referenceIds.value)
const modelsFor = scene => props.models.filter(model => scene.duration <= (model.sourceSecondsMax ?? remakeSplitDurations[0]))
const modelFor = scene => {
  const models = modelsFor(scene)
  return models.find(model => model.id === scene.modelId) || models[0]
}
const resolutionFor = scene => {
  const options = modelFor(scene)?.options || []
  const preferred = scene.resolution || resolution.value
  return (options.find(option => option.id === preferred) || options[0])?.id
}
const canQuote = scene => Boolean(scene.file && resolutionFor(scene) &&
  (scene.edit.trim() || scene.dialogue.trim() || scene.subtitleRegion || master.value.trim() || scene.plan || referencesFor(scene).length || scene.captions))
const lockedScene = scene => locked.value || Boolean(scene.job || scene.submitted)
const approximateCharge = (total, estimateCents, estimateTokens) =>
  estimateCents > 0 && Number.isFinite(total) ? Math.round(total * estimateTokens / estimateCents) : 0

function addProjectReference(id) {
  if (locked.value || !props.projectScope || !props.references.some(item => item.id === id)) return false
  const selected = selectedReferences(referenceIds.value).map(item => item.id)
  if (selected.includes(id)) return true
  if (selected.length >= maxReferences) {
    inputError.value = `Escolha até ${maxReferences} personagens ou cenários. Remova uma referência para adicionar outra.`
    return false
  }
  referenceIds.value = [...selected, id]
  inputError.value = ''
  return true
}
defineExpose({ addProjectReference })

function pendingScene(scene) {
  if (!scene.job?.id && !scene.submittedAt) return null
  return { id: scene.job?.id, requestId: scene.requestId, submittedAt: scene.submittedAt,
    sceneId: scene.clientSceneId, status: scene.job?.status, caption: scene.quote?.caption,
    billedUsdCents: scene.quote?.billedUsdCents, tokens: scene.quote?.estimatedAitoTokens, estimated: scene.quote?.estimated,
    modelLabel: scene.quote?.modelLabel || scene.job?.modelLabel }
}

function draftSnapshot() {
  return { master: master.value, referenceIds: [...referenceIds.value], resolution: resolution.value, splitDuration: splitDuration.value,
    discardedJobs: discardedJobs.value,
    scenes: scenes.value.map(scene => ({ index: scene.index, clientSceneId: scene.clientSceneId, start: scene.start, duration: scene.duration,
      providerDuration: scene.providerDuration, file: scene.file, edit: scene.edit, dialogue: scene.dialogue,
      subtitleRegion: scene.subtitleRegion, referenceIds: scene.referenceIds,
      captions: scene.captions, caption: scene.caption, plan: scene.plan, transcript: scene.transcript, planSpend: scene.planSpend,
      modelId: scene.modelId, resolution: scene.resolution,
      ...(scene.result && { result: { ...scene.result, previewUrl: undefined, expiresAt: undefined } }),
      ...(pendingScene(scene) && { pending: pendingScene(scene) }),
    })) }
}

function loadDraft(draft) {
  const pending = readPending()
  const saved = draft?.scenes || []
  const known = new Set(saved.map(item => item.index))
  restoreDraft = true
  subtitleScene.value = null
  releaseScenes(scenes.value)
  scenes.value = []
  master.value = draft?.master || ''
  referenceIds.value = draft?.referenceIds || []
  resolution.value = draft?.resolution || '480p'
  splitDuration.value = remakeSplitDurations.includes(draft?.splitDuration) ? draft.splitDuration : remakeSplitDurations[0]
  discardedJobs.value = (draft?.discardedJobs || []).slice(-300)
  scenes.value = [...saved, ...pending.filter(item => !known.has(item.index))].map(item => {
    const job = !item.result && (item.pending || pending.find(row => row.index === item.index && (!row.sceneId || !item.clientSceneId || row.sceneId === item.clientSceneId)))
    const result = item.result?.file && props.projectExpiresAt > Date.now()
      ? { ...item.result, expiresAt: props.projectExpiresAt, previewUrl: URL.createObjectURL(item.result.file) } : null
    return reactive({ ...item, clientSceneId: item.clientSceneId || job?.sceneId || crypto.randomUUID(),
      requestId: job?.requestId, submittedAt: job?.submittedAt, edit: item.edit || '', dialogue: item.dialogue || '',
      referenceIds: item.referenceIds ?? null, captions: Boolean(item.captions || job?.caption),
      caption: item.caption || job?.caption || '', plan: item.plan || '', planSpend: item.planSpend || 0, result, error: '',
      url: item.file ? URL.createObjectURL(item.file) : '', recovered: !item.file, job: job?.id ? { id: job.id, status: job.status || 'queued' } : null,
      submitted: Boolean(job), quote: job ? { caption: job.caption, billedUsdCents: job.billedUsdCents,
        estimatedAitoTokens: job.tokens, estimated: job.estimated, modelLabel: job.modelLabel } : null })
  }).sort((left, right) => left.index - right.index)
  restoreDraft = false
  draftLoaded = true
}

watch([scenes, master, referenceIds, resolution, splitDuration, discardedJobs], () => {
  if (!restoreDraft && props.projectScope) emit('draft', draftSnapshot())
}, { deep: true, flush: 'sync' })
function clearQuote(scene) {
  if (!scene.job && !scene.submitted) scene.quote = null
  scene.planQuote = null
}
watch([master, referenceIds, () => props.references], () => {
  if (restoreDraft) return
  scenes.value.forEach(scene => {
    if (!scene.job && !scene.submitted) scene.plan = ''
    clearQuote(scene)
  })
}, { flush: 'sync' })
watch([resolution, () => props.walletId], () => {
  scenes.value.forEach(clearQuote)
}, { flush: 'sync' })
watch([() => props.blocked, () => props.projectScope], ([blocked, scope]) => {
  if (!blocked && scope && !draftLoaded) {
    loadDraft(props.draft)
    if (scenes.value.some(scene => scene.job || scene.submitted)) emit('recover')
    scheduleQueue(100)
  }
}, { immediate: true })

function patchScene(scene, patch) {
  if (lockedScene(scene)) return
  Object.assign(scene, patch)
  if ('edit' in patch || 'dialogue' in patch || 'referenceIds' in patch || 'captions' in patch) scene.plan = ''
  clearQuote(scene)
}
function saveSubtitleRegion(region) {
  const scene = subtitleScene.value
  if (scene && scenes.value.includes(scene)) patchScene(scene, { subtitleRegion: region })
  subtitleScene.value = null
}
function readPending(all = false) {
  if (typeof localStorage === 'undefined' || !props.projectScope) return []
  try {
    const saved = JSON.parse(localStorage.getItem(pendingStorageKey) || '[]')
    if (!Array.isArray(saved)) return []
    const cutoff = Date.now()
    const rows = saved.filter(item => item?.expiresAt > cutoff && item.expiresAt <= cutoff + pendingLifetime &&
      typeof item.scope === 'string' && (typeof item.id === 'string' && item.id.length <= 1500 || typeof item.requestId === 'string' && item.requestId.length === 36) &&
      Number.isSafeInteger(item.index) && item.index >= 0 && item.duration > 0 && item.duration <= maxRemakeSceneSeconds)
    if (!all && rows.length !== saved.length) localStorage.setItem(pendingStorageKey, JSON.stringify(rows))
    return all ? rows : rows.filter(item => item.scope === props.projectScope)
  } catch { return [] }
}
function trackJob(scene, remove = false) {
  const pending = pendingScene(scene)
  if (!props.projectScope || !pending) return
  try {
    const rows = readPending(true).filter(item => item.scope !== props.projectScope ||
      !(pending.id && item.id === pending.id || pending.requestId && item.requestId === pending.requestId || item.sceneId === pending.sceneId))
    if (!remove) rows.push({
      ...pending, scope: props.projectScope, index: scene.index, duration: scene.duration, start: scene.start,
      providerDuration: scene.providerDuration,
      expiresAt: Date.now() + pendingLifetime,
    })
    localStorage.setItem(pendingStorageKey, JSON.stringify(rows))
  } catch { /* The current generation remains usable when local storage is unavailable. */ }
}
function clearJob(scene, keepQuote = false) {
  trackJob(scene, true)
  scene.job = null
  scene.requestId = undefined
  scene.submittedAt = undefined
  scene.submitted = false
  if (!keepQuote) scene.quote = null
}
function rejectUpload(file) {
  if (!file?.size) return 'Selecione um vídeo válido.'
  if (file.size > maxRemakeInputBytes) return 'O vídeo pode ter até 70 MB.'
  return ''
}
function chooseFile(file) {
  if (!file || locked.value || !props.projectScope) return
  inputError.value = rejectUpload(file)
  selectedFile.value = inputError.value ? null : file
}
function releaseScenes(rows) {
  rows.forEach(scene => {
    if (scene.url) URL.revokeObjectURL(scene.url)
    if (scene.result?.previewUrl) URL.revokeObjectURL(scene.result.previewUrl)
  })
}
function problem(cause) {
  const status = cause.response?.status
  if (status === 402) emit('wallet')
  if (status === 401) emit('login')
  return cause.response?.data?.message || cause.message || 'Não foi possível concluir esta etapa.'
}
async function execute(kind, scene, operation) {
  if (locked.value) return
  const operationController = new AbortController()
  controller = operationController
  action.value = { kind, index: scene?.index }
  progress.value = 0
  emit('busy', true)
  if (scene) scene.error = ''
  else inputError.value = ''
  try {
    await operation(operationController.signal, props.access())
  } catch (cause) {
    if (!operationController.signal.aborted && cause?.code !== 'ERR_CANCELED') {
      if (scene) scene.error = problem(cause)
      else inputError.value = problem(cause)
    }
  } finally {
    if (controller === operationController) {
      controller = null
      action.value = null
      progress.value = 0
      emit('busy', false)
    }
    if (['prepare', 'generate'].includes(kind)) emit('balance')
  }
}
function splittingProgress(value) { progress.value = Math.min(1, Math.max(0, Number(value) || 0)) }
function confirmSource() {
  const file = selectedFile.value
  const duration = splitDuration.value
  if (!file || rejectUpload(file) || scenes.value.some(scene => scene.job || scene.submitted)) return
  if (scenes.value.length) {
    confirmStudioRemoval('Substituir cenas de origem?', 'Os cortes e as prévias deste painel serão substituídos pelo novo vídeo.', () => {
      if (!disposed && selectedFile.value === file) void splitSource(file, duration)
    }, 'Substituir')
  } else void splitSource(file, duration)
}
async function splitSource(file, duration) {
  if (scenes.value.some(scene => scene.job || scene.submitted)) return
  await execute('split', null, async signal => {
    const clips = await splitRemakeVideo(file, { splitDuration: duration, signal, onProgress: splittingProgress })
    signal.throwIfAborted()
    releaseScenes(scenes.value)
    discardedJobs.value = [...discardedJobs.value, ...results.value.map(result => result.id)].slice(-300)
    scenes.value = clips.map(clip => reactive({ ...clip, clientSceneId: crypto.randomUUID(), url: URL.createObjectURL(clip.file), edit: '', dialogue: '',
      referenceIds: null, captions: false, caption: '', plan: '', planQuote: null, planSpend: 0,
      quote: null, submitted: false, job: null, result: null, error: '' }))
  })
}
async function planScene(scene) {
  if (lockedScene(scene) || !props.allowCredits()) return
  const offer = scene.planQuote
  if (!offer) return execute('plan-price', scene, async (signal, { get }) => {
    scene.planQuote = await quoteRemakePlan({ apiGet: get, signal })
  })
  await execute('prepare', scene, async (signal, { post }) => {
    const prepared = await prepareRemakePlan({ file: scene.file, master: master.value.trim(), scenePrompt: scene.edit.trim(), dialogue: scene.dialogue.trim(),
      captions: scene.captions, characterNames: referencesFor(scene).map(item => item.title), walletId: props.walletId,
      maxBilledUsdCents: offer.maxBilledUsdCents, apiPost: post, signal })
    signal.throwIfAborted()
    scene.planQuote = null
    scene.quote = null
    scene.plan = prepared.prompt || ''
    scene.transcript = prepared.transcript || ''
    if (scene.captions && prepared.caption && !scene.caption.trim()) scene.caption = prepared.caption.slice(0, 180)
    scene.planSpend += Number(prepared.approxAitoTokens) || 0
    if (prepared.incomplete) scene.error = prepared.message || 'A análise consumiu créditos, mas não retornou um roteiro. Você pode escrever a direção ou tentar novamente.'
  })
}
function promptFor(scene, references, files) {
  const plan = scene.plan.trim()
  const context = references.map(item => {
    const image = files.indexOf(item.file)
    const label = item.type === 'Cenários' ? 'Cenário' : 'Personagem'
    return `${image >= 0 ? `@Image${image + 1} — ` : ''}${label} ${item.title.slice(0, 60)}: ${(item.prompt || '').slice(0, 78)}`
  }).join('\n')
  return [
    'Preserve o ritmo, as ações e o enquadramento do trecho original, exceto pelas mudanças solicitadas.',
    scene.edit.trim() && `Direção específica desta cena: ${scene.edit.trim().slice(0, 600)}`,
    context,
    plan && `Plano de direção: ${plan.slice(0, 850)}`,
    master.value.trim() && `Direção geral: ${master.value.trim().slice(0, plan ? 550 : 1500)}`,
  ].filter(Boolean).join('\n\n').slice(0, 3500)
}
async function upload(post, file, type, put, signal, walletId) {
  const { data } = await post('/aitoia/video/references', { contentType: type, sizeBytes: file.size, walletId }, { signal })
  return put(file, data.data, signal)
}
async function quoteScene(scene) {
  if (lockedScene(scene) || !canQuote(scene) || (scene.captions && !scene.caption.trim()) || !props.allowCredits()) return
  await execute('quote', scene, async (signal, { post }) => {
    const walletId = props.walletId
    const model = modelFor(scene).id
    const outputResolution = resolutionFor(scene)
    const references = referencesFor(scene)
    const files = [...new Set(references.map(item => item.file).filter(Boolean))].slice(0, maxReferences)
    const cleanSource = scene.subtitleRegion ? await removeRemakeSourceSubtitles(scene.file, scene.subtitleRegion, { signal }) : scene.file
    const referenceFile = await prepareRemakeVideoReference(cleanSource, { signal })
    const referenceToken = await upload(post, referenceFile, 'video/mp4', putVideoReference, signal, walletId)
    const imageReferenceTokens = []
    for (const file of files) imageReferenceTokens.push(await upload(post, file, checkImageReference(file), putImageReference, signal, walletId))
    const body = { walletId, referenceToken, imageReferenceTokens, prompt: promptFor(scene, references, files),
      dialogue: scene.dialogue.trim(), sourceDuration: scene.duration,
      subtitles: scene.captions, model, resolution: outputResolution }
    const { data } = await post(root + '/quote', body, { signal })
    signal.throwIfAborted()
    if (props.walletId === walletId) {
      scene.quote = { ...data.data, body, requestId: crypto.randomUUID(), caption: scene.captions ? scene.caption.trim() : '' }
    }
  })
}
async function saveFinishedScene(scene, job, signal, get, current) {
  if (scene.result?.id === job.id) {
    await props.saveResult(scene.result)
    if (current()) clearJob(scene)
    return
  }
  const quote = scene.quote || {}
  const original = await readGeneratedClipForJob({ id: job.id, remoteUrl: job.url }, signal, get)
  const cues = quote.caption ? [{ start: 0, end: scene.duration, text: quote.caption }] : []
  let file = original
  let captions = false
  let warning = ''
  try {
    file = await burnRemakeCaptions(original, cues, { duration: scene.duration, signal })
    captions = Boolean(cues.length)
  } catch {
    signal.throwIfAborted()
    warning = 'O clipe original foi recuperado. O navegador não conseguiu aplicar o corte ou as legendas.'
  }
  signal.throwIfAborted()
  if (!current()) return
  const asset = { id: job.id, file, title: `Cena ${scene.index + 1} refeita`, kind: 'scene',
    expiresAt: props.projectExpiresAt || videoGenerationExpiry(job.expiresAt, Date.now() + AITOIA_RETENTION_MS) }
  if (scene.result?.previewUrl) URL.revokeObjectURL(scene.result.previewUrl)
  const reserved = job.billingPending === true
  const charged = Number((reserved ? job.reservedUsdCents : job.billedUsdCents) ?? quote.billedUsdCents ?? 0)
  scene.result = { ...asset, previewUrl: URL.createObjectURL(file), billingPending: reserved, billedUsdCents: charged,
    approximateAitoTokens: job.actualAitoTokens ?? approximateCharge(charged, quote.billedUsdCents, Number(quote.estimatedAitoTokens) || 0),
    captions, duration: scene.duration }
  await props.saveResult(asset)
  if (!current()) return
  clearJob(scene)
  scene.error = warning
  emit('balance')
}

function scheduleQueue(ms = 9000) {
  clearTimeout(queueTimer)
  if (!disposed) queueTimer = setTimeout(() => void refreshQueue(), ms)
}

function restoreQueuedScene(job) {
  if (!job.sceneId || discardedJobs.value.includes(job.id) || scenes.value.some(scene => scene.result?.id === job.id)) return
  let scene = scenes.value.find(item => item.clientSceneId === job.sceneId || item.requestId && item.requestId === job.requestId)
  if (scene?.result || scene?.job && scene.job.id !== job.id || scene?.requestId && scene.requestId !== job.requestId) return
  if (!scene) {
    const index = Math.max(-1, ...scenes.value.map(item => item.index)) + 1
    const duration = Math.min(maxRemakeSceneSeconds, Math.max(.001, Number(job.sourceDuration ?? job.sourceSeconds) || remakeSplitDurations[0]))
    scene = reactive({ index, start: 0, duration, providerDuration: duration, clientSceneId: job.sceneId, recovered: true,
      edit: '', dialogue: '', referenceIds: null, caption: '', captions: false, plan: '', planSpend: 0, error: '' })
    scenes.value = [...scenes.value, scene]
  }
  scene.requestId = job.requestId
  scene.job = job
  scene.submitted = true
  scene.quote ||= { caption: scene.captions ? scene.caption : '', billedUsdCents: job.reservedUsdCents ?? job.billedUsdCents,
    estimatedAitoTokens: job.estimatedAitoTokens, modelLabel: job.modelLabel }
  trackJob(scene)
}
function recoverPrevious(job) {
  if (locked.value) return
  restoreQueuedScene({ ...job, sceneId: crypto.randomUUID() })
  previousJobs.value = previousJobs.value.filter(item => item.id !== job.id)
  scheduleQueue(100)
}

async function refreshQueue(only = null) {
  if (disposed || queueRequest || !props.projectScope || !draftLoaded) return
  if (locked.value) { scheduleQueue(); return }
  const access = props.access()
  if (!access.current()) return
  const request = new AbortController()
  queueRequest = request
  const { signal } = request
  try {
    let jobs
    try { jobs = await listVideoGenerations(access.get, { source: 'remake', projectId: projectId.value, signal }) }
    catch (cause) { if (only && !only.job) throw cause }
    signal.throwIfAborted()
    if (!access.current()) return
    const byId = new Map((jobs || []).map(job => [job.id, job]))
    if (jobs) {
      for (const job of jobs) {
        if (videoGenerationActive(job.status) || job.status === 'completed') restoreQueuedScene(job)
      }
      if (discoverJobs) {
        discoverJobs = false
        void listVideoGenerations(access.get, { source: 'remake', signal: AbortSignal.timeout(10000) })
          .then(recent => {
            if (disposed || !access.current()) return
            const known = new Set([...discardedJobs.value, ...scenes.value.flatMap(scene => [scene.job?.id, scene.result?.id])])
            previousJobs.value = recent.filter(item => !item.projectId && !known.has(item.id) &&
              (videoGenerationActive(item.status) || item.status === 'completed')).slice(0, 5)
          }).catch(() => {})
      }
    }
    for (const scene of only ? [only] : scenes.value) {
      if (!scene.job) {
        if (jobs && scene.submittedAt && Date.now() - scene.submittedAt > 120000 &&
          !jobs.some(job => job.requestId === scene.requestId)) {
          clearJob(scene)
          scene.error = 'A fila não recebeu o pedido. Consulte o custo novamente para gerar a cena.'
        }
        continue
      }
      try {
        const saved = byId.get(scene.job.id)
        const job = saved && (videoGenerationActive(saved.status) || saved.message || saved.url) ? saved :
          (await access.get(`/aitoia/video/generations/${encodeURIComponent(scene.job.id)}`, { signal })).data.data
        signal.throwIfAborted()
        if (!access.current()) return
        scene.job = { ...scene.job, ...job }
        if (videoGenerationActive(job.status)) continue
        if (job.status === 'completed') await saveFinishedScene(scene, scene.job, signal, access.get, access.current)
        else {
          clearJob(scene)
          scene.error = job.message || 'O provedor encerrou a geração desta cena.'
          emit('balance')
        }
      } catch (cause) {
        signal.throwIfAborted()
        if (!access.current()) return
        if ([404, 410].includes(cause.response?.status) && scene.job?.status !== 'completed') clearJob(scene)
        if (only || scene.job?.status === 'completed') scene.error = problem(cause)
      }
    }
  } catch (cause) {
    if (!signal.aborted && only && access.current()) only.error = problem(cause)
  } finally {
    queueRequest = null
    if (!disposed && (discoverJobs || scenes.value.some(scene => scene.job || scene.submitted))) scheduleQueue()
  }
}

async function renderScene(scene) {
  if (scene.job || scene.submitted) return refreshQueue(scene)
  if (!scene.quote || !props.allowCredits()) return
  await execute('generate', scene, async (signal, { post, current }) => {
    const { quote } = scene
    scene.submitted = true
    scene.submittedAt = Date.now()
    scene.requestId = quote.requestId
    trackJob(scene)
    try {
      const { data } = await post(root, { ...quote.body, quoteToken: quote.quoteToken, projectId: projectId.value, sceneId: scene.clientSceneId },
        { headers: { 'X-Aito-Request-Id': quote.requestId }, signal })
      signal.throwIfAborted()
      if (!current()) return
      if (!data?.data?.id) throw new Error('O pedido ainda não foi confirmado. Verifique a cena novamente.')
      scene.job = data.data
      trackJob(scene)
    } catch (cause) {
      if (!canRetryVideoSubmission(cause)) clearJob(scene, ![409, 410].includes(cause.response?.status))
      throw cause
    }
  })
  if (scene.job || scene.submitted) scheduleQueue(250)
}
function isWorking(scene, kind) { return action.value?.index === scene.index && action.value?.kind === kind }
function downloadCombined() {
  if (!results.value.length) return
  return execute('export', null, signal => props.exportResults(results.value, signal))
}

function downloadSource(scene) {
  if (!scene.file || locked.value) return
  if (!(scene.providerDuration > scene.duration + .04)) {
    downloadAitoIAFile(scene.file, scene.file.name)
    return
  }
  return execute('download', scene, async signal => {
    const result = await burnRemakeCaptions(scene.file, [], { duration: scene.duration, signal })
    signal.throwIfAborted()
    downloadAitoIAFile(result, scene.file.name)
  })
}

function removeScene(scene, resultOnly = false) {
  if (!scene || lockedScene(scene)) return
  const result = scene.result
  confirmStudioRemoval(resultOnly ? 'Remover cena refeita?' : 'Remover cena de origem?',
    'A cena selecionada sairá deste painel.', () => {
      if (disposed || !scenes.value.includes(scene) || lockedScene(scene) || scene.result !== result) return
      if (result?.id) discardedJobs.value = [...discardedJobs.value, result.id].slice(-300)
      if (resultOnly) {
        if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
        scene.result = null
      } else {
        releaseScenes([scene])
        scenes.value = scenes.value.filter(item => item !== scene)
      }
    })
}

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(queueTimer)
  queueRequest?.abort()
  controller?.abort()
  releaseScenes(scenes.value)
  emit('busy', false)
})
</script>

<template>
  <section class="aito-remake" aria-label="Refazer vídeos">
    <section class="aito-remake__panel aito-remake__setup">
      <header>
        <q-icon name="mdi-movie-roll" size="24px" />
        <div><h2>Refazer vídeos</h2><p>Divida um vídeo em cenas e refaça cada uma com novos personagens, cenários ou falas.</p></div>
      </header>
      <div class="aito-remake__upload">
        <input ref="input" type="file" :accept="remakeInputAccept" hidden
          @change="chooseFile($event.target.files?.[0]); $event.target.value = ''" />
        <button type="button" class="aito-remake__drop" :disabled="locked || !projectScope || scenes.some(scene => scene.job || scene.submitted)"
          @click="input?.click()" @dragover.prevent @drop.prevent="chooseFile($event.dataTransfer.files?.[0])">
          <q-icon name="mdi-file-video-outline" size="25px" />
          <span><strong>{{ selectedFile?.name || 'Selecionar vídeo' }}</strong><small>MP4, MOV, WebM, MKV ou 3GP, até 70 MB</small></span>
        </button>
        <label class="aito-remake__quality">Duração dos cortes
          <select v-model="splitDuration" :disabled="locked || !projectScope || scenes.some(scene => scene.job || scene.submitted)">
            <option v-for="duration in remakeSplitDurations" :key="duration" :value="duration">De {{ duration }} em {{ duration }} s</option>
          </select>
        </label>
        <q-btn no-caps unelevated color="teal-8" icon="mdi-content-cut" label="Confirmar e dividir"
          :disable="locked || !selectedFile || scenes.some(scene => scene.job || scene.submitted)" @click="confirmSource" />
      </div>
      <div v-if="!projectScope && !blocked" class="aito-remake__actions">
        <q-btn flat no-caps label="Entrar para abrir um projeto" icon="mdi-login" @click="emit('login')" />
      </div>
      <div v-if="action?.kind === 'split'" class="aito-remake__progress" role="status">
        <q-linear-progress rounded :value="progress" color="teal-3" aria-label="Divisão do vídeo" />
        <span>Dividindo no navegador · {{ Math.round(progress * 100) }}%</span>
        <q-btn flat no-caps label="Cancelar" @click="controller?.abort()" />
      </div>
      <p v-if="inputError" class="aito-remake__error" role="alert">{{ inputError }}</p>
      <div v-if="previousJobs.length" class="aito-remake__actions">
        <p class="aito-remake__help">Gerações anteriores sem projeto associado</p>
        <q-btn v-for="job in previousJobs" :key="job.id" no-caps outline color="teal-3" icon="mdi-backup-restore"
          :label="job.createdAt ? `Recuperar · ${new Date(job.createdAt).toLocaleString('pt-BR')}` : 'Recuperar geração'"
          :disable="locked" @click="recoverPrevious(job)" />
      </div>

      <div class="aito-remake__direction">
        <label for="remake-master">Prompt master</label>
        <textarea id="remake-master" v-model="master" rows="3" maxlength="1500" :disabled="locked"
          placeholder="Ex.: Traduza as falas para português do Brasil, use a personagem Ana e mantenha os cortes." />
        <div class="aito-remake__defaults">
          <q-select :model-value="referenceIds" :options="references" option-value="id" option-label="title" outlined dark dense
            multiple emit-value map-options use-chips :max-values="maxReferences" :disable="locked" label="Personagens e cenários do projeto"
            @update:model-value="value => referenceIds = value || []">
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar><q-avatar square size="33px"><img v-if="scope.opt.url" :src="scope.opt.url" alt="" /><q-icon v-else :name="scope.opt.type === 'Cenários' ? 'mdi-image-outline' : 'mdi-account-outline'" /></q-avatar></q-item-section>
                <q-item-section><q-item-label>{{ scope.opt.title }}</q-item-label><q-item-label caption>{{ scope.opt.type }}</q-item-label></q-item-section>
              </q-item>
            </template>
            <template #no-option><q-item><q-item-section>Adicione personagens ou cenários em Projetos e componentes.</q-item-section></q-item></template>
          </q-select>
          <label class="aito-remake__quality">Resolução preferida
            <select v-model="resolution" :disabled="locked">
              <option value="480p">480p · econômico</option>
              <option value="720p">720p · mais detalhe</option>
              <option value="1080p">1080p · maior definição</option>
            </select>
          </label>
        </div>
        <ul v-if="referenceIds.length" class="aito-remake__references" aria-label="Referências do vídeo">
          <li v-for="item in selectedReferences(referenceIds)" :key="item.id">
            <button v-if="item.url" type="button" class="aito-remake__reference" :aria-label="`Ampliar imagem de ${item.title}`"
              @click="referencePreview = item"><img :src="item.url" alt="" />{{ item.title }}</button>
            <span v-else class="aito-remake__reference"><q-icon name="mdi-image-outline" size="22px" />{{ item.title }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="scenes.length" class="aito-remake__panel aito-remake__column" aria-labelledby="remake-source">
      <header><q-icon name="mdi-filmstrip" size="23px" /><div><h2 id="remake-source">Cenas de origem</h2><p>{{ scenes.length }} {{ scenes.length === 1 ? 'trecho' : 'trechos' }}</p></div></header>
      <article v-for="scene in scenes" :key="scene.clientSceneId" class="aito-remake__scene">
        <div class="aito-remake__scene-title"><h3>Cena {{ scene.index + 1 }}</h3><span>{{ seconds(scene.start) }}–{{ seconds(scene.start + scene.duration) }} s</span>
          <q-btn v-if="scene.file" flat round dense icon="mdi-download-outline" :aria-label="`Baixar cena de origem ${scene.index + 1}`"
            :disable="locked" :loading="isWorking(scene, 'download')" @click="downloadSource(scene)"><q-tooltip>Baixar cena de origem</q-tooltip></q-btn>
          <q-btn flat round dense icon="mdi-delete-outline" :aria-label="`Remover cena de origem ${scene.index + 1}`" :disable="lockedScene(scene)" @click="removeScene(scene)">
            <q-tooltip>Remover cena de origem</q-tooltip>
          </q-btn>
        </div>
        <template v-if="!scene.recovered">
        <video :src="scene.url" controls playsinline preload="none" :aria-label="`Trecho original da cena ${scene.index + 1}`" />
        <label :for="`remake-scene-${scene.index}`">Prompt da cena <small>opcional</small></label>
        <textarea :id="`remake-scene-${scene.index}`" :value="scene.edit" rows="2" maxlength="600" :disabled="lockedScene(scene)"
          placeholder="Ex.: Troque o cenário e traduza a conversa para português." @input="patchScene(scene, { edit: $event.target.value })" />
        <label :for="`remake-dialogue-${scene.index}`">Falas exatas <small>opcional</small></label>
        <textarea :id="`remake-dialogue-${scene.index}`" :value="scene.dialogue" rows="2" maxlength="600" :disabled="lockedScene(scene)"
          placeholder="Ex.: Ana (sorrindo): ‘Hoje é a nossa vez.’" @input="patchScene(scene, { dialogue: $event.target.value })" />
        <div v-if="modelsFor(scene).length" class="aito-remake__defaults">
          <AitoVideoModelSelect :model-value="modelFor(scene)?.id" :models="modelsFor(scene)" :disable="lockedScene(scene)"
            @update:model-value="value => patchScene(scene, { modelId: value, resolution: '' })" />
          <label class="aito-remake__quality">Resolução da cena
            <select :value="resolutionFor(scene)" :disabled="lockedScene(scene)" @change="patchScene(scene, { resolution: $event.target.value })">
              <option v-for="option in modelFor(scene)?.options" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </label>
        </div>
        <p v-else class="aito-remake__help">{{ models.length ? 'Nenhum modelo disponível aceita esta duração.' : 'Aguardando os modelos disponíveis para refazer a cena.' }}</p>
        <q-expansion-item v-if="references.length" dense class="aito-remake__scene-references" icon="mdi-account-box-multiple-outline"
          :label="scene.referenceIds === null ? 'Referências do prompt master' : 'Referências específicas desta cena'">
          <q-select :model-value="scene.referenceIds ?? referenceIds" :options="references" option-value="id" option-label="title" outlined dark dense
            multiple emit-value map-options use-chips :max-values="maxReferences" :disable="lockedScene(scene)" label="Personagens e cenários"
            @update:model-value="value => patchScene(scene, { referenceIds: value || [] })">
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar><q-avatar square size="33px"><img v-if="scope.opt.url" :src="scope.opt.url" alt="" /><q-icon v-else name="mdi-image-outline" /></q-avatar></q-item-section>
                <q-item-section><q-item-label>{{ scope.opt.title }}</q-item-label><q-item-label caption>{{ scope.opt.type }}</q-item-label></q-item-section>
              </q-item>
            </template>
          </q-select>
          <ul v-if="referencesFor(scene).length" class="aito-remake__references" aria-label="Referências da cena">
            <li v-for="item in referencesFor(scene)" :key="item.id">
              <button v-if="item.url" type="button" class="aito-remake__reference" :aria-label="`Ampliar imagem de ${item.title}`"
                @click="referencePreview = item"><img :src="item.url" alt="" />{{ item.title }}</button>
              <span v-else class="aito-remake__reference"><q-icon name="mdi-image-outline" size="22px" />{{ item.title }}</span>
            </li>
          </ul>
          <q-btn v-if="scene.referenceIds !== null" flat dense no-caps label="Usar referências do prompt master"
            :disable="lockedScene(scene)" @click="patchScene(scene, { referenceIds: null })" />
        </q-expansion-item>
        <div class="aito-remake__subtitle-tools">
          <q-btn flat no-caps color="teal-3" icon="mdi-subtitles-outline" :disable="lockedScene(scene)"
            :label="scene.subtitleRegion ? 'Editar área da legenda original' : 'Remover legenda gravada'" @click="subtitleScene = scene" />
          <p class="aito-remake__help">Marque a área se o texto já fizer parte da imagem do vídeo original.</p>
        </div>
        <q-toggle dark color="teal-4" label="Adicionar nova legenda" :model-value="scene.captions" :disable="lockedScene(scene)"
          @update:model-value="value => patchScene(scene, { captions: value })" />
        <template v-if="scene.captions">
          <label :for="`remake-caption-${scene.index}`">Legenda da cena</label>
          <textarea :id="`remake-caption-${scene.index}`" :value="scene.caption" rows="2" maxlength="180" :disabled="lockedScene(scene)"
            placeholder="Escreva a legenda ou prepare o trecho com IA." @input="patchScene(scene, { caption: $event.target.value })" />
        </template>
        <div v-if="scene.plan" class="aito-remake__prepared">
          <label :for="`remake-plan-${scene.index}`">Direção preparada pela IA</label>
          <textarea :id="`remake-plan-${scene.index}`" :value="scene.plan" rows="3" maxlength="850" :disabled="lockedScene(scene)"
            @input="patchScene(scene, { plan: $event.target.value })" />
        </div>
        <details v-if="scene.transcript" class="aito-remake__prepared">
          <summary>Fala original identificada</summary>
          <p class="aito-remake__help">{{ scene.transcript }}</p>
        </details>
        <p v-if="scene.planSpend" class="aito-remake__help">Preparação usada · ≈ {{ aitoTokens(scene.planSpend) }} AitoTokens</p>
        <p v-if="scene.planQuote" class="aito-remake__help">Preparar com OpenAI · até ≈ {{ aitoTokens(scene.planQuote.approxAitoTokens) }} AitoTokens</p>
        </template>
        <p v-else class="aito-remake__help">{{ scene.result ? 'O resultado foi recuperado.' : scene.job ? 'Já existe uma geração para esta cena. Verifique para recuperar o resultado.' : 'A geração anterior está indisponível. Selecione o vídeo de origem para tentar novamente.' }}</p>
        <p v-if="scene.quote" class="aito-remake__price" role="status">
          {{ scene.quote.modelLabel || scene.job?.modelLabel || modelFor(scene)?.label || 'Higgsfield' }} · Até ≈ {{ aitoTokens(scene.quote.estimatedAitoTokens) }} AitoTokens
        </p>
        <p v-if="scene.error" class="aito-remake__error" role="alert">{{ scene.error }}</p>
        <AitoVideoProgress v-if="scene.job || scene.submitted || isWorking(scene, 'generate')"
          :stage="scene.job?.status || 'submitting'" :percent="scene.job?.progress" />
        <div v-if="isWorking(scene, 'finish')" class="aito-remake__progress" role="status">
          <q-linear-progress rounded :value="progress" color="teal-3" aria-label="Finalização da cena" />
          <span>Finalizando a cena · {{ Math.round(progress * 100) }}%</span>
        </div>
        <div class="aito-remake__actions">
          <q-btn v-if="!scene.recovered && !scene.job && !scene.submitted" no-caps flat icon="mdi-creation-outline"
            :label="scene.planQuote ? 'Confirmar preparação' : 'Melhorar Prompt de Cena'" :disable="lockedScene(scene)"
            :loading="isWorking(scene, 'prepare') || isWorking(scene, 'plan-price')" @click="planScene(scene)" />
          <q-btn v-if="scene.quote || scene.job || scene.submitted" no-caps unelevated color="teal-8" icon="mdi-movie-open-play-outline"
            :label="scene.job || scene.submitted ? 'Verificar cena' : scene.quote?.estimated ? 'Confirmar reserva e refazer' : 'Confirmar e refazer'"
            :disable="locked" @click="renderScene(scene)" />
          <q-btn v-else-if="!scene.recovered" no-caps outline color="teal-3" icon="mdi-calculator-variant-outline" label="Cotar cena"
            :disable="locked || !canQuote(scene) || (scene.captions && !scene.caption.trim())" :loading="isWorking(scene, 'quote')" @click="quoteScene(scene)" />
        </div>
      </article>
    </section>

    <section v-if="scenes.length" class="aito-remake__panel aito-remake__column aito-remake__column--results" aria-labelledby="remake-result">
      <header><q-icon name="mdi-movie-check-outline" size="23px" /><div><h2 id="remake-result">Cenas refeitas</h2><p>{{ results.length }} de {{ scenes.length }} prontas</p></div></header>
      <p v-if="!results.length" class="aito-remake__help">Depois da geração, compare os resultados e adicione as tomadas ao vídeo master.</p>
      <div v-if="results.length > 1" class="aito-remake__actions">
        <q-btn no-caps outline color="teal-3" icon="mdi-playlist-plus" label="Adicionar cenas prontas em ordem"
          :disable="locked" @click="emit('append', results)" />
        <q-btn no-caps unelevated color="teal-8" icon="mdi-download-outline" label="Baixar cenas juntas"
          :disable="locked" @click="downloadCombined" />
      </div>
      <div v-if="action?.kind === 'export'" class="aito-remake__progress" role="status">
        <q-linear-progress rounded :value="exportProgress" color="teal-3" aria-label="Exportação do vídeo refeito" />
        <span>Exportando no navegador · {{ Math.round(exportProgress * 100) }}%</span>
        <q-btn flat no-caps label="Cancelar" @click="controller?.abort()" />
      </div>
      <article v-for="asset in results" :key="asset.id" class="aito-remake__scene">
        <div class="aito-remake__scene-title"><h3>{{ asset.title }}</h3><span>{{ seconds(asset.duration) }} s</span></div>
        <video :src="asset.previewUrl" controls playsinline preload="none" :aria-label="asset.title" />
        <p class="aito-remake__help">{{ asset.captions ? 'Com legendas' : 'Sem legendas adicionadas' }} · {{ asset.billingPending ? 'Reserva de' : 'Uso de' }} ≈ {{ aitoTokens(asset.approximateAitoTokens) }} AitoTokens<span v-if="asset.billingPending"> · Aguardando confirmação do custo</span></p>
        <div class="aito-remake__actions">
          <q-btn outline no-caps color="teal-3" icon="mdi-folder-plus-outline" label="Salvar em Componentes" :disable="locked" @click="emit('component', asset)" />
          <q-btn outline no-caps color="teal-3" icon="mdi-playlist-plus" label="Usar no vídeo master" :disable="locked" @click="emit('append', [asset])" />
          <q-btn flat round dense icon="mdi-download-outline" :aria-label="`Baixar ${asset.title}`" :href="asset.previewUrl"
            :download="asset.file.name"><q-tooltip>Baixar cena refeita</q-tooltip></q-btn>
          <q-btn flat round dense icon="mdi-delete-outline" :aria-label="`Remover ${asset.title}`" :disable="locked"
            @click="removeScene(scenes.find(scene => scene.result === asset), true)"><q-tooltip>Remover resultado</q-tooltip></q-btn>
        </div>
      </article>
    </section>
    <AitoRemakeSubtitleRegion v-if="subtitleScene" :url="subtitleScene.url" :duration="subtitleScene.duration"
      :region="subtitleScene.subtitleRegion" @close="subtitleScene = null" @save="saveSubtitleRegion" />
    <q-dialog :model-value="Boolean(referencePreview)" aria-labelledby="remake-reference-preview-title"
      @update:model-value="open => { if (!open) referencePreview = null }">
      <q-card v-if="referencePreview" class="aito-ai-theme aito-remake__reference-preview">
        <q-card-section class="row items-center justify-between no-wrap q-gutter-sm">
          <h3 id="remake-reference-preview-title" class="text-subtitle1 q-my-none">{{ referencePreview.title }}</h3>
          <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar prévia da imagem" />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <img :src="referencePreview.url" :alt="referencePreview.title" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.aito-remake { grid-column: 1 / -1; min-width: 0; display: grid; align-items: start; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.aito-remake__panel { min-width: 0; display: grid; gap: 16px; padding: clamp(14px, 2vw, 22px); border: 1px solid var(--aito-ai-line); border-radius: 16px; color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.aito-remake__setup { grid-column: 1 / -1; background: radial-gradient(ellipse at 0 0, #27465a83, transparent 58%), var(--aito-ai-surface); }
.aito-remake__panel header { display: flex; align-items: flex-start; gap: 10px; }
.aito-remake__panel header > .q-icon { flex: none; color: var(--aito-ai-accent); margin-top: 2px; }
.aito-remake__panel h2, .aito-remake__panel h3, .aito-remake__panel p { margin: 0; }
.aito-remake__panel h2 { font-size: 1.2rem; font-weight: 740; line-height: 1.2; }
.aito-remake__panel h3 { font-size: 1rem; line-height: 1.3; }
.aito-remake__panel header p, .aito-remake__help { color: var(--aito-ai-muted); font-size: .86rem; line-height: 1.4; }
.aito-remake__panel header p { margin-top: 4px; }
.aito-remake__upload, .aito-remake__defaults { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.aito-remake__upload { grid-template-columns: minmax(0, 1fr) auto auto; }
.aito-remake__drop { min-width: 0; display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px dashed #76aaa9; border-radius: 10px; background: #0b252a; color: var(--aito-ai-text); text-align: left; cursor: pointer; }
.aito-remake__drop span { min-width: 0; }
.aito-remake__drop strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aito-remake__drop small { display: block; color: var(--aito-ai-muted); }
.aito-remake__drop .q-icon { color: var(--aito-ai-accent); }
.aito-remake__drop:disabled { opacity: .6; cursor: default; }
.aito-remake__upload > .q-btn { min-height: 44px; }
.aito-remake__direction, .aito-remake__prepared { display: grid; gap: 8px; }
.aito-remake label { font-weight: 660; }
.aito-remake label small { font-size: .76rem; font-weight: 400; color: var(--aito-ai-muted); }
.aito-remake :is(textarea, select) { display: block; box-sizing: border-box; width: 100%; padding: 8px 10px; border: 1px solid var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-text); background: var(--aito-ai-bg); font: inherit; }
.aito-remake textarea { resize: vertical; }
.aito-remake :is(button, textarea, select):focus-visible { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
.aito-remake__quality { display: grid; gap: 4px; }
.aito-remake__references { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.aito-remake__references li { min-width: 0; max-width: 100%; }
.aito-remake__reference { display: flex; gap: 6px; align-items: center; max-width: 100%; padding: 3px 8px 3px 3px; border: 1px solid var(--aito-ai-line); border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: .84rem; }
button.aito-remake__reference { cursor: zoom-in; text-align: left; }
button.aito-remake__reference:hover { border-color: var(--aito-ai-accent); }
.aito-remake__reference img { flex: 0 0 30px; width: 30px; height: 30px; border-radius: 4px; object-fit: cover; }
.aito-remake__reference-preview { width: min(620px, 100%); color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.aito-remake__reference-preview img { display: block; width: 100%; max-height: 70dvh; border-radius: 8px; background: var(--aito-ai-bg); object-fit: contain; }
.aito-remake__column--results { background: linear-gradient(145deg, #16433870, transparent 400px), var(--aito-ai-surface); }
.aito-remake__scene { display: grid; gap: 7px; padding: 12px; border: 1px solid var(--aito-ai-line); border-radius: 12px; background: var(--aito-ai-panel); }
.aito-remake__scene-title { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; }
.aito-remake__scene-title > span { color: var(--aito-ai-muted); font-size: .85rem; }
.aito-remake__scene video { width: 100%; height: clamp(145px, 21vw, 260px); border-radius: 8px; background: #050d13; object-fit: contain; }
.aito-remake__scene-references { border: 1px solid var(--aito-ai-line); border-radius: 8px; }
.aito-remake__scene-references :deep(.q-expansion-item__content) { display: grid; gap: 6px; padding: 0 8px 8px; }
.aito-remake__prepared { padding: 8px; border-radius: 8px; background: var(--aito-ai-purple-soft); }
.aito-remake__subtitle-tools .q-btn { margin-left: -9px; }
.aito-remake__actions { display: flex; flex-wrap: wrap; gap: 6px; }
.aito-remake__error, .aito-remake__price { padding: 7px 9px; border: 1px solid var(--aito-ai-gold-line); border-radius: 8px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); }
.aito-remake__error { border-color: var(--aito-ai-error-line); color: var(--aito-ai-error); background: var(--aito-ai-error-soft); }
.aito-remake__progress { display: grid; gap: 5px; color: var(--aito-ai-muted); }
.aito-remake__progress .q-btn { justify-self: start; }
@media (max-width: 680px) {
  .aito-remake, .aito-remake__upload, .aito-remake__defaults { grid-template-columns: 1fr; }
}
</style>
