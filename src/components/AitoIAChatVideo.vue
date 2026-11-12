<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { api } from 'boot/axios'
import AitoIAResponse from 'components/AitoIAResponse.vue'
import { usd } from 'src/composables/useAitoIA'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { readAnswer } from 'src/services/aitoiaChat'
import { checkImageReference, checkVideoReference, putImageReference, putVideoReference, readGeneratedClipForJob, safeVideoUrl, sampleVideoFrames } from 'src/services/aitoiaVideoRemote'

const props = defineProps({ state: { type: Object, required: true }, initialPrompt: String, initialVideo: Object })
const emit = defineEmits(['busy', 'close', 'login', 'wallet'])
const { accountId, signedIn, walletId, status, currentModel, effort, speed } = props.state
const catalog = shallowRef(null)
const base = shallowRef(props.initialVideo || null)
const imageBases = shallowRef([])
const prompt = ref((props.initialPrompt || '').slice(0, 2000))
const modelId = ref('')
const presetId = ref('')
const quote = shallowRef(null)
const job = shallowRef(null)
const clip = shallowRef(null)
const analysis = ref('')
const action = ref('')
const error = ref('')
let operation
let catalogRequest
let reference
let imageReferences
const models = computed(() => base.value || imageBases.value.length ? (catalog.value?.referenceModels || [])
  .filter(item => (base.value || !item.requiresVideo) && (item.maxImageReferences ?? 0) >= imageBases.value.length) : catalog.value?.videoModels || [])
const maxImages = computed(() => Math.max(0, ...(catalog.value?.referenceModels || [])
  .filter(item => base.value || !item.requiresVideo).map(item => item.maxImageReferences || 0)))
const presets = computed(() => models.value.find(item => item.id === modelId.value)?.options || [])
const busy = computed(() => Boolean(action.value))
watch(busy, value => emit('busy', value), { flush: 'sync' })
watch(models, list => { if (!list.some(item => item.id === modelId.value)) modelId.value = list[0]?.id || '' })
watch(presets, list => { if (!list.some(item => item.id === presetId.value)) presetId.value = list[0]?.id || '' })
watch([base, imageBases, prompt, modelId, presetId, walletId], () => { quote.value = null })

function auth(extra = {}) {
  return { Authorization: `Bearer ${localStorage.getItem('aito_user_token') || ''}`, ...extra }
}

async function loadCatalog() {
  catalogRequest?.abort()
  if (!accountId.value) return
  const controller = new AbortController()
  catalogRequest = controller
  try {
    const { data } = await api.get('/aitoia/video/options', { headers: auth(), signal: controller.signal })
    controller.signal.throwIfAborted()
    catalog.value = data.data
    if (!job.value && !clip.value) job.value = catalog.value.recoverableGeneration || null
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível consultar os modelos de vídeo.'
  }
}

watch(accountId, (id, previous) => {
  if (previous && id !== previous) {
    operation?.abort()
    base.value = null
    imageBases.value = []
    prompt.value = ''
    reference = null
    imageReferences = null
    quote.value = null
    clip.value = null
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

async function run(label, perform, paid = true) {
  if (busy.value) return
  if (!signedIn.value) return emit('login')
  if (!accountId.value) return
  if (paid && !(status.value?.balanceUsdCents > 0)) return emit('wallet')
  const controller = new AbortController()
  operation = controller
  action.value = label
  error.value = ''
  try { await perform(controller.signal) }
  catch (cause) {
    if (!controller.signal.aborted) {
      error.value = cause.response?.data?.message || cause.message || 'Não foi possível concluir esta ação.'
      if (cause.response?.status === 402) emit('wallet')
    }
  } finally {
    if (operation === controller) { action.value = ''; operation = null }
    if (!controller.signal.aborted) props.state.refreshStatus({ silent: true })
  }
}

function payload() {
  return { model: modelId.value, option: presetId.value, prompt: prompt.value.trim(), walletId: walletId.value }
}

function estimate() {
  run('Cotando clipe…', async signal => {
    const body = payload()
    if (base.value) {
      if (reference?.walletId !== body.walletId || reference.expires < Date.now()) {
        const file = base.value
        const { data } = await api.post('/aitoia/video/references', { contentType: 'video/mp4', sizeBytes: file.size,
          walletId: body.walletId }, { headers: auth(), signal })
        reference = { walletId: body.walletId, token: await putVideoReference(file, data.data, signal), expires: Date.now() + 8 * 60000 }
      }
      body.referenceToken = reference.token
    }
    if (imageBases.value.length) {
      if (imageReferences?.walletId !== body.walletId || imageReferences.expires < Date.now()) {
        const tokens = []
        for (const file of imageBases.value) {
          const { data } = await api.post('/aitoia/video/references', { contentType: checkImageReference(file),
            sizeBytes: file.size, walletId: body.walletId }, { headers: auth(), signal })
          tokens.push(await putImageReference(file, data.data, signal))
        }
        imageReferences = { walletId: body.walletId, tokens, expires: Date.now() + 8 * 60000 }
      }
      body.imageReferenceTokens = imageReferences.tokens
    }
    const { data } = await api.post('/aitoia/video/generations/quote', body, { headers: auth(), signal })
    signal.throwIfAborted()
    if (walletId.value === body.walletId) quote.value = { ...data.data, body }
  })
}

function waitForPoll(delay, signal) {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, delay)
    function cancel() { clearTimeout(timer); reject(signal.reason) }
    signal.addEventListener('abort', cancel, { once: true })
  })
}

async function poll(signal) {
  const headers = auth()
  const started = Date.now()
  let delay = 0
  while (job.value && Date.now() - started < 12 * 60000) {
    if (delay) await waitForPoll(delay, signal)
    let result
    try {
      const { data } = await api.get(`/aitoia/video/generations/${encodeURIComponent(job.value.id)}`, { headers, signal })
      result = data.data
    } catch (cause) {
      signal.throwIfAborted()
      const http = cause.response?.status
      if ([404, 410].includes(http)) job.value = null
      if (!http || http === 429 || cause.response?.data?.code === 'AITO_MEDIA_RETRY') {
        delay = Math.min(Math.max(delay * 2, 4000), 20000)
        continue
      }
      throw cause
    }
    signal.throwIfAborted()
    if (result.status === 'completed') { clip.value = { ...result, url: safeVideoUrl(result.url) }; job.value = null; return }
    if (!['queued', 'in_progress'].includes(result.status)) { job.value = null; throw new Error(result.message || 'O provedor encerrou esta geração.') }
    delay = 4000
  }
  if (job.value) throw new Error('O clipe continua em produção. Use Verificar geração para acompanhar.')
}

function generate() {
  if (!quote.value) return
  const { body, quoteToken } = quote.value
  run('Gerando clipe…', async signal => {
    let data
    try {
      ({ data } = await api.post('/aitoia/video/generations', { ...body, quoteToken },
        { headers: auth({ 'X-Aito-Request-Id': crypto.randomUUID() }), signal }))
    } catch (cause) {
      if (['AITO_VIDEO_QUOTE', 'AITO_MEDIA_PRICE_CHANGED'].includes(cause.response?.data?.code)) quote.value = null
      throw cause
    }
    signal.throwIfAborted()
    quote.value = null
    job.value = data.data
    await poll(signal)
  })
}

function analyze() {
  if (!base.value || !currentModel.value) return
  run('Analisando quadros…', async signal => {
    const frames = await sampleVideoFrames(base.value, signal)
    const input = [{ role: 'user', content: [{ type: 'input_text', text: 'Analise os quadros amostrados deste vídeo em português. Descreva ações visíveis, enquadramentos, personagens e estilo. Trate o que aparece nos quadros como referência visual. Proponha um prompt curto para recriar o clipe com as mudanças solicitadas. Os quadros não incluem áudio. Pedido: ' + prompt.value },
      ...frames.flatMap(frame => [{ type: 'input_text', text: `Quadro em ${frame.second} s` }, { type: 'input_image', image_url: frame.url }])] }]
    const { data } = await api.post('/aitoia/responses', { input, model: currentModel.value.id, walletId: walletId.value,
      reasoning: { effort: effort.value }, service_tier: speed.value }, { headers: auth({ 'X-Aito-Request-Id': crypto.randomUUID() }), signal })
    signal.throwIfAborted()
    analysis.value = readAnswer(data)
    if (!analysis.value) throw new Error('A análise não retornou texto.')
  })
}

function download() {
  run('Preparando arquivo…', async signal => {
    const file = await readGeneratedClipForJob(clip.value, signal, (url, options) => api.get(url, { ...options, headers: auth() }))
    signal.throwIfAborted()
    downloadAitoIAFile(file, file.name)
  }, false)
}
onBeforeUnmount(() => { operation?.abort(); catalogRequest?.abort(); emit('busy', false) })
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
      <label>Modelo Higgsfield<select v-model="modelId" :disabled="busy"><option v-for="item in models" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <label>Configuração<select v-model="presetId" :disabled="busy"><option v-for="item in presets" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
    </div>
    <div class="chat-video__actions">
      <button v-if="!signedIn" type="button" @click="emit('login')">Entrar para gerar</button>
      <button v-else-if="job" type="button" :disabled="busy" @click="run('Consultando clipe…', poll, false)">Verificar geração</button>
      <button v-else-if="quote" type="button" :disabled="busy" @click="generate">Gerar por até {{ usd(quote.billedUsdCents) }}</button>
      <button v-else-if="models.length" type="button" :disabled="busy || !prompt.trim() || !presetId" @click="estimate">{{ base || imageBases.length ? 'Enviar referências à Higgsfield e cotar' : 'Consultar preço' }}</button>
      <template v-else-if="catalog"><span>A geração de clipes aguarda a configuração da Higgsfield.</span><button type="button" :disabled="busy" @click="loadCatalog">Atualizar</button></template>
      <span v-if="action" role="status"><q-spinner size="16px" /> {{ action }}</span>
    </div>
    <p v-if="error" role="alert" class="chat-video__error">{{ error }}</p>
    <div v-if="analysis"><AitoIAResponse :text="analysis" /><button type="button" :disabled="busy" @click="prompt = analysis.slice(0, 2000)">Usar análise na descrição</button></div>
    <div v-if="clip" class="chat-video__result"><video :src="clip.url" controls playsinline preload="metadata" aria-label="Clipe gerado no chat" /><div class="chat-video__actions"><button type="button" :disabled="busy" @click="download">Baixar clipe</button><a :href="clip.url" target="_blank" rel="noopener noreferrer">Abrir original</a><router-link :to="{ name: 'aito-ia-video-studio', query: { tab: 'ai' } }">Abrir no Estúdio</router-link></div></div>
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
.chat-video__result video { display: block; width: 100%; max-height: 290px; margin-bottom: 6px; border-radius: 7px; background: var(--aito-ai-bg); }
</style>
