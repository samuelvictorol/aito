<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiBaseURL } from 'boot/axios'
import { waApi, messageOf } from 'src/services/whatsapp'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const configs = ref([]), groups = ref([]), selected = ref(''), busy = ref(false)
const draft = ref(null)
const defaultWebhook = `${String(apiBaseURL).replace(/\/$/, '')}/webhooks/whatsapp/infinitepay`
const selectedConfig = computed(() => configs.value.find(item => item.key === selected.value))
const toReal = cents => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')
function toCents(value) {
  const clean = String(value || '').replace(/[^\d,.]/g, '')
  const decimal = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  return Math.round(Number(decimal || 0) * 100)
}
function edit(config) {
  draft.value = { ...config, webhookUrl: config.webhookUrl || defaultWebhook, originalPrice: toReal(config.originalPriceCents), price: toReal(config.priceCents), recipientsText: (config.recipients || []).join('\n'), contactGroupIds: [...(config.contactGroupIds || [])] }
}
function add() {
  const base = selectedConfig.value || configs.value[0] || { handle: 'aitosoftwares', product: 'Novo produto', originalPriceCents: 129999, priceCents: 89999, paidMessage: '✅ Pagamento de {{valor}} aprovado. Comprovante: {{comprovante}}', declinedMessage: 'Pagamento não confirmado. Tente novamente: {{link_pagamento}}', teamMessage: 'Nova compra de {{valor}} para {{nome_contato}}.', recipients: [], contactGroupIds: [] }
  edit({ ...base, key: '', title: '', webhookUrl: defaultWebhook })
}
async function load() {
  busy.value = true
  try {
    const [payments, contacts] = await Promise.all([waApi.get('/infinitepay/configs'), waApi.get('/contact-groups')])
    configs.value = payments.data.items || []; groups.value = contacts.data.items || []
    if (!selected.value) selected.value = configs.value[0]?.key || ''
  } catch (cause) { $q.notify({ type: 'negative', message: messageOf(cause) }) }
  finally { busy.value = false }
}
async function save() {
  if (!draft.value) return
  const value = draft.value, key = value.key.trim().toLowerCase()
  const originalPriceCents = toCents(value.originalPrice), priceCents = toCents(value.price)
  if (!key || !value.title?.trim() || !value.handle?.trim() || priceCents < 100 || originalPriceCents < priceCents) {
    $q.notify({ type: 'negative', message: 'Confira o identificador, o nome, a InfiniteTag e os preços.' }); return
  }
  busy.value = true
  try {
    const body = { ...value, key, originalPriceCents, priceCents, recipients: value.recipientsText.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean) }
    await waApi.put(`/infinitepay/configs/${encodeURIComponent(key)}`, body)
    selected.value = key; draft.value = null; await load()
    $q.notify({ type: 'positive', message: 'Configuração InfinitePay salva. Novos links usam o preço atualizado.' })
  } catch (cause) { $q.notify({ type: 'negative', message: messageOf(cause) }) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div class="ip-layout">
    <article class="ip-card">
      <div class="ip-heading"><div><span class="ip-kicker">PAGAMENTOS</span><h3>InfinitePay</h3></div><q-btn no-caps color="teal-7" icon="mdi-plus" label="Nova configuração" @click="add" /></div>
      <p>Crie links pelo BotBuilder e acompanhe cada compra no Monitoramento. Use sua InfiniteTag sem o símbolo <b>$</b>. Cada configuração pode ter o mesmo login com preço e mensagens diferentes.</p>
      <div v-for="config in configs" :key="config.key" :class="['ip-item', { active: selected === config.key }]" @click="selected = config.key">
        <div><strong>{{ config.title }}</strong><small>${{ config.handle }} · {{ (config.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }} · {{ config.key }}</small></div>
        <q-btn flat round dense icon="mdi-pencil-outline" aria-label="Editar configuração" @click.stop="edit(config)" />
      </div>
      <p v-if="!configs.length" class="ip-empty">Nenhuma configuração cadastrada.</p>
      <p class="ip-note">A InfinitePay documenta webhook de pagamento <b>aprovado</b>. Uma tentativa recusada não gera um evento de recusa documentado; o pedido continua pendente até confirmação.</p>
      <a href="https://www.infinitepay.io/checkout-documentacao" target="_blank" rel="noopener noreferrer">Ver documentação oficial ↗</a>
    </article>
    <q-dialog :model-value="!!draft" @update:model-value="value => { if (!value) draft = null }"><q-card v-if="draft" class="ip-dialog"><q-card-section><h3>{{ draft.key ? 'Configurar InfinitePay' : 'Nova configuração InfinitePay' }}</h3><p>Valores são exibidos em reais e enviados para a InfinitePay em centavos.</p>
      <div class="ip-fields"><q-input v-model="draft.key" dark outlined label="Identificador interno" :disable="!!configs.find(item => item.key === draft.key)" /><q-input v-model="draft.title" dark outlined label="Nome da configuração" /><q-input v-model="draft.handle" dark outlined prefix="$" label="InfiniteTag / login" /><q-input v-model="draft.product" dark outlined label="Nome do produto" /><q-input v-model="draft.originalPrice" dark outlined inputmode="decimal" label="Preço original (R$)" /><q-input v-model="draft.price" dark outlined inputmode="decimal" label="Preço de venda (R$)" /></div>
      <q-input v-model="draft.webhookUrl" dark outlined label="Webhook InfinitePay" class="q-mt-md" /><p class="ip-note">URL pré-preenchida. Se alterar, ela deve chegar a este servidor e entregar o JSON da InfinitePay para que a compra seja confirmada.</p>
      <q-input v-model="draft.sourceUrl" dark outlined label="Link do código fonte" class="q-mt-md" />
      <q-input v-model="draft.tutorialUrl" dark outlined label="Link do passo a passo / vídeo" class="q-mt-md" />
      <q-toggle v-model="draft.enabled" color="teal-5" label="Permitir novos links nesta configuração" />
      <q-input v-model="draft.paidMessage" dark type="textarea" outlined label="Mensagem de pagamento aprovado para comprador" class="q-mt-md" />
      <q-input v-model="draft.declinedMessage" dark type="textarea" outlined label="Mensagem de pagamento recusado" class="q-mt-md" />
      <q-input v-model="draft.teamMessage" dark type="textarea" outlined label="Mensagem de compra para equipe" class="q-mt-md" />
      <q-input v-model="draft.recipientsText" dark type="textarea" outlined label="Telefones da equipe (um por linha)" class="q-mt-md" />
      <q-select v-model="draft.contactGroupIds" dark popup-content-class="ip-group-menu" outlined multiple emit-value map-options use-chips :options="groups.map(group => ({ label: group.name, value: group._id }))" label="Grupos da equipe" class="q-mt-md" />
      <p class="ip-note">Variáveis: <code v-pre>{{nome_contato}}</code>, <code v-pre>{{num_contato}}</code>, <code v-pre>{{valor}}</code>, <code v-pre>{{valor_original}}</code>, <code v-pre>{{produto}}</code>, <code v-pre>{{pedido}}</code>, <code v-pre>{{comprovante}}</code>, <code v-pre>{{link_pagamento}}</code>.</p>
      </q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" @click="draft = null" /><q-btn color="teal-7" no-caps label="Salvar configuração" :loading="busy" @click="save" /></q-card-actions></q-card></q-dialog>
  </div>
</template>

<style scoped>
.ip-layout{display:block;margin:18px 0}.ip-card{min-width:0;padding:22px;border:1px solid #245049;border-radius:13px;background:#0c272a}.ip-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.ip-heading h3{margin:3px 0 0}.ip-kicker{color:#7fd9c0;font-size:10px;letter-spacing:.1em;font-weight:800}.ip-card p,.ip-dialog p{color:#b8d5cc;font-size:12px;line-height:1.55}.ip-item{display:flex;align-items:center;gap:7px;padding:12px 8px;border-bottom:1px solid #24473f;cursor:pointer}.ip-item.active{background:#164139;border-radius:8px}.ip-item>div{flex:1;min-width:0}.ip-item strong,.ip-item small{display:block}.ip-item strong{font-size:12px}.ip-item small{margin-top:3px;color:#9abbaf;font-size:10px;overflow-wrap:anywhere}.ip-note{padding:9px 11px;border-radius:8px;background:#173732}.ip-card a{color:#9df4dc}.ip-dialog{width:min(92vw,680px);max-width:92vw;max-height:90dvh;overflow:auto;background:#102c2e;color:#e8fff6}.ip-dialog :deep(.q-field__control){color:#e8fff6;background:#173c3d}.ip-dialog :deep(.q-field__native),.ip-dialog :deep(.q-field__input),.ip-dialog :deep(.q-field__label),.ip-dialog :deep(.q-field__prefix),.ip-dialog :deep(.q-field__marginal){color:#f0fffb!important}.ip-dialog :deep(.q-field__bottom),.ip-dialog :deep(.q-field__messages){color:#b8d5cc!important}.ip-dialog :deep(.q-field--outlined .q-field__control:before){border-color:#70938b}.ip-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ip-empty{padding:15px;text-align:center}@media(max-width:800px){.ip-fields{grid-template-columns:1fr}.ip-card{padding:16px}.ip-heading{align-items:flex-start}.ip-heading .q-btn{font-size:10px}}
</style>
