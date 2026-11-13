import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { youtubeEmbedUrl, landingVideoSource } from '../src/services/landingVideoSources.js'
import { landingVideoPages } from '../src/data/landingVideoSlots.js'

const id = 'uOTy7V6n_WU'
const fallback = '/videos/presentation.mp4'
const watch = `https://www.youtube.com/watch?v=${id}`
test('landing monitors only embed video IDs from accepted YouTube URL forms', () => {
  for (const url of [watch, `youtu.be/${id}?si=share`, `https://www.youtube.com/shorts/${id}`,
    `https://m.youtube.com/live/${id}`, `https://www.youtube-nocookie.com/embed/${id}`]) {
    assert.equal(youtubeEmbedUrl(url), `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`)
  }
  for (const url of [`https://youtube.com.evil.invalid/watch?v=${id}`, `https://admin@www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&v=ekZtwCJvH1g`, 'javascript:alert(1)']) {
    assert.equal(youtubeEmbedUrl(url), '')
  }
})

test('missing, cleared and malformed overrides preserve the expected monitor behavior', () => {
  const slot = 'home-presentation'
  assert.equal(landingVideoSource({}, slot, fallback), fallback)
  assert.equal(landingVideoSource({ [slot]: null }, slot, fallback), '')
  assert.equal(landingVideoSource({ [slot]: watch }, slot, fallback), watch)
  assert.equal(landingVideoSource({ [slot]: 'https://example.com/video' }, slot, fallback), fallback)
})

test('each labeled landing slot is wired to a unique public monitor', async () => {
  const files = ['pages/AitoLanding3DPage.vue', 'pages/WhatsAppBotBuilderProductPage.vue', 'components/DesktopSolutionFeatures.vue',
    'pages/WhatsAppWhitelabelProductPage.vue', 'pages/AitoTokensPage.vue', 'pages/AitoLearnLaunchPage.vue']
  const sources = (await Promise.all(files.map(file => readFile(new URL('../src/' + file, import.meta.url), 'utf8')))).join('\n')
  const ids = landingVideoPages.flatMap(page => page.slots.map(slot => slot.id))
  assert.equal(ids.length, new Set(ids).size)
  for (const id of ids) assert.equal(sources.split(id).length - 1, 1, id)
})
