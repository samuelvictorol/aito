import { api } from 'boot/axios'

const limits = { file: 60 * 1024 * 1024, project: 100 * 1024 * 1024 }
const tokenStorageKey = 'aito_user_token'
const blobHashes = new WeakMap()
const shapeKey = '$aitoAsset'
const timeOf = value => typeof value === 'number' ? value : Date.parse(value)

async function blobKey(blob) {
  if (!blobHashes.has(blob)) blobHashes.set(blob, (async () => {
    const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  })())
  return blobHashes.get(blob)
}

export function createStudioCloud(studio) {
  const path = '/aitoia/studios/' + studio
  const token = localStorage.getItem(tokenStorageKey)
  const life = new AbortController()
  const uploaded = new Map()
  const running = new Map()
  function options(extra = {}, signal) {
    life.signal.throwIfAborted()
    if (!token || token !== localStorage.getItem(tokenStorageKey)) throw new Error('Sua sessão mudou.')
    return { timeout: 35000, signal: signal ? AbortSignal.any([life.signal, signal]) : life.signal,
      headers: { Authorization: 'Bearer ' + token, ...extra } }
  }

  function unpack(data) {
    return { ...data.project, id: data.id, title: data.title, createdAt: timeOf(data.createdAt), updatedAt: timeOf(data.updatedAt),
      expiresAt: timeOf(data.expiresAt), cloudOnly: true, cloudSaved: true }
  }
  async function list() {
    const { items, deletedIds } = (await api.get(path + '/projects', options())).data.data
    return { items: items.map(unpack), deletedIds: Array.isArray(deletedIds) ? deletedIds : [] }
  }
  async function save(record) {
    const { id, title, createdAt, expiresAt, updatedAt: _updated, cloudOnly: _remote, cloudSaved: _saved, ...snapshot } = record
    let size = 0
    const jobs = new Map()
    const unique = new Set()
    async function pack(value, deadline = expiresAt) {
      if (value instanceof Blob) {
        if (deadline <= Date.now() || !value.size) return undefined
        if (value.size > limits.file) throw new Error('Um arquivo excede o limite da nuvem.')
        const digest = await blobKey(value)
        if (!unique.has(digest)) size += value.size
        unique.add(digest)
        if (size > limits.project) throw new Error('O projeto excede o limite da nuvem.')
        const type = value.type || 'video/mp4'
        const current = uploaded.get(digest)
        if ((!current || current < Date.now() || current > deadline) && (!jobs.has(digest) || jobs.get(digest).deadline > deadline)) jobs.set(digest, { value, type, deadline })
        return { [shapeKey]: digest, name: value.name || '', type }
      }
      if (Array.isArray(value)) return Promise.all(value.map(item => pack(item, deadline)))
      if (!value || typeof value !== 'object') return value
      const next = timeOf(value.expiresAt)
      const until = Number.isFinite(next) ? next : deadline
      const entries = Object.entries(value).filter(([key]) => !['remoteUrl', 'url'].includes(key) || typeof value[key] !== 'string' ||
        !/^(?:blob:|https?:)/.test(value[key]))
      return Object.fromEntries(await Promise.all(entries.map(async ([key, item]) => [key, await pack(item, until)])))
    }
    const project = await pack(snapshot)
    for (const [digest, { value, type, deadline }] of jobs) {
      const key = digest + ':' + deadline
      const params = new URLSearchParams({ expiresAt: new Date(deadline).toISOString(), projectId: id })
      const operation = running.get(key) || api.put(path + '/assets/' + digest + '?' + params,
        value, { ...options({ 'Content-Type': type }), timeout: 120000 }).then(({ data }) => {
        uploaded.set(digest, timeOf(data.data.expiresAt))
      }).finally(() => running.delete(key))
      running.set(key, operation)
      await operation
    }
    const { data } = await api.put(path + '/projects/' + encodeURIComponent(id), { title, createdAt, expiresAt, project, assetIds: [...unique] }, options())
    return unpack(data.data)
  }
  async function expand(record, signal) {
    const files = new Map()
    let nextSlot = 0
    const slots = Array.from({ length: 3 }, () => Promise.resolve())
    async function read(value) {
      if (Array.isArray(value)) return Promise.all(value.map(read))
      if (!value || typeof value !== 'object') return value
      if (/^[a-f0-9]{64}$/.test(value[shapeKey] || '')) {
        const digest = value[shapeKey]
        if (!files.has(digest)) {
          const slot = nextSlot++ % slots.length
          const fetched = slots[slot].then(() => api.get(path + '/assets/' + digest, { ...options({}, signal), responseType: 'blob' }))
            .then(({ data }) => data, cause => { if ([404, 410].includes(cause.response?.status)) return undefined; throw cause })
          files.set(digest, fetched)
          slots[slot] = fetched.catch(() => {})
        }
        const blob = await files.get(digest)
        if (!blob || !value.name) return blob
        return new File([blob], value.name, { type: blob.type })
      }
      const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await read(item)]))
      return Object.fromEntries(entries.map(([key, item]) => key === 'file' && item === undefined && value[key]?.[shapeKey]
        ? ['missingMedia', true] : [key, item]))
    }
    const { cloudOnly: _remote, ...stored } = record
    const project = await read(stored)
    if (!(project.expiresAt > Date.now())) throw new Error('O projeto expirou.')
    return project
  }
  async function remove(id) {
    await api.delete(path + '/projects/' + encodeURIComponent(id), options())
  }
  async function renew(id, expectedExpiry) {
    const { data } = await api.post(path + '/projects/' + encodeURIComponent(id) + '/renew', { expectedExpiry }, options())
    uploaded.clear()
    return unpack(data.data)
  }
  return { list, save, expand, remove, renew, dispose: () => life.abort() }
}
