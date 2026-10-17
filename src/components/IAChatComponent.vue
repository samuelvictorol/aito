<template>
  <div class="chat-shell bg-dark text-white">
    <div class="chat-container">

      <!-- Cabeçalho -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-subtitle1 text-bold row items-center">
          <q-btn round class="ia-fab cta-btn animate__animated animate__slower animate__fadeInUp q-mr-sm">
            <q-img src="/ia.gif" width="50px" alt="gif robo atendimento 24h com i.a" />
          </q-btn>
          <div>
            Assistente AITO <br />
            <span class="assistant-subtitle">Serviços · WhatsApp · IA</span>
          </div>
        </div>
        <div class="row items-center">
        <q-btn flat round dense icon="mdi-chat-plus-outline" aria-label="Começar nova conversa" :disable="loading" @click="resetChat" />
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
      <div class="chat-messages">
        <q-scroll-area ref="scrollAreaRef" class="chat-scroll">
          <div class="chat-message-list" role="log" aria-live="polite">
          <div v-for="(msg, index) in messages" :key="index" class="q-mb-lg flex"
            :class="msg.from === 'user' ? 'justify-end' : 'justify-start'">
            <div class="chat-bubble animate__animated animate__slower"
              :class="msg.from === 'user' ? 'chat-bubble-user animate__slideInRight' : 'chat-bubble-ia animate__slideInLeft'">
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
            Preparando sua resposta...
          </div>

          <div v-if="!loading && suggestions.length" class="triage-panel">
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
        </q-scroll-area>
      </div>

      <!-- Input + botão enviar -->
      <div class="chat-input row items-center q-gutter-sm">
        <q-input v-model="currentMessage" class="col" color="secondary" dark dense outlined
          placeholder="Conte o que você precisa..." :maxlength="MESSAGE_LIMIT" :disable="loading" aria-label="Mensagem para o assistente AITO" @keyup.enter="sendMessage()" />

        <q-btn class="cta-btn" icon="mdi-send" aria-label="Enviar mensagem" :loading="loading" :disable="!canSend" @click="sendMessage()" />
      </div>
      <div class="chat-commercial"><q-btn flat dense no-caps icon="mdi-account-outline" label="Falar com a equipe" :href="commercialUrl" target="_blank" rel="noopener noreferrer" /><span>Você escolhe quando avançar.</span></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { MESSAGE_LIMIT, initialMessage, initialSuggestions, sanitizeMessages, sanitizeReply, buildCommercialUrl, offlineReply } from 'src/utils/siteAssistant'

const emit = defineEmits(['close'])
const route = useRoute()
const STORAGE_KEY = 'aito_site_chat_messages_v3'
const messages = ref([initialMessage()])
const suggestions = ref([...initialSuggestions])
const currentMessage = ref('')
const loading = ref(false)
let requestController
let disposed = false
const scrollAreaRef = ref(null)
const scrollToBottom = () => {
  const sa = scrollAreaRef.value
  if (!sa) return
  const target = sa.getScrollTarget?.()
  if (!target) return
  sa.setScrollPosition('vertical', target.scrollHeight, 200)
}

const loadFromSession = () => {
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: sanitizeMessages(messages.value), suggestions: suggestions.value }))
  } catch { /* Storage can be full or unavailable. */ }
}

onMounted(async () => {
  loadFromSession()
  await nextTick()
  scrollToBottom()
})
onBeforeUnmount(() => {
  disposed = true
  requestController?.abort()
})
watch(
  () => [messages.value.length, loading.value],
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
  if (loading.value) return
  messages.value = [initialMessage()]
  suggestions.value = [...initialSuggestions]
  currentMessage.value = ''
}

const sendMessage = async (presetText = '') => {
  const text = (presetText || currentMessage.value).trim().slice(0, MESSAGE_LIMIT)
  if (!text || loading.value) return
  const history = sanitizeMessages(messages.value).slice(-24).map(({ from, text }) => ({ from, text }))
  currentMessage.value = ''
  messages.value.push({ from: 'user', text, link: null })
  loading.value = true
  requestController = new AbortController()
  try {
    const { data } = await api.post('/talk_site_bot', { last_message: text, history, page_path: route.path }, { timeout: 14000, signal: requestController.signal })
    if (disposed) return
    appendReply(sanitizeReply(data))
  } catch {
    if (disposed) return
    appendReply(offlineReply(text, history))
  } finally {
    loading.value = false
  }
}

function appendReply(reply) {
  reply.replies.forEach((text, index) => messages.value.push({ from: 'ia', text, link: index === reply.replies.length - 1 ? reply.link : null }))
  suggestions.value = reply.suggestions
  messages.value = sanitizeMessages(messages.value)
}
</script>


<style scoped>
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
  overflow: hidden;
}

.chat-scroll {
  height: 100%;
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
}

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
