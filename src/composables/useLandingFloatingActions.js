import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { observeLandingEdges } from 'src/services/landingFloatingActions'

const edgeVisible = ref(false)
let owner

export const landingEdgeActionsVisible = readonly(edgeVisible)

export function useLandingFloatingActions() {
  const current = {}
  let stop
  onMounted(() => {
    owner = current
    const sections = document.querySelectorAll('[data-landing-3d-section]')
    stop = observeLandingEdges({ first: sections[0], last: sections[sections.length - 1],
      onChange: value => { if (owner === current) edgeVisible.value = value } })
  })
  onBeforeUnmount(() => {
    stop?.()
    if (owner === current) { owner = null; edgeVisible.value = false }
  })
  return landingEdgeActionsVisible
}
