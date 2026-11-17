<script setup>
import AitoGenerationIndicator from 'components/AitoGenerationIndicator.vue'
import AitoAboutLink from 'components/AitoAboutLink.vue'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMeta, useQuasar } from 'quasar'
import AitoIAAttachment from 'components/AitoIAAttachment.vue'
import AitoIAResponse from 'components/AitoIAResponse.vue'
import AitoIAModeSwitch from 'components/AitoIAModeSwitch.vue'
import AitoIAThemeToggle from 'components/AitoIAThemeToggle.vue'
import { aitoTokenCost, aitoTokens, useAitoIA } from 'src/composables/useAitoIA'
import { useAitoAvailability } from 'src/composables/useAitoAvailability'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'
import { useAitoWorkGuard } from 'src/composables/useAitoWorkGuard'
import { chatVideoModels } from 'src/data/aitoiaVideoCatalog'
import { fileKind, MAX_PROMPT_LENGTH } from 'src/services/aitoiaChat'
import { requestsVideoGeneration, saveVideoDraft } from 'src/services/aitoiaVideoDraft'
import { checkImageReference, normalizeVideoReference } from 'src/services/aitoiaVideoRemote'
import { AITOIA_CHAT_LIMIT } from 'src/services/aitoiaLocal'
import 'src/css/aitoia-theme.css'

const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const AitoIAWallet = defineAsyncComponent(() => import('components/AitoIAWallet.vue'))
const AitoIAChatVideo = defineAsyncComponent(() => import('components/AitoIAChatVideo.vue'))
const AitoVoiceSamples = defineAsyncComponent(() => import('components/AitoVoiceSamples.vue'))
useMeta({
  title: 'AitoIA | Chat com AitoTokens',
  link: { canonical: { rel: 'canonical', href: 'https://aitosoftwares.com/' } },
  meta: { description: { name: 'description', content: 'Converse com os modelos OpenAI usando AitoTokens. Compare modelos e mantenha suas conversas no seu navegador.' } },
})
const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { isDark } = useAitoIATheme()
const state = useAitoIA({ allowAdmin: true })
const { videoInMaintenance } = useAitoAvailability()
const { signedIn, adminMode, sessionLoading, accountId, status, model, models, currentModel, effort, efforts, speed, speeds, webSearch,
  modelLoading, settingsError, walletError, error, contextShortened, draft, attachments, chats,
  activeId, active, chatLimitReached, chatLimitMessage, request, chatList, storageError, loadingConversation, hasInput, walletLoading, imageQuote } = state
const composer = ref(null)
const fileInput = ref(null)
const authOpen = ref(false)
const authMode = ref('register')
const walletOpen = ref(false)
const settingsOpen = ref(false)
const sidebarOpen = ref(false)
const dialog = ref(null)
const renamed = ref('')
const dragDepth = ref(0)
const copiedId = ref('')
const stopped = ref(false)
const videoOpen = ref(false)
const videoBusy = ref(false)
const videoFile = shallowRef(null)
const videoImages = shallowRef([])
const videoCatalog = shallowRef(null)
const switchingVideo = ref(false)
let videoSwitch
const isVideoRequest = computed(() => requestsVideoGeneration(draft.value))
const attachedVideo = computed(() => attachments.value.find(file => fileKind(file) === 'video'))
const busy = computed(() => Boolean(request.value || videoBusy.value))
const tokenCost = cents => aitoTokenCost(cents, status.value?.aitoTokensPerUsd)
useAitoWorkGuard(busy, () => $q.notify({ type: 'warning', message: 'Aguarde a operação em andamento para sair desta tela.' }))
const effortLabels = { none: 'Direta', minimal: 'Mínima', low: 'Baixa', medium: 'Equilibrada', high: 'Alta', xhigh: 'Muito alta', max: 'Ultra' }
const effortIndex = computed({ get: () => Math.max(0, efforts.value.indexOf(effort.value)), set: value => { effort.value = efforts.value[Number(value)] || effort.value } })
const promptIdeas = [
  { icon: 'mdi-code-braces', title: 'Revisar código', text: 'Revise este código e sugira melhorias de legibilidade, desempenho e testes. Explique suas decisões.' },
  { icon: 'mdi-file-document-outline', title: 'Analisar um documento', text: 'Analise o documento que vou anexar. Resuma os pontos principais e liste as decisões ou ações que merecem atenção.' },
  { icon: 'mdi-file-video-outline', title: 'Analisar um vídeo', text: 'Analise o vídeo que vou anexar. Resuma as principais cenas com seus horários e relacione as falas ao que acontece na tela.' },
  { icon: 'mdi-image-plus-outline', title: 'Criar uma imagem', text: 'Gere uma imagem quadrada de ' },
  { icon: 'mdi-file-pdf-box', title: 'Criar um PDF', text: 'Crie um PDF para baixar sobre ' },
]

function showAuth(mode = 'register') {
  authMode.value = mode
  authOpen.value = true
}
function focusComposer() { nextTick(() => composer.value?.focus()) }
function chooseChat(id) { videoSwitch?.abort(); stopped.value = false; state.selectChat(id); sidebarOpen.value = false; focusComposer() }
function newChat() { if (!signedIn.value) showAuth(); else if (!chatLimitReached.value) chooseChat('') }
function showWallet() {
  if (!signedIn.value) { showAuth(); return }
  walletOpen.value = true
  state.refreshStatus()
  state.loadHistory()
}
function showSettings() {
  settingsOpen.value = true
  if (!models.value.length) state.refreshModels()
}
function requestSend() {
  if (!signedIn.value) { showAuth(); return }
  if (busy.value || switchingVideo.value) return
  if (isVideoRequest.value) { void switchToVideo(); return }
  if (!active.value && chatLimitReached.value) { error.value = chatLimitMessage; return }
  if (status.value?.balanceUsdCents <= 0) { showWallet(); return }
  if (!status.value || !status.value.configured) return
  stopped.value = false
  state.send()
}
function selectVideoReference(file) {
  if (!file) return null
  try { return normalizeVideoReference(new File([file.blob], file.name, { type: file.type || file.blob.type })) }
  catch { return null }
}

async function switchToVideo() {
  if (videoInMaintenance.value) { error.value = 'A geração de vídeos com IA está em manutenção. Seu pedido ficou no chat.'; return }
  const owner = accountId.value
  const access = state.access()
  if (!owner || !access.current()) return
  const controller = new AbortController()
  videoSwitch = controller
  switchingVideo.value = true
  error.value = ''
  const prompt = draft.value.trim()
  const attachment = attachedVideo.value
  const video = selectVideoReference(attachment)
  const images = attachments.value.flatMap(item => {
    const file = new File([item.blob], item.name, { type: item.type || item.blob.type })
    try { checkImageReference(file); return [file] } catch { return [] }
  })
  try {
    const response = await access.get('/aitoia/video/options', { signal: controller.signal, timeout: 8000 }).catch(() => null)
    if (controller.signal.aborted || !access.current()) return
    const catalog = response?.data?.data
    if ((!attachment || video) && chatVideoModels(catalog, { hasVideo: Boolean(video), imageCount: images.length }).length) {
      videoFile.value = video
      videoImages.value = images
      videoCatalog.value = catalog
      videoOpen.value = true
      return
    }
    const files = [...images, ...(video ? [video] : [])].map(file => ({ id: crypto.randomUUID(), name: file.name, mime: file.type, blob: file }))
    await saveVideoDraft(owner, { prompt, attachments: files })
    if (controller.signal.aborted || !access.current()) return
    await router.push({ name: 'aito-ia-video-studio', query: { tab: 'ai', draft: 'chat' } })
  } catch {
    if (!controller.signal.aborted) error.value = 'Não foi possível levar o pedido ao Estúdio. Seu rascunho ficou no chat.'
  } finally {
    if (videoSwitch === controller) { videoSwitch = null; switchingVideo.value = false }
  }
}
function stopWaiting() { stopped.value = true; state.stop() }
function onKey(event) {
  if (event.key !== 'Enter' || !event.ctrlKey || event.isComposing) return
  event.preventDefault()
  requestSend()
}
function addFiles(files) {
  if (!files.length) return
  if (!signedIn.value) { showAuth(); return }
  if (busy.value || switchingVideo.value) return
  state.addFiles(files)
}
function pickFiles(event) {
  addFiles(Array.from(event.target.files || []))
  event.target.value = ''
}
function pasteFiles(event) {
  const files = Array.from(event.clipboardData?.files || [])
  if (!files.length) return
  event.preventDefault()
  addFiles(files)
}
function hasDraggedFiles(event) { return Array.from(event.dataTransfer?.types || []).includes('Files') }
function enterDrop(event) { if (hasDraggedFiles(event)) { event.preventDefault(); dragDepth.value++ } }
function leaveDrop() { dragDepth.value = Math.max(0, dragDepth.value - 1) }
function overDrop(event) { if (hasDraggedFiles(event)) event.preventDefault() }
function drop(event) { dragDepth.value = 0; if (event.dataTransfer?.files.length) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)) } }
function selectIdea(idea) { draft.value = idea.text; focusComposer() }
function askRename(chat) { renamed.value = chat.title; dialog.value = { type: 'rename', chat } }
function completeDialog() {
  if (dialog.value?.type === 'rename') state.renameChat(dialog.value.chat, renamed.value)
  else if (dialog.value?.chat) state.removeChat(dialog.value.chat.id)
  dialog.value = null
}
async function copyMessage(message) {
  try { await navigator.clipboard.writeText(message.text); copiedId.value = message.id } catch { error.value = 'O navegador não permitiu copiar a resposta.' }
}

onMounted(() => {
  watch([() => route.query.auth, sessionLoading, signedIn], ([auth, loading, authenticated]) => {
    if ((auth === 'register' || auth === 'login') && !loading && !authenticated) showAuth(auth)
  }, { immediate: true })
})
onBeforeUnmount(() => videoSwitch?.abort())
</script>

<template>
  <div class="aito-ai-theme aito-studio" :class="{ 'aito-studio--sidebar': sidebarOpen, 'aito-studio--light': !isDark }">
    <button v-if="sidebarOpen" type="button" class="aito-studio__scrim" aria-label="Fechar conversas" @click="sidebarOpen = false" />
    <aside class="aito-studio__sidebar" aria-label="Conversas">
      <div class="aito-studio__brand-row">
        <router-link to="/" class="aito-studio__brand" aria-label="Chat AitoIA"><img src="/ia.gif" width="42" height="42" alt="" /><span>Aito<span>IA</span></span></router-link>
        <button type="button" class="aito-studio__icon aito-studio__sidebar-close" aria-label="Fechar conversas" @click="sidebarOpen = false"><q-icon name="mdi-close" size="21px" /></button>
      </div>
      <button type="button" class="aito-studio__new" :disabled="chatLimitReached" @click="newChat"><q-icon name="mdi-plus" size="20px" /> Nova conversa</button>
      <div v-if="chatLimitReached" class="aito-studio__empty-list" role="status">{{ chatLimitMessage }}</div>
      <div class="aito-studio__sidebar-label">
        <span>Conversas<span v-if="signedIn"> · {{ chats.length }}/{{ AITOIA_CHAT_LIMIT }}</span></span>
        <button v-if="chats.length" type="button" class="aito-studio__icon" aria-label="Exportar conversas"><q-icon name="mdi-tray-arrow-down" size="18px" />
          <q-menu :dark="isDark" class="aito-ai-theme aito-studio__menu" anchor="bottom right" self="top right"><q-list dense style="min-width: 190px">
            <q-item v-close-popup clickable @click="state.exportChats('zip')"><q-item-section>Baixar tudo em ZIP</q-item-section></q-item>
            <q-item v-close-popup clickable @click="state.exportChats('json')"><q-item-section>Baixar JSON</q-item-section></q-item>
          </q-list></q-menu>
        </button>
      </div>
      <div class="aito-studio__chats">
        <div v-for="chat in chats" :key="chat.id" class="aito-studio__chat" :class="{ 'is-active': chat.id === activeId }">
          <button type="button" class="aito-studio__chat-name" :title="chat.title" :aria-current="chat.id === activeId ? 'true' : undefined" @click="chooseChat(chat.id)"><q-icon name="mdi-message-outline" size="17px" /><span>{{ chat.title }}</span></button>
          <button type="button" class="aito-studio__icon" :aria-label="'Opções de ' + chat.title"><q-icon name="mdi-dots-horizontal" size="18px" />
            <q-menu :dark="isDark" class="aito-ai-theme aito-studio__menu" anchor="bottom right" self="top right"><q-list dense style="min-width: 177px">
              <q-item v-close-popup clickable @click="askRename(chat)"><q-item-section>Renomear</q-item-section></q-item>
              <q-item v-close-popup clickable @click="state.exportChats('zip', chat)"><q-item-section>Baixar ZIP</q-item-section></q-item>
              <q-item v-close-popup clickable @click="state.exportChats('json', chat)"><q-item-section>Baixar JSON</q-item-section></q-item>
              <q-item v-close-popup clickable @click="dialog = { type: 'remove', chat }"><q-item-section class="aito-studio__delete">Excluir</q-item-section></q-item>
            </q-list></q-menu>
          </button>
        </div>
        <div v-if="!chats.length" class="aito-studio__empty-list">{{ sessionLoading ? 'Carregando conversas…' : 'Nenhuma conversa salva' }}</div>
      </div>
      <div class="aito-studio__sidebar-foot">
        <AitoIAThemeToggle class="aito-studio__theme-toggle" />
        <router-link v-if="signedIn" :to="adminMode ? '/admin' : '/app'"><q-icon :name="adminMode ? 'mdi-shield-account-outline' : 'mdi-account-circle-outline'" size="19px" /> {{ adminMode ? 'Aito Admin' : 'Minha conta' }} <q-icon class="aito-studio__out" name="mdi-arrow-top-right" size="15px" /></router-link>
        <button v-else type="button" @click="showAuth('login')"><q-icon name="mdi-login" size="19px" /> Entrar</button>
        <q-icon name="mdi-lock-outline" size="16px" /><span>Histórico neste dispositivo por até 7 dias.</span>
        <AitoAboutLink />
      </div>
    </aside>

    <main class="aito-studio__main" @dragenter="enterDrop" @dragleave="leaveDrop" @dragover="overDrop" @drop="drop">
      <header class="aito-studio__header">
        <div class="aito-studio__top-model">
          <button type="button" class="aito-studio__icon aito-studio__mobile-toggle" aria-label="Abrir conversas" :aria-expanded="sidebarOpen" @click="sidebarOpen = true"><q-icon name="mdi-menu" size="23px" /></button>
          <button type="button" class="aito-studio__top-model-button" aria-label="Configurar modelo" @click="showSettings"><q-icon name="mdi-auto-fix" size="18px" /><span>{{ currentModel?.label || (modelLoading ? 'Carregando modelos…' : 'Modelos OpenAI') }}</span><q-icon name="mdi-chevron-down" size="18px" /></button>
        </div>
        <AitoIAModeSwitch :busy="busy" />
        <div class="aito-studio__header-actions">
        <AitoGenerationIndicator :state="state" />
        <button v-if="signedIn" type="button" class="aito-studio__balance" :title="adminMode ? 'Saldo da plataforma' : 'Minha carteira AitoTokens'" :disabled="busy" @click="showWallet"><img src="/aitotokens.svg" alt="" width="25" height="25" /><span>{{ status ? `≈ ${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }}</span><q-icon :name="adminMode ? 'mdi-shield-account-outline' : 'mdi-plus'" size="17px" /></button>
          <button v-else type="button" class="aito-studio__signup" @click="showAuth()">Criar conta <q-icon name="mdi-arrow-top-right" size="17px" /></button>
        </div>
      </header>

      <div v-if="dragDepth" class="aito-studio__drop" aria-hidden="true"><q-icon name="mdi-tray-arrow-up" size="45px" /> Solte os arquivos para anexar</div>

      <div v-if="active" ref="chatList" class="aito-studio__messages" aria-label="Mensagens da conversa">
        <div class="aito-studio__message-list">
          <p class="aito-studio__conversation-title">{{ active.title }}</p>
          <article v-for="message in active.messages" :key="message.id" class="aito-studio__message" :class="'aito-studio__message--' + message.role">
            <div v-if="message.role === 'assistant'" class="aito-studio__speaker"><img src="/ia.gif" alt="" width="27" height="27" /><strong>AitoIA</strong><small>{{ message.model }}<template v-if="tokenCost(message.billedUsdCents)"> · {{ tokenCost(message.billedUsdCents) }}</template></small></div>
            <div v-if="message.attachments?.length" class="aito-studio__attachments"><AitoIAAttachment v-for="file in message.attachments" :key="file.id" :attachment="file" :preview="message.role === 'assistant'" /></div>
            <p v-if="message.role === 'user' && message.text" class="aito-studio__user-text">{{ message.text }}</p>
            <AitoIAResponse v-else-if="message.text" :text="message.text" />
            <button v-if="message.imagePlan" type="button" class="aito-studio__tool" :disabled="busy" @click="state.quoteImage(message)"><q-icon name="mdi-image-plus-outline" size="19px" /> Gerar imagem</button>
            <button v-if="message.role === 'assistant' && message.text" type="button" class="aito-studio__icon aito-studio__copy" :aria-label="copiedId === message.id ? 'Resposta copiada' : 'Copiar resposta'" @click="copyMessage(message)"><q-icon :name="copiedId === message.id ? 'mdi-check' : 'mdi-content-copy'" size="17px" /></button>
          </article>
          <div v-if="loadingConversation" class="aito-studio__thinking" role="status"><q-spinner-dots size="25px" /> {{ request?.kind === 'image' ? 'Gerando imagem…' : request?.kind === 'quote' ? 'Consultando valor…' : 'Preparando resposta…' }}</div>
        </div>
      </div>

      <section v-else class="aito-studio__welcome" aria-labelledby="aito-ia-title">
        <div class="aito-studio__orb"><img src="/ia.gif" alt="" width="88" height="88" /></div>
        <h1 id="aito-ia-title">No que vamos trabalhar?</h1>
        <p>Converse, crie imagens e prepare arquivos para baixar.</p>
        <p v-if="!signedIn && !sessionLoading"><button type="button" class="aito-studio__tool" @click="showAuth()"><q-icon name="mdi-gift-outline" /> Ganhe 25.000 AitoTokens com Google e mais 25.000 ao voltar por 3 dias seguidos</button></p>
        <div class="aito-studio__ideas">
          <button v-for="idea in promptIdeas" :key="idea.title" type="button" @click="selectIdea(idea)"><q-icon :name="idea.icon" size="19px" /> {{ idea.title }}<q-icon name="mdi-arrow-top-right" size="13px" /></button>
        </div>
      </section>

      <div class="aito-studio__bottom">
        <div v-if="error || storageError || settingsError || (walletError && !walletOpen)" class="aito-studio__notice aito-studio__notice--error" role="alert">
          <q-icon name="mdi-alert-circle-outline" size="19px" />
          <span>{{ error || storageError || settingsError || walletError }}</span>
          <button v-if="signedIn && status?.balanceUsdCents <= 0" type="button" @click="showWallet">{{ adminMode ? 'Ver saldo da plataforma' : 'Recarregar' }}</button>
          <button v-else type="button" aria-label="Fechar aviso" @click="error = ''; storageError = ''; settingsError = ''; walletError = ''"><q-icon name="mdi-close" size="17px" /></button>
        </div>
        <div v-else-if="contextShortened" class="aito-studio__notice" role="status"><q-icon name="mdi-information-outline" size="17px" /><span>Parte do histórico ficou fora desta solicitação para respeitar o limite de contexto.</span></div>
        <div v-else-if="stopped" class="aito-studio__notice" role="status"><q-icon name="mdi-information-outline" size="17px" /><span>A espera foi interrompida. A solicitação já enviada ainda pode consumir créditos.</span><button type="button" aria-label="Fechar aviso" @click="stopped = false"><q-icon name="mdi-close" size="17px" /></button></div>
        <div v-if="signedIn && status?.configured === false && !videoOpen" class="aito-studio__notice" role="status"><q-icon name="mdi-information-outline" size="17px" /><span>O chat aguarda a configuração da OpenAI.</span><button type="button" @click="state.refreshStatus(); state.refreshModels(true)">Atualizar</button></div>
        <AitoIAChatVideo v-if="videoOpen" :state="state" :initial-prompt="draft" :initial-video="videoFile" :initial-images="videoImages" :initial-catalog="videoCatalog" @busy="videoBusy = $event" @close="videoOpen = false; videoFile = null; videoCatalog = null; focusComposer()" @login="showAuth('login')" @wallet="showWallet" />
        <form v-else class="aito-studio__composer" @submit.prevent="requestSend">
          <div v-if="attachments.length" class="aito-studio__attachments"><AitoIAAttachment v-for="file in attachments" :key="file.id" :attachment="file" removable @remove="attachments = attachments.filter(item => item.id !== file.id)" /></div>
          <div v-if="attachedVideo && !isVideoRequest" class="aito-studio__privacy">Análise de até cinco quadros com horários e transcrição das falas, quando disponível. A transcrição também usa AitoTokens.</div>
          <textarea ref="composer" v-model="draft" rows="2" :maxlength="MAX_PROMPT_LENGTH" :readonly="switchingVideo" aria-label="Mensagem" placeholder="Escreva uma mensagem ou solte um arquivo…" @keydown="onKey" @paste="pasteFiles" />
          <div class="aito-studio__tools">
            <input ref="fileInput" type="file" multiple hidden @change="pickFiles" />
            <button type="button" class="aito-studio__icon" aria-label="Anexar arquivos" @click="signedIn ? fileInput?.click() : showAuth()"><q-icon name="mdi-paperclip" size="22px" /></button>
            <button type="button" class="aito-studio__tool" :aria-pressed="webSearch" @click="signedIn ? webSearch = !webSearch : showAuth()"><q-icon name="mdi-web" size="17px" /><span>Buscar na web</span></button>
            <span class="aito-studio__spacer" />
            <button type="button" class="aito-studio__tool aito-studio__effort" aria-label="Configurar potência" @click="showSettings"><q-icon name="mdi-lightning-bolt-outline" size="17px" /><span>{{ effortLabels[effort] || 'Potência' }}</span></button>
            <button v-if="request" type="button" class="aito-studio__send" aria-label="Parar de aguardar resposta" title="A solicitação já enviada ainda pode consumir créditos." @click="stopWaiting"><q-icon name="mdi-stop" size="24px" /></button>
            <button v-else type="submit" class="aito-studio__send" :aria-label="signedIn ? 'Enviar mensagem' : 'Entrar para conversar'" :disabled="signedIn && (switchingVideo || !hasInput || sessionLoading || !accountId || (!isVideoRequest && (!currentModel || !status?.configured)))" title="Ctrl + Enter"><q-spinner v-if="switchingVideo" size="23px" /><q-icon v-else name="mdi-arrow-up" size="25px" /></button>
          </div>
        </form>
      </div>
    </main>

    <AuthDialog v-if="authOpen" v-model="authOpen" :initial-mode="authMode" return-path="/aitoia" :show-project-login="false" @authenticated="state.syncSession({ keepDraft: true })" />
    <AitoIAWallet v-if="walletOpen" v-model="walletOpen" :state="state" />

    <q-dialog :model-value="Boolean(imageQuote)" @update:model-value="value => { if (!value) imageQuote = null }">
      <q-card v-if="imageQuote" :dark="isDark" class="aito-ai-theme aito-studio__dialog">
        <div class="aito-studio__dialog-head"><q-icon name="mdi-image-plus-outline" size="22px" /><h2>Gerar imagem</h2></div>
        <div class="aito-studio__settings">
          <p v-if="tokenCost(imageQuote.maxBilledUsdCents)">Limite de débito de <strong>{{ tokenCost(imageQuote.maxBilledUsdCents) }}</strong>.</p>
          <div class="aito-studio__select-row"><q-btn v-close-popup flat no-caps label="Voltar" /><q-btn unelevated no-caps color="teal-8" label="Confirmar geração" @click="state.confirmImage()" /></div>
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="settingsOpen">
      <q-card :dark="isDark" class="aito-ai-theme aito-studio__dialog">
        <div class="aito-studio__dialog-head"><q-icon name="mdi-tune-variant" size="22px" /><h2>Modelo e potência</h2><button v-close-popup type="button" class="aito-studio__icon" aria-label="Fechar configurações"><q-icon name="mdi-close" size="21px" /></button></div>
        <div class="aito-studio__settings">
          <div class="aito-studio__select-row">
            <label>Modelo<select v-model="model" :disabled="!models.length || modelLoading"><option v-if="!models.length" value="">{{ modelLoading ? 'Carregando…' : 'Nenhum modelo disponível' }}</option><option v-for="option in models" :key="option.id" :value="option.id">{{ option.label }}</option></select></label>
            <button type="button" class="aito-studio__icon" aria-label="Atualizar modelos" :disabled="modelLoading" @click="state.refreshModels(true)"><q-icon name="mdi-refresh" size="23px" /></button>
          </div>
          <div v-if="efforts.length" class="aito-studio__reasoning"><div><label for="aito-studio-effort">Potência</label><strong>{{ effortLabels[effort] || effort }}</strong></div><input id="aito-studio-effort" v-model.number="effortIndex" :aria-valuetext="effortLabels[effort] || effort" type="range" min="0" :max="Math.max(1, efforts.length - 1)" :disabled="efforts.length === 1" /></div>
          <label v-if="speeds.length">Velocidade<select v-model="speed"><option v-for="option in speeds" :key="option" :value="option">{{ option === 'priority' ? 'Rápida' : 'Padrão' }}</option></select></label>
          <p v-if="settingsError" role="alert" class="aito-studio__setting-error">{{ settingsError }}</p>
          <p v-if="!signedIn" class="aito-studio__privacy">Explore os modelos e as vozes. Entre com sua conta para gerar conteúdo.</p>
          <AitoVoiceSamples />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog :model-value="Boolean(dialog)" @update:model-value="value => { if (!value) dialog = null }">
      <q-card :dark="isDark" class="aito-ai-theme aito-studio__dialog">
        <form v-if="dialog" @submit.prevent="completeDialog">
          <div class="aito-studio__dialog-head"><h2>{{ dialog.type === 'rename' ? 'Renomear conversa' : 'Excluir conversa' }}</h2><button v-close-popup type="button" class="aito-studio__icon" aria-label="Cancelar"><q-icon name="mdi-close" size="21px" /></button></div>
          <div class="aito-studio__settings">
            <label v-if="dialog.type === 'rename'">Nome da conversa<input v-model="renamed" maxlength="65" required autofocus /></label>
            <p v-else>Excluir “{{ dialog.chat.title }}” e seus anexos deste navegador?</p>
            <button class="aito-studio__signup" type="submit" :disabled="dialog.type === 'rename' && !renamed.trim()">{{ dialog.type === 'rename' ? 'Salvar nome' : 'Excluir' }}</button>
          </div>
        </form>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.aito-studio { display: grid; grid-template-columns: 262px minmax(0, 1fr); width: 100%; height: 100vh; height: 100dvh; overflow: hidden; color: var(--aito-ai-text); background: var(--aito-ai-bg); font-family: var(--aito-ai-font); }
.aito-studio button, .aito-studio select, .aito-studio textarea, .aito-studio input { font: inherit; }
.aito-ai-theme :is(button, a, select, input):focus-visible { outline: 2px solid var(--aito-ai-purple); outline-offset: 3px; }
.aito-studio__sidebar { display: flex; flex-direction: column; min-height: 0; gap: 15px; padding: 16px 14px; border-right: 1px solid var(--aito-ai-line); background: var(--aito-ai-surface); }
.aito-studio__brand-row { display: flex; align-items: center; justify-content: space-between; }
.aito-studio__brand { display: flex; align-items: center; gap: 4px; color: var(--aito-ai-text); text-decoration: none; font-size: 1.24rem; font-weight: 750; letter-spacing: -.045em; }
.aito-studio__brand span span { color: var(--aito-ai-accent); }
.aito-studio__new { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-text); background: var(--aito-ai-panel); text-align: left; cursor: pointer; font-weight: 650 !important; font-size: .85rem !important; }
.aito-studio__new:hover, .aito-studio__chat:hover, .aito-studio__chat.is-active { border-color: var(--aito-ai-line); background: var(--aito-ai-raised); }
.aito-studio__new .q-icon { color: var(--aito-ai-accent); }
.aito-studio__sidebar-label { display: flex; justify-content: space-between; align-items: center; min-height: 30px; padding-left: 8px; color: var(--aito-ai-muted); font-size: .76rem; font-weight: 650; }
.aito-studio__chats { flex: 1; min-height: 0; overflow: auto; }
.aito-studio__chat { display: flex; min-width: 0; align-items: center; padding: 0 2px 0 0; border: 1px solid transparent; border-radius: 8px; }
.aito-studio__chat-name { display: flex; flex: 1; align-items: center; min-width: 0; gap: 9px; padding: 10px 6px 10px 8px; color: var(--aito-ai-text); border: 0; background: transparent; text-align: left; cursor: pointer; font-size: .79rem !important; }
.aito-studio__chat-name span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.aito-studio__chat-name .q-icon { flex: 0 0 auto; color: var(--aito-ai-accent); }
.aito-studio__empty-list { padding: .2rem .5rem; color: var(--aito-ai-muted); font-size: .77rem; }
.aito-studio__sidebar-foot { display: grid; grid-template-columns: 17px 1fr; gap: 12px 7px; align-items: center; padding: 12px 3px 3px; border-top: 1px solid var(--aito-ai-line); color: var(--aito-ai-muted); font-size: .72rem; }
.aito-studio__theme-toggle { grid-column: 1 / -1; }
.aito-studio__sidebar-foot > a, .aito-studio__sidebar-foot > button { grid-column: span 2; display: flex; align-items: center; gap: 9px; border: 0; padding: 4px 2px; color: var(--aito-ai-text); background: transparent; text-decoration: none; text-align: left; cursor: pointer; font-size: .81rem; }
.aito-studio__sidebar-foot > a:hover, .aito-studio__sidebar-foot > button:hover { color: var(--aito-ai-accent); }
.aito-studio__out { margin-left: auto; color: var(--aito-ai-muted); }
.aito-studio__main { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--aito-ai-glow), var(--aito-ai-bg); }
.aito-studio__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 63px; padding: 10px 23px; border-bottom: 1px solid var(--aito-ai-line); background: var(--aito-ai-surface); }
.aito-studio__header-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.aito-studio__top-model { display: flex; align-items: center; gap: 6px; min-width: 0; }
.aito-studio__top-model-button { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 7px 9px; border: 0; border-radius: 7px; color: var(--aito-ai-text); background: transparent; cursor: pointer; font-size: .84rem !important; font-weight: 650 !important; }
.aito-studio__top-model-button span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.aito-studio__top-model-button .q-icon:first-child { color: var(--aito-ai-purple); }
.aito-studio__icon { display: inline-grid; flex: 0 0 auto; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 8px; color: var(--aito-ai-muted); background: transparent; cursor: pointer; }
.aito-studio__icon:hover, .aito-studio__top-model-button:hover { color: var(--aito-ai-text); background: #ffffff0d; }
.aito-studio__icon:disabled { opacity: .55; cursor: wait; }
.aito-studio__balance, .aito-studio__signup { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 39px; padding: 5px 10px; border: 1px solid var(--aito-ai-gold-line); border-radius: 9px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); cursor: pointer; white-space: nowrap; font-size: .8rem !important; font-weight: 720 !important; }
.aito-studio__signup { padding: 7px 12px; border-color: var(--aito-ai-accent); color: var(--aito-ai-ink); background: var(--aito-ai-gradient); }
.aito-studio__signup:hover { filter: brightness(1.08); }
.aito-studio__welcome { display: flex; flex: 1; min-height: 0; flex-direction: column; align-items: center; justify-content: center; padding: 16px 20px; overflow: auto; text-align: center; }
.aito-studio__orb { display: grid; place-items: center; width: 86px; height: 86px; margin-bottom: 20px; border: 1px solid var(--aito-ai-line); border-radius: 26px; background: radial-gradient(circle at 68% 0%, var(--aito-ai-accent-soft), var(--aito-ai-panel) 75%); box-shadow: 0 0 48px #13bc9d26, inset 0 1px 1px #ffffff24; }
.aito-studio__orb img { width: 80px; height: 80px; filter: drop-shadow(0 4px 9px #111416b0); }
.aito-studio__welcome h1 { margin: 0; color: var(--aito-ai-text); font-size: clamp(1.85rem, 4vw, 3rem); font-weight: 730; line-height: 1.15; letter-spacing: -.065em; }
.aito-studio__welcome p { max-width: 28rem; margin: 9px 0 0; color: var(--aito-ai-muted); font-size: clamp(.85rem, 2vw, 1rem); }
.aito-studio__ideas { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 22px; }
.aito-studio__ideas button { display: flex; align-items: center; gap: 7px; padding: 9px 10px; border: 1px solid var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-text); background: var(--aito-ai-panel); cursor: pointer; font-size: .78rem; }
.aito-studio__ideas button:hover { background: var(--aito-ai-raised); border-color: var(--aito-ai-accent-strong); }
.aito-studio__ideas button .q-icon { color: var(--aito-ai-purple); }
.aito-studio__ideas button .q-icon:last-child { opacity: .65; }
.aito-studio__messages { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.aito-studio__message-list { display: flex; flex-direction: column; gap: 20px; width: min(760px, 100%); margin: 0 auto; padding: 19px 24px 28px; }
.aito-studio__conversation-title { margin: 0; color: var(--aito-ai-muted); font-size: .75rem; overflow-wrap: anywhere; }
.aito-studio__message { min-width: 0; max-width: 100%; }
.aito-studio__message--user { align-self: flex-end; max-width: min(100%, 590px); min-width: min(9rem, 100%); padding: .7rem .9rem; border: 1px solid var(--aito-ai-line); border-radius: 14px 14px 4px 14px; color: var(--aito-ai-text); background: var(--aito-ai-accent-soft); }
.aito-studio__user-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .93rem; line-height: 1.56; }
.aito-studio__speaker { display: flex; align-items: center; gap: 6px; min-height: 34px; margin-bottom: 6px; color: var(--aito-ai-text); font-size: .85rem; }
.aito-studio__speaker small { padding-left: 4px; color: var(--aito-ai-muted); font-size: .72rem; overflow-wrap: anywhere; }
.aito-studio__copy { margin-top: 4px; }
.aito-studio__thinking { display: flex; align-items: center; gap: .6rem; color: var(--aito-ai-purple); font-size: .84rem; }
.aito-studio__bottom { width: min(808px, 100%); margin: 0 auto; padding: 0 24px max(6px, env(safe-area-inset-bottom)); }
.aito-studio__composer { padding: 9px 10px 8px; border: 1px solid var(--aito-ai-line); border-radius: 15px; background: var(--aito-ai-panel); box-shadow: 0 13px 36px #09060d53; }
.aito-studio__composer:focus-within { border-color: var(--aito-ai-accent); }
.aito-studio__composer textarea { display: block; width: 100%; min-height: 56px; max-height: 168px; resize: vertical; padding: 6px 6px 0; border: 0; outline: 0; color: var(--aito-ai-text); background: transparent; font-size: .95rem; }
.aito-studio__composer textarea::placeholder { color: var(--aito-ai-muted); }
.aito-studio__attachments { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.aito-studio__tools { display: flex; align-items: center; gap: 4px; }
.aito-studio__tool { display: flex; align-items: center; gap: 4px; min-height: 33px; padding: 4px 6px; border: 1px solid transparent; border-radius: 7px; color: var(--aito-ai-muted); background: transparent; cursor: pointer; white-space: nowrap; font-size: .74rem !important; }
.aito-studio__tool:hover, .aito-studio__tool[aria-pressed=true] { border-color: var(--aito-ai-purple-line); color: var(--aito-ai-purple); background: var(--aito-ai-purple-soft); }
.aito-studio__effort { color: var(--aito-ai-purple); }
.aito-studio__spacer { flex: 1; }
.aito-studio__send { display: grid; flex: 0 0 auto; place-items: center; width: 39px; height: 39px; padding: 0; border: 0; border-radius: 10px; color: var(--aito-ai-ink); background: var(--aito-ai-gradient); cursor: pointer; }
.aito-studio__send:hover { filter: brightness(1.1); }
.aito-studio__send:disabled { opacity: .4; cursor: default; }
.aito-studio__privacy { display: flex; min-height: 29px; align-items: center; justify-content: center; gap: 4px; color: var(--aito-ai-muted); font-size: .68rem; text-align: center; }
.aito-studio__notice { display: flex; align-items: center; gap: .5rem; margin-bottom: 7px; padding: 7px 9px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-accent-soft); font-size: .78rem; }
.aito-studio__notice span { flex: 1; }
.aito-studio__notice button { border: 0; color: var(--aito-ai-accent); background: none; cursor: pointer; text-decoration: underline; }
.aito-studio__notice--error { border-color: var(--aito-ai-error-line); color: var(--aito-ai-error); background: var(--aito-ai-error-soft); }
.aito-studio__drop { z-index: 4; position: absolute; inset: 70px 12px 10px; display: grid; align-content: center; justify-items: center; gap: 12px; border: 2px dashed var(--aito-ai-accent); border-radius: 19px; color: var(--aito-ai-accent); background: var(--aito-ai-overlay); font-weight: 700; pointer-events: none; }
.aito-studio__dialog { width: min(460px, calc(100vw - 2rem)); padding: 1rem; border: 1px solid var(--aito-ai-line); border-radius: 15px; color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.aito-studio__menu { border: 1px solid var(--aito-ai-line); color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.aito-studio__delete { color: var(--aito-ai-error); }
.aito-studio__dialog-head { display: flex; align-items: center; gap: .45rem; }
.aito-studio__dialog-head > .q-icon { color: var(--aito-ai-purple); }
.aito-studio__dialog-head h2 { flex: 1; margin: 0; font-size: 1.12rem; font-weight: 750; line-height: 1.25; }
.aito-studio__settings { display: grid; gap: 13px; padding: 12px 0 2px; }
.aito-studio__settings label { display: grid; flex: 1; gap: 5px; min-width: 0; color: var(--aito-ai-muted); font-size: .79rem; }
.aito-studio__settings select, .aito-studio__settings label input:not([type=range]) { width: 100%; min-height: 39px; padding: 5px 8px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-raised); }
.aito-studio__select-row { display: flex; gap: 6px; align-items: end; }
.aito-studio__reasoning { padding: 10px; border: 1px solid var(--aito-ai-purple-line); border-radius: 9px; background: var(--aito-ai-purple-soft); }
.aito-studio__reasoning div { display: flex; align-items: center; gap: 6px; }
.aito-studio__reasoning strong { color: var(--aito-ai-purple); font-size: .82rem; }
.aito-studio__reasoning input { width: 100%; height: 19px; margin: 6px 0 0; accent-color: var(--aito-ai-purple); cursor: pointer; }
.aito-studio__setting-error { margin: 0; color: var(--aito-ai-error); font-size: .78rem; line-height: 1.45; }
.aito-studio--light .aito-studio__header { background: var(--aito-ai-header); }
.aito-studio--light .aito-studio__composer { box-shadow: 0 13px 36px var(--aito-ai-shadow); }
.aito-studio--light .aito-studio__orb { box-shadow: 0 12px 33px #4ec5a92d, inset 0 1px 1px #fff; }
.aito-studio--light .aito-studio__orb img { filter: drop-shadow(0 4px 9px #164f4133); }
.aito-studio--light .aito-studio__icon:hover, .aito-studio--light .aito-studio__top-model-button:hover { background: var(--aito-ai-raised); }
.aito-studio--light :is(.aito-studio__signup, .aito-studio__send) { color: var(--aito-ai-on-accent); }
.aito-studio__mobile-toggle, .aito-studio__sidebar-close, .aito-studio__scrim { display: none; }
@media (max-width: 740px) {
  .aito-studio { grid-template-columns: minmax(0, 1fr); }
  .aito-studio__mobile-toggle, .aito-studio__sidebar-close { display: inline-grid; }
  .aito-studio__sidebar { z-index: 7; position: fixed; top: 0; bottom: 0; left: 0; width: min(84vw, 280px); transform: translateX(-100%); visibility: hidden; }
  .aito-studio--sidebar .aito-studio__sidebar { transform: translateX(0); visibility: visible; }
  .aito-studio__scrim { z-index: 6; position: fixed; inset: 0; display: block; border: 0; background: var(--aito-ai-overlay); }
  .aito-studio__header { display: grid; grid-template-columns: minmax(0, 1fr) auto; padding: 6px 11px 7px 7px; min-height: 53px; }
  .aito-studio__header-actions { gap: 5px; }
  .aito-studio__header :deep(.aito-mode) { grid-row: 2; grid-column: 1 / -1; justify-self: center; }
  .aito-studio__bottom, .aito-studio__message-list { padding-right: 11px; padding-left: 11px; }
  .aito-studio__welcome { padding: 12px 8px; }
  .aito-studio__orb { width: 62px; height: 62px; border-radius: 18px; margin-bottom: 14px; }
  .aito-studio__orb img { width: 60px; height: 60px; }
  .aito-studio__ideas { gap: 5px; margin-top: 14px; }
  .aito-studio__ideas button { gap: 4px; padding: 6px; font-size: .71rem; }
  .aito-studio__ideas button .q-icon:last-child { display: none; }
  .aito-studio__privacy { font-size: .62rem; }
}
@media (max-width: 359px) { .aito-studio__effort span { display: none; } .aito-studio__top-model-button .q-icon:first-child { display: none; } }
@media (max-height: 580px) { .aito-studio__welcome { justify-content: start; } .aito-studio__orb { display: none; } .aito-studio__welcome h1 { margin-top: 8px; font-size: 1.6rem; } }
</style>
