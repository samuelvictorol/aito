import { collaboratorSocketToken, clearCollaboratorSocketTokens } from '../../services/socket-session.js'
import { communicationPayload } from '../../services/communication-urls.js'
import { io } from 'socket.io-client'
import { inPrototype, prototypeSocket } from '../../services/prototype-runtime.js'
import { prototypeRequest } from '../../services/prototype-api.js'
import axios from 'axios'
import { ref } from 'vue'
import { apiPermission, canAction } from '../../services/access.js'
import { API_BASE_URL, errorMessage, http } from '../../services/http.js'
import { getAccessToken, getStoredUser } from '../../services/tokens.js'
import { AUTH_EXPIRED_EVENT, AUTH_REFRESHED_EVENT, refreshAccessToken } from '../../services/auth-refresh.js'

export const API_PREFIX = `${API_BASE_URL.replace(/\/$/, '')}/whatsapp-web`
export const currentUser = ref(null)
let collaboratorSession = false
const collaboratorHttp = axios.create({ baseURL: API_PREFIX, timeout: 120000, withCredentials: true })
collaboratorHttp.interceptors.response.use(response => { response.data=communicationPayload(response.data); return response })
collaboratorHttp.interceptors.request.use(config => {
  if(inPrototype()){config.withCredentials=false;delete config.headers?.Authorization;config.headers?.delete?.('Authorization');config.adapter=async request=>prototypeRequest(request);return config}
  const permission=apiPermission(config),actor=currentUser.value||getStoredUser()
  if(permission&&!canAction(actor,permission.area,permission.action)){
    const error=new Error('Seu acesso permite somente visualização ou não autoriza esta funcionalidade.')
    error.response={status:403,data:{error:error.message}};return Promise.reject(error)
  }
  return config
})
const transport = () => collaboratorSession ? collaboratorHttp : http
export const api = {
  get: (url, options) => transport().get(url, { ...options, baseURL: API_PREFIX, timeout: 120000 }),
  post: (url, data, options) => transport().post(url, data, { ...options, baseURL: API_PREFIX, timeout: 120000 }),
  put: (url, data, options) => transport().put(url, data, { ...options, baseURL: API_PREFIX, timeout: 120000 }),
  patch: (url, data, options) => transport().patch(url, data, { ...options, baseURL: API_PREFIX, timeout: 120000 }),
  delete: (url, options) => transport().delete(url, { ...options, baseURL: API_PREFIX, timeout: 120000 }),
}

const usesCollaboratorCookie = () => collaboratorSession || (currentUser.value || getStoredUser())?.role === 'collaborator'

const liveSocket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
  path: '/comunicacao/whatsapp-web/socket.io',
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  auth: (callback) => {
    if (!usesCollaboratorCookie()) { callback({ token: getAccessToken() }); return }
    const user = currentUser.value || getStoredUser()
    collaboratorSocketToken(collaboratorSession ? 'web' : 'core', user?.id || user?._id || user?.email || '').then(token => callback({ token })).catch(() => callback({}))
  },
})
export const socket = new Proxy(liveSocket,{get(target,key){const source=inPrototype()?prototypeSocket:target;const value=source[key];return typeof value==='function'?value.bind(source):value},set(target,key,value){if(!inPrototype())target[key]=value;return true}})

let refreshPending = null
let retryTimer = null
let listenersActive = false
function clearSocketRetry() { clearTimeout(retryTimer); retryTimer = null }
function retrySocket() {
  if (!listenersActive || !currentUser.value || retryTimer) return
  retryTimer = setTimeout(() => { retryTimer = null; if (listenersActive && currentUser.value) socket.connect() }, 5000)
}
const refreshSocket = () => {
  if (usesCollaboratorCookie()) { clearCollaboratorSocketTokens(); retrySocket(); return }
  if (!listenersActive || !currentUser.value || collaboratorSession || !getAccessToken() || refreshPending) return
  refreshPending = refreshAccessToken()
    .then(() => { if (listenersActive && currentUser.value) { socket.disconnect(); socket.connect() } })
    .catch((error) => {
      if ([401, 403].includes(Number(error?.response?.status))) { currentUser.value = null; clearSocketRetry(); socket.disconnect() }
      else retrySocket()
    })
    .finally(() => { refreshPending = null })
}

socket.on('connect_error', (error) => {
  clearCollaboratorSocketTokens()
  if (/^AUTH_(REQUIRED|EXPIRED)$/.test(error?.data?.code || '') || /unauthori[sz]ed|token|jwt|n[aã]o autorizado|sess[aã]o expirada/i.test(error?.message || '')) refreshSocket()
  else retrySocket()
})
socket.on('connect', clearSocketRetry)
socket.on('disconnect', (reason) => { if (reason === 'io server disconnect') { if (usesCollaboratorCookie()) retrySocket(); else refreshSocket() } })
socket.on('session:revoked', () => { currentUser.value = null; clearSocketRetry(); socket.disconnect() })

export function startSessionListeners({ collaboratorOnly = false } = {}) {
  if(inPrototype())return
  collaboratorSession = collaboratorOnly
  listenersActive = true
  window.addEventListener(AUTH_REFRESHED_EVENT, onHostTokenChanged)
  window.addEventListener(AUTH_EXPIRED_EVENT, onHostSessionExpired)
}

export function stopSessionListeners() {
  clearCollaboratorSocketTokens()
  listenersActive = false
  clearSocketRetry()
  window.removeEventListener(AUTH_REFRESHED_EVENT, onHostTokenChanged)
  window.removeEventListener(AUTH_EXPIRED_EVENT, onHostSessionExpired)
  liveSocket.disconnect()
  currentUser.value = null
}

function onHostTokenChanged() {
  if (usesCollaboratorCookie()) return
  socket.disconnect()
  if (currentUser.value) socket.connect()
}

function onHostSessionExpired() {
  if (collaboratorSession) return
  currentUser.value = null
  clearSocketRetry()
  socket.disconnect()
}

export function messageOf(error, fallback = 'Não foi possível concluir a ação.') {
  return errorMessage(error, fallback)
}

export function idOf(value) { return String(value?._id || value?.id || '') }

export function formatDate(value, withDate = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', withDate
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
