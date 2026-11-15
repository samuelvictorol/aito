<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'

const props = defineProps({ live: { type: Boolean, default: true } })
const $q = useQuasar()
const endpoint = '/aito-tokens/admin/video-queue'
const refreshInterval = 8000
const queue = ref(null)
const limitDraft = ref('')
const loading = ref(false)
const savingLimit = ref(false)
const error = ref('')
const checkedAt = ref(null)
const filters = reactive({ owner: '', status: 'queued', source: null })
const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })
const preview = ref(null)
const previewOpen = ref(false)
const previewing = ref('')
let appliedFilters = { status: filters.status }
let pendingLoad
let pendingSave
let pendingPreview
let refreshTimer
let disposed = false

const numbers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 })
const dollars = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 })
const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' })
const statuses = {
  queued: { label: 'Na fila', color: 'amber-4' },
  in_progress: { label: 'Em andamento', color: 'blue-3' },
  completed: { label: 'Concluída', color: 'teal-3' },
  failed: { label: 'Encerrada', color: 'grey-4' },
  uncertain: { label: 'Aguardando confirmação', color: 'orange-4' },
}
const origins = { chat: 'Chat', studio: 'Estúdio de vídeo', remake: 'Refazer vídeos', codex: 'Codex', legacy: 'AitoIA · legado' }
const billingLabels = { reserved: 'Reserva', reconciliation: 'Custo em conciliação', released: 'Reserva liberada', applied: 'Confirmado' }
const priceLabels = { quote: 'Cotação do provedor', estimate: 'Estimativa', reconciled: 'Custo conciliado' }
const unitLabels = { second: ['segundo', 'segundos'], token: ['token', 'tokens'], credit: ['crédito', 'créditos'], video: ['vídeo', 'vídeos'] }
const stateOptions = Object.entries(statuses).map(([value, { label }]) => ({ value, label }))
const sourceOptions = Object.entries(origins).map(([value, label]) => ({ value, label }))
const columns = [
  { name: 'order', label: 'Entrada na fila', field: 'createdAt', align: 'left' },
  { name: 'owner', label: 'Solicitante', field: 'owner', align: 'left' },
  { name: 'status', label: 'Estado', field: 'status', align: 'left' },
  { name: 'credits', label: 'AitoTokens', field: 'creditsCharged', align: 'right' },
  { name: 'cost', label: 'Custo Higgsfield', field: 'providerUsdMicros', align: 'right' },
  { name: 'margin', label: 'Margem bruta', field: 'marginUsdMicros', align: 'right' },
  { name: 'preview', label: 'Resultado', field: 'previewAvailable', align: 'center' },
]
const limitValue = computed(() => /^\d+$/.test(String(limitDraft.value ?? '').trim()) ? Number(limitDraft.value) : NaN)
const validLimit = computed(() => Number.isInteger(limitValue.value) && limitValue.value >= 1 && limitValue.value <= 100)
const capChanged = computed(() => validLimit.value && queue.value && limitValue.value !== queue.value.limit)
const formatUsd = micros => Number.isSafeInteger(micros) ? dollars.format(micros / 1_000_000) : '—'
const formatDate = timestamp => Number.isFinite(Date.parse(timestamp)) ? dateTime.format(new Date(timestamp)) : '—'
const formatCredits = value => Number.isFinite(value) ? numbers.format(value) : '—'

function providerUnits(row) {
  if (!Number.isFinite(row.providerUnits) || !row.providerUnit) return ''
  const labels = unitLabels[row.providerUnit]
  return `${numbers.format(row.providerUnits)} ${labels?.[Number(row.providerUnits !== 1)] || row.providerUnit}`
}
function stateOf(row) {
  return statuses[row.status] || statuses.failed
}
function requester(row) {
  return row.owner?.name || row.owner?.email || (row.owner?.kind === 'admin' ? 'Admin Aito' : 'Cliente')
}

function scheduleRefresh(delay = refreshInterval) {
  clearTimeout(refreshTimer)
  if (!disposed && props.live && !savingLimit.value) refreshTimer = setTimeout(() => {
    if (document.hidden) scheduleRefresh()
    else void load()
  }, delay)
}

async function load(page = pagination.value.page, rowsPerPage = pagination.value.rowsPerPage, manual = false) {
  if (disposed || savingLimit.value) return
  clearTimeout(refreshTimer)
  pendingLoad?.abort()
  const controller = new AbortController()
  pendingLoad = controller
  if (manual || !queue.value) loading.value = true
  try {
    const { data } = await api.get(endpoint, { ...financeHeaders(true), signal: controller.signal, timeout: 10000,
      params: { ...appliedFilters, offset: (page - 1) * rowsPerPage, limit: rowsPerPage } })
    if (controller.signal.aborted) return
    const result = data.data
    if (!Array.isArray(result?.rows) || !Number.isInteger(result.limit) || !Number.isInteger(result.total)) {
      throw new Error('Resposta da fila incompleta.')
    }
    if (!queue.value || limitValue.value === queue.value.limit) limitDraft.value = result.limit
    queue.value = result
    checkedAt.value = new Date()
    error.value = ''
    const pageSize = result.pageSize || rowsPerPage
    const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
    pagination.value = { page: Math.min(page, lastPage), rowsPerPage: pageSize, rowsNumber: result.total }
    if (page > lastPage) return void load(lastPage, pageSize, true)
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível consultar a fila da Higgsfield.'
  } finally {
    if (pendingLoad === controller) {
      pendingLoad = null
      loading.value = false
      scheduleRefresh()
    }
  }
}

function changePage({ pagination: next }) {
  void load(next.page, next.rowsPerPage, true)
}
function applyFilters() {
  appliedFilters = { owner: filters.owner?.trim() || undefined, status: filters.status || undefined, source: filters.source || undefined }
  void load(1, pagination.value.rowsPerPage, true)
}
async function saveLimit() {
  if (!capChanged.value || savingLimit.value) return
  pendingLoad?.abort()
  clearTimeout(refreshTimer)
  const controller = new AbortController()
  pendingSave = controller
  savingLimit.value = true
  try {
    const { data } = await api.put(endpoint, { limit: limitValue.value }, { ...financeHeaders(true), signal: controller.signal })
    if (controller.signal.aborted) return
    const limit = data.data.limit
    queue.value = { ...queue.value, limit, saturated: queue.value.active >= limit }
    limitDraft.value = limit
    $q.notify({ type: 'positive', message: 'Limite da Higgsfield atualizado.' })
  } catch (cause) {
    if (!controller.signal.aborted) $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível salvar o limite.' })
  } finally {
    if (pendingSave === controller) {
      pendingSave = null
      savingLimit.value = false
      if (!disposed) void load()
    }
  }
}

function clearPreview() {
  pendingPreview?.abort()
  pendingPreview = null
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
  previewing.value = ''
}
async function openPreview(row) {
  if (!row.previewAvailable) return
  clearPreview()
  const controller = new AbortController()
  pendingPreview = controller
  previewing.value = row.id
  try {
    const { data } = await api.get(`${endpoint}/${encodeURIComponent(row.id)}/file`, {
      ...financeHeaders(true), signal: controller.signal, timeout: 65000, responseType: 'blob',
    })
    if (controller.signal.aborted) return
    if (!(data instanceof Blob) || !data.size || !data.type.startsWith('video/')) throw new Error('Prévia inválida.')
    preview.value = { url: URL.createObjectURL(data), title: row.model || 'Clipe gerado' }
    previewOpen.value = true
  } catch (cause) {
    if (!controller.signal.aborted) $q.notify({ type: 'negative', message: [404, 410].includes(cause.response?.status)
      ? 'Este resultado já expirou no provedor.' : 'Não foi possível abrir o resultado desta geração.' })
  } finally {
    if (pendingPreview === controller) {
      pendingPreview = null
      previewing.value = ''
    }
  }
}

function onVisibility() {
  if (!document.hidden && props.live) void load()
}
watch(() => props.live, enabled => {
  if (enabled) void load()
  else clearTimeout(refreshTimer)
})
onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(refreshTimer)
  pendingLoad?.abort()
  pendingSave?.abort()
  clearPreview()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="admin-video-queue" aria-labelledby="higgsfield-queue">
    <header class="admin-video-queue__header">
      <div>
        <h4 id="higgsfield-queue"><q-icon name="mdi-movie-open-play-outline" color="teal-3" size="21px" /> Limite de geração simultânea Higgsfield</h4>
        <p v-if="queue" class="admin-video-queue__counts">
          <strong>{{ numbers.format(queue.active) }} / {{ numbers.format(queue.limit) }} em andamento</strong>
          <span>{{ numbers.format(queue.queued) }} na fila</span>
          <q-badge v-if="queue.saturated" outline color="orange-4">
            <q-icon name="mdi-alert-outline" size="15px" class="q-mr-xs" /> Alta demanda
          </q-badge>
        </p>
        <p v-if="checkedAt" class="admin-video-queue__muted">Consultado às {{ clock.format(checkedAt) }} (Brasília)</p>
      </div>
      <q-form class="admin-video-queue__limit" @submit.prevent="saveLimit">
        <q-input v-model="limitDraft" dark outlined dense label="Limite simultâneo" type="number" min="1" max="100" step="1" inputmode="numeric"
          :disable="!queue || savingLimit" />
        <q-btn outline no-caps color="teal-3" type="submit" label="Salvar limite" :disable="!capChanged" :loading="savingLimit" />
        <q-btn flat round dense color="teal-3" icon="mdi-refresh" aria-label="Atualizar fila da Higgsfield" :loading="loading" :disable="savingLimit"
          @click="load(pagination.page, pagination.rowsPerPage, true)" />
      </q-form>
    </header>
    <q-form class="admin-video-queue__filters" @submit.prevent="applyFilters">
      <q-input v-model="filters.owner" dark outlined dense clearable maxlength="120" label="Solicitante ou e-mail" />
      <q-select v-model="filters.status" dark outlined dense emit-value map-options clearable :options="stateOptions" label="Estado" />
      <q-select v-model="filters.source" dark outlined dense emit-value map-options clearable :options="sourceOptions" label="Origem" />
      <q-btn unelevated no-caps color="teal-8" type="submit" icon="mdi-filter-variant" label="Filtrar fila" :disable="savingLimit" />
    </q-form>
    <q-banner v-if="error" rounded dense class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <q-table v-model:pagination="pagination" dark flat dense :rows="queue?.rows || []" :columns="columns" row-key="id" :rows-per-page-options="[10, 25, 50]"
      :loading="loading" rows-per-page-label="Por página" no-data-label="Nenhuma geração neste filtro." @request="changePage">
      <template #body-cell-order="slot">
        <q-td :props="slot">
          <span>{{ formatDate(slot.row.createdAt) }}</span>
          <small class="admin-video-queue__muted">{{ origins[slot.row.source] || 'AitoIA' }}<template v-if="slot.row.model"> · {{ slot.row.model }}</template></small>
        </q-td>
      </template>
      <template #body-cell-owner="slot">
        <q-td :props="slot">
          <strong>{{ requester(slot.row) }}</strong>
          <q-badge v-if="slot.row.owner?.kind === 'admin'" outline color="purple-3" class="q-ml-xs">Admin</q-badge>
          <small v-if="slot.row.owner?.email && slot.row.owner.email !== requester(slot.row)" class="admin-video-queue__muted">{{ slot.row.owner.email }}</small>
        </q-td>
      </template>
      <template #body-cell-status="slot">
        <q-td :props="slot">
          <q-badge outline :color="stateOf(slot.row).color" :label="stateOf(slot.row).label" />
          <small v-if="slot.row.billingState && slot.row.billingState !== 'applied'" class="admin-video-queue__muted">{{ billingLabels[slot.row.billingState] }}</small>
        </q-td>
      </template>
      <template #body-cell-credits="slot">
        <q-td :props="slot">
          {{ formatCredits(slot.row.creditsCharged ?? slot.row.creditsReserved) }}
          <small v-if="slot.row.creditsCharged == null && slot.row.creditsReserved != null" class="admin-video-queue__muted">Reservados</small>
          <small v-else-if="slot.row.billedUsdMicros != null" class="admin-video-queue__muted">{{ formatUsd(slot.row.billedUsdMicros) }}</small>
        </q-td>
      </template>
      <template #body-cell-cost="slot">
        <q-td :props="slot">
          {{ formatUsd(slot.row.providerUsdMicros) }}
          <small v-if="providerUnits(slot.row)" class="admin-video-queue__muted">{{ providerUnits(slot.row) }}</small>
          <small v-if="priceLabels[slot.row.pricingBasis]" class="admin-video-queue__muted">{{ priceLabels[slot.row.pricingBasis] }}</small>
        </q-td>
      </template>
      <template #body-cell-margin="slot"><q-td :props="slot">{{ formatUsd(slot.row.marginUsdMicros) }}</q-td></template>
      <template #body-cell-preview="slot">
        <q-td :props="slot">
          <q-btn v-if="slot.row.previewAvailable" flat dense no-caps color="teal-3" icon="mdi-play-circle-outline" label="Ver clipe"
            :loading="previewing === slot.row.id" @click="openPreview(slot.row)" />
          <span v-else>—</span>
        </q-td>
      </template>
    </q-table>
    <p class="admin-video-queue__muted">Histórico da fila por 14 dias. Custos em conciliação aparecem quando confirmados.</p>
    <q-dialog v-model="previewOpen" aria-labelledby="higgsfield-queue-result" @hide="clearPreview">
      <q-card dark class="admin-video-queue__preview">
        <q-card-section class="row items-center justify-between no-wrap">
          <h4 id="higgsfield-queue-result">{{ preview?.title }}</h4>
          <q-btn v-close-popup flat dense round icon="mdi-close" aria-label="Fechar resultado da geração" />
        </q-card-section>
        <q-card-section v-if="preview">
          <video :src="preview.url" controls playsinline preload="metadata" aria-label="Resultado da geração Higgsfield" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.admin-video-queue { display: grid; grid-template-columns: minmax(0, 1fr); gap: .85rem; padding: clamp(.75rem, 2vw, 1.15rem); color: #effffb; background: #0a191a; border: 1px solid #2b4a49; border-radius: 14px; min-width: 0; }
.admin-video-queue__header, .admin-video-queue__limit, .admin-video-queue__counts { display: flex; align-items: center; gap: .65rem; flex-wrap: wrap; }
.admin-video-queue__header { justify-content: space-between; }
.admin-video-queue__header h4, .admin-video-queue__preview h4 { margin: 0; font-size: 1rem; line-height: 1.3; font-weight: 700; }
.admin-video-queue__counts { margin: .4rem 0 .15rem; font-size: .84rem; }
.admin-video-queue__counts > span { color: #bfddda; }
.admin-video-queue__limit .q-field { width: 145px; }
.admin-video-queue__filters { display: grid; grid-template-columns: minmax(160px, 2fr) repeat(2, minmax(115px, 1fr)) auto; align-items: center; gap: .55rem; }
.admin-video-queue .q-table__container { background: #11191f; border: 1px solid #293c43; border-radius: 9px; }
.admin-video-queue :deep(td) { vertical-align: middle; }
.admin-video-queue__muted { display: block; margin: 0; color: #a4c0be; font-size: .72rem; overflow-wrap: anywhere; }
.admin-video-queue td .admin-video-queue__muted { max-width: 24ch; white-space: normal; }
.admin-video-queue__preview { width: min(92vw, 740px); max-width: none; background: #08191b; color: #effffb; }
.admin-video-queue__preview video { display: block; width: 100%; max-height: 67dvh; border-radius: 8px; background: #020505; }
@media (max-width: 660px) { .admin-video-queue__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 380px) { .admin-video-queue__limit .q-field { width: 100%; } .admin-video-queue__filters { grid-template-columns: 1fr; } }
</style>
