import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
let loading, state
const settle = async () => { await vi.advanceTimersByTimeAsync(40) }
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 16))
  vi.stubGlobal('cancelAnimationFrame', timer => clearTimeout(timer))
  vi.resetModules()
  loading = await import('../src/services/route-loading.js')
  state = loading.useRouteLoading()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('SPA loading lifecycle', () => {
  it('covers initial authentication until rendered frames', async () => {
    expect(state.visible.value).toBe(true)
    const done = loading.finishRouteLoading(loading.beginRouteLoading())
    expect(state.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(16)
    expect(state.visible.value).toBe(true)
    await settle(); await done
    expect(state.active.value).toBe(false); expect(state.visible.value).toBe(false)
  })
  it('does not flash for a cached route but reveals slow routes', async () => {
    const boot = loading.finishRouteLoading(loading.beginRouteLoading()); await settle(); await boot
    const fast = loading.finishRouteLoading(loading.beginRouteLoading()); await settle(); await fast
    await vi.advanceTimersByTimeAsync(160); expect(state.visible.value).toBe(false)
    const slow = loading.beginRouteLoading('Abrindo suas conversas…')
    await vi.advanceTimersByTimeAsync(119); expect(state.visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1); expect(state.visible.value).toBe(true)
    expect(state.label.value).toBe('Abrindo suas conversas…')
    loading.failRouteLoading(slow); expect(state.visible.value).toBe(false)
  })
  it('keeps the newer navigation when an earlier completion arrives late', async () => {
    const first = loading.beginRouteLoading('Primeira tela'), stale = loading.finishRouteLoading(first)
    const second = loading.beginRouteLoading('Segunda tela')
    await settle(); await stale
    expect(state.active.value).toBe(true); expect(state.label.value).toBe('Segunda tela')
    loading.failRouteLoading(first); expect(state.visible.value).toBe(true)
    loading.failRouteLoading(second); expect(state.active.value).toBe(false)
  })
  it('waits for lazy inbox imports after the route is ready', async () => {
    const route = loading.beginRouteLoading(); let resolveInbox
    const inbox = loading.withScreenLoading(() => new Promise(resolve => { resolveInbox = resolve }), 'Abrindo suas conversas…')()
    await Promise.resolve()
    const done = loading.finishRouteLoading(route); await settle(); await done
    expect(state.active.value).toBe(true)
    resolveInbox({ default: 'Inbox' }); expect(await inbox).toEqual({ default: 'Inbox' })
    expect(state.visible.value).toBe(true); await settle(); expect(state.visible.value).toBe(false)
  })
  it('releases failed imports and synchronous loader exceptions', async () => {
    const ready = loading.finishRouteLoading(loading.beginRouteLoading()); await settle(); await ready
    await expect(loading.withScreenLoading(() => { throw new Error('chunk unavailable') })()).rejects.toThrow('chunk unavailable')
    await settle(); expect(state.active.value).toBe(false); expect(state.visible.value).toBe(false)
  })
  it('supersedes unfinished imports when redirecting elsewhere', async () => {
    loading.beginRouteLoading('Tela anterior')
    expect(loading.withScreenLoading(() => new Promise(() => {}))()).toBeInstanceOf(Promise)
    const done = loading.finishRouteLoading(loading.beginRouteLoading('Login'))
    await settle(); await done; expect(state.active.value).toBe(false)
  })
  it('finishes when requestAnimationFrame is paused in a background tab', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    const done = loading.finishRouteLoading(loading.beginRouteLoading())
    await vi.advanceTimersByTimeAsync(170); await done; expect(state.visible.value).toBe(false)
  })
  it('cleans aborted and rejected routes through router hooks', () => {
    let before, after, error
    loading.installRouteLoading({ beforeEach: fn => { before = fn }, afterEach: fn => { after = fn }, onError: fn => { error = fn } })
    error(new Error('initial navigation failed'), {}); expect(state.visible.value).toBe(false)
    const to = {}; before(to); expect(state.active.value).toBe(true)
    after(to, {}, new Error('aborted')); expect(state.visible.value).toBe(false)
    const next = {}; before(next); error(new Error('bad chunk'), next); expect(state.active.value).toBe(false)
    before({}); error(new Error('guard failed')); expect(state.active.value).toBe(false)
  })
})
