import { commonVideoType, prepareCompatibleVideo } from './aitoiaVideoCompatibility.js'
import { isVideoGenerationId } from './aitoiaVideoProjectLinks.js'
const MAX_CLIP_BYTES = 60 * 1024 * 1024
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_REFERENCE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export function safeVideoUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Endereço de vídeo inválido.')
  return url.href
}

export function checkVideoReference(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 1) throw new Error('O arquivo de vídeo está vazio.')
  if (file.size > MAX_CLIP_BYTES) throw new Error('O vídeo excede o limite de 60 MB.')
  return commonVideoType(file)
}

export function normalizeVideoReference(file) {
  const type = checkVideoReference(file)
  return file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified })
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

export async function putVoiceReference(file, ticket, signal) {
  return putReference(file, 'audio/wav', ticket, signal)
}

export async function readGeneratedClip(url, signal) {
  const response = await fetch(safeVideoUrl(url), { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  const size = Number(response.headers.get('Content-Length')) || 0
  if (!response.ok || !response.body || !['video/mp4', 'video/webm', 'video/quicktime', 'application/octet-stream'].includes(type)) throw new Error('Não foi possível ler o arquivo original deste clipe.')
  if (size > MAX_CLIP_BYTES) { await response.body.cancel().catch(() => {}); throw new Error('O clipe excede 60 MB.') }
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
  if (size && !response.headers.get('Content-Encoding') && total !== size) throw new Error('O download do vídeo ficou incompleto. Tente recuperar o original novamente.')
  const extension = type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4'
  return new File(parts, `clipe-aitoia.${extension}`, { type: type === 'application/octet-stream' ? 'video/mp4' : type })
}

function validClip(file) {
  return file instanceof Blob && file.size > 0 && file.size <= MAX_CLIP_BYTES &&
    /^video\/(?:mp4|webm|quicktime|x-m4v)(?:;|$)/i.test(file.type)
}

export async function readGeneratedClipForJob(clip, signal, authorizedFetch, authorizedPost, { repair = false } = {}) {
  const prepare = file => authorizedPost ? prepareCompatibleVideo(file, { post: authorizedPost, signal, force: repair, preserveResolution: true }) : file
  const generationId = clip.sourceClipId || clip.id
  const localFile = validClip(clip.file) ? clip.file : null
  // Reuse healthy bytes, but allow a failed preview to bypass a stale local
  // Blob and short-lived provider URL without issuing another generation.
  const readAuthenticated = async () => {
    const { data } = await authorizedFetch(`/aitoia/video/generations/${encodeURIComponent(generationId)}/file`, {
      responseType: 'blob', signal,
    })
    if (!validClip(data)) throw new Error('O provedor não disponibilizou um arquivo de vídeo válido.')
    const type = data.type.split(';')[0].toLowerCase()
    const extension = type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4'
    return new File([data], `clipe-aitoia.${extension}`, { type })
  }
  const mayRecover = generationId && authorizedFetch && (clip.remoteUrl || clip.sourceClipId || isVideoGenerationId(generationId) || !localFile)
  if (localFile && !repair) {
    try { return await prepare(localFile) }
    catch (error) {
      signal?.throwIfAborted()
      const status = error.response?.status
      // A corrupt persisted Blob can retain a plausible MIME and size. Fetch
      // the owned original once when its bytes are rejected, but preserve
      // access denials, server outages and processing throttling as failures.
      if (!mayRecover || (status && ![400, 413, 415, 422].includes(status)) ||
        ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(error.code)) throw error
      return prepare(await readAuthenticated())
    }
  }
  if (repair && mayRecover) return prepare(await readAuthenticated())
  if (repair && localFile) return prepare(localFile)
  let file
  try { file = await readGeneratedClip(clip.remoteUrl || clip.url, signal) }
  catch (error) {
    signal?.throwIfAborted()
    if (!mayRecover) throw error
    file = await readAuthenticated()
  }
  return prepare(file)
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

export async function sampleVideoFrames(file, signal, { maxSide = 768, fractions = [0.08, 0.34, 0.62, 0.88], jpegQuality = 0.72 } = {}) {
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
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não disponibilizou leitura de vídeo.')
    const frames = []
    for (const fraction of fractions) {
      const second = video.duration * fraction
      await mediaEvent(video, 'seeked', signal, () => { video.currentTime = second })
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({ second: second.toFixed(1), url: canvas.toDataURL('image/jpeg', jpegQuality) })
    }
    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export async function captureTransitionFrame(file, position, format, resolution, signal, at = null) {
  const image = at !== null && /^image\/(?:png|jpeg|webp|gif|avif)$/.test(file?.type || '')
  if (at === null) checkVideoReference(file)
  else if (!file?.size || file.size > MAX_CLIP_BYTES || (!image && !file.type.startsWith('video/'))) {
    throw new Error('Escolha uma cena com imagem ou vídeo válido.')
  }
  const url = URL.createObjectURL(file)
  const media = image ? new Image() : document.createElement('video')
  if (!image) {
    media.muted = true
    media.preload = 'auto'
    media.playsInline = true
  }
  try {
    await mediaEvent(media, image ? 'load' : 'loadeddata', signal, () => { media.src = url })
    const sourceWidth = image ? media.naturalWidth : media.videoWidth
    const sourceHeight = image ? media.naturalHeight : media.videoHeight
    if (!sourceWidth || !sourceHeight) throw new Error('A cena precisa ter uma imagem válida.')
    if (!image) {
      if (!Number.isFinite(media.duration) || media.duration <= 0) throw new Error('O clipe precisa ter uma duração válida.')
      const requestedTime = at ?? (position === 'end' ? media.duration - .04 : 0)
      const time = Math.max(0, Math.min(media.duration - .04, requestedTime))
      if (time > 0) await mediaEvent(media, 'seeked', signal, () => { media.currentTime = time })
    }
    const [widthRatio, heightRatio] = format.split(':').map(Number)
    const shortSide = resolution === '1080p' ? 1080 : resolution === '480p' ? 480 : 720
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(shortSide * widthRatio / Math.min(widthRatio, heightRatio))
    canvas.height = Math.round(shortSide * heightRatio / Math.min(widthRatio, heightRatio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não disponibilizou leitura de vídeo.')
    const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight)
    const width = sourceWidth * scale
    const height = sourceHeight * scale
    context.drawImage(media, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86))
    signal.throwIfAborted()
    if (!blob) throw new Error('O navegador não conseguiu extrair o quadro do clipe.')
    return new File([blob], position === 'end' ? 'fim-clipe-1.jpg' : 'inicio-clipe-2.jpg', { type: 'image/jpeg' })
  } finally {
    media.removeAttribute('src')
    if (!image) media.load()
    URL.revokeObjectURL(url)
  }
}
