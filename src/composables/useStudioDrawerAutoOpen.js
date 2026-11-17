import { onBeforeUnmount, onMounted, watch } from 'vue'

export function useStudioDrawerAutoOpen(drawer, entry, onAutoOpen) {
  let timer
  let stopEntryWatch

  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }

  watch(drawer, cancel, { flush: 'sync' })
  onMounted(() => {
    stopEntryWatch = watch(entry, () => {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        if (drawer.value) return
        drawer.value = true
        onAutoOpen?.()
      }, 1500)
    }, { immediate: true, flush: 'sync' })
  })
  onBeforeUnmount(() => {
    stopEntryWatch?.()
    cancel()
  })
}
