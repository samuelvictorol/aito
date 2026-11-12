<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate } from 'src/services/purchase-history'
import LoginMfaDialog from './LoginMfaDialog.vue'

const emit = defineEmits(['reauthenticated'])
const $q = useQuasar()

const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
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
const loading = ref(false)
const error = ref('')
const summary = ref(null)
const exchangeRate = ref(null)
const groups = ref([])
const logs = ref([])
const projects = ref([])
const clients = ref([])
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })
const simulatedCost = ref('')
const reconciliation = ref(null)
const reconciliationCost = ref('')
const reconciliationBusy = ref(false)
const challenge = ref(null)
const mfaOpen = ref(false)
let controller
let submitted
let verifiedDecision

const numbers = new Intl.NumberFormat('pt-BR')
const dollars = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 })
const money = (value, format = dollars) => typeof value === 'number' && Number.isFinite(value) ? format.format(value / 100) : '—'
const formatTokens = row => numbers.format((row.inputTokens || 0) + (row.outputTokens || 0))
const productName = value => products.find(product => product.value === value)?.label || value || 'Produto'
const providerName = value => value === 'higgsfield' ? 'Higgsfield' : 'OpenAI'
const subject = row => row.title || (row.scope === 'embedded' ? 'Aito Comunicação' : row.scope === 'project' ? 'Projeto' : productName(row.productType))
const combinedColumns = [
  { name: 'subject', label: 'Origem', field: subject, align: 'left' },
  { name: 'license', label: 'Licença', field: row => row.licenseId || '—', align: 'left' },
  { name: 'client', label: 'Cliente', field: row => row.clientName || '—', align: 'left' },
  { name: 'model', label: 'Modelo', field: row => row.model || '—', align: 'left' },
  { name: 'service', label: 'Provedor', field: row => providerName(row.provider), align: 'left' },
]
const costColumns = [
  { name: 'billed', label: 'Consumo AitoTokens', field: row => money(row.billedUsdCents) },
  { name: 'provider', label: 'Custo do provedor', field: row => money(row.providerUsdCents) },
  { name: 'margin', label: 'Margem bruta', field: row => money(row.marginUsdCents) },
]
const logStates = { applied: 'Concluída', reserved: 'Em processamento', released: 'Reserva liberada', reconciliation: 'Conciliação pendente' }
const groupColumns = [...combinedColumns, { name: 'requests', label: 'Chamadas', field: row => numbers.format(row.requests || 0) }, { name: 'tokens', label: 'Tokens', field: formatTokens }, ...costColumns]
const logColumns = [
  { name: 'date', label: 'Horário', field: row => purchaseDate(row.createdAt), align: 'left' },
  ...combinedColumns,
  { name: 'feature', label: 'Recurso', field: row => row.feature || '—', align: 'left' },
  { name: 'state', label: 'Estado', field: row => logStates[row.state] || row.state || '—', align: 'left' },
  { name: 'input', label: 'Entrada', field: row => numbers.format(row.inputTokens || 0) },
  { name: 'output', label: 'Saída', field: row => numbers.format(row.outputTokens || 0) },
  ...costColumns,
  { name: 'reconciliation', label: 'Conciliação', field: row => row.state, align: 'right' },
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

function currentParams() {
  const { from, to, scope, projectId, productType, licenseId, clientId, model, feature, providerBalance } = filters
  const providerBalanceUsdCents = providerBalance === '' || providerBalance == null ? undefined : Math.round(Number(providerBalance) * 100)
  return {
    from, to, scope,
    projectId: scope === 'project' ? projectId || undefined : undefined,
    productType: scope === 'product' ? productType || undefined : undefined,
    licenseId: scope === 'product' ? licenseId?.trim() || undefined : undefined,
    clientId: scope === 'embedded' ? undefined : clientId || undefined,
    model: model?.trim() || undefined,
    feature: feature?.trim() || undefined,
    providerBalanceUsdCents,
  }
}

async function load(page = 1, applyFilters = false) {
  if (applyFilters || !submitted) {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      error.value = 'Informe um período válido.'
      return
    }
    submitted = currentParams()
  }
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const { rowsPerPage } = pagination.value
    const { data } = await api.get('/aito-tokens/admin/usage', {
      ...financeHeaders(true), signal: request.signal,
      params: { ...submitted, offset: (page - 1) * rowsPerPage },
    })
    if (request.signal.aborted) return
    const result = data.data
    summary.value = result.summary
    exchangeRate.value = result.exchangeRate
    groups.value = result.groups.map((row, index) => ({ ...row, rowKey: index }))
    logs.value = result.logs.map((row, index) => ({ ...row, rowKey: row.id || row._id || index }))
    pagination.value = { page, rowsPerPage: result.limit, rowsNumber: result.total }
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível consultar o consumo.'
  } finally {
    if (controller === request) loading.value = false
  }
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
})
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="token-usage" aria-labelledby="token-usage-title">
    <header>
      <h3 id="token-usage-title">Uso de IA</h3>
      <p>Compare o consumo por cliente, projeto, produto e modelo.</p>
    </header>
    <q-form class="token-usage__filters" @submit.prevent="load(1, true)">
      <q-input v-model="filters.from" dark outlined dense stack-label label="De" type="date" required />
      <q-input v-model="filters.to" dark outlined dense stack-label label="Até" type="date" required />
      <q-select v-model="filters.scope" dark outlined dense emit-value map-options :options="scopes" label="Origem do uso" />
      <q-select v-if="filters.scope === 'project'" v-model="filters.projectId" dark outlined dense emit-value map-options clearable :options="projects" label="Projeto" />
      <q-select v-if="filters.scope === 'product'" v-model="filters.productType" dark outlined dense emit-value map-options clearable :options="products" label="Produto" />
      <q-input v-if="filters.scope === 'product'" v-model.trim="filters.licenseId" dark outlined dense clearable label="ID da licença" />
      <q-select v-if="filters.scope !== 'embedded'" v-model="filters.clientId" dark outlined dense emit-value map-options clearable :options="clients" label="Cliente" />
      <q-input v-model.trim="filters.model" dark outlined dense clearable label="Modelo exato" />
      <q-input v-model.trim="filters.feature" dark outlined dense clearable label="Recurso" />
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
      <p class="token-usage__note">{{ numbers.format(summary.requests || 0) }} chamadas · {{ numbers.format(summary.inputTokens || 0) }} tokens de entrada · {{ numbers.format(summary.outputTokens || 0) }} tokens de saída.</p>
      <p v-if="summary.estimatedRequests" class="token-usage__note">{{ numbers.format(summary.estimatedRequests) }} chamadas antigas convertidas para reais pela cotação atual.</p>
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
        <p class="token-usage__note">Margem bruta de uso, antes de taxas de pagamento e impostos. Créditos concedidos podem ser consumidos sem gerar uma recarga paga.</p>
      </section>
      <q-table flat bordered dark wrap-cells row-key="rowKey" :rows="groups" :columns="groupColumns"
        :rows-per-page-options="[10, 25, 50]" class="token-usage__table" title="Maiores custos por origem e modelo" no-data-label="Nenhum consumo no período."
      />
      <q-table v-model:pagination="pagination" flat bordered dark wrap-cells row-key="rowKey" :rows="logs" :columns="logColumns"
        :rows-per-page-options="[pagination.rowsPerPage]" :loading="loading" class="token-usage__table" title="Logs de consumo"
        no-data-label="Nenhuma chamada encontrada." @request="load($event.pagination.page)"
      >
        <template #body-cell-reconciliation="props">
          <q-td :props="props">
            <q-btn v-if="props.row.origin === 'web' && props.row.state === 'reconciliation'" flat dense no-caps color="amber-4" label="Conciliar" @click="reviewReconciliation(props.row)" />
          </q-td>
        </template>
      </q-table>
    </template>
    <q-linear-progress v-else-if="loading" indeterminate color="teal-4" aria-label="Carregando consumo" />
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
.token-usage__reconciliation { width: min(31rem, 94vw); }
.token-usage h3, .token-usage h4 { margin: 0; color: #edfff8; font-weight: 700; line-height: 1.3; }
.token-usage h3 { font-size: 1.3rem; }
.token-usage h4 { font-size: 1.1rem; }
.token-usage p { margin: .4rem 0; color: #c2d9d3; }
.token-usage__filters, .token-usage__metrics, .token-usage__forecast { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr)); gap: .7rem; }
.token-usage__metric, .token-usage__box, .token-usage__table { border: 1px solid #345857; background: #0c2022; }
.token-usage__metric, .token-usage__box { border-radius: .8rem; padding: 1rem; }
.token-usage__metric { display: grid; gap: .32rem; align-content: start; }
.token-usage__metric strong { overflow-wrap: anywhere; }
.token-usage__metric .q-icon { color: #91f4d6; }
.token-usage__metric span, .token-usage__forecast dt { color: #c2d9d3; }
.token-usage__metric strong, .token-usage__forecast dd { color: #edfff8; font-weight: 700; }
.token-usage__metric strong { font-size: clamp(1.13rem, 2.5vw, 1.6rem); }
.token-usage__metric small, .token-usage__note { color: #c2d9d3; font-size: .85rem; }
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
}
</style>
