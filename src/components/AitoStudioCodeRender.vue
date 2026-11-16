<script setup>
import { computed, ref, watch } from 'vue'
import { videoFormats } from 'src/services/aitoiaVideo'

const props = defineProps({
  busy: { type: String, default: '' },
  disabled: Boolean,
  canImprove: Boolean,
  suggestion: { type: Object, default: null },
})
const emit = defineEmits(['render', 'improve', 'downloadSource'])
const formatId = defineModel('formatId', { type: String, required: true })

const engines = [
  { id: 'hyperframes', name: 'HyperFrames', icon: 'mdi-motion-play-outline', description: 'Tipografia em movimento, letreiros e números em destaque.' },
  { id: 'lemu', name: 'Lemo Opuscar', icon: 'mdi-movie-open-star-outline', description: 'Cenas para lançamentos, demonstrações e chamadas para ação.' },
]
const presets = {
  hyperframes: [
    { id: 'kinetic', label: 'Tipografia animada', icon: 'mdi-format-text', title: 'O futuro é agora', subtitle: 'Ideias em movimento' },
    { id: 'lower-third', label: 'Letreiro', icon: 'mdi-card-text-outline', title: 'Nome do convidado', subtitle: 'Cargo ou uma breve apresentação' },
    { id: 'stat', label: 'Número em destaque', icon: 'mdi-chart-box-outline', title: '75%', subtitle: 'Um resultado que vale mostrar' },
  ],
  lemu: [
    { id: 'launch', label: 'Lançamento', icon: 'mdi-rocket-launch-outline', title: 'Uma novidade chegou', subtitle: 'Apresente o lançamento em uma linha' },
    { id: 'feature', label: 'Demonstração', icon: 'mdi-view-dashboard-outline', title: 'Tudo num só lugar', subtitle: 'Destaque como o produto resolve um problema' },
    { id: 'outro', label: 'Encerramento', icon: 'mdi-arrow-top-right', title: 'Experimente agora', subtitle: 'Mostre ao público qual é o próximo passo' },
  ],
}
const engine = ref('hyperframes')
const preset = ref(presets.hyperframes[0].id)
const title = ref('')
const subtitle = ref('')
const accent = ref('#40DACC')
const duration = ref(5)
const aspects = Object.fromEntries(videoFormats.map(format => [format.id, format.label]))
const selectedPreset = computed(() => presets[engine.value].find(item => item.id === preset.value))
const locked = computed(() => props.disabled || Boolean(props.busy))
const canRender = computed(() => !locked.value && Boolean(title.value.trim()))

watch(() => props.suggestion, suggestion => {
  if (!suggestion) return
  title.value = suggestion.title
  subtitle.value = suggestion.subtitle
})

function selectEngine(id) {
  engine.value = id
  preset.value = presets[id][0].id
}

function scene() {
  return { engine: engine.value, preset: preset.value, title: title.value.trim(), subtitle: subtitle.value.trim(),
    accent: accent.value, duration: Number(duration.value), aspectRatio: aspects[formatId.value] }
}
</script>

<template>
  <form class="code-render" @submit.prevent="canRender && emit('render', scene())">
    <header class="code-render__header">
      <q-icon name="mdi-code-tags" size="24px" />
      <div><h2>Vídeo por código</h2><p>Personalize uma animação e renderize um clipe MP4 sem usar AitoTokens.</p></div>
    </header>
    <fieldset>
      <legend>Estilo da cena</legend>
      <div class="code-render__engines">
        <button v-for="item in engines" :key="item.id" class="code-render__engine" :class="`code-render__engine--${item.id}`"
          type="button" :disabled="locked" :aria-pressed="item.id === engine" @click="selectEngine(item.id)">
          <q-icon :name="item.icon" size="25px" />
          <strong>{{ item.name }}</strong><small>{{ item.description }}</small>
        </button>
      </div>
    </fieldset>
    <fieldset>
      <legend>Modelo</legend>
      <div class="code-render__presets">
        <button v-for="item in presets[engine]" :key="item.id" class="video-studio__secondary" type="button"
          :disabled="locked" :aria-pressed="item.id === preset" @click="preset = item.id">
          <q-icon :name="item.icon" size="17px" /> {{ item.label }}
        </button>
      </div>
    </fieldset>
    <label>Título<input v-model="title" type="text" :placeholder="selectedPreset.title" maxlength="100" required :disabled="locked" /></label>
    <label>Complemento<textarea v-model="subtitle" :placeholder="selectedPreset.subtitle" rows="2" maxlength="200" :disabled="locked" /></label>
    <div class="code-render__settings">
      <label>Formato<select v-model="formatId" :disabled="locked"><option v-for="item in videoFormats" :key="item.id" :value="item.id">{{ item.title }} · {{ item.label }}</option></select></label>
      <label>Duração<select v-model="duration" :disabled="locked"><option v-for="seconds in 7" :key="seconds" :value="seconds + 1">{{ seconds + 1 }} s</option></select></label>
      <label>Cor de destaque<input v-model="accent" type="color" :disabled="locked" /></label>
    </div>
    <div class="code-render__actions">
      <button class="video-studio__primary" type="submit" :disabled="!canRender">
        <q-spinner v-if="busy === 'code-render'" size="19px" /><q-icon v-else name="mdi-movie-open-play-outline" size="19px" />
        {{ busy === 'code-render' ? 'Renderizando cena…' : 'Renderizar cena' }}
      </button>
      <button class="video-studio__secondary" type="button" :disabled="!canRender" @click="emit('downloadSource', scene())">
        <q-spinner v-if="busy === 'code-source'" size="18px" /><q-icon v-else name="mdi-file-code-outline" size="18px" />
        {{ busy === 'code-source' ? 'Preparando HTML…' : 'Baixar HTML' }}
      </button>
      <button v-if="canImprove" class="video-studio__secondary" type="button" :disabled="!canRender" @click="emit('improve', scene())">
        <q-spinner v-if="busy === 'code-text'" size="18px" /><q-icon v-else name="mdi-creation-outline" size="18px" />
        {{ busy === 'code-text' ? 'Ajustando texto…' : 'Melhorar texto com IA' }}
        <q-tooltip>Usa o modelo de texto e a cobrança de IA do administrador.</q-tooltip>
      </button>
    </div>
  </form>
</template>

<style scoped>
.code-render { display: grid; gap: 15px; }
.code-render__header { display: flex; align-items: flex-start; gap: 11px; }
.code-render__header .q-icon { margin-top: 2px; color: var(--aito-ai-accent); }
.code-render__header p { margin: 5px 0 0; color: var(--aito-ai-muted); }
.code-render fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.code-render legend { margin-bottom: 7px; color: var(--aito-ai-muted); font-size: .84rem; font-weight: 620; }
.code-render__engines, .code-render__settings { display: grid; gap: 8px; }
.code-render__engines { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.code-render__settings { grid-template-columns: minmax(0, 1.4fr) minmax(0, .6fr) minmax(0, .8fr); }
.code-render__engine { display: grid; justify-items: start; min-width: 0; gap: 6px; padding: 12px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-panel); color: var(--aito-ai-text); text-align: left; cursor: pointer; }
.code-render__engine--hyperframes { --engine-accent: #67e0d3; }
.code-render__engine--lemu { --engine-accent: #c3b2ff; }
.code-render__engine .q-icon { color: var(--engine-accent); }
.code-render__engine strong, .code-render__engine small { overflow-wrap: anywhere; }
.code-render__engine small { color: var(--aito-ai-muted); }
.code-render__engine:not(:disabled):hover, .code-render__engine[aria-pressed=true] { border-color: var(--engine-accent); background: linear-gradient(145deg, color-mix(in srgb, var(--engine-accent) 17%, transparent), transparent 80%), var(--aito-ai-panel); }
.code-render__presets, .code-render__actions { display: flex; flex-wrap: wrap; gap: 7px; }
.code-render :is(.video-studio__primary, .video-studio__secondary) { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 6px 10px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); cursor: pointer; }
.code-render .video-studio__primary { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); font-weight: 700; }
.code-render button:disabled { opacity: .62; cursor: not-allowed; }
.code-render__presets [aria-pressed=true] { color: var(--aito-ai-accent); border-color: var(--aito-ai-accent-strong); }
.code-render label { display: grid; min-width: 0; gap: 6px; color: var(--aito-ai-muted); font-size: .84rem; font-weight: 620; }
.code-render :is(input, textarea, select) { width: 100%; min-width: 0; padding: 9px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-bg); }
.code-render textarea { resize: vertical; }
.code-render :is(input, textarea)::placeholder { color: var(--aito-ai-muted); opacity: .75; }
.code-render input[type=color] { min-height: 40px; padding: 5px; cursor: pointer; }
@media (max-width: 380px) { .code-render__settings { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
