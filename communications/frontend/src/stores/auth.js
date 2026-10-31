import { defineStore } from 'pinia'
import { inPrototype, prototypeAuth } from '../services/prototype-runtime.js'
import axios from 'axios'
import { http, unwrap } from '../services/http.js'
import { disableBrowserPush } from '../services/browser-push.js'
import { stopAppSounds } from '../services/sounds.js'
import { refreshAccessToken } from '../services/auth-refresh.js'
import {
  clearStoredSession,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
} from '../services/tokens.js'

const useRealAuthStore = defineStore('auth', {
  state: () => ({
    user: getStoredUser(),
    token: getAccessToken(),
    ready: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token || state.user?.role === 'collaborator'),
    isCollaborator: (state) => state.user?.role === 'collaborator',
    displayName: (state) => state.user?.name || state.user?.email || 'Administrador',
  },
  actions: {
    async loginCollaborator(credentials) {
      const result = unwrap(await axios.post((http.defaults.baseURL || '/api') + '/collaborator/login', credentials, { withCredentials: true }))
      if (result.requiresMfa) return result
      return this.acceptCollaborator(result.user, credentials.remember)
    },
    async verifyCollaboratorLogin(input, credentials) {
      const result = unwrap(await axios.post((http.defaults.baseURL || '/api') + '/collaborator/verify', { ...input, remember: credentials.remember === true }, { withCredentials: true }))
      return this.acceptCollaborator(result.user, credentials.remember)
    },
    acceptCollaborator(user, remember = false) {
      if (user?.role !== 'collaborator') throw new Error('A API não confirmou o perfil de colaborador.')
      clearStoredSession()
      setStoredUser(user, remember)
      ;(remember ? localStorage : sessionStorage).setItem('aito.communication.collaborator', 'true')
      this.user = user; this.token = null; this.ready = true
      return user
    },
    async login(credentials) {
      const result = unwrap(await http.post('/auth/login', {
        email: credentials.email,
        password: credentials.password,
        remember: credentials.remember === true,
      }))
      if (result?.requiresMfa) return result
      return this.acceptSession(result, credentials)
    },
    async verifyEmailLogin(input, credentials) {
      return this.acceptSession(unwrap(await http.post('/auth/mfa/verify', { ...input, remember: credentials.remember === true })), credentials)
    },
    acceptSession(result, credentials) {
      const token = result?.accessToken || result?.token || result?.jwt
      if (!token) throw new Error('A API não retornou um token de acesso.')
      const user = result.user || result.admin || { email: credentials.email }
      clearStoredSession()
      setAccessToken(token, credentials.remember)
      setStoredUser(user, credentials.remember)
      this.token = token
      this.user = user
      this.ready = true
      return user
    },
    async bootstrap() {
      if (this.ready) return
      if (!this.token) {
        // The browser may have discarded per-tab storage during a deploy or a PWA
        // restart; the persistent cookie can restore identity without another email.
        let adminRestored = false
        if (!localStorage.getItem('aito.communication.collaborator') && !sessionStorage.getItem('aito.communication.collaborator')) {
          try { this.token = await refreshAccessToken(); adminRestored = true } catch (error) {
            // A deploy, offline connection or rate limit is not an expired login.
            // Do not fall through to collaborator authentication and erase this device.
            if (![401,403].includes(error.response?.status)) throw error
          }
        }
        if (adminRestored) {
          try { const result = unwrap(await http.get('/auth/me')); this.user = result.user || result.admin || result; setStoredUser(this.user, Boolean(localStorage.getItem('aito.communication.rememberDevice'))) }
          catch (error) { if ([401,403].includes(error.response?.status)) this.clearSession() }
          this.ready = true
          return
        }
        try {
          const user = unwrap(await axios.get((http.defaults.baseURL || '/api') + '/collaborator/session', { withCredentials: true }))
          this.acceptCollaborator(user, user.remembered === true)
        } catch (error) { if ([401,403].includes(error.response?.status)) { clearStoredSession(); this.user = null } }
        this.ready = true
        return
      }
      try {
        const result = unwrap(await http.get('/auth/me'))
        this.user = result?.user || result?.admin || result
        setStoredUser(this.user, Boolean(localStorage.getItem('aito.communication.rememberDevice')))
      } catch (error) {
        if ([401,403].includes(error.response?.status)) this.clearSession()
      } finally {
        this.ready = true
      }
    },
    async logout() {
      if (this.isCollaborator) {
        try { await axios.post((http.defaults.baseURL || '/api') + '/collaborator/logout', {}, { withCredentials: true }) } finally { clearStoredSession(); this.user = null; this.token = null; this.ready = true }
        return
      }
      stopAppSounds()
      await disableBrowserPush().catch(() => {})
      try {
        await http.post('/auth/logout')
      } catch {
        // A sessão local ainda deve ser encerrada se a API estiver indisponível.
      }
      this.clearSession()
    },
    clearSession() {
      stopAppSounds()
      void disableBrowserPush().catch(() => {})
      clearStoredSession()
      this.token = null
      this.user = null
      this.ready = true
    },
  },
})
export function useAuthStore(...args) { return inPrototype() ? prototypeAuth : useRealAuthStore(...args) }
