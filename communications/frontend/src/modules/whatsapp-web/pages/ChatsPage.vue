<script setup>
import ChatFocusToggle from "../../../components/ChatFocusToggle.vue"
import { useChatFocus } from "../../../services/chat-focus.js"
const { chatListCollapsed, toggleChatList } = useChatFocus("whatsapp_web")
import { inPrototype } from '../../../services/prototype-runtime.js'
import { useVoiceRecorder } from '../../../services/voice-recorder.js'
import { vChatBottom } from "../../../services/chat-bottom.js"
import { vCanAction } from '../../../services/permission-directives.js'
import { canAction, canArea } from '../../../services/access.js'
import { getStoredUser } from '../../../services/tokens.js'
import ConversationSignature from '../ConversationSignature.vue'
import { vAuthSrc, vAuthHref } from '../authenticated-media.js'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { api, formatDate, idOf, messageOf, socket, currentUser } from '../services.js'
import ContactAvatar from '../components/ContactAvatar.vue'
import { formatWhatsApp } from '../whatsapp-format.js'
import { ATTENDANCE_SCOPES, attendanceLabel, matchesScope, attendanceGroups } from '../attendance-state.js'
import BulkRemoveBar from '../../../components/BulkRemoveBar.vue'
import { chatIsMuted, toggleChatAlerts } from '../../../services/chat-alerts.js'

const chats = ref([]), selected = ref(null), messages = ref([]), assets = ref([])
const page = ref(1), pages = ref(1), total = ref(0), messagePage = ref(1), messagePages = ref(1)
const search = ref(''), draft = ref(''), file = ref(null), loading = ref(false), sending = ref(false), toast = ref(''), stream = ref(null)
const customReaction = ref(''), filePreviewUrl = ref('')
watch(file, value => { if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value); filePreviewUrl.value = value ? URL.createObjectURL(value) : '' })
const replyTo = ref(null), forwarding = ref(null), forwardTarget = ref(''), attachmentOpen = ref(false), composerMode = ref('text')
const sendAsSticker = ref(false), searchOpen = ref(false), messageSearch = ref(''), searchResults = ref([]), searchingMessages = ref(false), searchPage = ref(1), searchPages = ref(1), searchTotal = ref(0)
let searchRequest = 0
const voice = useVoiceRecorder(value => { file.value = value; sendAsVoice.value = true; sendAsSticker.value = false }, show)
const { recording, seconds: recordingSeconds, starting: startingRecording } = voice
const sendAsVoice = ref(false), sendAsDocument = ref(false), assetId = ref('')
const locationForm = ref({ latitude: '', longitude: '', name: '', address: '' }), contactForm = ref({ phone: '' })
const myStats=ref({total:0,completed:0}); async function loadMyStats(){try{myStats.value=(await api.get('/chats/attendance')).data}catch{}}
const now = ref(Date.now())
const route = useRoute()
const router = useRouter()
const reportSelection = inject('whatsapp-web:conversation-selected', null)
const chatActionsOpen = ref(false)
const messageActionsOpen = ref(false)
const actionMessage = ref(null)
const selectedChatIds = ref([])
const groupedChats = computed(() => attendanceGroups(chats.value))
async function onBulkRemoved(ids) { selectedChatIds.value = selectedChatIds.value.filter(id => !ids.includes(id)); if (ids.includes(selectedId.value)) closeChat(); await loadChats(1) }
async function toggleMute() { try { await toggleChatAlerts('whatsapp_web', selectedId.value) } catch (cause) { show(messageOf(cause)) } }
const $q = useQuasar()
const deleting = ref(false)
const deletedMessageIds = new Set()
const openingChat = ref(false)
const draftElement = ref(null)
const liveConnected = ref(socket.connected)
const attendanceScope = ref(currentUser.value?.profileRole === 'collaborator' ? 'mine' : 'all'), assignees = ref([]), transferOpen = ref(false), assigneeId = ref('')
let chatRequest = 0
let listRequest = 0
let clock

const selectedId = computed(() => idOf(selected.value))
const selectedWindowOpen = computed(() => Boolean(selected.value?.serviceWindow?.lastInboundAt && selected.value?.serviceWindow?.expiresAt && new Date(selected.value.serviceWindow.expiresAt).getTime() > now.value && !selected.value?.isGroup))
const selectedAsset = computed(() => assets.value.find((item) => item._id === assetId.value))
function orderStage(chat){const stage=chat?.tags?.find(t=>t.startsWith('pedido-'));return({'pedido-fulfillment':'Retirada/entrega','pedido-address':'Endereço','pedido-cart':'Carrinho','pedido-review':'Conferência','pedido-completed':'Pedido enviado'})[stage]||''}
function name(chat) { return chat?.displayNameOverride || chat?.displayName || chat?.phone || chat?.externalId || 'Contato' }
function show(value) { toast.value = value; setTimeout(() => { if (toast.value === value) toast.value = '' }, 3300) }
function bodyVisible(message) { return message.body && !/^\[(Imagem|Vídeo|Áudio|Documento|Figurinha|Localização|Contato)\]$/.test(message.body) }
function wazeUrl(message){const d=message.metadata||{};return `https://waze.com/ul?ll=${encodeURIComponent(d.latitude+','+d.longitude)}&navigate=yes`}
function mapUrl(message) { const data = message.metadata || {}; return `https://www.google.com/maps?q=${encodeURIComponent(`${data.latitude},${data.longitude}`)}` }
function ack(message) { if (message.ack >= 4) return '✓✓'; if (message.ack >= 2) return '✓✓'; return '✓' }

async function scrollBottom() {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { if (stream.value) stream.value.scrollTop = stream.value.scrollHeight; resolve() })))
}
async function loadChats(next = page.value) {
  const request = ++listRequest
  loading.value = true
  try { const { data } = await api.get('/chats', { params: { page: next, limit: 30, search: search.value, scope: attendanceScope.value } }); if (request !== listRequest) return; chats.value = data.items; page.value = data.page; pages.value = data.pages; total.value = data.total }
  catch (cause) { if (request === listRequest) show(messageOf(cause)) } finally { if (request === listRequest) loading.value = false }
}
async function loadAssets() { if(!canArea(getStoredUser(),'web_files'))return; if (assets.value.length) return; try { assets.value = (await api.get('/assets', { params: { limit: 100 } })).data.items } catch { assets.value = [] } }
async function openChat(chat) {
  const request = ++chatRequest
  const chatId = idOf(chat)
  voice.cancel(); searchRequest += 1; searchOpen.value = false; sendAsSticker.value = false
  selected.value = chat; messages.value = []; messagePage.value = 1; messagePages.value = 1
  replyTo.value = null; composerMode.value = 'text'; draft.value = ''; file.value = null
  attachmentOpen.value = false; chatActionsOpen.value = false; openingChat.value = true
  try {
    const [{ data: detail }, { data: list }] = await Promise.all([api.get(`/chats/${chatId}`), api.get(`/chats/${chatId}/messages`, { params: { page: 1, limit: 50 } })])
    if (request !== chatRequest) return
    selected.value = detail
    messages.value = [...list.items, ...messages.value.filter(item => !list.items.some(loaded => loaded._id === item._id))].filter(item => !deletedMessageIds.has(item._id)).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    messagePages.value = list.pages
    await api.patch(`/chats/${chatId}/read`).catch(() => undefined)
    const local = chats.value.find((item) => item._id === chatId); if (local) local.unreadCount = 0
    openingChat.value = false
    await scrollBottom()
  } catch (cause) {
    if (request === chatRequest) { show(messageOf(cause)); closeChat() }
  } finally { if (request === chatRequest) openingChat.value = false }
}
function selectChat(chat) {
  const chatId = idOf(chat)
  if (route.query.chatId === chatId) return openChat(chat)
  return router.replace({ path: route.path, query: { ...route.query, chatId } })
}
function closeChat() {
  voice.cancel(); searchRequest += 1; searchOpen.value = false
  chatRequest += 1
  selected.value = null; messages.value = []; replyTo.value = null; file.value = null
  openingChat.value = false; chatActionsOpen.value = false; messageActionsOpen.value = false; attachmentOpen.value = false
  if (route.query.chatId) {
    const query = { ...route.query }
    delete query.chatId
    router.replace({ path: route.path, query })
  }
}
function resizeDraft() {
  if (!draftElement.value) return
  draftElement.value.style.height = 'auto'
  draftElement.value.style.height = `${Math.min(draftElement.value.scrollHeight, 130)}px`
}
function onViewportResize() {
  if (document.activeElement === draftElement.value) scrollBottom()
}
function openMessageActions(message) {
  actionMessage.value = message
  messageActionsOpen.value = true
}
function runMessageAction(operation, value) {
  const message = actionMessage.value
  messageActionsOpen.value = false
  if (!message || !selected.value) return
  if (operation === 'reply') { replyTo.value = message; nextTick(() => draftElement.value?.focus()); return }
  if (operation === 'reaction') return react(message, value)
  if (operation === 'forward') return startForward(message)
  if (operation === 'remove-local') return requestDeleteMessage(message)
  return messageAction(message, operation)
}
async function older() {
  if (!selected.value || messagePage.value >= messagePages.value) return
  const previousHeight = stream.value?.scrollHeight || 0, next = messagePage.value + 1
  const chatId = selectedId.value
  const request = chatRequest
  try {
    const { data } = await api.get(`/chats/${chatId}/messages`, { params: { page: next, limit: 50 } })
    if (selectedId.value !== chatId || request !== chatRequest) return
    messages.value = [...data.items, ...messages.value.filter((old) => !data.items.some((item) => item._id === old._id))].filter(item => !deletedMessageIds.has(item._id)); messagePage.value = next
    await nextTick(); if (stream.value) stream.value.scrollTop = stream.value.scrollHeight - previousHeight
  } catch (cause) { show(messageOf(cause)) }
}
function assertWindow() { if (!selectedWindowOpen.value) { show('Aguarde o contato enviar uma nova mensagem para abrir a janela receptiva.'); return false } return true }
async function send() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return;
  const text = draft.value.trim(); if (!selected.value || !text || !assertWindow()) return
  sending.value = true
  const chatId = selectedId.value
  try { await api.post(`/chats/${chatId}/messages`, { text, quotedMessageId: replyTo.value?._id }); if (selectedId.value === chatId) { draft.value = ''; replyTo.value = null } }
  catch (cause) { show(messageOf(cause)) } finally { sending.value = false }
}
async function sendFile() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return;
  if (!file.value || !selected.value || !assertWindow()) return
  const data = new FormData(); data.append('file', file.value); data.append('caption', draft.value); data.append('sendAsVoice', sendAsVoice.value); data.append('sendAsDocument', sendAsDocument.value); data.append('sendAsSticker', sendAsSticker.value)
  sending.value = true
  try { await api.post(`/chats/${selectedId.value}/media`, data); file.value = null; draft.value = ''; sendAsVoice.value = false; sendAsDocument.value = false; sendAsSticker.value = false; attachmentOpen.value = false; show('Arquivo enviado.') }
  catch (cause) { show(messageOf(cause)) } finally { sending.value = false }
}
async function sendLocation() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return;
  if (!assertWindow()) return; sending.value = true
  try { await api.post(`/chats/${selectedId.value}/location`, locationForm.value); locationForm.value = { latitude: '', longitude: '', name: '', address: '' }; composerMode.value = 'text'; show('Localização enviada.') }
  catch (cause) { show(messageOf(cause)) } finally { sending.value = false }
}
async function sendContactCard() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return;
  if (!assertWindow()) return; sending.value = true
  try { await api.post(`/chats/${selectedId.value}/contact-card`, contactForm.value); contactForm.value.phone = ''; composerMode.value = 'text'; show('Contato enviado.') }
  catch (cause) { show(messageOf(cause)) } finally { sending.value = false }
}
async function sendStoredAsset() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return;
  if (!assetId.value || !assertWindow()) return; sending.value = true
  try { await api.post(`/chats/${selectedId.value}/assets`, { assetId: assetId.value, caption: draft.value, sendAsVoice: sendAsVoice.value, sendAsDocument: sendAsDocument.value }); assetId.value = ''; draft.value = ''; composerMode.value = 'text'; show('Arquivo da biblioteca enviado.') }
  catch (cause) { show(messageOf(cause)) } finally { sending.value = false }
}
function pickFile(event) { sendAsSticker.value = false; file.value = event.target.files?.[0] || null; attachmentOpen.value = false; if (file.value?.type?.startsWith('audio/')) sendAsVoice.value = true }
async function searchMessages(next = 1) {
  if (!selected.value || messageSearch.value.trim().length < 2) return
  const request = ++searchRequest, chatId = selectedId.value
  searchingMessages.value = true
  try {
    const { data } = await api.get('/chats/search/messages', { params: { chatId, q: messageSearch.value, page: next } })
    if (request !== searchRequest || chatId !== selectedId.value) return
    searchResults.value = data.items; searchPage.value = data.page; searchPages.value = data.pages; searchTotal.value = data.total
  } catch (cause) { if (request === searchRequest) show(messageOf(cause)) }
  finally { if (request === searchRequest) searchingMessages.value = false }
}
function openSearch() { messageSearch.value = ''; searchResults.value = []; searchTotal.value = 0; searchingMessages.value = false; searchOpen.value = true }
function startRecording() { if (inPrototype()) return show('Demonstração: a gravação cria um áudio para revisar antes do envio.'); return voice.start() }
function currentLocation() {
  if (inPrototype()) return show('Demonstração: informe coordenadas fictícias para conhecer os campos.')
  if (!navigator.geolocation) return show('Localização indisponível neste navegador. Informe as coordenadas.')
  navigator.geolocation.getCurrentPosition(position => {
    locationForm.value.latitude = String(position.coords.latitude); locationForm.value.longitude = String(position.coords.longitude)
  }, () => show('Não foi possível obter a localização. Informe as coordenadas ou permita o acesso no navegador.'), { timeout: 10000 })
}
function onCall(call) {
  if (!call.fromMe) $q.notify({ type: 'warning', icon: call.isVideo ? 'videocam' : 'call', message: `Tentativa de ligação${call.isVideo ? ' de vídeo' : ''}: ${chats.value.find(chat => chat.externalId === call.from)?.displayName || call.from}`, caption: 'Atenda pelo aplicativo WhatsApp no celular.', timeout: 12000 })
}
async function resetContext() { if (!confirm('Reiniciar o bot para esta conversa?')) return; try { const { data } = await api.post(`/chats/${selectedId.value}/context/reset`); selected.value = data.chat; show('Contexto limpo. A próxima mensagem começa no início.') } catch (cause) { show(messageOf(cause)) } }
async function assumeChat(){try{selected.value=(await api.patch(`/chats/${selectedId.value}/bot`,{paused:true})).data;loadMyStats();show('Atendimento assumido com sua assinatura.')}catch(e){show(messageOf(e))}}
async function attendanceAction(action) {
  if (!selected.value) return
  try {
    const chatId = selectedId.value
    const { data } = await api.post(`/chats/${chatId}/attendance`, { action, ...(action === 'transfer' ? { assigneeId: assigneeId.value } : {}) })
    if (currentUser.value?.role === 'collaborator' && data.bot?.ownerId && data.bot.ownerId !== currentUser.value.id) closeChat()
    else if (selectedId.value === chatId) selected.value = data
    transferOpen.value = false; loadMyStats(); loadChats(); show('Atendimento atualizado.')
  }
  catch (cause) { show(messageOf(cause)) }
}
async function openTransfer() { try { assignees.value = (await api.get('/chats/assignees')).data.items; assigneeId.value = ''; transferOpen.value = true } catch (cause) { show(messageOf(cause)) } }
async function renameContact() { const value = prompt('Nome exibido na plataforma:', name(selected.value)); if (!value?.trim()) return; try { selected.value = (await api.patch(`/chats/${selectedId.value}/profile`, { name: value.trim() })).data; show('Nome atualizado na plataforma.') } catch (cause) { show(messageOf(cause)) } }
async function toggleBot() { try { const { data } = await api.patch(`/chats/${selectedId.value}/bot`, { paused: !selected.value.bot?.paused }); selected.value = data; loadMyStats(); show(data.bot.paused ? 'Atendimento assumido com sua assinatura.' : 'Bot reativado neste chat.') } catch (cause) { show(messageOf(cause)) } }
async function action(value, extra) { try { await api.post(`/chats/${selectedId.value}/action`, { action: value, value: extra }); show('Ação aplicada no WhatsApp.'); await loadChats() } catch (cause) { show(messageOf(cause)) } }
async function saveContact() { const value = prompt('Nome do contato:', name(selected.value)); if (!value) return; try { await api.post(`/chats/${selectedId.value}/contact`, { firstName: value }); selected.value.isMyContact = true; selected.value.displayName = value; show('Contato salvo no aparelho conectado.') } catch (cause) { show(messageOf(cause)) } }
async function react(message, reaction) { try { await api.post(`/chats/${selectedId.value}/messages/${message._id}/reaction`, { reaction }) } catch (cause) { show(messageOf(cause)) } }
async function messageAction(message, operation) {
  let value
  if (operation === 'delete' && !confirm('Apagar esta mensagem para todos quando o WhatsApp permitir?')) return
  if (operation === 'edit') { value = prompt('Editar mensagem:', message.body); if (!value?.trim()) return }
  try { await api.post(`/chats/${selectedId.value}/messages/${message._id}/action`, { action: operation, value: operation === 'delete' ? true : value }); show('Mensagem atualizada.') }
  catch (cause) { show(messageOf(cause)) }
}
const forwardChats = ref([]), forwardSearch = ref('')
async function findForwardChats() { try { forwardChats.value = (await api.get('/chats', { params: { limit: 100, search: forwardSearch.value } })).data.items } catch (cause) { show(messageOf(cause)) } }
function startForward(message) { forwarding.value = message; forwardTarget.value = ''; forwardSearch.value = ''; forwardChats.value = chats.value; void findForwardChats() }
async function confirmForward() { if(!canAction(getStoredUser(),'whatsapp_web','send'))return; if (!forwardTarget.value) return; sending.value = true; try { await api.post(`/chats/${selectedId.value}/messages/${forwarding.value._id}/forward`, { targetChatId: forwardTarget.value }); forwarding.value = null; show('Mensagem encaminhada.') } catch (cause) { show(messageOf(cause)) } finally { sending.value = false } }
function openComposer(mode) { composerMode.value = mode; attachmentOpen.value = false; if (mode === 'asset') loadAssets() }

function requestDeleteMessage(message) {
  if (!selected.value || deleting.value) return
  const chatId = selectedId.value
  $q.dialog({ title: 'Apagar mensagem do painel?', message: 'A mensagem será removida para a equipe no NotifyFlow. Ela continuará no WhatsApp dos participantes.',
    cancel: { label: 'Cancelar', flat: true }, ok: { label: 'Apagar do painel', color: 'negative' }, persistent: true }).onOk(async () => {
    deleting.value = true
    try { await api.delete(`/chats/${chatId}/messages/${message._id}`); onMessageRemoved({ chat: chatId, id: message._id }); await loadChats(); show('Mensagem apagada do painel.') }
    catch (cause) { show(messageOf(cause)) } finally { deleting.value = false }
  })
}
function requestDeleteChat(historyOnly = false) {
  if (!selected.value || deleting.value) return
  const chatId = selectedId.value
  $q.dialog({ title: historyOnly ? 'Limpar histórico do painel?' : 'Excluir conversa do painel?',
    message: historyOnly ? 'As mensagens armazenadas serão apagadas para a equipe. O contato e a conversa serão preservados.' : 'O histórico será apagado e a conversa sairá da lista. O contato será preservado e uma nova mensagem recebida poderá reabrir a conversa. O WhatsApp dos participantes não será alterado.',
    cancel: { label: 'Cancelar', flat: true }, ok: { label: historyOnly ? 'Limpar histórico' : 'Excluir conversa', color: 'negative' }, persistent: true }).onOk(async () => {
    deleting.value = true
    try {
      const { data } = await api.delete(`/chats/${chatId}${historyOnly ? '/messages' : ''}`)
      if (historyOnly && selectedId.value === chatId) await openChat(selected.value)
      else if (!historyOnly) onRemoved({ id: chatId, reason: 'deleted', chat: { lastHiddenVersion: data.lastHiddenVersion } })
      await loadChats(); show(historyOnly ? 'Histórico apagado do painel.' : 'Conversa excluída. O contato foi preservado.')
    } catch (cause) { show(messageOf(cause)) } finally { deleting.value = false }
  })
}
function onMessageRemoved(payload) {
  deletedMessageIds.add(payload.id)
  if (selectedId.value !== String(payload.chat)) return
  messages.value = messages.value.filter(item => item._id !== payload.id)
  if (replyTo.value?._id === payload.id) replyTo.value = null
  if (actionMessage.value?._id === payload.id) messageActionsOpen.value = false
}
function onHistoryRemoved(payload) {
  if (selectedId.value === payload.id) { chatRequest += 1; messages.value = messages.value.filter(item => Number(item.activityVersion || 0) > Number(payload.chat?.lastHiddenVersion || 0)); replyTo.value = null; messageActionsOpen.value = false; messagePage.value = 1; messagePages.value = 1; openingChat.value = false }
  if (payload.chat) onChat(payload.chat)
}

function onChat(chat) {
  const known = chats.value.find(item => item._id === chat._id) || (selectedId.value === chat._id ? selected.value : null)
  if (known && Number(chat.activityVersion || 0) < Number(known.activityVersion || 0)) return
  if (chat.hiddenAt) { onRemoved({ id: chat._id, reason: 'deleted' }); return }
  const before=chats.value.find(c=>c._id===chat._id);if(before && (before.bot?.ownerId===currentUser.value?.id || chat.bot?.ownerId===currentUser.value?.id) && (before.bot?.ownerId!==chat.bot?.ownerId || before.bot?.paused!==chat.bot?.paused))loadMyStats();
  if (chat.provider !== 'whatsapp') return
  if (!matchesScope(chat, attendanceScope.value, currentUser.value?.id)) { chats.value = chats.value.filter(item => item._id !== chat._id); if (selectedId.value === chat._id) selected.value = { ...selected.value, ...chat }; return }
  const index = chats.value.findIndex((item) => item._id === chat._id); if (index >= 0) chats.value.splice(index, 1); chats.value.unshift(chat)
  chats.value.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.lastMessage?.at || 0) - new Date(a.lastMessage?.at || 0))
  if (selectedId.value === chat._id) selected.value = { ...selected.value, ...chat }
}
function onMessage(payload) {
  if (payload.chat?.provider !== 'whatsapp') return
  const known = chats.value.find(item => item._id === payload.chat._id) || (selectedId.value === payload.chat._id ? selected.value : null)
  if (known?.lastHiddenVersion > 0 && Number(payload.message.activityVersion || 0) <= known.lastHiddenVersion) return
  onChat(payload.chat)
  if (selectedId.value === payload.chat._id && !deletedMessageIds.has(payload.message._id) && !messages.value.some((item) => item._id === payload.message._id)) { messages.value.push(payload.message) }
}
function onRemoved(payload) {
  const known = chats.value.find(item => String(item._id) === payload.id)
  if (payload.reason === 'deleted' && payload.chat?.lastHiddenVersion > 0 && Number(known?.activityVersion || 0) > payload.chat.lastHiddenVersion) { onHistoryRemoved(payload); return }
  loadMyStats(); chats.value = chats.value.filter(item => String(item._id) !== payload.id)
  if (selectedId.value === payload.id) { closeChat(); show(payload.reason === 'deleted' ? 'Conversa excluída do painel. O contato foi preservado.' : 'Conversa atribuída a outro colaborador.') }
  if (payload.reason === 'deleted') { listRequest += 1; void loadChats() }
}
function onAck(payload) { const item = messages.value.find((value) => value._id === payload.id); if (item) item.ack = payload.ack }
function onUpdated(message) { const index = messages.value.findIndex((item) => item._id === message._id); if (index >= 0) messages.value[index] = { ...messages.value[index], ...message } }
function onConnected() { liveConnected.value = true; loadChats() }
function onDisconnected() { liveConnected.value = false }

watch(selected, (chat) => reportSelection?.(Boolean(chat)))
watch(attendanceScope, () => loadChats(1))
watch(() => currentUser.value?.id, (value, previous) => { if (value && previous && value !== previous) { closeChat(); loadMyStats(); if (attendanceScope.value === 'mine') loadChats(1); else attendanceScope.value = 'mine' } })
watch(draft, () => nextTick(resizeDraft))
watch(() => route.query.chatId, (value) => {
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) {
    if (selectedId.value !== value) openChat(chats.value.find((chat) => idOf(chat) === value) || { _id: value, displayName: 'Carregando conversa…' })
  } else if (selected.value) closeChat()
}, { immediate: true })
onMounted(() => { loadMyStats(); loadChats(); window.visualViewport?.addEventListener('resize', onViewportResize); clock = setInterval(() => { now.value = Date.now() }, 30_000); socket.on('chat:call', onCall); socket.on('message:removed', onMessageRemoved); socket.on('chat:history-removed', onHistoryRemoved); socket.on('chat:removed', onRemoved); socket.on('connect', onConnected); socket.on('disconnect', onDisconnected); socket.on('chat:updated', onChat); socket.on('chat:message', onMessage); socket.on('message:ack', onAck); socket.on('message:updated', onUpdated) })
onBeforeUnmount(() => { if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value); voice.cancel(); searchRequest += 1; socket.off('chat:call', onCall); chatRequest += 1; reportSelection?.(false); window.visualViewport?.removeEventListener('resize', onViewportResize); clearInterval(clock); socket.off('message:removed', onMessageRemoved); socket.off('chat:history-removed', onHistoryRemoved); socket.off('chat:removed', onRemoved); socket.off('connect', onConnected); socket.off('disconnect', onDisconnected); socket.off('chat:updated', onChat); socket.off('chat:message', onMessage); socket.off('message:ack', onAck); socket.off('message:updated', onUpdated) })
</script>

<template>
  <section class="chat-page" :class="{ 'chat-page--conversation': selected }">
    <header class="chat-page-header"><h1>Conversas</h1><span>{{currentUser?.nick||currentUser?.name}} · {{myStats.total}} atendimentos · {{myStats.completed}} concluídos</span></header>
    <ConversationSignature/><div :class="['chat-shell card',{selected:selected, 'chat-focus-mode': selected && chatListCollapsed}]">
      <aside class="chat-list-panel">

        <div class="inbox-heading"><div><strong>Atendimentos</strong><small>{{ myStats.total - myStats.completed }} em aberto · {{ myStats.completed }} concluídos</small></div><span class="inbox-live" :class="{ offline: !liveConnected }">{{ liveConnected ? 'Ao vivo' : 'Reconectando' }}</span></div>
        <form class="chat-search" @submit.prevent="loadChats(1)"><input v-model="search" class="search" aria-label="Buscar conversa" type="search" placeholder="Buscar conversa…" autocomplete="off"><button class="icon-button" type="submit" aria-label="Buscar conversas"><span class="material-icons" aria-hidden="true">search</span></button></form>
        <div class="inbox-scope"><label for="attendance-scope">Caixa de entrada</label><select id="attendance-scope" v-model="attendanceScope"><option v-for="scope in ATTENDANCE_SCOPES" :key="scope.value" :value="scope.value">{{ scope.label }}</option></select></div>
        <div class="chat-list-summary"><small class="chat-count">{{ total }} conversa(s)</small><button class="icon-button" aria-label="Atualizar conversas" :disabled="loading" @click="loadChats(page)"><span class="material-icons" aria-hidden="true">refresh</span></button></div>
        <BulkRemoveBar v-if="canAction(getStoredUser(),'whatsapp_web','delete')" target="whatsapp_web" :selected="selectedChatIds" @removed="onBulkRemoved" />
        <div class="chat-list-scroll">
        <div v-if="loading" class="empty">Carregando…</div><div v-else-if="!chats.length" class="empty"><b>Nenhuma conversa direta</b><span>Quando alguém escrever no WhatsApp, a conversa aparecerá aqui.</span></div>
        <template v-else><q-expansion-item v-for="group in groupedChats" :key="group.key" default-opened :icon="group.icon" :label="`${group.label} · ${group.items.length}`" class="attendance-collapse" header-class="attendance-collapse-heading">
          <div v-for="chat in group.items" :key="chat._id" class="chat-row-selection">
            <q-checkbox v-if="canAction(getStoredUser(),'whatsapp_web','delete')" v-model="selectedChatIds" :val="chat._id" :aria-label="`Selecionar ${name(chat)}`" dense class="chat-selection" />
            <button :class="['chat-row',{active:chat._id===selectedId}]" :aria-label="`Abrir conversa com ${name(chat)}`" @click="selectChat(chat)">
              <ContactAvatar :contact="chat" /><span class="chat-copy"><strong data-sensitive><span v-if="chat.pinned">⌖ </span>{{ name(chat) }} <span v-if="chatIsMuted('whatsapp_web', chat._id)" title="Notificações silenciadas">🔕</span></strong><small>{{ chat.lastMessage?.body || 'Sem mensagem' }}</small><span class="chat-stage">{{ attendanceLabel(chat) }}</span><span v-if="orderStage(chat)" class="chat-stage">🍔 {{orderStage(chat)}}</span><em data-sensitive>{{ chat.phone || (chat.isGroup ? 'Grupo' : chat.externalId) }}</em></span><span class="chat-side"><time>{{ formatDate(chat.lastMessage?.at) }}</time><i v-if="chat.unreadCount">{{ chat.unreadCount }}</i></span>
            </button>
          </div>
        </q-expansion-item></template>
        </div>
        <div v-if="pages > 1" class="pagination compact"><button :disabled="page<=1" aria-label="Página anterior de conversas" @click="loadChats(page-1)">‹</button><span>{{ page }} / {{ pages }}</span><button :disabled="page>=pages" aria-label="Próxima página de conversas" @click="loadChats(page+1)">›</button></div>
      </aside>
      <article class="conversation">
        <div v-if="!selected" class="empty"><b>Escolha uma conversa</b><span>O painel abrirá já na mensagem mais recente.</span></div>
        <template v-else>
          <header class="conversation-head">
            <ChatFocusToggle :collapsed="chatListCollapsed" @toggle="toggleChatList(closeChat)" />
            <button class="icon-button mobile-back" aria-label="Voltar para a lista de conversas" @click="closeChat"><span class="material-icons" aria-hidden="true">arrow_back</span></button>
            <ContactAvatar :contact="selected" />
            <div class="contact-heading"><strong data-sensitive>{{ name(selected) }}</strong><span class="contact-attendance">{{ attendanceLabel(selected) }}</span><small data-sensitive>{{ selected.phone || selected.externalId }} · {{ selected.isGroup ? 'Grupo' : selected.isBusiness ? 'Conta comercial' : 'Contato' }}</small></div>
            <button class="icon-button" aria-label="Buscar em todo o histórico da conversa" @click="openSearch"><span class="material-icons">search</span></button>
            <span :class="['window-state',{closed:!selectedWindowOpen}]">{{ selected.isGroup ? 'Bot não atua em grupos' : selectedWindowOpen ? `Responder até ${formatDate(selected.serviceWindow.expiresAt,true)}` : 'Aguardando mensagem do contato' }}</span>
            <button class="btn secondary desktop-assume" v-can-action="'whatsapp_web.assign'" @click="selected.bot?.paused && selected.bot.ownerId===currentUser?.id && selected.bot.origin==='panel'?toggleBot():assumeChat()">{{selected.bot?.paused && selected.bot.ownerId===currentUser?.id && selected.bot.origin==='panel'?'Devolver ao bot':'Assumir chat'}}</button>
            <button v-can-action="['whatsapp_web.assign','whatsapp_web.edit','whatsapp_web.delete']" class="icon-button" aria-label="Ações da conversa" @click="chatActionsOpen = true"><span class="material-icons" aria-hidden="true">more_vert</span></button>
            <button v-if="canArea(getStoredUser(),'whatsapp_web')" class="icon-button" :aria-label="chatIsMuted('whatsapp_web', selectedId) ? 'Reativar notificações da conversa' : 'Silenciar notificações da conversa'" @click="toggleMute"><span class="material-icons">{{ chatIsMuted('whatsapp_web', selectedId) ? 'notifications_off' : 'notifications_active' }}</span></button>
          </header>
          <div ref="stream" v-chat-bottom="selectedId" class="message-stream">
            <p v-if="openingChat" class="message-loading" role="status">Carregando mensagens…</p>
            <button v-if="messagePage < messagePages" class="older" @click="older">Carregar mensagens anteriores</button>
            <div v-for="message in messages" :key="message._id" :class="['message-row',{mine:message.direction==='outbound'}]">
              <div :class="['bubble',{revoked:message.revoked}]">
                <button v-can-action="['whatsapp_web.send','whatsapp_web.edit','whatsapp_web.delete']" class="message-menu-trigger" aria-label="Ações da mensagem" @click="openMessageActions(message)"><span class="material-icons" aria-hidden="true">expand_more</span></button>
                <div v-if="message.type === 'call'" class="text-caption"><span class="material-icons">{{ message.metadata?.isVideo ? 'videocam' : 'call' }}</span> Atenda pelo WhatsApp no celular</div>
                <div v-if="message.quotedMessageId" class="quoted">↩ Resposta a uma mensagem</div>
                <img v-if="['image','sticker'].includes(message.media?.kind)" v-auth-src="message.media.url" alt="Imagem ou figurinha" class="message-image" :class="{'message-sticker': message.media?.kind === 'sticker'}" >
                <video v-else-if="message.media?.kind==='video'" v-auth-src="message.media.url" controls preload="metadata" ></video>
                <audio v-else-if="message.media?.kind==='audio'" v-auth-src="message.media.url" controls preload="metadata"></audio>
                <a v-else-if="message.media?.url" v-auth-href="message.media.url" target="_blank">▧ {{ message.media.filename || 'Baixar arquivo' }}<small>{{ message.media.mimeType }}</small></a>
                <a v-if="message.type==='location'&&message.metadata" v-auth-href="mapUrl(message)" class="location-card" data-sensitive target="_blank"><span>⌖</span><div><b>{{ message.metadata.name || message.body || 'Localização' }}</b><small>{{ message.metadata.address || `${message.metadata.latitude}, ${message.metadata.longitude}` }}</small></div></a>
                <a v-if="message.type==='location'&&message.metadata" v-auth-href="wazeUrl(message)" target="_blank" rel="noopener">Abrir no Waze</a><div v-if="message.type==='contact'" class="contact-card"><span>◉</span><div><b>{{ message.body || 'Contato compartilhado' }}</b><small>Cartão de contato do WhatsApp</small></div></div>
                <p v-if="bodyVisible(message)" v-html="formatWhatsApp(message.body)"></p>
                <div v-if="message.reactions?.length" class="reaction-chips"><span v-for="(reaction,index) in message.reactions" :key="index">{{ reaction.reaction }}</span></div>
                <footer><span v-if="message.starred">★</span><span v-if="message.editedAt">editada</span><span>{{ formatDate(message.timestamp) }}</span><span v-if="message.direction==='outbound'">{{ ack(message) }}</span></footer>
                <div v-can-action="['whatsapp_web.send','whatsapp_web.edit','whatsapp_web.delete']" class="message-tools"><button title="Responder" v-can-action="'whatsapp_web.send'" @click="replyTo=message">↩</button><button v-for="emoji in ['👍','❤️','😂','😮','😢','🙏','🔥','👏','✅','🎉']" :key="emoji" :title="`Reagir ${emoji}`" v-can-action="'whatsapp_web.send'" @click="react(message,emoji)">{{ emoji }}</button><button :title="message.starred?'Desfavoritar':'Favoritar'" v-can-action="'whatsapp_web.edit'" @click="messageAction(message,message.starred?'unstar':'star')">★</button><button title="Encaminhar" v-can-action="'whatsapp_web.send'" @click="startForward(message)">↗</button><button v-if="canAction(getStoredUser(),'whatsapp_web','delete')" title="Apagar do painel" :disabled="deleting" @click="requestDeleteMessage(message)">⌫</button><button v-if="message.direction==='outbound'&&!message.revoked" title="Editar" v-can-action="'whatsapp_web.edit'" @click="messageAction(message,'edit')">✎</button><button v-if="message.direction==='outbound'&&!message.revoked" title="Apagar para todos" v-can-action="'whatsapp_web.delete'" @click="messageAction(message,'delete')">×</button></div>
              </div>
            </div>
          </div>
          <div v-if="!selectedWindowOpen && !openingChat" class="window-notice">Aguarde uma mensagem recente do contato para responder nesta conversa.</div>
          <footer v-can-action="'whatsapp_web.send'" class="composer">
            <div v-if="replyTo" class="reply-preview"><span>Respondendo a: <b>{{ replyTo.body || replyTo.type }}</b></span><button @click="replyTo=null">×</button></div>
            <div v-if="composerMode==='location'" class="rich-composer"><button class="btn secondary" type="button" @click="currentLocation">Usar minha localização</button><div class="field"><label>Nome do local</label><input v-model="locationForm.name" placeholder="Escritório"></div><div class="field"><label>Endereço</label><input v-model="locationForm.address" placeholder="Endereço opcional"></div><div class="field"><label>Latitude</label><input v-model="locationForm.latitude" type="number" step="any"></div><div class="field"><label>Longitude</label><input v-model="locationForm.longitude" type="number" step="any"></div><button class="btn secondary" @click="composerMode='text'">Cancelar</button><button class="btn" :disabled="sending||locationForm.latitude === '' || locationForm.longitude === ''" @click="sendLocation">Enviar localização</button></div>
            <div v-else-if="composerMode==='contact'" class="rich-composer contact-mode"><div class="field"><label>Telefone com DDI e DDD</label><input v-model="contactForm.phone" inputmode="tel" placeholder="5511999999999"></div><button class="btn secondary" @click="composerMode='text'">Cancelar</button><button class="btn" :disabled="sending||!contactForm.phone" @click="sendContactCard">Enviar contato</button></div>
            <div v-else-if="composerMode==='asset'" class="rich-composer asset-mode"><div class="field"><label>Arquivo da biblioteca</label><select v-model="assetId"><option value="">Selecione…</option><option v-for="asset in assets" :key="asset._id" :value="asset._id">{{ asset.name }}</option></select></div><div class="field"><label>Legenda opcional</label><input v-model="draft"></div><label v-if="selectedAsset?.kind==='audio'" class="toggle"><input v-model="sendAsVoice" type="checkbox"> Enviar como voz</label><label class="toggle"><input v-model="sendAsDocument" type="checkbox"> Enviar como documento</label><button class="btn secondary" @click="composerMode='text'">Cancelar</button><button class="btn" :disabled="sending||!assetId" @click="sendStoredAsset">Enviar arquivo</button></div>
            <template v-else>
              <div v-if="file" class="file-preview"><audio v-if="file.type.startsWith('audio/')" :src="filePreviewUrl" controls preload="metadata" aria-label="Revisar gravação antes de enviar"></audio><img v-else-if="file.type.startsWith('image/')" :src="filePreviewUrl" alt="Prévia do anexo" style="max-width:100px;max-height:90px;object-fit:contain"><b>{{ file.name }}</b><small>{{ Math.ceil(file.size/1024) }} KB</small><label v-if="file.type.startsWith('audio/')"><input v-model="sendAsVoice" type="checkbox">Voz</label><label v-if="file.type.startsWith('image/')"><input v-model="sendAsSticker" type="checkbox" @change="sendAsDocument=false">Figurinha</label><label><input v-model="sendAsDocument" type="checkbox" @change="sendAsSticker=false">Documento</label><button class="icon-button" aria-label="Remover anexo" @click="file=null">×</button></div>
              <button class="attach" aria-label="Anexar arquivo, localização ou contato" :disabled="!selectedWindowOpen || openingChat" @click="attachmentOpen=true"><span class="material-icons" aria-hidden="true">attach_file</span></button>
              <div v-if="recording" class="voice-recording" role="status">● {{ recordingSeconds }}s <button class="btn secondary" @click="voice.cancel">Descartar</button><button class="btn" @click="voice.stop">Concluir gravação</button></div>
              <button v-if="!file && !recording" v-can-action="'whatsapp_web.send'" class="icon-button" aria-label="Gravar mensagem de voz" :disabled="sending || openingChat || !selectedWindowOpen || startingRecording" @click="startRecording"><span class="material-icons">mic</span></button>
              <textarea v-show="!recording" ref="draftElement" v-model="draft" aria-label="Mensagem para o contato" rows="1" :placeholder="file ? 'Legenda opcional…' : selectedWindowOpen ? 'Mensagem…' : 'Aguardando contato'" :disabled="!selectedWindowOpen || openingChat" @focus="onViewportResize" @keydown.ctrl.enter.prevent="file ? sendFile() : send()"></textarea>
              <button v-if="file" class="btn send-button" aria-label="Enviar anexo" :disabled="sending||!selectedWindowOpen" @click="sendFile"><span class="material-icons" aria-hidden="true">send</span></button><button v-else class="btn send-button" aria-label="Enviar mensagem" :disabled="sending||!draft.trim()||!selectedWindowOpen||openingChat" @click="send"><span class="material-icons" aria-hidden="true">send</span></button>
              <small>Ctrl + Enter para enviar · sem simulação de digitação</small>
            </template>
          </footer>
        </template>
      </article>
    </div>
    <q-dialog v-model="chatActionsOpen" position="bottom"><div v-if="selected" class="whatsapp-web-workspace chat-bottom-sheet"><header><div><h2 data-sensitive>{{ name(selected) }}</h2><p>{{ selected.bot?.paused ? 'Atendimento humano' : selected.bot?.ai?.profileKey ? 'IA ativa' : 'Bot ativo' }}<span v-if="orderStage(selected)"> · {{ orderStage(selected) }}</span></p></div><button class="icon-button" aria-label="Fechar ações da conversa" @click="chatActionsOpen = false">×</button></header><div class="chat-sheet-actions" @click="chatActionsOpen = false"><button v-can-action="'whatsapp_web.assign'" @click="selected.bot?.paused && selected.bot.ownerId===currentUser?.id && selected.bot.origin==='panel'?toggleBot():assumeChat()">{{selected.bot?.paused && selected.bot.ownerId===currentUser?.id && selected.bot.origin==='panel'?'Devolver ao bot':'Assumir atendimento'}}</button><button v-can-action="'whatsapp_web.assign'" @click="toggleBot">{{ selected.bot?.paused ? 'Reativar bot' : 'Pausar bot' }}</button><button v-can-action="'whatsapp_web.assign'" @click="attendanceAction('waiting')">Enviar para a fila da equipe</button><button v-can-action="'whatsapp_web.assign'" @click="openTransfer">Transferir atendimento</button><button v-can-action="'whatsapp_web.assign'" @click="attendanceAction('finish')">Concluir atendimento</button><button v-can-action="'whatsapp_web.assign'" @click="attendanceAction('triage')">Voltar à triagem</button><button v-can-action="'whatsapp_web.edit'" @click="renameContact">Editar nome exibido</button><button v-can-action="'whatsapp_web.assign'" @click="resetContext">Reiniciar contexto</button><button v-if="!selected.isMyContact&&!selected.isGroup" v-can-action="'whatsapp_web.edit'" @click="saveContact">Salvar contato no aparelho</button><button v-can-action="'whatsapp_web.edit'" @click="action(selected.archived?'unarchive':'archive')">{{ selected.archived ? 'Desarquivar' : 'Arquivar' }}</button><button v-can-action="'whatsapp_web.edit'" @click="action(selected.pinned?'unpin':'pin')">{{ selected.pinned ? 'Desafixar' : 'Fixar' }}</button><button v-can-action="'whatsapp_web.edit'" @click="action(selected.mutedUntil?'unmute':'mute',60)">{{ selected.mutedUntil ? 'Remover silêncio' : 'Silenciar por 1 hora' }}</button><button v-can-action="'whatsapp_web.edit'" @click="action('unread')">Marcar como não lida</button><button v-if="canAction(getStoredUser(),'whatsapp_web','delete')" class="delete-action" :disabled="deleting" @click="requestDeleteChat(true)">Limpar histórico do painel</button><button v-if="canAction(getStoredUser(),'whatsapp_web','delete')" class="delete-action" :disabled="deleting" @click="requestDeleteChat(false)">Excluir conversa do painel</button></div></div></q-dialog>
    <q-dialog v-model="searchOpen"><div class="card chat-history-search"><q-card-section class="row items-center"><strong>Buscar na conversa</strong><q-space/><q-btn flat round icon="close" v-close-popup aria-label="Fechar busca"/></q-card-section><q-card-section><form class="row q-gutter-sm" @submit.prevent="searchMessages(1)"><q-input v-model="messageSearch" outlined dense class="col" label="Texto no histórico" maxlength="200"/><q-btn type="submit" color="primary" icon="search" :loading="searchingMessages" :disable="messageSearch.trim().length < 2" aria-label="Buscar"/></form><p class="text-caption">Pesquisa em todas as mensagens armazenadas, inclusive páginas antigas. Não importa backups nem aciona o bot.</p><p aria-live="polite">{{ searchTotal }} resultado(s)</p><div class="search-results"><article v-for="result in searchResults" :key="result._id" class="search-result"><small>{{ result.direction === 'outbound' ? 'Equipe' : name(selected) }} · {{ formatDate(result.timestamp, true) }}</small><p v-html="formatWhatsApp(result.body)"></p></article></div><q-pagination v-if="searchPages > 1" :model-value="searchPage" :max="searchPages" :max-pages="5" :disable="searchingMessages" @update:model-value="searchMessages"/></q-card-section></div></q-dialog>
    <q-dialog v-model="attachmentOpen" position="bottom"><div class="whatsapp-web-workspace chat-bottom-sheet"><header><h2>Adicionar à mensagem</h2><button class="icon-button" aria-label="Fechar anexos" @click="attachmentOpen = false">×</button></header><div class="chat-sheet-actions"><label class="file-picker">Arquivo do dispositivo<input type="file" @change="pickFile"></label><button @click="openComposer('asset')">Arquivo da biblioteca</button><button @click="openComposer('location')">Localização</button><button @click="openComposer('contact')">Contato</button></div></div></q-dialog>
    <q-dialog v-model="messageActionsOpen" position="bottom"><div v-if="actionMessage" class="whatsapp-web-workspace chat-bottom-sheet"><header><h2>Ações da mensagem</h2><button class="icon-button" aria-label="Fechar ações da mensagem" @click="messageActionsOpen = false">×</button></header><p class="message-excerpt">{{ actionMessage.body || actionMessage.type }}</p><div class="message-reactions"><button v-for="emoji in ['👍','❤️','😂','😮','😢','🙏','🔥','👏','✅','🎉']" :key="emoji" :aria-label="`Reagir ${emoji}`" v-can-action="'whatsapp_web.send'" @click="runMessageAction('reaction', emoji)">{{ emoji }}</button></div><div class="reaction-custom"><label>Outro emoji <input v-model="customReaction" maxlength="32" aria-label="Outro emoji para reagir"></label><button class="btn secondary" v-can-action="'whatsapp_web.send'" :disabled="!customReaction" @click="runMessageAction('reaction', customReaction)">Reagir</button><button class="btn secondary" v-can-action="'whatsapp_web.send'" @click="runMessageAction('reaction', '')">Remover minha reação</button></div><div class="chat-sheet-actions"><button v-can-action="'whatsapp_web.send'" @click="runMessageAction('reply')">Responder</button><button v-can-action="'whatsapp_web.edit'" @click="runMessageAction(actionMessage.starred ? 'unstar' : 'star')">{{ actionMessage.starred ? 'Remover dos favoritos' : 'Favoritar' }}</button><button v-can-action="'whatsapp_web.send'" @click="runMessageAction('forward')">Encaminhar</button><button v-if="canAction(getStoredUser(),'whatsapp_web','delete')" class="delete-action" :disabled="deleting" @click="runMessageAction('remove-local')">Apagar do painel</button><button v-if="actionMessage.direction === 'outbound' && !actionMessage.revoked" v-can-action="'whatsapp_web.edit'" @click="runMessageAction('edit')">Editar mensagem</button><button v-if="actionMessage.direction === 'outbound' && !actionMessage.revoked" v-can-action="'whatsapp_web.delete'" @click="runMessageAction('delete')">Apagar para todos</button></div></div></q-dialog>
    <q-dialog v-model="transferOpen"><div class="whatsapp-web-workspace chat-bottom-sheet"><form @submit.prevent="attendanceAction('transfer')"><header><h2>Transferir atendimento</h2><button type="button" class="icon-button" @click="transferOpen = false" aria-label="Fechar transferência">×</button></header><p>O colaborador escolhido assume esta conversa e a automação fica pausada.</p><div class="field"><label for="transfer-assignee">Colaborador</label><select id="transfer-assignee" v-model="assigneeId" required><option value="">Selecione…</option><option v-for="person in assignees" :key="person._id" :value="person._id">{{ person.name }} · {{ person.nick }}</option></select></div><button class="btn" :disabled="!assigneeId">Transferir</button></form></div></q-dialog>
    <div v-if="forwarding" class="modal-backdrop" @click.self="forwarding=null"><div class="card forward-modal"><span class="eyebrow">Encaminhar mensagem</span><h2>{{ forwarding.body || forwarding.type }}</h2><div class="field"><label>Buscar destinatário</label><form class="row q-gutter-sm" @submit.prevent="findForwardChats"><input v-model="forwardSearch" class="col" placeholder="Nome ou telefone"><button class="btn secondary" type="submit">Buscar</button></form><label>Conversa receptiva de destino</label><select v-model="forwardTarget"><option value="">Selecione…</option><option v-for="chat in forwardChats.filter(item=>item.serviceWindow?.expiresAt&&new Date(item.serviceWindow.expiresAt).getTime()>now&&!item.isGroup)" :key="chat._id" :value="chat._id">{{ name(chat) }}</option></select></div><div><button class="btn secondary" @click="forwarding=null">Cancelar</button><button class="btn" :disabled="!forwardTarget||sending" v-can-action="'whatsapp_web.send'" @click="confirmForward">Encaminhar</button></div></div></div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped src="../chat-layout.css"></style>

<style scoped>
.chat-history-search { width: min(640px, 96vw); max-height: 88dvh; overflow: auto; }
.search-results { max-height: 52dvh; overflow: auto; }
.search-result { padding: 12px; border-bottom: 1px solid #cbded9; overflow-wrap: anywhere; }
.search-result p { white-space: pre-wrap; }
.message-sticker { max-width: 160px; max-height: 160px; object-fit: contain; background: transparent; }
.voice-recording { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: #b42335; }
.reaction-custom { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.reaction-custom input { width: 100px; }
</style>

<style scoped>
.composer:has(button[aria-label="Gravar mensagem de voz"]) { grid-template-columns: 40px 36px minmax(0, 1fr) 44px; }
.composer:has(.voice-recording) { grid-template-columns: minmax(0, 1fr); }
.composer:has(.voice-recording) > .attach, .composer:has(.voice-recording) > .send-button { display: none; }
@media(max-width: 600px) { .conversation-head { flex-wrap: wrap; } .contact-heading { flex: 1; min-width: 70px; } .conversation-head .icon-button { flex-shrink: 0; } }
</style>
