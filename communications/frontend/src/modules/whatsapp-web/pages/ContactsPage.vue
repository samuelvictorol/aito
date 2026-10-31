<script setup>
import { vCanAction } from '../../../services/permission-directives.js'
import { canArea } from '../../../services/access.js'
import { getStoredUser } from '../../../services/tokens.js'
import { computed, onMounted, ref } from 'vue'
import { api, messageOf } from '../services.js'

const groups = ref([])
const contacts = ref([])
const search = ref('')
const page = ref(1)
const pages = ref(1)
const loading = ref(false)
const saving = ref(false)
const toast = ref('')
const groupId = ref('')
const group = ref({ name: '', contactsText: '' })
const recipientCount = computed(() => recipients().length)

function show(value) {
  toast.value = value
  setTimeout(() => { if (toast.value === value) toast.value = '' }, 4000)
}
function recipients() {
  return [...new Set(group.value.contactsText.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean))]
}
async function loadGroups() {
  try { groups.value = (await api.get('/integrations/contact-groups')).data.items }
  catch (error) { show(messageOf(error)) }
}
async function loadContacts(nextPage = 1) {
  if (!canArea(getStoredUser(), 'whatsapp_web')) { contacts.value = []; return }
  loading.value = true
  try {
    const { data } = await api.get('/chats', { params: { page: nextPage, limit: 30, search: search.value } })
    contacts.value = data.items.filter(item => !item.isGroup)
    page.value = data.page
    pages.value = data.pages
  } catch (error) { show(messageOf(error)) }
  finally { loading.value = false }
}
function editGroup(item) {
  groupId.value = item._id
  group.value = { name: item.name, contactsText: item.contacts.join('\n') }
  document.querySelector('#group-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function clearGroup() {
  groupId.value = ''
  group.value = { name: '', contactsText: '' }
}
function addContact(item) {
  const target = item.phone || item.externalId
  if (!target || recipients().includes(target)) return
  group.value.contactsText = [...recipients(), target].join('\n')
  show(`${item.displayName || target} adicionado à edição do grupo.`)
}
async function saveGroup() {
  const contacts = recipients()
  if (!group.value.name.trim() || !contacts.length) return show('Informe um nome e ao menos um destinatário.')
  saving.value = true
  try {
    const body = { name: group.value.name.trim(), contacts }
    if (groupId.value) await api.put(`/integrations/contact-groups/${groupId.value}`, body)
    else await api.post('/integrations/contact-groups', body)
    clearGroup()
    await loadGroups()
    show('Grupo salvo. Ele já pode ser usado nos cards e nos pagamentos.')
  } catch (error) { show(messageOf(error)) }
  finally { saving.value = false }
}
async function deleteGroup(item) {
  if (!confirm(`Apagar o grupo “${item.name}”?`)) return
  saving.value = true
  try {
    await api.delete(`/integrations/contact-groups/${item._id}`)
    if (groupId.value === item._id) clearGroup()
    await loadGroups()
    show('Grupo removido.')
  } catch (error) { show(messageOf(error)) }
  finally { saving.value = false }
}
onMounted(() => { loadGroups(); loadContacts() })
</script>

<template>
  <section>
    <div class="page-head"><div><span class="eyebrow">Destinatários do WhatsApp</span><h1>Contatos</h1><p>Organize grupos para notificações de pagamento e cards de Chat WhatsApp.</p></div><button class="btn secondary" @click="loadGroups(); loadContacts(page)">Atualizar</button></div>
    <div class="contacts-grid">
      <article v-can-action="['web_contacts.create', 'web_contacts.edit']" id="group-editor" class="card panel">
        <div class="panel-head"><h2>{{ groupId ? 'Editar grupo' : 'Novo grupo' }}</h2><button v-if="groupId" class="btn ghost" @click="clearGroup">Cancelar edição</button></div>
        <div class="field"><label for="group-name">Nome do grupo</label><input id="group-name" v-model="group.name" placeholder="Ex.: Equipe comercial" maxlength="120"></div>
        <div class="field"><label for="group-contacts">Telefones ou IDs de grupo, um por linha</label><textarea id="group-contacts" v-model="group.contactsText" placeholder="5511999999999"></textarea><small>{{ recipientCount }} destinatário(s). Você também pode adicionar um contato da lista ao lado.</small></div>
        <button v-can-action="groupId ? 'web_contacts.edit' : 'web_contacts.create'" class="btn" :disabled="saving" @click="saveGroup">{{ saving ? 'Salvando…' : groupId ? 'Salvar alterações' : 'Criar grupo' }}</button>
      </article>
      <article class="card panel">
        <h2>Grupos salvos</h2>
        <p v-if="!groups.length" class="empty-note">Nenhum grupo cadastrado.</p>
        <div v-for="item in groups" :key="item._id" class="group-row"><div><strong>{{ item.name }}</strong><small>{{ item.contacts.length }} destinatário(s)</small></div><div class="row-actions"><button v-can-action="'web_contacts.edit'" class="btn secondary" @click="editGroup(item)">Editar</button><button v-can-action="'web_contacts.delete'" class="btn danger" :disabled="saving" @click="deleteGroup(item)">Apagar</button></div></div>
      </article>
      <article v-if="canArea(getStoredUser(), 'whatsapp_web')" class="card panel contacts-panel">
        <div class="panel-head"><div><h2>Conversas recentes</h2><p>Adicione um contato ao grupo em edição.</p></div></div>
        <div class="field"><label for="contact-search">Buscar nome ou telefone</label><input id="contact-search" v-model="search" placeholder="Nome ou telefone" @keyup.enter="loadContacts(1)"></div>
        <button class="btn secondary" @click="loadContacts(1)">Buscar</button>
        <p v-if="loading" class="empty-note">Carregando contatos…</p><p v-else-if="!contacts.length" class="empty-note">Nenhum contato nesta página.</p>
        <div v-for="item in contacts" :key="item._id" class="contact-row"><div><strong>{{ item.displayName || item.phone || item.externalId }}</strong><small>{{ item.phone || item.externalId }}</small></div><button v-can-action="['web_contacts.create', 'web_contacts.edit']" class="btn secondary" :disabled="!item.phone && !item.externalId" @click="addContact(item)">Adicionar</button></div>
        <div v-if="pages > 1" class="pagination"><button :disabled="page <= 1" @click="loadContacts(page - 1)">←</button><span>{{ page }} / {{ pages }}</span><button :disabled="page >= pages" @click="loadContacts(page + 1)">→</button></div>
      </article>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped>
.contacts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{padding:22px;display:grid;align-content:start;gap:13px;min-width:0}.panel h2{margin:0;font-size:1.2rem}.panel-head,.group-row,.contact-row,.row-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.panel-head p,.empty-note{margin:4px 0;color:var(--muted);font-size:.83rem}.group-row,.contact-row{padding:12px;border:1px solid var(--line);border-radius:11px;background:#f8fbfa;min-width:0}.group-row>div:first-child,.contact-row>div:first-child{min-width:0}.group-row strong,.contact-row strong,.group-row small,.contact-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.group-row small,.contact-row small{margin-top:3px;color:var(--muted);font-size:.75rem}.contacts-panel{grid-column:1/-1}.contacts-panel>.btn{justify-self:start}.row-actions .btn,.contact-row .btn{min-width:70px}.pagination{align-items:center}.pagination button:disabled{opacity:.4}@media(max-width:800px){.contacts-grid{grid-template-columns:1fr}.contacts-panel{grid-column:auto}}@media(max-width:480px){.panel{padding:16px}.group-row{align-items:flex-start;flex-direction:column}.row-actions{width:100%;justify-content:flex-start}}
</style>
