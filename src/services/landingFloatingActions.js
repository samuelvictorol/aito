// Floating actions follow the narrow band at the viewport center. Geometry and
// IntersectionObserver use the same bounds, including edge adjacency, so the
// sole threshold-zero entry callback cannot be lost during very slow scrolling.
export function observeLandingEdges({ first, last, view = window, onChange }) {
  const edges = [...new Set([first, last].filter(Boolean))]
  let observer
  let frame = 0
  let rebuildPending = false
  let stopped = false
  let previous
  const Observer = view.IntersectionObserver
  const bandInset = () => Math.max(0, Math.floor(view.innerHeight / 2) - 1)

  function measure() {
    if (stopped) return
    const inset = bandInset()
    const bottom = view.innerHeight - inset
    const visible = edges.some(section => {
      const rect = section.getBoundingClientRect()
      return rect.top <= bottom && rect.bottom >= inset
    })
    if (visible !== previous) {
      previous = visible
      onChange(visible)
    }
  }

  function rebuild() {
    observer?.disconnect()
    if (typeof Observer === 'function' && edges.length) {
      const inset = bandInset()
      observer = new Observer(measure, { rootMargin: `-${inset}px 0px -${inset}px 0px`, threshold: 0 })
      edges.forEach(section => observer.observe(section))
    }
    measure()
  }

  function schedule(needsRebuild = false) {
    if (stopped) return
    rebuildPending ||= needsRebuild
    if (frame) return
    frame = view.requestAnimationFrame(() => {
      frame = 0
      if (stopped) return
      if (rebuildPending) { rebuildPending = false; rebuild() }
      else measure()
    })
  }

  const resize = () => schedule(true)
  const scroll = () => schedule()
  view.addEventListener('resize', resize, { passive: true })
  view.visualViewport?.addEventListener('resize', resize, { passive: true })
  if (typeof Observer !== 'function') view.addEventListener('scroll', scroll, { passive: true })
  rebuild()

  return () => {
    stopped = true
    observer?.disconnect()
    view.removeEventListener('resize', resize)
    view.visualViewport?.removeEventListener('resize', resize)
    if (typeof Observer !== 'function') view.removeEventListener('scroll', scroll)
    if (frame) view.cancelAnimationFrame(frame)
  }
}
