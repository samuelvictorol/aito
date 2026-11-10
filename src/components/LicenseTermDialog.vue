<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const props = defineProps({ modelValue: Boolean, license: Object, customer: Object, mode: { type: String, default: 'edit' } })
const emit = defineEmits(['update:modelValue', 'saved'])
const open = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const $q = useQuasar()
const busy = ref(false)
const paidAmount = ref(null)
const form = reactive({ productType: 'desktop', permanent: false, durationDays: 365, durationMonths: 12, kind: 'months', date: '' })
const products = [
  { label: 'Desktop · executável', value: 'desktop' },
  { label: 'Whitelabel · código-fonte / Cloud', value: 'cloud' },
]
const title = computed(() => props.mode === 'grant' ? 'Liberar licença para o cliente' : props.mode === 'renew' ? 'Renovar validade da licença' : 'Editar validade da licença')
const expiryInPast = computed(() => !form.permanent && form.kind === 'date' && new Date(form.date).getTime() <= Date.now())
const termOptions = computed(() => [
  { label: 'Meses inteiros', value: 'months' },
  { label: 'Data e hora', value: 'date' },
  ...(form.productType === 'desktop' ? [] : [{ label: 'Dias', value: 'days' }]),
])

watch(() => props.modelValue, value => {
  if (!value) return
  paidAmount.value = null
  form.productType = props.license?.productType || 'desktop'
  form.permanent = props.mode === 'grant'
    ? form.productType === 'cloud'
    : props.license?.permanent !== false && !props.license?.expiresAt
  form.durationDays = props.license?.durationDays || 365
  form.durationMonths = props.license?.durationMonths || 12
  form.kind = props.mode === 'edit' ? 'date' : 'months'
  const expiry = new Date(props.license?.expiresAt || Date.now() + 365 * 86400000)
  form.date = Number.isFinite(expiry.getTime())
    ? new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : ''
})

function changeProduct(type) {
  form.productType = type
  form.permanent = type === 'cloud'
  form.kind = 'months'
}

function validInteger(value, max) {
  const text = String(value ?? '').trim()
  const number = Number(text)
  return /^\d+$/.test(text) && Number.isSafeInteger(number) && number >= 1 && number <= max ? number : null
}

function termInput() {
  if (form.permanent) return { permanent: true }
  if (form.kind === 'date') {
    const value = new Date(form.date)
    if (!Number.isFinite(value.getTime())) throw Error('Escolha uma data e hora válidas.')
    if (props.mode !== 'edit' && value <= new Date()) throw Error('Escolha uma data futura.')
    if (props.mode === 'renew' && value <= new Date(props.license?.expiresAt)) throw Error('Escolha uma data posterior à validade atual.')
    return { permanent: false, expiresAt: value.toISOString() }
  }
  if (form.kind === 'days') {
    const days = validInteger(form.durationDays, 36500)
    if (!days) throw Error('Informe de 1 a 36.500 dias inteiros.')
    return { permanent: false, durationDays: days }
  }
  const months = validInteger(form.durationMonths, 1200)
  if (!months) throw Error('Informe de 1 a 1200 meses inteiros.')
  return { permanent: false, durationMonths: months }
}

async function save() {
  if (busy.value) return
  let body
  try { body = termInput() }
  catch (error) { $q.notify({ type: 'warning', message: error.message }); return }
  busy.value = true
  try {
    const config = { headers: { Authorization: 'Bearer ' + localStorage.getItem('aito_admin_token') } }
    let result
    if (props.mode === 'grant') {
      body.productType = form.productType
      if (paidAmount.value !== null && paidAmount.value !== '') body.amount = paidAmount.value
      const id = encodeURIComponent(props.customer._id || props.customer.id)
      result = await api.post('/admin/products/aitonotify/customers/' + id + '/license', body, config)
    } else {
      const path = '/admin/botbuilder/licenses/' + encodeURIComponent(props.license._id || props.license.id)
      result = props.mode === 'renew'
        ? await api.post(path + '/renew', body, config)
        : await api.patch(path, body, config)
    }
    const license = result.data.data
    emit('saved', license)
    open.value = false
    $q.notify({ type: 'positive', message: license.expired ? 'Vencimento salvo. Licença expirada.' : 'Licença e validade atualizadas.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível atualizar a validade.' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <q-dialog v-model="open" persistent>
    <q-card class="license-term-card">
      <q-card-section class="license-term-head">
        <div>
          <span>ADMINISTRAÇÃO DE LICENÇAS</span>
          <h3>{{ title }}</h3>
          <p>{{ customer?.name || license?.ownerName || license?.ownerEmail || 'Kit AitoNotify + WhatsApp BotBuilder' }}</p>
        </div>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar validade" :disable="busy" @click="open = false" />
      </q-card-section>
      <q-form @submit.prevent="save">
        <q-card-section class="license-term-fields">
          <template v-if="mode === 'grant'">
            <q-select :model-value="form.productType" :options="products" outlined label="Produto desta licença" emit-value map-options @update:model-value="changeProduct" />
            <q-input v-model="paidAmount" outlined type="number" min="0" max="1000000" step="0.01" prefix="R$" label="Valor pago por este produto (opcional)" hint="Deixe vazio se não informado. Zero significa cortesia." />
          </template>
          <q-toggle v-model="form.permanent" color="teal" label="Token vitalício, sem vencimento programado" />
          <template v-if="!form.permanent">
            <q-select v-model="form.kind" outlined emit-value map-options :options="termOptions" label="Definir vencimento por" />
            <q-input v-if="form.kind === 'months'" v-model="form.durationMonths" outlined inputmode="numeric" label="Validade em meses inteiros" hint="Informe um número inteiro de 1 a 1200." />
            <q-input v-else-if="form.kind === 'days'" v-model="form.durationDays" outlined inputmode="numeric" label="Validade em dias inteiros" />
            <q-input v-else v-model="form.date" outlined type="datetime-local" label="Válida até" stack-label hint="Data e hora no fuso deste dispositivo." />
          </template>
          <q-banner v-if="mode === 'edit' && expiryInPast" rounded class="bg-orange-1 text-orange-10">
            <template #avatar><q-icon name="mdi-clock-alert-outline" /></template>
            Ao salvar, a licença ficará expirada. O Desktop conectado abrirá a tela de renovação.
          </q-banner>
          <q-banner rounded class="license-term-note">
            {{ mode === 'renew' ? 'Os meses ou dias adicionados começam no vencimento atual. Se a licença já venceu, o novo período começa hoje.'
              : mode === 'grant' ? 'O valor informado será registrado como uma venda manual.'
              : 'A alteração de vencimento mantém a chave e a instalação vinculadas.' }}
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" :disable="busy" @click="open = false" />
          <q-btn unelevated no-caps color="teal-8" type="submit" :label="mode === 'renew' ? 'Renovar licença' : mode === 'grant' ? 'Liberar licença' : 'Salvar validade'" :loading="busy" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>.license-term-card{width:min(560px,calc(100vw - 26px));border-radius:22px;background:linear-gradient(145deg,#f7fffb,#e6f6ee);color:#143d30;border:1px solid #9fd8c1}.license-term-head{display:flex;gap:12px;align-items:flex-start;border-bottom:1px solid #c4e1d3}.license-term-head>div{flex:1}.license-term-head span{font-size:9px;letter-spacing:.1em;color:#3e846b;font-weight:800}.license-term-head h3{font-size:23px;line-height:1.3;margin:10px 0}.license-term-head p{font-size:12px;line-height:1.6;color:#658678;margin:0;overflow-wrap:anywhere}.license-term-fields{display:grid;gap:20px}.license-term-note{background:#d7eee2;color:#496e5d;font-size:11px;line-height:1.8}.license-term-card :deep(.q-card__actions){border-top:1px solid #c4e1d3;padding:16px}@media(max-width:450px){.license-term-head h3{font-size:20px}.license-term-card :deep(.q-card__actions){display:grid;grid-template-columns:1fr 1fr}}</style>
