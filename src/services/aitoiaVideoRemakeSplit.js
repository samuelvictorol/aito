export const maxRemakeInputBytes = 70 * 1024 * 1024
export const remakeInputAccept = '.mp4,.mov,.m4v,.webm,.mkv,.3gp,video/mp4,video/quicktime,video/webm,video/x-matroska,video/3gpp'

export const remakeSplitDurations = [5, 10]
export const maxRemakeSceneSeconds = 10
const minProviderSeconds = 4
const maxSceneBytes = 10 * 1024 * 1024
const fps = 24
const aacOptions = { numberOfChannels: 2, sampleRate: 48000, bitrate: 96000 }
const aacFramesPerPacket = 1024
let aacFallback

export function remakeSceneRanges(seconds, splitDuration = remakeSplitDurations[0]) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('O vídeo precisa ter duração válida.')
  if (!remakeSplitDurations.includes(splitDuration)) throw new Error('Escolha cortes de 5 ou 10 segundos.')
  const total = Math.max(1, Math.round(seconds * 1000))
  const block = splitDuration * 1000
  return Array.from({ length: Math.ceil(total / block) }, (_, index) => {
    const offset = index * block
    return { index, start: offset / 1000, duration: Math.min(block, total - offset) / 1000 }
  })
}

function mediaInput(media, file) {
  const { Input, BlobSource, MP4, QTFF, WEBM, MATROSKA } = media
  return new Input({ formats: [MP4, QTFF, WEBM, MATROSKA], source: new BlobSource(file) })
}

async function ensureAac(media) {
  if (await media.canEncodeAudio('aac', aacOptions)) return
  aacFallback ||= import('@mediabunny/aac-encoder')
    .then(({ registerAacEncoder }) => registerAacEncoder())
    .catch(error => { aacFallback = undefined; throw error })
  await aacFallback
}

function aacUntil(seconds) {
  let firstFrame
  return {
    codec: 'aac', ...aacOptions,
    process(sample) {
      const offset = Math.round(sample.timestamp * sample.sampleRate)
      firstFrame ??= offset
      // AAC encodes complete packets. Leave room for padding in the last one so the
      // movie header stays within the clip duration.
      const endFrame = Math.round(seconds * sample.sampleRate)
      const packetEnd = firstFrame + Math.floor((endFrame - firstFrame) / aacFramesPerPacket) * aacFramesPerPacket
      const remaining = packetEnd - offset
      if (remaining <= 0) return null
      return remaining < sample.numberOfFrames ? sample.trim(0, remaining) : sample
    },
  }
}

function outputSize(width, height, maxLongSide = 1280, maxShortSide = 720) {
  const scale = Math.min(1, maxLongSide / Math.max(width, height), maxShortSide / Math.min(width, height))
  return { width: Math.max(2, 2 * Math.round(width * scale / 2)), height: Math.max(2, 2 * Math.round(height * scale / 2)) }
}

async function executeConversion(media, input, format, options, { signal, onProgress, requireVideo, requireAudio }) {
  signal?.throwIfAborted()
  const target = new media.BufferTarget()
  const output = new media.Output({ format, target })
  const conversion = await media.Conversion.init({ input, output, showWarnings: false, ...options })
  let cancellation
  const cancel = () => { cancellation ||= conversion.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    signal?.throwIfAborted()
    if (!conversion.isValid ||
        (requireVideo && conversion.discardedTracks.some(({ track }) => track.isVideoTrack() && track === requireVideo)) ||
        (requireAudio && conversion.discardedTracks.some(({ track }) => track.isAudioTrack() && track === requireAudio))) {
      throw new Error('Este navegador não conseguiu converter o vídeo e o áudio. Tente no Chrome ou Edge atualizado ou use um MP4 com vídeo H.264 e áudio AAC.')
    }
    if (onProgress) conversion.onProgress = progress => onProgress(Math.max(0, Math.min(1, progress)))
    await conversion.execute()
    signal?.throwIfAborted()
    if (!target.buffer?.byteLength) throw new Error('O navegador retornou um clipe vazio.')
    return target.buffer
  } catch (error) {
    cancel()
    await cancellation
    signal?.throwIfAborted()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

function normalizedVideoOptions(size, bitrate, process) {
  return { ...size, fit: 'contain', codec: 'avc', bitrate, frameRate: fps, keyFrameInterval: 2, process }
}

async function videoInfo(input) {
  const [videoTrack, audioTrack] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()])
  if (!videoTrack) throw new Error('Este arquivo não tem uma faixa de vídeo legível.')
  const [width, height, start, end] = await Promise.all([
    videoTrack.getDisplayWidth(), videoTrack.getDisplayHeight(), videoTrack.getFirstTimestamp(), videoTrack.computeDuration(),
  ])
  if (!width || !height || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Escolha um vídeo com imagem e duração válidas.')
  }
  return { videoTrack, audioTrack, width, height, start, end, duration: end - start }
}

function clipVideoOptions(size, bitrate, span, duration) {
  return normalizedVideoOptions(size, bitrate, sample => {
    const left = duration - sample.timestamp
    if (left <= 0) return null
    if (sample.timestamp + sample.duration >= span - .5 / fps || sample.duration > left) sample.setDuration(left)
    return sample
  })
}

export async function splitRemakeVideo(file, { splitDuration, signal, onProgress } = {}) {
  if (!file?.size || file.size > maxRemakeInputBytes) throw new Error('Escolha um vídeo de até 70 MB.')
  if (file.type && !file.type.startsWith('video/') && file.type !== 'application/octet-stream' &&
      !/\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(file.name)) {
    throw new Error('Escolha um vídeo MP4, MOV, M4V, WebM ou MKV.')
  }
  signal?.throwIfAborted()
  onProgress?.(0)
  const media = await import('mediabunny')
  const input = mediaInput(media, file)
  try {
    const source = await videoInfo(input)
    const ranges = remakeSceneRanges(source.duration, splitDuration)
    if (source.audioTrack) await ensureAac(media)
    const size = outputSize(source.width, source.height)
    const bitrate = Math.max(130000, Math.min(1_700_000, Math.round(8 * file.size / source.duration)))
    const scenes = []
    for (const { index, start, duration } of ranges) {
      const span = Math.min(duration, source.duration - start)
      const buffer = await executeConversion(media, input, new media.Mp4OutputFormat({ fastStart: 'in-memory' }), {
        trim: { start: source.start + start, end: Math.min(source.end, source.start + start + duration) },
        tracks: 'primary', tags: {}, copy: false,
        video: clipVideoOptions(size, bitrate, span, duration),
        audio: aacUntil(duration),
      }, {
        signal,
        onProgress: progress => onProgress?.((index + progress * .98) / ranges.length),
        requireVideo: source.videoTrack,
        requireAudio: source.audioTrack,
      })
      if (buffer.byteLength > maxSceneBytes) throw new Error('Um dos clipes ficou acima de 10 MB. Reduza a resolução do arquivo e tente novamente.')
      const label = String(index + 1).padStart(2, '0')
      const clip = new File([buffer], 'cena-' + label + '.mp4', { type: 'video/mp4' })
      scenes.push({ index, start, duration, providerDuration: duration, ...size, file: clip })
      onProgress?.((index + 1) / ranges.length)
    }
    return scenes
  } finally {
    input.dispose()
  }
}

export async function prepareRemakeVideoReference(file, { signal } = {}) {
  signal?.throwIfAborted()
  const media = await import('mediabunny')
  const input = mediaInput(media, file)
  try {
    const source = await videoInfo(input)
    if (source.duration >= minProviderSeconds) return file
    // Keep the source cut intact. Only the copy sent to Higgsfield needs a minimum length.
    const providerDuration = minProviderSeconds
    const size = outputSize(source.width, source.height)
    const bitrate = Math.max(130000, Math.min(1_700_000, Math.round(8 * file.size / source.duration)))
    if (source.audioTrack) await ensureAac(media)
    const buffer = await executeConversion(media, input, new media.Mp4OutputFormat({ fastStart: 'in-memory' }), {
      trim: { start: source.start, end: source.end }, tracks: 'primary', tags: {}, copy: false,
      video: clipVideoOptions(size, bitrate, source.duration, providerDuration),
      audio: aacUntil(providerDuration),
    }, { signal, requireVideo: source.videoTrack, requireAudio: source.audioTrack })
    if (buffer.byteLength > maxSceneBytes) throw new Error('O clipe ultrapassou 10 MB. Reduza a resolução e tente novamente.')
    return new File([buffer], file.name, { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}

export async function extractRemakeAudio(file, { signal } = {}) {
  signal?.throwIfAborted()
  const media = await import('mediabunny')
  const input = mediaInput(media, file)
  try {
    const audioTrack = await input.getPrimaryAudioTrack()
    if (!audioTrack) return null
    const end = Math.min(maxRemakeSceneSeconds, await audioTrack.computeDuration())
    if (!Number.isFinite(end) || end <= 0) return null
    const buffer = await executeConversion(media, input, new media.WavOutputFormat(), {
      trim: { start: 0, end }, tracks: 'primary', tags: {}, copy: false, video: { discard: true },
      audio: { codec: 'pcm-s16', numberOfChannels: 1, sampleRate: 16000 },
    }, { signal, requireAudio: audioTrack })
    if (buffer.byteLength > 322000) throw new Error('O trecho de áudio ficou acima do limite para análise.')
    return new File([buffer], 'audio-da-cena.wav', { type: 'audio/wav' })
  } finally {
    input.dispose()
  }
}

function cueLines(ctx, text, width) {
  const lines = []
  for (const word of text.split(/\s+/)) {
    const line = lines.at(-1)
    if (!line || ctx.measureText(line + ' ' + word).width > width) lines.push(word)
    else lines[lines.length - 1] += ' ' + word
  }
  return lines
}

function drawCue(ctx, cue, width, height) {
  let fontsize = Math.max(12, Math.round(Math.min(width, height) * .055))
  ctx.font = '700 ' + fontsize + 'px system-ui, sans-serif'
  let lines = cueLines(ctx, cue, width * .85)
  while (lines.length > 3 && fontsize > 12) {
    fontsize -= 1
    ctx.font = '700 ' + fontsize + 'px system-ui, sans-serif'
    lines = cueLines(ctx, cue, width * .85)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineHeight = fontsize * 1.25
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, fontsize * .18)
  ctx.strokeStyle = '#000'
  ctx.fillStyle = '#fff'
  for (const [index, line] of lines.entries()) {
    const y = height * .86 - (lines.length - 1 - index) * lineHeight
    ctx.strokeText(line, width / 2, y, width * .9)
    ctx.fillText(line, width / 2, y, width * .9)
  }
}

export async function burnRemakeCaptions(file, cues, { signal, onProgress, duration } = {}) {
  signal?.throwIfAborted()
  const media = await import('mediabunny')
  const input = mediaInput(media, file)
  try {
    const source = await videoInfo(input)
    const limit = Number.isFinite(duration) && duration > 0 ? Math.min(duration, source.duration) : source.duration
    const captions = (Array.isArray(cues) ? cues : []).flatMap(cue =>
      Number.isFinite(cue?.start) && Number.isFinite(cue.end) && cue.end > cue.start && typeof cue.text === 'string' && cue.text.trim()
        ? [{ start: cue.start, end: cue.end, text: cue.text.trim().slice(0, 220) }] : [])
    if (!captions.length && source.duration - limit < .04) return file
    const size = outputSize(source.width, source.height)
    let process
    if (captions.length) {
      const canvas = document.createElement('canvas')
      Object.assign(canvas, size)
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('O navegador não conseguiu preparar a renderização das legendas.')
      process = sample => {
        sample.draw(ctx, 0, 0, size.width, size.height)
        const cue = captions.find(item => item.start <= sample.timestamp && item.end > sample.timestamp)
        if (cue) drawCue(ctx, cue.text, size.width, size.height)
        return canvas
      }
    }
    if (source.audioTrack) await ensureAac(media)
    const buffer = await executeConversion(media, input, new media.Mp4OutputFormat({ fastStart: 'in-memory' }), {
      trim: { start: source.start, end: source.start + limit }, tracks: 'primary', tags: {}, copy: false,
      video: normalizedVideoOptions(size, 3_000_000, process),
      audio: aacUntil(limit),
    }, { signal, onProgress, requireVideo: source.videoTrack, requireAudio: source.audioTrack })
    return new File([buffer], 'cena-refeita.mp4', { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}

export async function removeRemakeSourceSubtitles(file, region, { signal, onProgress } = {}) {
  signal?.throwIfAborted()
  const [media, { createSubtitleRegionCleaner }] = await Promise.all([
    import('mediabunny'), import('./aitoiaSubtitleRemoval.js'),
  ])
  const input = mediaInput(media, file)
  try {
    const source = await videoInfo(input)
    const size = outputSize(source.width, source.height)
    const process = createSubtitleRegionCleaner(size.width, size.height, region)
    const bitrate = Math.max(130000, Math.min(1_700_000, Math.round(8 * file.size / source.duration)))
    const buffer = await executeConversion(media, input, new media.Mp4OutputFormat({ fastStart: 'in-memory' }), {
      trim: { start: source.start, end: source.end }, tracks: 'primary', tags: {},
      copy: { boundaryPolicy: 'shrink' },
      video: { ...size, fit: 'contain', codec: 'avc', bitrate, keyFrameInterval: 2, process },
    }, { signal, onProgress, requireVideo: source.videoTrack, requireAudio: source.audioTrack })
    if (buffer.byteLength > maxSceneBytes) throw new Error('O clipe sem a legenda ficou acima do limite de 10 MB.')
    return new File([buffer], file.name, { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}
