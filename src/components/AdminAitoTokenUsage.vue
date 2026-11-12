<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import LoginMfaDialog from './LoginMfaDialog.vue'

const emit = defineEmits(['reauthenticated'])
const $q = useQuasar()

const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const eventDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' })
const liveRefreshMs = 10000
function calendarDay(date) {
  const parts = Object.fromEntries(dateKey.formatToParts(date).map(({ type, value }) => [type, value]))
  return [parts.year, parts.month, parts.day].join('-')
}
const today = new Date()
const filters = reactive({
  from: calendarDay(new Date(today.getTime() - 29 * 86400000)),
  to: calendarDay(today),
  scope: 'all',
  projectId: null,
  productType: null,
  licenseId: '',
  clientId: null,
  model: '',
  feature: '',
  source: null,
  provider: null,
  state: null,
  requestId: '',
  providerBalance: '',
})
const scopes = [
  { label: 'Todos os usos', value: 'all' },
  { label: 'Projetos', value: 'project' },
  { label: 'Produtos', value: 'product' },
  { label: 'Carteiras AitoIA Web', value: 'web' },
  { label: 'Aito Comunicação', value: 'embedded' },
]
const products = [
  { label: 'Desktop', value: 'desktop' },
  { label: 'Whitelabel', value: 'cloud' },
  { label: 'Legado', value: 'legacy' },
]
const sourceLabels = {
  desktop: 'Desktop (.exe)', whitelabel: 'Whitelabel', communication: 'Aito Comunicação', web: 'AitoIA Web',
  project: 'Integração de projeto', codex_openai: 'Codex · OpenAI', codex_higgsfield: 'Codex · Higgsfield',
  unknown: 'Origem não identificada',
}
const providerLabels = { openai: 'OpenAI', higgsfield: 'Higgsfield' }
const logStates = { applied: 'Concluída', reserved: 'Em processamento', released: 'Reserva liberada', reconciliation: 'Conciliação pendente' }
const stateColors = { applied: 'teal-3', reserved: 'blue-3', released: 'grey-4', reconciliation: 'amber-4' }
const optionList = labels => Object.entries(labels).map(([value, label]) => ({ label, value }))
const sourceOptions = optionList(sourceLabels)
const providerOptions = optionList(providerLabels)
const stateOptions = optionList(logStates)
const loading = ref(false)
const error = ref('')
const liveEnabled = ref(true)
const liveError = ref(false)
const needsReview = ref(false)
const updatedAt = ref(null)
const summary = ref(null)
const exchangeRate = ref(null)
const groups = ref([])
const logs = ref([])
const providerTotals = ref([])
const projects = ref([])
const clients = ref([])
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })
const simulatedCost = ref('')
const reconciliation = ref(null)
const reconciliationCost = ref('')
const reconciliationBusy = ref(false)
const challenge = ref(null)
const mfaOpen = ref(false)
const selectedLog = ref(null)
let controller
let liveController
let liveTimer
let fullUpdatedAt = 0
let submitted
let verifiedDecision

const numbers = new Intl.NumberFormat('pt-BR')
const dollars = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 })
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 6 })
const rates = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
const money = (value, format = dollars) => typeof value === 'number' && Number.isFinite(value) ? format.format(value / 100) : '—'
const formatEvent = value => value && Number.isFinite(Date.parse(value)) ? eventDate.format(new Date(value)) : '—'
const mediaUnits = { video: ['vídeo', 'vídeos'], image: ['imagem', 'imagens'], second: ['segundo', 'segundos'], audio: ['áudio', 'áudios'], character: ['caractere', 'caracteres'] }
function formatProviderUsage(row) {
  const labels = mediaUnits[row.unit]
  if (labels && Number.isFinite(row.quantity)) return `${numbers.format(row.quantity)} ${labels[row.quantity === 1 ? 0 : 1]}`
  const tokens = (row.inputTokens || 0) + (row.outputTokens || 0)
  return tokens > 0 ? `${numbers.format(tokens)} tokens` : '—'
}
const productName = value => products.find(product => product.value === value)?.label || value || 'Produto'
const providerName = value => providerLabels[value] || '—'
const sourceName = value => sourceLabels[value] || sourceLabels.unknown
const pricingBasis = { token_usage: 'Uso medido em tokens', fixed_rate: 'Tarifa por unidade', quote: 'Cotação do provedor', reconciled: 'Conciliação confirmada', estimate: 'Estimativa' }
const subject = row => row.title || (row.scope === 'embedded' ? 'Aito Comunicação' : row.scope === 'project' ? 'Projeto' : productName(row.productType))
const requestReference = row => row.requestId || row.operation || row._id || '—'
const combinedColumns = [
  { name: 'source', label: 'Origem', field: row => sourceName(row.source), align: 'left' },
  { name: 'subject', label: 'Conta ou projeto', field: subject, align: 'left' },
  { name: 'client', label: 'Titular / cliente', field: row => row.clientName || '—', align: 'left' },
  { name: 'model', label: 'Provedor / modelo', field: row => [providerName(row.provider), row.model].filter(Boolean).join(' · '), align: 'left' },
]
const costColumns = [
  { name: 'billed', label: 'Consumo AitoTokens', field: 'billedUsdCents', brlField: 'billedBrlCents' },
  { name: 'provider', label: 'Custo do provedor', field: 'providerUsdCents', brlField: 'providerBrlCents' },
  { name: 'margin', label: 'Margem bruta', field: 'marginUsdCents', brlField: 'marginBrlCents' },
]
const groupColumns = [...combinedColumns, { name: 'requests', label: 'Chamadas', field: row => numbers.format(row.requests || 0) },
  { name: 'units', label: 'Uso do provedor', field: formatProviderUsage }, ...costColumns]
const logColumns = [
  { name: 'date', label: 'Horário (Brasília)', field: row => formatEvent(row.createdAt), align: 'left' },
  ...combinedColumns,
  { name: 'units', label: 'Uso do provedor', field: formatProviderUsage },
  { name: 'state', label: 'Estado', field: row => logStates[row.state] || row.state || '—', align: 'left' },
  ...costColumns,
  { name: 'details', label: 'Detalhes', field: requestReference, align: 'left' },
]
const metrics = computed(() => {
  const data = summary.value || {}
  return [
    { label: 'Consumo AitoTokens', usd: data.billedUsdCents, brl: data.billedBrlCents, icon: 'mdi-circle-multiple-outline' },
    { label: 'Custo dos provedores', usd: data.providerUsdCents, brl: data.providerBrlCents, icon: 'mdi-server-outline' },
    { label: 'Margem bruta', usd: data.marginUsdCents, brl: data.marginBrlCents, icon: 'mdi-chart-line' },
    { label: 'Recargas confirmadas', usd: data.paidRechargeUsdCents, brl: data.paidRechargeBrlCents, icon: 'mdi-wallet-plus-outline' },
  ]
})
const forecast = computed(() => {
  const data = summary.value || {}
  return [
    { label: 'Créditos disponíveis', value: data.outstandingUsdCents },
    { label: 'Reserva estimada para uso', value: data.projectedProviderUsdCents },
    { label: 'Margem estimada', value: data.projectedMarginUsdCents },
    { label: 'Recarga sugerida', value: data.fundingGapUsdCents },
  ]
})
const providerShare = computed(() => {
  const { providerUsdCents, billedUsdCents, marginUsdCents } = summary.value || {}
  return billedUsdCents > 0 && marginUsdCents >= 0 ? 100 * providerUsdCents / billedUsdCents : null
})
const simulatedCents = computed(() => {
  const cents = Math.round(Number(simulatedCost.value) * 100)
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1000000 ? cents : 0
})
const liveStatus = computed(() => {
  if (!liveEnabled.value) return 'Atualização automática pausada'
  if (needsReview.value) return 'Revise a consulta para retomar'
  if (pagination.value.page > 1) return 'Atualização automática na primeira página'
  if (liveError.value) return 'Reconectando ao monitoramento'
  return 'Logs a cada 10 s · Totais a cada 30 s'
})
const selectedDetails = computed(() => {
  const row = selectedLog.value
  if (!row) return []
  return [
    { label: 'Requisição', value: requestReference(row) },
    { label: 'ID da operação', value: row.operation !== requestReference(row) && row.operation },
    { label: 'ID do registro', value: row._id !== requestReference(row) && row._id },
    { label: 'Origem', value: sourceName(row.source) },
    { label: 'Conta ou projeto', value: subject(row) },
    { label: 'Titular / cliente', value: row.clientName || row.clientId },
    { label: 'Quem solicitou', value: row.actorName || row.actorId },
    { label: 'ID da licença', value: row.licenseId },
    { label: 'ID do projeto', value: row.projectId },
    { label: 'Provedor', value: providerName(row.provider) },
    { label: 'Requisição no provedor', value: row.providerRequestId },
    { label: 'Resposta no provedor', value: row.providerResponseId },
    { label: 'Geração no provedor', value: row.providerJobId },
    { label: 'Modelo', value: row.model },
    { label: 'Recurso', value: row.feature },
    { label: 'Solicitada em', value: formatEvent(row.submittedAt || row.createdAt) },
    { label: 'Finalizada em', value: row.settledAt && formatEvent(row.settledAt) },
    { label: 'Conciliada em', value: row.reconciledAt && formatEvent(row.reconciledAt) },
    { label: 'Cotação usada', value: typeof row.exchangeRate === 'number' && `US$ 1 = R$ ${rates.format(row.exchangeRate)}` },
    { label: 'Base do custo', value: pricingBasis[row.pricingBasis] },
    { label: 'Reserva', value: typeof row.reservedUsdCents === 'number' && money(row.reservedUsdCents) },
  ].filter(item => item.value)
})

function currentParams() {
  const { from, to, scope, projectId, productType, licenseId, clientId, model, feature, providerBalance, source, provider, state, requestId } = filters
  const providerBalanceUsdCents = providerBalance === '' || providerBalance == null ? undefined : Math.round(Number(providerBalance) * 100)
  return {
    from, to, scope,
    projectId: scope === 'project' ? projectId || undefined : undefined,
    productType: scope === 'product' ? productType || undefined : undefined,
    licenseId: scope === 'product' ? licenseId?.trim() || undefined : undefined,
    clientId: scope === 'embedded' ? undefined : clientId || undefined,
    model: model?.trim() || undefined,
    feature: feature?.trim() || undefined,
    source: source || undefined,
    provider: provider || undefined,
    state: state || undefined,
    requestId: requestId?.trim() || undefined,
    providerBalanceUsdCents,
  }
}

function updateLogs(result, page) {
  logs.value = result.logs.map(row => ({ ...row, rowKey: row._id || row.operation }))
  pagination.value = { page, rowsPerPage: result.limit, rowsNumber: result.total }
  if (selectedLog.value) {
    selectedLog.value = logs.value.find(row => row.rowKey === selectedLog.value.rowKey) || selectedLog.value
  }
  updatedAt.value = new Date()
  liveError.value = false
}

async function load(page = 1, applyFilters = false, background = false) {
  if (applyFilters || !submitted) {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      error.value = 'Informe um período válido.'
      return
    }
    submitted = currentParams()
  }
  liveController?.abort()
  controller?.abort()
  const request = new AbortController()
  controller = request
  if (!background) {
    needsReview.value = false
    loading.value = true
    error.value = ''
  }
  try {
    const { rowsPerPage } = pagination.value
    const { data } = await api.get('/aito-tokens/admin/usage', {
      ...financeHeaders(true), signal: request.signal, timeout: 12000,
      params: { ...submitted, offset: (page - 1) * rowsPerPage },
    })
    if (request.signal.aborted || (background && !liveEnabled.value)) return
    const result = data.data
    summary.value = result.summary
    exchangeRate.value = result.exchangeRate
    groups.value = result.groups.map((row, index) => ({ ...row, rowKey: index }))
    providerTotals.value = result.providerTotals || []
    updateLogs(result, page)
    error.value = ''
    fullUpdatedAt = Date.now()
  } catch (cause) {
    if (!request.signal.aborted) {
      const rejected = [400, 401, 403, 422].includes(cause.response?.status)
      if (rejected) needsReview.value = true
      if (background && !rejected) liveError.value = true
      else error.value = cause.response?.data?.message || 'Não foi possível consultar o consumo.'
    }
  } finally {
    if (controller === request) {
      controller = null
      loading.value = false
    }
  }
}

async function pollLive() {
  if (!liveEnabled.value || document.hidden || pagination.value.page !== 1 || controller || liveController || !submitted || needsReview.value) return
  if (Date.now() - fullUpdatedAt >= 3 * liveRefreshMs) {
    await load(1, false, true)
    return
  }
  const request = new AbortController()
  liveController = request
  try {
    const { data } = await api.get('/aito-tokens/admin/usage/live', {
      ...financeHeaders(true), signal: request.signal, timeout: 8000, params: submitted,
    })
    if (!request.signal.aborted) updateLogs(data.data, 1)
  } catch (cause) {
    if (!request.signal.aborted) {
      if ([401, 403].includes(cause.response?.status)) {
        needsReview.value = true
        error.value = cause.response?.data?.message || 'A sessão administrativa precisa ser renovada.'
      } else {
        liveError.value = true
      }
    }
  } finally {
    if (liveController === request) liveController = null
  }
}

function setLive(value) {
  liveEnabled.value = value
  if (value) pollLive()
  else liveController?.abort()
}

async function loadOptions() {
  const result = await Promise.allSettled([
    api.get('/admin/projects', financeHeaders(true)),
    api.get('/admin/customers', financeHeaders(true)),
    api.get('/admin/users', financeHeaders(true)),
  ])
  if (result[0].status === 'fulfilled') {
    projects.value = result[0].value.data.data.map(item => ({ label: item.title, value: item._id }))
  }
  const available = result.slice(1).flatMap(item => item.status === 'fulfilled' ? item.value.data.data || [] : [])
  clients.value = [...new Map(available.map(item => [item._id, { label: [item.name, item.email].filter(Boolean).join(' · '), value: item._id }])).values()]
}

function reviewReconciliation(row) {
  reconciliationCost.value = ''
  reconciliation.value = row
}

async function requestReconciliationMfa() {
  const value = String(reconciliationCost.value ?? '').trim()
  if (!reconciliation.value || !/^\d+(?:\.\d{1,6})?$/.test(value)) return
  const providerUsdMicros = Math.round(Number(value) * 1000000)
  if (!Number.isSafeInteger(providerUsdMicros) || providerUsdMicros > 1000000000) return
  const decision = { entryId: reconciliation.value._id, providerUsdMicros }
  reconciliationBusy.value = true
  try {
    const { data } = await api.post('/auth/mfa/reauth', {}, financeHeaders(true))
    verifiedDecision = decision
    challenge.value = data
    mfaOpen.value = true
  } catch (cause) {
    $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível solicitar a confirmação.' })
  } finally {
    reconciliationBusy.value = false
  }
}

async function applyReconciliation(session) {
  if (!session?.token || !verifiedDecision || reconciliationBusy.value) return
  emit('reauthenticated', session)
  reconciliationBusy.value = true
  try {
    await api.post('/aitoia/admin/reconcile', verifiedDecision, { headers: { Authorization: 'Bearer ' + session.token } })
    reconciliation.value = null
    $q.notify({ type: 'positive', message: 'Conciliação registrada.' })
    await load(pagination.value.page)
  } catch (cause) {
    $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível concluir a conciliação.' })
  } finally {
    verifiedDecision = null
    reconciliationBusy.value = false
  }
}

onMounted(() => {
  load()
  loadOptions()
  liveTimer = window.setInterval(pollLive, liveRefreshMs)
  document.addEventListener('visibilitychange', pollLive)
})
onBeforeUnmount(() => {
  window.clearInterval(liveTimer)
  document.removeEventListener('visibilitychange', pollLive)
  controller?.abort()
  liveController?.abort()
})
</script>

<template>
  <section class="token-usage" aria-labelledby="token-usage-title">
    <header class="token-usage__header">
      <div>
        <h3 id="token-usage-title">Consumo de IA</h3>
        <p>Acompanhe chamadas, custos e margem por origem, cliente e provedor.</p>
      </div>
      <div class="token-usage__live">
        <q-toggle :model-value="liveEnabled" dark color="teal-4" label="Monitoramento ao vivo" @update:model-value="setLive" />
        <q-btn flat round dense color="teal-3" icon="mdi-refresh" aria-label="Atualizar consumo" :loading="loading" @click="load(pagination.page)" />
        <small class="token-usage__live-status">
          {{ liveStatus }}<template v-if="updatedAt"> · Consultado às {{ clock.format(updatedAt) }} (Brasília)</template>
        </small>
      </div>
    </header>
    <q-form class="token-usage__filters" @submit.prevent="load(1, true)">
      <q-input v-model="filters.from" dark outlined dense stack-label label="De" type="date" required />
      <q-input v-model="filters.to" dark outlined dense stack-label label="Até" type="date" required />
      <q-select v-model="filters.source" dark outlined dense emit-value map-options clearable :options="sourceOptions" label="Origem do uso" />
      <q-select v-model="filters.provider" dark outlined dense emit-value map-options clearable :options="providerOptions" label="Provedor" />
      <q-select v-model="filters.state" dark outlined dense emit-value map-options clearable :options="stateOptions" label="Estado da chamada" />
      <q-select v-model="filters.scope" dark outlined dense emit-value map-options :options="scopes" label="Tipo de carteira" />
      <q-select v-if="filters.scope === 'project'" v-model="filters.projectId" dark outlined dense emit-value map-options clearable :options="projects" label="Projeto" />
      <q-select v-if="filters.scope === 'product'" v-model="filters.productType" dark outlined dense emit-value map-options clearable :options="products" label="Produto" />
      <q-input v-if="filters.scope === 'product'" v-model.trim="filters.licenseId" dark outlined dense clearable label="ID da licença" />
      <q-select v-if="filters.scope !== 'embedded'" v-model="filters.clientId" dark outlined dense emit-value map-options clearable :options="clients" label="Cliente" />
      <q-input v-model.trim="filters.model" dark outlined dense clearable label="Modelo exato" />
      <q-input v-model.trim="filters.feature" dark outlined dense clearable label="Recurso" />
      <q-input v-model.trim="filters.requestId" dark outlined dense clearable maxlength="160" label="ID da requisição ou do provedor" />
      <q-btn unelevated no-caps type="submit" color="teal-7" icon="mdi-filter-variant" label="Aplicar filtros" :loading="loading" />
    </q-form>
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <template v-if="summary">
      <div class="token-usage__metrics">
        <article v-for="metric in metrics" :key="metric.label" class="token-usage__metric">
          <q-icon :name="metric.icon" size="22px" aria-hidden="true" />
          <span>{{ metric.label }}</span>
          <strong>{{ money(metric.usd) }}</strong>
          <small>{{ money(metric.brl, reais) }}</small>
        </article>
      </div>
      <div v-if="providerShare !== null" class="token-usage__split">
        <div class="token-usage__split-track" aria-hidden="true"><span :style="{ width: providerShare + '%' }"></span></div>
        <div class="token-usage__split-labels"><span>Provedores {{ numbers.format(Math.round(providerShare)) }}%</span><span>Margem bruta {{ numbers.format(100 - Math.round(providerShare)) }}%</span></div>
      </div>
      <section v-if="providerTotals.length" class="token-usage__providers" aria-label="Consumo por provedor">
        <article v-for="row in providerTotals" :key="row.provider" class="token-usage__metric">
          <div class="token-usage__provider-head">
            <h4>{{ providerName(row.provider) }}</h4>
            <q-badge outline :color="row.provider === 'higgsfield' ? 'amber-4' : 'teal-3'" :label="`${numbers.format(row.requests || 0)} chamadas`" />
          </div>
          <dl class="token-usage__amounts">
            <div v-for="column in costColumns" :key="column.name">
              <dt>{{ column.label }}</dt>
              <dd>{{ money(row[column.field]) }}</dd>
              <dd>{{ money(row[column.brlField], reais) }}</dd>
            </div>
          </dl>
          <small v-if="row.provider === 'openai'">{{ numbers.format(row.inputTokens || 0) }} tokens de entrada · {{ numbers.format(row.outputTokens || 0) }} de saída · {{ numbers.format(row.cachedTokens || 0) }} de entrada em cache</small>
        </article>
      </section>
      <p v-if="summary.estimatedRequests" class="token-usage__note">{{ numbers.format(summary.estimatedRequests) }} chamadas têm custo ou conversão em reais estimados.</p>
      <q-table v-model:pagination="pagination" flat bordered dark wrap-cells row-key="rowKey" :rows="logs" :columns="logColumns"
        :rows-per-page-options="[pagination.rowsPerPage]" :loading="loading" class="token-usage__table" title="Logs por requisição"
        no-data-label="Nenhuma chamada encontrada." @request="load($event.pagination.page)"
      >
        <template #body-cell-state="props">
          <q-td :props="props"><q-badge outline :color="stateColors[props.row.state] || 'grey-4'" :label="props.value" /></q-td>
        </template>
        <template v-for="column in costColumns" :key="column.name" v-slot:[`body-cell-${column.name}`]="props">
          <q-td :props="props">
            <span class="token-usage__usd">{{ props.row.state === 'applied' ? money(props.value) : '—' }}</span>
            <small v-if="props.row.state === 'applied'" class="token-usage__brl">{{ money(props.row[column.brlField], reais) }}</small>
          </q-td>
        </template>
        <template #body-cell-details="props">
          <q-td :props="props">
            <q-btn flat dense no-caps color="teal-3" icon="mdi-text-box-search-outline" label="Abrir" @click="selectedLog = props.row" />
            <q-btn v-if="props.row.state === 'reconciliation'" flat dense no-caps color="amber-4" label="Conciliar" @click="reviewReconciliation(props.row)" />
          </q-td>
        </template>
      </q-table>
      <q-table flat bordered dark wrap-cells row-key="rowKey" :rows="groups" :columns="groupColumns"
        :rows-per-page-options="[10, 25, 50]" class="token-usage__table" title="Maiores custos por origem e modelo" no-data-label="Nenhum consumo no período."
      >
        <template v-for="column in costColumns" :key="column.name" v-slot:[`body-cell-${column.name}`]="props">
          <q-td :props="props">
            <span class="token-usage__usd">{{ money(props.value) }}</span>
            <small class="token-usage__brl">{{ money(props.row[column.brlField], reais) }}</small>
          </q-td>
        </template>
      </q-table>
      <section class="token-usage__box" aria-labelledby="token-forecast-title">
        <div class="token-usage__forecast-head">
          <div>
            <h4 id="token-forecast-title">Reserva para os créditos em circulação</h4>
            <p>Estimativa do custo se o saldo disponível for consumido. Informe o saldo nos provedores para calcular a diferença.</p>
          </div>
          <q-form class="token-usage__reserve-input" @submit.prevent="load(1, true)">
            <q-input v-model="filters.providerBalance" dark outlined dense clearable label="Saldo total nos provedores" prefix="US$" type="number" min="0" step="0.01" />
            <q-btn flat no-caps color="teal-3" type="submit" label="Calcular" :loading="loading" />
          </q-form>
        </div>
        <dl class="token-usage__forecast">
          <div v-for="item in forecast" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ money(item.value) }}</dd>
            <dd v-if="typeof item.value === 'number' && exchangeRate?.rate" class="token-usage__conversion">{{ money(item.value * exchangeRate.rate, reais) }} à cotação atual</dd>
          </div>
        </dl>
        <details>
          <summary>Simular o custo do provedor</summary>
          <div class="token-usage__reserve-input">
            <q-input v-model="simulatedCost" dark outlined dense label="Custo do provedor" prefix="US$" type="number" min="0" max="10000" step="0.01" />
            <p>Consumo equivalente <strong>{{ money(2 * simulatedCents) }}</strong> · Margem bruta <strong>{{ money(simulatedCents) }}</strong></p>
          </div>
        </details>
        <p class="token-usage__note">Recargas seguem o período e as carteiras selecionados. A reserva considera o saldo atual das carteiras. A margem bruta considera o uso, antes de taxas de pagamento e impostos.</p>
      </section>
    </template>
    <q-linear-progress v-else-if="loading" indeterminate color="teal-4" aria-label="Carregando consumo" />
    <q-dialog :model-value="Boolean(selectedLog)" @update:model-value="!$event && (selectedLog = null)">
      <q-card v-if="selectedLog" dark class="token-usage__details">
        <q-card-section class="token-usage__header">
          <div>
            <h4>Detalhes da requisição</h4>
            <q-badge outline :color="stateColors[selectedLog.state] || 'grey-4'" :label="logStates[selectedLog.state] || selectedLog.state" />
          </div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar detalhes" v-close-popup />
        </q-card-section>
        <q-card-section>
          <dl class="token-usage__metadata">
            <div v-for="item in selectedDetails" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
            <template v-if="selectedLog.inputTokens || selectedLog.outputTokens">
              <div><dt>Tokens de entrada</dt><dd>{{ numbers.format(selectedLog.inputTokens || 0) }}</dd></div>
              <div><dt>Tokens de saída</dt><dd>{{ numbers.format(selectedLog.outputTokens || 0) }}</dd></div>
              <div><dt>Tokens de entrada em cache</dt><dd>{{ numbers.format(selectedLog.cachedTokens || 0) }}</dd></div>
            </template>
            <div v-if="selectedLog.quantity != null"><dt>Uso do provedor</dt><dd>{{ formatProviderUsage(selectedLog) }}</dd></div>
          </dl>
          <dl v-if="selectedLog.state === 'applied'" class="token-usage__amounts">
            <div v-for="column in costColumns" :key="column.name">
              <dt>{{ column.label }}</dt>
              <dd>{{ money(selectedLog[column.field]) }}</dd>
              <dd>{{ money(selectedLog[column.brlField], reais) }}</dd>
            </div>
          </dl>
          <p v-if="selectedLog.providerCostEstimated" class="token-usage__note">Custo do provedor estimado.</p>
          <p v-if="selectedLog.fxEstimated" class="token-usage__note">Conversão para reais estimada pela cotação atual.</p>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="Boolean(reconciliation)" :persistent="reconciliationBusy" @update:model-value="!$event && (reconciliation = null)">
      <q-card dark class="token-usage__reconciliation">
        <q-form @submit.prevent="requestReconciliationMfa">
          <q-card-section>
            <h4>Conciliar reserva AitoIA</h4>
            <p>Reserva de {{ money(reconciliation?.reservedUsdCents) }}. Informe o custo confirmado com {{ providerName(reconciliation?.provider) }}. Use zero se o provedor confirmou que a chamada foi gratuita.</p>
            <q-input v-model="reconciliationCost" dark outlined label="Custo confirmado pelo provedor" prefix="US$" type="number" min="0" max="1000" step="0.000001" required />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" v-close-popup :disable="reconciliationBusy" />
            <q-btn unelevated no-caps color="teal-7" type="submit" label="Confirmar por e-mail" :loading="reconciliationBusy" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <LoginMfaDialog v-model="mfaOpen" :challenge="challenge" @verified="applyReconciliation" />
  </section>
</template>

<style scoped>
.token-usage { display: grid; gap: 1rem; }
.token-usage__header, .token-usage__provider-head { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: .65rem 1rem; }
.token-usage__live { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 0 .4rem; }
.token-usage__live-status { flex-basis: 100%; text-align: right; color: #c2d9d3; }
.token-usage__reconciliation { width: min(31rem, 94vw); }
.token-usage__details { width: min(48rem, 94vw); max-width: 94vw; border: 1px solid #345857; background: #0c2022; }
.token-usage h3, .token-usage h4 { margin: 0; color: #edfff8; font-weight: 700; line-height: 1.3; }
.token-usage__details h4 { margin-bottom: .45rem; }
.token-usage h3 { font-size: 1.3rem; }
.token-usage h4 { font-size: 1.1rem; }
.token-usage p { margin: .4rem 0; color: #c2d9d3; }
.token-usage__filters, .token-usage__metrics, .token-usage__forecast { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr)); gap: .7rem; }
.token-usage__providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: .7rem; }
.token-usage__metric, .token-usage__box, .token-usage__table { border: 1px solid #345857; background: #0c2022; }
.token-usage__table { max-width: 100%; }
.token-usage__metric, .token-usage__box { border-radius: .8rem; padding: 1rem; }
.token-usage__metric { display: grid; gap: .32rem; align-content: start; }
.token-usage__metric strong { overflow-wrap: anywhere; }
.token-usage__metric .q-icon { color: #91f4d6; }
.token-usage__metric span, .token-usage__forecast dt { color: #c2d9d3; }
.token-usage__metric strong, .token-usage__forecast dd { color: #edfff8; font-weight: 700; }
.token-usage__metric strong { font-size: clamp(1.13rem, 2.5vw, 1.6rem); }
.token-usage__metric small, .token-usage__note { color: #c2d9d3; font-size: .85rem; }
.token-usage__amounts, .token-usage__metadata { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 125px), 1fr)); gap: .65rem; margin: .55rem 0; }
.token-usage__metadata { grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr)); margin: 0 0 1rem; }
.token-usage__amounts div, .token-usage__metadata div { min-width: 0; }
.token-usage__amounts dt, .token-usage__metadata dt { color: #c2d9d3; font-size: .8rem; }
.token-usage__amounts dd, .token-usage__metadata dd { margin: 0; overflow-wrap: anywhere; color: #edfff8; font-variant-numeric: tabular-nums; }
.token-usage__amounts dd:first-of-type { font-weight: 700; }
.token-usage__amounts dd + dd, .token-usage__brl { color: #c2d9d3; }
.token-usage__usd, .token-usage__brl { display: block; white-space: nowrap; font-variant-numeric: tabular-nums; }
.token-usage__split-track { height: .65rem; overflow: hidden; border-radius: .5rem; background: #e0ba62; }
.token-usage__split-track span { display: block; height: 100%; background: #65cdb0; }
.token-usage__split-labels { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .3rem .7rem; margin-top: .3rem; color: #c2d9d3; font-size: .85rem; }
.token-usage__forecast-head, .token-usage__reserve-input { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
.token-usage__forecast-head { justify-content: space-between; gap: 1rem; }
.token-usage__forecast-head > div { flex: 1 1 320px; }
.token-usage__forecast dd { margin: .15rem 0 0; font-size: 1.18rem; }
.token-usage__forecast .token-usage__conversion { font-size: .8rem; font-weight: 400; color: #c2d9d3; }
.token-usage details { border-top: 1px solid #345857; padding-block: .65rem; }
.token-usage summary { cursor: pointer; color: #91f4d6; font-weight: 700; }
.token-usage details .token-usage__reserve-input { margin-top: .65rem; }
@media (max-width: 560px) {
  .token-usage__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .token-usage__metric { padding: .7rem; }
  .token-usage__live { justify-content: flex-start; }
  .token-usage__live-status { text-align: left; }
}
</style>
