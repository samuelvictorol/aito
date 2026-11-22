import { prepareCompatibleVideo } from './aitoiaVideoCompatibility.js'
import { sampleVideoFrames, checkImageReference } from './aitoiaVideoRemote.js'

export async function visualComponentFile(file, { post, signal } = {}) {
  signal?.throwIfAborted()
  if (file.type.startsWith('video/')) {
    const source = await prepareCompatibleVideo(file, { post, signal })
    const [frame] = await sampleVideoFrames(source, signal, { fractions: [.01], maxSide: 1280 })
    const blob = await (await fetch(frame.url)).blob()
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  }
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { checkImageReference(file); return file }
  if (!file.type.startsWith('image/')) throw Error(`O arquivo ${file.name} não é uma referência visual.`)
  const image = await createImageBitmap(file)
  try {
    signal?.throwIfAborted()
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9))
    if (!blob) throw Error('Não foi possível preparar a imagem do componente.')
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally { image.close() }
}

export function componentGenerationContext(components, bindings = []) {
  const context = components.map(item => {
    const refs = bindings.filter(binding => binding.componentId === item.id).map(binding => binding.reference)
    return `@${item.title} (${item.type || 'Componente'})${refs.length ? ' — ' + refs.join(', ') : ''}${item.prompt ? ': ' + item.prompt : ''}`
  }).join('\n')
  if (context.length > 23800) throw Error('As descrições dos componentes selecionados excedem 24.000 caracteres. Reduza as descrições ou escolha menos componentes.')
  return context ? 'Componentes do projeto. Use os anexos indicados para preservar a identidade de cada objeto:\n' + context : ''
}
