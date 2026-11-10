<template>
  <q-dialog v-model="opened" :persistent="saving" @hide="reset">
    <q-card class="purchase-editor" dark>
      <q-card-section class="row items-center justify-between no-wrap">
        <div>
          <span class="purchase-editor__eyebrow">FINANCEIRO</span>
          <h2>{{ purchase ? 'Editar compra' : 'Cadastrar compra manual' }}</h2>
        </div>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar" :disable="saving" v-close-popup />
      </q-card-section>
      <q-separator dark />
      <q-form @submit="save">
        <q-card-section class="purchase-editor__fields">
          <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
          <template v-if="purchase">
            <p class="purchase-editor__owner">{{ purchase.customer?.name || 'Cliente' }} · {{ purchase.customer?.email || 'E-mail indisponível' }}</p>
          </template>
          <template v-else>
            <div v-if="!newCustomer" class="purchase-editor__customer">
              <FinanceCustomerSelect v-model="customer" label="Cliente da compra" :disable="saving || Boolean(savedId)" :rules="[customerRequired]" />
              <q-btn flat no-caps color="teal-3" icon="mdi-account-plus-outline" label="Cadastrar cliente" :disable="saving || Boolean(savedId)" @click="newCustomer = true" />
            </div>
            <div v-else class="purchase-editor__new-customer">
              <div class="row items-center justify-between q-mb-sm">
                <strong>Novo cliente</strong>
                <q-btn flat no-caps color="teal-3" label="Buscar cadastro existente" :disable="saving" @click="newCustomer = false" />
              </div>
              <div class="purchase-editor__row">
                <q-input v-model.trim="person.name" dark dense outlined maxlength="120" label="Nome do cliente" :rules="[required]" :disable="saving" />
                <q-input v-model.trim="person.email" dark dense outlined maxlength="254" type="email" label="E-mail obrigatório" :rules="[emailRequired]" :disable="saving" />
              </div>
              <q-input v-model.trim="person.phone" dark dense outlined type="tel" maxlength="22" label="Telefone opcional" :disable="saving" />
              <p class="purchase-editor__hint q-mt-sm">O cliente pode usar este e-mail em “Esqueci minha senha” para definir o acesso.</p>
            </div>
            <q-select v-model="form.kind" dark dense outlined label="Produto ou serviço" :options="purchaseKinds" emit-value map-options :disable="saving || Boolean(savedId)" />
            <q-select v-if="form.kind === 'course'" v-model="form.courseId" dark dense outlined label="Curso associado" :options="courseOptions" emit-value map-options :rules="[required]" :disable="saving || Boolean(savedId)" />
            <p class="purchase-editor__hint">Use este registro para compras já pagas. A liberação de cursos e licenças é feita no cadastro do cliente.</p>
          </template>

          <q-input v-model.trim="form.title" dark dense outlined maxlength="180" label="Título da compra" :rules="[required]" :disable="saving" />
          <div class="purchase-editor__row">
            <q-input v-model="form.amount" dark dense outlined type="number" min="0" max="10000000" step="0.01" label="Valor pago (R$)" :rules="[validAmount]" :disable="saving" />
            <q-input v-model="form.purchasedAt" dark dense outlined stack-label type="datetime-local" step="1" label="Data e hora da compra" :rules="[validDate]" :disable="saving" />
          </div>
          <q-input v-if="periodEditable" v-model="form.periodMonths" dark dense outlined type="number" min="1" max="1200" step="1" label="Período em meses, se aplicável" :rules="[validPeriod]" :disable="saving" />
          <q-input v-model.trim="form.receiptUrl" dark dense outlined type="url" maxlength="2000" label="Link do comprovante InfinitePay" :rules="[validReceipt]" :disable="saving" />

          <div v-if="purchase?.invoice" class="purchase-editor__invoice">
            <q-icon :name="/\.pdf$/i.test(purchase.invoice.filename) ? 'mdi-file-pdf-box' : 'mdi-file-xml-box'" size="22px" />
            <span>{{ purchase.invoice.filename }}</span>
            <q-toggle v-model="removeInvoice" dark dense color="red-4" label="Remover nota atual" :disable="saving || Boolean(invoice)" />
          </div>
          <q-file v-model="invoice" dark dense outlined clearable accept=".pdf,.xml" :max-file-size="invoiceLimit" :disable="saving || removeInvoice" :label="purchase?.invoice ? 'Substituir nota fiscal' : 'Anexar nota fiscal opcional'" hint="PDF ou XML de até 8 MB" @rejected="rejectInvoice">
            <template #prepend><q-icon name="mdi-paperclip" /></template>
          </q-file>
        </q-card-section>
        <q-separator dark />
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Cancelar" :disable="saving" v-close-popup />
          <q-btn unelevated no-caps type="submit" color="teal-7" icon="mdi-content-save-outline" :label="purchase ? 'Salvar alterações' : 'Salvar compra'" :loading="saving" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import FinanceCustomerSelect from './FinanceCustomerSelect.vue'
import { financeHeaders, purchaseKinds, safeReceiptUrl } from 'src/services/purchase-history'

const props = defineProps({ courseOptions: { type: Array, required: true } })
const emit = defineEmits(['changed'])
const $q = useQuasar()
const base = '/admin/finance/purchases'
const invoiceLimit = 8 * 1024 * 1024
const opened = ref(false)
const saving = ref(false)
const error = ref('')
const purchase = ref(null)
const savedId = ref('')
const customer = ref(null)
const newCustomer = ref(false)
const person = reactive({ name: '', email: '', phone: '' })
const invoice = ref(null)
const removeInvoice = ref(false)
const form = reactive({ kind: '', courseId: '', title: '', amount: '', purchasedAt: '', periodMonths: '', receiptUrl: '' })
const periodEditable = computed(() => ['desktop', 'cloud', 'renewal', 'other'].includes(form.kind) && (purchase.value?.products?.length || 0) <= 1)
let requestId
let original

const required = value => Boolean(value) || 'Preencha este campo.'
const customerRequired = value => Boolean(value?.id && value.active !== false) || 'Selecione um cliente ativo.'
const emailRequired = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Informe um e-mail válido.'
const validAmount = value => (/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value ?? '')) && Number(value) <= 10_000_000) || 'Informe o valor com até duas casas decimais.'
const validDate = value => Boolean(value && !Number.isNaN(new Date(value).valueOf())) || 'Informe a data e a hora.'
const validPeriod = value => !value || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1200) || 'Informe um período inteiro entre 1 e 1200 meses.'
const validReceipt = value => !value || Boolean(safeReceiptUrl(value)) || 'Use um link HTTPS da InfinitePay.'

function localDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}

function reset() {
  error.value = ''
  purchase.value = null
  savedId.value = ''
  customer.value = null
  newCustomer.value = false
  Object.assign(person, { name: '', email: '', phone: '' })
  invoice.value = null
  removeInvoice.value = false
}

function open(row = null, selectedCustomer = null, selectedCourseId = '') {
  reset()
  purchase.value = row
  savedId.value = row?.id || ''
  customer.value = selectedCustomer
  requestId = crypto.randomUUID()
  Object.assign(form, {
    kind: row?.kind || (selectedCourseId ? 'course' : 'other'),
    courseId: row?.courseId || selectedCourseId,
    title: row?.title || '',
    amount: row ? (row.amountCents / 100).toFixed(2) : '',
    purchasedAt: localDateTime(row?.purchasedAt || Date.now()),
    periodMonths: row?.periodMonths || '',
    receiptUrl: row?.receiptUrl || '',
  })
  original = row ? { ...form } : null
  opened.value = true
}

function rejectInvoice() {
  error.value = 'Selecione um PDF ou XML de até 8 MB.'
}

function fields() {
  const values = {}
  if (form.title !== original?.title) values.title = form.title
  if (form.amount !== original?.amount) values.amountCents = Math.round(Number(form.amount) * 100)
  if (form.purchasedAt !== original?.purchasedAt) values.purchasedAt = new Date(form.purchasedAt).toISOString()
  if (form.receiptUrl !== original?.receiptUrl) values.receiptUrl = form.receiptUrl
  if (periodEditable.value && form.periodMonths !== original?.periodMonths) values.periodMonths = form.periodMonths ? Number(form.periodMonths) : null
  return values
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  let recordSaved = false
  try {
    if (newCustomer.value) {
      const { data } = await api.post('/admin/finance/customers', person, financeHeaders(true))
      customer.value = data.data
      newCustomer.value = false
      if (customer.value.active === false) {
        error.value = 'Este cadastro está inativo. Reative o cliente no painel antes de vincular a compra.'
        return
      }
    }
    const updates = fields()
    if (savedId.value) {
      if (Object.keys(updates).length) await api.patch(`${base}/${encodeURIComponent(savedId.value)}`, updates, financeHeaders(true))
    } else {
      const { data } = await api.post(base, {
        ...updates, customerId: customer.value.id, kind: form.kind,
        ...(form.kind === 'course' && { courseId: form.courseId }), requestId,
      }, financeHeaders(true))
      savedId.value = data.data.id
    }
    original = { ...form }
    recordSaved = true
    const invoicePath = `${base}/${encodeURIComponent(savedId.value)}/invoice`
    if (removeInvoice.value) await api.delete(invoicePath, financeHeaders(true))
    if (invoice.value) {
      const file = invoice.value
      const mime = /\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/xml'
      await api.put(invoicePath, file, {
        params: { filename: file.name }, headers: { ...financeHeaders(true).headers, 'Content-Type': mime },
      })
    }
    emit('changed')
    opened.value = false
    $q.notify({ type: 'positive', message: purchase.value ? 'Compra atualizada.' : 'Compra cadastrada.' })
  } catch (cause) {
    const message = cause.response?.data?.message || 'Não foi possível concluir a operação.'
    error.value = recordSaved ? `Compra salva. A nota fiscal precisa ser atualizada novamente. ${message}` : message
    if (recordSaved) emit('changed')
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.purchase-editor { width: min(94vw, 660px); background: #071b1c; border: 1px solid #28645b; }
.purchase-editor h2 { margin: .2rem 0 0; font-size: 1.35rem; line-height: 1.25; }
.purchase-editor__eyebrow { color: #98eedb; font-size: .67rem; font-weight: 800; letter-spacing: .13em; }
.purchase-editor__fields { display: grid; gap: .85rem; }
.purchase-editor__row, .purchase-editor__customer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; align-items: start; }
.purchase-editor__customer { grid-template-columns: minmax(0, 1fr) auto; }
.purchase-editor__new-customer { border: 1px solid #356c61; border-radius: .65rem; padding: .75rem; }
.purchase-editor__owner, .purchase-editor__hint { margin: 0; color: #b8d8d0; }
.purchase-editor__hint { font-size: .77rem; }
.purchase-editor__invoice { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; color: #b8e1d6; }
.purchase-editor__invoice span { flex: 1; overflow-wrap: anywhere; }
@media (max-width: 540px) { .purchase-editor__row, .purchase-editor__customer { grid-template-columns: 1fr; } }
</style>
