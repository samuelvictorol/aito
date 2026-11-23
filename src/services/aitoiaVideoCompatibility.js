export const videoReferenceAccept = 'video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp'
const maximum = 60 * 1024 * 1024
const types = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp' }
const prepared = new WeakMap()
const preserved = new WeakMap()

export function commonVideoType(file) {
  if (!(file instanceof Blob) || !Number.isSafeInteger(file.size) || file.size < 1) throw new Error('Selecione um arquivo de vídeo válido.')
  if (file.size > maximum) throw new Error('O vídeo excede o limite de 60 MB.')
  const type = String(file.type || '').toLowerCase().split(';')[0]
  const extension = /\.([a-z0-9]+)$/i.exec(file.name || '')?.[1]?.toLowerCase()
  if (Object.values(types).includes(type)) return type
  if (types[extension] && ['', 'application/octet-stream', 'application/mp4'].includes(type)) return types[extension]
  throw new Error('Use um vídeo MP4, MOV, M4V, WebM, MKV, AVI ou 3GP.')
}

async function compatible(file) {
  if (commonVideoType(file) !== 'video/mp4') return false
  const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny')
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()])
    return video?.codec === 'avc' && (!audio || audio.codec === 'aac')
  } catch { return false }
  finally { input.dispose() }
}

export async function prepareCompatibleVideo(file, { post, signal, force = false, preserveResolution = false } = {}) {
  commonVideoType(file)
  signal?.throwIfAborted()
  const cache = preserveResolution ? preserved : prepared
  if (!force && cache.has(file)) return cache.get(file)
  if (!force && await compatible(file)) {
    signal?.throwIfAborted()
    const output = file.type === 'video/mp4' ? file : new File([file], file.name, { type: 'video/mp4', lastModified: file.lastModified })
    cache.set(file, output); return output
  }
  if (!post) throw new Error('Entre na sua conta para preparar este formato de vídeo.')
  let response
  try {
    response = await post('/aitoia/video/normalize', file, { params: { filename: file.name, ...(preserveResolution && { preserveResolution: true }) },
      headers: { 'Content-Type': commonVideoType(file) }, responseType: 'blob', timeout: 190000, signal })
  } catch (error) {
    if (error.response?.data instanceof Blob && error.response.data.size < 20000) {
      try { error.response.data = JSON.parse(await error.response.data.text()); error.message = error.response.data.message || error.message } catch { /* Keep the transport error. */ }
    }
    throw error
  }
  const { data } = response
  signal?.throwIfAborted()
  if (!(data instanceof Blob) || !data.size || data.size > maximum || data.type.split(';')[0] !== 'video/mp4') throw new Error('A conversão não retornou um vídeo MP4 válido.')
  const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '.mp4'
  const output = new File([data], name, { type: 'video/mp4', lastModified: file.lastModified })
  cache.set(file, output); cache.set(output, output)
  return output
}
