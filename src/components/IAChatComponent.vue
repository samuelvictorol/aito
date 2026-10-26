<template>
  <div class="chat-shell bg-dark text-white" @wheel.stop @touchmove.stop>
    <div class="chat-container">

      <!-- Cabeçalho -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-subtitle1 text-bold row items-center">
          <q-btn round class="ia-fab cta-btn q-mr-sm" tabindex="-1" aria-hidden="true">
            <q-img src="/ia.gif" width="50px" alt="gif robo atendimento 24h com i.a" />
          </q-btn>
          <div>
            Assistente AITO <br />
            <span class="assistant-subtitle">Serviços · WhatsApp · IA</span>
          </div>
        </div>
        <div class="row items-center">
        <q-btn flat round dense class="chat-reset" icon="mdi-broom" aria-label="Limpar conversa" @click="resetChat"><q-tooltip>Limpar conversa e voltar ao início</q-tooltip></q-btn>
        <q-btn
          flat
          round
          dense
          icon="mdi-close"
          aria-label="Fechar assistente"
          class="chat-close"
          @click="emit('close')"
        />
        </div>
      </div>

      <!-- Lista de mensagens -->
      <div ref="scrollAreaRef" class="chat-messages" data-native-scroll tabindex="0" aria-label="Histórico da conversa" @scroll="trackScroll">
          <div class="chat-message-list" role="log" aria-live="polite">
          <div v-for="(msg, index) in messages" :key="index" class="q-mb-lg flex"
            :class="msg.from === 'user' ? 'justify-end' : 'justify-start'">
            <div class="chat-bubble"
              :class="msg.from === 'user' ? 'chat-bubble-user' : 'chat-bubble-ia'">
              <div class="text-body2 chat-text">
                {{ msg.text }}
              </div>

              <!-- Botão de link (só aparece quando o backend mandar link) -->
              <div v-if="msg.link" class="q-mt-xs">
              <q-btn :label="msg.link.label || 'Abrir link'" :href="msg.link.url" target="_blank" color="green-14"
                  rel="noopener noreferrer" icon="mdi-open-in-new" size="sm" no-caps />
              </div>
            </div>
          </div>

          <div v-if="loading" class="q-mt-xs chat-loading text-caption">
            <span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span> AITO está digitando...
          </div>

          <div v-if="conversationToken && !loading && suggestions.length" class="triage-panel">
            <div class="triage-title">{{ hasUserMessages ? 'Continue por aqui' : 'O que você quer resolver?' }}</div>
            <div class="triage-options">
              <q-btn
                v-for="option in suggestions"
                :key="option"
                outline
                no-caps
                class="triage-option"
                :label="option"
                @click="sendMessage(option)"
              />
            </div>
          </div>
          </div>
      </div>

      <!-- Input + botão enviar -->
      <q-form class="chat-input row items-center q-gutter-sm" @submit.prevent="sendMessage()">
        <q-input v-model="currentMessage" class="col" color="secondary" dark dense outlined
          :placeholder="inputPlaceholder" :maxlength="conversationToken ? MESSAGE_LIMIT : identificationStep === 'name' ? 100 : 400" :disable="loading" aria-label="Mensagem para o assistente AITO" :autocomplete="conversationToken ? 'off' : identificationStep === 'name' ? 'name' : 'off'" />

        <q-btn class="cta-btn" type="submit" icon="mdi-send" aria-label="Enviar mensagem" :loading="loading" :disable="!canSend" />
      </q-form>
      <p v-if="!conversationToken" class="contact-privacy">Usaremos seu nome e contato para este atendimento. <router-link to="/politica-privacidade">Política de privacidade</router-link></p>
      <div v-else class="chat-commercial"><q-btn flat dense no-caps icon="mdi-account-outline" label="Falar com a equipe" :href="commercialUrl" target="_blank" rel="noopener noreferrer" /><span>Você escolhe quando avançar.</span></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { MESSAGE_LIMIT, initialSuggestions, sanitizeMessages, sanitizeReply, buildCommercialUrl } from 'src/utils/siteAssistant'
import { waitForAssistantBubble } from 'src/utils/siteAssistantFlow'
import { identityGreeting, identityContactQuestion, identityWelcome, parseVisitorName, parseVisitorContact } from 'src/utils/siteAssistantIdentity'

const emit = defineEmits(['close'])
const route = useRoute()
const STORAGE_KEY = 'aito_site_chat_messages_v4'
const messages = ref([{ from: 'ia', text: identityGreeting(), link: null }])
const suggestions = ref([])
const currentMessage = ref('')
const loading = ref(false)
const conversationToken = ref(''), identifying = ref(false), identificationStep = ref('name'), visitor = reactive({ name: '', email: '', phone: '' })
const inputPlaceholder = computed(() => conversationToken.value ? 'Conte o que você precisa...' : identificationStep.value === 'name' ? 'Digite seu nome...' : 'Seu e-mail e/ou telefone com DDD...')
async function identify(text) {
  if (identifying.value || loading.value) return
  const turn = ++requestId
  const controller = requestController = new AbortController()
  identifying.value = loading.value = true
  currentMessage.value = ''; followLatest = true
  messages.value.push({ from: 'user', text, link: null })
  try {
    if (identificationStep.value === 'name') {
      const name = parseVisitorName(text)
      if (!name) { await appendReply({ replies: ['Como posso chamar você? Envie seu nome, por favor.'], suggestions: [], link: null }, controller.signal); return }
      visitor.name = name
      identificationStep.value = 'contact'
      await appendReply({ replies: [identityContactQuestion(name)], suggestions: [], link: null }, controller.signal)
      return
    }
    const contact = parseVisitorContact(text)
    if (!contact) { await appendReply({ replies: ['Não consegui reconhecer o contato. Pode enviar um e-mail válido, um telefone com DDD ou os dois na mesma mensagem?'], suggestions: [], link: null }, controller.signal); return }
    Object.assign(visitor, contact)
    const result = (await api.post('/site-assistant/start', { name: visitor.name, ...contact, pagePath: route.path }, { timeout: 14000, signal: controller.signal })).data
    if (disposed || controller.signal.aborted || turn !== requestId) return
    if (!/^[\w-]{43}$/.test(result.conversationToken || '')) throw new Error('Invalid visitor session')
    conversationToken.value = result.conversationToken
    try { sessionStorage.setItem('aito_site_chat_identity_v1', JSON.stringify({ token: result.conversationToken, name: result.name })) } catch { /* The current conversation also works without browser storage. */ }
    await appendReply({ replies: [result.welcomeMessage || identityWelcome(visitor.name)], suggestions: [...initialSuggestions], link: null }, controller.signal)
    saveToSession()
  } catch (error) {
    if (disposed || controller.signal.aborted || turn !== requestId) return
    await appendReply({ replies: [error.response?.data?.message || 'Não consegui iniciar seu atendimento agora. Pode enviar o contato novamente em instantes?'], suggestions: [], link: null }, controller.signal).catch(() => {})
  } finally { if (turn === requestId && !disposed) identifying.value = loading.value = false }
}
let requestController
let disposed = false
let requestId = 0
let followLatest = true
const scrollAreaRef = ref(null)
function trackScroll() {
  const target = scrollAreaRef.value
  if (target) followLatest = target.scrollHeight - target.scrollTop - target.clientHeight < 70
}
const scrollToBottom = () => {
  const target = scrollAreaRef.value
  if (target && followLatest) target.scrollTop = target.scrollHeight
}

const loadFromSession = () => {
  if (!conversationToken.value) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    const saved = sanitizeMessages(parsed?.messages)
    if (saved.length) {
      messages.value = saved
      suggestions.value = sanitizeReply({ ia_replies: ['restored'], suggestions: parsed?.suggestions }).suggestions
    }
  } catch { /* Storage can be disabled; the conversation remains usable. */ }
}

const saveToSession = () => {
  if (!conversationToken.value) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: sanitizeMessages(messages.value), suggestions: suggestions.value }))
  } catch { /* Storage can be full or unavailable. */ }
}

onMounted(async () => {
  try { const saved = JSON.parse(sessionStorage.getItem('aito_site_chat_identity_v1') || 'null'); if (/^[\w-]{43}$/.test(saved?.token || '')) { conversationToken.value = saved.token; visitor.name = saved.name || '' } } catch { /* Identification is requested again if storage is unavailable. */ }
  if (conversationToken.value) {
    messages.value = [{ from: 'ia', text: identityWelcome(visitor.name), link: null }]
    suggestions.value = [...initialSuggestions]
    loadFromSession()
  }
  await nextTick()
  scrollToBottom()
})
onBeforeUnmount(() => {
  disposed = true
  requestController?.abort()
})
watch(
  () => [messages.value.length, loading.value, suggestions.value.length],
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch([messages, suggestions], saveToSession, { deep: true })
const canSend = computed(() => currentMessage.value.trim().length > 0 && !loading.value)
const hasUserMessages = computed(() => messages.value.some(message => message.from === 'user'))
const commercialUrl = computed(() => buildCommercialUrl(messages.value))

function resetChat() {
  conversationToken.value = ''; identificationStep.value = 'name'
  Object.assign(visitor, { name: '', email: '', phone: '' })
  try { sessionStorage.removeItem('aito_site_chat_identity_v1'); sessionStorage.removeItem(STORAGE_KEY) } catch { /* Storage can be disabled. */ }
  requestId++
  requestController?.abort()
  identifying.value = loading.value = false
  followLatest = true
  messages.value = [{ from: 'ia', text: identityGreeting(), link: null }]
  suggestions.value = []
  currentMessage.value = ''
}

const sendMessage = async (presetText = '') => {
  const text = (presetText || currentMessage.value).trim().slice(0, MESSAGE_LIMIT)
  if (!text || loading.value || identifying.value) return
  if (!conversationToken.value) return identify(text)
  const history = sanitizeMessages(messages.value).slice(-24).map(({ from, text }) => ({ from, text }))
  currentMessage.value = ''
  messages.value.push({ from: 'user', text, link: null })
  followLatest = true
  loading.value = true
  const turn = ++requestId
  const controller = requestController = new AbortController()
  try {
    const data = (await api.post('/talk_site_bot', { last_message: text, history, page_path: route.path, conversationToken: conversationToken.value }, { timeout: 14000, signal: controller.signal })).data
    if (disposed || controller.signal.aborted) return
    await appendReply(sanitizeReply(data), controller.signal)
  } catch (error) {
    if (disposed || controller.signal.aborted) return
    if (error.response?.status === 401) {
      conversationToken.value = ''; identificationStep.value = 'name'
      Object.assign(visitor, { name: '', email: '', phone: '' })
      try { sessionStorage.removeItem('aito_site_chat_identity_v1'); sessionStorage.removeItem(STORAGE_KEY) } catch { /* Storage can be disabled. */ }
    }
    await appendReply({ replies: [error.response?.data?.message || 'Não consegui enviar sua mensagem agora. Confira a conexão e tente novamente.'], suggestions: [], link: null }, controller.signal).catch(() => {})
  } finally {
    if (turn === requestId && !disposed) loading.value = false
  }
}

async function appendReply(reply, signal) {
  suggestions.value = []
  for (const [index, text] of reply.replies.entries()) {
    await waitForAssistantBubble(signal, text, index)
    if (disposed || signal.aborted) return
    messages.value.push({ from: 'ia', text, link: index === reply.replies.length - 1 ? reply.link : null })
  }
  suggestions.value = reply.suggestions
  messages.value = sanitizeMessages(messages.value)
}
</script>


<style scoped>
.contact-privacy{font-size:10px;line-height:1.6;color:#9bc2b5;margin:12px 0 0}.contact-privacy a{color:#8fffee}
.chat-shell {
  width: min(94vw, 32rem);
  height: min(82vh, 44rem);
  max-height: calc(100vh - 1.5rem);
  overflow: hidden;
  border: 1px solid rgba(19, 188, 157, 0.34);
  border-radius: 1rem;
  background: linear-gradient(145deg, rgba(3, 25, 26, 0.96), rgba(1, 10, 12, 0.98));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48);
}

.chat-container {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 1rem;
  flex-direction: column;
  color: #edfffb;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: #329b83 #071d20;
}

.chat-message-list {
  min-width: 0;
  overflow-x: hidden;
  padding: 0.25rem 0.25rem 1rem;
}

.chat-bubble {
  max-width: 88%;
  overflow-wrap: anywhere;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 0.9rem;
  line-height: 1.4;
  animation: aito-bubble-in 180ms ease-out;
}
@keyframes aito-bubble-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

.chat-text { white-space: pre-line; }
.assistant-subtitle { font-size: 11px; color: #94c7bc; font-weight: 500; }
.chat-commercial { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 8px; color: #a9dbcd; }
.chat-commercial .q-btn { font-size: 11px; }
.chat-commercial span { font-size: 10px; color: #89aea6; }

.chat-bubble-user {
  background: linear-gradient(135deg, #13bc9d, #12ad89);
  color: #03110f;
  border-bottom-right-radius: 4px;
}

.chat-bubble-ia {
  background: linear-gradient(135deg, rgba(6, 32, 34, 0.94), rgba(3, 18, 19, 0.88));
  border: 1px solid rgba(19, 188, 157, 0.22);
  color: #e5fffb;
  border-bottom-left-radius: 4px;
}

.triage-panel {
  margin: 0.35rem 0 1rem;
  padding: 0.85rem;
  border: 1px solid rgba(19, 188, 157, 0.24);
  border-radius: 14px;
  background: rgba(2, 16, 17, 0.72);
}

.triage-title {
  margin-bottom: 0.65rem;
  color: rgba(229, 255, 250, 0.78);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.triage-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.triage-option {
  justify-content: flex-start;
  border-color: rgba(19, 188, 157, 0.38);
  border-radius: 10px;
  color: #edfffb;
  background: rgba(19, 188, 157, 0.08);
}

.chat-input {
  flex: 0 0 auto;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(19, 188, 157, 0.14);
}

.chat-input :deep(.q-field__control) {
  background: rgba(5, 33, 34, 0.88);
}

.chat-input :deep(.q-field__native),
.chat-input :deep(.q-field__input) {
  color: #f0fffc !important;
  caret-color: #57d6be;
}

.chat-input :deep(.q-field__native::placeholder),
.chat-input :deep(.q-field__input::placeholder) {
  color: rgba(225, 255, 249, 0.56);
}

.chat-loading {
  color: rgba(225, 255, 249, 0.62);
}

.chat-close {
  color: #dffff8;
  background: rgba(19, 188, 157, 0.08);
}
.chat-reset { color: #9cebd6; border: 1px solid #387769; background: #174c3c55; margin-right: 8px; }
.chat-shell .chat-container > .row { flex-shrink: 0; }
.typing-dots { display: inline-flex; gap: 3px; margin-right: 6px; }
.typing-dots i { width: 4px; height: 4px; border-radius: 50%; background: #82d9be; animation: aito-typing 1.1s infinite alternate; }
.typing-dots i:nth-child(2) { animation-delay: .2s; }.typing-dots i:nth-child(3) { animation-delay: .4s; }
@keyframes aito-typing { to { opacity: .25; transform: translateY(-3px); } }
@media(prefers-reduced-motion: reduce) { .typing-dots i { animation: none; } .chat-bubble { animation: none; } }

@media (max-width: 460px) {
  .chat-shell {
    width: calc(100vw - 1rem);
    height: min(86vh, 42rem);
  }

  .chat-container {
    padding: 0.8rem;
  }

  .triage-options {
    grid-template-columns: 1fr;
  }
}

.cta-btn {
  background: linear-gradient(135deg, #22c55e, #20b4be);
  color: #f9fafb;
  font-weight: 600;
  border-radius: 999px;
  transition: all 0.3s ease;
}

.cta-btn:hover {
  filter: drop-shadow(0 8px 12px rgba(34, 197, 170, 0.5));
}
</style>
