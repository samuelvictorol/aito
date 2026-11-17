import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Notify } from 'quasar'
import { api } from 'boot/axios'

const routes = new Set(['aito-ia', 'aito-ia-video-studio', 'aito-ia-marketing-studio', 'video-studio-tester'])
const prefix = 'aitoia:theme:'
const theme = ref('light')
const active = ref(false)
const isDark = computed(() => !active.value || theme.value === 'dark')
const validTheme = value => value === 'light' || value === 'dark'
let session
let saved = 'light'
let revision = 0
let reads = 0
let pendingWrites = 0
let writes = Promise.resolve()

function selection() {
  const admin = localStorage.getItem('aito_admin_token')
  const token = admin || localStorage.getItem('aito_user_token')
  let subject
  try { subject = JSON.parse(atob((token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub }
  catch { /* A session without a readable identifier still loads from the API. */ }
  return {
    token, path: `${admin ? '/admin' : ''}/aitoia/preferences/theme`,
    key: token ? (subject ? `${prefix}${admin ? 'admin' : 'client'}:${subject}` : null) : `${prefix}guest`,
  }
}

function readLocal(key) {
  try { const value = key && localStorage.getItem(key); return validTheme(value) ? value : 'light' }
  catch { return 'light' }
}

function cache(key, value) {
  try { if (key) localStorage.setItem(key, value) }
  catch { /* Remote preferences still work if local storage is restricted. */ }
}

const request = owner => ({ headers: { Authorization: `Bearer ${owner.token}` }, timeout: 8000 })

async function sync({ refresh = true } = {}) {
  if (!active.value) return
  let next
  try { next = selection() } catch { next = { token: null, key: null, path: '' } }
  if (!session || next.token !== session.token || next.path !== session.path) {
    session = next
    revision += 1
    saved = readLocal(next.key)
    theme.value = saved
  }
  if (!session.token || !refresh || pendingWrites) return
  const owner = session
  const before = revision
  const read = ++reads
  try {
    const { data } = await api.get(owner.path, request(owner))
    const value = data?.data?.theme
    if (session === owner && before === revision && read === reads && validTheme(value)) {
      saved = theme.value = value
      cache(owner.key, value)
    }
  } catch { /* Keep the last known setting while the service is unavailable. */ }
}

function setTheme(value) {
  if (!validTheme(value) || !active.value || value === theme.value) return
  void sync({ refresh: false })
  const owner = session
  const change = ++revision
  theme.value = value
  if (!owner?.token) {
    saved = value
    cache(owner?.key, value)
    return
  }
  pendingWrites += 1
  writes = writes.then(async () => {
    if (owner !== session) return
    const { data } = await api.put(owner.path, { theme: value }, request(owner))
    const result = data?.data?.theme
    if (!validTheme(result)) throw new Error('Invalid theme preference')
    if (owner === session) {
      saved = result
      cache(owner.key, result)
      if (change === revision) theme.value = result
    }
  }).catch(() => {
    if (owner !== session || change !== revision) return
    theme.value = saved
    Notify.create({ type: 'warning', position: 'top', message: 'Não foi possível salvar o tema. Tente novamente.' })
  }).finally(() => {
    pendingWrites -= 1
    if (!pendingWrites && owner !== session) void sync()
  })
}

export function useAitoIATheme() {
  return { theme, isDark, setTheme }
}

export function installAitoIATheme(route) {
  if (typeof window === 'undefined') return
  function onStorage(event) {
    if (event.key && event.key === session?.key && !pendingWrites && active.value) {
      revision += 1
      saved = theme.value = readLocal(session.key)
    } else if (!event.key || ['aito_user_token', 'aito_admin_token'].includes(event.key)) void sync()
  }
  const onSession = () => { void sync() }
  const onVisibility = () => { if (document.visibilityState === 'visible') void sync() }
  watch(() => routes.has(route.name), value => {
    active.value = value
    if (value) void sync()
  }, { immediate: true, flush: 'sync' })
  watch([active, theme], ([enabled, value]) => {
    if (enabled) document.documentElement.dataset.aitoIaTheme = value
    else delete document.documentElement.dataset.aitoIaTheme
  }, { immediate: true, flush: 'sync' })
  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('aito:session-changed', onSession)
    window.addEventListener('aito:session-expired', onSession)
    document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('aito:session-changed', onSession)
    window.removeEventListener('aito:session-expired', onSession)
    document.removeEventListener('visibilitychange', onVisibility)
    delete document.documentElement.dataset.aitoIaTheme
  })
}
