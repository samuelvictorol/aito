<script setup>
import { computed, ref, watch } from 'vue'
import { videoFormats } from 'src/services/aitoiaVideo'
import lemoCatalog from 'src/data/aitoMotionStyles.json'

const props = defineProps({
  busy: { type: String, default: '' },
  disabled: Boolean,
  canImprove: Boolean,
  suggestion: { type: Object, default: null },
})
const emit = defineEmits(['render', 'improve', 'downloadSource'])
const formatId = defineModel('formatId', { type: String, required: true })

const hyperframes = [
  { id: 'kinetic', label: 'Tipografia animada', category: 'titles', accent: '#4ce9d1', background: '#10223c', motion: 'zoom', description: 'Uma manchete em movimento para abrir a história.', title: 'Seu WhatsApp, em ordem.', subtitle: 'Reúna conversas e acompanhe cada atendimento.' },
  { id: 'lower-third', label: 'Letreiro', category: 'titles', accent: '#84c8ff', background: '#111828', layout: 'bottom', motion: 'slide', description: 'Apresente pessoas, funções ou lugares.', title: 'Mariana Lopes', subtitle: 'Especialista em atendimento' },
  { id: 'stat', label: 'Número em destaque', category: 'data', accent: '#72f1a3', background: '#123126', motion: 'rise', description: 'Dê espaço para o número que conta a história.', title: '75%', subtitle: 'dos pedidos acompanhados em tempo real' },
  { id: 'quote', label: 'Citação', category: 'titles', accent: '#f6b8e8', background: '#32243b', motion: 'fade', description: 'Uma frase com autoria em uma composição editorial.', title: 'O simples dá espaço ao essencial.', subtitle: 'Equipe de produto' },
  { id: 'chapter', label: 'Capítulo', category: 'titles', accent: '#f6dc86', background: '#2c251d', motion: 'sweep', description: 'Marque a mudança de assunto.', title: 'Primeiros passos', subtitle: 'Da configuração à primeira conversa' },
  { id: 'split', label: 'Tela dividida', category: 'product', accent: '#8abaff', background: '#182643', layout: 'split', motion: 'slide', description: 'Uma mensagem acompanhada de uma forma em destaque.', title: 'Da mensagem à solução', subtitle: 'O atendimento e as automações no mesmo lugar.' },
  { id: 'cta', label: 'Chamada para ação', category: 'product', accent: '#f4a578', background: '#2f211f', motion: 'pulse', description: 'Encerre o vídeo com o próximo passo.', title: 'Experimente agora', subtitle: 'Monte seu primeiro fluxo.' },
  { id: 'timeline', label: 'Linha do tempo', category: 'data', accent: '#bfb0fd', background: '#201c38', layout: 'left', motion: 'rise', description: 'Apresente etapas ou marcos de um projeto.', title: 'Da ideia ao lançamento', subtitle: 'Planejar • Criar • Publicar' },
  { id: 'ticker', label: 'Faixa animada', category: 'data', accent: '#b9ef78', background: '#233027', layout: 'bottom', motion: 'slide', description: 'Acompanhe uma manchete com uma faixa em movimento.', title: 'Novidades em movimento', subtitle: 'Automação • Atendimento • IA' },
]
const engines = [
  { id: 'hyperframes', name: 'HyperFrames', icon: 'mdi-motion-play-outline', description: 'Tipografia, dados e cenas de produto.', size: hyperframes.length },
  { id: 'lemu', name: 'Lemo Opuscar', icon: 'mdi-movie-open-outline', description: 'Estéticas de cinema e animação.', size: lemoCatalog.styles.length },
]
const hyperCategories = [{ id: 'titles', label: 'Tipografia' }, { id: 'data', label: 'Dados' }, { id: 'product', label: 'Produto' }]
const alignment = [{ id: 'auto', label: 'Do modelo' }, { id: 'left', label: 'Esquerda' }, { id: 'center', label: 'Centro' }, { id: 'right', label: 'Direita' }, { id: 'bottom', label: 'Inferior' }, { id: 'split', label: 'Dividido' }]
const movements = [{ id: 'auto', label: 'Do modelo' }, { id: 'rise', label: 'Subir' }, { id: 'slide', label: 'Deslizar' }, { id: 'zoom', label: 'Aproximar' }, { id: 'fade', label: 'Surgir' }, { id: 'sweep', label: 'Revelar' }, { id: 'pulse', label: 'Pulsar' }, { id: 'none', label: 'Estático' }]
const speeds = [{ id: 'slow', label: 'Lenta' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Rápida' }]
const fonts = [{ id: 'auto', label: 'Do modelo' }, { id: 'sans', label: 'Sem serifa' }, { id: 'serif', label: 'Com serifa' }, { id: 'mono', label: 'Monoespaçada' }]
const hyperArt = {
  kinetic: ['grid', 'rings'], 'lower-third': ['grid', 'wire'], stat: ['grid', 'bars'], quote: ['grain', 'ink'],
  chapter: ['scanlines', 'paper'], split: ['grid', 'tiles'], cta: ['grid', 'rays'], timeline: ['grid', 'route'], ticker: ['scanlines', 'bars'],
}

const engine = ref('hyperframes')
const rememberedPreset = ref({ hyperframes: hyperframes[0].id, lemu: lemoCatalog.styles[0].id })
const query = ref('')
const category = ref('')
const page = ref(1)
const pageSize = 9
const title = ref(hyperframes[0].title)
const subtitle = ref(hyperframes[0].subtitle)
const eyebrow = ref('')
const accent = ref(hyperframes[0].accent)
const background = ref(hyperframes[0].background)
const duration = ref(5)
const layout = ref('auto')
const motion = ref('auto')
const intensity = ref(65)
const speed = ref('normal')
const font = ref('auto')
const previewKey = ref(0)

const aspects = Object.fromEntries(videoFormats.map(format => [format.id, format.label]))
const models = computed(() => engine.value === 'hyperframes' ? hyperframes : lemoCatalog.styles)
const categories = computed(() => engine.value === 'hyperframes' ? hyperCategories : lemoCatalog.categories)
const categoryNames = computed(() => Object.fromEntries(categories.value.map(group => [group.id, group.label])))
const selectedPresetId = computed(() => rememberedPreset.value[engine.value])
const selectedPreset = computed(() => models.value.find(item => item.id === selectedPresetId.value) || models.value[0])
const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
const matches = computed(() => {
  const terms = normalize(query.value.trim()).split(/\s+/)
  return models.value.filter(item => {
    if (category.value && category.value !== item.category) return false
    const text = normalize([item.label, item.description, item.id, categoryNames.value[item.category]].join(' '))
    return terms.every(term => text.includes(term))
  })
})
const pages = computed(() => Math.max(1, Math.ceil(matches.value.length / pageSize)))
const visibleModels = computed(() => matches.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const locked = computed(() => props.disabled || Boolean(props.busy))
const canRender = computed(() => !locked.value && Boolean(title.value.trim()))
const previewMotion = computed(() => motion.value === 'auto' ? selectedPreset.value.motion || 'rise' : motion.value)
const previewLayout = computed(() => layout.value === 'auto' ? selectedPreset.value.layout || 'center' : layout.value)
const previewFont = computed(() => font.value === 'auto' ? modelFont(selectedPreset.value) : font.value)
const previewStyle = computed(() => ({
  ...palette({ accent: accent.value, background: background.value }),
  '--scene-travel': `${Number(intensity.value) * .5}px`,
  '--scene-scale': 1 - Number(intensity.value) * .003,
  '--scene-time': { slow: '1.15s', normal: '.78s', fast: '.48s' }[speed.value],
}))

watch([query, category], () => { page.value = 1 })
watch(() => props.suggestion, suggestion => {
  if (!suggestion) return
  title.value = suggestion.title
  subtitle.value = suggestion.subtitle
})

function palette({ accent: highlight, background: canvas }) {
  const channels = canvas.match(/[0-9a-f]{2}/gi).map(channel => Number.parseInt(channel, 16) / 255)
  const lightness = channels.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  const [red, green, blue] = lightness
  const luma = .2126 * red + .7152 * green + .0722 * blue
  return { '--model-accent': highlight, '--model-background': canvas, '--model-text': luma > .20 ? '#0a1420' : '#f7f9ff' }
}

function modelFont(item) {
  if (['quote', 'chapter'].includes(item.id) || ['painting', 'crafts', 'print', 'film'].includes(item.category)) return 'serif'
  if (item.id === 'timeline' || engine.value === 'lemu' && ['games', 'instruments', 'data'].includes(item.category)) return 'mono'
  return 'sans'
}

function art(item) {
  const [texture, motif] = hyperArt[item.id] || [item.texture, item.motif]
  return [`art--${item.id}`, `texture--${texture}`, `motif--${motif}`, `art-layout--${item.layout || 'center'}`]
}

function selectEngine(id) {
  if (engine.value === id) return
  engine.value = id
  query.value = ''
  category.value = ''
  page.value = 1
  usePalette()
}

function selectPreset(item) {
  rememberedPreset.value[engine.value] = item.id
  usePalette()
}

function usePalette() {
  accent.value = selectedPreset.value.accent
  background.value = selectedPreset.value.background
}

function sample() {
  const model = selectedPreset.value
  title.value = model.title || model.label
  subtitle.value = model.subtitle || model.description
}

function scene() {
  return { engine: engine.value, preset: selectedPresetId.value, title: title.value.trim(), subtitle: subtitle.value.trim(),
    eyebrow: eyebrow.value.trim(), accent: accent.value, background: background.value, duration: Number(duration.value),
    aspectRatio: aspects[formatId.value], layout: layout.value, motion: motion.value, intensity: Number(intensity.value),
    speed: speed.value, font: font.value }
}
</script>

<template>
  <form class="code-render" @submit.prevent="canRender && emit('render', scene())">
    <header class="code-render__header">
      <q-icon name="mdi-code-tags" size="26px" />
      <div><h2>Vídeo por código</h2><p>Escolha uma skill e edite a cena. A renderização não usa AitoTokens.</p></div>
    </header>

    <fieldset class="code-render__section">
      <legend>Skill</legend>
      <div class="code-render__engines">
        <button v-for="item in engines" :key="item.id" class="code-render__engine" :class="`code-render__engine--${item.id}`"
          type="button" :disabled="locked" :aria-pressed="item.id === engine" @click="selectEngine(item.id)">
          <q-icon :name="item.icon" size="25px" />
          <span><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span>
          <span class="code-render__engine-count">{{ item.size }} modelos</span>
        </button>
      </div>
    </fieldset>

    <fieldset class="code-render__section">
      <legend>Modelos</legend>
      <div class="code-render__catalog-tools">
        <label>Buscar estilo
          <span class="code-render__search"><q-icon name="mdi-magnify" size="18px" /><input v-model="query" type="search" placeholder="Nome ou característica" :disabled="locked" /></span>
        </label>
        <label>Categoria<select v-model="category" :disabled="locked"><option value="">Todas as categorias</option><option v-for="group in categories" :key="group.id" :value="group.id">{{ group.label }}</option></select></label>
      </div>

      <div v-if="visibleModels.length" class="code-render__catalog">
        <button v-for="item in visibleModels" :key="item.id" class="code-render__model" type="button" :disabled="locked"
          :aria-pressed="item.id === selectedPresetId" @click="selectPreset(item)">
          <span class="code-render__thumb" :class="[...art(item), `font--${modelFont(item)}`]" :style="palette(item)" aria-hidden="true"><i /><b>{{ item.id === 'stat' ? '75%' : 'Aa' }}</b></span>
          <span class="code-render__model-text"><strong>{{ item.label }}</strong><small>{{ categoryNames[item.category] }}</small></span>
          <q-icon v-if="item.id === selectedPresetId" class="code-render__model-check" name="mdi-check-circle" size="19px" />
        </button>
      </div>
      <p v-else class="code-render__no-results">Nenhum modelo encontrado para esta busca.</p>

      <div class="code-render__catalog-foot">
        <span role="status">{{ matches.length === 1 ? '1 modelo' : `${matches.length} modelos` }}</span>
        <div v-if="pages > 1" class="code-render__pagination">
          <button type="button" class="code-render__icon" aria-label="Modelos anteriores" :disabled="locked || page === 1" @click="page--"><q-icon name="mdi-chevron-left" size="20px" /></button>
          <span>Página {{ page }} de {{ pages }}</span>
          <button type="button" class="code-render__icon" aria-label="Próximos modelos" :disabled="locked || page === pages" @click="page++"><q-icon name="mdi-chevron-right" size="20px" /></button>
        </div>
        <a v-if="engine === 'lemu'" :href="lemoCatalog.source.gallery" target="_blank" rel="noopener noreferrer">Lemo Opuscar, por {{ lemoCatalog.source.author }} <q-icon name="mdi-open-in-new" size="13px" /></a>
      </div>
    </fieldset>

    <fieldset class="code-render__section">
      <legend>Composição</legend>
      <div class="code-render__composition">
        <div class="code-render__artboard">
          <div class="code-render__artboard-heading"><strong>{{ selectedPreset.label }}</strong><span>{{ aspects[formatId] }}</span></div>
          <div class="code-render__preview" :class="[`format--${formatId}`, ...art(selectedPreset)]" :style="previewStyle">
            <div :key="previewKey" class="code-render__preview-copy" :class="[`align--${previewLayout}`, `font--${previewFont}`, `motion--${previewMotion}`, { 'is-playing': previewKey > 0 }]">
              <span v-if="eyebrow">{{ eyebrow }}</span><strong>{{ title || selectedPreset.title || selectedPreset.label }}</strong><small v-if="subtitle">{{ subtitle }}</small>
            </div>
          </div>
          <button type="button" class="code-render__secondary code-render__play" :disabled="previewMotion === 'none'" @click="previewKey++"><q-icon name="mdi-play-outline" size="19px" /> Simular entrada</button>
        </div>

        <div class="code-render__inputs">
          <div class="code-render__preset-details"><p>{{ selectedPreset.description }}</p><button class="code-render__link" type="button" :disabled="locked" @click="sample">Usar texto de exemplo</button></div>
          <label>Selo <input v-model="eyebrow" type="text" placeholder="Ex. Novidade" maxlength="36" :disabled="locked" /></label>
          <label>Título <input v-model="title" type="text" :placeholder="selectedPreset.title || selectedPreset.label" maxlength="100" required :disabled="locked" /></label>
          <label>Complemento <textarea v-model="subtitle" placeholder="Uma linha de contexto" rows="2" maxlength="200" :disabled="locked" /></label>
          <div class="code-render__settings">
            <label>Formato<select v-model="formatId" :disabled="locked"><option v-for="item in videoFormats" :key="item.id" :value="item.id">{{ item.title }} · {{ item.label }}</option></select></label>
            <label>Duração<select v-model="duration" :disabled="locked"><option v-for="seconds in 7" :key="seconds" :value="seconds + 1">{{ seconds + 1 }} s</option></select></label>
          </div>
        </div>
      </div>
    </fieldset>

    <details class="code-render__advanced">
      <summary><q-icon name="mdi-tune-variant" size="18px" /> Aparência e movimento <q-icon name="mdi-chevron-down" class="code-render__summary-arrow" size="18px" /></summary>
      <div class="code-render__advanced-fields">
        <label>Cor de destaque<input v-model="accent" type="color" :disabled="locked" /></label>
        <label>Cor de fundo<input v-model="background" type="color" :disabled="locked" /></label>
        <label>Tipografia<select v-model="font" :disabled="locked"><option v-for="item in fonts" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        <label>Alinhamento<select v-model="layout" :disabled="locked"><option v-for="item in alignment" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        <label>Entrada<select v-model="motion" :disabled="locked"><option v-for="item in movements" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        <label>Velocidade<select v-model="speed" :disabled="locked || previewMotion === 'none'"><option v-for="item in speeds" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        <label class="code-render__intensity"><span>Intensidade <output>{{ intensity }}%</output></span><input v-model.number="intensity" type="range" min="0" max="100" step="1" :disabled="locked || previewMotion === 'none'" /></label>
        <button class="code-render__link" type="button" :disabled="locked" @click="usePalette">Restaurar cores do modelo</button>
      </div>
    </details>

    <div class="code-render__actions">
      <button class="code-render__primary" type="submit" :disabled="!canRender">
        <q-spinner v-if="busy === 'code-render'" size="19px" /><q-icon v-else name="mdi-movie-open-play-outline" size="19px" />
        {{ busy === 'code-render' ? 'Renderizando cena…' : 'Renderizar cena' }}
      </button>
      <button class="code-render__secondary" type="button" :disabled="!canRender" @click="emit('downloadSource', scene())">
        <q-spinner v-if="busy === 'code-source'" size="18px" /><q-icon v-else name="mdi-file-code-outline" size="18px" />
        {{ busy === 'code-source' ? 'Preparando HTML…' : 'Baixar HTML' }}
      </button>
      <button v-if="canImprove" class="code-render__secondary" type="button" :disabled="!canRender" @click="emit('improve', scene())">
        <q-spinner v-if="busy === 'code-text'" size="18px" /><q-icon v-else name="mdi-creation-outline" size="18px" />
        {{ busy === 'code-text' ? 'Ajustando texto…' : 'Melhorar texto com IA' }}
        <q-tooltip>A revisão de texto segue a cobrança normal de IA.</q-tooltip>
      </button>
    </div>
  </form>
</template>

<style scoped>
.code-render { container-type: inline-size; display: grid; min-width: 0; gap: 20px; }
.code-render__header { display: flex; align-items: flex-start; gap: 12px; }
.code-render__header > .q-icon { margin-top: 1px; color: var(--aito-ai-accent); }
.code-render__header h2 { margin: 0; font-size: 1.22rem; line-height: 1.25; }
.code-render__header p { margin: 5px 0 0; color: var(--aito-ai-muted); }
.code-render fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.code-render legend { margin-bottom: 9px; font-weight: 720; }
.code-render__engines, .code-render__catalog-tools, .code-render__settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.code-render__engine { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 7px 10px; min-width: 0; padding: 13px; border: 1px solid var(--aito-ai-line); border-radius: 11px; background: var(--aito-ai-panel); color: var(--aito-ai-text); text-align: left; cursor: pointer; }
.code-render__engine--hyperframes { --engine-accent: #67e0d3; }
.code-render__engine--lemu { --engine-accent: #c3b2ff; }
.code-render__engine > .q-icon { grid-row: span 2; color: var(--engine-accent); }
.code-render__engine strong, .code-render__engine small { display: block; overflow-wrap: anywhere; }
.code-render__engine small { margin-top: 3px; color: var(--aito-ai-muted); }
.code-render__engine-count { justify-self: start; font-size: .74rem; font-weight: 700; color: var(--engine-accent); }
.code-render__engine:not(:disabled):hover, .code-render__engine[aria-pressed=true] { border-color: var(--engine-accent); background: linear-gradient(145deg, color-mix(in srgb, var(--engine-accent) 16%, transparent), transparent 85%), var(--aito-ai-panel); }
.code-render__catalog-tools { grid-template-columns: 1.2fr 1fr; margin-bottom: 10px; }
.code-render__search { position: relative; }
.code-render__search .q-icon { position: absolute; top: 50%; left: 10px; transform: translateY(-50%); pointer-events: none; }
.code-render__search input { padding-left: 34px !important; }
.code-render__catalog { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.code-render__model { position: relative; display: grid; min-width: 0; gap: 0; padding: 0; overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 9px; background: var(--aito-ai-panel); color: var(--aito-ai-text); text-align: left; cursor: pointer; }
.code-render__model:not(:disabled):hover, .code-render__model[aria-pressed=true] { border-color: var(--aito-ai-accent-strong); }
.code-render__thumb, .code-render__preview { position: relative; isolation: isolate; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle at 84% 23%, color-mix(in srgb, var(--model-accent) 31%, var(--model-background)), var(--model-background) 71%); }
.code-render__thumb { height: 65px; color: var(--model-text); }
.code-render__thumb::before, .code-render__preview::before { position: absolute; inset: 0; z-index: -1; background-image: var(--art-texture, none); background-size: var(--art-texture-size, 12px 12px); mask-image: linear-gradient(140deg, #000b, transparent 95%); content: ''; }
.texture--grid { --art-texture: linear-gradient(#ffffff3a 1px, transparent 1px), linear-gradient(90deg, #ffffff3a 1px, transparent 1px); }
.texture--dots { --art-texture: radial-gradient(#ffffffaa 1px, transparent 1px); --art-texture-size: 8px 8px; }
.texture--scanlines { --art-texture: repeating-linear-gradient(0deg, #ffffff50 0 1px, transparent 1px 3px); }
.texture--hatch { --art-texture: repeating-linear-gradient(135deg, transparent 0 5px, #ffffff55 5px 6px); }
.texture--grain { --art-texture: radial-gradient(#ffffff63 .65px, transparent 1.5px), radial-gradient(#0008 1px, transparent 1.5px); --art-texture-size: 5px 8px, 7px 5px; }
.code-render__thumb::after, .code-render__preview::after { position: absolute; z-index: -1; top: 12%; right: 5%; width: 34%; aspect-ratio: 1; border-radius: var(--art-radius, 50%); border: 1px solid color-mix(in srgb, var(--model-accent) 55%, transparent); background: color-mix(in srgb, var(--model-accent) 19%, transparent); transform: rotate(var(--art-angle, -22deg)); content: ''; }
.code-render__thumb b { margin-top: 6px; font: 800 1.65rem/1 system-ui, sans-serif; }
.code-render__thumb i { position: absolute; width: 17%; height: 2px; background: var(--model-accent); transform: translate(-5%, -13px); }
.motif--rings::after { box-shadow: 0 0 0 .55rem color-mix(in srgb, var(--model-accent) 12%, transparent), 0 0 0 1.05rem color-mix(in srgb, var(--model-accent) 7%, transparent); }
:is(.motif--tiles, .motif--paper, .motif--pixels) { --art-radius: 4%; --art-angle: 15deg; }
.motif--tiles::after { box-shadow: -.8rem .35rem 0 color-mix(in srgb, var(--model-accent) 15%, transparent); }
.motif--pixels::after { border-style: dashed; --art-angle: 0deg; }
.motif--orbit::after { aspect-ratio: 2; box-shadow: 0 .4rem 0 color-mix(in srgb, var(--model-accent) 24%, transparent); }
.motif--ink::after { border-radius: 62% 38% 29% 71% / 52% 64% 36% 48%; filter: blur(1px); }
.motif--wave::after { width: 70%; aspect-ratio: 3; top: 36%; right: -18%; }
.motif--wire::after { border-radius: 8%; --art-angle: 30deg; background: transparent; box-shadow: .5rem .5rem 0 color-mix(in srgb, var(--model-accent) 18%, transparent); }
.motif--route::after { width: 34%; aspect-ratio: 2; border-radius: 0 20px 0 20px; border-left: 0; border-bottom: 0; background: transparent; }
.motif--rays::after { background: conic-gradient(from 0deg, var(--model-accent), transparent, var(--model-accent)); opacity: .38; }
:is(.motif--horizon, .motif--bars)::after { width: 80%; top: 68%; right: -4%; aspect-ratio: 7; --art-radius: 0; --art-angle: 0deg; }
.code-render__thumb.font--serif b { font-family: Georgia, serif; }
.code-render__thumb.font--mono b { font-family: ui-monospace, monospace; }
.art-layout--left.code-render__thumb, .art--split.code-render__thumb { justify-items: start; padding-inline: 17%; }
.art-layout--bottom.code-render__thumb { align-items: end; padding-bottom: 8px; }
.code-render__model-text { display: grid; gap: 2px; min-height: 58px; padding: 7px 8px; }
.code-render__model-text strong { font-size: .8rem; line-height: 1.2; overflow-wrap: anywhere; }
.code-render__model-text small { font-size: .71rem; line-height: 1.2; color: var(--aito-ai-muted); overflow-wrap: anywhere; }
.code-render__model-check { position: absolute; top: 4px; right: 4px; color: #87fde9; filter: drop-shadow(0 1px 3px #000); }
.code-render__catalog-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; min-height: 34px; margin-top: 5px; color: var(--aito-ai-muted); font-size: .76rem; }
.code-render__catalog-foot a { color: var(--aito-ai-accent); }
.code-render__pagination { display: flex; align-items: center; gap: 2px; }
.code-render__icon { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--aito-ai-text); cursor: pointer; }
.code-render__icon:not(:disabled):hover { background: var(--aito-ai-accent-soft); }
.code-render__no-results { padding: 12px; border: 1px dashed var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); }
.code-render__composition { display: grid; grid-template-columns: 1fr; gap: 10px; }
.code-render__artboard { min-width: 0; display: grid; justify-items: center; align-content: start; gap: 8px; padding: 10px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-bg); }
.code-render__artboard-heading { display: flex; justify-content: space-between; gap: 6px; width: 100%; font-size: .8rem; }
.code-render__artboard-heading span { flex: none; color: var(--aito-ai-muted); }
.code-render__preview { width: 100%; max-height: 245px; aspect-ratio: 16 / 9; border-radius: 6px; color: var(--model-text); }
.code-render__preview.format--portrait { max-width: 135px; aspect-ratio: 9 / 16; }
.code-render__preview.format--square { max-width: 195px; aspect-ratio: 1; }
.code-render__preview-copy { display: grid; gap: 5px; width: 100%; padding: 11%; text-align: center; overflow-wrap: anywhere; font-family: system-ui, sans-serif; }
.code-render__preview-copy.align--left { text-align: left; }
.code-render__preview-copy.align--right { text-align: right; }
.code-render__preview-copy.align--bottom { align-self: end; text-align: left; }
.code-render__preview-copy.align--split { width: 76%; margin-right: auto; text-align: left; }
.code-render__preview-copy.font--serif { font-family: Georgia, serif; }
.code-render__preview-copy.font--mono { font-family: ui-monospace, monospace; }
.code-render__preview-copy strong { font-size: clamp(.9rem, 4cqi, 1.35rem); line-height: 1.1; }
.code-render__preview-copy small, .code-render__preview-copy > span { font-size: .65rem; line-height: 1.2; }
.code-render__preview-copy > span { color: color-mix(in srgb, var(--model-accent) 56%, var(--model-text)); font-weight: 730; }
.code-render__preview-copy.is-playing { animation: code-scene-entry var(--scene-time) ease-out both; }
.code-render__preview-copy.motion--rise { --entry-transform: translateY(var(--scene-travel)); }
.code-render__preview-copy.motion--slide { --entry-transform: translateX(calc(-1 * var(--scene-travel))); }
.code-render__preview-copy.motion--zoom { --entry-transform: scale(var(--scene-scale)); }
.code-render__preview-copy.motion--sweep.is-playing { animation-name: code-scene-reveal; }
.code-render__preview-copy.motion--pulse.is-playing { animation-name: code-scene-pulse; }
.code-render__preview-copy.motion--none { animation: none; }
@keyframes code-scene-entry { from { opacity: 0; transform: var(--entry-transform, none); } to { opacity: 1; transform: none; } }
@keyframes code-scene-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes code-scene-pulse { 0% { opacity: 0; transform: scale(var(--scene-scale)); } 73% { opacity: 1; transform: scale(1.035); } 100% { transform: none; } }
.code-render__inputs { display: grid; gap: 8px; align-content: start; }
.code-render__preset-details { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 4px 8px; color: var(--aito-ai-muted); font-size: .79rem; }
.code-render__preset-details p { margin: 0; }
.code-render__link { justify-self: start; padding: 0; border: 0; background: transparent; color: var(--aito-ai-accent); font: inherit; text-align: left; cursor: pointer; }
.code-render__link:hover:not(:disabled) { text-decoration: underline; }
.code-render__advanced { min-width: 0; border: 1px solid var(--aito-ai-line); border-radius: 9px; }
.code-render__advanced summary { display: flex; align-items: center; gap: 7px; padding: 10px 11px; color: var(--aito-ai-text); cursor: pointer; }
.code-render__advanced summary::-webkit-details-marker { display: none; }
.code-render__summary-arrow { margin-left: auto; }
.code-render__advanced[open] .code-render__summary-arrow { transform: rotate(180deg); }
.code-render__advanced-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 11px 11px; }
.code-render__intensity { grid-column: span 2; }
.code-render__intensity span { display: flex; justify-content: space-between; }
.code-render__intensity input { padding: 2px 0 !important; accent-color: var(--aito-ai-accent); }
.code-render__actions { display: flex; flex-wrap: wrap; gap: 7px; }
.code-render :is(.code-render__primary, .code-render__secondary) { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 6px 10px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font-weight: 640; cursor: pointer; }
.code-render .code-render__primary { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent); color: #061e26; font-weight: 750; }
.code-render .code-render__play { min-height: 32px; font-size: .78rem; }
.code-render button:disabled { opacity: .6; cursor: not-allowed; }
.code-render :is(button, input, select, textarea, summary, a):focus-visible { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
.code-render label { display: grid; min-width: 0; gap: 5px; color: var(--aito-ai-muted); font-size: .8rem; font-weight: 620; }
.code-render :is(input, textarea, select) { width: 100%; min-width: 0; min-height: 36px; padding: 6px 8px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-bg); font: inherit; }
.code-render textarea { resize: vertical; }
.code-render :is(input, textarea)::placeholder { color: var(--aito-ai-muted); opacity: .75; }
.code-render input[type=color] { padding: 3px; cursor: pointer; }
@container (min-width: 530px) { .code-render__composition { grid-template-columns: minmax(0, .85fr) minmax(0, 1fr); } }
@container (max-width: 450px) { .code-render__catalog { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (max-width: 360px) {
  .code-render__engine { grid-template-columns: 1fr; gap: 6px; padding: 9px; }
  .code-render__engine > .q-icon { grid-row: auto; }
  .code-render__advanced-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .code-render__preview-copy.is-playing { animation: none; } }
</style>
