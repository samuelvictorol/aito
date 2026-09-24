import { api, apiBaseURL } from 'boot/axios'
import { io } from 'socket.io-client'

const base = '/admin/whatsapp'
export const authConfig = (config = {}) => ({ ...config, headers: { ...config.headers, Authorization: `Bearer ${localStorage.getItem('aito_admin_token') || ''}` } })
export const messageOf = (error) => String(error?.response?.data?.message || error?.message || 'Não foi possível concluir. Tente novamente.').slice(0, 400)
export const unwrap = (response) => response?.data?.data ?? response?.data
export const requestId = () => crypto.randomUUID()
export function currentAdmin() {
  let user = {}, claims = {}
  try { user = JSON.parse(localStorage.getItem('aito_admin_user') || '{}') } catch { /* Use signed session claims for display fallback. */ }
  try { const tokenPart = (localStorage.getItem('aito_admin_token') || '').split('.')[1]; claims = JSON.parse(atob(tokenPart.replace(/-/g, '+').replace(/_/g, '/'))) } catch { /* Authentication is enforced by the API. */ }
  return { ...user, id: claims.sub || user._id || user.id }
}
export const waApi = {
  get: (path, config) => api.get(`${base}${path}`, authConfig(config)),
  post: (path, body = {}, config) => api.post(`${base}${path}`, body, authConfig(config)),
  put: (path, body, config) => api.put(`${base}${path}`, body, authConfig(config)),
  delete: (path, config) => api.delete(`${base}${path}`, authConfig(config)),
}
export const botApi = {
  get: (path, config) => waApi.get(path.startsWith('/assets') ? path : `/bot${path}`, config),
  post: (path, body, config) => waApi.post(path.startsWith('/assets') ? path : `/bot${path}`, body, config),
  put: (path, body, config) => waApi.put(`/bot${path}`, body, config),
  delete: (path, config) => waApi.delete(`/bot${path}`, config),
}
export function openWhatsAppSocket() {
  const url = new URL(apiBaseURL, window.location.origin)
  return io(url.origin, { auth: { token: localStorage.getItem('aito_admin_token') }, transports: ['websocket', 'polling'], tryAllTransports: true, reconnectionDelay: 1500, reconnectionDelayMax: 15000 })
}
export function formatDate(value, short = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', ...(short ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
export const statusText = (status) => ({ queued: 'Na fila', processing: 'Processando', preparing: 'Preparando', uploading: 'Enviando arquivo', dispatching: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falha no envio', uncertain: 'Confirmação pendente', cancelled: 'Cancelada' })[status] || status || ''
export const modeText = (mode) => ({ bot: 'Bot ativo', human: 'Atendimento humano', closed: 'Finalizado', finished: 'Finalizado' })[mode] || mode || 'Bot ativo'
export const sizeText = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil((bytes || 0) / 1024)} KB`
