<template>
  <section class="finance" aria-labelledby="finance-title">
    <header class="finance__header">
      <div>
        <span class="finance__eyebrow">Minha conta</span>
        <h2 id="finance-title">Financeiro</h2>
        <p>Consulte suas compras, renovações e documentos de pagamento.</p>
      </div>
      <q-btn flat round icon="mdi-refresh" aria-label="Atualizar histórico de compras" :loading="loading" @click="load" />
    </header>
    <div class="finance__toolbar">
      <span>{{ total }} {{ total === 1 ? 'compra' : 'compras' }}</span>
      <q-select dark dense outlined clearable v-model="kind" :options="purchaseKinds" emit-value map-options label="Tipo de compra" @update:model-value="resetPage" />
    </div>

    <q-linear-progress v-if="loading" indeterminate color="teal-4" aria-label="Carregando compras" />
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">
      {{ error }}
      <template #action><q-btn flat no-caps label="Tentar novamente" @click="load" /></template>
    </q-banner>
    <div v-else-if="!loading && !items.length" class="finance__empty">
      <q-icon name="mdi-receipt-text-clock-outline" size="36px" />
      <strong>Nenhuma compra encontrada</strong>
      <span>Suas compras e renovações confirmadas aparecem aqui.</span>
    </div>
    <div v-else class="finance__list" :aria-busy="loading">
      <article v-for="item in items" :key="item.id" class="finance__purchase">
        <div class="finance__description">
          <span class="finance__kind"><q-icon :name="item.kind === 'renewal' ? 'mdi-autorenew' : 'mdi-receipt-text-outline'" /> {{ purchaseKind(item.kind) }}</span>
          <h3>{{ item.title }}</h3>
          <ul v-if="item.products?.length > 1" class="finance__products">
            <li v-for="(product, index) in item.products" :key="`${product.kind}-${index}`">
              {{ product.title || purchaseKind(product.kind) }}<template v-if="purchasePeriod(product)"> · {{ purchasePeriod(product) }}</template>
            </li>
          </ul>
          <span v-else-if="purchasePeriod(item)" class="finance__period">{{ purchasePeriod(item) }}</span>
        </div>
        <div class="finance__value">
          <strong>{{ purchaseMoney(item.amountCents, item.currency) }}</strong>
          <time :datetime="item.purchasedAt">{{ purchaseDate(item.purchasedAt) }}</time>
        </div>
        <div v-if="safeReceiptUrl(item.receiptUrl) || item.invoice" class="finance__files">
          <q-btn v-if="safeReceiptUrl(item.receiptUrl)" flat dense no-caps color="teal-3" icon="mdi-open-in-new" label="Comprovante InfinitePay" :href="safeReceiptUrl(item.receiptUrl)" target="_blank" rel="noopener noreferrer" />
          <PurchaseInvoiceActions v-if="item.invoice" :purchase-id="item.id" :invoice="item.invoice" />
        </div>
      </article>
    </div>
    <q-pagination v-if="maxPage > 1" v-model="page" :max="maxPage" :max-pages="5" boundary-numbers direction-links color="teal-4" active-color="teal-7" aria-label="Páginas do histórico" @update:model-value="load" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import PurchaseInvoiceActions from './PurchaseInvoiceActions.vue'
import { financeHeaders, purchaseDate, purchaseKind, purchaseKinds, purchaseMoney, purchasePeriod, safeReceiptUrl } from 'src/services/purchase-history'

const page = ref(1)
const limit = 20
const kind = ref(null)
const items = ref([])
const total = ref(0)
const maxPage = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const loading = ref(false)
const error = ref('')
let controller

async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/finance/purchases', {
      ...financeHeaders(), params: { page: page.value, limit, kind: kind.value || undefined }, signal: request.signal,
    })
    if (request.signal.aborted) return
    items.value = data.data.items
    total.value = data.data.total
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar o histórico agora.'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

function resetPage() {
  page.value = 1
  void load()
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<style scoped>
.finance { display: grid; gap: 1rem; }
.finance__header, .finance__toolbar { display: flex; align-items: center; justify-content: space-between; gap: .9rem; }
.finance__header { padding: clamp(1rem, 3vw, 1.7rem); border: 1px solid #2c6057; border-radius: 1.1rem; background: linear-gradient(130deg, #0d3a35, #061c24); }
.finance__header h2 { margin: .35rem 0; font-size: clamp(1.7rem, 3vw, 2.45rem); line-height: 1.15; }
.finance__header p { margin: 0; }
.finance__eyebrow { color: #9bf8df; font-size: .7rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.finance__toolbar { color: #b7e1d9; font-size: .82rem; }
.finance__toolbar .q-select { width: min(15rem, 68%); }
.finance__list { display: grid; gap: .65rem; }
.finance__purchase { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: .7rem; padding: 1rem; border: 1px solid #28554c; border-radius: .8rem; background: #071c20; }
.finance__kind { display: inline-flex; align-items: center; gap: .3rem; color: #9bf8df; font-size: .73rem; font-weight: 700; }
.finance__description h3 { margin: .25rem 0; font-size: 1.05rem; line-height: 1.4; overflow-wrap: anywhere; }
.finance__products { padding-left: 1.1rem; margin: 0; }
.finance__products, .finance__period, .finance__value time { color: #a8c9c1; font-size: .77rem; }
.finance__value { display: grid; gap: .22rem; text-align: right; white-space: nowrap; }
.finance__value strong { color: #dcfff1; font-size: 1.05rem; }
.finance__files { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; padding-top: .5rem; border-top: 1px solid #234740; }
.finance__empty { display: grid; justify-items: center; gap: .55rem; padding: 2rem 1rem; text-align: center; color: #afd3ca; border: 1px dashed #28554c; border-radius: .8rem; }
.finance__empty .q-icon, .finance__empty strong { color: #a5f6df; }
@media (max-width: 480px) {
  .finance__purchase { grid-template-columns: 1fr; }
  .finance__value { grid-template-columns: repeat(2, max-content); align-items: baseline; gap: .6rem; text-align: left; }
}
</style>
