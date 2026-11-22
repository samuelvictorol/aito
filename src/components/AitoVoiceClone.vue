<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'
import { aitoTokens } from 'src/composables/useAitoIA'

const props = defineProps({ modelValue: Boolean, access: { type: Function, required: true }, walletId: { type: String, default: 'web' },
  accountId: String, allowCredits: { type: Function, default: () => true }, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'ready', 'busy', 'balance'])
const $q = useQuasar(), { isDark } = useAitoIATheme()
const opened = ref(false)
const options = shallowRef(null)
const busy = ref('')
const error = ref('')
const name = ref('')
const sample = shallowRef(null)
const consent = shallowRef(null)
const sampleUrl = ref(''), consentUrl = ref('')
const rights = ref(false)
const voiceId = ref('')
const text = ref('')
const adding = ref(false)
const quote = shallowRef(null)
const output = shallowRef(null)
const outputUrl = ref('')
const incomplete = ref(false)
const uploadProgress = ref(0)
const recording = ref('')
const recordSeconds = ref(0)
let recorder, recordingStream, recordingTimer, controller
let enrollmentId = crypto.randomUUID(), speechId = crypto.randomUUID()
let disposed = false
const apiPath = '/aitoia/video/voice-clone'
const maxBytes = computed(() => options.value?.maxSampleBytes || 10 * 1024 * 1024)
const maxSeconds = computed(() => options.value?.maxSampleSeconds || 60)
const maxCharacters = computed(() => options.value?.maxCharacters || 2000)
const enabled = computed(() => options.value?.enabled === true)
const voices = computed(() => options.value?.voices || [])
const selectedVoice = computed(() => voices.value.find(item => item.id === voiceId.value))
const canEnroll = computed(() => !props.disabled && enabled.value && options.value?.consentPhrase && name.value.trim() && sample.value && consent.value && rights.value && !busy.value && !recording.value)
const canSpeak = computed(() => !props.disabled && enabled.value && voiceId.value && text.value.trim() && text.value.length <= maxCharacters.value && !busy.value && !recording.value)
const notify = message => $q.notify({ type: 'warning', position: 'top', message })
const message = cause => cause.response?.data?.message || cause.message || 'Não foi possível concluir esta etapa.'

function setOpen(value) {
  if (busy.value && !value) return
  opened.value = value
  emit('update:modelValue', value)
  if (value) void loadOptions()
  if (!value) stopRecording()
}
function begin(kind) {
  controller?.abort()
  controller = new AbortController()
  busy.value = kind; error.value = ''; emit('busy', true)
  return controller
}
function finish(owner) {
  if (controller !== owner) return
  controller = null; busy.value = ''; emit('busy', false)
}
async function loadOptions() {
  const owner = begin('options')
  options.value = null
  try {
    const session = props.access()
    const { data } = await session.get(`${apiPath}/options`, { signal: owner.signal, timeout: 15000 })
    if (disposed || owner.signal.aborted || !session.current()) return
    options.value = data.data
    if (!voices.value.some(voice => voice.id === voiceId.value)) voiceId.value = voices.value[0]?.id || ''
    adding.value = !voices.value.length
  } catch (cause) { if (!owner.signal.aborted) error.value = message(cause) }
  finally { finish(owner) }
}
async function copyConsent() {
  try { await copyToClipboard(options.value?.consentPhrase || ''); $q.notify({ type: 'positive', position: 'top', message: 'Frase copiada.' }) }
  catch { notify('Selecione a frase e copie o texto.') }
}
function clearQuote() { quote.value = null; speechId = crypto.randomUUID() }
watch([name, sample, consent, rights], () => { enrollmentId = crypto.randomUUID() })
watch(sample, value => { if (sampleUrl.value) URL.revokeObjectURL(sampleUrl.value); sampleUrl.value = value ? URL.createObjectURL(value) : '' })
watch(consent, value => { if (consentUrl.value) URL.revokeObjectURL(consentUrl.value); consentUrl.value = value ? URL.createObjectURL(value) : '' })
watch([text, voiceId, () => props.walletId], clearQuote)
watch(() => props.modelValue, value => { if (value !== opened.value) setOpen(value) }, { immediate: true })

async function recordingWave(file) {
  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) throw Error('Este navegador não consegue preparar a gravação. Envie um MP3, M4A ou WAV.')
  const context = new Context({ sampleRate: 48000 })
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer())
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > maxSeconds.value + .1) throw Error(`Use um áudio de até ${maxSeconds.value} segundos.`)
    const length = decoded.length, buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer)
    const word = (offset, value) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)) }
    word(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, decoded.sampleRate, true); view.setUint32(28, decoded.sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    word(36, 'data'); view.setUint32(40, length * 2, true)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
    for (let index = 0; index < length; index++) {
      const value = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[index], 0) / channels.length))
      view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
    }
    return new File([buffer], file.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' })
  } finally { await context.close().catch(() => {}) }
}

async function audioDuration(file) {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const audio = document.createElement('audio')
      const timer = setTimeout(() => finish(Error('Não foi possível conferir o áudio. Envie um MP3, M4A ou WAV válido.')), 10000)
      let ended = false
      function finish(cause, value) {
        if (ended) return; ended = true; clearTimeout(timer)
        audio.onloadedmetadata = audio.ondurationchange = audio.onerror = null
        audio.removeAttribute('src'); audio.load()
        if (cause) reject(cause); else resolve(value)
      }
      audio.onloadedmetadata = audio.ondurationchange = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) finish(null, audio.duration)
        else if (audio.duration === Infinity) audio.currentTime = 1e101
      }
      audio.onerror = () => finish(Error('Este arquivo não pôde ser lido como áudio.'))
      audio.preload = 'metadata'; audio.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}
async function chooseAudio(kind, file) {
  if (!file) { if (kind === 'sample') sample.value = null; else consent.value = null; return }
  if (file.size > maxBytes.value) return notify('Cada áudio pode ter até 10 MB.')
  if (!file.type.startsWith('audio/') && !/\.(?:wav|mp3|m4a|mp4|ogg|webm|aac)$/i.test(file.name)) return notify('Escolha um áudio MP3, M4A, WAV, AAC, OGG ou WebM.')
  try {
    if (file.type.startsWith('audio/webm') || /\.webm$/i.test(file.name)) file = await recordingWave(file)
    const seconds = await audioDuration(file)
    if (kind === 'sample' && seconds < 5) return notify('A amostra de voz precisa ter pelo menos 5 segundos.')
    if (seconds > maxSeconds.value + .1) return notify(`Use um áudio de até ${maxSeconds.value} segundos.`)
    if (kind === 'sample') sample.value = file; else consent.value = file
  } catch (cause) { notify(cause.message) }
}
async function toggleRecording(kind) {
  if (recording.value) return stopRecording()
  if (!enabled.value || busy.value || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return notify('A gravação não está disponível neste navegador. Envie um arquivo de áudio.')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (disposed || !opened.value) { stream.getTracks().forEach(track => track.stop()); return }
    recordingStream = stream
    const chunks = []
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
    const activeRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorder = activeRecorder
    activeRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    activeRecorder.onstop = () => {
      const type = activeRecorder.mimeType?.split(';')[0] || mime?.split(';')[0] || 'audio/webm'
      const file = new File(chunks, `${kind === 'sample' ? 'amostra' : 'consentimento'}.${type === 'audio/mp4' ? 'm4a' : 'webm'}`, { type })
      stream.getTracks().forEach(track => track.stop()); if (recordingStream === stream) recordingStream = null
      if (!disposed && file.size) void chooseAudio(kind, file)
    }
    recordSeconds.value = 0; recording.value = kind
    activeRecorder.start(300)
    recordingTimer = setInterval(() => { recordSeconds.value++; if (recordSeconds.value >= maxSeconds.value) stopRecording() }, 1000)
  } catch { stopRecording(); notify('Não foi possível acessar o microfone. Você pode enviar um arquivo de áudio.') }
}
function stopRecording() {
  clearInterval(recordingTimer)
  if (recorder?.state && recorder.state !== 'inactive') recorder.stop()
  else recordingStream?.getTracks().forEach(track => track.stop())
  recording.value = ''
}
async function enroll() {
  if (!canEnroll.value) return
  const owner = begin('enroll'), session = props.access()
  uploadProgress.value = 0
  try {
    const form = new FormData()
    form.append('name', name.value.trim()); form.append('language', 'pt'); form.append('sample', sample.value)
    form.append('consent', consent.value); form.append('rightsConfirmed', 'true')
    const { data } = await session.post(`${apiPath}/voices`, form, { signal: owner.signal, timeout: 180000,
      headers: { 'X-Aito-Request-Id': enrollmentId },
      onUploadProgress: event => { uploadProgress.value = event.total ? event.loaded / event.total : 0 },
    })
    if (disposed || owner.signal.aborted || !session.current()) return
    const voice = data.data?.voice
    if (!voice?.id) throw Error('O provedor não confirmou o cadastro desta voz.')
    options.value = { ...options.value, voices: [voice, ...voices.value.filter(item => item.id !== voice.id)] }
    voiceId.value = voice.id; adding.value = false
    sample.value = consent.value = null; rights.value = false; name.value = ''
    $q.notify({ type: 'positive', position: 'top', message: 'Voz cadastrada. Agora escreva a locução.' })
  } catch (cause) { if (!owner.signal.aborted) error.value = message(cause) }
  finally { finish(owner) }
}
function removeVoice() {
  const selected = selectedVoice.value, account = props.accountId
  if (!selected || busy.value || recording.value || props.disabled) return
  $q.dialog({ title: 'Remover voz cadastrada?', message: `A voz “${selected.name}” será removida do provedor e desta conta.`,
    dark: isDark.value, persistent: true, cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Remover voz', color: 'negative', noCaps: true },
  }).onOk(async () => {
    if (disposed || props.accountId !== account || busy.value || !voices.value.some(voice => voice.id === selected.id)) return
    const owner = begin('remove'), session = props.access()
    try {
      await session.delete(`${apiPath}/voices/${encodeURIComponent(selected.id)}`, { signal: owner.signal, timeout: 100000 })
      if (disposed || owner.signal.aborted || !session.current()) return
      options.value = { ...options.value, voices: voices.value.filter(voice => voice.id !== selected.id) }
      if (voiceId.value === selected.id) voiceId.value = voices.value[0]?.id || ''
      adding.value = !voices.value.length; clearQuote()
      $q.notify({ type: 'positive', position: 'top', message: 'Voz removida.' })
    } catch (cause) { if (!owner.signal.aborted) error.value = message(cause) }
    finally { finish(owner) }
  })
}
async function speak() {
  if (!canSpeak.value || !props.allowCredits()) return
  const owner = begin(quote.value ? 'speech' : 'quote'), session = props.access()
  const body = { text: text.value.trim(), voiceId: voiceId.value, walletId: props.walletId }
  try {
    if (!quote.value) {
      const { data } = await session.post(`${apiPath}/speech/quote`, body, { signal: owner.signal, timeout: 20000 })
      if (!disposed && !owner.signal.aborted && session.current()) {
        if (!Number.isFinite(data.data?.maxBilledUsdCents) || data.data.maxBilledUsdCents < 0) throw Error('Não foi possível conferir o valor desta locução. Tente novamente.')
        quote.value = data.data
      }
      return
    }
    const { data, headers } = await session.post(`${apiPath}/speech`, { ...body, maxBilledUsdCents: quote.value.maxBilledUsdCents },
      { signal: owner.signal, timeout: 180000, responseType: 'blob', headers: { 'X-Aito-Request-Id': speechId } })
    if (disposed || owner.signal.aborted || !session.current()) return
    if (!(data instanceof Blob) || !data.size || !data.type.startsWith('audio/')) throw Error('O provedor não retornou um áudio válido.')
    if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
    const type = data.type.split(';')[0]
    output.value = new File([data], `${(selectedVoice.value?.name || 'voz-clonada').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.${type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : 'm4a'}`, { type })
    outputUrl.value = URL.createObjectURL(output.value)
    incomplete.value = ['1', 'true'].includes(String(headers?.['x-aito-audio-incomplete']).toLowerCase())
    options.value = { ...options.value, recentSpeech: { id: speechId, createdAt: new Date().toISOString() } }
    quote.value = null; speechId = crypto.randomUUID(); emit('balance')
  } catch (cause) {
    if (!owner.signal.aborted) {
      let detail = cause.response?.data
      if (detail instanceof Blob && detail.size < 20000) { try { detail = JSON.parse(await detail.text()) } catch { detail = null } }
      error.value = detail?.message || message(cause)
      if ([409, 422].includes(cause.response?.status)) clearQuote()
    }
  } finally { finish(owner) }
}
async function recoverSpeech() {
  const id = options.value?.recentSpeech?.id
  if (!id || busy.value) return
  const owner = begin('recover'), session = props.access()
  try {
    const { data, headers } = await session.get(`${apiPath}/speech/${encodeURIComponent(id)}`, { signal: owner.signal, timeout: 45000, responseType: 'blob' })
    if (disposed || owner.signal.aborted || !session.current()) return
    if (!(data instanceof Blob) || !data.size || !data.type.startsWith('audio/')) throw Error('A locução ainda não está disponível para recuperação.')
    if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
    output.value = new File([data], 'locucao-recuperada.wav', { type: data.type.split(';')[0] })
    outputUrl.value = URL.createObjectURL(output.value)
    incomplete.value = ['1', 'true'].includes(String(headers?.['x-aito-audio-incomplete']).toLowerCase())
  } catch (cause) { if (!owner.signal.aborted) error.value = message(cause) }
  finally { finish(owner) }
}
watch(() => props.accountId, () => {
  controller?.abort(); controller = null; busy.value = ''; emit('busy', false); stopRecording()
  options.value = output.value = sample.value = consent.value = null
  name.value = text.value = voiceId.value = ''; rights.value = false; clearQuote()
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
  outputUrl.value = ''; opened.value = false; emit('update:modelValue', false)
})
function useAudio() { if (output.value) { emit('ready', output.value); setOpen(false) } }
onBeforeUnmount(() => { disposed = true; controller?.abort(); stopRecording(); for (const url of [outputUrl.value, sampleUrl.value, consentUrl.value]) if (url) URL.revokeObjectURL(url); emit('busy', false) })
</script>

<template>
  <q-btn no-caps outline class="voice-clone__open" icon="mdi-microphone-plus" label="Clonar Voz" :disable="disabled" @click="setOpen(true)" />
  <q-dialog :model-value="opened" :persistent="Boolean(busy || recording)" @update:model-value="setOpen">
    <q-card class="voice-clone aito-ai-theme">
      <header><div><span>LOCUÇÃO COM A SUA IDENTIDADE</span><h2><q-icon name="mdi-microphone-plus" /> Clonar Voz</h2></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar clonagem de voz" :disable="Boolean(busy || recording)" @click="setOpen(false)" /></header>
      <div class="voice-clone__body">
        <div v-if="busy === 'options'" class="voice-clone__state"><q-spinner size="28px" /> Conferindo disponibilidade…</div>
        <q-banner v-else-if="options && !enabled" rounded class="voice-clone__info">{{ options.reason || 'A clonagem de voz ainda não está habilitada para esta conexão. As vozes de locução do estúdio continuam disponíveis.' }}</q-banner>
        <template v-if="enabled">
          <div v-if="voices.length" class="voice-clone__select-row"><q-select v-model="voiceId" :options="voices" option-value="id" option-label="name" emit-value map-options :dark="isDark" outlined dense label="Sua voz cadastrada" :disable="Boolean(busy || recording)" /><div class="voice-clone__voice-actions"><q-btn no-caps flat icon="mdi-plus" label="Nova voz" :disable="Boolean(busy || recording)" @click="adding = !adding" /><q-btn flat round dense icon="mdi-delete-outline" aria-label="Remover voz cadastrada" :loading="busy === 'remove'" :disable="Boolean(busy || recording || !selectedVoice)" @click="removeVoice"><q-tooltip>Remover voz cadastrada</q-tooltip></q-btn></div></div>
          <section v-if="adding" class="voice-clone__enroll">
            <h3>Cadastre uma voz autorizada</h3>
            <q-input v-model="name" :dark="isDark" outlined dense label="Nome da voz" maxlength="80" :disable="Boolean(busy || recording)" />
            <div class="voice-clone__upload-row"><q-file :model-value="sample" :dark="isDark" outlined dense clearable label="Amostra de voz · até 60 segundos" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.aac" :disable="Boolean(busy || recording)" @update:model-value="chooseAudio('sample', $event)"><template #prepend><q-icon name="mdi-file-music-outline" /></template></q-file><q-btn outline no-caps :icon="recording === 'sample' ? 'mdi-stop' : 'mdi-microphone'" :label="recording === 'sample' ? `Parar · ${recordSeconds} s` : 'Gravar'" :disable="Boolean(busy || (recording && recording !== 'sample'))" @click="toggleRecording('sample')" /></div>
            <audio v-if="sampleUrl" :src="sampleUrl" controls preload="metadata" aria-label="Conferir amostra de voz" />
            <div class="voice-clone__consent"><strong>Consentimento de quem está falando</strong><p>Grave a frase abaixo com a mesma voz da amostra.</p><blockquote>{{ options.consentPhrase }}</blockquote><q-btn flat dense no-caps icon="mdi-content-copy" label="Copiar frase" @click="copyConsent" /></div>
            <div class="voice-clone__upload-row"><q-file :model-value="consent" :dark="isDark" outlined dense clearable label="Áudio de consentimento" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.aac" :disable="Boolean(busy || recording)" @update:model-value="chooseAudio('consent', $event)"><template #prepend><q-icon name="mdi-account-voice" /></template></q-file><q-btn outline no-caps :icon="recording === 'consent' ? 'mdi-stop' : 'mdi-microphone'" :label="recording === 'consent' ? `Parar · ${recordSeconds} s` : 'Gravar'" :disable="Boolean(busy || (recording && recording !== 'consent'))" @click="toggleRecording('consent')" /></div>
            <audio v-if="consentUrl" :src="consentUrl" controls preload="metadata" aria-label="Conferir gravação de consentimento" />
            <q-checkbox v-model="rights" :dark="isDark" :disable="Boolean(busy || recording)" label="Esta voz é minha ou tenho autorização para usá-la." />
            <q-linear-progress v-if="busy === 'enroll'" :value="uploadProgress" :indeterminate="!uploadProgress" :color="isDark ? 'grey-4' : 'teal-7'" />
            <q-btn unelevated no-caps class="voice-clone__primary" icon="mdi-account-check-outline" label="Cadastrar voz" :disable="!canEnroll" :loading="busy === 'enroll'" @click="enroll" />
          </section>
          <section v-if="voices.length" class="voice-clone__speech">
            <label for="voice-clone-text">Texto da locução</label><textarea id="voice-clone-text" v-model="text" :maxlength="maxCharacters" rows="4" :disabled="Boolean(busy || recording)" placeholder="Escreva a fala que será gerada com a voz selecionada…" />
            <span class="voice-clone__count">{{ text.length }} / {{ maxCharacters }}</span>
            <p v-if="quote" class="voice-clone__price">Até ≈ {{ aitoTokens(quote.estimatedAitoTokens || quote.approximateAitoTokens || 0) }} AitoTokens</p>
            <q-btn no-caps unelevated class="voice-clone__primary" :icon="quote ? 'mdi-microphone' : 'mdi-sparkles'" :label="quote ? 'Confirmar e gerar locução' : 'Gerar com esta voz'" :disable="!canSpeak" :loading="['speech', 'quote'].includes(busy)" @click="speak" />
          </section>
          <q-btn v-if="!output && options.recentSpeech?.id" flat no-caps icon="mdi-backup-restore" label="Recuperar última locução" :loading="busy === 'recover'" :disable="Boolean(busy)" @click="recoverSpeech" />
        </template>
        <section v-if="output" class="voice-clone__result"><h3>Confira a locução</h3><audio :src="outputUrl" controls preload="metadata" /><p v-if="incomplete" class="voice-clone__info">O áudio foi entregue parcialmente. Ouça antes de usar.</p><div><a :href="outputUrl" :download="output.name"><q-icon name="mdi-download-outline" /> Baixar áudio</a><q-btn no-caps unelevated class="voice-clone__primary" icon="mdi-check" label="Usar na locução" @click="useAudio" /></div></section>
        <q-btn v-if="!enabled && options?.recentSpeech?.id" flat no-caps icon="mdi-backup-restore" label="Recuperar última locução" :loading="busy === 'recover'" :disable="Boolean(busy)" @click="recoverSpeech" />
        <p v-if="error" class="voice-clone__error" role="alert">{{ error }}</p>
        <q-btn v-if="!options && !busy" no-caps flat icon="mdi-refresh" label="Tentar novamente" @click="loadOptions" />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.voice-clone__open { color: var(--aito-ai-accent); border-radius: 9px; }
.voice-clone { display: flex; flex-direction: column; width: min(700px, calc(100vw - 28px)); max-width: 95vw !important; max-height: 93dvh; overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 20px; color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.voice-clone > header { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 22px; border-bottom: 1px solid var(--aito-ai-line); background: var(--aito-ai-panel); }
.voice-clone > header span { color: var(--aito-ai-muted); font-size: .6rem; letter-spacing: .12em; font-weight: 700; }
.voice-clone h2 { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 1.4rem; line-height: 1.2; font-weight: 750; }
.voice-clone h3 { margin: 0; font-size: .94rem; font-weight: 700; }
.voice-clone__body { display: grid; gap: 20px; padding: 22px; overflow: auto; min-height: 0; }
.voice-clone__state { display: flex; justify-content: center; align-items: center; gap: 12px; min-height: 130px; color: var(--aito-ai-muted); }
.voice-clone__select-row,.voice-clone__upload-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; }
.voice-clone__voice-actions { display: flex; align-items: center; gap: 3px; }
.voice-clone__enroll,.voice-clone__speech,.voice-clone__result { display: grid; gap: 13px; padding: 16px; border: 1px solid var(--aito-ai-line); border-radius: 13px; background: var(--aito-ai-panel); }
.voice-clone__enroll > audio { width: 100%; }
.voice-clone__consent { padding: 13px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-surface); }
.voice-clone__consent strong { font-size: .78rem; }.voice-clone__consent p { margin: 7px 0; color: var(--aito-ai-muted); font-size: .75rem; line-height: 1.6; }
.voice-clone blockquote { margin: 10px 0 4px; padding-left: 12px; border-left: 3px solid var(--aito-ai-accent-strong); color: var(--aito-ai-text); font-size: .85rem; line-height: 1.65; }
.voice-clone__primary { justify-self: start; border-radius: 9px; color: var(--aito-ai-on-accent); background: var(--aito-ai-gradient); }
.voice-clone__speech label { font-size: .82rem; font-weight: 650; }
.voice-clone textarea { box-sizing: border-box; width: 100%; padding: 11px; border: 1px solid var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-text); background: var(--aito-ai-bg); font: inherit; font-size: .85rem; line-height: 1.55; resize: vertical; }
.voice-clone__count { justify-self: end; color: var(--aito-ai-muted); font-size: .68rem; }
.voice-clone__price { margin: 0; color: var(--aito-ai-gold); font-size: .82rem; }
.voice-clone__result > audio { width: 100%; }.voice-clone__result > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }.voice-clone__result a { color: var(--aito-ai-accent); font-size: .8rem; text-decoration: none; }
.voice-clone__info { color: var(--aito-ai-muted); background: var(--aito-ai-accent-soft); font-size: .84rem; line-height: 1.6; }
.voice-clone__error { margin: 0; padding: 12px; border: 1px solid var(--aito-ai-error-line); border-radius: 9px; color: var(--aito-ai-error); background: var(--aito-ai-error-soft); font-size: .83rem; line-height: 1.6; }
@media(max-width:540px) { .voice-clone > header,.voice-clone__body { padding: 16px; }.voice-clone__enroll,.voice-clone__speech,.voice-clone__result { padding: 12px; }.voice-clone__upload-row,.voice-clone__select-row { grid-template-columns: minmax(0,1fr); }.voice-clone__upload-row > .q-btn,.voice-clone__select-row > .q-btn { justify-self: start; } }
</style>
