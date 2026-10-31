import { computed, reactive } from 'vue'
import { http, unwrap } from './http.js'
const state = reactive({ active: false, loading: true, permanent: false, expiresAt: null, remainingSeconds: null, reason: 'unverified', message: 'Validando a licença desta instalação.', sampled: 0, now: 0 })
let polling, clock, pending
export function acceptLicense(value) {
  const data = value?.data || value || {}
  Object.assign(state, data, { active: data.active === true, loading: false, sampled: performance.now(), now: performance.now() })
}
export async function refreshProductLicense(force = false) {
  if (pending) return pending
  pending = (force ? http.post('/license/refresh') : http.get('/license/status'))
    .then(response => acceptLicense(unwrap(response)))
    .catch(() => { state.active = false; state.loading = false; state.message = 'Não foi possível validar o acesso. Verifique sua conexão; tentaremos novamente automaticamente.' })
    .finally(() => { pending = null })
  return pending
}
export function startLicenseMonitor() {
  if (polling) return
  void refreshProductLicense()
  polling = setInterval(() => { void refreshProductLicense() }, 5000)
  clock = setInterval(() => { state.now = performance.now() }, 250)
}
export function stopLicenseMonitor() { clearInterval(polling); clearInterval(clock); polling = clock = null }
export function useProductLicense() {
  const remaining = computed(() => state.permanent ? null : Math.max(0, Number(state.remainingSeconds || 0) - (state.now - state.sampled) / 1000))
  return { state, remaining, allowed: computed(() => state.active && (state.permanent || remaining.value > 0)), refresh: refreshProductLicense }
}
