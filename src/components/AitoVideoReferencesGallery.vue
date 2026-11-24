<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { api } from 'boot/axios'

const emit = defineEmits(['explore'])
const items = shallowRef([])
const loading = ref(false)
const error = ref('')
const preview = shallowRef(null)
const pageSize = 10
const visibleCount = ref(pageSize)
const visibleItems = computed(() => items.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < items.value.length)
const loadSentinel = ref(null)
let request
let observer
let disposed = false

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
async function load() {
  request?.abort()
  observer?.disconnect()
  visibleCount.value = pageSize
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
function observeNextPage() {
  observer?.disconnect()
  observer = null
  if (disposed || !hasMore.value || !loadSentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) revealNextPage()
  }, { rootMargin: '0px 0px 180px 0px', threshold: 0 })
  observer.observe(loadSentinel.value)
}
async function revealNextPage() {
  if (!hasMore.value || loading.value || disposed) return
  observer?.disconnect()
  visibleCount.value = Math.min(visibleCount.value + pageSize, items.value.length)
  await nextTick()
  observeNextPage()
}
watch([loadSentinel, hasMore], observeNextPage, { flush: 'post' })
onMounted(load)
onBeforeUnmount(() => { disposed = true; request?.abort(); observer?.disconnect() })
</script>

<template>
  <section class="aito-references" aria-label="Referências de vídeo">
    <header class="aito-references__header">
      <q-btn outline no-caps icon="mdi-movie-open-star-outline" label="Conheça os modelos" @click="emit('explore')" />
    </header>
    <div v-if="loading" class="aito-references__state" role="status"><q-spinner size="30px" /><span>Abrindo referências…</span></div>
    <div v-else-if="error" class="aito-references__state" role="alert"><span>{{ error }}</span><q-btn no-caps outline label="Tentar novamente" @click="load" /></div>
    <div v-else-if="!items.length" class="aito-references__state"><q-icon name="mdi-movie-open-outline" size="36px" /><p>Novas inspirações chegam por aqui em breve.</p><q-btn no-caps flat label="Explorar modelos de vídeo" @click="emit('explore')" /></div>
    <div v-else class="aito-references__grid">
      <article v-for="(item, index) in visibleItems" :key="item.id" class="aito-references__tile" :class="`aito-references__tile--${index % 3}`">
        <button type="button" class="aito-references__open" :aria-label="`Assistir ${item.title}`" @click="preview = item">
          <img v-if="safeUrl(item.thumbnail)" :src="safeUrl(item.thumbnail)" :alt="item.title" loading="lazy" @error="$event.target.style.opacity = '0'" />
          <span class="aito-references__film" aria-hidden="true"><q-icon name="mdi-movie-open-outline" size="44px" /></span>
          <span class="aito-references__play"><q-icon name="mdi-play" size="28px" /></span>
          <span class="aito-references__title">{{ item.title }}</span>
        </button>
      </article>
    </div>
    <div v-if="hasMore && !loading && !error" ref="loadSentinel" class="aito-references__load-more">
      <q-btn flat no-caps icon="mdi-chevron-down" label="Carregar mais referências" @click="revealNextPage" />
    </div>
    <span v-if="items.length && !loading" class="aito-references__count" role="status" aria-live="polite">{{ visibleItems.length }} de {{ items.length }} referências</span>
    <q-dialog :model-value="Boolean(preview)" maximized transition-show="fade" transition-hide="fade" @update:model-value="open => { if (!open) preview = null }">
      <q-card v-if="preview" class="aito-references__fullscreen aito-ai-theme">
        <header><h2>{{ preview.title }}</h2><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar referência" /></header>
        <div class="aito-references__player">
          <iframe v-if="preview.kind === 'youtube' && previewUrl" :src="previewUrl" :title="preview.title" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
          <video v-else-if="previewUrl" :src="previewUrl" controls autoplay playsinline :aria-label="preview.title" />
          <p v-else>Esta referência não está disponível para reprodução.</p>
        </div>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.aito-references { grid-column: 1 / -1; min-width: 0; }
.aito-references__header { display: flex; align-items: center; justify-content: flex-end; gap: 22px; padding: 0 0 16px; }
.aito-references__header > div { max-width: 670px; }
.aito-references__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--aito-ai-accent); font-size: .8rem; font-weight: 650; }
.aito-references h2 { margin: 6px 0 9px; font-size: clamp(1.4rem, 3vw, 2rem); line-height: 1.15; font-weight: 760; }
.aito-references p { margin: 0; color: var(--aito-ai-muted); line-height: 1.55; }
.aito-references__header > .q-btn { flex-shrink: 0; color: var(--aito-ai-accent); border-radius: 12px; }
.aito-references__grid { columns: 4; column-gap: 14px; }
.aito-references__tile { position: relative; overflow: hidden; break-inside: avoid; margin-bottom: 14px; border: 1px solid var(--aito-ai-line); border-radius: 18px; background: linear-gradient(145deg, var(--aito-ai-raised), var(--aito-ai-surface)); transform: translateZ(0); animation: reference-reveal .35s ease-out both; }
.aito-references__open { position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; border: 0; background: none; color: white; text-align: left; cursor: pointer; }
.aito-references__tile--1 .aito-references__open { aspect-ratio: 9 / 16; }
.aito-references__tile--2 .aito-references__open { aspect-ratio: 1; }
.aito-references__open::after { content: ''; position: absolute; inset: 25% 0 0; background: linear-gradient(transparent, #080808f5); }
.aito-references__open img { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .35s; }
.aito-references__open:hover img { transform: scale(1.045); }
.aito-references__open::after { z-index: 2; }
.aito-references__film { position: absolute; inset: 0; display: grid; place-items: center; color: var(--aito-ai-muted); opacity: .4; }
.aito-references__play { z-index: 3; position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid #ffffff45; border-radius: 50%; background: #1515158c; backdrop-filter: blur(8px); }
.aito-references__title { z-index: 3; position: absolute; bottom: 16px; left: 16px; right: 16px; font-weight: 700; line-height: 1.35; }
.aito-references__load-more { display: flex; justify-content: center; padding: 8px 0; color: var(--aito-ai-accent); }
.aito-references__count { display: block; padding-top: 8px; color: var(--aito-ai-muted); text-align: center; font-size: .75rem; }
.aito-references__state { display: flex; min-height: 220px; padding: 30px; align-items: center; justify-content: center; flex-direction: column; gap: 14px; border: 1px dashed var(--aito-ai-line); border-radius: 18px; color: var(--aito-ai-muted); text-align: center; }
.aito-references__fullscreen { display: flex; flex-direction: column; background: var(--aito-ai-bg); color: var(--aito-ai-text); }
.aito-references__fullscreen header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px clamp(14px, 3vw, 32px); }
.aito-references__fullscreen h2 { margin: 0; font-size: 1rem; }
.aito-references__player { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #000; }
.aito-references__player video, .aito-references__player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; object-fit: contain; }
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
@media (max-width: 700px) { .aito-references__grid { columns: 2; column-gap: 10px; } .aito-references__tile { margin-bottom: 10px; border-radius: 13px; } .aito-references__header { flex-direction: column; align-items: start; gap: 15px; } .aito-references__model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .aito-references__title { font-size: .87rem; left: 12px; right: 12px; } }
@media (max-width: 450px) { .aito-references__models { padding: 15px; } .aito-references__model-grid { grid-template-columns: 1fr; } .aito-references__models h2 { font-size: 1.15rem; } .aito-references__play { width: 34px; height: 34px; top: 10px; right: 10px; } }
@keyframes reference-reveal { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .aito-references__open img { transition: none; } .aito-references__tile { animation: none; } }
</style>
