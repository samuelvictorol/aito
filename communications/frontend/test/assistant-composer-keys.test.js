import { describe, expect, it, vi } from 'vitest'
import { createAssistantComposerKeys } from '../src/services/assistant-composer-keys.js'

const event = (timeStamp, options = {}) => ({ key: 'Enter', timeStamp, preventDefault: vi.fn(), ...options })

describe('assistant composer keyboard', () => {
  it('keeps a single Enter as a newline and sends on a second quick Enter', () => {
    const send = vi.fn(), keys = createAssistantComposerKeys(send)
    const first = event(10), second = event(195)
    keys.keydown(first)
    expect(first.preventDefault).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    keys.keydown(second)
    expect(second.preventDefault).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()
  })

  it('sends immediately with Ctrl+Enter but not with IME, held keys, or separate paragraphs', () => {
    const send = vi.fn(), keys = createAssistantComposerKeys(send)
    for (const input of [
      event(10), event(440), event(460, { repeat: true }),
      event(480, { isComposing: true, ctrlKey: true }), event(550),
      event(560, { key: 'x' }), event(570), event(580, { shiftKey: true }), event(590),
    ]) {
      keys.keydown(input)
      expect(input.preventDefault).not.toHaveBeenCalled()
    }
    expect(send).not.toHaveBeenCalled()
    const shortcut = event(620, { ctrlKey: true })
    keys.keydown(shortcut)
    expect(shortcut.preventDefault).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()
  })
})
