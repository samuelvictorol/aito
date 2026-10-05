<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiBaseURL } from 'boot/axios'
import { waApi, messageOf } from 'src/services/whatsapp'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const configs = ref([]), groups = ref([]), selected = ref(''), busy = ref(false)
const draft = ref(null), groupDraft = ref({ name: '', contacts: '' }), groupId = ref('')
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
function editGroup(group) { groupId.value = group?._id || ''; groupDraft.value = { name: group?.name || '', contacts: (group?.contacts || []).join('\n') } }
async function saveGroup() {
  const contacts = groupDraft.value.contacts.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean)
  if (!groupDraft.value.name.trim() || !contacts.length) return
  busy.value = true
  try {
    if (groupId.value) await waApi.put(`/contact-groups/${groupId.value}`, { name: groupDraft.value.name, contacts })
    else await waApi.post('/contact-groups', { name: groupDraft.value.name, contacts })
    groupId.value = ''; groupDraft.value = { name: '', contacts: '' }; await load()
    $q.notify({ type: 'positive', message: 'Grupo de contatos salvo.' })
  } catch (cause) { $q.notify({ type: 'negative', message: messageOf(cause) }) }
  finally { busy.value = false }
}
async function removeGroup(group) {
  $q.dialog({ title: 'Excluir grupo de contatos', message: `Excluir ${group.name}? Cards que usam este grupo precisarão ser atualizados.`, cancel: true }).onOk(async () => {
    try { await waApi.delete(`/contact-groups/${group._id}`); await load() } catch (cause) { $q.notify({ type: 'negative', message: messageOf(cause) }) }
  })
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
    <article class="ip-card"><div class="ip-heading"><div><span class="ip-kicker">DESTINATÁRIOS</span><h3>Grupos de contatos</h3></div></div>
      <p>Organize telefones e IDs de grupos do WhatsApp para usar nos cards “Chat WhatsApp” e nas notificações de compra.</p>
      <div v-for="group in groups" :key="group._id" class="ip-item"><div><strong>{{ group.name }}</strong><small>{{ group.contacts.length }} destinatário(s)</small></div><q-btn flat round dense icon="mdi-pencil-outline" aria-label="Editar grupo" @click="editGroup(group)" /><q-btn flat round dense icon="mdi-delete-outline" color="red-3" aria-label="Excluir grupo" @click="removeGroup(group)" /></div>
      <q-input v-model="groupDraft.name" outlined dense label="Nome do grupo" class="q-mt-md" />
      <q-input v-model="groupDraft.contacts" type="textarea" outlined label="Telefones ou IDs de grupo, um por linha" hint="Telefone com DDI e DDD, ou 12345@g.us" class="q-mt-md" />
      <div class="ip-actions"><q-btn v-if="groupId" flat no-caps label="Cancelar edição" @click="editGroup()" /><q-btn color="teal-7" no-caps :label="groupId ? 'Salvar grupo' : 'Criar grupo'" :loading="busy" @click="saveGroup" /></div>
    </article>
    <q-dialog :model-value="!!draft" @update:model-value="value => { if (!value) draft = null }"><q-card v-if="draft" class="ip-dialog"><q-card-section><h3>{{ draft.key ? 'Configurar InfinitePay' : 'Nova configuração InfinitePay' }}</h3><p>Valores são exibidos em reais e enviados para a InfinitePay em centavos.</p>
      <div class="ip-fields"><q-input v-model="draft.key" outlined label="Identificador interno" :disable="!!configs.find(item => item.key === draft.key)" /><q-input v-model="draft.title" outlined label="Nome da configuração" /><q-input v-model="draft.handle" outlined prefix="$" label="InfiniteTag / login" /><q-input v-model="draft.product" outlined label="Nome do produto" /><q-input v-model="draft.originalPrice" outlined inputmode="decimal" label="Preço original (R$)" /><q-input v-model="draft.price" outlined inputmode="decimal" label="Preço de venda (R$)" /></div>
      <q-input v-model="draft.webhookUrl" outlined label="Webhook InfinitePay" class="q-mt-md" /><p class="ip-note">URL pré-preenchida. Se alterar, ela deve chegar a este servidor e entregar o JSON da InfinitePay para que a compra seja confirmada.</p>
      <q-input v-model="draft.sourceUrl" outlined label="Link do código fonte" class="q-mt-md" />
      <q-input v-model="draft.tutorialUrl" outlined label="Link do passo a passo / vídeo" class="q-mt-md" />
      <q-toggle v-model="draft.enabled" color="teal-5" label="Permitir novos links nesta configuração" />
      <q-input v-model="draft.paidMessage" type="textarea" outlined label="Mensagem de pagamento aprovado para comprador" class="q-mt-md" />
      <q-input v-model="draft.declinedMessage" type="textarea" outlined label="Mensagem de pagamento recusado" class="q-mt-md" />
      <q-input v-model="draft.teamMessage" type="textarea" outlined label="Mensagem de compra para equipe" class="q-mt-md" />
      <q-input v-model="draft.recipientsText" type="textarea" outlined label="Telefones da equipe (um por linha)" class="q-mt-md" />
      <q-select v-model="draft.contactGroupIds" outlined multiple emit-value map-options use-chips :options="groups.map(group => ({ label: group.name, value: group._id }))" label="Grupos da equipe" class="q-mt-md" />
      <p class="ip-note">Variáveis: <code v-pre>{{nome_contato}}</code>, <code v-pre>{{num_contato}}</code>, <code v-pre>{{valor}}</code>, <code v-pre>{{valor_original}}</code>, <code v-pre>{{produto}}</code>, <code v-pre>{{pedido}}</code>, <code v-pre>{{comprovante}}</code>, <code v-pre>{{link_pagamento}}</code>.</p>
      </q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" @click="draft = null" /><q-btn color="teal-7" no-caps label="Salvar configuração" :loading="busy" @click="save" /></q-card-actions></q-card></q-dialog>
  </div>
</template>

<style scoped>
.ip-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0}.ip-card{min-width:0;padding:22px;border:1px solid #245049;border-radius:13px;background:#0c272a}.ip-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.ip-heading h3{margin:3px 0 0}.ip-kicker{color:#7fd9c0;font-size:10px;letter-spacing:.1em;font-weight:800}.ip-card p,.ip-dialog p{color:#98b9b0;font-size:12px;line-height:1.55}.ip-item{display:flex;align-items:center;gap:7px;padding:12px 8px;border-bottom:1px solid #24473f;cursor:pointer}.ip-item.active{background:#164139;border-radius:8px}.ip-item>div{flex:1;min-width:0}.ip-item strong,.ip-item small{display:block}.ip-item strong{font-size:12px}.ip-item small{margin-top:3px;color:#9abbaf;font-size:10px;overflow-wrap:anywhere}.ip-note{padding:9px 11px;border-radius:8px;background:#173732}.ip-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.ip-card a{color:#9df4dc}.ip-dialog{width:min(92vw,680px);max-width:92vw;max-height:90dvh;overflow:auto;background:#102c2e;color:#e8fff6}.ip-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ip-empty{padding:15px;text-align:center}@media(max-width:800px){.ip-layout,.ip-fields{grid-template-columns:1fr}.ip-card{padding:16px}.ip-heading{align-items:flex-start}.ip-heading .q-btn{font-size:10px}}
</style>
