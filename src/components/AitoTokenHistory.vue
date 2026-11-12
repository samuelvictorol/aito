<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate, purchaseMoney } from 'src/services/purchase-history'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  licenseId: { type: String, required: true },
  admin: Boolean,
})
const loading = ref(false)
const error = ref('')
const fullHistory = ref(null)
const pagination = ref({ page: 1, rowsPerPage: 5 })
const pageOptions = computed(() => fullHistory.value ? [pagination.value.rowsPerPage] : [5, 10, 25])
let currentLoad

const labels = { pending: 'Aguardando pagamento', paid: 'Pago', approved: 'Pago', failed: 'Falhou', canceled: 'Cancelado', expired: 'Expirado' }
const columns = [
  { name: 'order', label: 'Pedido', field: 'orderNsu', align: 'left' },
  { name: 'usd', label: 'Créditos', field: row => purchaseMoney(row.usdCents, 'USD'), align: 'right' },
  { name: 'brl', label: 'Valor em reais', field: row => purchaseMoney(row.brlCents), align: 'right' },
  { name: 'status', label: 'Situação', field: row => labels[row.status] || row.status, align: 'left' },
  { name: 'createdAt', label: 'Data do pedido', field: row => purchaseDate(row.createdAt), align: 'left' },
  { name: 'paidAt', label: 'Confirmação', field: row => purchaseDate(row.paidAt), align: 'left' },
]

async function loadHistory(page = 1) {
  currentLoad?.abort()
  const request = new AbortController()
  currentLoad = request
  loading.value = true
  error.value = ''
  const scope = props.admin ? 'admin' : 'account'
  const offset = (page - 1) * pagination.value.rowsPerPage
  try {
    const { data } = await api.get(`/aito-tokens/${scope}/${encodeURIComponent(props.licenseId)}/recharges`, {
      ...financeHeaders(props.admin), params: { offset }, signal: request.signal,
    })
    if (request.signal.aborted) return
    const { history, total, limit } = data.data
    fullHistory.value = history
    pagination.value = { page, rowsNumber: total, rowsPerPage: limit }
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar as recargas. Tente novamente.'
  } finally {
    if (currentLoad === request) loading.value = false
  }
}

onBeforeUnmount(() => currentLoad?.abort())
</script>

<template>
  <div class="aito-token-history">
    <q-table
      v-model:pagination="pagination" flat bordered dark wrap-cells row-key="orderNsu" :rows="fullHistory ?? rows" :columns="columns"
      :grid="$q.screen.lt.sm" :rows-per-page-options="pageOptions" :loading="loading" no-data-label="Nenhuma recarga registrada."
      rows-per-page-label="Linhas por página" @request="loadHistory($event.pagination.page)"
    />
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <q-btn v-if="fullHistory === null && rows.length" flat no-caps icon="mdi-history" label="Ver histórico completo" :loading="loading" @click="loadHistory()" />
  </div>
</template>

<style scoped>
.aito-token-history { display: grid; gap: .55rem; min-width: 0; }
.aito-token-history :deep(.q-table__container) { min-width: 0; background: #0c2022; border-color: #345857; }
.aito-token-history :deep(.q-table__grid-item-value) { overflow-wrap: anywhere; }
.aito-token-history > .q-btn { justify-self: start; }
</style>
