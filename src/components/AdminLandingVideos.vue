<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import { landingVideoDefaults, landingVideoPages } from 'src/data/landingVideoSlots'
import { youtubeEmbedUrl, youtubeVideoId } from 'src/services/landingVideoSources'

const $q = useQuasar()
const revision = ref(0)
const baseline = ref({})
const draft = ref({})
const loading = ref(true)
const saving = ref(false)
const loaded = ref(false)
const error = ref('')
const preview = ref(null)
const inherited = ref({})
const controller = new AbortController()
const slots = landingVideoPages.flatMap(page => page.slots)
const modes = [
  { label: 'Usar padrão da página', value: 'default' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Mostrar capa sem vídeo', value: 'hidden' },
]
const options = () => ({ ...financeHeaders(true), signal: controller.signal, timeout: 12000 })

function apply({ videos, revision: nextRevision }) {
  revision.value = nextRevision
  baseline.value = videos
  draft.value = Object.fromEntries(slots.map(({ id }) => [id, { mode: !Object.hasOwn(videos, id) ? 'default' :
    videos[id] === null ? 'hidden' : 'youtube', url: videos[id] || '' }]))
}
const updates = computed(() => Object.fromEntries(slots.flatMap(({ id }) => {
  const row = draft.value[id]
  if (!row || row.mode === 'default') return []
  return [[id, row.mode === 'hidden' ? null : row.url.trim()]]
})))
const dirty = computed(() => slots.some(({ id }) => baseline.value[id] !== updates.value[id]))
const valid = computed(() => Object.values(updates.value).every(value => value === null || youtubeVideoId(value)))
const defaultSource = id => inherited.value[id] || landingVideoDefaults[id] || ''
const previewSource = id => youtubeEmbedUrl(draft.value[id]?.mode === 'default' ? defaultSource(id) : draft.value[id]?.url)

async function loadCatalogSources() {
  if (import.meta.env.VITE_AITOLEARN_VIDEO_URL) inherited.value['aitolearn-preview'] = import.meta.env.VITE_AITOLEARN_VIDEO_URL
  try {
    const { data } = await api.get('/products/aitonotify/catalog', { ...options(), headers: {}, withCredentials: false })
    for (const [type, id] of [['desktop', 'desktop-presentation'], ['cloud', 'whitelabel-presentation']]) {
      inherited.value[id] = data?.data?.products?.[type]?.media?.heroVideo
    }
  } catch { /* Compiled fallbacks remain available if the catalog is offline. */ }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/landing-videos', options())
    apply(data.data)
    loaded.value = true
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar os vídeos.'
  } finally { loading.value = false }
}
async function save() {
  if (saving.value || loading.value || !dirty.value || !valid.value) return
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.put('/admin/landing-videos', { revision: revision.value, videos: updates.value }, options())
    apply(data.data)
    $q.notify({ type: 'positive', message: 'Vídeos do site atualizados.' })
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.status === 409
      ? 'Os vídeos foram alterados em outra sessão. Recarregue e aplique suas mudanças novamente.'
      : cause.response?.data?.message || 'Não foi possível salvar os vídeos.'
  } finally { saving.value = false }
}
function reload() {
  if (!dirty.value) return load()
  $q.dialog({ title: 'Recarregar vídeos?', message: 'As alterações em edição serão descartadas.', cancel: true }).onOk(load)
}
onMounted(load)
onMounted(loadCatalogSources)
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <section class="site-videos" aria-labelledby="site-videos-title">
    <header class="site-videos__header">
      <div><h2 id="site-videos-title">Vídeos das landing pages</h2><p>Escolha o vídeo de cada monitor. Cole o link do YouTube para gerar a incorporação automaticamente.</p></div>
      <q-btn flat round icon="mdi-refresh" aria-label="Recarregar vídeos" :loading="loading" :disable="saving" @click="reload" />
    </header>
    <q-banner v-if="error" rounded class="site-videos__error" role="alert">{{ error }}</q-banner>
    <q-form v-if="loaded" class="site-videos__form" @submit.prevent="save">
      <q-card v-for="page in landingVideoPages" :key="page.path" flat bordered dark class="site-videos__page">
        <q-card-section class="site-videos__page-head"><h3>{{ page.title }}</h3><small>{{ page.path }}</small></q-card-section>
        <q-card-section v-for="slot in page.slots" :key="slot.id" class="site-videos__slot">
          <div class="site-videos__slot-head">
            <h4><q-icon name="mdi-monitor" size="20px" /> {{ slot.section }}</h4>
            <a :href="page.path + '#' + slot.anchor" target="_blank" rel="noopener">Abrir seção <q-icon name="mdi-arrow-top-right" /></a>
          </div>
          <div class="site-videos__fields">
            <q-select v-model="draft[slot.id].mode" dark outlined dense emit-value map-options :options="modes" label="Exibição" :disable="saving || loading" />
            <template v-if="draft[slot.id].mode === 'youtube'">
              <q-input v-model.trim="draft[slot.id].url" dark outlined dense maxlength="2048" label="Link do YouTube" :aria-label="'Link do YouTube · ' + slot.section"
                inputmode="url" lazy-rules :rules="[value => Boolean(youtubeVideoId(value)) || 'Cole um link de vídeo válido do YouTube.']" :disable="saving || loading" />
            </template>
            <small v-else-if="draft[slot.id].mode === 'default'" class="site-videos__source">
              {{ defaultSource(slot.id) || 'Capa sem vídeo' }}
            </small>
            <q-btn v-if="draft[slot.id].mode === 'youtube' || previewSource(slot.id)" flat no-caps icon="mdi-play-box-outline" label="Prévia" :aria-label="'Prévia · ' + slot.section" :disable="!previewSource(slot.id)"
              @click="preview = { title: slot.section, src: previewSource(slot.id) }" />
          </div>
        </q-card-section>
      </q-card>
      <div class="site-videos__actions">
        <q-btn unelevated no-caps type="submit" color="teal-8" icon="mdi-content-save-outline" label="Salvar vídeos"
          :loading="saving" :disable="loading || !dirty || !valid" />
      </div>
    </q-form>
    <q-linear-progress v-else-if="loading" indeterminate color="teal-4" aria-label="Carregando vídeos" />
    <q-dialog :model-value="Boolean(preview)" @update:model-value="!$event && (preview = null)">
      <q-card v-if="preview" dark class="site-videos__preview">
        <q-card-section class="site-videos__slot-head"><h3>{{ preview.title }}</h3><q-btn flat round dense icon="mdi-close" aria-label="Fechar prévia" @click="preview = null" /></q-card-section>
        <iframe :src="preview.src" :title="preview.title" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.site-videos { display: grid; gap: 1rem; }
.site-videos__header,.site-videos__slot-head { display: flex; justify-content: space-between; align-items: center; gap: .75rem; }
.site-videos h2,.site-videos h3,.site-videos h4,.site-videos__preview h3 { margin: 0; font-weight: 700; line-height: 1.3; }
.site-videos h2 { font-size: clamp(1.35rem, 4vw, 2rem); }
.site-videos h3,.site-videos__preview h3 { font-size: 1.05rem; }
.site-videos h4 { font-size: .9rem; }
.site-videos__header p { margin: .45rem 0 0; color: #bfd5d0; }
.site-videos__form { display: grid; gap: .85rem; }
.site-videos__page { overflow: hidden; border-color: #315653; border-radius: .85rem; background: #0c2325; }
.site-videos__page-head { display: flex; align-items: center; flex-wrap: wrap; gap: .55rem; background: #163336; }
.site-videos__page-head small { color: #b8d3ca; overflow-wrap: anywhere; }
.site-videos__slot { display: grid; gap: .65rem; border-top: 1px solid #315653; }
.site-videos__slot a { color: #94efdc; text-decoration: none; white-space: nowrap; font-size: .77rem; }
.site-videos__source { align-self: center; color: #b8d3ca; overflow-wrap: anywhere; }
.site-videos__fields { display: grid; grid-template-columns: minmax(11rem, .75fr) minmax(0, 1.3fr) auto; align-items: start; gap: .6rem; }
.site-videos__actions { display: flex; justify-content: flex-end; }
.site-videos__error { color: #ffdadd; background: #50212c; }
.site-videos__preview { width: min(42rem, 94vw); max-width: 94vw; }
.site-videos__preview iframe { display: block; width: 100%; aspect-ratio: 16 / 9; min-height: 200px; border: none; }
@media (max-width: 720px) { .site-videos__fields { grid-template-columns: minmax(0, 1fr); } .site-videos__fields .q-btn { justify-self: start; } }
</style>
