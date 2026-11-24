<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import { youtubeVideoId } from 'src/services/landingVideoSources'

const $q = useQuasar()
const rows = ref([])
const revision = ref(0)
const baseline = ref('')
const title = ref('')
const url = ref('')
const file = ref(null)
const busy = ref(false)
const ready = ref(false)
const progress = ref(0)
const preview = ref(null)
const controller = new AbortController()
const dirty = computed(() => baseline.value !== JSON.stringify(rows.value))
const valid = computed(() => rows.value.every(item => item.title?.trim() && item.title.length <= 140))
const options = () => ({ ...financeHeaders(true), signal: controller.signal, timeout: 30000 })
const notify = (message, type = 'negative') => $q.notify({ type, message, position: 'top' })
const source = item => item.kind === 'youtube'
  ? `https://www.youtube-nocookie.com/embed/${youtubeVideoId(item.url)}?rel=0` : item.url

function apply(data) {
  rows.value = data.items || []
  revision.value = data.revision
  baseline.value = JSON.stringify(rows.value)
  ready.value = true
}
async function load() {
  busy.value = true
  try { const { data } = await api.get('/admin/video-references', options()); apply(data.data) }
  catch (error) { if (!controller.signal.aborted) notify(error.response?.data?.message || 'Não foi possível carregar as referências.') }
  finally { busy.value = false }
}
async function persist(items = rows.value) {
  const { data } = await api.put('/admin/video-references', { revision: revision.value, items }, options())
  apply(data.data)
}
async function save() {
  if (!valid.value || busy.value) return
  busy.value = true
  try { await persist(); notify('Galeria de referências atualizada.', 'positive') }
  catch (error) { notify(error.response?.data?.message || 'Não foi possível salvar as referências.') }
  finally { busy.value = false }
}
async function addLink() {
  const id = youtubeVideoId(url.value)
  if (!id || !title.value.trim() || busy.value) return
  if (rows.value.some(item => youtubeVideoId(item.url) === id)) return notify('Este vídeo já está na galeria.', 'warning')
  busy.value = true
  try {
    await persist([...rows.value, { id: crypto.randomUUID(), kind: 'youtube', title: title.value.trim(), url: `https://www.youtube.com/watch?v=${id}` }])
    title.value = ''; url.value = ''
    notify('Referência adicionada.', 'positive')
  } catch (error) { notify(error.response?.data?.message || 'Não foi possível adicionar o vídeo.') }
  finally { busy.value = false }
}
async function upload() {
  const selected = file.value
  if (!selected || busy.value) return
  if (selected.size > 60 * 1024 * 1024) return notify('O vídeo deve ter no máximo 60 MB.')
  if (!['video/mp4', 'video/webm'].includes(selected.type)) return notify('Escolha um vídeo MP4 ou WebM.')
  busy.value = true; progress.value = 0
  try {
    // Keep order/title edits before the upload uses the current gallery revision.
    if (dirty.value) await persist()
    const { data } = await api.post('/admin/video-references/upload', selected, { ...options(), timeout: 180000,
      params: { title: title.value.trim() || selected.name.replace(/\.[^.]+$/, '').slice(0, 140), revision: revision.value },
      headers: { ...options().headers, 'Content-Type': selected.type },
      onUploadProgress: event => { progress.value = event.total ? event.loaded / event.total : 0 },
    })
    apply(data.data); file.value = null; title.value = ''
    notify('Vídeo enviado e publicado nas referências.', 'positive')
  } catch (error) { if (!controller.signal.aborted) notify(error.response?.data?.message || 'Não foi possível enviar o vídeo. Tente novamente.') }
  finally { busy.value = false }
}
function move(index, direction) {
  const destination = index + direction
  if (destination < 0 || destination >= rows.value.length) return
  const copy = [...rows.value]; [copy[index], copy[destination]] = [copy[destination], copy[index]]; rows.value = copy
}
function remove(index) {
  $q.dialog({ title: 'Remover referência?', message: 'Ela deixará de aparecer na galeria quando você salvar.', cancel: true, ok: 'Remover' })
    .onOk(() => rows.value.splice(index, 1))
}
function reload() {
  if (!dirty.value) return load()
  $q.dialog({ title: 'Recarregar galeria?', message: 'As alterações em edição serão descartadas.', cancel: true }).onOk(load)
}
onMounted(load)
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <section id="video-references" class="admin-references" aria-labelledby="admin-references-title">
    <header><div><span>ESTÚDIO DE VÍDEO</span><h2 id="admin-references-title">Galeria de referências</h2><p>Escolha quais vídeos os clientes podem assistir na galeria e em que ordem aparecem.</p></div>
      <q-btn flat round icon="mdi-refresh" aria-label="Recarregar referências" :loading="busy" @click="reload" />
    </header>
    <q-card flat bordered dark class="admin-references__add">
      <h3>Adicionar um vídeo</h3>
      <q-input v-model="title" dark outlined dense label="Título da referência" maxlength="140" :disable="busy" />
      <div class="admin-references__input-row"><q-input v-model.trim="url" dark outlined dense label="Link do YouTube" maxlength="2048" :disable="busy || !ready" />
        <q-btn no-caps unelevated color="teal-7" icon="mdi-link-plus" label="Adicionar link" :disable="!ready || !youtubeVideoId(url) || !title.trim() || busy" @click="addLink" />
      </div>
      <div class="admin-references__divider">ou envie o arquivo</div>
      <div class="admin-references__input-row"><q-file v-model="file" dark outlined dense label="Vídeo MP4 ou WebM · até 60 MB" accept="video/mp4,video/webm" :max-file-size="60 * 1024 * 1024" :disable="busy || !ready" clearable @rejected="notify('Escolha um vídeo de até 60 MB.')"><template #prepend><q-icon name="mdi-file-video-outline" /></template></q-file>
        <q-btn no-caps outline icon="mdi-cloud-upload-outline" label="Enviar vídeo" :disable="!file || !ready || busy || !valid" @click="upload" />
      </div>
      <q-linear-progress v-if="busy" :value="progress" :indeterminate="!progress" color="teal-3" />
    </q-card>
    <div class="admin-references__grid">
      <q-card v-for="(item, index) in rows" :key="item.id" flat bordered dark class="admin-references__item">
        <button class="admin-references__preview" type="button" :aria-label="`Assistir ${item.title}`" @click="preview = item">
          <img v-if="item.thumbnail" :src="item.thumbnail" alt="" loading="lazy" />
          <video v-else :src="item.url" preload="metadata" muted playsinline />
          <q-icon name="mdi-play-circle" size="42px" /><span>{{ item.kind === 'youtube' ? 'YouTube' : 'Arquivo' }}</span>
        </button>
        <div class="admin-references__edit"><q-input v-model="item.title" dark outlined dense label="Título" maxlength="140" :disable="busy" />
          <div class="admin-references__item-actions"><q-btn flat round dense icon="mdi-arrow-up" aria-label="Mover para cima" :disable="index === 0 || busy" @click="move(index, -1)" /><q-btn flat round dense icon="mdi-arrow-down" aria-label="Mover para baixo" :disable="index === rows.length - 1 || busy" @click="move(index, 1)" /><q-space /><q-btn flat round dense color="red-3" icon="mdi-trash-can-outline" aria-label="Remover referência" :disable="busy" @click="remove(index)" /></div>
        </div>
      </q-card>
    </div>
    <footer><span>{{ rows.length }} referência{{ rows.length === 1 ? '' : 's' }} · a ordem aparece no Estúdio</span><q-btn no-caps unelevated color="teal-7" icon="mdi-content-save-outline" label="Salvar galeria" :disable="!dirty || !valid || busy || !ready" :loading="busy" @click="save" /></footer>
    <q-dialog :model-value="Boolean(preview)" @update:model-value="!$event && (preview = null)"><q-card v-if="preview" dark class="admin-references__modal"><header><h3>{{ preview.title }}</h3><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar prévia" /></header><iframe v-if="preview.kind === 'youtube'" :src="source(preview)" :title="preview.title" allow="fullscreen; picture-in-picture" allowfullscreen /><video v-else :src="preview.url" controls playsinline /></q-card></q-dialog>
  </section>
</template>

<style scoped>
.admin-references { display: grid; gap: 20px; padding-top: 30px; margin-top: 30px; border-top: 1px solid #315653; }
.admin-references header,.admin-references footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.admin-references h2 { margin: 4px 0 8px; font-size: clamp(22px, 4vw, 31px); font-weight: 700; line-height: 1.2; }
.admin-references h3,.admin-references__modal h3 { margin: 0; font-size: 18px; font-weight: 650; }
.admin-references header span { font-size: 11px; font-weight: 750; letter-spacing: 1.5px; color: #8de6cd; }
.admin-references p,.admin-references footer span { margin: 0; color: #c2d8d1; }
.admin-references__add { display: grid; gap: 14px; padding: 22px; border-radius: 18px; background: linear-gradient(125deg, #133f3f, #12282e); border-color: #315653; }
.admin-references__input-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; }
.admin-references__divider { text-align: center; color: #b9d6ce; font-size: 12px; }
.admin-references__grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(210px,1fr)); gap: 16px; }
.admin-references__item { overflow: hidden; border-radius: 16px; border-color: #315653; background: #0c2325; }
.admin-references__preview { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 16/10; overflow: hidden; background: #102f33; border: 0; color: white; cursor: pointer; }
.admin-references__preview img,.admin-references__preview video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .75; }
.admin-references__preview .q-icon { z-index: 1; filter: drop-shadow(0 2px 6px #0009); }
.admin-references__preview span { position: absolute; bottom: 9px; left: 10px; padding: 2px 8px; border-radius: 10px; background: #041a25c9; font-size: 11px; }
.admin-references__edit { padding: 14px; }
.admin-references__item-actions { display: flex; gap: 5px; padding-top: 10px; }
.admin-references__modal { width: min(900px,94vw); max-width: 94vw; }
.admin-references__modal header { display: flex; align-items: center; justify-content: space-between; padding: 16px; }
.admin-references__modal iframe,.admin-references__modal video { display: block; width: 100%; max-height: 80vh; aspect-ratio: 16/9; border: 0; background: #000; }
@media(max-width:600px) { .admin-references__input-row { grid-template-columns: 1fr; } .admin-references footer { align-items: flex-start; flex-direction: column; } }
</style>
