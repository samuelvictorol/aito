<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { api } from 'boot/axios'
import { videoCatalog, videoModelPreview, videoModelSpecialty } from 'src/data/aitoiaVideoCatalog'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'

const props = defineProps({ models: { type: Array, default: () => [] }, importing: { type: String, default: '' }, disabled: Boolean })
const emit = defineEmits(['recreate'])
const { isDark } = useAitoIATheme()
const items = shallowRef([])
const loading = ref(false)
const error = ref('')
const preview = shallowRef(null)
const modelsOpen = ref(false)
const modelQuery = ref('')
let request

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try { const url = new URL(value, window.location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
function youtubeEmbed(item) {
  if (item?.kind !== 'youtube') return ''
  try {
    const url = new URL(item.url)
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) return ''
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1)
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : ''
  } catch { return '' }
}
const previewUrl = computed(() => preview.value?.kind === 'youtube' ? youtubeEmbed(preview.value) : safeUrl(preview.value?.url))
const catalog = computed(() => {
  const available = props.models.length ? props.models : videoCatalog.filter(item => item.type !== 'image')
  const seen = new Set()
  return available.filter(item => {
    const key = `${item.id}:${item.mode || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(item => {
    const family = videoCatalog.find(family => family.id === item.familyId || family.id === item.id)
    const duration = item.sourceSecondsMax ? `Vídeo-base até ${item.sourceSecondsMax} s` : ''
    return { ...item, name: item.name || item.label?.replace(/ · Higgsfield$/, '') || item.id,
      maker: item.maker || family?.maker || 'Higgsfield',
      summary: videoModelSpecialty(item) || item.summary || family?.summary || 'Criação de cenas a partir das suas instruções e referências.',
      preview: videoModelPreview(item),
      tags: [item.mode === 'transition' ? 'Transições' : item.mode === 'continuation' ? 'Continuidade' :
        item.requiresVideo || item.mode?.includes('genjutsu') ? 'Transformar vídeos' : item.mode === 'reference' ? 'Referências visuais' : 'Criação de cenas',
      item.audioReference || item.nativeAudio ? 'Áudio e imagem' : '', duration].filter(Boolean) }
  })
})
const filteredModels = computed(() => {
  const query = String(modelQuery.value || '').trim().toLocaleLowerCase('pt-BR')
  return catalog.value.filter(item => !query || `${item.name} ${item.maker} ${item.summary} ${item.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query))
})
async function load() {
  request?.abort()
  const current = new AbortController()
  request = current
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/aitoia/video/references-gallery', { signal: current.signal })
    if (!current.signal.aborted) items.value = (data?.data?.items || data?.items || []).filter(item => item?.id && safeUrl(item.url))
  } catch (cause) {
    if (!current.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível abrir as referências. Tente novamente.'
  } finally { if (request === current) loading.value = false }
}
function recreate(item) {
  if (props.disabled || props.importing) return
  preview.value = null
  emit('recreate', item)
}
onMounted(load)
onBeforeUnmount(() => request?.abort())
</script>

<template>
  <section class="aito-references" aria-labelledby="video-references-heading">
    <header class="aito-references__header">
      <div><span class="aito-references__eyebrow"><q-icon name="mdi-sparkles" /> Uma ideia para o seu próximo vídeo</span>
        <h2 id="video-references-heading">Veja. Inspire-se. Recrie.</h2>
        <p>Abra uma referência e leve o vídeo para Refazer vídeos. Você escolhe os cortes, personagens e a nova direção.</p>
      </div>
      <q-btn outline no-caps icon="mdi-movie-open-star-outline" label="Conheça os modelos" @click="modelsOpen = true" />
    </header>
    <div v-if="loading" class="aito-references__state" role="status"><q-spinner size="30px" /><span>Abrindo referências…</span></div>
    <div v-else-if="error" class="aito-references__state" role="alert"><span>{{ error }}</span><q-btn no-caps outline label="Tentar novamente" @click="load" /></div>
    <div v-else-if="!items.length" class="aito-references__state"><q-icon name="mdi-movie-open-outline" size="36px" /><p>Novas inspirações chegam por aqui em breve.</p><q-btn no-caps flat label="Explorar modelos de vídeo" @click="modelsOpen = true" /></div>
    <div v-else class="aito-references__grid">
      <article v-for="(item, index) in items" :key="item.id" class="aito-references__tile" :class="`aito-references__tile--${index % 3}`">
        <button type="button" class="aito-references__open" :aria-label="`Assistir ${item.title}`" @click="preview = item">
          <img v-if="safeUrl(item.thumbnail)" :src="safeUrl(item.thumbnail)" :alt="item.title" loading="lazy" @error="$event.target.style.opacity = '0'" />
          <span class="aito-references__film" aria-hidden="true"><q-icon name="mdi-movie-open-outline" size="44px" /></span>
          <span class="aito-references__play"><q-icon name="mdi-play" size="28px" /></span>
          <span class="aito-references__title">{{ item.title }}</span>
        </button>
        <q-btn no-caps unelevated class="aito-references__recreate" icon="mdi-movie-open-edit-outline" label="Recriar"
          :loading="importing === String(item.id)" :disable="disabled || Boolean(importing)" @click="recreate(item)" />
      </article>
    </div>
    <q-dialog :model-value="Boolean(preview)" maximized transition-show="fade" transition-hide="fade" @update:model-value="open => { if (!open) preview = null }">
      <q-card v-if="preview" class="aito-references__fullscreen aito-ai-theme">
        <header><h2>{{ preview.title }}</h2><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar referência" /></header>
        <div class="aito-references__player">
          <iframe v-if="preview.kind === 'youtube' && previewUrl" :src="previewUrl" :title="preview.title" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
          <video v-else-if="previewUrl" :src="previewUrl" controls autoplay playsinline :aria-label="preview.title" />
          <p v-else>Esta referência não está disponível para reprodução.</p>
        </div>
        <footer><span>Uma nova versão começa com a sua direção.</span><q-btn no-caps unelevated class="aito-references__recreate" icon="mdi-movie-open-edit-outline" label="Recriar este vídeo" :disable="disabled || Boolean(importing)" @click="recreate(preview)" /></footer>
      </q-card>
    </q-dialog>
    <q-dialog v-model="modelsOpen">
      <q-card class="aito-references__models aito-ai-theme">
        <header><div><span class="aito-references__eyebrow">Escolha com mais clareza</span><h2>Um modelo para cada ideia</h2><p>Conheça as especialidades. A escolha do modelo acontece na ferramenta de criação.</p></div><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar modelos" /></header>
        <q-input v-model="modelQuery" outlined dense :dark="isDark" placeholder="Buscar modelo, especialidade ou tipo de vídeo" aria-label="Buscar modelos de vídeo" clearable><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
        <div class="aito-references__model-grid">
          <article v-for="model in filteredModels" :key="`${model.id}:${model.mode || ''}`" class="aito-references__model">
            <img v-if="model.preview" :src="model.preview.cover" alt="" loading="lazy" @error="$event.target.style.display = 'none'" />
            <div><small>{{ model.maker }}</small><h3>{{ model.name }}</h3><p>{{ model.summary }}</p><ul><li v-for="tag in model.tags" :key="tag">{{ tag }}</li></ul></div>
          </article>
          <p v-if="!filteredModels.length" role="status">Nenhum modelo corresponde à busca.</p>
        </div>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.aito-references { grid-column: 1 / -1; min-width: 0; }
.aito-references__header { display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 10px 0 24px; }
.aito-references__header > div { max-width: 670px; }
.aito-references__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--aito-ai-accent); font-size: .8rem; font-weight: 650; }
.aito-references h2 { margin: 6px 0 9px; font-size: clamp(1.4rem, 3vw, 2rem); line-height: 1.15; font-weight: 760; }
.aito-references p { margin: 0; color: var(--aito-ai-muted); line-height: 1.55; }
.aito-references__header > .q-btn { flex-shrink: 0; color: var(--aito-ai-accent); border-radius: 12px; }
.aito-references__grid { columns: 4; column-gap: 14px; }
.aito-references__tile { position: relative; overflow: hidden; break-inside: avoid; margin-bottom: 14px; border: 1px solid var(--aito-ai-line); border-radius: 18px; background: linear-gradient(145deg, #1d645f, #1b2239); transform: translateZ(0); }
.aito-references__open { position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; border: 0; background: none; color: white; text-align: left; cursor: pointer; }
.aito-references__tile--1 .aito-references__open { aspect-ratio: 9 / 16; }
.aito-references__tile--2 .aito-references__open { aspect-ratio: 1; }
.aito-references__open::after { content: ''; position: absolute; inset: 25% 0 0; background: linear-gradient(transparent, #001312f5); }
.aito-references__open img { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .35s; }
.aito-references__open:hover img { transform: scale(1.045); }
.aito-references__open::after { z-index: 2; }
.aito-references__film { position: absolute; inset: 0; display: grid; place-items: center; color: #9edcd45c; }
.aito-references__play { z-index: 3; position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid #ffffff45; border-radius: 50%; background: #0924258c; backdrop-filter: blur(8px); }
.aito-references__title { z-index: 3; position: absolute; bottom: 66px; left: 16px; right: 16px; font-weight: 700; line-height: 1.35; }
.aito-references__tile > .aito-references__recreate { position: absolute; z-index: 4; bottom: 12px; left: 12px; right: 12px; }
.aito-references__recreate { color: #04382f; background: linear-gradient(115deg, #ceffe7, #6fe2c5); border-radius: 10px; font-weight: 700; min-height: 40px; }
.aito-references__state { display: flex; min-height: 220px; padding: 30px; align-items: center; justify-content: center; flex-direction: column; gap: 14px; border: 1px dashed var(--aito-ai-line); border-radius: 18px; color: var(--aito-ai-muted); text-align: center; }
.aito-references__fullscreen { display: flex; flex-direction: column; background: #040e12; color: #f0fffb; }
.aito-references__fullscreen header, .aito-references__fullscreen footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px clamp(14px, 3vw, 32px); }
.aito-references__fullscreen h2 { margin: 0; font-size: 1rem; }
.aito-references__player { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #000; }
.aito-references__player video, .aito-references__player iframe { width: 100%; height: 100%; max-height: calc(100dvh - 155px); border: none; object-fit: contain; }
.aito-references__player iframe { min-height: 65dvh; }
.aito-references__fullscreen footer span { color: #aec9c4; }
.aito-references__models { width: min(1100px, 94vw); max-width: 1100px; max-height: 90dvh; display: flex; flex-direction: column; gap: 16px; padding: 22px; background: var(--aito-ai-surface); color: var(--aito-ai-text); border: 1px solid var(--aito-ai-line); border-radius: 18px; }
.aito-references__models > header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.aito-references__models h2 { font-size: 1.4rem; margin: 5px 0 8px; }
.aito-references__models p { color: var(--aito-ai-muted); margin: 0; }
.aito-references__model-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; min-height: 0; overflow-y: auto; padding-right: 3px; }
.aito-references__model { overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 13px; background: var(--aito-ai-panel); }
.aito-references__model > img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.aito-references__model > div { padding: 14px; }
.aito-references__model small { color: var(--aito-ai-accent); }
.aito-references__model h3 { margin: 5px 0 8px; font-size: 1rem; line-height: 1.3; font-weight: 700; }
.aito-references__model p { font-size: .88rem; line-height: 1.45; }
.aito-references__model ul { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 12px 0 0; }
.aito-references__model li { border-radius: 6px; background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); padding: 4px 6px; font-size: .72rem; }
@media (max-width: 1200px) { .aito-references__grid { columns: 3; } }
@media (max-width: 700px) { .aito-references__grid { columns: 2; column-gap: 10px; } .aito-references__tile { margin-bottom: 10px; border-radius: 13px; } .aito-references__header { flex-direction: column; align-items: start; gap: 15px; } .aito-references__model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .aito-references__title { font-size: .87rem; left: 12px; right: 12px; } .aito-references__fullscreen footer { flex-direction: column; } .aito-references__fullscreen footer > .q-btn { width: 100%; } }
@media (max-width: 450px) { .aito-references__models { padding: 15px; } .aito-references__model-grid { grid-template-columns: 1fr; } .aito-references__models h2 { font-size: 1.15rem; } .aito-references__play { width: 34px; height: 34px; top: 10px; right: 10px; } .aito-references__recreate { font-size: .8rem; } }
@media (prefers-reduced-motion: reduce) { .aito-references__open img { transition: none; } }
</style>
