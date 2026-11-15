import { sampleVideoFrames } from './aitoiaVideoRemote.js'
import { extractRemakeAudio } from './aitoiaVideoRemakeSplit.js'

const endpoint = '/aitoia/video/studio/remakes/plan'

export async function quoteRemakePlan({ apiGet, signal }) {
  const result = await apiGet(endpoint + '/quote', { signal })
  return result.data?.data ?? result.data ?? result
}

async function encodeAudio(file) {
  if (!file) return undefined
  const bytes = new Uint8Array(await file.arrayBuffer())
  const parts = []
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
  }
  return btoa(parts.join(''))
}

export async function prepareRemakePlan({
  file, master, scenePrompt, captions, characterNames, walletId, maxBilledUsdCents, apiPost, signal,
}) {
  const [frames, audioFile] = await Promise.all([
    sampleVideoFrames(file, signal, { maxSide: 384, fractions: [0.15, 0.75], jpegQuality: 0.66 }),
    extractRemakeAudio(file, { signal }),
  ])
  const audio = await encodeAudio(audioFile)
  const result = await apiPost(endpoint, {
    walletId, master, scenePrompt, captions, characterNames, maxBilledUsdCents,
    audio, frames: frames.map(frame => frame.url),
  }, { signal, headers: { 'X-Aito-Request-Id': crypto.randomUUID() } })
  return result.data?.data ?? result.data ?? result
}
