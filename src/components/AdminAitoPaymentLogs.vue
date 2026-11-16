<template>
  <section class="payment-logs">
    <div class="payment-logs__header">
      <h2>Logs de pagamento</h2>
      <q-btn flat round dense icon="mdi-refresh" aria-label="Atualizar pagamentos" :loading="loading" @click="load()" />
    </div>

    <div class="payment-logs__filters">
      <q-input v-model="search" outlined dense clearable debounce="300" maxlength="120" label="Cliente, produto ou referência" />
      <q-select v-model="kind" outlined dense clearable emit-value map-options :options="kindOptions" label="Tipo de pagamento" />
      <q-select v-model="status" outlined dense clearable emit-value map-options :options="statusOptions" label="Status" />
      <q-input v-model="from" outlined dense type="date" stack-label label="De" />
      <q-input v-model="to" outlined dense type="date" stack-label label="Até" />
    </div>
    <q-banner v-if="error" dense class="bg-negative text-white q-mb-md" role="alert">{{ error }}</q-banner>
    <q-table
      v-model:pagination="pagination" flat bordered dark dense :rows="rows" :columns="columns" row-key="id"
      :loading="loading" :rows-per-page-options="[10, 25, 50, 100]" @request="load"
      no-data-label="Nenhum pagamento encontrado." rows-per-page-label="Registros por página"
    >
      <template #body-cell-customer="scope">
        <q-td :props="scope">
          <div>{{ scope.row.customer?.name || scope.row.customer?.email || '—' }}</div>
          <small v-if="scope.row.customer?.name && scope.row.customer?.email">{{ scope.row.customer.email }}</small>
        </q-td>
      </template>
      <template #body-cell-payment="scope">
        <q-td :props="scope">
          <div>{{ scope.row.title }}</div>
          <small>{{ paymentKind(scope.row) }}</small>
        </q-td>
      </template>
      <template #body-cell-status="scope">
        <q-td :props="scope">
          <q-badge outline :color="scope.row.status === 'paid' ? 'teal-4' : 'grey-5'">
            {{ statusLabel(scope.row.status) }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="scope">
        <q-td :props="scope">
          <q-btn flat dense no-caps color="teal-4" icon="mdi-eye-outline" label="Detalhar" @click="openDetail(scope.row)" />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="detailOpen" @hide="detailRequest?.abort()">
      <q-card class="payment-logs__detail">
        <q-card-section class="payment-logs__header">
          <h3>{{ detail?.title }}</h3>
          <q-btn v-close-popup round dense flat icon="mdi-close" aria-label="Fechar detalhes" />
        </q-card-section>
        <q-card-section v-if="detail" class="q-pt-none">
          <dl class="payment-logs__facts">
            <div><dt>Cliente</dt><dd>{{ detail.customer?.name || '—' }}</dd></div>
            <div><dt>E-mail</dt><dd>{{ detail.customer?.email || '—' }}</dd></div>
            <div><dt>Tipo</dt><dd>{{ paymentKind(detail) }}</dd></div>
            <div><dt>Status</dt><dd>{{ statusLabel(detail.status) }}</dd></div>
            <div><dt>Data e hora</dt><dd>{{ formatDate(detail.purchasedAt) }}</dd></div>
            <div><dt>Valor</dt><dd>{{ purchaseMoney(detail.amountCents, detail.currency) }}</dd></div>
            <div v-if="detail.kind === 'recharge'"><dt>Crédito</dt><dd>{{ purchaseMoney(detail.usdCents, 'USD') }}</dd></div>
            <div v-if="detail.unallocated"><dt>Carteira</dt><dd>Pagamento confirmado, crédito pendente de alocação</dd></div>
            <div><dt>Pedido</dt><dd>{{ detail.orderNsu || '—' }}</dd></div>
            <div><dt>Transação</dt><dd>{{ detail.transactionNsu || '—' }}</dd></div>
          </dl>
          <ul v-if="detail.products?.length > 1" class="q-pl-md">
            <li v-for="product in detail.products" :key="product.kind">{{ product.title }}</li>
          </ul>
          <q-btn
            v-if="safeReceiptUrl(detail.receiptUrl)" outline no-caps icon="mdi-receipt-text-outline" label="Abrir comprovante"
            :href="safeReceiptUrl(detail.receiptUrl)" target="_blank" rel="noopener noreferrer" color="teal-4"
          />
          <p v-else-if="!detailLoading" class="text-grey-5">Comprovante indisponível.</p>
          <q-separator class="q-my-md" />
          <h4>Webhook</h4>
          <q-linear-progress v-if="detailLoading" indeterminate color="teal-4" aria-label="Carregando detalhes do pagamento" />
          <q-banner v-else-if="detailError" dense class="bg-negative text-white" role="alert">{{ detailError }}</q-banner>
          <template v-else-if="detail.webhook">
            <p class="text-grey-5">Recebido em {{ formatDate(detail.webhook.receivedAt) }}</p>
            <pre v-if="detail.webhook.payload">{{ JSON.stringify(detail.webhook.payload, null, 2) }}</pre>
            <p v-else class="text-grey-5">Payload indisponível.</p>
          </template>
          <p v-else class="text-grey-5">Sem webhook registrado para este pagamento.</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders, purchaseKind, purchaseKinds, purchaseMoney, safeReceiptUrl } from 'src/services/purchase-history'

const endpoint = '/admin/finance/payment-logs'
const rows = ref([])
const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })
const search = ref('')
const kind = ref(null)
const status = ref(null)
const from = ref('')
const to = ref('')
const loading = ref(false)
const error = ref('')
const detailOpen = ref(false)
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
let listRequest
let detailRequest

const kindOptions = [{ label: 'Recarga AitoTokens', value: 'recharge' }, ...purchaseKinds]
const statusOptions = [
  { label: 'Pago', value: 'paid' }, { label: 'Pendente', value: 'pending' },
  { label: 'Gerando link', value: 'creating' }, { label: 'Expirado', value: 'expired' }, { label: 'Cancelado', value: 'cancelled' },
  { label: 'Recusado', value: 'declined' },
]
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const formatDate = value => value && Number.isFinite(Date.parse(value)) ? dateTime.format(new Date(value)) : '—'
const statusLabel = value => statusOptions.find(option => option.value === value)?.label || value || '—'
const paymentKind = row => row.kind === 'recharge'
  ? { web: 'Recarga · Carteira AitoIA', project: 'Recarga · AitoKey de projeto', product: 'Recarga · Licença' }[row.walletScope] || 'Recarga AitoTokens'
  : purchaseKind(row.kind)
const columns = [
  { name: 'customer', label: 'Cliente', align: 'left', field: 'customer' },
  { name: 'payment', label: 'Pagamento', align: 'left', field: 'title' },
  { name: 'amount', label: 'Valor', align: 'right', field: row => purchaseMoney(row.amountCents, row.currency) },
  { name: 'status', label: 'Status', align: 'center', field: 'status' },
  { name: 'date', label: 'Data e hora', align: 'left', field: row => formatDate(row.purchasedAt) },
  { name: 'actions', label: '', align: 'right', field: 'id' },
]

async function load({ pagination: requested = pagination.value } = {}) {
  listRequest?.abort()
  const request = new AbortController()
  listRequest = request
  loading.value = true
  error.value = ''
  try {
    const { data: { data } } = await api.get(endpoint, {
      ...financeHeaders(true),
      signal: request.signal,
      params: { q: search.value, kind: kind.value, status: status.value, from: from.value, to: to.value,
        page: requested.page, limit: requested.rowsPerPage },
    })
    if (request.signal.aborted) return
    rows.value = data.items
    pagination.value = { page: data.page, rowsPerPage: data.limit, rowsNumber: data.total }
  } catch (cause) {
    if (!request.signal.aborted) {
      rows.value = []
      pagination.value = { ...requested, rowsNumber: 0 }
      error.value = cause.response?.data?.message || 'Não foi possível carregar os pagamentos.'
    }
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

async function openDetail(row) {
  detailRequest?.abort()
  const request = new AbortController()
  detailRequest = request
  detail.value = row
  detailOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  try {
    const { data: { data } } = await api.get(`${endpoint}/${encodeURIComponent(row.id)}`, {
      ...financeHeaders(true), signal: request.signal,
    })
    if (!request.signal.aborted) detail.value = data
  } catch {
    if (!request.signal.aborted) detailError.value = 'Não foi possível carregar os detalhes do pagamento.'
  } finally {
    if (!request.signal.aborted) detailLoading.value = false
  }
}

watch([search, kind, status, from, to], () => load({ pagination: { ...pagination.value, page: 1 } }))
onMounted(() => load())
onBeforeUnmount(() => { listRequest?.abort(); detailRequest?.abort() })
</script>

<style scoped>
.payment-logs { display: grid; gap: 14px; min-width: 0; }
.payment-logs__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.payment-logs h2, .payment-logs__detail h3 { margin: 0; font-size: 1.15rem; font-weight: 700; line-height: 1.3; }
.payment-logs__filters { display: grid; grid-template-columns: minmax(180px, 1.4fr) repeat(4, minmax(130px, 1fr)); gap: 12px; }
.payment-logs small, .payment-logs__facts dt { color: #adc4c2; }
.payment-logs__detail { width: min(620px, 100%); }
.payment-logs__detail h4 { font-size: 1rem; line-height: 1.3; margin: 0 0 10px; }
.payment-logs__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 0 16px; }
.payment-logs__facts dd { margin: 0; overflow-wrap: anywhere; }
.payment-logs__detail pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 12px; background: #10191e; border-radius: 8px; }
@media (max-width: 1099px) {
  .payment-logs__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .payment-logs__filters > :first-child { grid-column: 1 / -1; }
}
@media (max-width: 450px) {
  .payment-logs__filters, .payment-logs__facts { grid-template-columns: minmax(0, 1fr); }
}
</style>
