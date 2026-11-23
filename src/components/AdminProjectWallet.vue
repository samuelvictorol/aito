<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate } from 'src/services/purchase-history'
import AitoTokenHistory from './AitoTokenHistory.vue'

const props = defineProps({ project: { type: Object, required: true } })
const $q = useQuasar()
const tab = ref('usage')
const detail = ref(null)
const error = ref('')
const busy = ref(false)
const page = ref(1)
const numbers = new Intl.NumberFormat('pt-BR')
const dollars = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 })
const money = cents => Number.isFinite(cents) ? dollars.format(cents / 100) : '—'
const columns = [
  { name: 'time', field: row => purchaseDate(row.at), label: 'Data', align: 'left' },
  { name: 'feature', field: row => row.feature || row.operation || '—', label: 'Recurso', align: 'left' },
  { name: 'model', field: row => [row.provider, row.model].filter(Boolean).join(' · '), label: 'Provedor e modelo', align: 'left' },
  { name: 'status', field: row => ({ applied: 'Concluída', reserved: 'Reservada', released: 'Liberada', reconciliation: 'Em conciliação' })[row.state] || row.state, label: 'Situação', align: 'left' },
  { name: 'multiplier', field: row => row.multiplier == null ? '—' : numbers.format(row.multiplier) + '×', label: 'Tarifa' },
  { name: 'billed', field: row => numbers.format(row.billedAitoTokens), label: 'AitoTokens cobrados' },
  { name: 'cost', field: row => money(row.providerUsdCents), label: 'Custo' },
  { name: 'profit', field: row => money(row.marginUsdCents), label: 'Margem bruta' },
]
let controller, timer
async function load(target = page.value) {
  controller?.abort()
  const request = new AbortController()
  controller = request
  busy.value = true
  try {
    const { data } = await api.get('/aito-tokens/admin/project-keys/' + props.project.projectId + '/wallet', {
      ...financeHeaders(true), signal: request.signal, params: { offset: (target - 1) * (detail.value?.usage.limit || 20) },
    })
    if (request.signal.aborted) return
    detail.value = data.data
    page.value = target
    error.value = ''
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível atualizar a carteira.'
  } finally { if (controller === request) busy.value = false }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(detail.value.rechargeUrl)
    $q.notify({ type: 'positive', message: 'Link de recarga copiado.' })
  } catch {
    $q.notify({ type: 'warning', message: 'Selecione o endereço no campo e copie o link.' })
  }
}
function refreshVisible() { if (!document.hidden && !busy.value) void load() }
watch(() => props.project.projectId, () => { detail.value = null; void load(1) }, { immediate: true })
onMounted(() => {
  timer = setInterval(refreshVisible, 15000)
  window.addEventListener('focus', refreshVisible)
})
onBeforeUnmount(() => { controller?.abort(); clearInterval(timer); window.removeEventListener('focus', refreshVisible) })
</script>

<template>
  <section class="project-wallet">
    <q-banner v-if="error" rounded role="alert" class="bg-red-10 text-white">{{ error }}</q-banner>
    <q-btn v-if="!detail" flat no-caps icon="mdi-refresh" label="Consultar carteira" :loading="busy" @click="load()" />
    <template v-else>
      <header>
        <div><small>Saldo disponível</small><strong>{{ numbers.format(detail.balanceAitoTokens) }} AitoTokens</strong></div>
        <q-btn flat round icon="mdi-refresh" aria-label="Atualizar carteira" :loading="busy" @click="load()" />
      </header>
      <div v-if="detail.rechargeUrl" class="project-wallet__link">
        <q-input :model-value="detail.rechargeUrl" dark outlined dense readonly label="Link de recarga deste projeto" />
        <q-btn outline no-caps color="teal-3" icon="mdi-link-variant" label="Copiar link" @click="copyLink" />
      </div>
      <dl>
        <div><dt>Consumo faturado</dt><dd>{{ numbers.format(detail.usage.billedAitoTokens) }} AitoTokens</dd><small>{{ money(detail.usage.billedUsdCents) }}</small></div>
        <div><dt>Custo dos provedores</dt><dd>{{ money(detail.usage.providerUsdCents) }}</dd></div>
        <div><dt>Margem bruta</dt><dd>{{ money(detail.usage.marginUsdCents) }}</dd></div>
      </dl>
      <q-tabs v-model="tab" dense no-caps align="left" active-color="teal-3"><q-tab name="usage" label="Consumo por requisição" /><q-tab name="history" label="Recargas" /></q-tabs>
      <template v-if="tab === 'usage'">
        <q-table flat bordered dark wrap-cells row-key="id" :grid="$q.screen.lt.sm" :rows="detail.usage.rows" :columns="columns" hide-pagination :pagination="{ rowsPerPage: 0 }" no-data-label="Nenhuma requisição registrada." />
        <q-pagination v-if="detail.usage.total > detail.usage.limit" :model-value="page" :max="Math.ceil(detail.usage.total / detail.usage.limit)"
          :max-pages="5" boundary-numbers direction-links color="teal-3" :disable="busy" @update:model-value="load" />
      </template>
      <AitoTokenHistory v-else :admin-project-id="project.projectId" />
    </template>
  </section>
</template>

<style scoped>
.project-wallet { display: grid; gap: .85rem; min-width: 0; }
.project-wallet header, .project-wallet__link { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
.project-wallet header { justify-content: space-between; }
.project-wallet header strong { display: block; font-size: 1.3rem; }
.project-wallet__link .q-field { flex: 1 1 230px; min-width: 0; }
.project-wallet dl { display: grid; grid-template-columns: repeat(auto-fit,minmax(145px,1fr)); gap: .5rem; margin: .25rem 0; }
.project-wallet dl div { background: #142f31; padding: .65rem; border-radius: .6rem; }
.project-wallet dt { color: #c1dcd4; font-size: .8rem; }
.project-wallet dd { margin: 0; font-weight: 700; }
</style>
