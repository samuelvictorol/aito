import { collaboratorSocketToken, clearCollaboratorSocketTokens } from './socket-session.js'
import { io } from 'socket.io-client'
import { inPrototype, prototypeSocket } from './prototype-runtime.js'
import axios from 'axios'
import { getAccessToken, getStoredUser } from './tokens.js'
import {
  AUTH_REFRESHED_EVENT,
  API_BASE_URL,
  expireSession,
  refreshAccessToken,
} from './auth-refresh.js'

let socket
let refreshAfterDisconnect = null
let authEventListenerInstalled = false
let retryTimer = null

function socketAuthentication(callback) {
  const token = getAccessToken()
  if (token) { callback({ token }); return }
  const user = getStoredUser()
  if (user?.role !== 'collaborator') { callback({}); return }
  collaboratorSocketToken('core', user.id || user._id || user.email || '').then(value => callback({ token: value })).catch(() => callback({}))
}

function socketOrigin() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  return window.location.origin
}

export function shouldRefreshAfterSocketDisconnect(reason) {
  return reason === 'io server disconnect'
}

export function isSocketAuthenticationError(error) {
  return /n[aã]o autorizado|unauthori[sz]ed|jwt|token/i.test(String(error?.message || error || ''))
}

function reconnectWithToken(token) {
  if (inPrototype()) return
  if (!socket || !token) return
  socket.auth = { token }
  if (socket.connected) socket.disconnect()
  if (!socket.connected) socket.connect()
}

function onAuthRefreshed(event) {
  reconnectWithToken(event?.detail?.token || getAccessToken())
}

function installAuthEventListener() {
  if (authEventListenerInstalled || typeof window === 'undefined') return
  window.addEventListener(AUTH_REFRESHED_EVENT, onAuthRefreshed)
  authEventListenerInstalled = true
}

function refreshSocketAuthentication() {
  clearCollaboratorSocketTokens()
  if (inPrototype()) return Promise.resolve(false)
  if (refreshAfterDisconnect) return refreshAfterDisconnect
  const recovery = getStoredUser()?.role === 'collaborator'
    ? axios.get(`${API_BASE_URL}/collaborator/session`, { withCredentials: true }).then(() => { if(socket){socket.auth=socketAuthentication;socket.disconnect();socket.connect()} })
    : refreshAccessToken()
  refreshAfterDisconnect = recovery
    .catch((error) => {
      if ([401,403].includes(error.response?.status)) { socket?.disconnect(); expireSession() }
      else if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; refreshSocketAuthentication() }, 5000)
    })
    .finally(() => {
      refreshAfterDisconnect = null
    })
  return refreshAfterDisconnect
}

function recoverExpiredSocket(reason) {
  if (!shouldRefreshAfterSocketDisconnect(reason)) return
  refreshSocketAuthentication()
}

function recoverSocketConnectionError(error) {
  if (!isSocketAuthenticationError(error)) return
  refreshSocketAuthentication()
}

export function getSocket() {
  if (inPrototype()) return prototypeSocket
  if (!socket) {
    socket = io(socketOrigin(), {
      path: '/comunicacao/socket.io',
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: socketAuthentication,
    })
    socket.on('disconnect', recoverExpiredSocket)
    socket.on('connect_error', recoverSocketConnectionError)
    installAuthEventListener()
  }
  return socket
}

export function connectSocket() {
  const instance = getSocket()
  instance.auth = getAccessToken() ? { token: getAccessToken() } : socketAuthentication
  if (!instance.connected) instance.connect()
  return instance
}

export function disconnectSocket() {
  clearCollaboratorSocketTokens()
  clearTimeout(retryTimer); retryTimer = null
  socket?.disconnect()
}
