// Keep the newest message visible through async media/layout changes, until the
// reader deliberately scrolls up. Each conversation gets a fresh bottom anchor.
export function anchorChatBottom(element) {
  let following = true, disposed = false, frame = null
  const schedule = () => {
    if (disposed || !following || frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      if (!disposed && following) element.scrollTop = element.scrollHeight
    })
  }
  const scroll = () => {
    following = element.scrollHeight - element.clientHeight - element.scrollTop < 64
  }
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  const observe = () => {
    resize?.disconnect()
    resize?.observe(element)
    for (const child of element.children) resize?.observe(child)
    schedule()
  }
  const mutations = new MutationObserver(observe)
  mutations.observe(element, { childList: true, subtree: true, characterData: true })
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('load', schedule, true)
  element.addEventListener('loadedmetadata', schedule, true)
  observe()
  return {
    reset() { following = true; schedule() },
    destroy() {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      mutations.disconnect(); resize?.disconnect()
      element.removeEventListener('scroll', scroll)
      element.removeEventListener('load', schedule, true)
      element.removeEventListener('loadedmetadata', schedule, true)
    },
  }
}

const anchors = new WeakMap()
export const vChatBottom = {
  mounted(element) { anchors.set(element, anchorChatBottom(element)) },
  updated(element, binding) {
    if (binding.value !== binding.oldValue) anchors.get(element)?.reset()
  },
  unmounted(element) { anchors.get(element)?.destroy(); anchors.delete(element) },
}
