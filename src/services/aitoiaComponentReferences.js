const renamed = new WeakMap()
const inferred = new WeakMap()
export const MAX_COMPONENT_FILES = 10

const extensions = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
}

export function filesForComponent(component) {
  const source = Array.isArray(component?.files) && component.files.length ? component.files : component?.file ? [component.file] : []
  return [...new Set(source.filter(file => file instanceof Blob))]
}

export function componentFileName(title, file, index = 0, total = 1) {
  const original = typeof file?.name === 'string' ? file.name : ''
  const extension = extensions[file?.type] || /\.([a-z\d]{1,8})$/i.exec(original)?.[1]?.toLowerCase() || 'bin'
  const name = String(title || 'Componente').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 95) || 'Componente'
  return `${name}${total > 1 ? `-${index + 1}` : ''}.${extension}`
}

export function renameComponentFile(file, title, index = 0, total = 1) {
  if (!(file instanceof Blob)) return null
  const name = componentFileName(title, file, index, total)
  if (file.name === name) return file
  let cache = renamed.get(file)
  if (!cache) { cache = new Map(); renamed.set(file, cache) }
  if (!cache.has(name)) cache.set(name, new File([file], name, { type: file.type,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : Date.now() }))
  return cache.get(name)
}

export function normalizeComponent(component, { rename = true } = {}) {
  const source = filesForComponent(component).slice(0, MAX_COMPONENT_FILES).map(file => {
    if (file.type && file.type !== 'application/octet-stream') return file
    const extension = /\.([a-z\d]+)$/i.exec(file.name || '')?.[1]?.toLowerCase()
    const mime = extension === 'jpeg' ? 'image/jpeg' : Object.entries(extensions).find(([, value]) => value === extension)?.[0]
    if (!mime) return file
    if (!inferred.has(file)) inferred.set(file, new File([file], file.name, { type: mime, lastModified: file.lastModified }))
    return inferred.get(file)
  })
  const files = rename ? source.map((file, index) => renameComponentFile(file, component?.title, index, source.length)) : source
  return { ...component, files, file: files[0] || null }
}

export function componentReferenceEntries(components, ids) {
  const selected = ids == null ? null : new Set(ids)
  return (components || []).filter(component => !selected || selected.has(component.id)).flatMap(component => {
    const files = filesForComponent(component)
    return files.map((file, index) => ({ componentId: component.id, title: component.title || 'Componente',
      type: component.type || '', file: renameComponentFile(file, component.title, index, files.length), index }))
  })
}

export function componentReferenceFiles(components, ids) {
  return componentReferenceEntries(components, ids).map(item => item.file)
}

export function componentMentionLabel(component) {
  return '@' + String(component?.title || 'Componente').replace(/[\r\n\t]/g, ' ').trim()
}

export function hasComponentMention(text, component) {
  const value = String(text || ''), label = componentMentionLabel(component)
  let offset = value.indexOf(label)
  while (offset !== -1) {
    if (!/[\p{L}\p{N}_]/u.test(value[offset + label.length] || '')) return true
    offset = value.indexOf(label, offset + label.length)
  }
  return false
}

// Selected IDs are the authority when two objects have the same visible name.
export function referencedComponentIds(text, components, selectedIds = []) {
  const selected = new Set(selectedIds)
  return (components || []).filter(component => selected.has(component.id) && hasComponentMention(text, component)).map(component => component.id)
}
