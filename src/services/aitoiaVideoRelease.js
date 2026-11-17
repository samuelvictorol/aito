const failedStates = new Set(['failed', 'nsfw', 'canceled'])
export const failedVideo = job => failedStates.has(job?.status)
export const videoReleasePending = job => failedVideo(job) && job.billingPending === true
export function mergeVideoGeneration(previous, next) {
  const merged = { ...previous, ...next, billingPending: next.billingPending === true }
  if (next.billedUsdCents !== undefined && !merged.billingPending) delete merged.reservedUsdCents
  return merged
}
export const releasePendingMessage = retry => retry
  ? 'A geração falhou. Aguardando confirmação da liberação da reserva…'
  : 'A geração falhou e a liberação da reserva ainda não foi confirmada. Use “Verificar liberação” para conferir o saldo. A geração não será reenviada.'
export function releasedVideoMessage(job) {
  const reason = typeof job.message === 'string' ? job.message.replace(/\s*A reserva (?:será|foi) liberada\.?\s*$/, '').trim() : ''
  return `${reason || 'A geração não foi concluída.'} A reserva foi liberada.`
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
