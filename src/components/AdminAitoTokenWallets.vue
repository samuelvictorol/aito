<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate } from 'src/services/purchase-history'

const root = '/aito-tokens/admin/customer-wallets'
const pageSizes = [10, 25, 50, 100]
const numbers = new Intl.NumberFormat('pt-BR')
const moneyFormats = Object.fromEntries(['USD', 'BRL'].map(currency => [currency,
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 6 }),
]))
const formatMoney = (cents, currency = 'USD') => cents == null ? '—' : moneyFormats[currency].format(cents / 100)
const tokens = value => `${numbers.format(value || 0)} AitoTokens`
const historyTypes = { web: 'AitoIA Web', desktop: 'Desktop', cloud: 'Whitelabel', legacy: 'Licença legada' }
const statuses = { pending: 'Aguardando pagamento', paid: 'Pago', failed: 'Falhou', expired: 'Expirado', canceled: 'Cancelado' }
const origins = [
  { id: 'higgsfield', label: 'Higgsfield' }, { id: 'desktop', label: 'Desktop' },
  { id: 'whitelabel', label: 'Whitelabel' }, { id: 'codex', label: 'Codex' },
  { id: 'web', label: 'AitoIA Web' }, { id: 'other', label: 'Outras origens' },
]
const customer = ref(null)
const open = ref(false)
const search = ref('')
const selectedOrigins = computed(() => origins
  .filter(({ id }) => id !== 'other' || customer.value?.origins.other)
  .map(({ id, label }) => ({ id, label, ...customer.value?.origins[id] })))
const tableColumns = [
  { name: 'customer', label: 'Usuário', field: 'name', align: 'left' },
  { name: 'balance', label: 'Saldo atual', field: row => tokens(row.balanceAitoTokens), align: 'left' },
  { name: 'spent', label: 'Consumo acumulado', field: row => tokens(row.spentAitoTokens), align: 'left' },
  { name: 'profit', label: 'Lucro bruto registrado', field: row => formatMoney(row.marginUsdCents), align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]
const historyColumns = [
  { name: 'date', label: 'Data do pedido', field: row => purchaseDate(row.createdAt), align: 'left' },
  { name: 'wallet', label: 'Carteira', field: row => historyTypes[row.type] || 'Licença', align: 'left' },
  { name: 'usd', label: 'Créditos', field: row => formatMoney(row.usdCents), align: 'right' },
  { name: 'brl', label: 'Valor pago', field: row => formatMoney(row.brlCents, 'BRL'), align: 'right' },
  { name: 'status', label: 'Situação', field: row => row.unallocated ? 'Pago, sem crédito aplicado' : statuses[row.status] || row.status, align: 'left' },
  { name: 'paid', label: 'Confirmação', field: row => purchaseDate(row.paidAt), align: 'left' },
  { name: 'order', label: 'Pedido', field: 'orderNsu', align: 'left' },
]

function pagedTable() {
  const rows = ref([])
  const loading = ref(false)
  const error = ref('')
  const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })
  let request
  const cancel = () => request?.abort()

  async function load(path, params, page = pagination.value.page, rowsPerPage = pagination.value.rowsPerPage) {
    cancel()
    const current = new AbortController()
    request = current
    loading.value = true
    error.value = ''
    try {
      const { data: { data } } = await api.get(path, { ...financeHeaders(true), signal: current.signal,
        params: { ...params, offset: (page - 1) * rowsPerPage, limit: rowsPerPage } })
      if (current.signal.aborted) return
      rows.value = data.rows
      pagination.value = { page, rowsPerPage: data.limit, rowsNumber: data.total }
    } catch (cause) {
      if (!current.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar os registros.'
    } finally {
      if (request === current) loading.value = false
    }
  }
  onBeforeUnmount(cancel)
  return { rows, loading, error, pagination, load, cancel }
}

const { rows, loading, error, pagination, load } = pagedTable()
const { rows: history, loading: historyLoading, error: historyError, pagination: historyPagination,
  load: loadHistory, cancel: cancelHistory } = pagedTable()
const loadWallets = (page, size) => load(root, { q: search.value || undefined }, page, size)
const loadRecharges = (page, size) => {
  if (customer.value) loadHistory(`${root}/${customer.value.id}/recharges`, {}, page, size)
}

function showDetail(row) {
  customer.value = row
  history.value = []
  historyPagination.value = { page: 1, rowsPerPage: 10, rowsNumber: 0 }
  open.value = true
  loadRecharges(1)
}

function closeDetail() {
  cancelHistory()
  customer.value = null
}
onMounted(() => loadWallets(1))
</script>

<template>
  <section class="wallets">
    <div class="wallets__toolbar">
      <q-input v-model="search" clearable debounce="350" dark outlined dense label="Buscar por nome, e-mail ou telefone"
        @update:model-value="loadWallets(1)">
        <template #prepend><q-icon name="mdi-magnify" /></template>
      </q-input>
      <q-btn flat no-caps icon="mdi-refresh" label="Atualizar" :loading="loading" @click="loadWallets()" />
    </div>
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <q-table v-model:pagination="pagination" :rows="rows" :columns="tableColumns" :loading="loading"
      flat bordered dark row-key="id" :grid="$q.screen.lt.md" no-data-label="Nenhum usuário encontrado."
      :rows-per-page-options="pageSizes" rows-per-page-label="Registros por página"
      @request="loadWallets($event.pagination.page, $event.pagination.rowsPerPage)">
      <template #body-cell-customer="{ row }">
        <q-td><strong>{{ row.name }}</strong><small>{{ row.email || row.phone || '—' }}</small></q-td>
      </template>
      <template #body-cell-balance="{ row }">
        <q-td><strong>{{ tokens(row.balanceAitoTokens) }}</strong>
          <small>{{ formatMoney(row.balanceUsdCents) }} · {{ formatMoney(row.balanceBrlCents, 'BRL') }}</small>
        </q-td>
      </template>
      <template #body-cell-spent="{ row }">
        <q-td><strong>{{ tokens(row.spentAitoTokens) }}</strong><small>{{ formatMoney(row.spentUsdCents) }}</small></q-td>
      </template>
      <template #body-cell-profit="{ row }">
        <q-td><strong>{{ formatMoney(row.marginUsdCents) }}</strong><small>{{ formatMoney(row.marginBrlCents, 'BRL') }}</small></q-td>
      </template>
      <template #body-cell-actions="{ row }">
        <q-td class="text-right"><q-btn flat no-caps icon="mdi-wallet-outline" label="Detalhar" @click="showDetail(row)" /></q-td>
      </template>
      <template #item="{ row }">
        <div class="q-pa-xs col-xs-12 col-sm-6">
          <q-card flat bordered dark class="wallets__card">
            <q-card-section>
              <strong>{{ row.name }}</strong><small>{{ row.email || row.phone || '—' }}</small>
              <dl class="wallets__stats">
                <div><dt>Saldo atual</dt><dd>{{ tokens(row.balanceAitoTokens) }}</dd>
                  <dd>{{ formatMoney(row.balanceUsdCents) }} · {{ formatMoney(row.balanceBrlCents, 'BRL') }}</dd></div>
                <div><dt>Consumo acumulado</dt><dd>{{ tokens(row.spentAitoTokens) }}</dd></div>
                <div><dt>Lucro bruto</dt><dd>{{ formatMoney(row.marginUsdCents) }} · {{ formatMoney(row.marginBrlCents, 'BRL') }}</dd></div>
              </dl>
              <q-btn flat no-caps icon="mdi-wallet-outline" label="Detalhar" @click="showDetail(row)" />
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-table>
    <q-dialog v-model="open" @hide="closeDetail">
      <q-card v-if="customer" dark class="wallets__detail">
        <q-card-section class="row items-start justify-between no-wrap">
          <div>
            <h2 class="text-h6 q-my-none">{{ customer.name }}</h2>
            <small>{{ customer.email || customer.phone || '—' }}</small>
            <strong class="q-mt-sm block">{{ tokens(customer.balanceAitoTokens) }}</strong>
            <small>{{ formatMoney(customer.balanceUsdCents) }} · {{ formatMoney(customer.balanceBrlCents, 'BRL') }}</small>
          </div>
          <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar detalhes" />
        </q-card-section>
        <q-card-section>
          <h3>Consumo por origem</h3>
          <div class="wallets__origins">
            <div v-for="origin in selectedOrigins" :key="origin.id" class="wallets__card">
              <strong>{{ origin.label }}</strong><small>{{ numbers.format(origin.requests || 0) }} requisições</small>
              <dl class="wallets__stats">
                <div><dt>Consumo</dt><dd>{{ tokens(origin.spentAitoTokens) }}</dd>
                  <dd>{{ formatMoney(origin.spentUsdCents ?? 0) }} · {{ formatMoney(origin.spentBrlCents ?? 0, 'BRL') }}</dd></div>
                <div><dt>Custo dos provedores</dt><dd>{{ formatMoney(origin.requests ? origin.costUsdCents : 0) }}</dd></div>
                <div><dt>Lucro bruto</dt><dd>{{ formatMoney(origin.requests ? origin.marginUsdCents : 0) }}</dd></div>
              </dl>
            </div>
          </div>
          <p v-if="customer.marginUsdCents == null" class="q-my-sm">Há lançamentos antigos sem custo de provedor registrado.</p>
        </q-card-section>
        <q-card-section>
          <h3>Histórico de recargas</h3>
          <q-banner v-if="historyError" rounded class="bg-red-10 text-white" role="alert">{{ historyError }}</q-banner>
          <q-table v-model:pagination="historyPagination" :rows="history" :columns="historyColumns" :loading="historyLoading"
            flat bordered dark row-key="orderNsu" :grid="$q.screen.lt.sm" wrap-cells no-data-label="Nenhuma recarga registrada."
            :rows-per-page-options="pageSizes" rows-per-page-label="Registros por página"
            @request="loadRecharges($event.pagination.page, $event.pagination.rowsPerPage)" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.wallets { display: grid; gap: .75rem; min-width: 0; }
.wallets__toolbar { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.wallets__toolbar .q-field { flex: 1 1 16rem; max-width: 28rem; }
.wallets :deep(.q-table__container), .wallets__detail :deep(.q-table__container), .wallets__card {
  background: #0c2022; border-color: #345857;
}
.wallets__detail { width: min(900px, 100%); max-width: 94vw; background: #101920; }
.wallets__detail h3 { margin: 0 0 .75rem; font-size: 1rem; line-height: 1.35; font-weight: 700; }
small { display: block; color: #b7cecb; overflow-wrap: anywhere; }
.wallets__origins { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr)); gap: .65rem; }
.wallets__origins .wallets__card { padding: .7rem; border: 1px solid #345857; border-radius: .65rem; }
.wallets__stats { display: grid; gap: .5rem; margin: .6rem 0; }
.wallets__stats dt { font-size: .8rem; color: #b7cecb; }
.wallets__stats dd { margin: 0; }
.wallets__detail :deep(.q-table__grid-item-value) { overflow-wrap: anywhere; }
</style>
