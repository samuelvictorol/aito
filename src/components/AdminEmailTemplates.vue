<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { api } from 'boot/axios'

const endpoint = '/admin/email-templates'
const section = ref('templates')
const models = ref([])
const selectedKey = ref('')
const detail = ref(null)
const preview = ref('html')
const query = ref('')
const group = ref('')
const logs = ref([])
const historyTemplate = ref('')
const historyStatus = ref('')
const page = ref(1)
const hasMore = ref(false)
const loading = reactive({ list: false, detail: false, logs: false })
const errors = reactive({ list: '', detail: '', logs: '' })
const requests = {}
const statusOptions = [
  { label: 'Todas as situações', value: '' },
  { label: 'Aceito pelo servidor', value: 'accepted' },
  { label: 'Falha', value: 'failed' },
]
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const requestConfig = (signal, params) => ({
  headers: { Authorization: 'Bearer ' + (localStorage.getItem('aito_admin_token') || '') },
  signal,
  params,
})

function requestFor(key) {
  requests[key]?.abort()
  const controller = new AbortController()
  requests[key] = controller
  loading[key] = true
  errors[key] = ''
  return controller
}

function reportError(key, controller, error, fallback) {
  if (!controller.signal.aborted) errors[key] = error.response?.data?.message || fallback
}

const groups = computed(() => [
  { label: 'Todos os grupos', value: '' },
  ...[...new Set(models.value.map(model => model.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(value => ({ value, label: value })),
])
const modelOptions = computed(() => [
  { label: 'Todos os modelos', value: '' },
  ...models.value.map(model => ({ label: model.label, value: model.key })),
])
const modelNames = computed(() => new Map(models.value.map(model => [model.key, model.label])))
const fold = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const visibleModels = computed(() => {
  const term = fold(query.value).trim()
  return models.value.filter(model =>
    (!group.value || model.group === group.value)
    && (!term || fold([model.label, model.group, model.source, model.key].join(' ')).includes(term)),
  )
})

function formatDate(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : '—'
}

function senderName(value) {
  if (typeof value === 'string') return value
  return value?.name && value?.address ? value.name + ' <' + value.address + '>' : value?.address || value?.email || value?.name || '—'
}

function attachmentName(item) {
  if (typeof item === 'string') return item
  return item?.filename || item?.name || 'Arquivo'
}

function safePreview(html) {
  const fragment = document.createElement('template')
  fragment.innerHTML = html
  fragment.content.querySelectorAll('script, iframe, frame, frameset, object, embed, portal, form, base, meta, link, svg, math, audio, video, source, track').forEach(node => node.remove())
  for (const element of fragment.content.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (/^on|^(?:href|xlink:href|srcset|ping|poster|background|target|action|formaction|is)$/i.test(attribute.name)) {
        element.removeAttribute(attribute.name)
      }
      if (attribute.name === 'src' && (element.localName !== 'img' || !/^data:image\/(?:png|jpeg|gif|webp|avif);base64,/i.test(attribute.value))) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"></head><body>' + fragment.innerHTML + '</body></html>'
}
const previewDocument = computed(() => detail.value?.html?.trim() ? safePreview(detail.value.html) : '')

async function loadTemplates() {
  const request = requestFor('list')
  try {
    const { data } = await api.get(endpoint, requestConfig(request.signal))
    if (request.signal.aborted) return
    models.value = Array.isArray(data.data) ? data.data : []
    if (!models.value.some(model => model.key === selectedKey.value)) selectedKey.value = models.value[0]?.key || ''
  } catch (error) {
    reportError('list', request, error, 'Não foi possível carregar os modelos de e-mail.')
  } finally {
    if (!request.signal.aborted) loading.list = false
  }
}

async function loadTemplate(key) {
  detail.value = null
  if (!key) {
    requests.detail?.abort()
    loading.detail = false
    errors.detail = ''
    return
  }
  const request = requestFor('detail')
  try {
    const { data } = await api.get(endpoint + '/' + encodeURIComponent(key), requestConfig(request.signal))
    if (request.signal.aborted) return
    detail.value = data.data
    preview.value = detail.value?.html?.trim() ? 'html' : 'text'
  } catch (error) {
    reportError('detail', request, error, 'Não foi possível abrir a prévia deste modelo.')
  } finally {
    if (!request.signal.aborted) loading.detail = false
  }
}

async function loadLogs(nextPage = 1) {
  const request = requestFor('logs')
  const params = { template: historyTemplate.value || undefined, status: historyStatus.value || undefined, page: nextPage }
  try {
    const { data } = await api.get(endpoint + '/logs', requestConfig(request.signal, params))
    if (request.signal.aborted) return
    const result = data.data
    logs.value = result.items || []
    page.value = result.page
    hasMore.value = Boolean(result.hasMore)
  } catch (error) {
    reportError('logs', request, error, 'Não foi possível consultar o histórico de e-mails.')
  } finally {
    if (!request.signal.aborted) loading.logs = false
  }
}

async function refresh() {
  if (section.value === 'history') return loadLogs(page.value)
  const key = selectedKey.value
  await loadTemplates()
  if (key && key === selectedKey.value) await loadTemplate(key)
}

function showHistory(key) {
  historyTemplate.value = key
  section.value = 'history'
}

watch(selectedKey, loadTemplate)
watch([section, historyTemplate, historyStatus], () => {
  if (section.value !== 'history') return
  logs.value = []
  page.value = 1
  hasMore.value = false
  void loadLogs()
})

onMounted(loadTemplates)
onBeforeUnmount(() => { Object.values(requests).forEach(request => request.abort()) })
</script>

<template>
  <section class="email-audit" aria-labelledby="email-audit-title">
    <header class="email-audit__hero">
      <span class="email-audit__icon"><q-icon name="mdi-email-multiple-outline" size="26px" /></span>
      <div>
        <small>COMUNICAÇÃO DO SISTEMA</small>
        <h2 id="email-audit-title">Modelos de e-mail</h2>
        <p>Confira a mensagem que o sistema usa em cada etapa e acompanhe os envios registrados.</p>
      </div>
      <q-btn outline color="teal-3" no-caps icon="mdi-refresh" label="Atualizar" :loading="section === 'history' ? loading.logs : loading.list || loading.detail" @click="refresh" />
    </header>

    <q-tabs v-model="section" align="left" active-color="teal-3" indicator-color="teal-3" no-caps class="email-audit__tabs">
      <q-tab name="templates" label="Catálogo de modelos" icon="mdi-email-outline" inline-label />
      <q-tab name="history" label="Histórico de envios" icon="mdi-history" inline-label />
    </q-tabs>

    <div v-if="section === 'templates'" class="email-audit__workspace">
      <section class="email-audit__panel email-audit__catalog" aria-label="Selecionar modelo">
        <div class="email-audit__filters">
          <q-input v-model="query" clearable dark dense outlined label="Buscar modelo"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
          <q-select v-model="group" :options="groups" dark dense outlined emit-value map-options label="Grupo" />
        </div>
        <p v-if="errors.list" class="email-audit__error" role="alert">{{ errors.list }}</p>
        <div v-else-if="loading.list && !models.length" class="email-audit__empty" role="status"><q-spinner color="teal-3" /> Carregando catálogo…</div>
        <div v-else-if="!visibleModels.length" class="email-audit__empty">Nenhum modelo encontrado.</div>
        <ul v-else class="email-audit__model-list">
          <li v-for="model in visibleModels" :key="model.key">
            <button type="button" :aria-pressed="selectedKey === model.key" @click="selectedKey = model.key">
              <div><strong>{{ model.label }}</strong><small>{{ model.group || model.source || 'Sistema' }}</small></div>
              <q-icon name="mdi-chevron-right" size="18px" />
            </button>
          </li>
        </ul>
      </section>

      <section class="email-audit__panel email-audit__preview" aria-label="Prévia do modelo">
        <p v-if="errors.detail" class="email-audit__error" role="alert">{{ errors.detail }}</p>
        <div v-else-if="loading.detail" class="email-audit__empty" role="status"><q-spinner color="teal-3" /> Carregando modelo…</div>
        <div v-else-if="!detail" class="email-audit__empty">Selecione um modelo para ver a prévia.</div>
        <template v-else>
          <header class="email-audit__detail-head">
            <div><span class="email-audit__eyebrow">{{ detail.group || 'Modelo' }}</span><h3>{{ detail.label }}</h3></div>
            <q-badge v-if="detail.legacy" outline color="orange-3" label="Legado" />
            <q-btn flat no-caps color="teal-3" icon="mdi-history" label="Ver envios deste modelo" @click="showHistory(detail.key)" />
          </header>
          <dl class="email-audit__meta">
            <div><dt>Assunto</dt><dd>{{ detail.subject || '—' }}</dd></div>
            <div><dt>Remetente</dt><dd>{{ senderName(detail.sender) }}</dd></div>
            <div><dt>Origem</dt><dd>{{ detail.source || '—' }}</dd></div>
            <div v-if="detail.attachments?.length"><dt>Anexos</dt><dd>{{ detail.attachments.map(attachmentName).join(', ') }}</dd></div>
          </dl>
          <q-btn-toggle v-if="previewDocument && detail.text" v-model="preview" no-caps flat toggle-color="teal-8" :options="[{ label: 'Prévia HTML', value: 'html' }, { label: 'Texto', value: 'text' }]" class="email-audit__preview-mode" />
          <iframe v-if="previewDocument && preview === 'html'" :srcdoc="previewDocument" sandbox="" referrerpolicy="no-referrer" title="Prévia HTML do e-mail" class="email-audit__frame"></iframe>
          <pre v-else-if="detail.text" class="email-audit__text">{{ detail.text }}</pre>
          <div v-else class="email-audit__empty">Este modelo ainda não tem conteúdo disponível para prévia.</div>
        </template>
      </section>
    </div>

    <section v-else class="email-audit__panel" aria-label="Histórico de envios">
      <p class="email-audit__note">O histórico começa com a implantação deste painel. Os destinatários são mascarados.</p>
      <div class="email-audit__filters email-audit__filters--history">
        <q-select v-model="historyTemplate" :options="modelOptions" dark dense outlined emit-value map-options label="Modelo" />
        <q-select v-model="historyStatus" :options="statusOptions" dark dense outlined emit-value map-options label="Situação" />
      </div>
      <p v-if="errors.logs" class="email-audit__error" role="alert">{{ errors.logs }}</p>
      <div v-else-if="loading.logs && !logs.length" class="email-audit__empty" role="status"><q-spinner color="teal-3" /> Carregando histórico…</div>
      <div v-else-if="!logs.length" class="email-audit__empty">Nenhum envio registrado com estes filtros.</div>
      <ul v-if="logs.length" class="email-audit__logs">
        <li v-for="item in logs" :key="item._id">
          <div><strong>{{ modelNames.get(item.template) || item.template || 'E-mail do sistema' }}</strong><small>{{ item.source || '—' }}</small></div>
          <div><small>Remetente</small><span>{{ senderName(item.sender) }}</span></div>
          <div><small>Destinatário</small><span>{{ item.recipient || '—' }}</span></div>
          <div class="email-audit__log-status">
            <q-badge :color="item.status === 'accepted' ? 'teal-8' : item.status === 'failed' ? 'red-8' : 'grey-8'" :label="statusOptions.find(option => option.value === item.status)?.label || '—'" />
            <time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time>
          </div>
        </li>
      </ul>
      <nav v-if="page > 1 || hasMore" class="email-audit__paging" aria-label="Paginação do histórico">
        <q-btn flat round icon="mdi-chevron-left" aria-label="Página anterior" :disable="page <= 1 || loading.logs" @click="loadLogs(page - 1)" />
        <span>Página {{ page }}</span>
        <q-btn flat round icon="mdi-chevron-right" aria-label="Próxima página" :disable="!hasMore || loading.logs" @click="loadLogs(page + 1)" />
      </nav>
    </section>
  </section>
</template>

<style scoped>
.email-audit { display: grid; gap: 14px; color: #edfffb; }
.email-audit__hero { display: flex; align-items: center; gap: 14px; }
.email-audit__hero > div, .email-audit__detail-head > div { flex: 1; min-width: 0; }
.email-audit__icon { display: grid; flex: 0 0 54px; height: 54px; place-items: center; border: 1px solid #346e65; border-radius: 13px; color: #9dffe5; background: #133732; }
.email-audit__hero small, .email-audit__eyebrow { color: #95e9d7; font-size: .66rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
.email-audit h2, .email-audit h3 { margin: 3px 0; color: #edfffb; font-weight: 740; line-height: 1.2; letter-spacing: -.025em; }
.email-audit h2 { font-size: clamp(24px, 4vw, 36px); }
.email-audit h3 { font-size: clamp(19px, 3vw, 24px); }
.email-audit__hero p, .email-audit__note { color: #afcbc4; margin: 5px 0 0; line-height: 1.55; }
.email-audit__note { margin: 0 0 12px; }
.email-audit__tabs { border-bottom: 1px solid #234b45; }
.email-audit__workspace { display: grid; grid-template-columns: minmax(215px, .68fr) minmax(0, 1.6fr); gap: 14px; align-items: start; }
.email-audit__panel { min-width: 0; padding: 15px; border: 1px solid #2b544d; border-radius: 14px; background: #0b201e; }
.email-audit__filters { display: grid; gap: 8px; }
.email-audit__filters--history { grid-template-columns: minmax(0, 1fr) minmax(145px, .48fr); }
.email-audit__model-list, .email-audit__logs { list-style: none; padding: 0; margin: 12px 0 0; }
.email-audit__model-list { max-height: 48vh; overflow-y: auto; display: grid; gap: 5px; }
.email-audit__model-list button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 46px; padding: 7px 8px; color: #d8ede7; border: 1px solid transparent; border-radius: 8px; background: #122b28; font: inherit; text-align: left; cursor: pointer; }
.email-audit__model-list button[aria-pressed=true] { border-color: #4d9c89; background: #1c453d; color: #effffa; }
.email-audit__model-list button:hover, .email-audit__model-list button:focus-visible { border-color: #6fbdab; }
.email-audit__model-list button > div, .email-audit__logs li > div { min-width: 0; overflow-wrap: anywhere; }
.email-audit__model-list small, .email-audit__logs small, .email-audit__meta dt { display: block; color: #9fbcb5; font-size: .74rem; }
.email-audit__detail-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.email-audit__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; padding: 12px; background: #071816; border-radius: 8px; }
.email-audit__meta > div:first-child { grid-column: 1 / -1; }
.email-audit__meta dd { margin: 3px 0 0; overflow-wrap: anywhere; }
.email-audit__preview-mode { margin-bottom: 8px; }
.email-audit__frame { display: block; width: 100%; height: clamp(280px, 52vh, 600px); border: 0; border-radius: 8px; background: #fff; }
.email-audit__text { min-height: 175px; max-height: 52vh; overflow: auto; margin: 0; padding: 13px; border-radius: 8px; background: #071816; color: #c5ebe1; white-space: pre-wrap; overflow-wrap: anywhere; }
.email-audit__error, .email-audit__empty { margin: 10px 0 0; padding: 10px; border-radius: 8px; }
.email-audit__error { background: #482c27; color: #ffd4ca; }
.email-audit__empty { background: #102a25; color: #b9d4cd; }
.email-audit__logs li { display: grid; grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr)) auto; align-items: start; gap: 8px 12px; padding: 10px 4px; border-top: 1px solid #284b45; }
.email-audit__log-status { display: grid; justify-items: end; gap: 4px; }
.email-audit__log-status time { color: #a9c7c0; font-size: .74rem; }
.email-audit__paging { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
@media (max-width: 800px) {
  .email-audit__workspace { grid-template-columns: minmax(0, 1fr); }
  .email-audit__model-list { max-height: 240px; }
  .email-audit__logs li { grid-template-columns: 1fr 1fr; }
  .email-audit__log-status { justify-items: start; }
}
@media (max-width: 475px) {
  .email-audit__hero { flex-wrap: wrap; }
  .email-audit__hero > div { flex-basis: calc(100% - 70px); }
  .email-audit__panel { padding: 11px; }
  .email-audit__filters--history { grid-template-columns: minmax(0, 1fr); }
  .email-audit__detail-head > div { flex-basis: 75%; }
}
</style>
