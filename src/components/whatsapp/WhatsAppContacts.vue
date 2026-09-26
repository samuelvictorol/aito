<script setup>
import { onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { waApi, unwrap, messageOf, formatDate } from 'src/services/whatsapp'

const props = defineProps({ revision: Number })
const emit = defineEmits(['open-chat'])
const $q = useQuasar()
const contacts = ref([]), total = ref(0), page = ref(1), pages = ref(1), search = ref(''), loading = ref(false), opening = ref('')
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
watch(search, () => { clearTimeout(timer); page.value = 1; timer = setTimeout(load, 300) })
watch(() => props.revision, load)
onMounted(load)
</script>

<template>
  <section class="wa-contacts">
    <header><div><h2>Contatos</h2><p>{{ total }} contatos salvos automaticamente pelo WhatsApp</p></div><q-input v-model="search" dense outlined clearable placeholder="Buscar nome ou telefone"><template #prepend><q-icon name="mdi-magnify" /></template></q-input></header>
    <q-linear-progress v-if="loading" indeterminate color="teal-3" />
    <div class="wa-contact-grid">
      <article v-for="contact in contacts" :key="contact._id">
        <q-avatar size="54px" color="teal-9" text-color="teal-2"><img v-if="contact.avatarUrl" :src="contact.avatarUrl" :alt="contact.name || contact.phone" loading="lazy" /><span v-else>{{ (contact.name || contact.phone || '?').slice(0, 1).toUpperCase() }}</span></q-avatar>
        <div><strong>{{ contact.name || contact.phone }}</strong><span>{{ contact.phone }}</span><small>{{ contact.lastSeenAt ? `Último contato: ${formatDate(contact.lastSeenAt)}` : 'Contato salvo' }}</small></div>
        <q-btn outline no-caps color="teal-3" icon="mdi-message-text-outline" label="Abrir conversa" :loading="opening === contact._id" @click="open(contact)" />
      </article>
    </div>
    <div v-if="!loading && !contacts.length" class="wa-empty"><q-icon name="mdi-account-search-outline" size="46px" /><p>Nenhum contato encontrado.</p><span>Os contatos aparecem aqui automaticamente quando conversam pelo WhatsApp.</span></div>
    <q-pagination v-if="pages > 1" v-model="page" :max="pages" :max-pages="7" color="teal-4" @update:model-value="load" />
  </section>
</template>

<style scoped>
.wa-contacts{min-height:560px;padding:22px;background:#081d20}.wa-contacts>header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.wa-contacts h2{margin:0 0 4px;font-size:22px}.wa-contacts p{margin:0;color:var(--wa-muted);font-size:11px}.wa-contacts>header .q-field{width:min(100%,360px)}.wa-contact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:10px}.wa-contact-grid article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;padding:14px;border:1px solid var(--wa-line);border-radius:12px;background:#0e292d}.wa-contact-grid article>div{min-width:0}.wa-contact-grid strong,.wa-contact-grid span,.wa-contact-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-contact-grid strong{font-size:13px}.wa-contact-grid span{margin-top:3px;color:#a7c8c1;font-size:11px}.wa-contact-grid small{margin-top:5px;color:#739c94;font-size:9px}.wa-empty{display:grid;place-items:center;padding:70px 20px;text-align:center;color:#7ba49d}.wa-empty p{margin:12px 0 3px;color:#b9d7d1;font-size:14px}.wa-empty span{font-size:10px}.wa-contacts>.q-pagination{justify-content:center;margin-top:22px}@media(max-width:650px){.wa-contacts{padding:14px}.wa-contacts>header{align-items:stretch;flex-direction:column}.wa-contacts>header .q-field{width:100%}.wa-contact-grid{grid-template-columns:1fr}.wa-contact-grid article{grid-template-columns:auto minmax(0,1fr)}.wa-contact-grid article>.q-btn{grid-column:1/-1;width:100%}}
</style>
