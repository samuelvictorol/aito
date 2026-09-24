<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import MessageBubble from './MessageBubble.vue'
import { waApi, unwrap, requestId, messageOf, formatDate, modeText, sizeText, currentAdmin } from 'src/services/whatsapp'
import { mergeMessage, sameMessage } from 'src/services/whatsapp-message-state'

const props = defineProps({ status: Object, revision: Number, messageEvent: Object, chatEvent: Object, visible: { type: Boolean, default: true } })
const $q = useQuasar(), chats = ref([]), total = ref(0), page = ref(1), search = ref(''), mode = ref(''), active = ref(null), messages = ref([]), draft = ref(''), quoted = ref(null), loading = ref(false), listLoading = ref(false), sending = ref(false), hasMore = ref(false), historyLoading = ref(false), scroller = ref(null), fileInput = ref(null)
const newDialog = ref(false), newContact = ref({ phone: '', name: '' }), forwardDialog = ref(false), forwardMessage = ref(null), forwardIds = ref([]), forwardContacts = ref([]), fileDialog = ref(false), attachment = ref(null), caption = ref(''), uploadBusy = ref(false), contactDialog = ref(false), contact = ref({ name: '', phone: '' }), recording = ref(false), recordingSeconds = ref(0), profileDialog = ref(false)
const forwardRequestId = ref(''), voiceRecording = ref(false)
let searchTimer, listEpoch = 0, messageEpoch = 0, recordTimer, recorder, microphone, recordingChunks = [], draftTimer, readTimer
const admin = currentAdmin()
const draftPrefix = `aito.whatsapp.draft.${admin._id || admin.id || admin.email || 'admin'}.`
const adminId = admin._id || admin.id || admin.sub
const online = computed(() => ['online', 'ready'].includes(props.status?.status))
const ownsChat = computed(() => !!active.value && active.value.mode === 'human' && active.value.assignedTo?.id === adminId)
const canSend = computed(() => ownsChat.value && !sending.value && !uploadBusy.value)
const filters = [{ label: 'Todas', value: '' }, { label: 'Bot', value: 'bot' }, { label: 'Em atendimento', value: 'human' }, { label: 'Finalizados', value: 'closed' }]
function fail(error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
function persistDraft() { if (!active.value?._id) return; try { if (draft.value) localStorage.setItem(`${draftPrefix}${active.value._id}`, draft.value); else localStorage.removeItem(`${draftPrefix}${active.value._id}`) } catch { /* Draft persistence can be disabled by the browser. */ } }
watch(draft, () => { clearTimeout(draftTimer); draftTimer = window.setTimeout(persistDraft, 200) })
async function loadChats(append = false) {
  const epoch = ++listEpoch; listLoading.value = true
  try {
    const result = unwrap(await waApi.get('/chats', { params: { q: search.value || undefined, mode: mode.value || undefined, page: append ? page.value + 1 : 1, limit: 40 } }))
    if (epoch !== listEpoch) return
    chats.value = append ? [...chats.value, ...(result.items || []).filter((item) => !chats.value.some((existing) => existing._id === item._id))] : result.items || []
    total.value = result.total || chats.value.length; page.value = result.page || 1
    const current = chats.value.find((item) => item._id === active.value?._id); if (current) active.value = current
  } catch (error) { if (epoch === listEpoch) fail(error) } finally { if (epoch === listEpoch) listLoading.value = false }
}
watch([search, mode], () => { clearTimeout(searchTimer); searchTimer = window.setTimeout(() => loadChats(), 300) })
async function markRead(id) { try { await waApi.post(`/chats/${id}/read`); const item = chats.value.find((chat) => chat._id === id); if (item) item.unread = 0 } catch { /* Reconcile on the next successful refresh. */ } }
function scrollBottom() { nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight }) }
async function openChat(chat) {
  if (recording.value) stopRecording(true)
  persistDraft(); clearTimeout(draftTimer); const epoch = ++messageEpoch
  active.value = chat; quoted.value = null; messages.value = []; hasMore.value = false; loading.value = true
  try { draft.value = localStorage.getItem(`${draftPrefix}${chat._id}`) || '' } catch { draft.value = '' }
  try {
    const result = unwrap(await waApi.get(`/chats/${chat._id}/messages`, { params: { limit: 60 } }))
    if (epoch !== messageEpoch) return
    for (const message of result.items || []) upsertMessage(message)
    hasMore.value = !!result.hasMore
    markRead(chat._id); scrollBottom()
  } catch (error) { if (epoch === messageEpoch) fail(error) } finally { if (epoch === messageEpoch) loading.value = false }
}
async function loadHistory() {
  if (!active.value || historyLoading.value) return
  historyLoading.value = true; const chatId = active.value._id, epoch = messageEpoch, priorHeight = scroller.value?.scrollHeight || 0
  try {
    const firstSaved = messages.value.find((item) => !item.local)
    const result = unwrap(await waApi.get(`/chats/${chatId}/messages`, { params: { before: firstSaved?._id, limit: 60 } }))
    if (epoch !== messageEpoch) return
    messages.value = [...(result.items || []), ...messages.value].filter((item, index, all) => all.findIndex((other) => other._id === item._id) === index).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); hasMore.value = !!result.hasMore
    await nextTick(); if (scroller.value) scroller.value.scrollTop += scroller.value.scrollHeight - priorHeight
  } catch (error) { fail(error) } finally { historyLoading.value = false }
}
function upsertMessage(message) {
  if (!message?._id || String(message.chatId?._id || message.chatId) !== active.value?._id) return
  const index = messages.value.findIndex((item) => sameMessage(item, message))
  const nearBottom = !scroller.value || scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight < 160
  if (index < 0) messages.value.push(message); else messages.value.splice(index, 1, mergeMessage(messages.value[index], message))
  messages.value.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  if (nearBottom) scrollBottom()
}
watch(() => props.messageEvent, (event) => {
  const message = event?.message || event?.data || event; upsertMessage(message)
  if (props.visible && !document.hidden && String(message?.chatId) === active.value?._id && message.direction === 'in') { clearTimeout(readTimer); readTimer = setTimeout(() => markRead(message.chatId), 500) }
})
watch(() => props.chatEvent, (event) => {
  const chat = event?.chat || event?.data || event; if (!chat?._id) { loadChats(); return }
  if (active.value?._id === chat._id) active.value = { ...active.value, ...chat }
  const index = chats.value.findIndex((item) => item._id === chat._id)
  if (index >= 0) chats.value.splice(index, 1, { ...chats.value[index], ...chat }); else if (!mode.value || mode.value === chat.mode) chats.value.unshift(chat)
  chats.value = chats.value.filter((item) => !mode.value || mode.value === item.mode).sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
})
watch(() => props.revision, () => { if (!props.visible) return; loadChats(); if (active.value) refreshMessages() })
watch(() => props.visible, (visible) => { if (visible && active.value) markRead(active.value._id); else if (!visible && recording.value) stopRecording(true) })
async function refreshMessages() { const id = active.value?._id; if (!id) return; try { const result = unwrap(await waApi.get(`/chats/${id}/messages`, { params: { limit: 60 } })); if (active.value?._id === id) (result.items || []).forEach(upsertMessage) } catch { /* Socket reconnection or polling retries automatically. */ } }
async function chatAction(action) {
  const id = active.value?._id; if (!id) return
  try { const result = unwrap(await waApi.post(`/chats/${id}/${action}`)); const chat = result.chat || result; if (active.value?._id === id) active.value = { ...active.value, ...chat }; await loadChats(); $q.notify({ type: 'positive', message: ({ takeover: 'Conversa assumida. O fluxo foi reiniciado.', release: 'Conversa devolvida ao bot.', close: 'Atendimento finalizado.', reset: 'Fluxo reiniciado.' })[action] }) } catch (error) { fail(error) }
}
function confirmAction(action) { $q.dialog({ title: action === 'close' ? 'Finalizar atendimento' : 'Reiniciar fluxo', message: action === 'close' ? 'Finalizar este atendimento?' : 'Reiniciar o fluxo desta conversa?', cancel: true }).onOk(() => chatAction(action)) }
async function dispatch(payload, existing) {
  const chatId = payload.chatId || active.value?._id; if (!chatId) return
  const id = payload.requestId || requestId(), local = existing || { _id: `local-${id}`, requestId: id, chatId, direction: 'out', createdAt: new Date().toISOString(), actor: { name: admin.name || 'Admin' }, status: 'queued', progress: 5, local: true, ...payload }
  if (active.value?._id === chatId && !existing) { messages.value.push(local); scrollBottom() }
  try { const result = unwrap(await waApi.post(`/chats/${chatId}/messages`, { ...payload, chatId: undefined, requestId: id })); const message = result.message || result; if (message._id) upsertMessage({ ...message, chatId: message.chatId || chatId, requestId: id }); return true }
  catch (error) { const item = messages.value.find((entry) => entry._id === local._id); if (item) { item.status = error.response ? 'failed' : 'uncertain'; item.error = error.response ? messageOf(error) : 'A conexão interrompeu a confirmação. Aguarde a atualização antes de reenviar.'; item.retryPayload = { ...payload, chatId, requestId: id } }; fail(error); return false }
}
async function sendText() {
  const text = draft.value.trim(); if (!text || !canSend.value) return
  const chatId = active.value._id, quotedId = quoted.value?._id; sending.value = true
  draft.value = ''; persistDraft(); quoted.value = null
  try { await dispatch({ chatId, type: 'text', text, quotedId }) } finally { sending.value = false }
}
function composerKey(event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendText() } }
function chooseAttachment(event) { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 16 * 1024 * 1024) { fail(new Error('Escolha um arquivo de até 16 MB.')); return }; attachment.value = file; voiceRecording.value = false; caption.value = ''; fileDialog.value = true }
async function sendFile() {
  if (!attachment.value || !canSend.value) return
  const file = attachment.value, chatId = active.value._id, id = requestId(), text = caption.value, quotedId = quoted.value?._id
  uploadBusy.value = true; fileDialog.value = false; quoted.value = null
  const local = { _id: `local-${id}`, requestId: id, chatId, type: 'media', text, direction: 'out', actor: { name: admin.name || 'Admin' }, createdAt: new Date().toISOString(), status: 'uploading', progress: 1, local: true, asset: { name: file.name, mime: file.type, size: file.size } }
  messages.value.push(local); scrollBottom()
  try {
    const form = new FormData(); form.append('file', file)
    const asset = unwrap(await waApi.post('/assets', form, { onUploadProgress: (event) => { const item = messages.value.find((entry) => entry._id === local._id); if (item) item.progress = Math.min(40, Math.round((event.loaded / (event.total || file.size)) * 40)) } }))
    const item = messages.value.find((entry) => entry._id === local._id); if (item) { item.assetId = asset._id; item.asset = asset; item.status = 'queued'; item.progress = 45 }
    await dispatch({ chatId, type: 'media', assetId: asset._id, text, quotedId, requestId: id, sendAsVoice: voiceRecording.value }, local)
  } catch (error) { const item = messages.value.find((entry) => entry._id === local._id); if (item) { item.status = 'failed'; item.error = `Arquivo não enviado: ${messageOf(error)}. Anexe novamente.` }; fail(error) }
  finally { uploadBusy.value = false; attachment.value = null }
}
async function retryMessage(message) { if (message.local) { if (message.retryPayload) await dispatch(message.retryPayload, message); return }; try { const result = unwrap(await waApi.post(`/messages/${message._id}/retry`)); upsertMessage(result.message || result) } catch (error) { fail(error) } }
function deleteMessage(message) { $q.dialog({ title: 'Apagar para todos', message: 'Solicitar a exclusão desta mensagem no WhatsApp?', cancel: true }).onOk(async () => { try { const result = unwrap(await waApi.post(`/messages/${message._id}/delete`)); upsertMessage(result.message || { ...message, deleted: true }) } catch (error) { fail(error) } }) }
const ownedContacts = (items) => items.filter((item) => item.mode === 'human' && item.assignedTo?.id === adminId)
async function openForward(message) { forwardMessage.value = message; forwardIds.value = []; forwardContacts.value = ownedContacts(chats.value); forwardRequestId.value = requestId(); forwardDialog.value = true }
async function searchForward(value, update) { try { const result = unwrap(await waApi.get('/chats', { params: { q: value, mode: 'human', limit: 50 } })); update(() => { forwardContacts.value = ownedContacts(result.items || []) }) } catch (error) { fail(error); update(() => {}) } }
async function forward() { if (!forwardIds.value.length) return; sending.value = true; try { await waApi.post(`/messages/${forwardMessage.value._id}/forward`, { chatIds: forwardIds.value, requestId: forwardRequestId.value }); forwardDialog.value = false; $q.notify({ type: 'positive', message: 'Encaminhamento adicionado à fila.' }) } catch (error) { fail(error) } finally { sending.value = false } }
async function loadMessageMedia(message) { try { const result = unwrap(await waApi.post(`/messages/${message._id}/media`)); upsertMessage(result.message || result) } catch (error) { fail(error) } }
async function createChat() { try { const result = unwrap(await waApi.post('/chats', newContact.value)); newDialog.value = false; newContact.value = { phone: '', name: '' }; await loadChats(); await openChat(result.chat || result) } catch (error) { fail(error) } }
async function sendLocation() {
  if (!navigator.geolocation) return fail(new Error('Este dispositivo não oferece localização.'))
  const chatId = active.value._id
  navigator.geolocation.getCurrentPosition((position) => dispatch({ chatId, type: 'location', latitude: position.coords.latitude, longitude: position.coords.longitude, locationName: 'Localização atual' }), () => fail(new Error('Não foi possível obter sua localização. Permita o acesso no navegador.')), { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 })
}
async function sendContact() { if (!contact.value.name || !contact.value.phone) return; await dispatch({ type: 'contact', contactName: contact.value.name, contactPhone: contact.value.phone }); contactDialog.value = false; contact.value = { name: '', phone: '' } }
async function startRecording() {
  const chatId = active.value?._id, epoch = messageEpoch
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Gravação não disponível. Você pode anexar um arquivo de áudio.')
    microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (epoch !== messageEpoch || chatId !== active.value?._id || !props.visible || !ownsChat.value) { microphone.getTracks().forEach((track) => track.stop()); return }
    recordingChunks = []
    const preferred = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type))
    recorder = new MediaRecorder(microphone, preferred ? { mimeType: preferred } : undefined)
    recorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data) }
    recorder.onstop = () => { microphone?.getTracks().forEach((track) => track.stop()); if (!recordingChunks.length) return; const type = recorder.mimeType, extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'; attachment.value = new File(recordingChunks, `audio-${Date.now()}.${extension}`, { type }); voiceRecording.value = true; caption.value = ''; fileDialog.value = true; recordingChunks = [] }
    recorder.start(1000); recording.value = true; recordingSeconds.value = 0
    recordTimer = setInterval(() => { recordingSeconds.value++; if (recordingSeconds.value >= 120) stopRecording() }, 1000)
  } catch (error) { microphone?.getTracks().forEach((track) => track.stop()); fail(error) }
}
function stopRecording(cancel = false) { clearInterval(recordTimer); recording.value = false; if (cancel) { recordingChunks = []; if (recorder) recorder.ondataavailable = null }; if (recorder?.state === 'recording') recorder.stop() }
function backToList() { persistDraft(); if (recording.value) stopRecording(true); active.value = null; messageEpoch++ }
onMounted(loadChats)
onBeforeUnmount(() => { persistDraft(); ++listEpoch; ++messageEpoch; clearTimeout(searchTimer); clearTimeout(draftTimer); clearTimeout(readTimer); stopRecording(true); microphone?.getTracks().forEach((track) => track.stop()) })
</script>

<template>
  <div :class="['wa-chats', { 'has-active': active }]">
    <aside class="wa-sidebar">
      <div class="wa-sidebar-heading"><div><strong>Conversas</strong><span>{{ total }} contatos</span></div><q-btn round flat icon="mdi-message-plus-outline" aria-label="Nova conversa" @click="newDialog = true" /></div>
      <q-input v-model="search" dense outlined clearable placeholder="Nome ou telefone" class="q-mx-md q-mb-sm"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
      <div class="wa-filters"><button v-for="filter in filters" :key="filter.value" :class="{ selected: mode === filter.value }" @click="mode = filter.value">{{ filter.label }}</button></div>
      <q-linear-progress v-if="listLoading" indeterminate color="teal-3" />
      <div class="wa-chat-list">
        <button v-for="chat in chats" :key="chat._id" :class="['wa-chat-row', { selected: active?._id === chat._id }]" @click="openChat(chat)">
          <q-avatar size="40px" color="teal-9" text-color="teal-2"><img v-if="chat.avatarUrl" :src="chat.avatarUrl" alt="" loading="lazy" /><span v-else>{{ (chat.name || chat.phone || '?').slice(0, 1).toUpperCase() }}</span></q-avatar>
          <div class="wa-chat-info"><div><strong>{{ chat.name || chat.phone }}</strong><time>{{ formatDate(chat.lastMessageAt, true) }}</time></div><small>{{ chat.phone }}</small><p>{{ typeof chat.lastMessage === 'string' ? chat.lastMessage : chat.lastMessage?.text || 'Sem mensagens' }}</p><span :class="['wa-mode', chat.mode]">{{ chat.assignedTo?.name ? `Com ${chat.assignedTo.name}` : modeText(chat.mode) }}</span></div><q-badge v-if="chat.unread" rounded color="teal-4" text-color="dark">{{ chat.unread }}</q-badge>
        </button>
        <div v-if="!chats.length && !listLoading" class="wa-empty-list">Nenhuma conversa encontrada.</div><q-btn v-if="chats.length < total" flat no-caps class="full-width" label="Carregar mais" :loading="listLoading" @click="loadChats(true)" />
      </div>
    </aside>
    <section v-if="active" class="wa-conversation">
      <header class="wa-conversation-heading"><q-btn class="wa-back" flat round dense icon="mdi-arrow-left" aria-label="Voltar às conversas" @click="backToList" /><q-avatar size="40px" color="teal-9" class="cursor-pointer" @click="profileDialog = true"><img v-if="active.avatarUrl" :src="active.avatarUrl" alt="Foto do contato" /><span v-else>{{ (active.name || active.phone || '?').slice(0, 1) }}</span></q-avatar><div class="wa-contact-heading"><strong>{{ active.name || active.phone }}</strong><small>{{ active.phone }} · {{ active.assignedTo?.name ? `Com ${active.assignedTo.name}` : modeText(active.mode) }}</small></div><q-btn v-if="!ownsChat" no-caps unelevated color="teal-6" dense label="Assumir" @click="chatAction('takeover')" /><q-btn v-else no-caps flat dense color="teal-3" icon="mdi-check-circle-outline" label="Finalizar" @click="confirmAction('close')" /><q-btn flat round dense icon="mdi-dots-vertical" aria-label="Ações da conversa"><q-menu><q-list><q-item v-close-popup clickable @click="chatAction('takeover')"><q-item-section>Assumir atendimento</q-item-section></q-item><q-item v-close-popup clickable @click="chatAction('release')"><q-item-section>Devolver ao bot</q-item-section></q-item><q-item v-close-popup clickable @click="confirmAction('reset')"><q-item-section>Reiniciar fluxo</q-item-section></q-item><q-separator /><q-item v-close-popup clickable :disable="!canSend" @click="sendLocation"><q-item-section>Enviar localização atual</q-item-section></q-item><q-item v-close-popup clickable :disable="!canSend" @click="contactDialog = true"><q-item-section>Enviar contato</q-item-section></q-item></q-list></q-menu></q-btn></header>
      <div v-if="!online" class="wa-connection-notice"><q-icon name="mdi-wifi-off" />WhatsApp desconectado. Os envios aguardam a conexão e podem expirar na fila.</div>
      <div ref="scroller" class="wa-messages"><q-btn v-if="hasMore" flat dense no-caps label="Mensagens anteriores" :loading="historyLoading" @click="loadHistory" /><div v-if="loading" class="wa-loading"><q-spinner color="teal-3" size="32px" /></div><div v-else-if="!messages.length" class="wa-empty-list">Inicie o atendimento para enviar uma mensagem.</div><MessageBubble v-for="message in messages" :key="message._id" :message="message" @reply="quoted = $event" @forward="openForward" @delete="deleteMessage" @retry="retryMessage" @load-media="loadMessageMedia" /></div>
      <div v-if="quoted" class="wa-reply"><q-icon name="mdi-reply" /><span>{{ quoted.text || quoted.asset?.name || 'Responder à mensagem' }}</span><q-btn flat round dense icon="mdi-close" aria-label="Cancelar resposta" @click="quoted = null" /></div>
      <footer class="wa-composer"><template v-if="recording"><q-icon name="mdi-record-circle" color="red-4" class="wa-recording-icon" /><span>Gravando {{ Math.floor(recordingSeconds / 60) }}:{{ String(recordingSeconds % 60).padStart(2, '0') }}</span><q-space /><q-btn flat round icon="mdi-delete-outline" aria-label="Descartar gravação" @click="stopRecording(true)" /><q-btn round color="teal-6" icon="mdi-stop" aria-label="Concluir gravação" @click="stopRecording()" /></template><template v-else><q-btn flat round icon="mdi-paperclip" aria-label="Anexar arquivo" :disable="!canSend" @click="fileInput.click()" /><input ref="fileInput" type="file" hidden @change="chooseAttachment" /><q-input v-model="draft" outlined dense autogrow maxlength="10000" :disable="!ownsChat" :placeholder="ownsChat ? 'Escreva uma mensagem…' : 'Assuma a conversa para responder'" class="wa-input" @keydown="composerKey" /><q-btn v-if="!draft.trim()" flat round icon="mdi-microphone-outline" aria-label="Gravar áudio" :disable="!canSend" @click="startRecording" /><q-btn round unelevated color="teal-6" icon="mdi-send" aria-label="Enviar mensagem" :disable="!canSend || !draft.trim()" :loading="sending" @click="sendText" /></template></footer>
      <div class="wa-composer-note">{{ admin.name || 'Admin' }} será identificado nas mensagens enviadas. <span v-if="draft">Rascunho salvo neste dispositivo.</span></div>
    </section>
    <section v-else class="wa-welcome"><q-icon name="mdi-whatsapp" size="62px" /><h2>Atendimento AitoSoftwares</h2><p>Selecione uma conversa para acompanhar o bot ou assumir o atendimento.</p><span>Mensagens, arquivos e atendimento em um só lugar.</span></section>
    <q-dialog v-model="newDialog"><q-card class="wa-dialog"><q-card-section><h3>Nova conversa</h3><q-input v-model="newContact.name" outlined label="Nome do contato" class="q-mb-md" /><q-input v-model="newContact.phone" outlined label="Telefone com DDI e DDD" hint="Exemplo: 5561999999999" inputmode="tel" /></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn no-caps color="teal-7" label="Abrir conversa" :disable="!newContact.phone" @click="createChat" /></q-card-actions></q-card></q-dialog>
    <q-dialog v-model="forwardDialog"><q-card class="wa-dialog"><q-card-section><h3>Encaminhar mensagem</h3><p>Selecione até 10 conversas assumidas por você. Para encaminhar a outro contato, assuma primeiro o atendimento.</p><q-select v-model="forwardIds" outlined multiple use-chips use-input :max-values="10" input-debounce="300" emit-value map-options :options="forwardContacts" option-value="_id" :option-label="(item) => `${item.name || 'Contato'} · ${item.phone}`" label="Selecione os contatos" @filter="searchForward" /></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn no-caps color="teal-7" label="Encaminhar" :disable="!forwardIds.length" :loading="sending" @click="forward" /></q-card-actions></q-card></q-dialog>
    <q-dialog v-model="fileDialog"><q-card class="wa-dialog"><q-card-section><h3>Enviar arquivo</h3><p class="wa-filename">{{ attachment?.name }}</p><p>{{ sizeText(attachment?.size) }} · Para {{ active?.name || active?.phone }}</p><q-input v-model="caption" outlined autogrow label="Legenda (opcional)" maxlength="4000" /></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn no-caps color="teal-7" label="Enviar" :loading="uploadBusy" @click="sendFile" /></q-card-actions></q-card></q-dialog>
    <q-dialog v-model="contactDialog"><q-card class="wa-dialog"><q-card-section><h3>Enviar contato</h3><q-input v-model="contact.name" outlined label="Nome" class="q-mb-md" /><q-input v-model="contact.phone" outlined label="Telefone com DDI" inputmode="tel" /></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn no-caps color="teal-7" label="Enviar" :disable="!contact.name || !contact.phone" @click="sendContact" /></q-card-actions></q-card></q-dialog>
    <q-dialog v-model="profileDialog"><q-card class="wa-dialog"><q-card-section><img v-if="active?.avatarUrl" :src="active.avatarUrl" :alt="active.name" style="width:100%;border-radius:12px" /><h3>{{ active?.name }}</h3><p>{{ active?.phone }}</p></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Fechar" v-close-popup /></q-card-actions></q-card></q-dialog>
  </div>
</template>

<style scoped>
.wa-chats{display:grid;grid-template-columns:330px minmax(0,1fr);height:clamp(610px,75vh,950px);min-width:0}.wa-sidebar{display:flex;flex-direction:column;border-right:1px solid var(--wa-line);min-height:0;background:#0b2428}.wa-sidebar-heading{display:flex;align-items:center;justify-content:space-between;padding:16px}.wa-sidebar-heading strong,.wa-sidebar-heading span{display:block}.wa-sidebar-heading strong{font-size:17px}.wa-sidebar-heading span{font-size:10px;color:var(--wa-muted);margin-top:2px}.wa-filters{display:flex;gap:5px;padding:0 12px 12px;overflow-x:auto;flex-shrink:0}.wa-filters button{font:inherit;font-size:10px;white-space:nowrap;border:1px solid #244649;background:transparent;color:#a9c5c0;border-radius:14px;padding:6px 9px;cursor:pointer}.wa-filters button.selected{color:#aafce5;background:#16473e;border-color:#368775}.wa-chat-list{overflow:auto;min-height:0}.wa-chat-row{display:flex;position:relative;align-items:center;gap:10px;width:100%;padding:13px 12px;border:0;border-bottom:1px solid #173438;color:inherit;background:transparent;text-align:left;cursor:pointer}.wa-chat-row:hover,.wa-chat-row.selected{background:#123d3b}.wa-chat-row.selected{box-shadow:3px 0 #59d9ba inset}.wa-chat-info{flex:1;min-width:0}.wa-chat-info>div{display:flex;align-items:center;gap:8px}.wa-chat-info strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.wa-chat-info time{font-size:8px;color:#92b8ae;white-space:nowrap}.wa-chat-info>small{display:block;font-size:9px;color:#7ba49d;margin-top:2px}.wa-chat-info p{font-size:11px;color:#9ab8b2;margin:3px 0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-mode{font-size:9px;background:#244345;color:#aec4c0;border-radius:8px;padding:3px 7px}.wa-mode.human{background:#1c4c63;color:#a8d8eb}.wa-mode.bot{background:#144f42;color:#90e8c7}.wa-chat-row>.q-badge{position:absolute;right:10px;bottom:12px;font-size:9px}.wa-conversation{display:flex;flex-direction:column;min-width:0;min-height:0;background:radial-gradient(ellipse at 70% 80%,#18443c35,transparent 65%),#071c20}.wa-conversation-heading{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--wa-line);background:#102d31}.wa-contact-heading{flex:1;min-width:0}.wa-contact-heading strong,.wa-contact-heading small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-contact-heading small{margin-top:4px;color:#92b8ae;font-size:10px}.wa-back{display:none}.wa-connection-notice{display:flex;align-items:center;gap:8px;background:#66501945;color:#e4c887;font-size:10px;padding:8px 16px}.wa-messages{display:flex;flex:1;flex-direction:column;gap:10px;overflow:auto;padding:20px 22px;min-height:0}.wa-loading{display:grid;place-items:center;padding:40px}.wa-reply{display:flex;align-items:center;gap:10px;padding:8px 16px;background:#183c3a;border-left:3px solid #6cdbc0}.wa-reply span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-composer{display:flex;align-items:flex-end;gap:7px;padding:12px 10px 7px;background:#102a2d}.wa-input{flex:1;min-width:0}.wa-input :deep(textarea){max-height:135px!important}.wa-composer-note{padding:0 16px 10px;background:#102a2d;color:#7fa49c;font-size:9px}.wa-composer-note span{color:#9dbeb6}.wa-welcome{display:flex;flex-direction:column;justify-content:center;align-items:center;padding:45px;text-align:center;color:#a1c7bf}.wa-welcome>.q-icon{color:#5fdbb7}.wa-welcome h2{font-size:23px;line-height:1.3;margin:20px 0 12px;color:#d7fff2}.wa-welcome p{max-width:340px;font-size:13px}.wa-welcome span{font-size:10px;color:#6f9d93}.wa-empty-list{padding:25px;text-align:center;color:#7faca2;font-size:12px}.wa-dialog{width:min(94vw,480px);max-width:94vw}.wa-dialog h3{margin:0 0 20px;font-size:20px}.wa-filename{overflow-wrap:anywhere}.wa-recording-icon{animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.4}}@media(max-width:1000px){.wa-chats{grid-template-columns:285px minmax(0,1fr)}.wa-conversation-heading{padding:10px}.wa-messages{padding:16px 12px}.wa-chat-info time{font-size:8px}}@media(max-width:700px){.wa-chats{grid-template-columns:1fr;height:calc(100dvh - 150px);min-height:550px}.wa-chats.has-active .wa-sidebar{display:none}.wa-chats:not(.has-active) .wa-conversation,.wa-chats .wa-welcome{display:none}.wa-back{display:inline-flex}.wa-conversation-heading{gap:6px}.wa-contact-heading strong{font-size:12px}.wa-contact-heading small{font-size:9px}.wa-composer{gap:4px;padding:8px}.wa-chat-info time{font-size:10px}.wa-sidebar{border-right:0}}
</style>

<style scoped>
.wa-chats{height:clamp(500px,calc(100dvh - 300px),950px)}@media(max-width:700px){.wa-chats{height:calc(100dvh - 294px);min-height:420px}}
</style>
