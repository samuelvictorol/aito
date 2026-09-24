const statusRank = { queued: 0, preparing: 0, processing: 1, dispatching: 2, uncertain: 2, sent: 3, delivered: 4, read: 5 }

export function messageAsset(message) {
  if (message?.asset && typeof message.asset === 'object') return message.asset
  if (message?.assetId && typeof message.assetId === 'object') return message.assetId
  return {}
}

export function sameMessage(existing, incoming) {
  if (existing._id && existing._id === incoming._id) return true
  if (!existing.requestId || !incoming.requestId) return false
  return existing.requestId === incoming.requestId || Boolean(existing.local && incoming.requestId.endsWith(`:${existing.requestId}`))
}

// Socket acknowledgments can arrive before the response to the original enqueue request.
export function mergeMessage(existing, incoming) {
  if (!existing) return incoming
  const currentTime = Date.parse(existing.updatedAt || '')
  const incomingTime = Date.parse(incoming.updatedAt || '')
  if (!existing.local && currentTime > incomingTime) return { ...incoming, ...existing }
  const merged = { ...existing, ...incoming, local: false }
  if (existing.deleted) return { ...merged, deleted: true, text: '', assetId: null, asset: null }
  if (!(incomingTime > currentTime) && (statusRank[existing.status] ?? -1) > (statusRank[incoming.status] ?? -1) && incoming.status !== 'failed') {
    for (const key of ['status', 'progress', 'error', 'whatsappId', 'dispatchedAt', 'sentAt']) if (existing[key] !== undefined) merged[key] = existing[key]
  }
  return merged
}
