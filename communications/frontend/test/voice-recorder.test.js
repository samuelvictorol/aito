import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVoiceRecorder } from '../src/services/voice-recorder.js'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('gravação de voz', () => {
  it('libera o microfone e descarta uma permissão que chegou depois da troca de conversa', async () => {
    let resolve
    const stop = vi.fn(), file = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(done => { resolve = done }) } })
    vi.stubGlobal('MediaRecorder', class {})
    const voice = useVoiceRecorder(file, vi.fn())
    const pending = voice.start(); voice.cancel()
    resolve({ getTracks: () => [{ stop }] }); await pending
    expect(stop).toHaveBeenCalledOnce(); expect(file).not.toHaveBeenCalled(); expect(voice.recording.value).toBe(false)
  })
  it('concluir produz um anexo para revisão; descartar nunca envia arquivo', async () => {
    vi.useFakeTimers()
    const stop = vi.fn(), file = vi.fn(), error = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } })
    vi.stubGlobal('MediaRecorder', class {
      static isTypeSupported(type) { return type === 'audio/mp4' }
      constructor(stream, options) { this.mimeType = options.mimeType }
      start() { this.state = 'recording' }
      stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['voice']) }); this.onstop() }
    })
    const voice = useVoiceRecorder(file, error)
    await voice.start(); vi.advanceTimersByTime(2000); expect(voice.seconds.value).toBe(2)
    voice.stop(); expect(file).toHaveBeenCalledOnce(); expect(file.mock.calls[0][0].type).toBe('audio/mp4')
    expect(voice.recording.value).toBe(false); expect(stop).toHaveBeenCalled()
    await voice.start(); voice.cancel(); expect(file).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled()
  })
})
