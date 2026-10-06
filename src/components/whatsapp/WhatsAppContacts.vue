<script setup>
import { onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { waApi, unwrap, messageOf, formatDate } from 'src/services/whatsapp'
import LicenseTokenList from './LicenseTokenList.vue'

const props = defineProps({ revision: Number })
const emit = defineEmits(['open-chat'])
const $q = useQuasar()
const contacts = ref([]), total = ref(0), page = ref(1), pages = ref(1), search = ref(''), loading = ref(false), opening = ref('')
const groups = ref([]), groupDialog = ref(false), groupDraft = ref({ name: '', contacts: '' }), groupId = ref(''), savingGroup = ref(false)
const tokenCreating = ref('')
let timer, epoch = 0

async function load() {
  const current = ++epoch; loading.value = true
  try {
    const result = unwrap(await waApi.get('/contacts', { params: { q: search.value || undefined, page: page.value, limit: 50 } }))
    if (current !== epoch) return
    contacts.value = result.items || []; total.value = result.total || 0; pages.value = Math.max(1, result.pages || 1)
  } catch (error) { if (current === epoch) $q.notify({ type: 'negative', message: messageOf(error) }) }
  finally { if (current === epoch) loading.value = false }
}
async function open(contact) {
  opening.value = contact._id
  try { const chat = unwrap(await waApi.post('/chats', { phone: contact.phone, name: contact.name })); emit('open-chat', chat.chat || chat) }
  catch (error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
  finally { opening.value = '' }
}
async function loadGroups() {
  try { groups.value = unwrap(await waApi.get('/contact-groups')).items || [] }
  catch (error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
}
function editGroup(group = null, contact = null) {
  groupId.value = group?._id || ''
  groupDraft.value = { name: group?.name || '', contacts: (group?.contacts || (contact?.phone ? [contact.phone] : [])).join('\n') }
  groupDialog.value = true
}
async function saveGroup() {
  const contacts = groupDraft.value.contacts.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean)
  if (!groupDraft.value.name.trim() || !contacts.length) return
  savingGroup.value = true
  try {
    const body = { name: groupDraft.value.name.trim(), contacts }
    if (groupId.value) await waApi.put(`/contact-groups/${groupId.value}`, body)
    else await waApi.post('/contact-groups', body)
    groupDialog.value = false
    await loadGroups()
    $q.notify({ type: 'positive', message: 'Grupo de contatos salvo.' })
  } catch (error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
  finally { savingGroup.value = false }
}
function removeGroup(group) {
  $q.dialog({ title: 'Excluir grupo de contatos', message: `Excluir ${group.name}? Os cards que usam este grupo precisarão ser atualizados.`, cancel: true }).onOk(async () => {
    try { await waApi.delete(`/contact-groups/${group._id}`); await loadGroups() }
    catch (error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
  })
}
async function createToken(contact) { tokenCreating.value = contact._id; try { await waApi.post(`/contacts/${encodeURIComponent(contact.phone)}/licenses`); await load(); $q.notify({ type: 'positive', message: 'Token criado para este contato.' }) } catch (e) { $q.notify({ type: 'negative', message: messageOf(e) }) } finally { tokenCreating.value = '' } }
watch(search, () => { clearTimeout(timer); page.value = 1; timer = setTimeout(load, 300) })
watch(() => props.revision, load)
onMounted(() => { load(); loadGroups() })
</script>

<template>
  <section class="wa-contacts">
    <header><div><h2>Contatos</h2><p>{{ total }} contatos salvos automaticamente pelo WhatsApp</p></div><q-input v-model="search" dense outlined clearable placeholder="Buscar nome ou telefone"><template #prepend><q-icon name="mdi-magnify" /></template></q-input></header>
    <section class="wa-groups"><div class="wa-groups__heading"><div><h3>Grupos de contatos</h3><p>Use estes destinatários nos cards Chat WhatsApp e nas notificações de compra.</p></div><q-btn no-caps color="teal-7" icon="mdi-plus" label="Novo grupo" @click="editGroup()" /></div><div v-if="groups.length" class="wa-groups__list"><article v-for="group in groups" :key="group._id"><div><strong>{{ group.name }}</strong><span>{{ group.contacts?.length || 0 }} destinatário(s)</span></div><q-btn flat round dense icon="mdi-pencil-outline" aria-label="Editar grupo" @click="editGroup(group)" /><q-btn flat round dense color="red-3" icon="mdi-delete-outline" aria-label="Excluir grupo" @click="removeGroup(group)" /></article></div><p v-else class="wa-groups__empty">Nenhum grupo criado.</p></section>
    <q-linear-progress v-if="loading" indeterminate color="teal-3" />
    <div class="wa-contact-grid">
      <article v-for="contact in contacts" :key="contact._id">
        <q-avatar size="54px" color="teal-9" text-color="teal-2"><img v-if="contact.avatarUrl" :src="contact.avatarUrl" :alt="contact.name || contact.phone" loading="lazy" /><span v-else>{{ (contact.name || contact.phone || '?').slice(0, 1).toUpperCase() }}</span></q-avatar>
        <div class="wa-contact-grid__details"><strong>{{ contact.name || contact.phone }}</strong><span>{{ contact.phone }}</span><small>{{ contact.lastSeenAt ? `Último contato: ${formatDate(contact.lastSeenAt)}` : 'Contato salvo' }}</small></div>
        <div class="wa-contact-grid__actions"><q-btn outline no-caps color="teal-3" icon="mdi-message-text-outline" label="Abrir conversa" :loading="opening === contact._id" @click="open(contact)" /><q-btn flat no-caps color="teal-3" icon="mdi-account-multiple-plus-outline" label="Criar grupo" @click="editGroup(null, contact)" /></div>
        <div class="wa-contact-grid__license-head"><strong>WhatsApp BotBuilder</strong><q-btn v-if="!contact.licenses?.length" flat dense no-caps icon="mdi-key-plus" label="Criar token" :loading="tokenCreating === contact._id" @click="createToken(contact)" /></div><LicenseTokenList v-if="contact.licenses?.length" :licenses="contact.licenses" :phone="contact.phone" class="wa-contact-grid__licenses" @changed="load" />
      </article>
    </div>
    <div v-if="!loading && !contacts.length" class="wa-empty"><q-icon name="mdi-account-search-outline" size="46px" /><p>Nenhum contato encontrado.</p><span>Os contatos aparecem aqui automaticamente quando conversam pelo WhatsApp.</span></div>
    <q-pagination v-if="pages > 1" v-model="page" :max="pages" :max-pages="7" color="teal-4" @update:model-value="load" />
    <q-dialog v-model="groupDialog"><q-card class="wa-group-dialog"><q-card-section><h3>{{ groupId ? 'Editar grupo' : 'Novo grupo de contatos' }}</h3><p>Informe telefones com DDI e DDD ou IDs de grupos do WhatsApp.</p><q-input v-model="groupDraft.name" dark outlined label="Nome do grupo" class="q-mt-md" /><q-input v-model="groupDraft.contacts" dark type="textarea" outlined label="Destinatários, um por linha" hint="Ex.: 5561999999999 ou 12345@g.us" class="q-mt-md" /></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn color="teal-7" no-caps label="Salvar grupo" :disable="!groupDraft.name.trim() || !groupDraft.contacts.trim()" :loading="savingGroup" @click="saveGroup" /></q-card-actions></q-card></q-dialog>
  </section>
</template>

<style scoped>
.wa-contacts{min-height:560px;padding:22px;background:#081d20}.wa-contacts>header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.wa-contacts h2{margin:0 0 4px;font-size:22px}.wa-contacts p{margin:0;color:var(--wa-muted);font-size:11px}.wa-contacts>header .q-field{width:min(100%,360px)}.wa-contact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:10px}.wa-contact-grid article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;padding:14px;border:1px solid var(--wa-line);border-radius:12px;background:#0e292d}.wa-contact-grid article>div{min-width:0}.wa-contact-grid strong,.wa-contact-grid span,.wa-contact-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-contact-grid strong{font-size:13px}.wa-contact-grid span{margin-top:3px;color:#a7c8c1;font-size:11px}.wa-contact-grid small{margin-top:5px;color:#739c94;font-size:9px}.wa-empty{display:grid;place-items:center;padding:70px 20px;text-align:center;color:#7ba49d}.wa-empty p{margin:12px 0 3px;color:#b9d7d1;font-size:14px}.wa-empty span{font-size:10px}.wa-contacts>.q-pagination{justify-content:center;margin-top:22px}@media(max-width:650px){.wa-contacts{padding:14px}.wa-contacts>header{align-items:stretch;flex-direction:column}.wa-contacts>header .q-field{width:100%}.wa-contact-grid{grid-template-columns:1fr}.wa-contact-grid article{grid-template-columns:auto minmax(0,1fr)}.wa-contact-grid article>.q-btn{grid-column:1/-1;width:100%}}
.wa-groups{margin-bottom:22px;padding:16px;border:1px solid #27534f;border-radius:12px;background:#0c282b}.wa-groups__heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.wa-groups h3{margin:0 0 5px;font-size:17px}.wa-groups__list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:14px}.wa-groups__list article{display:flex;align-items:center;gap:3px;min-width:0;padding:9px;border:1px solid #32615b;border-radius:8px;background:#103235}.wa-groups__list article>div{flex:1;min-width:0}.wa-groups__list strong,.wa-groups__list span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-groups__list span{margin-top:3px;color:#b1ccc4;font-size:10px}.wa-groups__empty{margin-top:12px!important}.wa-contact-grid__actions{display:grid;gap:4px}.wa-contact-grid__licenses{grid-column:1/-1}.wa-group-dialog{width:min(94vw,520px);max-height:90dvh;overflow:auto;background:#102c2e;color:#e8fff6}.wa-group-dialog h3{margin:0;font-size:19px}.wa-group-dialog p{margin-top:8px;color:#bad6cd}.wa-group-dialog :deep(.q-field__control){color:#e8fff6;background:#173c3d}.wa-group-dialog :deep(.q-field__native),.wa-group-dialog :deep(.q-field__input),.wa-group-dialog :deep(.q-field__label){color:#f0fffb!important}.wa-group-dialog :deep(.q-field__bottom){color:#bad6cd!important}.wa-group-dialog :deep(.q-field--outlined .q-field__control:before){border-color:#70938b}@media(max-width:650px){.wa-groups__heading{align-items:flex-start;flex-direction:column}.wa-contact-grid__actions{grid-column:1/-1;grid-template-columns:1fr 1fr}.wa-contact-grid__actions .q-btn{min-width:0;font-size:10px}}@media(max-width:390px){.wa-contact-grid__actions{grid-template-columns:1fr}}
</style>
