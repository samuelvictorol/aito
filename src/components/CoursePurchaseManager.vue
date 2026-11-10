<template>
  <section class="course-purchases">
    <div class="course-purchases__head">
      <div><p class="course-purchases__eyebrow">AITO / PAGAMENTOS</p><h2>Compras e pagamentos</h2><p>Consulte as compras, registre vendas presenciais e associe notas fiscais.</p></div>
      <div class="course-purchases__actions">
        <q-btn unelevated no-caps color="teal-7" icon="mdi-cart-plus" label="Cadastrar compra manual" @click="editor.open(null, customer, courseId || '')" />
        <q-btn flat round icon="mdi-refresh" aria-label="Atualizar pagamentos" :loading="loading" @click="load" />
      </div>
    </div>

    <div class="course-purchases__filters">
      <FinanceCustomerSelect v-model="customer" @update:model-value="resetPage" />
      <q-input v-model="search" dark outlined dense clearable debounce="300" label="Buscar título ou referência" @update:model-value="resetPage"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
      <q-select v-model="kind" dark outlined dense clearable label="Produto" :options="purchaseKinds" emit-value map-options @update:model-value="changeKind" />
      <q-select v-model="courseId" dark outlined dense clearable label="Curso" :options="courseOptions" emit-value map-options @update:model-value="changeCourse" />
      <q-select v-model="status" dark outlined dense clearable label="Status da compra" :options="statusOptions" emit-value map-options @update:model-value="resetPage" />
    </div>

    <q-banner v-if="error" class="bg-red-10 text-white" rounded role="alert">{{ error }}</q-banner>
    <section class="course-purchases__section"><div class="course-purchases__section-head"><div><p class="course-purchases__eyebrow">COMPRAS</p><h3>Histórico do sistema</h3></div><span>{{ pagination.rowsNumber }} {{ pagination.rowsNumber === 1 ? 'registro' : 'registros' }}</span></div>
      <q-table flat bordered dark wrap-cells row-key="id" class="course-purchases__table" :rows="purchases" :columns="purchaseColumns" :loading="loading" v-model:pagination="pagination" :rows-per-page-options="[15, 30, 50]" no-data-label="Nenhuma compra encontrada" @request="loadPage">
        <template #body-cell-user="props"><q-td :props="props"><strong>{{ props.row.customer?.name || '—' }}</strong><small>{{ props.row.customer?.email || '—' }}</small></q-td></template>
        <template #body-cell-product="props"><q-td :props="props">
          <strong>{{ props.row.title }}</strong><small>{{ purchaseKind(props.row.kind) }}</small>
          <small v-for="(product, index) in props.row.products?.length > 1 ? props.row.products : []" :key="`${product.kind}-${index}`">
            {{ product.title || purchaseKind(product.kind) }}<template v-if="purchasePeriod(product)"> · {{ purchasePeriod(product) }}</template>
          </small>
          <small v-if="(props.row.products?.length || 0) <= 1 && purchasePeriod(props.row)">{{ purchasePeriod(props.row) }}</small>
        </q-td></template>
        <template #body-cell-orderNsu="props"><q-td :props="props"><code :title="props.row.orderNsu">{{ short(props.row.orderNsu) }}</code></q-td></template>
        <template #body-cell-amount="props"><q-td :props="props">{{ purchaseMoney(props.row.amountCents, props.row.currency) }}</q-td></template>
        <template #body-cell-status="props"><q-td :props="props"><span class="course-purchases__tag" :class="`is-${props.row.status}`">{{ statusLabel(props.row.status) }}</span></q-td></template>
        <template #body-cell-createdAt="props"><q-td :props="props">{{ purchaseDate(props.row.purchasedAt) }}</q-td></template>
        <template #body-cell-documents="props"><q-td :props="props">
          <div class="course-purchases__documents">
            <q-btn v-if="safeReceiptUrl(props.row.receiptUrl)" flat no-caps dense color="teal-3" icon="mdi-open-in-new" label="Comprovante" :href="safeReceiptUrl(props.row.receiptUrl)" target="_blank" rel="noopener noreferrer" />
            <q-btn v-if="safeReceiptUrl(props.row.checkoutUrl)" flat no-caps dense color="teal-3" icon="mdi-link-variant" label="Checkout" :href="safeReceiptUrl(props.row.checkoutUrl)" target="_blank" rel="noopener noreferrer" />
            <PurchaseInvoiceActions v-if="props.row.invoice" admin :purchase-id="props.row.id" :invoice="props.row.invoice" />
            <span v-if="!props.row.receiptUrl && !props.row.checkoutUrl && !props.row.invoice">—</span>
          </div>
        </q-td></template>
        <template #body-cell-actions="props"><q-td :props="props">
          <q-btn flat dense round color="teal-3" icon="mdi-pencil-outline" aria-label="Editar compra e nota fiscal" @click="editor.open(props.row)"><q-tooltip>Editar compra e nota fiscal</q-tooltip></q-btn>
        </q-td></template>
      </q-table>
    </section>

    <h3 class="course-purchases__audit-title">Métricas de compras de cursos</h3>
    <div class="course-purchases__metrics">
      <article><q-icon name="mdi-link-variant" /><span>Links gerados</span><strong>{{ metrics.payments?.linksGenerated || 0 }}</strong></article>
      <article><q-icon name="mdi-account-check-outline" /><span>Compras pagas</span><strong>{{ metrics.payments?.paid || 0 }}</strong></article>
      <article><q-icon name="mdi-timer-sand" /><span>Aguardando pagamento</span><strong>{{ metrics.payments?.pending || 0 }}</strong></article>
      <article><q-icon name="mdi-cash-check" /><span>Receita confirmada</span><strong>{{ money(metrics.payments?.revenue) }}</strong></article>
      <article><q-icon name="mdi-webhook" /><span>Webhooks recebidos</span><strong>{{ metrics.payments?.webhooksReceived || 0 }}</strong></article>
      <article><q-icon name="mdi-check-decagram-outline" /><span>Acessos liberados</span><strong>{{ metrics.payments?.settled || 0 }}</strong></article>
    </div>

    <div class="course-purchases__config"><q-icon name="mdi-cog-outline" /><span>Handle: <strong>{{ metrics.paymentConfig?.handle || '-' }}</strong></span><span>Webhook: <strong>{{ metrics.paymentConfig?.webhookUrl || '-' }}</strong></span><span>CNPJ opcional: <strong>{{ metrics.paymentConfig?.adminCnpjConfigured ? 'configurado' : 'nao configurado' }}</strong></span></div>

    <section class="course-purchases__section"><div class="course-purchases__section-head"><div><p class="course-purchases__eyebrow">WEBHOOK / AITOLEARN</p><h3>Eventos de pagamento dos cursos</h3></div><q-select v-model="eventType" dark outlined dense clearable label="Evento" :options="eventOptions" emit-value map-options @update:model-value="loadAudit" /></div>
      <q-banner v-if="auditError" class="bg-red-10 text-white" rounded role="alert">{{ auditError }}</q-banner>
      <q-table flat bordered dark wrap-cells row-key="_id" class="course-purchases__table" :rows="events" :columns="eventColumns" :loading="auditLoading" no-data-label="Nenhum evento encontrado">
        <template #body-cell-eventType="props"><q-td :props="props"><span class="course-purchases__event"><q-icon :name="eventIcon(props.row.eventType)" />{{ eventLabel(props.row.eventType) }}</span><small>{{ props.row.source || '-' }}</small></q-td></template>
        <template #body-cell-course="props"><q-td :props="props">{{ props.row.course?.title || '-' }}</q-td></template>
        <template #body-cell-user="props"><q-td :props="props">{{ props.row.user?.name || props.row.user?.email || '-' }}</q-td></template>
        <template #body-cell-orderNsu="props"><q-td :props="props"><code>{{ short(props.row.orderNsu) }}</code></q-td></template>
        <template #body-cell-status="props"><q-td :props="props"><span class="course-purchases__tag" :class="`is-${props.row.status}`">{{ statusLabel(props.row.status) }}</span></q-td></template>
        <template #body-cell-createdAt="props"><q-td :props="props"><button type="button" class="course-purchases__date" @click="openEvent(props.row)">{{ formatDate(props.row.createdAt) }}<q-icon name="mdi-eye-outline" /></button></q-td></template>
      </q-table>
    </section>

    <q-dialog v-model="eventDialog"><q-card class="course-purchases__dialog"><q-card-section class="course-purchases__dialog-head"><div><p class="course-purchases__eyebrow">DETALHE DO EVENTO</p><h3>{{ eventLabel(selectedEvent.eventType) }}</h3></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="eventDialog = false" /></q-card-section><q-card-section><div class="course-purchases__event-facts"><span><strong>Curso</strong>{{ selectedEvent.course?.title || '-' }}</span><span><strong>Usuário</strong>{{ selectedEvent.user?.email || '-' }}</span><span><strong>Order NSU</strong>{{ selectedEvent.orderNsu || '-' }}</span><span><strong>Status</strong>{{ statusLabel(selectedEvent.status) }}</span></div><pre>{{ prettyPayload }}</pre></q-card-section></q-card></q-dialog>
    <FinancePurchaseEditor ref="editor" :course-options="courseOptions" @changed="loadPage()" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from 'boot/axios'
import FinanceCustomerSelect from './FinanceCustomerSelect.vue'
import FinancePurchaseEditor from './FinancePurchaseEditor.vue'
import PurchaseInvoiceActions from './PurchaseInvoiceActions.vue'
import { financeHeaders, purchaseDate, purchaseKind, purchaseKinds, purchaseMoney, purchasePeriod, safeReceiptUrl } from 'src/services/purchase-history'

const props = defineProps({ initialCourseId: { type: String, default: '' } })
const editor = ref(null)
const loading = ref(false)
const auditLoading = ref(false)
const error = ref('')
const auditError = ref('')
const purchases = ref([])
const events = ref([])
const courses = ref([])
const search = ref('')
const kind = ref(null)
const courseId = ref(props.initialCourseId || '')
const customer = ref(null)
const status = ref('')
const eventType = ref('')
const metrics = ref({})
const eventDialog = ref(false)
const selectedEvent = ref({})
const pagination = ref({ page: 1, rowsPerPage: 15, rowsNumber: 0 })
let purchasesRequest
let auditRequest
const statusOptions = [
  { label: 'Gerando link', value: 'creating' }, { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }, { label: 'Cancelado', value: 'cancelled' }, { label: 'Recusado', value: 'declined' },
]
const eventOptions = [{ label: 'Link solicitado', value: 'checkout_requested' }, { label: 'Link gerado', value: 'checkout_created' }, { label: 'Falha ao gerar', value: 'checkout_failed' }, { label: 'Consulta de pagamento', value: 'payment_check' }, { label: 'Webhook recebido', value: 'webhook_received' }, { label: 'Acesso liberado', value: 'payment_settled' }, { label: 'Webhook repetido', value: 'payment_already_settled' }]
const purchaseColumns = [
  { name: 'user', label: 'Cliente', field: 'customer', align: 'left' },
  { name: 'product', label: 'Compra / período', field: 'title', align: 'left' },
  { name: 'orderNsu', label: 'Order NSU', field: 'orderNsu', align: 'left' },
  { name: 'amount', label: 'Valor', field: 'amountCents', align: 'right' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'createdAt', label: 'Data e hora', field: 'purchasedAt', align: 'left' },
  { name: 'documents', label: 'Documentos', field: 'invoice', align: 'left' },
  { name: 'actions', label: 'Ações', field: 'id', align: 'center' },
]
const eventColumns = [{ name: 'eventType', label: 'Evento', field: 'eventType', align: 'left' }, { name: 'course', label: 'Curso', field: 'course', align: 'left' }, { name: 'user', label: 'Usuario', field: 'user', align: 'left' }, { name: 'orderNsu', label: 'Order NSU', field: 'orderNsu', align: 'left' }, { name: 'status', label: 'Status', field: 'status', align: 'center' }, { name: 'createdAt', label: 'Recebido em', field: 'createdAt', align: 'left' }]
const courseOptions = computed(() => courses.value.map((item) => ({ label: `${item.title} · ${item.slug}`, value: item._id })))
const prettyPayload = computed(() => JSON.stringify(selectedEvent.value?.payload || {}, null, 2))

function money (value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)) }
function formatDate (value) { return value ? new Date(value).toLocaleString('pt-BR') : '-' }
function short (value) { const text = String(value || '-'); return text.length > 25 ? `${text.slice(0, 11)}...${text.slice(-8)}` : text }
function statusLabel (value) { return (statusOptions.find(option => option.value === value)?.label || { received: 'Recebido', matched: 'Vinculado', failed: 'Falhou', unmatched: 'Sem compra', invalid: 'Inválido', created: 'Criado' }[value] || value || '-') }
function eventLabel (value) { return eventOptions.find((item) => item.value === value)?.label || value || '-' }
function eventIcon (value) { return ({ checkout_requested: 'mdi-link-variant', checkout_created: 'mdi-link-check', checkout_failed: 'mdi-link-off', payment_check: 'mdi-refresh-circle', webhook_received: 'mdi-webhook', payment_settled: 'mdi-check-decagram-outline', payment_already_settled: 'mdi-content-copy' }[value] || 'mdi-information-outline') }
function openEvent (event) { selectedEvent.value = event; eventDialog.value = true }

function filters() {
  return { courseId: courseId.value || undefined, userId: customer.value?.id, status: status.value || undefined, q: search.value || undefined }
}

async function loadPage({ pagination: requested = pagination.value } = {}) {
  purchasesRequest?.abort()
  const request = new AbortController()
  purchasesRequest = request
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/finance/purchases', {
      ...financeHeaders(true), signal: request.signal,
      params: { ...filters(), kind: kind.value || undefined, page: requested.page, limit: requested.rowsPerPage },
    })
    if (request.signal.aborted) return
    purchases.value = data.data.items
    pagination.value = { page: data.data.page, rowsPerPage: data.data.limit, rowsNumber: data.data.total }
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar as compras.'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

async function loadAudit() {
  auditRequest?.abort()
  const request = new AbortController()
  auditRequest = request
  auditLoading.value = true
  auditError.value = ''
  const params = filters()
  const options = { ...financeHeaders(true), signal: request.signal }
  try {
    const [eventResponse, metricResponse] = await Promise.all([
      api.get('/admin/course-payment-events', { ...options, params: { ...params, eventType: eventType.value || undefined } }),
      api.get('/admin/courses/metrics', { ...options, params: { courseId: params.courseId, userId: params.userId } }),
    ])
    if (request.signal.aborted) return
    events.value = eventResponse.data.data || []
    metrics.value = metricResponse.data.data || {}
  } catch {
    if (!request.signal.aborted) auditError.value = 'Não foi possível carregar a auditoria dos cursos.'
  } finally {
    if (!request.signal.aborted) auditLoading.value = false
  }
}

function load() {
  void loadPage()
  void loadAudit()
}

function resetPage() {
  pagination.value.page = 1
  load()
}

function changeKind(value) {
  if (value && value !== 'course') courseId.value = null
  resetPage()
}

function changeCourse(value) {
  if (value) kind.value = 'course'
  resetPage()
}

watch(() => props.initialCourseId, value => {
  courseId.value = value || ''
  changeCourse(courseId.value)
})
onMounted(async () => {
  load()
  try {
    const { data } = await api.get('/admin/courses', financeHeaders(true))
    courses.value = data.data || []
  } catch {
    if (!error.value) error.value = 'Não foi possível carregar a lista de cursos.'
  }
})
onBeforeUnmount(() => {
  purchasesRequest?.abort()
  auditRequest?.abort()
})
</script>

<style scoped>
.course-purchases__actions { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
.course-purchases__documents { display: grid; justify-items: start; gap: .15rem; }
.course-purchases__section-head > .q-select { width: min(100%, 16rem); }
.course-purchases__audit-title { margin: .5rem 0 0; font-size: 1.1rem; line-height: 1.25; }
.course-purchases__tag.is-declined { color: #ff8f9a; }
.course-purchases{display:grid;gap:1.15rem;color:#effffb}.course-purchases__head,.course-purchases__section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem}.course-purchases__head h2{margin:.45rem 0 0;font-size:clamp(1.6rem,3vw,2.8rem)}.course-purchases__head p:not(.course-purchases__eyebrow),.course-purchases__section-head>span{margin:.35rem 0 0;color:rgba(229,255,250,.56);font-size:.72rem}.course-purchases__eyebrow{margin:0;color:#8fffee;font-size:.65rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.course-purchases__filters{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:.6rem}.course-purchases__filters :deep(.q-field__control){color:#effffb;background:rgba(7,40,40,.74)}.course-purchases__filters :deep(.q-field__native),.course-purchases__filters :deep(.q-field__label){color:rgba(239,255,251,.8)}.course-purchases__metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:.65rem}.course-purchases__metrics article{display:grid;gap:.25rem;padding:.85rem;border:1px solid rgba(19,188,157,.22);border-radius:.6rem;background:rgba(4,24,25,.66)}.course-purchases__metrics .q-icon{color:#50dcc4}.course-purchases__metrics span{color:rgba(229,255,250,.56);font-size:.66rem}.course-purchases__metrics strong{color:#8fffee;font-size:1rem}.course-purchases__config{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:center;padding:.8rem 1rem;border:1px solid rgba(19,188,157,.16);border-radius:.55rem;color:rgba(229,255,250,.62);font-size:.7rem;background:rgba(4,24,25,.45)}.course-purchases__config>.q-icon{color:#8fffee}.course-purchases__config strong{color:#8fffee;font-weight:700}.course-purchases__section{display:grid;gap:.8rem}.course-purchases__section h3{margin:.35rem 0 0;font-size:1.1rem}.course-purchases__table{color:#effffb;background:rgba(3,16,18,.58);border-color:rgba(19,188,157,.2)}.course-purchases__table :deep(th){color:#8fffee;font-size:.68rem}.course-purchases__table :deep(td){color:rgba(239,255,251,.78);font-size:.72rem}.course-purchases__table small{display:block;color:rgba(239,255,251,.5);font-size:.62rem}.course-purchases__table code{color:#8fffee;font-size:.63rem}.course-purchases__checkout-link{display:inline-flex;align-items:center;gap:.25rem;color:#8fffee;font-size:.68rem;text-decoration:none}.course-purchases__tag{color:#8fffee}.course-purchases__tag.is-failed,.course-purchases__tag.is-cancelled,.course-purchases__tag.is-invalid{color:#ff8f9a}.course-purchases__tag.is-paid,.course-purchases__tag.is-created,.course-purchases__tag.is-matched{color:#8fffee}.course-purchases__event{display:inline-flex;align-items:center;gap:.35rem}.course-purchases__event>.q-icon{color:#50dcc4}.course-purchases__date{display:inline-flex;align-items:center;gap:.45rem;border:0;color:inherit;background:transparent;cursor:pointer;font:inherit}.course-purchases__dialog{width:min(94vw,760px);max-width:760px;color:#effffb;background:#061819;border:1px solid rgba(19,188,157,.3)}.course-purchases__dialog-head{display:flex;justify-content:space-between;gap:.8rem}.course-purchases__dialog h3{margin:.35rem 0 0}.course-purchases__event-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:.55rem;margin-bottom:1rem}.course-purchases__event-facts span{display:grid;gap:.2rem;padding:.65rem;border:1px solid rgba(19,188,157,.16);border-radius:.45rem;color:rgba(239,255,251,.7);font-size:.7rem}.course-purchases__event-facts strong{color:#8fffee;font-size:.6rem;text-transform:uppercase}.course-purchases__dialog pre{max-height:42vh;overflow:auto;margin:0;padding:1rem;border:1px solid rgba(19,188,157,.15);border-radius:.45rem;color:#bafbf0;background:#03110f;font-size:.68rem;white-space:pre-wrap;word-break:break-word}@media(max-width:1100px){.course-purchases__filters{grid-template-columns:repeat(3,1fr)}.course-purchases__metrics{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.course-purchases__head,.course-purchases__section-head{align-items:flex-start;flex-direction:column}.course-purchases__filters,.course-purchases__metrics,.course-purchases__event-facts{grid-template-columns:1fr}.course-purchases__config{display:grid;gap:.5rem}}
</style>
