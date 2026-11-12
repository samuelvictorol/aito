const MAX_FILE_BYTES = 3 * 1024 * 1024 - 64
export const MAX_ATTACHMENTS = 4
export const MAX_ATTACHMENT_BYTES = 4.5 * 1024 * 1024
export const MAX_PROMPT_LENGTH = 120000
const MAX_TEXT_FILE = 96000
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|jsonl|js|jsx|mjs|cjs|ts|tsx|py|html|css|scss|sql|xml|yaml|yml|toml|log|ini|sh|ps1|java|c|cpp|h|rb|rs|go|php|svelte|vue)$/i

export function fileKind(file) {
  if (IMAGE_MIMES.has(file.type)) return 'image'
  if (file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name || ''))) return 'pdf'
  if (file.type?.startsWith('text/') || TEXT_EXTENSIONS.test(file.name || '')) return 'text'
  return null
}

export function checkAttachment(file) {
  const kind = fileKind(file)
  if (!kind) return 'Use imagens PNG, JPEG, WebP ou GIF, PDF, texto ou código.'
  if (!file.size) return 'O arquivo está vazio.'
  if (kind === 'text' && file.size > MAX_TEXT_FILE) return 'Arquivos de texto ou código podem ter até 96 KB.'
  if (file.size > MAX_FILE_BYTES) return 'Imagens e PDFs podem ter até 3 MB por arquivo.'
  return ''
}

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(blob)
  })
}

async function attachmentPart(attachment) {
  const blob = attachment.blob
  const kind = fileKind({ name: attachment.name, type: attachment.type || blob.type })
  if (kind === 'text') {
    const content = await blob.text()
    return { type: 'input_text', text: 'Arquivo anexado: ' + attachment.name + '\n\n' + content.slice(0, MAX_TEXT_FILE) }
  }
  const mime = kind === 'pdf' ? 'application/pdf' : attachment.type || blob.type
  const value = await dataUrl(blob.type === mime ? blob : blob.slice(0, blob.size, mime))
  if (kind === 'image') return { type: 'input_image', image_url: value }
  if (kind === 'pdf') return { type: 'input_file', filename: attachment.name, file_data: value }
  throw new Error('Formato de arquivo indisponível neste chat.')
}

export async function requestMessages(messages) {
  let remainingParts = 6
  let remainingBytes = MAX_ATTACHMENT_BYTES
  let remainingCharacters = 350000
  let shortened = messages.length > 100
  const selected = []
  for (const message of messages.slice(-100).reverse()) {
    const text = String(message.text || '')
    const content = []
    if (text && text.length <= remainingCharacters) {
      const safeText = text.slice(0, MAX_PROMPT_LENGTH)
      shortened ||= text.length !== safeText.length
      remainingCharacters -= safeText.length
      content.push({ type: 'input_text', text: safeText })
    } else if (text) {
      shortened = true
      break
    }
    for (const attachment of message.attachments || []) {
      const blob = attachment.blob
      if (!(blob instanceof Blob) || blob.size > remainingBytes || remainingParts <= 0 || blob.size > remainingCharacters && fileKind(attachment) === 'text') {
        shortened = true
        continue
      }
      const part = await attachmentPart(attachment)
      if (part.type === 'input_text' && part.text.length > remainingCharacters) {
        shortened = true
        continue
      }
      remainingBytes -= blob.size
      remainingParts--
      if (part.type === 'input_text') remainingCharacters -= part.text.length
      content.push(part)
    }
    if (content.length) selected.push({ role: message.role, content })
  }
  return { input: selected.reverse(), shortened }
}

export function readAnswer(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text
  return (Array.isArray(response?.output) ? response.output : [])
    .filter(item => item.type === 'message')
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .map(part => part.type === 'output_text' ? part.text : part.type === 'refusal' ? part.refusal : '')
    .filter(Boolean).join('\n\n')
}

export function checkoutLink(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && /(^|\.)infinitepay\.(io|com\.br)$/i.test(url.hostname)) return url.href
  } catch { /* The gateway returned no valid checkout URL. */ }
  return ''
}
