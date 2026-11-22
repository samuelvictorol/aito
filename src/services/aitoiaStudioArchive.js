import { readAitoProjectZip, zipAitoIAFiles } from './aitoiaArchive.js'
import { marketingFormats } from './aitoiaMarketingLocal.js'
import { maxStudioScenes, videoFormats } from './aitoiaVideo.js'
import { cleanSceneScript, normalizeVoiceReference, voiceComponentType } from './aitoiaVideoPlan.js'
import { maxRemakeSceneSeconds, remakeSplitDurations } from './aitoiaVideoRemakeSplit.js'
import { readSubtitleRegion } from './aitoiaSubtitleRemoval.js'
import { normalizeComponent, filesForComponent, MAX_COMPONENT_FILES } from './aitoiaComponentReferences.js'

const imageTypes = ['image/png', 'image/jpeg', 'image/webp']
const artworkTypes = [...imageTypes, 'image/gif']
const videoTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm', 'video/x-matroska', 'video/x-msvideo', 'video/3gpp']
const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/aac']
const formats = new Map(marketingFormats.map(format => [format.id, format]))
const invalid = () => new Error('O ZIP precisa conter um projeto válido deste estúdio, exportado pela AitoSoftwares.')
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
const rows = (value, max) => {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) throw invalid()
  return value
}
const uuid = () => crypto.randomUUID()

async function mediaType(blob, allowed, hint = '', name = '') {
  const bytes = new Uint8Array(await blob.slice(0, 4096).arrayBuffer())
  const starts = (...signature) => signature.every((byte, index) => bytes[index] === byte)
  const marker = (at, word) => word === String.fromCharCode(...bytes.subarray(at, at + word.length))
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png'
  if (starts(255, 216, 255)) return 'image/jpeg'
  if (marker(0, 'RIFF') && marker(8, 'WEBP')) return 'image/webp'
  if (marker(0, 'GIF87a') || marker(0, 'GIF89a')) return 'image/gif'
  if (marker(4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12))
    const brands = [brand]
    for (let index = 16; index + 4 <= Math.min(bytes.length, 80); index += 4) brands.push(String.fromCharCode(...bytes.subarray(index, index + 4)))
    const known = /^(?:isom|iso[2-9]|mp4[12]|avc1|dash|MSNV|M4V |M4VH|M4VP|qt  |3gp[0-9]|3g2[a-z]|M4A |M4B |[Ff]4[Vv] |mmp4)$/
    if (!brands.some(value => known.test(value))) return ''
    if (allowed === audioTypes || hint === 'audio/mp4' || /^M4[AB] $/.test(brand)) return 'audio/mp4'
    if (brand === 'qt  ') return 'video/quicktime'
    if (/^(?:3gp|3g2)/.test(brand)) return 'video/3gpp'
    if (['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp'].includes(hint)) return hint
    if (/\.mov$/i.test(name)) return 'video/quicktime'
    if (/\.m4v$/i.test(name) || /^M4V/.test(brand)) return 'video/x-m4v'
    return 'video/mp4'
  }
  if (starts(26, 69, 223, 163)) {
    const header = String.fromCharCode(...bytes)
    if (!header.includes('webm') && !header.includes('matroska')) return ''
    if (allowed === audioTypes || hint === 'audio/webm') return 'audio/webm'
    return hint === 'video/x-matroska' || /\.mkv$/i.test(name) || header.includes('matroska') ? 'video/x-matroska' : 'video/webm'
  }
  if (marker(0, 'RIFF') && marker(8, 'AVI ')) return 'video/x-msvideo'
  if ((hint === 'video/quicktime' || /\.mov$/i.test(name)) && ['moov', 'mdat', 'wide', 'free'].some(atom => marker(4, atom)) && bytes.length >= 8) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
    if (size >= 8 && size <= blob.size) return 'video/quicktime'
  }
  if (marker(0, 'RIFF') && marker(8, 'WAVE')) return 'audio/wav'
  if (marker(0, 'OggS')) return 'audio/ogg'
  if (bytes[0] === 255 && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac'
  if (marker(0, 'ID3') || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  return ''
}

export async function readStudioProject(blob, studio, { expiresAt, signal } = {}) {
  let files, manifest
  try {
    files = await readAitoProjectZip(blob)
    const json = files.get('projeto.json')
    if (!json || json.size > 512 * 1024) throw invalid()
    manifest = JSON.parse(await json.text())
  } catch { throw invalid() }
  signal?.throwIfAborted()
  if (manifest?.format !== `aitoia-${studio}` || !(studio === 'video' ? [1, 2, 3, 4, 5, 6] : [1, 2]).includes(manifest.version)) throw invalid()
  async function file(name, allowed, optionalRoot = false, hint = '') {
    if (name === undefined || name === null) return undefined
    if (typeof name !== 'string' || (!optionalRoot && !/^midias\/[^/]+$/.test(name))) throw invalid()
    const asset = files.get(name)
    if (!asset?.size || asset.size > 60 * 1024 * 1024) throw invalid()
    const type = await mediaType(asset, allowed, hint, name)
    if (!allowed.includes(type)) throw invalid()
    return new File([asset], name.split('/').at(-1), { type })
  }
  const title = text(manifest.title, studio === 'video' ? 80 : 65).trim()
  if (studio === 'marketing') {
    const format = formats.get(manifest.formatId)
    if (!format || !Array.isArray(manifest.images) || !Array.isArray(manifest.references)) throw invalid()
    const references = await Promise.all(rows(manifest.references, 6).map(async item => ({
      id: uuid(), label: text(item.label, 120), blob: await file(item.media, imageTypes),
    })))
    const images = await Promise.all(rows(manifest.images, 200).map(async item => ({
      id: uuid(), label: text(item.label, 120), blob: await file(item.media, imageTypes), format: formats.get(item.formatId) || format,
    })))
    if ([...references, ...images].some(item => !item.blob)) throw invalid()
    const palette = rows(manifest.palette, 10).filter(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
    const projectKit = await Promise.all(rows(manifest.components, 12).map(async item => {
      const names = manifest.version >= 2 && Array.isArray(item.media) ? rows(item.media, MAX_COMPONENT_FILES) : item.media == null ? [] : [item.media]
      const assets = (await Promise.all(names.map(name => file(name, manifest.version >= 2 ? artworkTypes : imageTypes)))).filter(Boolean)
      const normalized = normalizeComponent({ title: text(item.label, 60), files: assets })
      return { id: uuid(), label: text(item.label, 60), text: text(item.text, 2000), files: normalized.files,
        blob: normalized.file || undefined, selected: item.selected === true }
    }))
    if (manifest.version === 1 && (projectKit.filter(item => item.selected).length > 6 || references.length + projectKit.filter(item => item.selected && item.blob).length > 6)) throw invalid()
    return { title, formatId: format.id, prompt: text(manifest.prompt, 20000), palette, references, images,
      projectKit: projectKit.map(({ selected: _selected, ...item }) => item),
      selectedKit: projectKit.filter(item => item.selected).map(item => item.id), imageId: images[manifest.selectedImage]?.id }
  }
  const format = videoFormats.find(item => item.label === manifest.aspectRatio)
  if (!format || !Array.isArray(manifest.scenes) || !manifest.scenes.length) throw invalid()
  const clips = (await Promise.all(rows(manifest.clips, 200).map(async (item, index) => ({
    originalId: item.id, id: uuid(), number: index + 1, kind: text(item.kind, 40), title: text(item.title, 80), expiresAt, file: await file(item.media, videoTypes),
  })))).filter(item => item.file)
  const clipIds = new Map(clips.map(item => [item.originalId, item.id]))
  const scriptRows = rows(manifest.plan?.scenes, maxStudioScenes)
  const scriptIds = new Map(scriptRows.filter(item => typeof item?.id === 'string').map(item => [item.id, uuid()]))
  const scenes = await Promise.all(rows(manifest.scenes, maxStudioScenes).map(async scene => {
    const asset = await file(scene.media, [...artworkTypes, ...videoTypes])
    return { id: uuid(), heading: text(scene.heading, 140), caption: text(scene.caption, 500), file: asset,
      duration: Number.isFinite(scene.duration) ? Math.max(.01, scene.duration) : 5,
      offset: Number.isFinite(scene.offset) ? Math.max(0, scene.offset) : 0,
      cut: Boolean(scene.cut), kind: text(scene.kind, 40), clipId: clipIds.get(scene.clipId), scriptId: scriptIds.get(scene.scriptId),
      missingMedia: !asset && Boolean(scene.missingMedia || scene.expiresAt) }
  }))
  const componentTypes = rows(manifest.componentTypes, 20).map(type => text(type, 32)).filter(Boolean)
  const componentRows = rows(manifest.components, 200)
  const componentIds = new Map(componentRows.filter(item => typeof item?.id === 'string').map(item => [item.id, uuid()]))
  const mappedComponents = values => rows(values, 200).map(id => componentIds.get(id)).filter(Boolean)
  const components = await Promise.all(componentRows.map(async item => {
    const type = text(item.type, 32)
    const voiceComponent = manifest.version >= 4 && type === voiceComponentType
    const names = manifest.version >= 6 && Array.isArray(item.media) ? rows(item.media, MAX_COMPONENT_FILES) : item.media == null ? [] : [item.media]
    const allowed = voiceComponent ? audioTypes : manifest.version >= 6 ? [...artworkTypes, ...videoTypes, ...audioTypes] : manifest.version >= 5 && type === 'Cenas' ? [...artworkTypes, ...videoTypes] : artworkTypes
    const types = manifest.version >= 6 && Array.isArray(item.mediaTypes) ? rows(item.mediaTypes, MAX_COMPONENT_FILES) : []
    const assets = (await Promise.all(names.map((name, index) => file(name, allowed, false, types[index])))).filter(Boolean)
    const normalized = voiceComponent && manifest.version < 6 ? await Promise.all(assets.map(normalizeVoiceReference)) : assets
    return normalizeComponent({ id: componentIds.get(item.id) || uuid(), type, title: text(item.title, 80), prompt: text(item.prompt, 20000),
      files: normalized, voiceId: componentIds.get(item.voiceId), sourceClipId: clipIds.get(item.sourceClipId), kind: text(item.kind, 40) })
  }))
  const sceneScripts = scriptRows.map(item => cleanSceneScript({ ...item, id: scriptIds.get(item.id),
    componentIds: rows(item.componentIds, 12).map(id => componentIds.get(id)).filter(Boolean) }))
  const frames = async (items, max) => Promise.all(rows(items, max).map(name => file(name, imageTypes)))
  const recordingName = ['aitoia-video.mp4', 'aitoia-video.webm'].find(name => files.has(name))
  let remake
  if (manifest.version >= 5 && manifest.remake) {
    const source = manifest.remake
    const references = values => rows(values, manifest.version >= 6 ? 200 : 6).map(id => componentIds.get(id)).filter(Boolean)
    const cutRows = rows(source.scenes, 200)
    const indexes = new Set(cutRows.map(item => item?.index))
    if (indexes.size !== cutRows.length || cutRows.some(item => !item || !Number.isSafeInteger(item.index) || item.index < 0 ||
      !Number.isFinite(item.start) || item.start < 0 || !Number.isFinite(item.duration) || item.duration <= 0 ||
      item.duration > maxRemakeSceneSeconds)) throw invalid()
    const remakeResolutions = ['480p', '720p', '1080p']
    remake = { master: text(source.master, 20000), referenceIds: references(source.referenceIds),
      resolution: remakeResolutions.includes(source.resolution) ? source.resolution : '480p',
      splitDuration: remakeSplitDurations.includes(source.splitDuration) ? source.splitDuration : remakeSplitDurations[0],
      scenes: await Promise.all(cutRows.map(async item => {
        const resultFile = await file(item.result?.media, videoTypes)
        const result = resultFile && { id: clipIds.get(item.result.id) || uuid(), file: resultFile,
          title: text(item.result.title, 80) || `Cena ${item.index + 1} refeita`, duration: item.duration,
          captions: item.result.captions === true, kind: 'scene' }
        return { index: item.index, start: item.start, duration: item.duration, file: await file(item.media, videoTypes),
          providerDuration: Number.isFinite(item.providerDuration) && item.providerDuration >= item.duration &&
            item.providerDuration <= maxRemakeSceneSeconds ? item.providerDuration : item.duration,
          modelId: text(item.modelId, 80), resolution: remakeResolutions.includes(item.resolution) ? item.resolution : '',
          edit: text(item.edit, 20000), dialogue: text(item.dialogue, 600), subtitleRegion: readSubtitleRegion(item.subtitleRegion),
          caption: text(item.caption, 180), captions: item.captions === true, plan: text(item.plan, 20000), planGenerated: Boolean(item.planGenerated || item.plan),
          transcript: text(item.transcript, 2000), referenceIds: item.referenceIds === null ? null : references(item.referenceIds), result }
      })) }
  }
  return { title, formatId: format.id, projectColor: text(manifest.projectColor, 7), scenes, sceneId: scenes[0].id,
    clips: clips.map(({ originalId: _id, ...clip }) => clip), selectedClipId: clips[0]?.id, components, componentTypes, remake,
    masterScript: text(manifest.plan?.master, 20000), sceneScripts,
    promptComponentIds: mappedComponents(manifest.promptComponentIds), masterComponentIds: mappedComponents(manifest.masterComponentIds),
    prompt: text(manifest.configuration?.prompt, 20000), scriptPrompt: text(manifest.configuration?.scriptPrompt, 20000),
    generationMode: text(manifest.configuration?.mode, 30), videoModel: text(manifest.configuration?.model, 80),
    referenceModelId: text(manifest.configuration?.referenceModel, 80),
    narrationText: text(manifest.narration?.text, 12000), narration: await file(manifest.narration?.media, audioTypes),
    recording: await file(recordingName, videoTypes, true), reference: await file(manifest.references?.video, videoTypes, false, manifest.references?.videoType),
    codeBackground: await file(manifest.references?.codeBackground, artworkTypes),
    transitionClips: await Promise.all(rows(manifest.references?.transition, 2).map((name, index) => file(name, videoTypes, false, manifest.references?.transitionTypes?.[index]))),
    referenceImages: (await frames(manifest.references?.images, 10)).filter(Boolean), sourceFrames: (await frames(manifest.references?.keyframes, 8)).filter(Boolean) }
}

export function exportMarketingProject(project, components = []) {
  const files = []
  const add = (blob, name) => {
    if (!blob) return undefined
    files.push({ name, blob })
    return name
  }
  const exportMedia = (items, prefix) => items.map(({ blob, label, format }, index) => {
    return { label, media: add(blob, `midias/${prefix}-${index + 1}`), formatId: format?.id }
  })
  const manifest = { format: 'aitoia-marketing', version: 2, title: project.title, formatId: project.formatId, prompt: project.prompt,
    palette: project.palette, references: exportMedia(project.references || [], 'referencia'),
    images: exportMedia(project.images || [], 'imagem'), selectedImage: project.images?.findIndex(item => item.id === project.imageId),
    components: components.map((component, index) => {
      const files = normalizeComponent({ title: component.label, files: filesForComponent({ files: component.files, file: component.blob }) }).files
      return { label: component.label, text: component.text, media: files.map((blob, fileIndex) => add(blob, `midias/componente-${index + 1}-${fileIndex + 1}`)),
        mediaTypes: files.map(file => file.type), selected: project.selectedKit?.includes(component.id) || false }
    }) }
  return zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...files])
}
