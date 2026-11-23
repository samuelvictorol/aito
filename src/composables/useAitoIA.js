import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { api } from 'boot/axios'
import { AITOIA_CHAT_LIMIT, createAitoIALocalStore } from 'src/services/aitoiaLocal'
import { downloadAitoIAFile, exportAitoIAJson, exportAitoIAZip } from 'src/services/aitoiaArchive'
import { checkAttachment, checkoutLink, fileKind, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, readAnswer, requestMessages, videoAudioBase64 } from 'src/services/aitoiaChat'
import { artifactReferences, fileFromArtifact, fileFromImage, prepareArtifactReferences } from 'src/services/aitoiaArtifacts'
import { followGeneration } from 'src/services/aitoiaGenerationActivity'

const clientSession = { tokenKey: 'aito_user_token', userKey: 'aito_user', kind: 'client' }
const adminSession = { tokenKey: 'aito_admin_token', userKey: 'aito_admin_user', kind: 'admin' }
const DAY = 24 * 60 * 60 * 1000
const LOCAL_LIFETIME = 7 * DAY
const shortTitle = (text, attachments) => (text || attachments[0]?.name || 'Nova conversa').replace(/\s+/g, ' ').trim().slice(0, 65)
const moneyFormat = (currency, maximumFractionDigits = 2) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits })
const usDollar = moneyFormat('USD', 4)
const real = moneyFormat('BRL')
export const usd = cents => usDollar.format((Number(cents) || 0) / 100)
export const brl = cents => real.format((Number(cents) || 0) / 100)
const tokenCount = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
export const aitoTokens = value => tokenCount.format(Math.max(0, Number(value) || 0))
export function aitoTokenCost(usdCents, tokensPerUsd) {
  if (!Number.isFinite(usdCents) || usdCents < 0 || !Number.isFinite(tokensPerUsd) || tokensPerUsd <= 0) return ''
  return `≈ ${aitoTokens(usdCents * tokensPerUsd / 100)} AitoTokens`
}
const walletPreference = account => `aitoia:wallet:${account}`
function preferredWallet(status) {
  const wallets = status?.wallets || []
  let saved
  try { saved = localStorage.getItem(walletPreference(status.accountId)) } catch { /* Storage may be blocked. */ }
  if (wallets.some(wallet => wallet.id === saved)) return saved
  return status?.balanceUsdCents > 0 ? 'web' : wallets.find(wallet => wallet.productType === 'desktop' && wallet.balanceUsdCents > 0)?.id || 'web'
}
const paidOrders = new Set(['paid', 'approved', 'applied'])
const statusOf = error => error.response?.status
const errorMessage = (error, fallback) => error.response?.data?.message || fallback

export function useAitoIA({ chatHistory = true, allowAdmin = false, preferredModel = '' } = {}) {
  const session = shallowRef(null)
  const sessionLoading = ref(false)
  const status = ref(null)
  const walletId = ref('web')
  const models = ref([])
  const model = ref('')
  const effort = ref('medium')
  const speed = ref('default')
  const webSearch = ref(false)
  const modelLoading = ref(false)
  const settingsError = ref('')
  const walletError = ref('')
  const error = ref('')
  const contextShortened = ref(false)
  const draft = ref('')
  const attachments = shallowRef([])
  const chats = shallowRef([])
  const activeId = ref('')
  const request = shallowRef(null)
  const imageQuote = shallowRef(null)
  const pending = ref(null)
  const history = ref([])
  const historyLoading = ref(false)
  const historyTotal = ref(0)
  const historyOffset = ref(0)
  const historyLimit = ref(25)
  const walletLoading = ref(false)
  const checkoutBusy = ref(false)
  const paymentBusy = ref('')
  const paymentNotice = ref('')
  const accountId = ref('')
  const chatList = ref(null)
  const storageError = ref('')
  let sessionEpoch = 0
  let statusEpoch = 0
  let historyEpoch = 0
  let store
  let storeAccount = ''
  let expirationTimer
  let mounted = false
  let walletResolved = false

  const signedIn = computed(() => Boolean(session.value))
  const freshReelId = ref('')
  const adminMode = computed(() => session.value?.kind === 'admin')
  const active = computed(() => chats.value.find(chat => chat.id === activeId.value) || null)
  const chatLimitReached = computed(() => chats.value.length >= AITOIA_CHAT_LIMIT)
  const chatLimitMessage = 'Você já tem cinco conversas. Exclua uma para começar outra.'
  const currentModel = computed(() => models.value.find(item => item.id === model.value))
  const efforts = computed(() => currentModel.value?.efforts || [])
  const speeds = computed(() => currentModel.value?.speeds || [])
  const supportsWebSearch = computed(() => currentModel.value?.webSearch !== false)
  const loadingConversation = computed(() => request.value?.chatId === activeId.value)
  const hasInput = computed(() => Boolean(draft.value.trim() || attachments.value.length))

  function access() {
    const owner = session.value
    const current = () => Boolean(owner && session.value === owner && localStorage.getItem(owner.tokenKey) === owner.token)
    function endpoint(path) {
      if (!current()) throw new DOMException('Sua sessão mudou.', 'AbortError')
      if (!path.startsWith('/aitoia/')) throw new TypeError('Rota AitoIA inválida.')
      return owner.kind === 'admin' ? `/admin${path}` : path
    }
    const authorized = options => ({ ...options, headers: { ...options?.headers, Authorization: `Bearer ${owner.token}` } })
    return {
      current,
      get: async (path, options) => api.get(endpoint(path), authorized(options)),
      put: async (path, body, options) => api.put(endpoint(path), body, authorized(options)),
      delete: async (path, options) => api.delete(endpoint(path), authorized(options)),
      post: async (path, body, options) => {
        const target = endpoint(path)
        return followGeneration(accountId.value, path, options, current, () => api.post(target, body, authorized(options)))
      },
    }
  }
  const generationApi = {
    get: (path, options) => access().get(path, options),
    post: (path, body, options) => access().post(path, body, options),
  }

  function pruneLocal() {
    const now = Date.now()
    const remaining = chats.value.filter(chat => (chat.expiresAt || chat.createdAt + LOCAL_LIFETIME) > now)
    if (remaining.length !== chats.value.length) {
      chats.value = remaining
      if (!remaining.some(chat => chat.id === activeId.value)) activeId.value = remaining[0]?.id || ''
      store?.list().catch(() => {})
    }
  }

  async function openStore(id, epoch) {
    if (typeof id !== 'string' || !id || storeAccount === id) return
    store?.dispose?.()
    const target = createAitoIALocalStore(id, { maxRecords: AITOIA_CHAT_LIMIT, onExpire: () => { if (store === target) pruneLocal() } })
    store = target
    storeAccount = id
    try {
      const saved = await target.list()
      if (sessionEpoch !== epoch || store !== target) return
      chats.value = saved.sort((a, b) => b.updatedAt - a.updatedAt)
      if (!activeId.value) activeId.value = chats.value[0]?.id || ''
      scrollToEnd()
    } catch {
      if (store === target) storageError.value = 'Não foi possível abrir as conversas salvas. Este chat continuará nesta aba.'
    } finally {
      if (sessionEpoch === epoch && store === target) accountId.value = id
    }
  }

  function stop() {
    request.value?.controller.abort()
  }

  function resetSession() {
    freshReelId.value = ''
    sessionEpoch++
    statusEpoch++
    historyEpoch++
    stop()
    request.value = null
    imageQuote.value = null
    store?.dispose?.()
    store = null
    storeAccount = ''
    chats.value = []
    activeId.value = ''
    accountId.value = ''
    status.value = null
    walletId.value = adminMode.value ? 'platform' : 'web'
    walletResolved = false
    models.value = []
    model.value = ''
    history.value = []
    historyTotal.value = 0
    historyOffset.value = 0
    pending.value = null
    walletLoading.value = false
    historyLoading.value = false
    modelLoading.value = false
    checkoutBusy.value = false
    paymentBusy.value = ''
    settingsError.value = ''
    walletError.value = ''
    storageError.value = ''
    paymentNotice.value = ''
    contextShortened.value = false
    attachments.value = []
  }

  function forgetSession() {
    const owner = session.value
    if (owner && localStorage.getItem(owner.tokenKey) === owner.token) {
      localStorage.removeItem(owner.tokenKey)
      localStorage.removeItem(owner.userKey)
    }
    session.value = null
    resetSession()
    draft.value = ''
    sessionLoading.value = false
    error.value = 'Sua sessão terminou. Entre novamente para acessar o chat.'
    if (mounted) void refreshModels()
  }

  async function refreshStatus({ silent = false } = {}) {
    if (!signedIn.value) return
    const epoch = sessionEpoch
    const order = ++statusEpoch
    if (!silent) { walletLoading.value = true; walletError.value = '' }
    try {
      const { data } = await generationApi.get('/aitoia/status', { params: adminMode.value ? undefined : { walletId: walletId.value } })
      if (sessionEpoch !== epoch || statusEpoch !== order) return
      if (!adminMode.value && !walletResolved && data.data?.accountId) {
        walletResolved = true
        const preferred = preferredWallet(data.data)
        if (preferred !== walletId.value) {
          walletId.value = preferred
          return refreshStatus({ silent })
        }
      }
      status.value = data.data
      if (chatHistory) await openStore(data.data?.accountId, epoch)
      else accountId.value = data.data?.accountId || ''
    } catch (cause) {
      if (sessionEpoch !== epoch || statusEpoch !== order) return
      if (statusOf(cause) === 401 || (adminMode.value && statusOf(cause) === 403)) { forgetSession(); return }
      if (!adminMode.value && [403, 404].includes(statusOf(cause)) && walletId.value !== 'web') {
        walletId.value = 'web'
        return refreshStatus({ silent })
      }
      if (!silent) walletError.value = errorMessage(cause, 'Não foi possível consultar seu saldo.')
    } finally {
      if (sessionEpoch === epoch && statusEpoch === order) walletLoading.value = false
    }
  }

  async function refreshModels(refresh = false) {
    if (modelLoading.value) return
    const epoch = sessionEpoch
    modelLoading.value = true
    settingsError.value = ''
    try {
      const { data } = await (signedIn.value
        ? generationApi.get('/aitoia/models', { params: refresh ? { refresh: 1 } : undefined })
        : api.get('/aitoia/models/catalog'))
      if (sessionEpoch !== epoch) return
      const catalog = data?.data
      if (!Array.isArray(catalog?.models)) throw new TypeError('Catálogo de modelos inválido.')
      models.value = catalog.models
      if (!currentModel.value) {
        model.value = models.value.find(item => item.id === preferredModel)?.id ||
          models.value.find(item => item.id === catalog.defaultModel)?.id || models.value[0]?.id || ''
      }
    } catch (cause) {
      if (sessionEpoch !== epoch) return
      if (statusOf(cause) === 401) { forgetSession(); return }
      settingsError.value = errorMessage(cause, 'Não foi possível consultar os modelos.')
    } finally {
      if (sessionEpoch === epoch) modelLoading.value = false
    }
  }

  watch(currentModel, () => {
    if (!efforts.value.includes(effort.value)) effort.value = efforts.value.includes('medium') ? 'medium' : efforts.value[0] || ''
    if (!speeds.value.includes(speed.value)) speed.value = speeds.value[0] || 'default'
    if (!supportsWebSearch.value) webSearch.value = false
  })

  async function syncSession({ keepDraft = false } = {}) {
    const nextAdmin = allowAdmin && localStorage.getItem(adminSession.tokenKey)
    const type = nextAdmin ? adminSession : clientSession
    const next = nextAdmin || localStorage.getItem(clientSession.tokenKey)
    if ((!next && !session.value) || (next === session.value?.token && type.kind === session.value.kind)) return
    session.value = next ? { ...type, token: next } : null
    resetSession()
    if (!keepDraft) draft.value = ''
    error.value = ''
    if (!next) { sessionLoading.value = false; await refreshModels(); return }
    const epoch = sessionEpoch
    sessionLoading.value = true
    await Promise.allSettled([refreshStatus(), refreshModels()])
    if (sessionEpoch === epoch) sessionLoading.value = false
  }

  function accountChange(event) {
    if (event.type === 'storage' && event.key && event.key !== clientSession.tokenKey && (!allowAdmin || event.key !== adminSession.tokenKey)) return
    syncSession()
  }

  function onWalletUpdated() {
    if (signedIn.value) void refreshStatus({ silent: true })
  }

  function onVisible() {
    if (document.visibilityState !== 'visible') return
    pruneLocal()
    if (!signedIn.value) return
    refreshStatus({ silent: true })
    if (pending.value) checkPayment(pending.value, { silent: true })
  }

  function scrollToEnd() {
    nextTick(() => {
      if (mounted && chatList.value) chatList.value.scrollTop = chatList.value.scrollHeight
    })
  }

  function saveChat(chat) {
    if ((chat.expiresAt || chat.createdAt + LOCAL_LIFETIME) <= Date.now()) { pruneLocal(); return }
    chats.value = [chat, ...chats.value.filter(item => item.id !== chat.id)]
    return store?.save(chat).catch(() => {
      if (chats.value.includes(chat)) storageError.value = 'O navegador não salvou esta conversa. Você ainda pode baixar os dados desta aba.'
    })
  }

  function selectChat(chatId) {
    freshReelId.value = ''
    activeId.value = chatId
    imageQuote.value = null
    draft.value = ''
    attachments.value = []
    contextShortened.value = false
    error.value = ''
    scrollToEnd()
  }

  function renameChat(chat, title) {
    const current = chats.value.find(item => item.id === chat.id)
    if (current && title.trim()) saveChat({ ...current, title: title.trim().slice(0, 65) })
  }

  function updateReel(chatId, messageId, changes) {
    const chat = chats.value.find(item => item.id === chatId)
    if (!signedIn.value || !chat?.messages.some(item => item.id === messageId && item.reel)) return
    if (freshReelId.value === messageId) freshReelId.value = ''
    return saveChat({ ...chat, messages: chat.messages.map(item => item.id !== messageId ? item : {
      ...item, reel: { ...item.reel, ...changes },
      ...(changes.jobId && { text: 'Acompanhe sua conversão e baixe o vídeo aqui.' }),
      ...(changes.dismissed && { text: 'Prévia do Reel encerrada.' }),
    }) })
  }

  async function removeChat(chatId) {
    if (request.value?.chatId === chatId) stop()
    chats.value = chats.value.filter(chat => chat.id !== chatId)
    if (activeId.value === chatId) selectChat(chats.value[0]?.id || '')
    try { await store?.remove(chatId) } catch { storageError.value = 'Não foi possível remover a cópia salva pelo navegador.' }
  }

  async function exportChats(format, chat = null) {
    pruneLocal()
    const epoch = sessionEpoch
    const owner = access()
    try {
      const rows = chat ? chats.value.filter(item => item.id === chat.id) : chats.value
      if (!owner.current() || !rows.length) return
      const json = format === 'json'
      const file = json ? exportAitoIAJson(rows) : await exportAitoIAZip(rows)
      if (epoch !== sessionEpoch || !owner.current()) return
      downloadAitoIAFile(file, json ? 'aitoia-conversas.json' : 'aitoia-conversas.zip')
    } catch {
      if (epoch === sessionEpoch) storageError.value = 'Não foi possível baixar as conversas.'
    }
  }

  function addFiles(files) {
    error.value = ''
    const result = [...attachments.value]
    let total = result.reduce((sum, item) => sum + (fileKind(item) === 'video' ? 0 : item.blob.size), 0)
    let hasVideo = result.some(item => fileKind(item) === 'video')
    for (const file of files) {
      const invalid = checkAttachment(file)
      if (invalid) { error.value = invalid; continue }
      const video = fileKind(file) === 'video'
      if (video && hasVideo) { error.value = 'Anexe até um vídeo por mensagem.'; continue }
      if (result.length >= MAX_ATTACHMENTS || (!video && total + file.size > MAX_ATTACHMENT_BYTES)) {
        error.value = 'Cada mensagem aceita até 4 arquivos. Imagens e documentos podem somar até 4,5 MB.'
        break
      }
      if (video) hasVideo = true
      else total += file.size
      result.push({ id: crypto.randomUUID(), name: file.name || (video ? 'Vídeo anexado' : 'Imagem colada'), type: file.type, blob: file })
    }
    attachments.value = result
  }

  async function send() {
    if (!hasInput.value || !signedIn.value || request.value || !currentModel.value || !accountId.value) return
    pruneLocal()
    if (!active.value && chatLimitReached.value) { error.value = chatLimitMessage; return }
    const epoch = sessionEpoch
    const owner = access()
    const at = Date.now()
    const text = draft.value.trim()
    const files = attachments.value
    const chat = active.value || { id: crypto.randomUUID(), title: shortTitle(text, files), createdAt: at, expiresAt: at + LOCAL_LIFETIME, messages: [] }
    const message = { id: crypto.randomUUID(), role: 'user', text, attachments: files, createdAt: at }
    const messages = [...chat.messages, message]
    const controller = new AbortController()
    const id = crypto.randomUUID()
    const sentModel = model.value
    const sentLabel = currentModel.value.label
    const sendEffort = effort.value && (effort.value !== 'none' || efforts.value.length > 1)
    const parameters = { model: sentModel, service_tier: speed.value, walletId: walletId.value,
      ...(sendEffort && { reasoning: { effort: effort.value } }), ...(webSearch.value && supportsWebSearch.value && { webSearch: true }) }
    let imageMessage
    let audioCost = 0
    request.value = { chatId: chat.id, controller, id }
    error.value = ''
    contextShortened.value = false
    activeId.value = chat.id
    draft.value = ''
    attachments.value = []
    try {
      const next = { ...chat, updatedAt: at, messages }
      if (active.value) await saveChat(next)
      else {
        try { await store?.save(next) }
        catch (cause) {
          if (cause.code === 'AITOIA_RECORD_LIMIT') throw new Error(chatLimitMessage)
          storageError.value = 'O navegador não salvou esta conversa. Você ainda pode baixar os dados desta aba.'
        }
        if (controller.signal.aborted || sessionEpoch !== epoch) return
        chats.value = [next, ...chats.value.filter(item => item.id !== next.id)]
      }
      scrollToEnd()
      const { input, shortened } = await requestMessages(messages, { signal: controller.signal, transcribeVideo: async video => {
        try {
          const audio = await videoAudioBase64(video.blob, controller.signal)
          if (!owner.current()) return
          if (!audio) video.videoTranscript = ''
          else {
            const response = await owner.post('/aitoia/video-analysis/transcription', { audio, walletId: parameters.walletId },
              { headers: { 'X-Aito-Request-Id': crypto.randomUUID() }, signal: controller.signal, timeout: 135000 })
            if (!owner.current()) return
            video.videoTranscript = response.data.data.transcript
            audioCost = Number(response.data.data.billedUsdCents) || 0
          }
          const current = chats.value.find(item => item.id === chat.id)
          if (current) await saveChat(current)
          return video.videoTranscript
        } catch (cause) {
          if (controller.signal.aborted || statusOf(cause) === 401) throw cause
          return undefined
        }
      } })
      if (controller.signal.aborted || sessionEpoch !== epoch || !owner.current()) return
      contextShortened.value = shortened
      const body = { input, ...parameters, artifacts: true }
      if (new Blob([JSON.stringify(body)]).size > 8 * 1024 * 1024) throw new Error('A conversa ultrapassou o limite de envio. Inicie uma nova conversa com menos anexos.')
      const { data } = await owner.post('/aitoia/responses', body, { headers: { 'X-Aito-Request-Id': id }, signal: controller.signal })
      if (sessionEpoch !== epoch || !owner.current()) return
      const response = data?.data ?? data
      const artifact = response.artifact
      let answer = readAnswer(response)
      let attachment
      let imagePlan
      let reel
      if (artifact?.kind === 'instagram_reel') {
        reel = { url: artifact.url }
        answer = 'Confira o Reel antes de confirmar a conversão.'
      } else if (artifact?.kind === 'image') {
        imagePlan = { format: artifact.format, prompt: artifact.prompt, referenceIds: artifact.useReferences ? artifactReferences(messages).map(file => file.id) : [] }
        answer = 'A imagem está pronta para gerar. Confira o valor antes de continuar.'
      } else if (artifact?.kind === 'file') {
        try { attachment = await fileFromArtifact(artifact) }
        catch {
          attachment = await fileFromArtifact({ ...artifact, format: 'txt' })
          answer = 'O formato solicitado não pôde ser exportado. O conteúdo está disponível em texto.'
        }
        answer ||= 'Seu arquivo está pronto para baixar.'
      }
      if (controller.signal.aborted || sessionEpoch !== epoch || !owner.current()) return
      if (!answer) throw new Error('O modelo não retornou uma resposta de texto.')
      const current = chats.value.find(item => item.id === chat.id)
      const now = Date.now()
      if (current) {
        const reply = { id: crypto.randomUUID(), role: 'assistant', text: answer, model: sentLabel || sentModel, createdAt: now,
          ...(reel && { reel }),
          ...(imagePlan && { imagePlan }), ...(attachment && { attachments: [attachment], artifactContext: artifact.content.slice(0, 8000) }),
          billedUsdCents: Number.isFinite(data?.aito?.billedUsdCents) || audioCost ? (data?.aito?.billedUsdCents || 0) + audioCost : undefined }
        if (reel && activeId.value === chat.id) freshReelId.value = reply.id
        await saveChat({ ...current, updatedAt: now, messages: [...current.messages, reply] })
        if (imagePlan) imageMessage = reply
      }
    } catch (cause) {
      if (controller.signal.aborted || sessionEpoch !== epoch || !owner.current()) return
      if (statusOf(cause) === 401) { forgetSession(); return }
      if (activeId.value === chat.id) {
        error.value = errorMessage(cause, statusOf(cause) === 402 ? 'Saldo insuficiente para esta mensagem. Recarregue ou reduza a potência.' : cause.response ? 'Não foi possível obter uma resposta.' : cause.message || 'Não foi possível conectar.')
        if (!hasInput.value) {
          const current = chats.value.find(item => item.id === chat.id)
          if (current) {
            const remaining = current.messages.filter(item => item.id !== message.id)
            if (remaining.length) saveChat({ ...current, messages: remaining })
            else {
              chats.value = chats.value.filter(item => item.id !== chat.id)
              activeId.value = ''
              store?.remove(chat.id).catch(() => { storageError.value = 'Não foi possível remover o rascunho salvo.' })
            }
          }
          else activeId.value = ''
          draft.value = text
          attachments.value = files
        }
      }
    } finally {
      if (sessionEpoch === epoch && request.value?.id === id) {
        request.value = null
        if (activeId.value === chat.id) scrollToEnd()
        if (owner.current()) {
          refreshStatus({ silent: true })
          if (imageMessage && activeId.value === chat.id && !controller.signal.aborted) void processImage(imageMessage)
        }
      }
    }
  }

  async function processImage(message, confirmed = null) {
    const chat = active.value
    const plan = message?.imagePlan
    if (!chat || !plan || request.value || !signedIn.value || !chat.messages.some(item => item.id === message.id)) return
    const references = chat.messages.flatMap(item => item.attachments || []).filter(file => plan.referenceIds.includes(file.id))
    const controller = new AbortController()
    const id = crypto.randomUUID()
    const epoch = sessionEpoch
    const wallet = walletId.value
    const owner = access()
    const stillActive = () => !controller.signal.aborted && epoch === sessionEpoch && owner.current()
    const sameChat = () => stillActive() && activeId.value === chat.id
    request.value = { chatId: chat.id, controller, id, kind: confirmed ? 'image' : 'quote' }
    imageQuote.value = null
    error.value = ''
    try {
      const { format, prompt } = plan
      const options = { headers: { 'X-Aito-Request-Id': id }, signal: controller.signal }
      if (confirmed) {
        if (wallet !== confirmed.walletId) throw new Error('A carteira mudou. Confira o valor novamente.')
        const images = await prepareArtifactReferences(references)
        if (!stillActive()) return
        const { data } = await owner.post('/aitoia/images/generations', {
          walletId: wallet, format, prompt, references: images, maxBilledUsdCents: confirmed.maxBilledUsdCents,
        }, options)
        const file = fileFromImage(data.data?.image)
        const current = chats.value.find(item => item.id === chat.id)
        if (!stillActive() || !current) return
        await saveChat({ ...current, updatedAt: Date.now(), messages: current.messages.map(item => item.id !== message.id ? item : {
          ...item, imagePlan: null, text: 'Sua imagem está pronta.', attachments: [file],
          billedUsdCents: (item.billedUsdCents || 0) + (data.data.billedUsdCents || 0),
        }) })
      } else {
        const { data } = await owner.post('/aitoia/marketing/quote', { walletId: wallet, format, referenceCount: references.length }, options)
        if (!Number.isFinite(data.data?.maxBilledUsdCents)) throw new Error('Não foi possível calcular o valor da imagem.')
        if (sameChat()) imageQuote.value = { chatId: chat.id, messageId: message.id, walletId: wallet, maxBilledUsdCents: data.data.maxBilledUsdCents }
      }
    } catch (cause) {
      if (!stillActive()) return
      if (statusOf(cause) === 401) { forgetSession(); return }
      if (sameChat()) error.value = errorMessage(cause, cause.response ? 'Não foi possível gerar a imagem.' : cause.message)
    } finally {
      if (request.value?.id === id) {
        request.value = null
        if (sameChat()) scrollToEnd()
        if (confirmed && owner.current()) refreshStatus({ silent: true })
      }
    }
  }

  function confirmImage() {
    const quote = imageQuote.value
    if (!quote || quote.chatId !== activeId.value) return
    return processImage(active.value?.messages.find(item => item.id === quote.messageId), quote)
  }

  async function loadHistory(offset = 0) {
    if (!signedIn.value || adminMode.value) return
    const epoch = sessionEpoch
    const order = ++historyEpoch
    historyLoading.value = true
    try {
      const { data } = await generationApi.get('/aitoia/history', { params: { walletId: walletId.value, offset } })
      if (sessionEpoch !== epoch || historyEpoch !== order) return
      const rows = data.data || {}
      history.value = rows.rows || rows.history || rows.items || []
      historyOffset.value = offset
      historyLimit.value = rows.limit || 25
      historyTotal.value = rows.total ?? history.value.length
    } catch (cause) {
      if (sessionEpoch === epoch && historyEpoch === order) walletError.value = errorMessage(cause, 'Não foi possível consultar o histórico de recargas.')
    } finally {
      if (sessionEpoch === epoch && historyEpoch === order) historyLoading.value = false
    }
  }

  async function selectWallet(id) {
    if (adminMode.value || id === walletId.value) return
    walletId.value = id
    walletResolved = true
    if (accountId.value) {
      try { localStorage.setItem(walletPreference(accountId.value), id) } catch { /* Use this tab's selection. */ }
    }
    pending.value = null
    paymentNotice.value = ''
    history.value = []
    await refreshStatus()
    await loadHistory()
  }

  async function checkout(plan) {
    if (adminMode.value || checkoutBusy.value) return
    const epoch = sessionEpoch
    const id = walletId.value
    checkoutBusy.value = true
    walletError.value = ''
    paymentNotice.value = ''
    try {
      const { data } = await generationApi.post('/aitoia/checkout', { usdCents: plan.usdCents, walletId: id })
      if (sessionEpoch !== epoch || walletId.value !== id) return
      const order = data.data
      const url = checkoutLink(order?.url)
      if (!url || !order?.orderNsu || (order.usdCents != null && order.usdCents !== plan.usdCents)) {
        throw new Error('Checkout indisponível.')
      }
      pending.value = { ...order, url, walletId: id, usdCents: plan.usdCents,
        brlCents: Number.isSafeInteger(order.brlCents) && order.brlCents > 0 ? order.brlCents : plan.brlCents }
      loadHistory()
    } catch (cause) {
      if (sessionEpoch === epoch) walletError.value = errorMessage(cause, 'Não foi possível preparar o pagamento. Tente novamente.')
    } finally {
      if (sessionEpoch === epoch) checkoutBusy.value = false
    }
  }

  async function checkPayment(order, { silent = false } = {}) {
    if (adminMode.value || paymentBusy.value || !order?.orderNsu) return
    const epoch = sessionEpoch
    const id = walletId.value
    paymentBusy.value = order.orderNsu
    if (!silent) walletError.value = ''
    try {
      const { data } = await generationApi.post('/aitoia/confirm', { orderNsu: order.orderNsu, walletId: id })
      if (sessionEpoch !== epoch || walletId.value !== id) return
      const state = data.data?.status
      if (paidOrders.has(state)) {
        if (pending.value?.orderNsu === order.orderNsu) pending.value = null
        paymentNotice.value = 'Pagamento confirmado. O saldo foi atualizado.'
        await Promise.allSettled([refreshStatus(), loadHistory()])
      } else if (!silent) {
        paymentNotice.value = state === 'expired' ? 'O prazo deste checkout terminou.' : 'O pagamento ainda está pendente.'
        await loadHistory()
      }
    } catch (cause) {
      if (sessionEpoch === epoch && !silent) walletError.value = errorMessage(cause, 'Não foi possível verificar o pagamento.')
    } finally {
      if (sessionEpoch === epoch) paymentBusy.value = ''
    }
  }

  onMounted(() => {
    mounted = true
    void syncSession().then(() => { if (!signedIn.value && !models.value.length) void refreshModels() })
    window.addEventListener('aito:wallet-updated', onWalletUpdated)
    window.addEventListener('storage', accountChange)
    window.addEventListener('aito:session-expired', accountChange)
    window.addEventListener('aito:session-changed', accountChange)
    document.addEventListener('visibilitychange', onVisible)
    if (chatHistory) expirationTimer = window.setInterval(pruneLocal, 60000)
  })

  onBeforeUnmount(() => {
    mounted = false
    resetSession()
    clearInterval(expirationTimer)
    window.removeEventListener('aito:wallet-updated', onWalletUpdated)
    window.removeEventListener('storage', accountChange)
    window.removeEventListener('aito:session-expired', accountChange)
    window.removeEventListener('aito:session-changed', accountChange)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { accountId, signedIn, adminMode, access, generationApi, sessionLoading, status, walletId, models, model, currentModel, effort, efforts,
    speed, speeds, webSearch, supportsWebSearch, modelLoading, settingsError, walletError, error, contextShortened,
    draft, attachments, chats, activeId, active, chatLimitReached, chatLimitMessage, request, pending, history, historyLoading, historyTotal,
    historyOffset, historyLimit, walletLoading, checkoutBusy, paymentBusy, paymentNotice, chatList, storageError,
    loadingConversation, hasInput, imageQuote, quoteImage: processImage, confirmImage, syncSession, refreshStatus, refreshModels, selectChat, renameChat, removeChat,
    freshReelId, updateReel, exportChats, addFiles, send, stop, selectWallet, loadHistory, checkout, checkPayment }
}
