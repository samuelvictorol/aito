import assert from 'node:assert/strict'
import test from 'node:test'
import { zipAitoIAFiles } from '../src/services/aitoiaArchive.js'
import { exportMarketingProject, readStudioProject } from '../src/services/aitoiaStudioArchive.js'

const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+rLf0AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' })
const zip = (project, files = []) => zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(project)]) }, ...files])

test('video restores all three legacy manifest versions and resets retention for recovered media', async () => {
  for (const version of [1, 2, 3]) {
    const file = 'midias/cena-1-referência.png'
    const blob = await zip({ format: 'aitoia-video', version, title: 'Legado', aspectRatio: '9:16', expiresAt: 1,
      scenes: [{ heading: 'Introdução', duration: 8, media: file, expiresAt: 1 }] }, [{ name: file, blob: png }])
    const project = await readStudioProject(blob, 'video', { expiresAt: Date.now() + 1000 })
    assert.equal(project.formatId, 'portrait')
    assert.equal(project.scenes[0].heading, 'Introdução')
    assert.equal(project.scenes[0].duration, 8)
    assert.equal(project.scenes[0].file.type, 'image/png')
    assert.equal(project.scenes[0].expiresAt, undefined)
    assert.equal(project.expiresAt, undefined)
    await assert.rejects(readStudioProject(blob, 'marketing'), /ZIP precisa conter/)
  }
})

test('version four preserves the project script and remaps reusable component and scene links', async () => {
  const blob = await zip({ format: 'aitoia-video', version: 4, aspectRatio: '9:16', projectColor: '#FEAD33',
    scenes: [{ heading: 'Entrada', duration: 3, scriptId: 'cena' }],
    plan: { master: 'Apresente a ideia', scenes: [{ id: 'cena', title: 'Entrada', prompt: 'Plano aberto', duration: 3,
      componentIds: ['personagem'] }] },
    components: [{ id: 'personagem', type: 'Personagens', title: 'Protagonista', voiceId: 'voz' },
      { id: 'voz', type: 'Vozes', title: 'Voz principal' }],
  })
  const project = await readStudioProject(blob, 'video')
  assert.equal(project.projectColor, '#FEAD33')
  assert.equal(project.masterScript, 'Apresente a ideia')
  assert.equal(project.sceneScripts[0].duration, 3)
  assert.equal(project.scenes[0].scriptId, project.sceneScripts[0].id)
  assert.equal(project.sceneScripts[0].componentIds[0], project.components[0].id)
  assert.equal(project.components[0].voiceId, project.components[1].id)
})

test('video archive restores original cuts and remake results linked to saved video components', async () => {
  const source = 'midias/cena-original.mp4'
  const result = 'midias/cena-refeita.mp4'
  const subtitleRegion = { x: .1, y: .75, width: .8, height: .15 }
  const mp4 = new Blob([Buffer.from([0, 0, 0, 12, 102, 116, 121, 112, 109, 112, 52, 50])], { type: 'video/mp4' })
  const blob = await zip({ format: 'aitoia-video', version: 5, aspectRatio: '16:9',
    scenes: [{ heading: 'Transição', duration: 3, clipId: 'clip', kind: 'transition', media: result }],
    clips: [{ id: 'clip', title: 'transition-1-2', kind: 'transition', media: result }],
    components: [{ id: 'component', title: 'transition-1-2', type: 'Cenas', sourceClipId: 'clip', kind: 'transition', media: result }],
    remake: { master: 'Preserve o ritmo', splitDuration: 10, scenes: [{ index: 1, start: 10, duration: 10, edit: 'Aproxime a câmera',
      dialogue: 'Ana: Chegamos cedo.', subtitleRegion,
      media: source, referenceIds: null, result: { id: 'clip', title: 'Cena 2 refeita', media: result } }] },
  }, [{ name: source, blob: mp4 }, { name: result, blob: mp4 }])
  const project = await readStudioProject(blob, 'video', { expiresAt: Date.now() + 10000 })
  assert.equal(project.clips[0].title, 'transition-1-2')
  assert.equal(project.components[0].file.type, 'video/mp4')
  assert.equal(project.components[0].sourceClipId, project.clips[0].id)
  assert.equal(project.remake.master, 'Preserve o ritmo')
  assert.equal(project.remake.splitDuration, 10)
  assert.equal(project.remake.scenes[0].start, 10)
  assert.equal(project.remake.scenes[0].duration, 10)
  assert.equal(project.remake.scenes[0].edit, 'Aproxime a câmera')
  assert.equal(project.remake.scenes[0].dialogue, 'Ana: Chegamos cedo.')
  assert.deepEqual(project.remake.scenes[0].subtitleRegion, subtitleRegion)
  assert.equal(project.remake.scenes[0].file.name, 'cena-original.mp4')
  assert.equal(project.remake.scenes[0].result.id, project.clips[0].id)
  assert.equal(project.remake.scenes[0].result.file.name, 'cena-refeita.mp4')
})

test('marketing ZIP restores palette, images, references and selected reusable components', async () => {
  const original = { title: 'Campanha', formatId: 'feed', prompt: 'Criar campanha', palette: ['#AABBCC'],
    selectedKit: ['logo'], references: [{ label: 'Referência', blob: png }],
    images: [{ id: 'image', label: 'Resultado', blob: png, format: { id: 'story' } }], imageId: 'image' }
  const archive = await exportMarketingProject(original, [{ id: 'logo', label: 'Logo', text: 'Descrição', blob: png }])
  const copy = await readStudioProject(archive, 'marketing')
  assert.deepEqual(copy.palette, original.palette)
  assert.equal(copy.references[0].blob.size, png.size)
  assert.equal(copy.images[0].id, copy.imageId)
  assert.equal(copy.images[0].format.id, 'story')
  assert.equal(copy.projectKit[0].id, copy.selectedKit[0])
  assert.equal(copy.projectKit[0].text, 'Descrição')
})

test('rejects invalid formats, missing media, altered ZIPs and unsafe paths', async () => {
  const project = { format: 'aitoia-video', version: 3, aspectRatio: '16:9', scenes: [{ duration: 4 }] }
  await assert.rejects(readStudioProject(await zip({ ...project, version: 999 }), 'video'), /ZIP precisa conter/)
  await assert.rejects(readStudioProject(await zip({ ...project, scenes: [{ media: 'midias/faltando.png' }] }), 'video'), /ZIP precisa conter/)
  await assert.rejects(readStudioProject(await zip(project, [{ name: '../evil.png', blob: png }]), 'video'), /ZIP precisa conter/)
  const bytes = new Uint8Array(await (await zip(project)).arrayBuffer())
  bytes[50] ^= 1
  await assert.rejects(readStudioProject(new Blob([bytes]), 'video'), /ZIP precisa conter/)
})
