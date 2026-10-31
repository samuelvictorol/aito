import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../src/services/http.js', () => ({ http: api, unwrap: response => response.data.data }))
let service, mono
beforeEach(async () => { vi.resetModules(); vi.useFakeTimers(); mono=0; vi.spyOn(performance,'now').mockImplementation(()=>mono); service=await import('../src/services/product-license.js'); api.get.mockReset(); api.post.mockReset() })
afterEach(() => { service.stopLicenseMonitor(); vi.useRealTimers(); vi.restoreAllMocks() })
it('fails closed before validation, uses authoritative duration and resumes without clearing a session', async () => {
  const license=service.useProductLicense(); expect(license.allowed.value).toBe(false)
  api.get.mockResolvedValue({data:{data:{active:true,permanent:false,expiresAt:'2030-01-01T00:00:00Z',remainingSeconds:1}}})
  service.startLicenseMonitor();await service.refreshProductLicense();expect(license.allowed.value).toBe(true)
  mono=1100;await vi.advanceTimersByTimeAsync(250)
  expect(license.allowed.value).toBe(false)
  api.get.mockResolvedValue({data:{data:{active:true,permanent:true,remainingSeconds:null}}})
  await service.refreshProductLicense();expect(license.allowed.value).toBe(true);expect(license.remaining.value).toBe(null)
  api.get.mockRejectedValue(new Error('offline'));await service.refreshProductLicense();expect(license.allowed.value).toBe(false)
})
