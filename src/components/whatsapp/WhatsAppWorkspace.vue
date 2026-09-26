<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import WhatsAppChats from './WhatsAppChats.vue'
import { waApi, unwrap, openWhatsAppSocket, messageOf } from 'src/services/whatsapp'

const $q = useQuasar()
const BotFlows = defineAsyncComponent(() => import('./BotFlows.vue'))
const WhatsAppTools = defineAsyncComponent(() => import('./WhatsAppTools.vue'))
const WhatsAppContacts = defineAsyncComponent(() => import('./WhatsAppContacts.vue'))
const tab = ref('chats'), status = ref({ status: 'offline' }), connected = ref(false), revision = ref(0), messageEvent = ref(null), chatEvent = ref(null), requestedChat = ref(null)
let socket, refreshTimer
const connectionLabel = computed(() => ({ online: 'WhatsApp conectado', ready: 'WhatsApp conectado', authenticated: 'Iniciando WhatsApp', authenticating: 'Autenticando WhatsApp', connecting: 'Conectando WhatsApp', auth_required: 'Reconecte o WhatsApp', initializing: 'Iniciando WhatsApp', reconnecting: 'Reconectando', waiting_qr: 'Leia o QR Code', qr: 'Leia o QR Code', offline: 'WhatsApp desconectado', error: 'Conexão requer atenção', disabled: 'Conexão desabilitada' })[status.value.status] || status.value.status || 'Verificando conexão')
const online = computed(() => ['online', 'ready'].includes(status.value.status))
async function refreshStatus(silent = false) { try { status.value = unwrap(await waApi.get('/status')) } catch (error) { if (!silent) $q.notify({ type: 'negative', message: messageOf(error) }) } }
onMounted(() => {
  refreshStatus()
  socket = openWhatsAppSocket()
  socket.on('connect', () => { connected.value = true; revision.value++; refreshStatus() })
  socket.on('disconnect', () => { connected.value = false })
  socket.on('connect_error', () => { connected.value = false })
  socket.on('whatsapp.status', (value) => { status.value = value?.data || value })
  socket.on('chat.updated', (value) => { chatEvent.value = { ...value, _eventAt: Date.now() } })
  socket.on('chat.deleted', (value) => { chatEvent.value = { ...(value?.data || value), deleted: true, _eventAt: Date.now() } })
  socket.on('message.updated', (value) => { messageEvent.value = { ...value, _eventAt: Date.now() } })
  refreshTimer = window.setInterval(() => { if (!connected.value && !document.hidden) { revision.value++; refreshStatus(true) } }, 20000)
})
onBeforeUnmount(() => { clearInterval(refreshTimer); socket?.disconnect() })
function openContact(chat) { requestedChat.value = { ...chat, _requestedAt: Date.now() }; tab.value = 'chats' }
</script>

<template>
  <section class="wa-workspace">
    <div class="wa-statusbar"><span><i :class="{ online }" />{{ connectionLabel }}</span><span class="wa-live"><q-icon :name="connected ? 'mdi-access-point' : 'mdi-access-point-off'" />{{ connected ? 'Atualização em tempo real' : 'Reconectando painel…' }}</span><q-btn v-if="!online" dense flat no-caps label="Ver conexão" @click="tab = 'connection'" /></div>
    <q-tabs v-model="tab" dense align="left" outside-arrows mobile-arrows active-color="teal-3" indicator-color="teal-4" class="wa-subtabs">
      <q-tab name="chats" icon="mdi-message-text-outline" label="Conversas" />
      <q-tab name="contacts" icon="mdi-contacts-outline" label="Contatos" />
      <q-tab name="flows" icon="mdi-sitemap-outline" label="Fluxo BotBuilder" />
      <q-tab name="connection" icon="mdi-qrcode" label="Conexão" />
      <q-tab name="assets" icon="mdi-folder-multiple-image" label="Arquivos" />
      <q-tab name="integrations" icon="mdi-connection" label="Integrações" />
      <q-tab name="monitor" icon="mdi-chart-line" label="Monitoramento" />
    </q-tabs>
    <WhatsAppChats v-show="tab === 'chats'" :visible="tab === 'chats'" :status="status" :revision="revision" :message-event="messageEvent" :chat-event="chatEvent" :requested-chat="requestedChat" />
    <WhatsAppContacts v-if="tab === 'contacts'" :revision="revision" @open-chat="openContact" />
    <BotFlows v-if="tab === 'flows'" />
    <WhatsAppTools v-if="!['chats', 'contacts', 'flows'].includes(tab)" :key="tab" :tab="tab" :status="status" @refresh="refreshStatus" />
  </section>
</template>

<style scoped>
.wa-workspace{--wa-bg:#071b1e;--wa-line:#1b3c3e;--wa-muted:#97b5b3;color:#e8fffa;background:var(--wa-bg);font-size:13px;min-width:0}.wa-statusbar{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--wa-line);font-size:11px;color:#bfd6d3}.wa-statusbar>span{display:flex;align-items:center;gap:7px}.wa-statusbar i{width:7px;height:7px;background:#f6bb59;border-radius:50%}.wa-statusbar i.online{background:#51dcbd}.wa-live{margin-left:auto;color:var(--wa-muted)}.wa-subtabs{border-bottom:1px solid var(--wa-line)}.wa-subtabs :deep(.q-tab__label){font-size:11px;text-transform:none}.wa-subtabs :deep(.q-tab){min-height:57px}.wa-subtabs :deep(.q-tab__icon){font-size:20px}.wa-workspace :deep(.q-field__native),.wa-workspace :deep(.q-field__label),.wa-workspace :deep(.q-field__prefix),.wa-workspace :deep(.q-field__append),.wa-workspace :deep(.q-field__prepend){color:inherit}.wa-workspace :deep(.q-field--outlined .q-field__control:before){border-color:#395456}.wa-workspace :deep(.q-field){color:#d9f7ef}.wa-workspace :deep(.q-table){color:#daf2ee}.wa-workspace :deep(.q-table__container){background:transparent;color:#daf2ee}@media(max-width:600px){.wa-statusbar{gap:8px;padding:10px;font-size:10px}.wa-live{display:none}.wa-subtabs :deep(.q-tab){padding:8px 12px}}
</style>

<style scoped>
.wa-workspace :deep(.q-field__native),.wa-workspace :deep(.q-field__input),.wa-workspace :deep(.q-field__label),.wa-workspace :deep(.q-field__prepend),.wa-workspace :deep(.q-field__append){color:#d9f7ef!important}.wa-workspace :deep(.q-field__native::placeholder),.wa-workspace :deep(.q-field__input::placeholder){color:#91b4ad;opacity:1}
</style>
