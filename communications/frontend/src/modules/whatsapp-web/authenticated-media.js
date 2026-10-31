import { API_PREFIX, api } from './services.js'
import { protectedMediaPath } from './media-url.js'

const entries = new Map()
const elementState = new WeakMap()

function release(state) {
  if (!state || state.released) return
  state.released = true
  const entry = state.entry
  if (!entry) return
  entry.references -= 1
  if (entry.references > 0) return
  entry.controller.abort()
  if (entry.url) URL.revokeObjectURL(entry.url)
  entries.delete(state.path)
}

function bindSource(element, binding, attribute) {
  const value = binding.value || ''
  const previous = elementState.get(element)
  if (previous?.source === value && previous.attribute === attribute) return
  release(previous)
  const path = protectedMediaPath(value, API_PREFIX, window.location.origin)
  const state = { source: value, attribute, path, entry: null, released: false }
  elementState.set(element, state)
  element.removeAttribute(attribute)
  element.removeAttribute('aria-busy')
  if (!path) {
    if (value) element.setAttribute(attribute, value)
    return
  }
  element.setAttribute('aria-busy', 'true')
  let entry = entries.get(path)
  if (!entry) {
    const controller = new AbortController()
    entry = { controller, references: 0, url: null, pending: null }
    entry.pending = api.get(path, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return null
        entry.url = URL.createObjectURL(response.data)
        return entry.url
      })
    entries.set(path, entry)
  }
  entry.references += 1
  state.entry = entry
  entry.pending.then((url) => {
    if (!state.released && url) element.setAttribute(attribute, url)
  }).catch(() => {
    if (!state.released) element.dispatchEvent(new Event('error'))
  }).finally(() => {
    if (!state.released) element.removeAttribute('aria-busy')
  })
}

function directive(attribute) {
  return {
    mounted: (element, binding) => bindSource(element, binding, attribute),
    updated: (element, binding) => bindSource(element, binding, attribute),
    unmounted: (element) => { release(elementState.get(element)); elementState.delete(element) },
  }
}

export const vAuthSrc = directive('src')
export const vAuthHref = directive('href')

export function clearAuthenticatedMedia() {
  for (const entry of entries.values()) {
    entry.controller.abort()
    if (entry.url) URL.revokeObjectURL(entry.url)
  }
  entries.clear()
}
