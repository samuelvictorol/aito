import { prepareMarketingReference, readMarketingImage } from './aitoiaMarketingLocal.js'

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
}

function filename(title, extension) {
  const base = title.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 100) || 'Documento AitoIA'
  return base.toLowerCase().endsWith('.' + extension) ? base : `${base}.${extension}`
}

function documentLines(content) {
  return content.split(/\r?\n/).map(line => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    return { level: heading?.[1].length || 0, text: heading ? heading[2] : line }
  })
}

async function pdf(title, lines) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({ title })
  const width = doc.internal.pageSize.getWidth() - 36
  const bottom = doc.internal.pageSize.getHeight() - 18
  let y = 21
  for (const row of [{ text: title, level: 1 }, ...lines]) {
    const size = row.level === 1 ? 16 : row.level ? 13 : 10.5
    const height = size * 0.44
    doc.setFont('helvetica', row.level ? 'bold' : 'normal')
    doc.setFontSize(size)
    for (const line of doc.splitTextToSize(row.text || ' ', width)) {
      if (y > bottom) { doc.addPage(); y = 21 }
      doc.text(line, 18, y)
      y += height
    }
    if (row.level) y += 2
  }
  return doc.output('blob')
}

async function word(title, lines) {
  const { Document, HeadingLevel, Packer, Paragraph } = await import('docx')
  const children = [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), ...lines.map(({ text, level }) => new Paragraph({
    text, ...(level && { heading: HeadingLevel['HEADING_' + level] }),
  }))]
  return Packer.toBlob(new Document({ title, sections: [{ children }] }))
}

export async function fileFromArtifact({ format, title, content }) {
  const type = MIME[format]
  if (!type || typeof title !== 'string' || typeof content !== 'string') throw new Error('A resposta não contém um arquivo válido.')
  if (format === 'json') JSON.parse(content)
  const blob = format === 'pdf' ? await pdf(title, documentLines(content))
    : format === 'docx' ? await word(title, documentLines(content))
      : new Blob([...(format === 'csv' ? ['\uFEFF'] : []), content], { type })
  return { id: crypto.randomUUID(), name: filename(title, format), type, blob }
}

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function artifactReferences(messages) {
  const recent = [...messages].reverse().find(message => message.attachments?.some(file => imageTypes.has(file.type)))
  return recent?.attachments.filter(file => imageTypes.has(file.type)).slice(0, 4) || []
}

export async function prepareArtifactReferences(files) {
  return Promise.all(files.map(async file => readMarketingImage(await prepareMarketingReference(file.blob, 768 * 1024))))
}

export function fileFromImage(image) {
  if (!imageTypes.has(image?.mimeType) || typeof image.data !== 'string' || !image.data) throw new Error('A geração não retornou uma imagem válida.')
  const bytes = Uint8Array.from(atob(image.data), character => character.charCodeAt(0))
  return { id: crypto.randomUUID(), name: `aitoia-imagem.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.mimeType]}`,
    type: image.mimeType, blob: new Blob([bytes], { type: image.mimeType }) }
}
