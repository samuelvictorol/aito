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

export function sceneSeconds(value) {
  return Math.min(15, Math.max(1, Math.round(Number(value) || 1)))
}

export function studioTimeline(scenes) {
  let duration = 0
  const segments = scenes.map(scene => {
    const start = duration
    duration += sceneSeconds(scene.duration)
    return { start, end: duration, scene }
  })
  return { duration, segments }
}

export function studioFrame(timeline, seconds) {
  const at = Math.min(timeline.duration, Math.max(0, seconds))
  const segment = timeline.segments.find(entry => at < entry.end) || timeline.segments.at(-1)
  return segment ? { scene: segment.scene, time: at - segment.start } : null
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
  if (!drawMedia(ctx, scene.media, width, height)) {
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

const mimeTypes = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']

export function studioVideoMime() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return ''
  return mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

export async function recordStudioVideo(canvas, duration, { narration, render, signal }) {
  const mimeType = studioVideoMime()
  if (!mimeType) throw new Error('Seu navegador não oferece exportação de vídeo pelo canvas.')
  const stream = canvas.captureStream(30)
  const audio = narration && new AudioContext()
  let recorder
  let raf
  let source
  try {
    if (audio) {
      const resume = audio.resume()
      const buffer = await audio.decodeAudioData(await narration.arrayBuffer()).catch(() => {
        throw new Error('O navegador não conseguiu decodificar a locução. Tente um arquivo MP3 ou WAV.')
      })
      await resume
      const destination = audio.createMediaStreamDestination()
      source = audio.createBufferSource()
      source.buffer = buffer
      source.connect(destination)
      stream.addTrack(destination.stream.getAudioTracks()[0])
    }
    signal.throwIfAborted()
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
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
      source?.start()
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
