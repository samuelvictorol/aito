// The first visit shows the master controls briefly. This timer belongs
// to one mounted studio; cancellation preserves an explicit panel choice.
export function scheduleInitialMasterCollapse(close, {
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  let pending = true
  const timer = setTimer(() => {
    if (!pending) return
    pending = false
    close()
  }, 3000)
  return () => {
    pending = false
    if (timer !== undefined) clearTimer(timer)
  }
}
