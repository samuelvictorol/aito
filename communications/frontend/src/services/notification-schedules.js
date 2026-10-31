import { asList, http, paginationOf, unwrap } from './http.js'

export async function listNotificationSchedules(params = {}) {
  const payload = unwrap(await http.get('/notification-schedules', { params }))
  return {
    items: asList(payload),
    pagination: paginationOf(payload, {
      page: params.page || 1,
      rowsPerPage: params.limit || 20,
      rowsNumber: 0,
    }),
  }
}

export async function createNotificationSchedule(input) {
  return unwrap(await http.post('/notification-schedules', input))
}

export async function updateNotificationSchedule(id, input) {
  return unwrap(await http.patch(`/notification-schedules/${id}`, input))
}

export async function removeNotificationSchedule(id) {
  return unwrap(await http.delete(`/notification-schedules/${id}`))
}

export function scheduleStatus(status) {
  return {
    scheduled: { label: 'Programado', color: 'primary', icon: 'schedule' },
    paused: { label: 'Pausado', color: 'warning', icon: 'pause_circle' },
    processing: { label: 'Processando', color: 'info', icon: 'sync' },
    completed: { label: 'Concluído', color: 'positive', icon: 'task_alt' },
    cancelled: { label: 'Cancelado', color: 'grey-7', icon: 'cancel' },
    failed: { label: 'Falhou', color: 'negative', icon: 'error' },
  }[status] || { label: status || 'Desconhecido', color: 'grey-7', icon: 'help' }
}
