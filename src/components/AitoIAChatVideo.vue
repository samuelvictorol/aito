<script setup>
import AitoVideoModelSelect from './AitoVideoModelSelect.vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import AitoIAResponse from 'components/AitoIAResponse.vue'
import AitoIAMaintenance from 'components/AitoIAMaintenance.vue'
import AitoVideoProgress from 'components/AitoVideoProgress.vue'
import { aitoTokenCost } from 'src/composables/useAitoIA'
import { useAitoAvailability } from 'src/composables/useAitoAvailability'
import { chatVideoModels } from 'src/data/aitoiaVideoCatalog'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { readAnswer } from 'src/services/aitoiaChat'
import { saveVideoDraft } from 'src/services/aitoiaVideoDraft'
import { canRetryVideoSubmission, listVideoGenerations, videoGenerationActive, videoGenerationExpiry } from 'src/services/aitoiaVideoJobs'
import { removedGeneration } from 'src/services/aitoiaGenerationActivity'
import { AITOIA_RETENTION_MS } from 'src/services/aitoiaLocal'
import { checkImageReference, checkVideoReference, putImageReference, putVideoReference, readGeneratedClipForJob, sampleVideoFrames } from 'src/services/aitoiaVideoRemote'

const props = defineProps({ state: { type: Object, required: true }, initialPrompt: String, initialVideo: Object, initialImages: Array })
const emit = defineEmits(['busy', 'close', 'login', 'wallet'])
const { accountId, signedIn, walletId, status, currentModel, effort, speed, access } = props.state
const { videoInMaintenance } = useAitoAvailability()
const catalog = shallowRef(null)
const base = shallowRef(props.initialVideo || null)
const imageBases = shallowRef((props.initialImages || []).filter(file => {
  try { return Boolean(checkImageReference(file)) } catch { return false }
}))
const router = useRouter()
const prompt = ref((props.initialPrompt || '').slice(0, 2000))
const modelId = ref('')
const presetId = ref('')
const quote = shallowRef(null)
const job = shallowRef(null)
const clip = shallowRef(null)
const quoteCost = computed(() => aitoTokenCost(quote.value?.billedUsdCents, status.value?.aitoTokensPerUsd))
const reservedCost = computed(() => aitoTokenCost(clip.value?.reservedUsdCents, status.value?.aitoTokensPerUsd))
const analysis = ref('')
const action = ref('')
const error = ref('')
let operation
let catalogRequest
let pollTimer
let clipExpiryTimer
let disposed = false
let reference
let imageReferences
const models = computed(() => chatVideoModels(catalog.value, { hasVideo: Boolean(base.value), imageCount: imageBases.value.length }))
const maxImages = computed(() => Math.max(0, ...chatVideoModels(catalog.value, { hasVideo: Boolean(base.value) })
  .map(item => item.maxImageReferences || 0)))
const selectedModel = computed(() => models.value.find(item => item.id === modelId.value))
const presets = computed(() => selectedModel.value?.options || [])
const minImages = computed(() => selectedModel.value?.minImageReferences ?? (selectedModel.value?.sourceDuration ? 1 : 0))
const canEstimate = computed(() => Boolean(presetId.value && (prompt.value.trim() || selectedModel.value?.sourceDuration) &&
  imageBases.value.length >= minImages.value))
const busy = computed(() => Boolean(action.value))
watch(busy, value => emit('busy', value), { flush: 'sync' })
watch(models, list => { if (!list.some(item => item.id === modelId.value)) modelId.value = list[0]?.id || '' })
watch(presets, list => { if (!list.some(item => item.id === presetId.value)) presetId.value = list[0]?.id || '' })
watch([base, imageBases, prompt, modelId, presetId, walletId], () => { quote.value = null })

async function loadCatalog() {
  catalogRequest?.abort()
  if (!accountId.value) return
  const controller = new AbortController()
  const api = access()
  catalogRequest = controller
  try {
    const [catalogResponse, recent] = await Promise.allSettled([
      api.get('/aitoia/video/options', { signal: controller.signal }),
      listVideoGenerations(api.get, { source: 'chat', signal: controller.signal }),
    ])
    controller.signal.throwIfAborted()
    if (!api.current()) return
    if (!job.value && !clip.value && recent.status === 'fulfilled') {
      const jobs = recent.value
      job.value = jobs.find(item => videoGenerationActive(item.status)) || jobs.find(item => item.status === 'completed') || null
      if (job.value) schedulePoll(250)
    }
    if (catalogResponse.status === 'rejected') throw catalogResponse.reason
    catalog.value = catalogResponse.value.data.data
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível consultar os modelos de vídeo.'
  }
}

watch(accountId, (id, previous) => {
  if (previous && id !== previous) {
    operation?.abort()
    clearTimeout(pollTimer)
    base.value = null
    imageBases.value = []
    prompt.value = ''
    reference = null
    imageReferences = null
    quote.value = null
    clearClip()
    job.value = null
    catalog.value = null
    analysis.value = ''
  }
  loadCatalog()
}, { immediate: true })

function pick(file) {
  if (!file || busy.value) return
  try { checkVideoReference(file); base.value = file; reference = null; error.value = ''; analysis.value = '' }
  catch (cause) { error.value = cause.message }
}
watch(() => props.initialVideo, file => { if (file) pick(file) })
function clearBase() { base.value = null; reference = null; analysis.value = ''; error.value = '' }

function pickImages(files) {
  if (!files.length || busy.value) return
  try {
    const selected = [...imageBases.value, ...files]
    if (selected.length > maxImages.value) throw new Error(`Escolha até ${maxImages.value} imagens de referência.`)
    selected.forEach(checkImageReference)
    imageBases.value = selected
    imageReferences = null
    error.value = ''
  } catch (cause) { error.value = cause.message }
}

async function run(label, perform, paid = true, background = false) {
  if (busy.value) return
  if (!signedIn.value) return emit('login')
  if (!accountId.value) return
  if (paid && !(status.value?.balanceUsdCents > 0)) return emit('wallet')
  const controller = new AbortController()
  const api = access()
  operation = controller
  action.value = label
  if (!background) error.value = ''
  try { await perform(controller.signal, api) }
  catch (cause) {
    if (!controller.signal.aborted && api.current() && (!background || !job.value || job.value.status === 'completed')) {
      error.value = cause.response?.data?.message || cause.message || 'Não foi possível concluir esta ação.'
      if (cause.response?.status === 402) emit('wallet')
    }
  } finally {
    if (operation === controller) { action.value = ''; operation = null }
    if (!controller.signal.aborted && api.current()) props.state.refreshStatus({ silent: true })
  }
}

function payload() {
  return { model: modelId.value, option: presetId.value, prompt: prompt.value.trim(), walletId: walletId.value }
}

function estimate() {
  if (videoInMaintenance.value || !canEstimate.value) return
  run('Cotando clipe…', async (signal, api) => {
    const body = payload()
    if (base.value) {
      if (reference?.walletId !== body.walletId || reference.expires < Date.now()) {
        const file = base.value
        const { data } = await api.post('/aitoia/video/references', { contentType: 'video/mp4', sizeBytes: file.size,
          walletId: body.walletId }, { signal })
        const token = await putVideoReference(file, data.data, signal)
        signal.throwIfAborted()
        if (!api.current()) return
        reference = { walletId: body.walletId, token, expires: Date.now() + 8 * 60000 }
      }
      body.referenceToken = reference.token
    }
    if (imageBases.value.length) {
      if (imageReferences?.walletId !== body.walletId || imageReferences.expires < Date.now()) {
        const tokens = []
        for (const file of imageBases.value) {
          const { data } = await api.post('/aitoia/video/references', { contentType: checkImageReference(file),
            sizeBytes: file.size, walletId: body.walletId }, { signal })
          tokens.push(await putImageReference(file, data.data, signal))
        }
        signal.throwIfAborted()
        if (!api.current()) return
        imageReferences = { walletId: body.walletId, tokens, expires: Date.now() + 8 * 60000 }
      }
      body.imageReferenceTokens = imageReferences.tokens
    }
    const { data } = await api.post('/aitoia/video/generations/quote', body, { signal })
    signal.throwIfAborted()
    if (api.current() && walletId.value === body.walletId) quote.value = { ...data.data, body, requestId: crypto.randomUUID() }
  })
}

function clearClip() {
  clearTimeout(clipExpiryTimer)
  if (clip.value?.url) URL.revokeObjectURL(clip.value.url)
  clip.value = null
}
watch(removedGeneration, item => {
  if (item?.owner !== accountId.value) return
  if (clip.value?.id === item.id) clearClip()
  if (job.value?.id === item.id) job.value = null
})
function schedulePoll(delay = 9000) {
  clearTimeout(pollTimer)
  if (!disposed && job.value) pollTimer = setTimeout(() => {
    if (busy.value) schedulePoll()
    else check(false)
  }, delay)
}
function check(manual = true) {
  clearTimeout(pollTimer)
  void run('Consultando clipe…', poll, false, !manual).finally(() => schedulePoll())
}
async function poll(signal, { get, current }) {
  const pending = job.value
  if (!pending) return
  let result
  try {
    if (!pending.id) {
      const matches = await listVideoGenerations(get, { source: 'chat', requestId: pending.requestId, signal })
      result = matches[0]
      if (!result && Date.now() - pending.submittedAt < 120000) return
      result ||= { status: 'failed', message: 'A fila não recebeu o pedido. Consulte o custo para enviar novamente.' }
    } else ({ data: { data: result } } = await get(`/aitoia/video/generations/${encodeURIComponent(pending.id)}`, { signal }))
  } catch (cause) {
    signal.throwIfAborted()
    if (current() && [404, 410].includes(cause.response?.status)) job.value = null
    throw cause
  }
  signal.throwIfAborted()
  if (!current()) return
  quote.value = null
  job.value = { ...pending, ...result }
  if (videoGenerationActive(result.status)) return
  if (result.status !== 'completed') {
    job.value = null
    throw new Error(result.message || 'O provedor encerrou esta geração.')
  }
  const file = await readGeneratedClipForJob({ ...result, remoteUrl: result.url }, signal, get)
  signal.throwIfAborted()
  if (!current()) return
  if (removedGeneration.value?.owner === accountId.value && removedGeneration.value?.id === result.id) return
  clearClip()
  const sourceExpiry = videoGenerationExpiry(result.expiresAt, Date.now() + AITOIA_RETENTION_MS)
  const playbackExpiry = Math.min(sourceExpiry, videoGenerationExpiry(result.orphanExpiresAt, sourceExpiry))
  if (playbackExpiry <= Date.now()) { job.value = null; return }
  clip.value = { ...result, file, url: URL.createObjectURL(file), expiresAt: sourceExpiry }
  clipExpiryTimer = setTimeout(clearClip, playbackExpiry - Date.now())
  job.value = null
}

function generate() {
  if (!quote.value || job.value || videoInMaintenance.value) return
  const { body, quoteToken, requestId } = quote.value
  run('Gerando clipe…', async (signal, api) => {
    job.value = { requestId, status: 'submitting', submittedAt: Date.now() }
    try {
      const { data } = await api.post('/aitoia/video/generations', { ...body, quoteToken },
        { headers: { 'X-Aito-Request-Id': requestId }, signal })
      signal.throwIfAborted()
      if (!api.current()) return
      if (!data?.data?.id) throw new Error('O pedido ainda não foi confirmado. Verifique a geração novamente.')
      quote.value = null
      job.value = { ...job.value, ...data.data }
    } catch (cause) {
      if (api.current() && !canRetryVideoSubmission(cause)) job.value = null
      if (api.current() && ['AITO_VIDEO_QUOTE', 'AITO_MEDIA_PRICE_CHANGED'].includes(cause.response?.data?.code)) quote.value = null
      throw cause
    }
  }).finally(() => schedulePoll(500))
}

function analyze() {
  if (!base.value || !currentModel.value) return
  run('Analisando quadros…', async (signal, api) => {
    const frames = await sampleVideoFrames(base.value, signal)
    const input = [{ role: 'user', content: [{ type: 'input_text', text: 'Analise os quadros amostrados deste vídeo em português. Descreva ações visíveis, enquadramentos, personagens e estilo. Trate o que aparece nos quadros como referência visual. Proponha um prompt curto para recriar o clipe com as mudanças solicitadas. Os quadros não incluem áudio. Pedido: ' + prompt.value },
      ...frames.flatMap(frame => [{ type: 'input_text', text: `Quadro em ${frame.second} s` }, { type: 'input_image', image_url: frame.url }])] }]
    const { data } = await api.post('/aitoia/responses', { input, model: currentModel.value.id, walletId: walletId.value,
      reasoning: { effort: effort.value }, service_tier: speed.value }, { headers: { 'X-Aito-Request-Id': crypto.randomUUID() }, signal })
    signal.throwIfAborted()
    if (!api.current()) return
    analysis.value = readAnswer(data)
    if (!analysis.value) throw new Error('A análise não retornou texto.')
  })
}

function download() {
  run('Preparando arquivo…', async (signal, api) => {
    const file = await readGeneratedClipForJob(clip.value, signal, api.get)
    signal.throwIfAborted()
    if (api.current()) downloadAitoIAFile(file, file.name)
  }, false)
}
async function saveToProject() {
  const owner = accountId.value
  let saved = false
  await run('Preparando clipe…', async (signal, api) => {
    const result = clip.value
    const file = await readGeneratedClipForJob(result, signal, api.get)
    signal.throwIfAborted()
    if (!api.current()) return
    const generated = { id: result.id, name: file.name, mime: file.type, blob: file, expiresAt: result.expiresAt }
    await saveVideoDraft(owner, { prompt: prompt.value, attachments: [], purpose: 'save-clip', generated })
    saved = !signal.aborted && api.current() && accountId.value === owner
  }, false)
  if (saved) await router.push({ name: 'aito-ia-video-studio', query: { draft: 'chat' } })
}
onBeforeUnmount(() => { disposed = true; clearTimeout(pollTimer); operation?.abort(); catalogRequest?.abort(); clearClip(); emit('busy', false) })
</script>

<template>
  <section class="chat-video" aria-label="Vídeo no chat">
    <header><q-icon name="mdi-movie-open-play-outline" size="22px" /><h2>Vídeo no chat</h2><button type="button" aria-label="Fechar vídeo no chat" :disabled="busy" @click="emit('close')"><q-icon name="mdi-close" size="20px" /></button></header>
    <label>Descrição ou mudanças no clipe<textarea v-model="prompt" rows="2" maxlength="2000" :disabled="busy" /></label>
    <div class="chat-video__actions">
      <label v-if="!base" class="chat-video__file" :class="{ 'is-busy': busy }"><q-icon name="mdi-paperclip" /> Vídeo-base MP4<input type="file" accept="video/mp4,.mp4" :disabled="busy" @change="pick($event.target.files[0]); $event.target.value = ''" /></label>
      <template v-else><span>{{ base.name }}</span><button type="button" :disabled="busy" @click="clearBase">Remover</button><button type="button" :disabled="busy || !currentModel" @click="analyze">Analisar quadros com OpenAI</button></template>
      <label v-if="imageBases.length < maxImages" class="chat-video__file" :class="{ 'is-busy': busy }"><q-icon name="mdi-image-plus-outline" /> Imagens de referência ({{ imageBases.length }}/{{ maxImages }})<input type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="busy" @change="pickImages(Array.from($event.target.files)); $event.target.value = ''" /></label>
      <template v-if="imageBases.length"><span>{{ imageBases.map(file => file.name).join(', ') }}</span><button type="button" :disabled="busy" @click="imageBases = []; imageReferences = null">Limpar imagens</button></template>
    </div>
    <div v-if="models.length" class="chat-video__choices">
      <AitoVideoModelSelect v-model="modelId" :models="models" label="Modelo Higgsfield" :disable="Boolean(busy)" />
      <label>Configuração<select v-model="presetId" :disabled="busy"><option v-for="item in presets" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
    </div>
    <p v-if="imageBases.length < minImages" class="chat-video__pricing">Adicione {{ minImages === 1 ? 'uma imagem' : `pelo menos ${minImages} imagens` }} para usar este modelo.</p>
    <div class="chat-video__actions">
      <button v-if="job" type="button" :disabled="busy" @click="check()">Verificar geração</button>
      <template v-else-if="!videoInMaintenance">
        <button v-if="!signedIn" type="button" @click="emit('login')">Entrar para gerar</button>
        <button v-else-if="quote" type="button" :disabled="busy" @click="generate">{{ quote.estimated ? 'Confirmar reserva e gerar' : 'Confirmar geração' }}<template v-if="quoteCost"> · Até {{ quoteCost }}</template></button>
        <button v-else-if="models.length" type="button" :disabled="busy || !canEstimate" @click="estimate">{{ base || imageBases.length ? 'Enviar referências à Higgsfield e cotar' : 'Consultar preço' }}</button>
        <template v-else-if="catalog"><span>{{ (catalog.videoModels?.length || catalog.referenceModels?.length) ? 'Nenhum modelo disponível aceita esta combinação de referências.' : 'A geração de clipes aguarda a configuração da Higgsfield.' }}</span><button type="button" :disabled="busy" @click="loadCatalog">Atualizar</button></template>
      </template>
      <span v-if="action" role="status"><q-spinner size="16px" /> {{ action }}</span>
    </div>
    <AitoIAMaintenance v-if="videoInMaintenance" area="video" compact />
    <AitoVideoProgress v-if="job" :stage="job.status || 'queued'" :percent="job.progress" />
    <p v-if="error" role="alert" class="chat-video__error">{{ error }}</p>
    <div v-if="analysis"><AitoIAResponse :text="analysis" /><button type="button" :disabled="busy" @click="prompt = analysis.slice(0, 2000)">Usar análise na descrição</button></div>
    <div v-if="clip" class="chat-video__result"><video :src="clip.url" controls playsinline preload="metadata" aria-label="Clipe gerado no chat" />
      <p v-if="clip.billingPending" class="chat-video__pricing"><template v-if="reservedCost">Reserva de {{ reservedCost }}. </template>Aguardando confirmação do custo.</p>
      <div class="chat-video__actions"><button type="button" :disabled="busy" @click="download">Baixar clipe</button><button type="button" :disabled="busy" @click="saveToProject">Salvar em projeto</button><a :href="clip.url" target="_blank" rel="noopener noreferrer">Abrir original</a></div>
    </div>
  </section>
</template>

<style scoped>
.chat-video { display: grid; gap: 10px; max-height: min(57dvh, 650px); margin-bottom: 7px; padding: 12px; overflow: auto; border: 1px solid var(--aito-ai-line); border-radius: 13px; background: var(--aito-ai-surface); }
.chat-video header, .chat-video__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.chat-video header h2 { flex: 1; margin: 0; font-size: 1rem; }
.chat-video :is(button, a, .chat-video__file) { padding: 5px 8px; border: 1px solid var(--aito-ai-line); border-radius: 7px; background: var(--aito-ai-raised); color: var(--aito-ai-accent); font: inherit; font-size: .78rem; text-decoration: none; cursor: pointer; }
.chat-video button:disabled, .chat-video__file.is-busy { opacity: .55; cursor: default; }
.chat-video label { display: grid; gap: 4px; color: var(--aito-ai-muted); font-size: .78rem; }
.chat-video__file { position: relative; display: inline-flex !important; align-items: center; }
.chat-video__file input { position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.chat-video :is(textarea, select) { min-width: 0; padding: 6px; border: 1px solid var(--aito-ai-line); border-radius: 7px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font: inherit; }
.chat-video__choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.chat-video__actions span { color: var(--aito-ai-muted); font-size: .76rem; overflow-wrap: anywhere; }
.chat-video__error { margin: 0; color: var(--aito-ai-error); font-size: .8rem; }
.chat-video__pricing { margin: 0; color: var(--aito-ai-gold); font-size: .8rem; }
.chat-video__result video { display: block; width: 100%; max-height: 290px; margin-bottom: 6px; border-radius: 7px; background: var(--aito-ai-bg); }
:global([data-aito-ia-theme='light'] .chat-video__result video) { background: var(--aito-ai-media-bg); }
</style>
