const DATABASE_NAME = 'aitoia-local-history'
const TABLE_NAME = 'conversations'
const sessions = new Map()

export { downloadAitoIAJson, downloadAitoIAZip, exportAitoIAJson, exportAitoIAZip } from './aitoiaArchive.js'

export const AITOIA_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function clone(value) {
  if (!value || typeof value !== 'object' || value instanceof Blob) return value
  if (Array.isArray(value)) return value.map(clone)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
}

function publicRecord(record) {
  const { accountId, ...conversation } = record
  return clone(conversation)
}

function conversationId(id) {
  if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new TypeError('Identificador de conversa inválido.')
  return id
}

function expiredError() {
  return Object.assign(new Error('Esta conversa atingiu o prazo de sete dias. Abra uma nova conversa.'), {
    code: 'AITOIA_CONVERSATION_EXPIRED',
  })
}

function recordFor(accountId, conversation, previous, now) {
  const createdAt = previous?.createdAt ?? (Number.isSafeInteger(conversation.createdAt) ? Math.min(conversation.createdAt, now) : now)
  const expiresAt = createdAt + AITOIA_RETENTION_MS
  if (expiresAt <= now) throw expiredError()
  return { ...clone(conversation), accountId, createdAt, updatedAt: now, expiresAt }
}

function connect(indexedDB) {
  return new Promise(resolve => {
    let request
    let available = true
    try { request = indexedDB.open(DATABASE_NAME, 1) } catch { resolve(null); return }
    const unavailable = () => { available = false; resolve(null) }
    request.onerror = unavailable
    request.onblocked = unavailable
    request.onupgradeneeded = () => {
      const table = request.result.createObjectStore(TABLE_NAME, { keyPath: ['accountId', 'id'] })
      table.createIndex('accountId', 'accountId')
      table.createIndex('expiresAt', 'expiresAt')
    }
    request.onsuccess = () => {
      const database = request.result
      if (!available) { database.close(); return }
      resolve(database)
    }
  })
}

function transaction(database, work) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(TABLE_NAME, 'readwrite')
    const table = tx.objectStore(TABLE_NAME)
    let result
    let failure
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure || tx.error || new Error('Não foi possível acessar o histórico local.'))
    function run(fn) {
      try { fn() } catch (error) { failure = error; tx.abort() }
    }
    function read(request, fn) {
      request.onsuccess = () => run(() => fn(request.result))
    }
    run(() => work(table, read, value => { result = value }))
  })
}

function purgeMemory(now) {
  for (const [accountId, rows] of sessions) {
    for (const [id, row] of rows) if (row.expiresAt <= now) rows.delete(id)
    if (!rows.size) sessions.delete(accountId)
  }
}

export function createAitoIALocalStore(accountId, options = {}) {
  if (typeof accountId !== 'string' || !accountId.trim() || accountId.length > 256) throw new TypeError('Conta inválida.')
  const { now = Date.now, onExpire } = options
  let connection
  let deadline = Infinity
  let expiryTimer
  let disposed = false

  function database() {
    if (!connection) {
      try {
        const idb = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB
        const keyRange = options.keyRange || globalThis.IDBKeyRange
        connection = idb && keyRange ? connect(idb) : Promise.resolve(null)
      } catch { connection = Promise.resolve(null) }
    }
    return connection
  }

  function schedule(expiresAt) {
    if (disposed || expiresAt >= deadline) return
    clearTimeout(expiryTimer)
    deadline = expiresAt
    expiryTimer = setTimeout(() => {
      deadline = Infinity
      void list().then(rows => { if (!disposed) onExpire?.(rows) }).catch(() => {})
    }, Math.max(0, expiresAt - now()))
    expiryTimer.unref?.()
  }

  async function list() {
    const db = await database()
    const time = now()
    let rows
    if (db) {
      const keyRange = options.keyRange || globalThis.IDBKeyRange
      rows = await transaction(db, (table, read, finish) => {
        read(table.index('expiresAt').getAllKeys(keyRange.upperBound(time)), keys => {
          for (const key of keys) table.delete(key)
          read(table.index('accountId').getAll(accountId), finish)
        })
      })
    } else {
      purgeMemory(time)
      rows = [...(sessions.get(accountId)?.values() || [])]
    }
    const available = rows.filter(row => row.expiresAt > now())
    for (const row of available) schedule(row.expiresAt)
    return available.sort((a, b) => b.updatedAt - a.updatedAt).map(publicRecord)
  }

  async function save(conversation) {
    const id = conversationId(conversation?.id)
    const db = await database()
    let record
    if (db) {
      record = await transaction(db, (table, read, finish) => {
        read(table.get([accountId, id]), previous => {
          const next = recordFor(accountId, conversation, previous, now())
          table.put(next)
          finish(next)
        })
      })
    } else {
      const rows = sessions.get(accountId) || new Map()
      record = recordFor(accountId, conversation, rows.get(id), now())
      purgeMemory(now())
      rows.set(id, record)
      sessions.set(accountId, rows)
    }
    schedule(record.expiresAt)
    return publicRecord(record)
  }

  async function remove(id) {
    conversationId(id)
    const db = await database()
    if (db) await transaction(db, table => table.delete([accountId, id]))
    else sessions.get(accountId)?.delete(id)
  }

  async function clear() {
    const db = await database()
    if (db) {
      await transaction(db, (table, read) => {
        read(table.index('accountId').getAllKeys(accountId), keys => {
          for (const key of keys) table.delete(key)
        })
      })
    } else sessions.delete(accountId)
  }

  function dispose() {
    disposed = true
    clearTimeout(expiryTimer)
    void connection?.then(db => db?.close())
  }

  return { list, save, remove, clear, dispose }
}
