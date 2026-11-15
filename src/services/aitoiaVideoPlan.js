import { maxStudioScenes } from './aitoiaVideo.js'

export const studioAiSeconds = [1, 2, 3, 4, 5]
export const voiceComponentType = 'Vozes'

const audioSampleRate = 24000
const maxAudioSampleSeconds = 3
const maxRawVoiceBytes = 5 * 1024 * 1024

export function sceneScriptSeconds(value) {
  const seconds = Number(value)
  return studioAiSeconds.includes(seconds) ? seconds : 5
}

export function cleanSceneScript(item) {
  return {
    id: item?.id || crypto.randomUUID(),
    title: typeof item?.title === 'string' ? item.title.slice(0, 100) : '',
    prompt: typeof item?.prompt === 'string' ? item.prompt.slice(0, 1500) : '',
    duration: sceneScriptSeconds(item?.duration),
    modelId: typeof item?.modelId === 'string' ? item.modelId.slice(0, 80) : '',
    componentIds: Array.isArray(item?.componentIds) ? item.componentIds.filter(id => typeof id === 'string').slice(0, 12) : [],
  }
}

export function parseVideoPlan(text, componentIds) {
  let result
  try { result = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')) }
  catch { throw new Error('A IA não retornou um roteiro válido. Tente novamente.') }
  if (!result || !Array.isArray(result.scenes) || !result.scenes.length || result.scenes.length > maxStudioScenes) {
    throw new Error('A IA não retornou cenas válidas para o roteiro.')
  }
  return {
    master: typeof result.master === 'string' ? result.master.trim().slice(0, 6000) : '',
    scenes: result.scenes.map(item => {
      const scene = cleanSceneScript({ ...item, id: undefined, modelId: undefined })
      return { ...scene, componentIds: scene.componentIds.filter(id => componentIds.has(id)) }
    }),
  }
}

// Normalize short audio to a small, predictable PCM format for the video provider.
export async function normalizeVoiceReference(file) {
  if (!file?.size || file.size > maxRawVoiceBytes || file.type && !file.type.startsWith('audio/')) {
    throw new Error('Escolha um arquivo de áudio de até 5 MB e 3 segundos.')
  }
  const context = new OfflineAudioContext(1, 1, audioSampleRate)
  let audio
  try { audio = await context.decodeAudioData(await file.arrayBuffer()) }
  catch { throw new Error('O navegador não conseguiu ler este áudio. Tente um arquivo MP3, WAV ou M4A.') }
  if (!audio.length || audio.length > audioSampleRate * maxAudioSampleSeconds) {
    throw new Error('Cada voz pode ter até 3 segundos.')
  }
  const bytes = new ArrayBuffer(44 + audio.length * 2)
  const header = new DataView(bytes)
  header.setUint32(0, 0x52494646)
  header.setUint32(4, bytes.byteLength - 8, true)
  header.setUint32(8, 0x57415645)
  header.setUint32(12, 0x666d7420)
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true)
  header.setUint16(22, 1, true)
  header.setUint32(24, audioSampleRate, true)
  header.setUint32(28, audioSampleRate * 2, true)
  header.setUint16(32, 2, true)
  header.setUint16(34, 16, true)
  header.setUint32(36, 0x64617461)
  header.setUint32(40, bytes.byteLength - 44, true)
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index))
  for (let index = 0; index < audio.length; index++) {
    const sample = channels.reduce((sum, channel) => sum + channel[index], 0) / channels.length
    header.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true)
  }
  return new File([bytes], file.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' })
}
