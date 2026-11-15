const prefix = 'aitoia:video-project-links:'
const pendingFor = 7 * 24 * 60 * 60_000

export function isVideoGenerationId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,140}$/.test(id)) return false
  try {
    return /^usage:(?:[a-f\d]{24}|admin:[a-z\d_-]+):[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
      .test(atob(id.replaceAll('-', '+').replaceAll('_', '/')))
  } catch { return false }
}

export function projectVideoIds(project, now = Date.now()) {
  const ids = new Set()
  const rows = items => Array.isArray(items) ? items : []
  const add = (id, item) => {
    if (isVideoGenerationId(id) && !item.expired && (!item.expiresAt || item.expiresAt > now) &&
      (item.file instanceof Blob && item.file.size || /^[a-f\d]{64}$/i.test(item.file?.$aitoAsset || ''))) ids.add(id)
  }
  for (const item of rows(project.clips)) add(item?.id, item)
  for (const item of rows(project.scenes)) add(item?.clipId, item)
  for (const item of rows(project.components)) add(item?.sourceClipId, item)
  for (const item of rows(project.remake?.scenes)) if (item?.result) add(item.result.id, item.result)
  return [...ids].sort()
}

const signature = ({ title, expiresAt, ids }) => JSON.stringify([title, expiresAt, ids])

export function createVideoProjectLinks({ owner, access }) {
  const entries = new Map()
  const sent = new Map()
  let request
  let timer
  let disposed = false

  function backlog(account) {
    if (entries.has(account)) return entries.get(account)
    let loaded = new Map()
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + account) || '[]')
      loaded = new Map(saved.filter(([, message]) => message?.updatedAt > Date.now() - pendingFor))
    } catch { /* Browsers without storage can still sync the current session. */ }
    entries.set(account, loaded)
    return loaded
  }

  function persist(account, items) {
    try {
      if (items.size) localStorage.setItem(prefix + account, JSON.stringify([...items]))
      else localStorage.removeItem(prefix + account)
    } catch { /* The pending records remain available in memory. */ }
  }

  function retry(delay = 300) {
    clearTimeout(timer)
    if (!disposed && owner()) timer = setTimeout(() => void flush(), delay)
  }

  async function flush() {
    if (request || disposed) return
    const account = owner()
    if (!account) return
    const api = access()
    if (!api.current()) return
    const pending = backlog(account)
    request = account
    let failed = false
    try {
      for (const [id, body] of [...pending]) {
        if (!api.current() || owner() !== account) break
        if (body.ids.length && body.expiresAt <= Date.now()) {
          if (pending.get(id) === body) pending.delete(id)
          continue
        }
        try {
          await api.put('/aitoia/video/generations/projects/' + encodeURIComponent(id), body, { timeout: 12000 })
          sent.set(`${account}:${id}`, signature(body))
          if (pending.get(id) === body) pending.delete(id)
        } catch {
          failed = true
        }
      }
    } finally {
      persist(account, pending)
      request = null
      const selected = owner()
      if (selected && backlog(selected).size) retry(failed && selected === account ? 30000 : 300)
    }
  }

  function queue(account, id, body) {
    if (!account || !id) return
    const pending = backlog(account)
    const current = pending.get(id)
    const key = `${account}:${id}`
    const same = signature(body)
    if (current && (current.updatedAt > body.updatedAt || signature(current) === same) || !current && sent.get(key) === same) return
    pending.set(id, body)
    persist(account, pending)
    if (owner() === account) void flush()
  }

  return {
    save(project, account) {
      if (!project?.id || project.expiresAt <= Date.now()) return
      queue(account, project.id, { title: project.title, expiresAt: project.expiresAt, ids: projectVideoIds(project),
        updatedAt: project.updatedAt || project.createdAt || Date.now() })
    },
    remove(id, account) { queue(account, id, { ids: [], updatedAt: Date.now() }) },
    retry,
    dispose() { disposed = true; clearTimeout(timer) },
  }
}
