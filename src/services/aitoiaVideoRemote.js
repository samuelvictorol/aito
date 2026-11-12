const MAX_CLIP_BYTES = 60 * 1024 * 1024
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_REFERENCE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export function safeVideoUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Endereço de vídeo inválido.')
  return url.href
}

export function checkVideoReference(file) {
  if (!file || !file.size || file.size > MAX_CLIP_BYTES || (file.type !== 'video/mp4' && (file.type || !/\.mp4$/i.test(file.name)))) {
    throw new Error('Escolha um arquivo MP4 de até 60 MB.')
  }
  return 'video/mp4'
}

export function checkImageReference(file) {
  const extension = String(file?.name || '').match(/\.(jpe?g|png|webp)$/i)?.[1].toLowerCase()
  const contentType = file?.type || IMAGE_REFERENCE_TYPES[extension]
  if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_REFERENCE_IMAGE_BYTES ||
    !Object.values(IMAGE_REFERENCE_TYPES).includes(contentType)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.')
  return contentType
}

async function putReference(file, contentType, ticket, signal) {
  const headers = new Headers(ticket?.uploadHeaders)
  if (typeof ticket?.referenceToken !== 'string' || !ticket.referenceToken || headers.get('content-type') !== contentType ||
    [...headers.keys()].some(name => !/^(content-type|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)$/.test(name))) {
    throw new Error('O provedor não autorizou o envio deste arquivo de referência.')
  }
  const response = await fetch(safeVideoUrl(ticket.uploadUrl), { method: 'PUT', headers,
    body: file, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new Error('O provedor não recebeu o arquivo de referência.')
  return ticket.referenceToken
}

export async function putVideoReference(file, ticket, signal) {
  return putReference(file, checkVideoReference(file), ticket, signal)
}

export async function putImageReference(file, ticket, signal) {
  return putReference(file, checkImageReference(file), ticket, signal)
}

export async function readGeneratedClip(url, signal) {
  const response = await fetch(safeVideoUrl(url), { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim()
  if (!response.ok || !response.body || !type.startsWith('video/')) throw new Error('Abra o clipe no provedor para baixar o arquivo.')
  const reader = response.body.getReader()
  const parts = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_CLIP_BYTES) throw new Error('O clipe excede 60 MB. Abra o arquivo no provedor para baixá-lo.')
      parts.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  if (!total) throw new Error('O provedor retornou um arquivo vazio.')
  const extension = type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4'
  return new File(parts, `clipe-aitoia.${extension}`, { type })
}

function mediaEvent(media, name, signal, start) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const timer = setTimeout(failed, 10000)
    const ready = () => finish(resolve)
    const canceled = () => finish(reject, signal.reason)
    function failed() { finish(reject, new Error('O navegador não conseguiu ler os quadros deste vídeo.')) }
    function finish(callback, value) {
      clearTimeout(timer)
      media.removeEventListener(name, ready)
      media.removeEventListener('error', failed)
      signal.removeEventListener('abort', canceled)
      callback(value)
    }
    media.addEventListener(name, ready, { once: true })
    media.addEventListener('error', failed, { once: true })
    signal.addEventListener('abort', canceled, { once: true })
    try { start() } catch (error) { finish(reject, error) }
  })
}

export async function sampleVideoFrames(file, signal) {
  checkVideoReference(file)
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  try {
    await mediaEvent(video, 'loadeddata', signal, () => { video.src = url })
    if (!Number.isFinite(video.duration) || !video.duration || !video.videoWidth || !video.videoHeight) throw new Error('O vídeo precisa ter imagem e duração válidas.')
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não disponibilizou leitura de vídeo.')
    const frames = []
    for (const fraction of [0.08, 0.34, 0.62, 0.88]) {
      const second = video.duration * fraction
      await mediaEvent(video, 'seeked', signal, () => { video.currentTime = second })
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({ second: second.toFixed(1), url: canvas.toDataURL('image/jpeg', .72) })
    }
    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
