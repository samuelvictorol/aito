export const videoGenerationActive = status => ['submitting', 'queued', 'in_progress', 'pending', 'processing', 'running', 'uncertain'].includes(status)

export const videoGenerationExpiry = (value, fallback) => {
  const time = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(time) ? time : fallback
}

export async function listVideoGenerations(get, { source, projectId, requestId, signal }) {
  const response = await get('/aitoia/video/generations', { params: { source, projectId, requestId }, signal })
  const jobs = response?.data?.data?.jobs
  if (!Array.isArray(jobs)) throw new Error('A fila de vídeo ainda não está disponível.')
  return jobs.filter(job => typeof job?.id === 'string' && job.id)
}

export function canRetryVideoSubmission(cause) {
  const status = cause.response?.status
  const code = cause.response?.data?.code
  return code !== 'AITO_MEDIA_ACTIVE' &&
    (!status || [408, 429, 500, 502, 503, 504].includes(status) || code === 'AITO_MEDIA_RECONCILIATION')
}
