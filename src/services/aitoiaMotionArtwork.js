import { prepareMarketingReference, readMarketingImage } from './aitoiaMarketingLocal.js'

export const motionArtworkTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const maxMotionArtwork = 2 * 1024 * 1024

export function motionArtworkFile(file, maxBytes = maxMotionArtwork) {
  if (!file?.size || file.size > maxBytes || !motionArtworkTypes.includes(file.type)) {
    throw new Error(`Escolha uma imagem JPG, PNG, WebP ou GIF de até ${maxBytes / 1024 / 1024} MB.`)
  }
  return file
}

export async function readMotionBackground(file) {
  const { mimeType, data } = await readMarketingImage(motionArtworkFile(file))
  return { contentType: mimeType, base64: data }
}

async function gifPreviewFrame(file) {
  const image = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1024 / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível extrair um quadro do GIF.'))
    }, 'image/webp', .85))
  } finally { image.close() }
}

export async function prepareMotionReference(file) {
  motionArtworkFile(file, 12 * 1024 * 1024)
  const still = file.type === 'image/gif' ? await gifPreviewFrame(file) : file
  return readMarketingImage(await prepareMarketingReference(still, 768 * 1024))
}

export async function fitMotionImage(file) {
  if (file.size <= maxMotionArtwork) return file
  const resized = await prepareMarketingReference(file, maxMotionArtwork)
  return new File([resized], 'aitoia-fundo.webp', { type: resized.type })
}

export async function animateMotionArtwork(file, motion, signal) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const image = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 352 / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const { width, height } = canvas
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
    const gif = GIFEncoder()
    let palette
    const count = 20
    for (let frame = 0; frame < count; frame += 1) {
      signal.throwIfAborted()
      const phase = 2 * Math.PI * frame / count
      const breathe = (1 - Math.cos(phase)) / 2
      const zoom = motion === 'drift' ? 1.17 : 1 + breathe * .13
      const shift = motion === 'drift' ? width * .055 * Math.sin(phase) : 0
      context.fillStyle = '#142823'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, width * (1 - zoom) / 2 + shift, height * (1 - zoom) / 2, width * zoom, height * zoom)
      const rgba = context.getImageData(0, 0, width, height).data
      if (!palette) palette = quantize(rgba, 96)
      gif.writeFrame(applyPalette(rgba, palette), width, height, { ...(frame === 0 ? { palette, repeat: 0 } : {}), delay: 80 })
      if (frame % 5 === 4) await new Promise(resolve => setTimeout(resolve, 0))
    }
    gif.finish()
    return motionArtworkFile(new File([gif.bytes()], 'aitoia-fundo.gif', { type: 'image/gif' }))
  } finally { image.close() }
}
