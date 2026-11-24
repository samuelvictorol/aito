const failedStates = new Set(['failed', 'nsfw', 'canceled'])
export const failedVideo = job => failedStates.has(job?.status)
export const videoReleasePending = job => failedVideo(job) && (job.refundPending === true || job.billingPending === true)
export function mergeVideoGeneration(previous, next) {
  const merged = { ...previous, ...next, billingPending: next.billingPending === true, refundPending: next.refundPending === true }
  if (next.billedUsdCents !== undefined && !merged.billingPending) delete merged.reservedUsdCents
  return merged
}
export function videoRefundNotice(job) {
  if (!failedVideo(job)) return ''
  if (videoReleasePending(job)) return 'Estorno automático em processamento.'
  if (job.refundedAt) {
    return job.refundedAitoTokens > 0
      ? `${new Intl.NumberFormat('pt-BR').format(job.refundedAitoTokens)} AitoTokens estornados à sua carteira.`
      : 'Estorno confirmado na sua carteira.'
  }
  return job.billedUsdCents === 0 ? 'Reserva liberada.' : ''
}
export function videoFailureReason(job) {
  const reason = typeof job?.message === 'string' ? job.message.replace(/\s*A reserva (?:será|foi) liberada\.?\s*$/, '').trim() : ''
  if (job?.status === 'nsfw' && (!reason || reason === 'A geração não foi concluída.')) {
    return 'A Higgsfield bloqueou a geração por moderação de conteúdo.'
  }
  return reason || 'A geração não foi concluída.'
}
export function releasePendingMessage(retry, job) {
  const next = retry ? 'Estorno automático em processamento.' : 'O estorno ainda está em processamento. Use o botão de verificação para conferir a situação.'
  return `${videoFailureReason(job)} ${next}`
}
export function releasedVideoMessage(job) {
  return `${videoFailureReason(job)} ${job.refundedAt ? videoRefundNotice(job) : 'A reserva foi liberada.'}`
}

// Failed delivery and settled billing are different events. Bound automatic
// GETs while retaining the original job for an explicit financial check.
export function createVideoReleaseMonitor({ now = Date.now, maxChecks = 8, maxWaitMs = 60000 } = {}) {
  const pending = new Map()
  return {
    observe(job) {
      const id = job?.id || job?.requestId
      if (!videoReleasePending(job)) {
        pending.delete(id)
        return { pending: false, retry: false, released: failedVideo(job) && job.billedUsdCents === 0 }
      }
      const entry = pending.get(id) || { at: now(), checks: 0 }
      entry.checks++
      pending.set(id, entry)
      return { pending: true, released: false, retry: entry.checks < maxChecks && now() - entry.at < maxWaitMs }
    },
  }
}
