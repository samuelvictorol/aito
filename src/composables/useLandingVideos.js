import { computed, onMounted, shallowRef, toValue } from 'vue'
import { api } from 'boot/axios'
import { landingVideoSource } from 'src/services/landingVideoSources'

const videos = shallowRef({})
let loadedAt = 0
let pending

function refresh() {
  if (pending || Date.now() - loadedAt < 30_000) return
  pending = api.get('/public/landing-videos', { withCredentials: false, timeout: 6000 }).then(({ data }) => {
    videos.value = data?.data?.videos || {}
    loadedAt = Date.now()
  }).catch(() => undefined).finally(() => { pending = undefined })
}

export function useLandingVideo(slot, fallback) {
  onMounted(refresh)
  return computed(() => landingVideoSource(videos.value, toValue(slot), toValue(fallback)))
}
