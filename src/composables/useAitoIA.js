import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { api } from 'boot/axios'
import { createAitoIALocalStore, downloadAitoIAJson, downloadAitoIAZip } from 'src/services/aitoiaLocal'
import { checkAttachment, checkoutLink, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, readAnswer, requestMessages } from 'src/services/aitoiaChat'

const sessionKey = 'aito_user_token'
const DAY = 24 * 60 * 60 * 1000
const LOCAL_LIFETIME = 7 * DAY
const shortTitle = (text, attachments) => (text || attachments[0]?.name || 'Nova conversa').replace(/\s+/g, ' ').trim().slice(0, 65)
const moneyFormat = (currency, maximumFractionDigits = 2) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits })
const usDollar = moneyFormat('USD', 4)
const real = moneyFormat('BRL')
export const usd = cents => usDollar.format((Number(cents) || 0) / 100)
export const brl = cents => real.format((Number(cents) || 0) / 100)
const paidOrders = new Set(['paid', 'approved', 'applied'])
const statusOf = error => error.response?.status
const errorMessage = (error, fallback) => error.response?.data?.message || fallback

export function useAitoIA() {
  const token = ref('')
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

  const signedIn = computed(() => Boolean(token.value))
  const active = computed(() => chats.value.find(chat => chat.id === activeId.value) || null)
  const currentModel = computed(() => models.value.find(item => item.id === model.value))
  const efforts = computed(() => currentModel.value?.efforts || [])
  const speeds = computed(() => currentModel.value?.speeds || [])
  const loadingConversation = computed(() => request.value?.chatId === activeId.value)
  const hasInput = computed(() => Boolean(draft.value.trim() || attachments.value.length))
  const effectivePrice = computed(() => speed.value === 'priority' ? currentModel.value?.priority : currentModel.value?.standard)

  function config(extra = {}) {
    return { headers: { Authorization: 'Bearer ' + token.value, ...extra } }
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
    const target = createAitoIALocalStore(id, { onExpire: () => { if (store === target) pruneLocal() } })
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
    sessionEpoch++
    statusEpoch++
    historyEpoch++
    stop()
    request.value = null
    store?.dispose?.()
    store = null
    storeAccount = ''
    chats.value = []
    activeId.value = ''
    accountId.value = ''
    status.value = null
    walletId.value = 'web'
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
    if (localStorage.getItem(sessionKey) === token.value) {
      localStorage.removeItem(sessionKey)
      localStorage.removeItem('aito_user')
    }
    resetSession()
    token.value = ''
    draft.value = ''
    sessionLoading.value = false
    error.value = 'Sua sessão terminou. Entre novamente para acessar o chat.'
  }

  async function refreshStatus({ silent = false } = {}) {
    if (!signedIn.value) return
    const epoch = sessionEpoch
    const order = ++statusEpoch
    if (!silent) { walletLoading.value = true; walletError.value = '' }
    try {
      const { data } = await api.get('/aitoia/status', { ...config(), params: { walletId: walletId.value } })
      if (sessionEpoch !== epoch || statusEpoch !== order) return
      status.value = data.data
      await openStore(data.data?.accountId, epoch)
    } catch (cause) {
      if (sessionEpoch !== epoch || statusEpoch !== order) return
      if (statusOf(cause) === 401) { forgetSession(); return }
      if (statusOf(cause) === 403 && walletId.value !== 'web') {
        walletId.value = 'web'
        return refreshStatus({ silent })
      }
      if (!silent) walletError.value = errorMessage(cause, 'Não foi possível consultar seu saldo.')
    } finally {
      if (sessionEpoch === epoch && statusEpoch === order) walletLoading.value = false
    }
  }

  async function refreshModels(refresh = false) {
    if (!signedIn.value || modelLoading.value) return
    const epoch = sessionEpoch
    modelLoading.value = true
    settingsError.value = ''
    try {
      const { data } = await api.get('/aitoia/models', { ...config(), params: refresh ? { refresh: 1 } : undefined })
      if (sessionEpoch !== epoch) return
      models.value = data.data?.models || []
      if (!currentModel.value) model.value = data.data?.defaultModel || models.value[0]?.id || ''
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
  })

  async function syncSession({ keepDraft = false } = {}) {
    const next = localStorage.getItem(sessionKey) || ''
    if (next === token.value) return
    resetSession()
    token.value = next
    if (!keepDraft) draft.value = ''
    error.value = ''
    if (!next) { sessionLoading.value = false; return }
    const epoch = sessionEpoch
    sessionLoading.value = true
    await Promise.allSettled([refreshStatus(), refreshModels()])
    if (sessionEpoch === epoch) sessionLoading.value = false
  }

  function accountChange(event) {
    if (event.type === 'storage' && event.key && event.key !== sessionKey) return
    syncSession()
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
    store?.save(chat).catch(() => {
      if (chats.value.includes(chat)) storageError.value = 'O navegador não salvou esta conversa. Você ainda pode baixar os dados desta aba.'
    })
  }

  function selectChat(chatId) {
    activeId.value = chatId
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

  async function removeChat(chatId) {
    if (request.value?.chatId === chatId) stop()
    chats.value = chats.value.filter(chat => chat.id !== chatId)
    if (activeId.value === chatId) selectChat(chats.value[0]?.id || '')
    try { await store?.remove(chatId) } catch { storageError.value = 'Não foi possível remover a cópia salva pelo navegador.' }
  }

  async function exportChats(format, chat = null) {
    pruneLocal()
    try {
      const rows = chat ? chats.value.filter(item => item.id === chat.id) : chats.value
      if (!rows.length) return
      await (format === 'json' ? downloadAitoIAJson(rows) : downloadAitoIAZip(rows))
    } catch { storageError.value = 'Não foi possível baixar as conversas.' }
  }

  function addFiles(files) {
    error.value = ''
    const result = [...attachments.value]
    let total = result.reduce((sum, item) => sum + item.blob.size, 0)
    for (const file of files) {
      const invalid = checkAttachment(file)
      if (invalid) { error.value = invalid; continue }
      if (result.length >= MAX_ATTACHMENTS || total + file.size > MAX_ATTACHMENT_BYTES) {
        error.value = 'Cada mensagem aceita até 4 arquivos e 4,5 MB no total.'
        break
      }
      total += file.size
      result.push({ id: crypto.randomUUID(), name: file.name || 'Imagem colada', type: file.type, blob: file })
    }
    attachments.value = result
  }

  async function send() {
    if (!hasInput.value || !signedIn.value || request.value || !currentModel.value || !accountId.value) return
    pruneLocal()
    const epoch = sessionEpoch
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
    const parameters = { model: sentModel, service_tier: speed.value, walletId: walletId.value,
      ...(effort.value && { reasoning: { effort: effort.value } }), ...(webSearch.value && { webSearch: true }) }
    request.value = { chatId: chat.id, controller, id }
    error.value = ''
    contextShortened.value = false
    activeId.value = chat.id
    draft.value = ''
    attachments.value = []
    saveChat({ ...chat, updatedAt: at, messages })
    scrollToEnd()
    try {
      const { input, shortened } = await requestMessages(messages)
      if (controller.signal.aborted || sessionEpoch !== epoch) return
      contextShortened.value = shortened
      const body = { input, ...parameters }
      if (new Blob([JSON.stringify(body)]).size > 8 * 1024 * 1024) throw new Error('A conversa ultrapassou o limite de envio. Inicie uma nova conversa com menos anexos.')
      const { data } = await api.post('/aitoia/responses', body, { ...config({ 'X-Aito-Request-Id': id }), signal: controller.signal })
      if (sessionEpoch !== epoch) return
      const answer = readAnswer(data?.data ?? data)
      if (!answer) throw new Error('O modelo não retornou uma resposta de texto.')
      const current = chats.value.find(item => item.id === chat.id)
      const now = Date.now()
      if (current) saveChat({ ...current, updatedAt: now, messages: [...current.messages,
        { id: crypto.randomUUID(), role: 'assistant', text: answer, model: sentLabel || sentModel, createdAt: now,
          billedUsdCents: Number.isFinite(data?.aito?.billedUsdCents) ? data.aito.billedUsdCents : undefined }] })
    } catch (cause) {
      if (controller.signal.aborted || sessionEpoch !== epoch) return
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
          draft.value = text
          attachments.value = files
        }
      }
    } finally {
      if (sessionEpoch === epoch && request.value?.id === id) {
        request.value = null
        if (activeId.value === chat.id) scrollToEnd()
        refreshStatus({ silent: true })
      }
    }
  }

  async function loadHistory(offset = 0) {
    if (!signedIn.value) return
    const epoch = sessionEpoch
    const order = ++historyEpoch
    historyLoading.value = true
    try {
      const { data } = await api.get('/aitoia/history', { ...config(), params: { walletId: walletId.value, offset } })
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
    if (id === walletId.value) return
    walletId.value = id
    pending.value = null
    paymentNotice.value = ''
    history.value = []
    await Promise.allSettled([refreshStatus(), loadHistory()])
  }

  async function checkout(plan) {
    if (checkoutBusy.value) return
    const epoch = sessionEpoch
    const id = walletId.value
    checkoutBusy.value = true
    walletError.value = ''
    paymentNotice.value = ''
    try {
      const { data } = await api.post('/aitoia/checkout', { usdCents: plan.usdCents, walletId: id }, config())
      if (sessionEpoch !== epoch || walletId.value !== id) return
      const url = checkoutLink(data.data?.url)
      if (!url || !data.data?.orderNsu) throw new Error('Checkout indisponível.')
      pending.value = { ...data.data, url, walletId: id, usdCents: plan.usdCents, brlCents: plan.brlCents }
      loadHistory()
    } catch (cause) {
      if (sessionEpoch === epoch) walletError.value = errorMessage(cause, 'Não foi possível preparar o pagamento. Tente novamente.')
    } finally {
      if (sessionEpoch === epoch) checkoutBusy.value = false
    }
  }

  async function checkPayment(order, { silent = false } = {}) {
    if (paymentBusy.value || !order?.orderNsu) return
    const epoch = sessionEpoch
    const id = walletId.value
    paymentBusy.value = order.orderNsu
    if (!silent) walletError.value = ''
    try {
      const { data } = await api.post('/aitoia/confirm', { orderNsu: order.orderNsu, walletId: id }, config())
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
    syncSession()
    window.addEventListener('storage', accountChange)
    window.addEventListener('aito:session-expired', accountChange)
    document.addEventListener('visibilitychange', onVisible)
    expirationTimer = window.setInterval(pruneLocal, 60000)
  })

  onBeforeUnmount(() => {
    mounted = false
    resetSession()
    clearInterval(expirationTimer)
    window.removeEventListener('storage', accountChange)
    window.removeEventListener('aito:session-expired', accountChange)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { accountId, signedIn, sessionLoading, status, walletId, models, model, currentModel, effort, efforts,
    speed, speeds, webSearch, effectivePrice, modelLoading, settingsError, walletError, error, contextShortened,
    draft, attachments, chats, activeId, active, request, pending, history, historyLoading, historyTotal,
    historyOffset, historyLimit, walletLoading, checkoutBusy, paymentBusy, paymentNotice, chatList, storageError,
    loadingConversation, hasInput, syncSession, refreshStatus, refreshModels, selectChat, renameChat, removeChat,
    exportChats, addFiles, send, stop, selectWallet, loadHistory, checkout, checkPayment }
}
