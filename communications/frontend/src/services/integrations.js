import { asList, http, paginationOf, unwrap } from './http.js'

export const INTEGRATION_SCOPES = Object.freeze([
  { label: 'Disparar notificações', value: 'notifications:send' },
  { label: 'Criar agendamentos', value: 'notifications:schedule' },
  { label: 'Consultar atividade', value: 'activity:read' },
  { label: 'Validar acesso por e-mail', value: 'auth:email' },
])

export async function listIntegrationApps(params = {}) {
  const payload = unwrap(await http.get('/integrations/apps', { params }))
  return {
    items: asList(payload),
    pagination: paginationOf(payload, {
      page: params.page || 1,
      rowsPerPage: params.limit || 20,
      rowsNumber: 0,
    }),
  }
}

export async function getIntegrationApp(id) {
  return unwrap(await http.get(`/integrations/apps/${id}`))
}

export async function createIntegrationApp(input) {
  return unwrap(await http.post('/integrations/apps', input))
}

export async function updateIntegrationApp(id, input) {
  return unwrap(await http.patch(`/integrations/apps/${id}`, input))
}

export async function removeIntegrationApp(id) {
  return unwrap(await http.delete(`/integrations/apps/${id}`))
}

export async function createIntegrationToken(appId, input) {
  return unwrap(await http.post(`/integrations/apps/${appId}/tokens`, input))
}

export async function revokeIntegrationToken(appId, tokenId) {
  return unwrap(await http.delete(`/integrations/apps/${appId}/tokens/${tokenId}`))
}

export async function listIntegrationAppActivity(appId, params = {}) {
  const response = await http.get(`/integrations/apps/${appId}/activity`, { params })
  const payload = unwrap(response) || {}
  return {
    app: payload.app || null,
    overview: payload.overview || {},
    items: asList(payload),
    pagination: paginationOf(response.data?.pagination || {}, {
      page: params.page || 1,
      rowsPerPage: params.limit || 20,
      rowsNumber: 0,
    }),
  }
}

export async function getIntegrationAppActivityDetail(appId, type, activityId) {
  return unwrap(await http.get(`/integrations/apps/${appId}/activity/${type}/${activityId}`))
}

export function integrationQueueLabel(phase) {
  return ({
    waiting: 'Na fila',
    delayed: 'Agendado na fila',
    active: 'Saiu da fila · processando',
    recovery_pending: 'Aguardando recuperação da fila',
    exited: 'Saiu da fila',
  })[phase] || 'Estado da fila indisponível'
}

export function integrationStatusColor(status) {
  if (['sent', 'completed', 'delivered', 'read'].includes(status)) return 'positive'
  if (['failed', 'cancelled', 'skipped'].includes(status)) return 'negative'
  if (['processing', 'partial'].includes(status)) return 'warning'
  return 'primary'
}
