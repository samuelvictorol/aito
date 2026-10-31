// Compatibility for stored media and links created before the host migration.
// No database record or opaque token is changed by this display adapter.
export function communicationUrl(value, origin = globalThis.location?.origin || 'https://aitosoftwares.com') {
  if (typeof value !== 'string') return value
  if (value.startsWith('https://notify-flow.onrender.com/api/')) return origin + '/comunicacao/api/' + value.slice('https://notify-flow.onrender.com/api/'.length)
  if (value.startsWith('https://notify-flow.onrender.com/')) return origin + '/comunicacao/app/' + value.slice('https://notify-flow.onrender.com/'.length)
  if (value.startsWith('/api/')) return '/comunicacao/api/' + value.slice(5)
  if (/^\/(?:icons|brand)\//.test(value)) return '/comunicacao/app' + value
  return value
}
export function communicationPayload(value, depth = 0) {
  if (depth > 18) return value
  if (typeof value === 'string') return communicationUrl(value)
  if (Array.isArray(value)) return value.map(item=>communicationPayload(item, depth+1))
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,communicationPayload(item,depth+1)]))
}
