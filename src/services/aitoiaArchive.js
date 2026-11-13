const encoder = new TextEncoder()
const ZIP_LIMIT = 0xffffffff
const ZIP_ENTRIES = 0xffff
const UTF8 = 0x0800

const crcTable = new Uint32Array(256)
for (let value = 0; value < crcTable.length; value++) {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  crcTable[value] = crc
}

async function checksum(blob) {
  const reader = blob.stream().getReader()
  let crc = 0xffffffff
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return (crc ^ 0xffffffff) >>> 0
      for (const byte of value) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
    }
  } finally {
    reader.releaseLock()
  }
}

function safeFileName(value) {
  return String(value || '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 120) || 'anexo'
}

function toExport(conversations, includeFiles) {
  const list = Array.isArray(conversations) ? conversations : conversations ? [conversations] : []
  const files = []
  const rows = list.map((conversation, conversationIndex) => {
    const { accountId, messages = [], ...metadata } = conversation
    return { ...metadata, messages: messages.map((message, messageIndex) => {
      const { attachments = [], ...fields } = message
      const exported = attachments.map((attachment, attachmentIndex) => {
        const { id, name, type, size, blob } = attachment
        let file
        if (includeFiles && blob instanceof Blob) {
          file = `conversas/${conversationIndex + 1}/anexos/${messageIndex + 1}-${attachmentIndex + 1}-${safeFileName(name)}`
          files.push({ name: file, blob })
        }
        return { id, name, type: type || blob?.type || 'application/octet-stream', size: blob?.size ?? size ?? 0, ...(file && { file }) }
      })
      return { ...fields, ...(exported.length && { attachments: exported }) }
    }) }
  })
  const metadata = new Blob([JSON.stringify({ format: 'aitoia-historico', version: 1,
    exportedAt: new Date().toISOString(), conversations: rows }, null, 2)], { type: 'application/json;charset=utf-8' })
  return { metadata, files }
}

function zipHeader(size, signature) {
  const buffer = new ArrayBuffer(size)
  const data = new DataView(buffer)
  data.setUint32(0, signature, true)
  return { buffer, data }
}

function localHeader(entry) {
  const { buffer, data } = zipHeader(30, 0x04034b50)
  data.setUint16(4, 20, true)
  data.setUint16(6, UTF8, true)
  data.setUint16(12, 33, true) // 1980-01-01 (DOS date format)
  data.setUint32(14, entry.crc, true)
  data.setUint32(18, entry.size, true)
  data.setUint32(22, entry.size, true)
  data.setUint16(26, entry.name.length, true)
  return buffer
}

function directoryHeader(entry) {
  const { buffer, data } = zipHeader(46, 0x02014b50)
  data.setUint16(4, 20, true)
  data.setUint16(6, 20, true)
  data.setUint16(8, UTF8, true)
  data.setUint16(14, 33, true)
  data.setUint32(16, entry.crc, true)
  data.setUint32(20, entry.size, true)
  data.setUint32(24, entry.size, true)
  data.setUint16(28, entry.name.length, true)
  data.setUint32(42, entry.offset, true)
  return buffer
}

function endOfDirectory(count, size, offset) {
  const { buffer, data } = zipHeader(22, 0x06054b50)
  data.setUint16(8, count, true)
  data.setUint16(10, count, true)
  data.setUint32(12, size, true)
  data.setUint32(16, offset, true)
  return buffer
}

export function exportAitoIAJson(conversations) {
  return toExport(conversations, false).metadata
}

export async function zipAitoIAFiles(files) {
  const entries = files.map(({ name, blob }) => ({
    name: encoder.encode(name), blob, size: blob.size,
  }))
  const size = entries.reduce((total, entry) => total + entry.size + 76 + entry.name.length * 2, 22)
  if (entries.length >= ZIP_ENTRIES || size >= ZIP_LIMIT) throw new Error('Exportação muito grande. Baixe as conversas em partes.')
  const contents = []
  const directory = []
  let offset = 0
  let directorySize = 0
  for (const entry of entries) {
    entry.crc = await checksum(entry.blob)
    entry.offset = offset
    contents.push(localHeader(entry), entry.name, entry.blob)
    directory.push(directoryHeader(entry), entry.name)
    offset += 30 + entry.name.length + entry.size
    directorySize += 46 + entry.name.length
  }
  return new Blob([...contents, ...directory, endOfDirectory(entries.length, directorySize, offset)], { type: 'application/zip' })
}

export async function readAitoProjectZip(blob) {
  const invalid = () => new Error('Selecione um ZIP de projeto exportado pela AitoSoftwares. O arquivo está inválido ou incompleto.')
  if (!blob || blob.size < 22 || blob.size > 256 * 1024 * 1024) throw invalid()
  const view = async (start, end) => new DataView(await blob.slice(start, end).arrayBuffer())
  const end = await view(-22)
  const count = end.getUint16(10, true)
  const size = end.getUint32(12, true)
  const offset = end.getUint32(16, true)
  if (end.getUint32(0, true) !== 0x06054b50 || end.getUint32(4, true) || end.getUint16(20, true) ||
      end.getUint16(8, true) !== count || !count || count > 402 || size > 256 * 1024 || offset + size + 22 !== blob.size) throw invalid()
  const directory = await view(offset, offset + size)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const files = new Map()
  let cursor = 0
  let nextOffset = 0
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > size || directory.getUint32(cursor, true) !== 0x02014b50 ||
        directory.getUint16(cursor + 8, true) !== UTF8 || directory.getUint16(cursor + 10, true) ||
        directory.getUint32(cursor + 42, true) !== nextOffset) throw invalid()
    const bytes = directory.getUint32(cursor + 20, true)
    const crc = directory.getUint32(cursor + 16, true)
    const nameSize = directory.getUint16(cursor + 28, true)
    const nameStart = cursor + 46
    if (!nameSize || nameStart + nameSize > size || bytes !== directory.getUint32(cursor + 24, true) ||
        directory.getUint16(cursor + 30, true) || directory.getUint16(cursor + 32, true) || directory.getUint16(cursor + 34, true)) throw invalid()
    const nameBytes = new Uint8Array(directory.buffer, nameStart, nameSize)
    const name = decoder.decode(nameBytes)
    const dataOffset = nextOffset + 30 + nameSize
    if (files.has(name) || /[\\:\x00-\x1f\x7f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..') ||
        dataOffset + bytes > offset) throw invalid()
    const header = await view(nextOffset, dataOffset)
    if (header.getUint32(0, true) !== 0x04034b50 || header.getUint16(6, true) !== UTF8 || header.getUint16(8, true) ||
        header.getUint32(14, true) !== crc || header.getUint32(18, true) !== bytes || header.getUint32(22, true) !== bytes ||
        header.getUint16(26, true) !== nameSize || header.getUint16(28, true) ||
        !nameBytes.every((byte, index) => byte === header.getUint8(30 + index))) throw invalid()
    const file = blob.slice(dataOffset, dataOffset + bytes)
    if (await checksum(file) !== crc) throw invalid()
    files.set(name, file)
    nextOffset = dataOffset + bytes
    cursor = nameStart + nameSize
  }
  if (nextOffset !== offset || cursor !== size) throw invalid()
  return files
}

export async function exportAitoIAZip(conversations) {
  const { metadata, files } = toExport(conversations, true)
  return zipAitoIAFiles([{ name: 'conversas.json', blob: metadata }, ...files])
}

export function downloadAitoIAFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  try {
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export function downloadAitoIAJson(conversations, filename = 'aitoia-conversas.json') {
  downloadAitoIAFile(exportAitoIAJson(conversations), filename)
}

export async function downloadAitoIAZip(conversations, filename = 'aitoia-conversas.zip') {
  downloadAitoIAFile(await exportAitoIAZip(conversations), filename)
}
