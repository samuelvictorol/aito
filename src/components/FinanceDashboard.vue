<template>
  <section class="finance-dashboard">
    <div class="finance-dashboard__head">
      <div><span class="finance-dashboard__eyebrow">Financeiro</span><h2>{{ title }}</h2></div>
      <q-btn flat round icon="mdi-refresh" aria-label="Atualizar financeiro" :loading="loading" @click="load"><q-tooltip>Atualizar</q-tooltip></q-btn>
    </div>

    <div class="finance-dashboard__stats">
      <article><span>Total</span><strong>{{ totalNativeText }}</strong><small>{{ totalConversionText }}</small></article>
      <article><span>Projecao recorrente · proximo mes</span><strong>{{ projectionNativeText }}</strong><small>{{ projectionConversionText }}</small></article>
      <article><span>Cotação USD/BRL</span><strong>US$ 1 = {{ money(exchangeRate, 'BRL') }}</strong><small>{{ exchangeLabel }}</small></article>
    </div>

    <div v-if="activeFilter" class="finance-dashboard__filter">
      <q-chip removable color="teal-3" text-color="dark" icon="mdi-filter-outline" @remove="clearFilter">{{ activeFilter }}</q-chip>
      <span>{{ filteredCosts.length }} lancamento(s) neste recorte</span>
    </div>

    <div class="finance-dashboard__charts" :class="{ 'finance-dashboard__charts--single': !admin }">
      <CostChart v-if="admin" title="Custos por moeda · base em R$" :labels="currencyLabels" :values="currencyValues" :colors="['#13bc9d', '#8fffee']" @select="toggleCurrencyFilter" />
      <CostChart v-if="admin" title="Conversao e projecao · base em R$" type="bar" :labels="conversionLabels" :values="conversionValues" :colors="['#50dcc4', '#23917d', '#8fffee', '#12ad89']" />
      <CostChart v-else title="Custos por recorrencia · base em R$" :labels="typeLabels" :values="typeValues" :colors="['#13bc9d', '#8fffee', '#23917d', '#50dcc4', '#12ad89', '#1fb694']" @select="toggleTypeFilter" />
    </div>

    <q-table flat bordered wrap-cells class="finance-dashboard__table" row-key="_id" :rows="filteredCosts" :columns="columns" :loading="loading" no-data-label="Nenhum custo encontrado">
      <template #body-cell-description="props"><q-td :props="props"><span class="finance-dashboard__description">{{ preview(props.row.description) }}</span></q-td></template>
      <template #body-cell-amount="props"><q-td :props="props">{{ money(props.row.amount, props.row.currency) }}</q-td></template>
      <template #body-cell-date="props"><q-td :props="props">{{ formatDate(props.row.date) }}</q-td></template>
      <template #body-cell-status="props"><q-td :props="props"><span class="finance-dashboard__tag">{{ statusLabel(props.row.status) }}</span></q-td></template>
      <template #body-cell-type="props"><q-td :props="props">{{ typeLabel(props.row.type) }}</q-td></template>
      <template #body-cell-attachment="props"><q-td :props="props"><a v-if="props.row.attachment" :href="props.row.attachment.url" target="_blank" rel="noopener noreferrer" class="finance-dashboard__link"><q-icon name="mdi-paperclip" /> Abrir</a><span v-else>-</span></q-td></template>
      <template #body-cell-actions="props"><q-td :props="props"><q-btn flat round dense icon="mdi-eye-outline" aria-label="Ver descricao do custo" @click="openDetails(props.row)"><q-tooltip>Ver detalhes</q-tooltip></q-btn></q-td></template>
    </q-table>

    <q-dialog v-model="detailDialog">
      <q-card class="finance-dashboard__dialog">
        <q-card-section class="finance-dashboard__dialog-head"><div><span class="finance-dashboard__eyebrow">Detalhes do custo</span><h3>{{ selectedDetail.title || 'Custo' }}</h3></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="detailDialog = false" /></q-card-section>
        <q-card-section class="finance-dashboard__detail-body"><p>{{ selectedDetail.description || 'Sem descricao cadastrada.' }}</p><div><span>Valor</span><strong>{{ money(selectedDetail.amount, selectedDetail.currency) }}</strong></div></q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import CostChart from './CostChart.vue'

const props = defineProps({
  title: { type: String, default: '' },
  admin: { type: Boolean, default: false },
  projectId: { type: String, default: '' },
})

const $q = useQuasar()
const loading = ref(false)
const costs = ref([])
const summary = ref({ count: 0, exchangeRate: {}, byCurrency: [], byType: [], projection: {} })
const detailDialog = ref(false)
const selectedDetail = ref({})
const currencyFilter = ref('')
const typeFilter = ref('')
const token = localStorage.getItem(props.admin ? 'aito_admin_token' : 'aito_user_token')
const headers = { headers: { Authorization: `Bearer ${token}` } }
const costsPath = props.admin ? '/admin/costs' : '/costs'
const summaryPath = props.admin ? '/admin/costs/summary' : '/costs/summary'
const typeNames = { single: 'Unico', monthly: 'Mensal', bimonthly: 'Bimestral', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }
const statusNames = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' }
const projectionFactors = { single: 0, monthly: 1, bimonthly: 0.5, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12 }
const columns = [
  { name: 'title', label: 'Titulo', field: 'title', align: 'left' },
  { name: 'project', label: 'Projeto/curso', field: 'project', align: 'left' },
  { name: 'description', label: 'Descricao', field: 'description', align: 'left' },
  { name: 'amount', label: 'Valor', field: 'amount', align: 'right' },
  { name: 'type', label: 'Tipo', field: 'type', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'date', label: 'Data', field: 'date', align: 'left' },
  { name: 'attachment', label: 'Anexo', field: 'attachment', align: 'left' },
  { name: 'actions', label: '', align: 'right' },
]

const exchangeRate = computed(() => Number(summary.value.exchangeRate?.rate || 5))
const filteredCosts = computed(() => costs.value.filter((cost) => {
  const matchesCurrency = !currencyFilter.value || String(cost.currency || 'BRL').toUpperCase() === currencyFilter.value
  const matchesType = !typeFilter.value || cost.type === typeFilter.value
  return matchesCurrency && matchesType
}))
const financials = computed(() => calculateFinancials(filteredCosts.value, exchangeRate.value))
const currencyEntries = computed(() => financials.value.byCurrency)
const currencyLabels = computed(() => currencyEntries.value.map((item) => item.currency === 'USD' ? 'Dolar (USD)' : 'Real (BRL)'))
const currencyValues = computed(() => currencyEntries.value.map((item) => item.valueInBRL))
const conversionEntries = computed(() => {
  const entries = []
  const selected = currencyFilter.value
  if (!selected || selected === 'BRL') {
    entries.push({ label: 'Atual (R$)', value: financials.value.totalInBRL })
    entries.push({ label: 'Prox. mes (R$)', value: financials.value.projection.nextMonthInBRL })
  }
  if (!selected || selected === 'USD') {
    entries.push({ label: 'Atual (US$)', value: financials.value.totalInUSD * exchangeRate.value })
    entries.push({ label: 'Prox. mes (US$)', value: financials.value.projection.nextMonthInUSD * exchangeRate.value })
  }
  return entries
})
const conversionLabels = computed(() => conversionEntries.value.map((item) => item.label))
const conversionValues = computed(() => conversionEntries.value.map((item) => item.value))
const typeEntries = computed(() => financials.value.byType)
const typeLabels = computed(() => typeEntries.value.map((item) => typeNames[item.label] || item.label))
const typeValues = computed(() => typeEntries.value.map((item) => item.valueInBRL))
const totalNativeText = computed(() => formatNativeGroups(financials.value.byCurrency))
const totalConversionText = computed(() => `Conversao: ${money(financials.value.totalInBRL, 'BRL')} · ${money(financials.value.totalInUSD, 'USD')}`)
const projectionNativeText = computed(() => formatNativeGroups(financials.value.projection.byCurrency))
const projectionConversionText = computed(() => `Conversao: ${money(financials.value.projection.nextMonthInBRL, 'BRL')} · ${money(financials.value.projection.nextMonthInUSD, 'USD')}`)
const activeFilter = computed(() => {
  if (currencyFilter.value) return `Moeda: ${currencyFilter.value === 'USD' ? 'Dolar (USD)' : 'Real (BRL)'}`
  if (typeFilter.value) return `Tipo: ${typeNames[typeFilter.value] || typeFilter.value}`
  return ''
})
const exchangeLabel = computed(() => {
  const quote = summary.value.exchangeRate
  const date = quote?.date ? formatDate(quote.date) : 'sem data'
  const freshness = quote?.stale ? 'Último valor disponível' : `Atualizado em ${date}`
  return `${freshness} · ${quote?.autoRefresh === false ? 'cotação manual' : 'busca diária'}`
})

function calculateFinancials(items, rate) {
  const byCurrency = { BRL: emptyCurrency('BRL'), USD: emptyCurrency('USD') }
  const byType = {}
  const projectionByCurrency = { BRL: emptyCurrency('BRL'), USD: emptyCurrency('USD') }
  let totalInBRL = 0
  let totalInUSD = 0
  let nextMonthInBRL = 0
  let nextMonthInUSD = 0

  items.forEach((cost) => {
    const amount = Number(cost.amount || 0)
    const currency = String(cost.currency || 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL'
    const converted = convertAmount(amount, currency, rate)
    const factor = cost.status === 'inactive' ? 0 : (projectionFactors[cost.type] || 0)
    byCurrency[currency].value += amount
    byCurrency[currency].valueInBRL += converted.valueInBRL
    byCurrency[currency].valueInUSD += converted.valueInUSD
    totalInBRL += converted.valueInBRL
    totalInUSD += converted.valueInUSD
    if (!byType[cost.type]) byType[cost.type] = { label: cost.type, valueInBRL: 0, valueInUSD: 0 }
    byType[cost.type].valueInBRL += converted.valueInBRL
    byType[cost.type].valueInUSD += converted.valueInUSD
    if (factor > 0) {
      const projected = convertAmount(amount * factor, currency, rate)
      projectionByCurrency[currency].value += amount * factor
      projectionByCurrency[currency].valueInBRL += projected.valueInBRL
      projectionByCurrency[currency].valueInUSD += projected.valueInUSD
      nextMonthInBRL += projected.valueInBRL
      nextMonthInUSD += projected.valueInUSD
    }
  })

  return {
    byCurrency: Object.values(byCurrency).filter((item) => item.value > 0),
    byType: Object.values(byType),
    totalInBRL,
    totalInUSD,
    projection: { nextMonthInBRL, nextMonthInUSD, byCurrency: Object.values(projectionByCurrency).filter((item) => item.value > 0) },
  }
}

function emptyCurrency(currency) { return { currency, value: 0, valueInBRL: 0, valueInUSD: 0 } }
function convertAmount(amount, currency, rate) { return currency === 'USD' ? { valueInBRL: amount * rate, valueInUSD: amount } : { valueInBRL: amount, valueInUSD: amount / rate } }
function money(value, currency = 'BRL') { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value || 0)) }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('pt-BR') : '-' }
function formatNativeGroups(entries) { return entries.length ? entries.map((item) => money(item.value, item.currency)).join(' + ') : money(0, 'BRL') }
function typeLabel(value) { return typeNames[value] || value || '-' }
function statusLabel(value) { return statusNames[value] || value || '-' }
function preview(value) { const text = String(value || '').trim(); return text.length > 48 ? `${text.slice(0, 48)}...` : text || '-' }
function openDetails(row) { selectedDetail.value = row; detailDialog.value = true }
function toggleCurrencyFilter({ label }) { const next = String(label || '').includes('USD') ? 'USD' : 'BRL'; currencyFilter.value = currencyFilter.value === next ? '' : next; typeFilter.value = '' }
function toggleTypeFilter({ label }) { const next = Object.entries(typeNames).find(([, name]) => name === label)?.[0] || ''; typeFilter.value = typeFilter.value === next ? '' : next; currencyFilter.value = '' }
function clearFilter() { currencyFilter.value = ''; typeFilter.value = '' }

async function load() {
  if (!token) return
  loading.value = true
  try {
    const params = props.projectId ? { projectId: props.projectId } : undefined
    const [costResponse, summaryResponse] = await Promise.all([api.get(costsPath, { ...headers, params }), api.get(summaryPath, { ...headers, params })])
    costs.value = costResponse.data.data || []
    summary.value = summaryResponse.data.data || summary.value
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel carregar o financeiro.' })
  } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-dashboard { display: grid; gap: 1rem; }
.finance-dashboard__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.finance-dashboard__eyebrow { color: #8fffee; font-size: .68rem; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
.finance-dashboard h2 { margin: .55rem 0 0; color: #effffb; font-size: clamp(1.5rem, 3vw, 2.5rem); }
.finance-dashboard__head .q-btn { color: #8fffee; }
.finance-dashboard__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; }
.finance-dashboard__stats article { display: grid; gap: .35rem; min-width: 0; padding: 1rem; border: 1px solid rgba(19,188,157,.22); border-radius: .65rem; background: rgba(4,24,25,.65); }
.finance-dashboard__stats span { color: rgba(229,255,250,.55); font-size: .68rem; }
.finance-dashboard__stats strong { overflow-wrap: anywhere; color: #8fffee; font-size: 1.15rem; }
.finance-dashboard__stats small { min-height: 1.1rem; color: rgba(229,255,250,.62); font-size: .67rem; line-height: 1.35; }
.finance-dashboard__filter { display: flex; align-items: center; gap: .7rem; color: rgba(229,255,250,.62); font-size: .72rem; }
.finance-dashboard__charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
.finance-dashboard__charts--single { grid-template-columns: minmax(0, 1fr); }
.finance-dashboard__table { color: #effffb; border-color: rgba(19,188,157,.2); background: rgba(3,16,18,.55); }
.finance-dashboard__table :deep(th) { color: #8fffee; font-size: .68rem; }
.finance-dashboard__table :deep(td) { color: rgba(239,255,251,.78); font-size: .72rem; }
.finance-dashboard__tag { padding: .25rem .45rem; border: 1px solid rgba(19,188,157,.28); border-radius: 999px; color: #8fffee; font-size: .62rem; }
.finance-dashboard__link { color: #8fffee; text-decoration: none; }
.finance-dashboard__description { display: inline-block; max-width: 18rem; white-space: normal; }
.finance-dashboard__dialog { width: min(94vw, 520px); color: #effffb; background: #061819; border: 1px solid rgba(19,188,157,.3); }
.finance-dashboard__dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .8rem; }
.finance-dashboard__dialog h3 { margin: .4rem 0 0; font-size: 1.15rem; }
.finance-dashboard__detail-body { display: grid; gap: .8rem; color: rgba(239,255,251,.82); }
.finance-dashboard__detail-body p { margin: 0; white-space: pre-wrap; line-height: 1.6; }
.finance-dashboard__detail-body div { display: flex; justify-content: space-between; gap: 1rem; padding-top: .7rem; border-top: 1px solid rgba(143,255,238,.1); }
.finance-dashboard__detail-body span { color: rgba(229,255,250,.58); }
@media (max-width: 700px) { .finance-dashboard__stats, .finance-dashboard__charts { grid-template-columns: 1fr; } .finance-dashboard__table { max-width: calc(100vw - 2rem); overflow: auto; } .finance-dashboard__filter { align-items: flex-start; flex-direction: column; gap: .35rem; } }
</style>
