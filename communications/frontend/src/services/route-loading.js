import { computed, nextTick, reactive } from 'vue'

const DEFAULT_LABEL = 'Preparando sua tela…'
const state = reactive({ active: true, visible: true, label: DEFAULT_LABEL })
let generation = 0
let sequence = 0
let revealTimer
const pending = new Map([[0, { generation, label: DEFAULT_LABEL }]])

function update() {
  state.active = pending.size > 0
  if (!state.active) {
    clearTimeout(revealTimer)
    revealTimer = undefined
    state.visible = false
    return
  }
  state.label = [...pending.values()].at(-1)?.label || DEFAULT_LABEL
  if (!state.visible && revealTimer === undefined) {
    // Cached screens finish before this timer; slow screens get the same full-screen handoff.
    revealTimer = setTimeout(() => {
      revealTimer = undefined
      if (pending.size) state.visible = true
    }, 120)
  }
}

function add(label) {
  const token = ++sequence
  pending.set(token, { generation, label: label || DEFAULT_LABEL })
  update()
  return token
}

export function beginRouteLoading(label = DEFAULT_LABEL) {
  // A redirect or replacement navigation supersedes the old route and its nested imports.
  generation += 1
  pending.clear()
  return add(label)
}

function nextFrame() {
  return new Promise(resolve => {
    let frame
    const finish = () => {
      clearTimeout(timeout)
      if (frame !== undefined) globalThis.cancelAnimationFrame?.(frame)
      resolve()
    }
    // Safari and hidden tabs can pause requestAnimationFrame entirely.
    const timeout = setTimeout(finish, 80)
    frame = globalThis.requestAnimationFrame?.(finish)
  })
}

export async function finishRouteLoading(token) {
  if (!pending.has(token)) return
  await nextTick()
  await nextFrame()
  await nextFrame()
  pending.delete(token)
  update()
}

export function failRouteLoading(token) {
  const entry = pending.get(token)
  if (!entry) return
  for (const [key, value] of pending) if (value.generation === entry.generation) pending.delete(key)
  update()
}

export function withScreenLoading(loader, label = DEFAULT_LABEL) {
  return () => {
    const token = add(label)
    return Promise.resolve().then(loader).then(value => {
      // Return the component immediately so Vue can render it before the overlay disappears.
      void finishRouteLoading(token)
      return value
    }, error => {
      void finishRouteLoading(token)
      throw error
    })
  }
}

export function useRouteLoading() {
  return {
    active: computed(() => state.active),
    visible: computed(() => state.visible),
    label: computed(() => state.label),
  }
}

export function installRouteLoading(router) {
  const tokens = new WeakMap()
  let current = 0
  router.beforeEach(to => {
    current = beginRouteLoading()
    tokens.set(to, current)
  })
  router.afterEach((to, _from, failure) => {
    const token = tokens.get(to)
    if (token === undefined) return
    if (failure) failRouteLoading(token)
    else void finishRouteLoading(token)
    tokens.delete(to)
  })
  router.onError((_error, to) => {
    const token = to ? tokens.get(to) ?? (pending.has(0) ? 0 : undefined) : current
    if (token !== undefined) failRouteLoading(token)
    if (to) tokens.delete(to)
  })
}
