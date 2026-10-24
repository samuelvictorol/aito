import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const api = axios.create({ baseURL: apiBaseURL })

const sessionEntries = [
  { tokenKey: 'aito_user_token', userKey: 'aito_user', defaultPath: '/?auth=login' },
  { tokenKey: 'aito_admin_token', userKey: 'aito_admin_user', defaultPath: '/admin/login' },
  { tokenKey: 'aito_affiliate_token', userKey: 'aito_affiliate_user', defaultPath: '/affiliate' },
]

function getRequestToken(config) {
  const headers = config?.headers
  if (!headers) return ''
  return String(headers.Authorization || headers.authorization || headers.get?.('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

function resolveSession(token) {
  const entry = sessionEntries.find((item) => localStorage.getItem(item.tokenKey) === token)
  if (!entry) return null

  let user = {}
  try {
    user = JSON.parse(localStorage.getItem(entry.userKey) || '{}')
  } catch (error) {
    user = {}
  }

  return {
    ...entry,
    loginPath: entry.tokenKey === 'aito_user_token' && user.role === 'customer' ? '/customer/login' : entry.defaultPath,
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const responseMessage = String(error.response?.data?.message || '')
    const requestToken = getRequestToken(error.config)
    const isExpiredToken = error.response?.status === 401 && requestToken && /token.*(invalido|inválido|expirado)/i.test(responseMessage)

    if (isExpiredToken && typeof window !== 'undefined' && !error.config?._aitoSessionHandled) {
      error.config._aitoSessionHandled = true
      const session = resolveSession(requestToken)
      if (session) {
        localStorage.removeItem(session.tokenKey)
        localStorage.removeItem(session.userKey)
        window.dispatchEvent(new CustomEvent('aito:session-expired', { detail: { loginPath: session.loginPath } }))
      }
    }

    return Promise.reject(error)
  },
)

export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api, apiBaseURL }
