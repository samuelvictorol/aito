<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMeta } from 'quasar'
import { api, apiBaseURL } from 'boot/axios'

useMeta({ title: 'Conversas da equipe | AitoSoftwares', meta: { robots: { name: 'robots', content: 'noindex, nofollow' } } })
const route = useRoute()
const base = computed(() => '/desktop-collaborators/' + encodeURIComponent(route.params.slug))
const user = ref(null)
const credentials = ref({ username: '', password: '', code: '' })
const challenge = ref('')
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const online = ref(false)
const chats = ref([])
const chatPage = ref(1)
const chatPages = ref(1)
const search = ref('')
const scope = ref('all')
const active = ref(null)
const messages = ref([])
const messagePage = ref(1)
const messagePages = ref(1)
const draft = ref('')
const attached = ref([])
const quoted = ref(null)
const fileInput = ref(null)
const transcript = ref(null)
const transfer = ref(false)
const assignees = ref([])
const assignee = ref('')
const scopes = [
  { label: 'Todas as conversas', value: 'all' }, { label: 'Meus atendimentos', value: 'mine' },
  { label: 'Aguardando', value: 'waiting' }, { label: 'Em triagem', value: 'triage' },
  { label: 'IA ativa', value: 'ai' }, { label: 'Em atendimento', value: 'attending' },
  { label: 'Finalizadas', value: 'closed' },
]
let live, searchTimer, liveTimer, retryTimer, listRequest = 0, messageRequest = 0, identityRequest = 0

function messageOf(cause) {
  return cause.response?.data?.message || 'Confira a conexão com o Desktop e tente novamente.'
}

function stopLive() {
  live?.close()
  live = null
  online.value = false
  clearTimeout(liveTimer)
  liveTimer = undefined
  clearTimeout(retryTimer)
}

function endSession() {
  stopLive()
  ++listRequest
  ++messageRequest
  user.value = null
  chats.value = []
  active.value = null
  messages.value = []
  draft.value = ''
  attached.value = []
  quoted.value = null
  challenge.value = ''
  loading.value = false
  busy.value = false
  credentials.value = { username: '', password: '', code: '' }
}

function showError(cause) {
  if (cause.response?.status === 401) {
    ++identityRequest
    endSession()
  }
  error.value = messageOf(cause)
}

async function restore() {
  const request = ++identityRequest
  endSession()
  error.value = ''
  loading.value = true
  try {
    const { data } = await api.get(base.value + '/session')
    if (request !== identityRequest) return
    await enter(data.user)
  } catch (cause) {
    if (request === identityRequest && cause.response?.status !== 401) showError(cause)
  } finally { if (request === identityRequest) loading.value = false }
}

async function enter(value) {
  user.value = value
  await loadChats()
  if (user.value) openLive()
}

async function login() {
  const request = ++identityRequest
  const verifying = Boolean(challenge.value)
  busy.value = true
  error.value = ''
  try {
    const payload = verifying ? { challengeId: challenge.value, code: credentials.value.code } : {
      username: credentials.value.username, password: credentials.value.password,
    }
    const { data } = await api.post(base.value + (verifying ? '/verify' : '/login'), payload)
    if (request !== identityRequest) return
    if (data.requiresMfa) challenge.value = data.challengeId
    else {
      credentials.value = { username: '', password: '', code: '' }
      challenge.value = ''
      await enter(data.user)
    }
  } catch (cause) {
    if (request === identityRequest) error.value = messageOf(cause)
  } finally {
    if (request === identityRequest) {
      credentials.value.password = ''
      credentials.value.code = ''
      busy.value = false
    }
  }
}

async function logout() {
  ++identityRequest
  endSession()
  try { await api.post(base.value + '/logout') } catch (cause) { error.value = messageOf(cause) }
}

async function loadChats() {
  const request = ++listRequest
  try {
    const { data } = await api.get(base.value + '/chats', { params: { search: search.value, scope: scope.value, page: chatPage.value } })
    if (request !== listRequest) return
    chats.value = data.items
    chatPages.value = data.pages
    if (active.value) active.value = data.items.find(item => item.id === active.value.id) || active.value
  } catch (cause) { if (request === listRequest) showError(cause) }
}

function clearChat() {
  ++messageRequest
  active.value = null
  messages.value = []
  quoted.value = null
  draft.value = ''
  attached.value = []
}

async function loadMessages(page = 1) {
  const id = active.value?.id
  if (!id) return
  const request = ++messageRequest
  try {
    const { data } = await api.get(base.value + '/chats/' + id + '/messages', { params: { page } })
    if (request !== messageRequest || active.value?.id !== id) return
    const existing = new Map(messages.value.map(message => [message.id, message]))
    const nearBottom = !transcript.value || transcript.value.scrollHeight - transcript.value.clientHeight - transcript.value.scrollTop < 90
    if (page === 1 && messagePage.value === 1) existing.clear()
    for (const item of data.items) existing.set(item.id, item)
    messages.value = [...existing.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    messagePage.value = Math.max(page, messagePage.value)
    messagePages.value = data.pages
    await nextTick()
    if (page === 1 && nearBottom && transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight
  } catch (cause) {
    if (request !== messageRequest) return
    if ([403, 404].includes(cause.response?.status)) clearChat()
    showError(cause)
  }
}

async function openChat(chat) {
  if (busy.value || active.value?.id === chat.id) return
  if (active.value && (draft.value.trim() || attached.value.length) && !window.confirm('Descartar a mensagem em edição?')) return
  clearChat()
  active.value = chat
  messagePage.value = 1
  messagePages.value = 1
  await loadMessages()
  if (active.value?.id === chat.id && chat.unread) {
    api.patch(base.value + '/chats/' + chat.id + '/read').catch(cause => {
      if (cause.response?.status === 401) showError(cause)
    })
  }
}

function openLive() {
  stopLive()
  const source = new EventSource(apiBaseURL.replace(/\/$/, '') + base.value + '/live', { withCredentials: true })
  live = source
  source.addEventListener('ready', () => { online.value = true; void loadChats(); void loadMessages() })
  source.addEventListener('changed', () => {
    if (!user.value || liveTimer) return
    liveTimer = setTimeout(() => { liveTimer = undefined; void loadChats(); void loadMessages() }, 450)
  })
  source.onerror = async () => {
    if (live !== source || !user.value) return
    online.value = false
    try { await api.get(base.value + '/session') }
    catch (cause) { if (live === source && cause.response?.status === 401) showError(cause) }
    if (live === source && source.readyState === EventSource.CLOSED) retryTimer = setTimeout(openLive, 5000)
  }
}

function addFiles(files) {
  if (busy.value) return
  error.value = ''
  const selected = [...files]
  if (selected.some(file => !file.size || file.size > 10 * 1024 * 1024)) {
    error.value = 'Cada anexo deve ter até 10 MB.'
    return
  }
  attached.value = [...attached.value, ...selected].slice(0, 8)
  if (fileInput.value) fileInput.value.value = ''
}

async function send() {
  if (!active.value || busy.value || (!draft.value.trim() && !attached.value.length)) return
  const request = identityRequest
  const path = base.value + '/chats/' + active.value.id
  busy.value = true
  error.value = ''
  try {
    if (attached.value.length) {
      for (const file of [...attached.value]) {
        if (request !== identityRequest) return
        await api.post(path + '/media', file, { headers: {
          'Content-Type': 'application/octet-stream',
          'X-Aito-Filename': encodeURIComponent(file.name.slice(0, 160)),
          'X-Aito-Caption': encodeURIComponent(draft.value.slice(0, 1024)),
          'X-Aito-Mime': encodeURIComponent(file.type),
        } })
        if (request !== identityRequest) return
        attached.value = attached.value.filter(item => item !== file)
        draft.value = ''
      }
    } else {
      await api.post(path + '/messages', { text: draft.value, quotedMessageId: quoted.value?.id })
      if (request !== identityRequest) return
      draft.value = ''
    }
    quoted.value = null
    await loadMessages()
  } catch (cause) { if (request === identityRequest) showError(cause) }
  finally { if (request === identityRequest) busy.value = false }
}

async function download(media) {
  error.value = ''
  try {
    const { data } = await api.get(base.value + '/media/' + media.id, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = media.name || 'anexo'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (cause) { showError(cause) }
}

async function attendance(action) {
  if (!active.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await api.post(base.value + '/chats/' + active.value.id + '/attendance', { action, assigneeId: action === 'transfer' ? assignee.value : undefined })
    transfer.value = false
    if (action === 'transfer') clearChat()
    await loadChats()
  } catch (cause) { showError(cause) }
  finally { busy.value = false }
}

async function showTransfer() {
  error.value = ''
  try {
    const { data } = await api.get(base.value + '/assignees')
    assignees.value = data.items
    assignee.value = ''
    transfer.value = true
  } catch (cause) { showError(cause) }
}

function dateLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

watch(base, restore, { immediate: true })
watch([search, scope], () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { chatPage.value = 1; if (user.value) void loadChats() }, 250)
})
onBeforeUnmount(() => { ++identityRequest; clearTimeout(searchTimer); endSession() })
</script>

<template>
  <main class="collab">
    <header class="collab-header">
      <div class="collab-brand"><img src="/aito-logo-restored.png" alt="" /><div><strong>AitoSoftwares</strong><small>WhatsApp da equipe</small></div></div>
      <div v-if="user" class="collab-account">
        <span :class="{ connected: online }"><span></span>{{ online ? 'Ao vivo' : 'Reconectando' }}</span>
        <strong>{{ user.name }}</strong>
        <q-btn flat round icon="mdi-logout" aria-label="Sair" @click="logout" />
      </div>
    </header>
    <div v-if="loading" class="collab-login"><q-spinner size="38px" color="teal-8" /><p>Verificando acesso…</p></div>
    <q-form v-else-if="!user" class="collab-login" @submit="login">
      <q-icon name="mdi-whatsapp" color="teal-8" size="42px" />
      <h1>Conversas da equipe</h1>
      <p>{{ challenge ? 'Use o código enviado ao e-mail cadastrado pelo administrador.' : 'Entre com seu usuário de colaborador cadastrado no Desktop.' }}</p>
      <q-banner v-if="error" rounded class="bg-orange-1 text-deep-orange-10" role="alert">{{ error }}</q-banner>
      <q-input v-if="challenge" v-model="credentials.code" label="Código de verificação" outlined maxlength="6" inputmode="numeric" autocomplete="one-time-code" required />
      <template v-else>
        <q-input v-model="credentials.username" outlined label="Usuário" autocomplete="username" maxlength="60" required />
        <q-input v-model="credentials.password" outlined label="Senha" type="password" autocomplete="current-password" maxlength="128" required />
      </template>
      <q-btn unelevated color="teal-8" no-caps type="submit" :label="challenge ? 'Verificar código' : 'Entrar'" :loading="busy" />
      <q-btn v-if="challenge" flat no-caps label="Voltar" @click="challenge = ''; error = ''" />
    </q-form>
    <template v-else>
      <q-banner v-if="error" rounded class="collab-error bg-orange-1 text-deep-orange-10" role="alert">
        {{ error }}
        <template #action><q-btn flat round icon="mdi-close" aria-label="Dispensar aviso" @click="error = ''" /></template>
      </q-banner>
      <div :class="['collab-workspace', { 'chat-open': active }]">
        <aside class="collab-inbox" aria-label="Lista de conversas">
          <header><h1>Conversas</h1><q-btn round flat icon="mdi-refresh" aria-label="Atualizar conversas" @click="loadChats" /></header>
          <q-input v-model="search" dense outlined clearable label="Nome ou telefone" maxlength="100" @clear="search = ''"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
          <q-select v-model="scope" :options="scopes" dense outlined map-options emit-value label="Fila de atendimento" />
          <div class="collab-rows">
            <button v-for="chat in chats" :key="chat.id" type="button" :class="{ selected: chat.id === active?.id }" @click="openChat(chat)">
              <span class="collab-avatar">{{ (chat.name || chat.phone || '?').slice(0, 2).toUpperCase() }}</span>
              <span><strong>{{ chat.name || chat.phone || 'Contato' }}</strong><small>{{ chat.last || chat.phone }}</small></span>
              <span v-if="chat.unread" class="collab-unread">{{ chat.unread }}</span>
            </button>
            <p v-if="!chats.length">Nenhuma conversa nesta lista.</p>
          </div>
          <q-pagination v-if="chatPages > 1" v-model="chatPage" :max="chatPages" :max-pages="5" color="teal-8" @update:model-value="loadChats" />
        </aside>
        <section v-if="active" class="collab-conversation" aria-label="Conversa aberta" @dragover.prevent @drop.prevent="addFiles($event.dataTransfer.files)">
          <header>
            <q-btn class="collab-back" flat round icon="mdi-arrow-left" aria-label="Voltar às conversas" :disable="busy" @click="clearChat" />
            <span class="collab-avatar">{{ (active.name || active.phone || '?').slice(0, 2).toUpperCase() }}</span>
            <div><h2>{{ active.name || 'Contato' }}</h2><small>{{ active.phone }}</small></div>
            <q-btn-dropdown flat round dropdown-icon="mdi-dots-vertical" aria-label="Ações do atendimento">
              <q-list>
                <q-item v-close-popup clickable @click="attendance('waiting')"><q-item-section>Colocar em espera</q-item-section></q-item>
                <q-item v-close-popup clickable @click="attendance('triage')"><q-item-section>Devolver à triagem</q-item-section></q-item>
                <q-item v-close-popup clickable @click="showTransfer"><q-item-section>Transferir atendimento</q-item-section></q-item>
                <q-item v-close-popup clickable @click="attendance('finish')"><q-item-section>Finalizar atendimento</q-item-section></q-item>
              </q-list>
            </q-btn-dropdown>
          </header>
          <div ref="transcript" class="collab-transcript" aria-label="Histórico de mensagens">
            <q-btn v-if="messagePage < messagePages" flat no-caps color="teal-8" label="Ver mensagens anteriores" @click="loadMessages(messagePage + 1)" />
            <article v-for="message in messages" :key="message.id" :class="{ outgoing: message.direction === 'outbound' }">
              <p>{{ message.revoked ? 'Mensagem apagada' : message.text }}</p>
              <q-btn v-if="message.media && !message.revoked" flat dense no-caps color="teal-8" icon="mdi-download" :label="message.media.name || 'Baixar anexo'" @click="download(message.media)" />
              <footer><small>{{ dateLabel(message.timestamp) }} {{ message.ack > 1 ? '✓✓' : message.ack > 0 ? '✓' : '' }}</small>
                <q-btn v-if="!message.revoked" flat dense round size="sm" icon="mdi-reply" aria-label="Responder a esta mensagem" @click="quoted = message" /></footer>
            </article>
          </div>
          <q-form class="collab-compose" @submit="send">
            <div v-if="quoted" class="collab-quote"><span>{{ quoted.text || quoted.media?.name || 'Mensagem' }}</span><q-btn flat round dense icon="mdi-close" aria-label="Remover resposta citada" @click="quoted = null" /></div>
            <div v-if="attached.length" class="collab-files"><q-chip v-for="(file, index) in attached" :key="index" removable :label="file.name" icon="mdi-paperclip" @remove="attached.splice(index, 1)" /></div>
            <div class="collab-compose-row">
              <input ref="fileInput" hidden type="file" multiple @change="addFiles($event.target.files)" />
              <q-btn flat round icon="mdi-paperclip" aria-label="Anexar arquivos" :disable="busy" @click="fileInput.click()" />
              <q-input v-model="draft" outlined dense autogrow type="textarea" :maxlength="attached.length ? 1024 : 8000" :label="attached.length ? 'Legenda' : 'Digite uma mensagem'" @keydown.ctrl.enter.prevent="send" />
              <q-btn round unelevated color="teal-8" icon="mdi-send" aria-label="Enviar" type="submit" :loading="busy" />
            </div>
          </q-form>
        </section>
        <section v-else class="collab-empty"><q-icon name="mdi-message-text-outline" size="54px" /><h2>Abra uma conversa</h2><p>Selecione um contato para ver o histórico e responder.</p></section>
      </div>
      <q-dialog v-model="transfer">
        <q-card class="q-pa-md" style="width: 400px">
          <q-card-section><div class="text-h6">Transferir atendimento</div></q-card-section>
          <q-card-section><q-select v-model="assignee" outlined emit-value map-options :options="assignees" option-value="id" option-label="name" label="Colaborador" /></q-card-section>
          <q-card-actions align="right"><q-btn v-close-popup flat no-caps label="Cancelar" /><q-btn unelevated no-caps color="teal-8" label="Transferir" :disable="!assignee" :loading="busy" @click="attendance('transfer')" /></q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </main>
</template>

<style scoped>
.collab { min-height: 100dvh; color: #12392f; background: radial-gradient(ellipse at 15% 3%, #ddf7ef, transparent 58%), #f4f8f6; padding: 0 clamp(12px, 4vw, 56px) 24px; }
.collab-header, .collab-workspace, .collab-error { width: min(100%, 1320px); margin: 0 auto; }
.collab-header, .collab-brand, .collab-account, .collab-conversation > header, .collab-inbox > header { display: flex; align-items: center; gap: 12px; }
.collab-header { justify-content: space-between; min-height: 70px; }
.collab-brand img { width: 38px; height: 38px; border-radius: 10px; }
.collab-brand strong, .collab-brand small { display: block; }
.collab-brand small { color: #4c6b61; }
.collab-account > span { display: flex; align-items: center; gap: 6px; color: #875b15; font-size: .8rem; }
.collab-account > span > span { width: 8px; height: 8px; background: #d8973b; border-radius: 50%; }
.collab-account > span.connected { color: #12674d; }
.collab-account > span.connected > span { background: #19a576; }
.collab-login { display: grid; width: min(100%, 420px); gap: 15px; margin: 8vh auto 0; padding: clamp(20px, 5vw, 36px); background: white; border: 1px solid #d2e5de; border-radius: 22px; box-shadow: 0 20px 46px #1d4d3312; }
.collab-login h1, .collab-inbox h1, .collab-conversation h2, .collab-empty h2 { margin: 0; font-size: 1.42rem; line-height: 1.2; font-weight: 800; }
.collab-login p, .collab-empty p { margin: 0; color: #506e64; }
.collab-error { margin-bottom: 10px; }
.collab-workspace { display: grid; grid-template-columns: minmax(270px, 32%) minmax(0, 1fr); height: calc(100dvh - 96px); min-height: 430px; overflow: hidden; border: 1px solid #cce2d8; border-radius: 22px; background: #fff; }
.collab-inbox { min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px; border-right: 1px solid #d8e9e1; }
.collab-inbox > header { justify-content: space-between; }
.collab-rows { flex: 1; min-height: 0; overflow-y: auto; }
.collab-rows > button { width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 11px 8px; text-align: left; color: inherit; border: 0; border-radius: 12px; background: none; cursor: pointer; }
.collab-rows > button:hover, .collab-rows > button.selected { background: #e6f5ef; }
.collab-rows strong, .collab-rows small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collab-rows small { color: #4e6a61; }
.collab-avatar { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; background: #d5f2e6; color: #166a54; font-weight: 800; }
.collab-unread { align-self: start; border-radius: 20px; padding: 1px 7px; background: #13795e; color: white; font-size: .74rem; }
.collab-conversation { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.collab-conversation > header { flex-shrink: 0; min-height: 63px; padding: 10px 14px; }
.collab-conversation > header > div { min-width: 0; flex: 1; }
.collab-conversation h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.15rem; }
.collab-transcript { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 11px; align-items: flex-start; overflow: auto; padding: clamp(10px, 2.8vw, 30px); background-color: #e9f2ec; background-image: radial-gradient(#cbded3 1px, transparent 1px); background-size: 17px 17px; }
.collab-transcript > .q-btn { align-self: center; flex-shrink: 0; }
.collab-transcript article { max-width: min(90%, 590px); padding: 10px 12px; border-radius: 3px 13px 13px; background: #fff; overflow-wrap: anywhere; box-shadow: 0 2px 5px #15342415; }
.collab-transcript article.outgoing { align-self: flex-end; border-radius: 13px 3px 13px 13px; background: #d6f3de; }
.collab-transcript article p { margin: 0; white-space: pre-wrap; }
.collab-transcript article footer { display: flex; align-items: center; justify-content: flex-end; gap: 5px; color: #526d62; }
.collab-compose { padding: 9px 12px; }
.collab-compose-row { display: flex; gap: 8px; align-items: flex-end; }
.collab-compose-row > .q-field { flex: 1; min-width: 0; }
.collab-files { display: flex; flex-wrap: wrap; }
.collab-files .q-chip { max-width: min(100%, 220px); }
.collab-quote { display: flex; justify-content: space-between; align-items: center; gap: 5px; padding: 4px 10px; margin-bottom: 8px; background: #e7f7ef; border-radius: 8px; }
.collab-quote span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collab-empty { display: grid; gap: 6px; place-content: center; justify-items: center; padding: 20px; text-align: center; color: #46705f; }
.collab-conversation .collab-back { display: none; }
@media (max-width: 720px) {
  .collab { padding: 0 6px 6px; }
  .collab-header { padding: 0 8px; min-height: 58px; }
  .collab-account > strong { display: none; }
  .collab-workspace { grid-template-columns: minmax(0, 1fr); height: calc(100dvh - 66px); border-radius: 12px; }
  .collab-empty, .collab-workspace.chat-open .collab-inbox { display: none; }
  .collab-inbox { border: 0; min-height: 0; }
  .collab-conversation .collab-back { display: inline-flex; }
}
</style>
