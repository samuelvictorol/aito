// Only a newly completed generation should move a mobile viewport. Never pull a
// desktop workspace or a background tab away from what the person is doing.
export function revealGeneratedVideo(element, { browser = globalThis.window, page = globalThis.document } = {}) {
  if (!element?.isConnected || page?.visibilityState === 'hidden' ||
      !browser?.matchMedia?.('(max-width: 900px)').matches) return false
  const reducedMotion = browser.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
  return true
}
