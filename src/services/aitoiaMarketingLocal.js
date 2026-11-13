export const marketingFormats = Object.freeze([
  { id: 'feed', label: 'Feed quadrado', width: 1080, height: 1080, icon: 'mdi-square-outline' },
  { id: 'feed-portrait', label: 'Feed vertical', width: 1080, height: 1350, icon: 'mdi-rectangle-outline' },
  { id: 'story', label: 'Story', width: 1080, height: 1920, icon: 'mdi-cellphone' },
  { id: 'reels', label: 'Capa de Reels', width: 1080, height: 1920, icon: 'mdi-movie-open-outline' },
  { id: 'banner', label: 'Banner', width: 1920, height: 1080, icon: 'mdi-panorama-outline' },
])

export function accessMarketingKit(accountId, action, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aitoia-marketing-local', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('kits')
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('O armazenamento local está bloqueado em outra aba.'))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      const write = action === 'write'
      const tx = database.transaction('kits', write ? 'readwrite' : 'readonly')
      const store = tx.objectStore('kits')
      const operation = write ? store.put(value, accountId) : store.get(accountId)
      tx.oncomplete = () => { database.close(); resolve(operation.result) }
      tx.onabort = () => { database.close(); reject(tx.error) }
    }
  })
}

export function readMarketingImage(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve({ mimeType: blob.type, data: reader.result.split(',')[1] })
    reader.readAsDataURL(blob)
  })
}

function encode(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')), mimeType, quality)
  })
}

export async function prepareMarketingReference(file, maxBytes) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error('Use uma imagem JPG, PNG ou WebP de até 12 MB.')
  }
  const bitmap = await createImageBitmap(file)
  try {
    if (file.size <= maxBytes && Math.max(bitmap.width, bitmap.height) <= 1400) return file
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
    const context = canvas.getContext('2d')
    for (const factor of [1, 0.75, 0.5]) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale * factor))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale * factor))
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const image = await encode(canvas, 'image/webp', 0.85)
      if (image.size <= maxBytes) return image
    }
    throw new Error('A imagem ficou acima do limite. Escolha uma referência menor.')
  } finally { bitmap.close() }
}

export async function loadMarketingReferenceUrl(value, maxBytes, signal) {
  let url
  try { url = new URL(value) } catch { throw new Error('Informe um link HTTPS completo para a imagem.') }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !host.includes('.') || /^(?:\[|\d+\.\d+\.\d+\.\d+$)/.test(host) || /\.(?:localhost|local|internal)$/.test(host)) {
    throw new Error('Use uma imagem de um endereço HTTPS público.')
  }
  let response
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
  } catch {
    throw new Error('A imagem não está acessível neste navegador. Confira o endereço ou use o upload.')
  }
  if (!response.ok || !response.body) throw new Error('A imagem não está disponível neste endereço.')
  const type = response.headers.get('Content-Type')?.split(';')[0].trim()
  const limit = 12 * 1024 * 1024
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type) || Number(response.headers.get('Content-Length')) > limit) {
    await response.body.cancel().catch(() => {})
    throw new Error('Use um link direto para uma imagem JPG, PNG ou WebP de até 12 MB.')
  }
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      size += chunk.byteLength
      if (size > limit) throw new Error('A imagem excede 12 MB.')
      chunks.push(chunk)
    }
  } finally { await reader.cancel().catch(() => {}) }
  if (!size) throw new Error('O endereço retornou uma imagem vazia.')
  return prepareMarketingReference(new Blob(chunks, { type }), maxBytes)
}

export async function exportMarketingImage(image, { width, height }) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType) || typeof image.data !== 'string') {
    throw new Error('A geração não retornou uma imagem válida.')
  }
  const original = new Blob([Uint8Array.from(atob(image.data), byte => byte.charCodeAt(0))], { type: image.mimeType })
  const bitmap = await createImageBitmap(original)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const scale = Math.max(width / bitmap.width, height / bitmap.height)
    const scaledWidth = bitmap.width * scale
    const scaledHeight = bitmap.height * scale
    canvas.getContext('2d').drawImage(bitmap, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight)
    return await encode(canvas, 'image/png')
  } finally { bitmap.close() }
}
