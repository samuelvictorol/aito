<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import { reelDate, reelOrigin, reelStatus, reelTokens } from 'src/services/instagramReel'

const jobs = ref([]), profit = ref(0), total = ref(0), page = ref(1), pageSize = ref(25)
const loading = ref(false), error = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const columns = [
  { name: 'user', label: 'Solicitante', field: 'user', align: 'left' },
  { name: 'source', label: 'Origem', field: row => reelOrigin(row.source), align: 'left' },
  { name: 'status', label: 'Status', field: row => reelStatus(row.status), align: 'left' },
  { name: 'charge', label: 'Cobrança', field: 'billingStatus', align: 'left' },
  { name: 'time', label: 'Solicitado em', field: row => reelDate(row.createdAt), align: 'left' },
]
let controller, timer
async function refresh() {
  clearTimeout(timer)
  controller?.abort()
  const target = new AbortController()
  controller = target
  loading.value = true
  try {
    const { data } = await api.get('/admin/insta-downloader/queue', {
      ...financeHeaders(true), params: { page: page.value, pageSize: pageSize.value }, signal: target.signal, timeout: 15000,
    })
    if (target.signal.aborted) return
    const result = data.data
    jobs.value = result.jobs
    total.value = result.total
    profit.value = result.profitTokens
    error.value = ''
    if (page.value > pages.value) { page.value = pages.value; return refresh() }
  } catch (cause) {
    if (!target.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível atualizar a fila.'
  } finally {
    if (!target.signal.aborted) {
      loading.value = false
      timer = setTimeout(refresh, error.value ? 15000 : 6000)
    }
  }
}
function changePage(next) { page.value = next; void refresh() }
function changeLimit(next) { pageSize.value = next; changePage(1) }
onMounted(refresh)
onBeforeUnmount(() => { controller?.abort(); clearTimeout(timer) })
</script>

<template>
  <section class="reel-queue" aria-label="Fila de conversões de Reels">
    <div class="reel-queue__header">
      <h3>Fila de conversões</h3>
      <q-btn flat round dense icon="mdi-refresh" aria-label="Atualizar fila" :loading="loading" @click="refresh" />
    </div>
    <div class="reel-queue__stats"><span>Lucro bruto das conversões</span><strong>{{ reelTokens(profit) }} AitoTokens</strong><small>1.000 por conversão de cliente concluída, antes dos custos de hospedagem.</small></div>
    <p v-if="error" role="alert">{{ error }}</p>
    <q-table flat dark wrap-cells hide-pagination row-key="id" :rows="jobs" :columns="columns" :pagination="{ rowsPerPage: 0 }"
      class="reel-queue__table" no-data-label="Nenhuma conversão solicitada.">
      <template #body-cell-user="p"><q-td :props="p"><b>{{ p.row.user?.name || p.row.user?.email || 'Conta' }}</b><small>{{ p.row.user?.email || p.row.user?.id }}</small></q-td></template>
      <template #body-cell-status="p"><q-td :props="p"><span>{{ p.value }}</span><small v-if="p.row.status === 'queued' && p.row.position">{{ p.row.position }}º na fila</small><small v-if="p.row.status === 'failed'">{{ p.row.message }}</small></q-td></template>
      <template #body-cell-charge="p"><q-td :props="p">
        <span v-if="p.value === 'reserved'">{{ reelTokens(p.row.costTokens) }} reservados</span>
        <span v-else-if="p.value === 'charged'">{{ reelTokens(p.row.chargedTokens) }} AitoTokens</span>
        <span v-else-if="p.value === 'released'">Reserva liberada</span>
        <span v-else>Sem cobrança</span>
      </q-td></template>
    </q-table>
    <div class="reel-queue__pages">
      <q-select dark dense outlined hide-bottom-space :model-value="pageSize" :options="[10,25,50]" label="Registros por página" @update:model-value="changeLimit" />
      <q-pagination v-if="pages > 1" :model-value="page" :max="pages" :max-pages="5" boundary-links direction-links color="teal-3" @update:model-value="changePage" />
    </div>
  </section>
</template>

<style scoped>
.reel-queue { min-width: 0; margin-top: 26px; padding-top: 24px; border-top: 1px solid #405052; }
.reel-queue__header, .reel-queue__pages { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.reel-queue h3 { margin: 0; font-size: 1.2rem; line-height: 1.3; font-weight: 650; }
.reel-queue__stats { display: grid; justify-items: start; gap: 3px; margin: 16px 0; }
.reel-queue__stats strong { color: #c3ebdc; font-size: 1.5rem; }
.reel-queue small { display: block; color: #bbcdcb; font-size: .76rem; overflow-wrap: anywhere; }
.reel-queue__table { background: transparent; }
.reel-queue__table :deep(th) { color: #c6d2d1; }
.reel-queue__pages { margin-top: 13px; }
.reel-queue__pages .q-select { min-width: 165px; }
</style>
