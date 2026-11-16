import { computed, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import { api } from 'boot/axios'

const areas = {
  'aito-ia': 'chat',
  'aito-ia-video-studio': 'system',
  'aito-ia-marketing-studio': 'marketing',
}
const outage = { system: false, chat: false, video: false, marketing: false }
const available = { system: true, chat: true, video: true, marketing: true }
const availability = shallowRef(null)
let pending

export function refreshAitoAvailability() {
  if (!pending) {
    pending = api.get('/aitoia/availability', { timeout: 4500 }).then(({ data }) => {
      const current = data?.data
      availability.value = Object.keys(outage).every(area => typeof current?.[area] === 'boolean') ? current : outage
    }).catch(error => {
      // Frontend and API deploy independently. An older API does not expose this endpoint.
      const { status, data } = error.response || {}
      const legacyApi = status === 404 || (status === 401 && data === 'Unauthorized')
      availability.value = legacyApi ? available : outage
    }).finally(() => { pending = undefined })
  }
  return pending
}

export function useAitoAvailability() {
  return {
    availability,
    videoInMaintenance: computed(() => availability.value?.video === false),
    refreshAvailability: refreshAitoAvailability,
  }
}

export function useAitoAvailabilityBoundary(route, router) {
  const area = computed(() => areas[route.name] || '')
  const checkingAvailability = computed(() => Boolean(area.value && !availability.value))
  const maintenance = computed(() => {
    if (!area.value || !availability.value) return ''
    if (!availability.value.system) return 'system'
    return availability.value[area.value] ? '' : area.value
  })
  let redirecting = false
  let interval
  let stopWatch

  async function refreshAvailability() {
    if (!area.value) return
    await refreshAitoAvailability()
    if (redirecting || area.value !== 'chat' || maintenance.value !== 'chat' || !availability.value.video) return
    redirecting = true
    try {
      await router.replace({ name: 'aito-ia-video-studio', query: { ...route.query, maintenance: 'chat' } })
    } catch { /* A pending navigation may prevent automatic redirection. Keep the blocked view visible. */ }
    finally { redirecting = false }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') void refreshAvailability()
  }

  function onMaintenance(event) {
    const blocked = event.detail
    if (blocked === 'system') availability.value = outage
    else if (availability.value && Object.hasOwn(outage, blocked)) {
      availability.value = { ...availability.value, [blocked]: false }
    }
    void refreshAvailability()
  }

  onMounted(() => {
    stopWatch = watch(area, refreshAvailability, { immediate: true })
    interval = window.setInterval(onVisible, 20000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('aito:maintenance', onMaintenance)
  })
  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return
    stopWatch?.()
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('aito:maintenance', onMaintenance)
  })

  return { maintenance, checkingAvailability, refreshAvailability }
}
