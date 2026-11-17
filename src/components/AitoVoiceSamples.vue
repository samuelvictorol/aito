<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { api } from 'boot/axios'

const voices = shallowRef([])
const loading = ref(false)
const playing = ref('')
const pending = ref('')
const error = ref('')
const sample = ref('')
let catalogRequest
let previewRequest
let disposed = false

async function loadVoices() {
  catalogRequest?.abort()
  const controller = new AbortController()
  catalogRequest = controller
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/aitoia/video/catalog', { signal: controller.signal })
    if (!disposed && !controller.signal.aborted) voices.value = data.data?.voices || []
  } catch {
    if (!disposed && !controller.signal.aborted) error.value = 'Não foi possível carregar as vozes. Tente novamente.'
  } finally {
    if (catalogRequest === controller) loading.value = false
  }
}

async function preview(voice) {
  if (!voice.previewAvailable || pending.value === voice.id) return
  previewRequest?.abort()
  const controller = new AbortController()
  previewRequest = controller
  pending.value = voice.id
  error.value = ''
  try {
    const { data } = await api.get(`/aitoia/video/voice/previews/${encodeURIComponent(voice.id)}`, {
      responseType: 'blob', signal: controller.signal,
    })
    if (disposed || controller.signal.aborted) return
    if (!(data instanceof Blob) || !data.size || !/^audio\//.test(data.type)) throw new Error('Amostra inválida.')
    if (sample.value) URL.revokeObjectURL(sample.value)
    sample.value = URL.createObjectURL(data)
    playing.value = voice.id
  } catch {
    if (!disposed && !controller.signal.aborted) error.value = 'Esta amostra não está disponível agora. Escolha outra voz.'
  } finally {
    if (previewRequest === controller) pending.value = ''
  }
}

onMounted(loadVoices)
onBeforeUnmount(() => {
  disposed = true
  catalogRequest?.abort()
  previewRequest?.abort()
  if (sample.value) URL.revokeObjectURL(sample.value)
})
</script>

<template>
  <section class="aito-voice-samples" aria-labelledby="aito-voice-samples-title">
    <h3 id="aito-voice-samples-title"><q-icon name="mdi-waveform" size="21px" /> Vozes OpenAI</h3>
    <p>Ouça amostras grátis, sem entrar e sem usar AitoTokens.</p>
    <p v-if="loading" role="status">Carregando vozes…</p>
    <div class="aito-voice-samples__list" aria-label="Amostras de vozes">
      <button v-for="voice in voices" :key="voice.id" type="button" :disabled="!voice.previewAvailable"
        :aria-label="voice.previewAvailable ? `Ouvir amostra de ${voice.label}` : `Amostra indisponível de ${voice.label}`"
        :aria-pressed="playing === voice.id" @click="preview(voice)">
        <q-spinner v-if="pending === voice.id" size="18px" />
        <q-icon v-else :name="playing === voice.id ? 'mdi-volume-high' : 'mdi-play-circle-outline'" size="19px" />
        <span>{{ voice.label }}</span>
      </button>
    </div>
    <p v-if="!loading && !error && !voices.length">As vozes estão temporariamente indisponíveis.</p>
    <p v-if="error" role="status">{{ error }} <button v-if="!voices.length" type="button" @click="loadVoices">Atualizar</button></p>
    <audio v-if="sample" :key="sample" :src="sample" controls autoplay preload="metadata"
      :aria-label="`Amostra de ${voices.find(voice => voice.id === playing)?.label || 'voz OpenAI'}`" />
    <router-link :to="{ name: 'aito-ia-video-studio', query: { tab: 'voice' } }">Criar uma locução no Estúdio <q-icon name="mdi-arrow-top-right" /></router-link>
  </section>
</template>

<style scoped>
.aito-voice-samples { display: grid; gap: 10px; padding-top: 15px; border-top: 1px solid var(--aito-ai-line); }
.aito-voice-samples h3 { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 1rem; }
.aito-voice-samples p { margin: 0; color: var(--aito-ai-muted); font-size: .82rem; line-height: 1.5; }
.aito-voice-samples__list { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 7px; max-height: 235px; overflow: auto; }
.aito-voice-samples button { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px; color: var(--aito-ai-text); border: 1px solid var(--aito-ai-line); border-radius: 8px; background: var(--aito-ai-panel); text-align: left; cursor: pointer; font-size: .8rem; }
.aito-voice-samples button[aria-pressed="true"] { border-color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); }
.aito-voice-samples button:disabled { opacity: .5; cursor: default; }
.aito-voice-samples audio { width: 100%; }
.aito-voice-samples a { color: var(--aito-ai-accent); font-size: .84rem; }
</style>
