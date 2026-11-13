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
