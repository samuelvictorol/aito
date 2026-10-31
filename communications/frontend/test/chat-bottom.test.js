import { afterEach, describe, expect, it, vi } from 'vitest'
import { anchorChatBottom } from '../src/services/chat-bottom.js'

afterEach(() => vi.unstubAllGlobals())
describe('ancoragem na mensagem mais recente', () => {
  it('acompanha mídia e layout tardios, preserva leitura antiga e reinicia ao trocar o chat', () => {
    let mutation, resize, queued
    const listeners = {}
    vi.stubGlobal('requestAnimationFrame', callback => { queued = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('MutationObserver', class { constructor(callback) { mutation = callback } observe() {} disconnect() {} })
    vi.stubGlobal('ResizeObserver', class { constructor(callback) { resize = callback } observe() {} disconnect() {} })
    const element = { scrollTop: 0, scrollHeight: 800, clientHeight: 300, children: [],
      addEventListener(event, handler) { listeners[event] = handler }, removeEventListener: vi.fn() }
    const flush = () => { const callback = queued; queued = null; callback?.() }
    const anchor = anchorChatBottom(element)
    flush(); expect(element.scrollTop).toBe(800)
    element.scrollHeight = 1400; resize(); flush(); expect(element.scrollTop).toBe(1400)
    element.scrollTop = 100; listeners.scroll()
    element.scrollHeight = 1800; mutation(); flush(); expect(element.scrollTop).toBe(100)
    anchor.reset(); flush(); expect(element.scrollTop).toBe(1800)
    anchor.destroy(); element.scrollHeight = 2000; resize(); flush(); expect(element.scrollTop).toBe(1800)
    expect(element.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
