import { onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

export function useAitoWorkGuard(busy, onBlocked) {
  const leave = event => { event.preventDefault(); event.returnValue = '' }
  const cleanup = () => window.removeEventListener('beforeunload', leave)
  watch(busy, active => {
    cleanup()
    if (active) window.addEventListener('beforeunload', leave)
  }, { immediate: true })
  onBeforeRouteLeave(() => {
    if (!busy.value) return true
    onBlocked?.()
    return false
  })
  onBeforeUnmount(cleanup)
}
