export const videoFormats = [
  { id: 'landscape', label: '16:9', title: 'Horizontal', width: 1280, height: 720 },
  { id: 'portrait', label: '9:16', title: 'Vertical', width: 720, height: 1280 },
  { id: 'square', label: '1:1', title: 'Quadrado', width: 900, height: 900 },
]

const maxImageSize = 20 * 1024 * 1024
const maxVideoSize = 60 * 1024 * 1024
const maxAudioSize = 20 * 1024 * 1024
export const maxStudioMedia = 120 * 1024 * 1024
export const maxStudioScenes = 8
const minCut = .1

export function cutStudioScene(scene, start, end) {
  const limit = scene.media?.element.duration
  if (!Number.isFinite(limit) || limit <= 0) return scene
  const offset = Math.max(0, Math.min(limit - minCut, Number(start) || 0))
  const out = Math.min(limit, Math.max(offset + minCut, Number(end) || offset))
  return { ...scene, offset, duration: out - offset, cut: true }
}

export function cutDuration(scene) {
  return scene.cut ? Math.max(.01, Number(scene.duration) || minCut) : sceneSeconds(scene.duration)
}

export function studioRenderSize(format, quality) {
  const max = Math.max(format.width, format.height)
  const longSide = quality === 'high' ? 1920 : 1280
  const factor = format.id === 'square' ? Math.min(1, longSide / max) * (quality === 'high' ? 1.2 : .8) : longSide / max
  return { width: 2 * Math.round(format.width * factor / 2), height: 2 * Math.round(format.height * factor / 2) }
}

export function sceneSeconds(value) {
  return Math.min(15, Math.max(1, Math.round(Number(value) || 1)))
}

export function splitStudioClip(value) {
  if (!Number.isFinite(value) || value <= 0) return []
  const duration = Math.min(maxStudioScenes * 15, value)
  return Array.from({ length: Math.ceil(duration / 15) }, (_, index) => ({
    offset: index * 15, duration: Math.min(15, duration - index * 15),
  }))
}

export function studioTimeline(scenes) {
  let duration = 0
  const segments = scenes.map(scene => {
    const start = duration
    duration += cutDuration(scene)
    return { start, end: duration, scene }
  })
  return { duration, segments }
}

export function studioFrame(timeline, seconds) {
  const at = Math.min(timeline.duration, Math.max(0, seconds))
  const segment = timeline.segments.find(entry => at < entry.end) || timeline.segments.at(-1)
  return segment ? { scene: segment.scene, time: at - segment.start } : null
}

export function studioSubtitles(timeline) {
  const stamp = seconds => new Date(seconds * 1000).toISOString().slice(11, 23).replace('.', ',')
  return timeline.segments.filter(({ scene }) => scene.caption.trim()).map(({ start, end, scene }, index) =>
    `${index + 1}\r\n${stamp(start)} --> ${stamp(end)}\r\n${scene.caption.trim()}\r\n`).join('\r\n')
}

function waitForMedia(element, event, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const loaded = () => finish(resolve)
    const failed = () => finish(reject, new Error('O navegador não conseguiu abrir este arquivo.'))
    const abort = () => finish(reject, signal.reason)
    const timeout = setTimeout(failed, 8000)
    function finish(callback, value) {
      clearTimeout(timeout)
      element.removeEventListener(event, loaded)
      element.removeEventListener('error', failed)
      signal?.removeEventListener('abort', abort)
      callback(value)
    }
    element.addEventListener(event, loaded, { once: true })
    element.addEventListener('error', failed, { once: true })
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function openStudioMedia(file, existingBytes, signal) {
  const isImage = /^image\/(?:avif|jpeg|png|webp|gif)$/.test(file.type)
  const isVideo = /^video\//.test(file.type)
  const limit = isImage ? maxImageSize : maxVideoSize
  if (!isImage && !isVideo) throw new Error('Escolha uma imagem PNG, JPEG, WebP, GIF ou AVIF, ou um vídeo que seu navegador consiga abrir.')
  if (!file.size || file.size > limit) throw new Error(`Escolha um ${isImage ? 'arquivo de imagem de até 20 MB' : 'vídeo de até 60 MB'}.`)
  if (existingBytes + file.size > maxStudioMedia) throw new Error('As mídias do projeto podem ocupar até 120 MB.')
  const element = isImage ? new Image() : document.createElement('video')
  if (isVideo) {
    element.muted = true
    element.playsInline = true
    element.preload = 'auto'
  }
  const media = { file, element, isVideo, url: URL.createObjectURL(file) }
  try {
    const ready = waitForMedia(element, isImage ? 'load' : 'loadeddata', signal)
    element.src = media.url
    await ready
    if (isVideo && (!Number.isFinite(element.duration) || !element.videoWidth)) throw new Error('Escolha um vídeo com duração e imagem válidas.')
    if (isVideo) {
      const thumb = document.createElement('canvas')
      thumb.width = 160
      thumb.height = 90
      const ctx = thumb.getContext('2d')
      if (ctx && drawMedia(ctx, media, thumb.width, thumb.height)) media.poster = thumb.toDataURL('image/jpeg', .65)
    }
    return media
  } catch (error) {
    closeStudioMedia(media)
    throw error
  }
}

export function closeStudioMedia(media) {
  if (!media) return
  if (media.isVideo) {
    media.element.pause()
    media.element.removeAttribute('src')
    media.element.load()
  }
  URL.revokeObjectURL(media.url)
}

export function studioNarration(file, existingBytes) {
  if ((!file.type.startsWith('audio/') && !/\.(m4a|mp3|ogg|opus|wav|aac|flac)$/i.test(file.name)) || !file.size || file.size > maxAudioSize) {
    throw new Error('Escolha um arquivo de áudio de até 20 MB.')
  }
  if (existingBytes + file.size > maxStudioMedia) throw new Error('As mídias do projeto podem ocupar até 120 MB.')
  return { file, url: URL.createObjectURL(file) }
}

function drawMedia(ctx, media, width, height) {
  if (!media) return false
  const { isVideo, element } = media
  const sourceWidth = isVideo ? element.videoWidth : element.naturalWidth
  const sourceHeight = isVideo ? element.videoHeight : element.naturalHeight
  if (!sourceWidth || !sourceHeight || (isVideo && element.readyState < 2)) return false
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const scaledWidth = sourceWidth * scale
  const scaledHeight = sourceHeight * scale
  ctx.drawImage(element, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight)
  return true
}

function fitLines(ctx, value, maxWidth, maxLines) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    const next = current ? `${current} ${word}` : word
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.join(' ').length < words.join(' ').length) lines[lines.length - 1] += '…'
  return lines
}

export function drawStudioFrame(canvas, scene) {
  if (!canvas || !scene) return
  const { width, height } = canvas
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return
  const length = Math.min(width, height)
  const padding = length * 0.095
  const textWidth = width - padding * 2

  ctx.fillStyle = '#06161c'
  ctx.fillRect(0, 0, width, height)
  const hasMedia = drawMedia(ctx, scene.media, width, height)
  if (!hasMedia) {
    const light = ctx.createRadialGradient(width * .79, height * .18, 0, width * .79, height * .18, Math.max(width, height) * .85)
    light.addColorStop(0, '#286b67')
    light.addColorStop(.46, '#0b3136')
    light.addColorStop(1, '#07131d')
    ctx.fillStyle = light
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(170, 250, 232, .19)'
    ctx.lineWidth = 1.5
    for (const radius of [.22, .35, .49]) {
      ctx.beginPath()
      ctx.arc(width * .81, height * .22, length * radius, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  if (hasMedia && !scene.heading?.trim() && !scene.caption?.trim()) return
  const shade = ctx.createLinearGradient(0, height * .22, 0, height)
  shade.addColorStop(0, 'rgba(2, 10, 15, .02)')
  shade.addColorStop(.55, 'rgba(2, 10, 15, .54)')
  shade.addColorStop(1, 'rgba(2, 10, 15, .94)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'alphabetic'

  const headingSize = Math.round(length * .083)
  const captionSize = Math.round(length * .038)
  ctx.font = `500 ${captionSize}px system-ui, sans-serif`
  const captions = fitLines(ctx, scene.caption, textWidth, 3)
  const captionBottom = height - padding
  ctx.fillStyle = '#d2ebe8'
  captions.forEach((line, index) => ctx.fillText(line, padding, captionBottom - (captions.length - index - 1) * captionSize * 1.35, textWidth))
  ctx.font = `700 ${headingSize}px system-ui, sans-serif`
  const headings = fitLines(ctx, scene.heading, textWidth, 2)
  const headingBottom = captionBottom - (captions.length ? (captions.length + .4) * captionSize * 1.35 : 0)
  ctx.fillStyle = '#f1fffd'
  headings.forEach((line, index) => ctx.fillText(line, padding, headingBottom - (headings.length - index - 1) * headingSize * 1.13, textWidth))
}

const exportTypes = [
  { extension: 'mp4', label: 'MP4', candidates: ['video/mp4'] },
  { extension: 'webm', label: 'WebM', candidates: ['video/webm;codecs=vp8,opus', 'video/webm'] },
]

export function studioVideoExports() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return []
  return exportTypes.flatMap(({ extension, label, candidates }) => {
    const mime = candidates.find(type => MediaRecorder.isTypeSupported(type))
    return mime ? [{ extension, label, mime }] : []
  })
}

export function studioVideoMime() {
  return studioVideoExports()[0]?.mime || ''
}

export async function recordStudioVideo(canvas, duration, { narration, clipAudio = [], audioOffset = 0, mimeType = studioVideoMime(), render, signal }) {
  if (!studioVideoExports().some(option => option.mime === mimeType)) throw new Error('Seu navegador não oferece esse formato de exportação.')
  const stream = canvas.captureStream(30)
  const audio = (narration || clipAudio.length) && new AudioContext()
  let recorder
  let raf
  const scheduled = []
  try {
    if (audio) {
      const resume = audio.resume()
      const destination = audio.createMediaStreamDestination()
      const buffers = new Map()
      async function decode(file) {
        if (!buffers.has(file)) buffers.set(file, file.arrayBuffer().then(bytes => audio.decodeAudioData(bytes)))
        return buffers.get(file)
      }
      const tracks = [...clipAudio, ...(narration ? [{ file: narration, position: 0, offset: audioOffset, duration, narration: true }] : [])]
      await Promise.all(tracks.map(async track => {
        const buffer = await decode(track.file).catch(() => null)
        if (!buffer && track.narration) throw new Error('O navegador não conseguiu decodificar a locução. Tente um arquivo MP3 ou WAV.')
        if (!buffer || track.offset >= buffer.duration) return
        const source = audio.createBufferSource()
        source.buffer = buffer
        source.connect(destination)
        scheduled.push({ source, ...track, duration: Math.min(track.duration, buffer.duration - track.offset) })
      }))
      await resume
      stream.addTrack(destination.stream.getAudioTracks()[0])
    }
    signal.throwIfAborted()
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: canvas.width * canvas.height > 1300000 ? 8_000_000 : 4_000_000 })
    return await new Promise((resolve, reject) => {
      const chunks = []
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data) }
      recorder.onerror = () => reject(new Error('O navegador interrompeu a exportação.'))
      recorder.onstop = () => {
        signal.removeEventListener('abort', abort)
        if (chunks.length) resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }))
        else reject(new Error('A exportação não gerou quadros de vídeo.'))
      }

      function frame(now) {
        const time = Math.min(duration, (now - start) / 1000)
        try { render(time) } catch (error) { reject(error); return }
        if (time >= duration) recorder.stop()
        else raf = requestAnimationFrame(frame)
      }
      render(0)
      const start = performance.now()
      recorder.start(400)
      const audioStart = audio?.currentTime || 0
      for (const { source, position, offset, duration: length } of scheduled) source.start(audioStart + position, offset, length)
      raf = requestAnimationFrame(frame)
    })
  } finally {
    cancelAnimationFrame(raf)
    if (recorder?.state === 'recording') recorder.stop()
    stream.getTracks().forEach(track => track.stop())
    await audio?.close().catch(() => {})
  }
}

export function parseStudioScript(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let script
  try { script = JSON.parse(text) } catch { throw new Error('O modelo não retornou um roteiro legível. Tente novamente.') }
  if (!Array.isArray(script?.scenes) || !script.scenes.length || script.scenes.length > maxStudioScenes ||
      script.scenes.some(scene => !scene || typeof scene.heading !== 'string' || typeof scene.caption !== 'string')) {
    throw new Error('O modelo não retornou cenas válidas. Tente novamente.')
  }
  return {
    title: typeof script.title === 'string' ? script.title.slice(0, 80).trim() : '',
    scenes: script.scenes.map(scene => ({
      duration: sceneSeconds(scene.duration), heading: scene.heading.slice(0, 110), caption: scene.caption.slice(0, 180),
    })),
    narration: typeof script.narration === 'string' ? script.narration.trim().slice(0, 3000) : '',
  }
}
