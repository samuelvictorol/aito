import axios from 'axios'
import { communicationPayload } from './communication-urls.js'
import { isPrototypePath } from './prototype-mode.js'
import { prototypeRequest } from './prototype-api.js'
import { getAccessToken, getStoredUser } from './tokens.js'
import { canArea, canAction, apiPermission, isCollaborator } from './access.js'
import { API_BASE_URL, expireSession, refreshAccessToken } from './auth-refresh.js'

export { API_BASE_URL }

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  if (isPrototypePath(globalThis.location?.pathname)) {
    // Replace the adapter before credentials are attached. Unknown requests never fall through.
    delete config.headers.Authorization
    config.headers.delete?.('Authorization')
    config.withCredentials = false
    config.adapter = async request => prototypeRequest(request)
    return config
  }
  const user = getStoredUser()
  if (isCollaborator(user)) {
    const permission=apiPermission(config)
    if (permission&&!canAction(user,permission.area,permission.action)) {
      const error=new Error('Seu acesso permite somente visualização ou não autoriza esta funcionalidade.')
      error.response={status:403,data:{message:error.message}}
      return Promise.reject(error)
    }
  }
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => { response.data = communicationPayload(response.data); return response },
  async (error) => {
    const request = error.config
    const status = error.response?.status
    const isAuthRequest = /\/auth\/(login|refresh|logout|mfa)(?:\/|$)/.test(request?.url || '') || /\/collaborator\//.test(request?.url || '')

    if (status !== 401 || !request || request._retried || isAuthRequest) {
      return Promise.reject(error)
    }
    if (sessionStorage.getItem('aito.communication.collaborator') || localStorage.getItem('aito.communication.collaborator')) { expireSession(); return Promise.reject(error) }

    request._retried = true
    try {
      const token = await refreshAccessToken()
      request.headers.Authorization = `Bearer ${token}`
      return http(request)
    } catch (refreshError) {
      if ([401,403].includes(refreshError.response?.status)) expireSession()
      return Promise.reject(refreshError)
    }
  },
)

export function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export function asList(payload, preferredKey) {
  const value = payload?.data ?? payload
  if (Array.isArray(value)) return value
  if (preferredKey && Array.isArray(value?.[preferredKey])) return value[preferredKey]
  return value?.items || value?.docs || value?.results || value?.rows || []
}

export function paginationOf(payload, fallback = {}) {
  const value = payload?.data ?? payload ?? {}
  const meta = value.pagination || value.meta || value
  return {
    page: Number(meta.page || meta.currentPage || fallback.page || 1),
    rowsPerPage: Number(meta.limit || meta.perPage || fallback.rowsPerPage || 10),
    rowsNumber: Number(meta.total || meta.totalItems || meta.count || fallback.rowsNumber || 0),
  }
}

export function errorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  const response = error?.response?.data
  const envelope = response?.error && typeof response.error === 'object'
    ? response.error
    : response
  const message = envelope?.message
    || response?.message
    || (typeof response?.error === 'string' ? response.error : '')
    || error?.message
    || fallback
  const validation = envelope?.details || response?.details
  const detailMessages = []
  const append = (value) => {
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }
    if (typeof value === 'string' && value.trim()) detailMessages.push(value.trim())
  }

  append(validation?.formErrors)
  if (validation?.fieldErrors && typeof validation.fieldErrors === 'object') {
    Object.values(validation.fieldErrors).forEach(append)
  }

  const uniqueDetails = [...new Set(detailMessages)]
    .filter((detail) => !String(message).includes(detail))

  return uniqueDetails.length
    ? `${message}: ${uniqueDetails.join(' ')}`
    : message
}

export async function fetchAll(path, options = {}) {
  // Reference pickers may load optional collections from another permitted area.
  const area = path.startsWith('/contact') ? 'contacts' : path.startsWith('/template') ? 'templates' : path.startsWith('/invites') ? 'invites' : null
  if (area && !canArea(getStoredUser(), area)) return []
  const {
    params = {},
    preferredKey,
    limit = 100,
    maxPages = 50,
    maxItems = 5000,
  } = options
  const items = []
  const seen = new Set()
  let page = Number(params.page || 1)

  for (let requestNumber = 0; requestNumber < maxPages && items.length < maxItems; requestNumber += 1) {
    const payload = unwrap(await http.get(path, { params: { ...params, page, limit: Math.min(limit, 100) } }))
    const pageItems = asList(payload, preferredKey)
    let added = 0

    for (const item of pageItems) {
      const identity = item?.id || item?._id || item?.externalId || item?.chatId || JSON.stringify(item)
      if (seen.has(identity)) continue
      seen.add(identity)
      items.push(item)
      added += 1
      if (items.length >= maxItems) break
    }

    const pagination = paginationOf(payload, { page, rowsPerPage: Math.min(limit, 100), rowsNumber: 0 })
    const reachedTotal = pagination.rowsNumber > 0 && items.length >= pagination.rowsNumber
    if (!pageItems.length || pageItems.length < Math.min(limit, 100) || added === 0 || reachedTotal) break
    page += 1
  }

  return items
}
