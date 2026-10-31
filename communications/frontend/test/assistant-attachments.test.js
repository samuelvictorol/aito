import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assistantClipboardFiles, createAssistantAttachmentQueue } from '../src/services/assistant-attachments.js'
import { assistantAttachmentError } from '../src/services/admin-assistant.js'

const image = name => new File(['image'], name, { type: 'image/png' })
const saved = file => ({ id: file.name, name: file.name, size: file.size, mimeType: file.type, kind: 'image' })
beforeEach(() => { vi.spyOn(URL, 'createObjectURL').mockImplementation(file => 'blob:' + file.name); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('assistant clipboard and attachment batches', () => {
  it('collects every clipboard file once without consuming ordinary text pastes', () => {
    const first = image('first.png'), second = image('second.png')
    expect(assistantClipboardFiles({ items: [{ kind: 'string' }, { kind: 'file', getAsFile: () => first }, { kind: 'file', getAsFile: () => second }], files: [first, second] })).toEqual([first, second])
    expect(assistantClipboardFiles({ items: [{ kind: 'string' }], files: [] })).toEqual([])
    expect(assistantClipboardFiles({ files: [first, second] })).toEqual([first, second])
    expect(assistantClipboardFiles()).toEqual([])
  })
  it('keeps valid files when one selected file is unsupported or its upload fails', async () => {
    const upload = vi.fn(async file => { if (file.name === 'failed.png') throw new Error('Tente novamente'); return saved(file) })
    const queue = createAssistantAttachmentQueue({ upload, validate: assistantAttachmentError })
    await queue.enqueue([image('first.png'), new File(['exe'], 'program.exe'), image('failed.png'), image('last.png')])
    expect(queue.files.value.map(file => file.name)).toEqual(['first.png', 'last.png'])
    expect(upload).toHaveBeenCalledTimes(3)
    expect(queue.error.value).toContain('program.exe'); expect(queue.error.value).toContain('failed.png: Tente novamente')
    expect(queue.progress).toEqual({ completed: 3, total: 3 }); expect(queue.uploading.value).toBe(false)
    queue.dispose()
  })
  it('queues overlapping pastes and caps the combined message at eight files', async () => {
    let release
    const upload = vi.fn(file => upload.mock.calls.length === 1 ? new Promise(resolve => { release = () => resolve(saved(file)) }) : Promise.resolve(saved(file)))
    const queue = createAssistantAttachmentQueue({ upload, validate: assistantAttachmentError })
    const initial = queue.enqueue(Array.from({ length: 6 }, (_, i) => image(i + '.png')))
    const more = queue.enqueue([image('six.png'), image('seven.png')])
    void queue.enqueue([image('excess.png')])
    expect(queue.uploading.value).toBe(true); expect(queue.progress.total).toBe(8)
    await Promise.resolve(); release(); await Promise.all([initial, more])
    expect(upload).toHaveBeenCalledTimes(8); expect(queue.files.value).toHaveLength(8)
    expect(queue.error.value).toContain('até 8 arquivos')
    queue.remove('0.png'); await queue.enqueue([image('replacement.png')])
    expect(queue.files.value).toHaveLength(8); expect(queue.files.value.at(-1).name).toBe('replacement.png')
    queue.dispose()
  })
  it('releases local previews on removal and clearing, and ignores uploads completed after unmount', async () => {
    const queue = createAssistantAttachmentQueue({ upload: async file => saved(file), validate: assistantAttachmentError })
    await queue.enqueue([image('first.png'), image('second.png')])
    expect(queue.files.value[0].previewUrl).toBe('blob:first.png')
    queue.remove('first.png'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first.png')
    queue.clear(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second.png'); expect(queue.files.value).toEqual([])
    let release
    const pending = createAssistantAttachmentQueue({ upload: file => new Promise(resolve => { release = () => resolve(saved(file)) }), validate: assistantAttachmentError })
    const job = pending.enqueue([image('late.png'), image('never-uploaded.png')])
    await Promise.resolve(); pending.dispose(); release(); await job
    expect(pending.files.value).toEqual([]); expect(URL.createObjectURL).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'late.png' }))
  })
  it('accepts unnamed clipboard screenshots with the MIME-based image extension', () => {
    const screenshot = new File(['image'], '', { type: 'image/png' })
    const [file] = assistantClipboardFiles({ items: [{ kind: 'file', getAsFile: () => screenshot }] })
    expect(file.name).toBe('print-1.png'); expect(file.type).toBe('image/png'); expect(file.size).toBe(screenshot.size)
    expect(assistantAttachmentError(file)).toBe('')
  })
  it('continues after a synchronous upload failure and can start another batch', async () => {
    const upload = vi.fn(file => { if (file.name === 'failed.png') throw new Error('Falhou'); return saved(file) })
    const queue = createAssistantAttachmentQueue({ upload, validate: assistantAttachmentError })
    await queue.enqueue([image('failed.png')]); expect(queue.error.value).toContain('Falhou')
    await queue.enqueue([image('success.png')]); expect(queue.files.value.map(file => file.name)).toEqual(['success.png'])
    expect(queue.uploading.value).toBe(false); queue.dispose()
  })
  it('keeps validation warnings during overlapping pastes and discards a cleared upload', async () => {
    let release
    const queue = createAssistantAttachmentQueue({ upload: file => new Promise(resolve => { release = () => resolve(saved(file)) }), validate: assistantAttachmentError })
    const work = queue.enqueue([image('pending.png'), new File(['exe'], 'program.exe')]); await Promise.resolve()
    void queue.enqueue([image('queued.png')]); expect(queue.error.value).toContain('program.exe')
    queue.clear(); release(); await work
    expect(queue.files.value).toEqual([]); expect(queue.progress).toEqual({ completed: 0, total: 0 })
    expect(URL.createObjectURL).not.toHaveBeenCalled(); queue.dispose()
  })

})
