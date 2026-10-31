import { reactive, ref } from 'vue'

export const ASSISTANT_ATTACHMENT_LIMIT = 8
const IMAGE_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

export function assistantClipboardFiles(data) {
  const items = Array.from(data?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile?.()).filter(Boolean)
  const files = items.length ? items : Array.from(data?.files || [])
  return files.map((file, index) => {
    const extension = IMAGE_EXTENSIONS[file.type]
    // Some browsers expose pasted screenshots as unnamed blobs rather than image.png.
    if (extension && !/\.[a-z0-9]{1,8}$/i.test(file.name || '')) return new File([file], `print-${index + 1}.${extension}`, { type: file.type, lastModified: file.lastModified })
    return file
  })
}

// One sequential queue is shared by selection, drop and paste, including overlapping pastes.
export function createAssistantAttachmentQueue({ upload, validate, max = ASSISTANT_ATTACHMENT_LIMIT }) {
  const files = ref([]), uploading = ref(false), error = ref('')
  const progress = reactive({ completed: 0, total: 0 })
  const queue = []
  let active = null, disposed = false, work, generation = 0
  const revoke = file => { if (file.previewUrl) URL.revokeObjectURL(file.previewUrl) }
  function report(message) { error.value = [error.value, message].filter(Boolean).join('\n') }
  function preview(file, saved) {
    if (!/^image\//.test(saved.mimeType || file.type || '')) return ''
    try { return URL.createObjectURL(file) } catch { return '' }
  }
  async function drain() {
    while (queue.length && !disposed) {
      const job = queue.shift()
      active = job
      try {
        const saved = await upload(job.file)
        if (!disposed && job.generation === generation) files.value.push({ ...saved, previewUrl: preview(job.file, saved) })
      } catch (cause) {
        if (!disposed && job.generation === generation) report(`${job.file.name}: ${cause?.response?.data?.message || cause?.message || 'Não foi possível anexar. Tente novamente.'}`)
      } finally {
        if (job.generation === generation) progress.completed++
        active = null
      }
    }
  }
  function enqueue(input) {
    if (disposed) return Promise.resolve()
    if (!work) { error.value = ''; progress.completed = 0; progress.total = 0 }
    const incoming = Array.from(input || [])
    if (!incoming.length) return work || Promise.resolve()
    for (const file of incoming) {
      if (files.value.length + queue.length + Number(active?.generation === generation) >= max) {
        report(`Anexe até ${max} arquivos por mensagem. Os arquivos excedentes não foram adicionados.`)
        break
      }
      const reason = validate(file)
      if (reason) { report(`${file.name}: ${reason}`); continue }
      queue.push({ file, generation })
      progress.total++
    }
    if (queue.length && !work) {
      uploading.value = true
      // Set work before invoking upload, which may throw synchronously.
      work = Promise.resolve().then(drain).finally(() => { uploading.value = false; work = undefined })
    }
    return work || Promise.resolve()
  }
  function remove(id) {
    files.value.filter(file => file.id === id).forEach(revoke)
    files.value = files.value.filter(file => file.id !== id)
  }
  function clear() {
    generation++
    queue.length = 0
    files.value.forEach(revoke)
    files.value = []
    error.value = ''
    progress.completed = 0
    progress.total = 0
  }
  function dispose() { disposed = true; clear() }
  return { files, uploading, error, progress, enqueue, remove, clear, dispose }
}
