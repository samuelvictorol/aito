import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeComponent, filesForComponent, componentReferenceEntries, componentReferenceFiles, referencedComponentIds, componentFileName } from '../src/services/aitoiaComponentReferences.js'
import { zipAitoIAFiles } from '../src/services/aitoiaArchive.js'
import { exportMarketingProject, readStudioProject } from '../src/services/aitoiaStudioArchive.js'
import { commonVideoType } from '../src/services/aitoiaVideoCompatibility.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+rLf0AAAAASUVORK5CYII=', 'base64')
const image = name => new File([png], name, { type: 'image/png', lastModified: 1234 })

test('a component retains several independent references and renames files without altering bytes or shared inputs', async () => {
  const front = image('frente.png'), back = image('costas.png')
  const original = { id: 'bmw', type: 'Carros', title: 'BMW M3', files: [front, back], file: front }
  const component = normalizeComponent(original)
  assert.equal(component.file, component.files[0])
  assert.deepEqual(component.files.map(file => file.name), ['BMW M3-1.png', 'BMW M3-2.png'])
  assert.equal(front.name, 'frente.png')
  assert.equal(component.files[0].lastModified, 1234)
  for (const file of component.files) assert.deepEqual(Buffer.from(await file.arrayBuffer()), png)
  assert.deepEqual(filesForComponent({ file: front }), [front])
  assert.deepEqual(filesForComponent({ files: [front, front, back], file: front }), [front, back])
  assert.equal(normalizeComponent(original).files[0], component.files[0], 'stable files avoid duplicate reference upload on rerender')
  assert.ok(!/[\\/:*?"<>|\u0000-\u001f]/.test(componentFileName('../BMW : M3', front)))
})

test('selected objects flatten all their references in stable order while unselected objects are excluded', () => {
  const components = [normalizeComponent({ id: 'bmw', type: 'Carros', title: 'BMW M3', files: [image('frente'), image('lado')] }),
    normalizeComponent({ id: 'logo', type: 'Marca', title: 'Logo', file: image('logo') })]
  const entries = componentReferenceEntries(components, ['bmw'])
  assert.deepEqual(entries.map(item => [item.componentId, item.title, item.index]), [['bmw', 'BMW M3', 0], ['bmw', 'BMW M3', 1]])
  assert.equal(componentReferenceFiles(components, ['bmw']).length, 2)
  assert.deepEqual(componentReferenceFiles(components, []), [])
  assert.equal(componentReferenceFiles(components).length, 3)
  assert.deepEqual(referencedComponentIds('Use @BMW M3 e preserve a luz.', components, ['bmw']), ['bmw'])
  assert.deepEqual(referencedComponentIds('Use @BMW M33 e preserve a luz.', components, ['bmw']), [])
})

test('version-six ZIP restores every image of custom objects, named files, links and twenty-thousand-character prompts', async () => {
  const text = 'A'.repeat(20000)
  const manifest = { format: 'aitoia-video', version: 6, aspectRatio: '9:16', scenes: [{}],
    components: [{ id: 'car', title: 'BMW M3', type: 'Carros', media: ['midias/frente.png', 'midias/lado.png'], prompt: text }],
    plan: { master: text, scenes: [{ id: 'cena', prompt: text, componentIds: ['car'] }] },
    promptComponentIds: ['car'], masterComponentIds: ['car'], configuration: { prompt: text, scriptPrompt: text }, remake: { master: text, referenceIds: ['car'], scenes: [{ index: 0, start: 0, duration: 5,
      edit: text, plan: text, planGenerated: true, referenceIds: ['car'] }] } }
  const zip = await zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(manifest)]) },
    { name: 'midias/frente.png', blob: image('frente') }, { name: 'midias/lado.png', blob: image('lado') }])
  const project = await readStudioProject(zip, 'video')
  assert.equal(project.components[0].files.length, 2)
  assert.equal(project.components[0].file, project.components[0].files[0])
  assert.deepEqual(project.components[0].files.map(file => file.name), ['BMW M3-1.png', 'BMW M3-2.png'])
  for (const file of project.components[0].files) assert.deepEqual(Buffer.from(await file.arrayBuffer()), png)
  assert.equal(project.sceneScripts[0].componentIds[0], project.components[0].id)
  assert.equal(project.promptComponentIds[0], project.components[0].id)
  assert.equal(project.masterComponentIds[0], project.components[0].id)
  assert.equal(project.remake.referenceIds[0], project.components[0].id)
  assert.equal(project.remake.scenes[0].referenceIds[0], project.components[0].id)
  for (const value of [project.prompt, project.scriptPrompt, project.masterScript, project.components[0].prompt, project.remake.master, project.remake.scenes[0].edit, project.remake.scenes[0].plan]) assert.equal(value.length, 20000)
})

test('marketing portable components retain every angle and draft selections independently of the generation reference cap', async () => {
  const files = Array.from({ length: 7 }, (_, index) => image(`angulo-${index}.png`))
  const archive = await exportMarketingProject({ title: 'Campanha', formatId: 'feed', prompt: 'A'.repeat(20000), selectedKit: ['car'], references: [], images: [] },
    [{ id: 'car', label: 'BMW M3', text: 'Vários ângulos do mesmo carro', files, blob: files[0] }])
  const restored = await readStudioProject(archive, 'marketing')
  assert.equal(restored.prompt.length, 20000)
  assert.equal(restored.projectKit[0].files.length, 7)
  assert.equal(restored.projectKit[0].blob, restored.projectKit[0].files[0])
  assert.equal(restored.projectKit[0].id, restored.selectedKit[0])
  assert.deepEqual(restored.projectKit[0].files.map(file => file.name), files.map((_, index) => `BMW M3-${index + 1}.png`))
})

test('version-six remake retains more than six text-only component selections and remaps every identity', async () => {
  const components = Array.from({ length: 9 }, (_, index) => ({ id: `object-${index}`, title: `Objeto ${index + 1}`, type: 'Produtos', prompt: 'Descrição reutilizável' }))
  const ids = components.map(item => item.id)
  const manifest = { format: 'aitoia-video', version: 6, aspectRatio: '16:9', scenes: [{}], components,
    remake: { master: 'Use os objetos mencionados.', referenceIds: ids, scenes: [{ index: 0, start: 0, duration: 5, edit: 'Mantenha as referências.', referenceIds: ids }] } }
  const archive = await zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(manifest)]) }])
  const copy = await readStudioProject(archive, 'video')
  const importedIds = copy.components.map(item => item.id)
  assert.equal(importedIds.length, 9)
  assert.deepEqual(copy.remake.referenceIds, importedIds)
  assert.deepEqual(copy.remake.scenes[0].referenceIds, importedIds)
})

test('version-six common raw video references survive ZIP import byte-for-byte with their container MIME', async () => {
  const bmff = brand => { const bytes = Buffer.alloc(20); bytes.writeUInt32BE(20, 0); bytes.write('ftyp', 4); bytes.write(brand, 8); bytes.write('mp42', 16); return bytes }
  const samples = [
    ['iphone.mov', 'video/quicktime', bmff('qt  ')],
    ['produto.m4v', 'video/x-m4v', bmff('isom')],
    ['antigo.3gp', 'video/3gpp', bmff('3gp6')],
    ['camera.avi', 'video/x-msvideo', Buffer.from([82, 73, 70, 70, 4, 0, 0, 0, 65, 86, 73, 32])],
    ['desktop.mkv', 'video/x-matroska', Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from('matroska')])],
    ['browser.webm', 'video/webm', Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from('webm')])],
  ]
  const assets = samples.map(([name, type, bytes]) => ({ name: 'midias/' + name, blob: new Blob([bytes], { type }) }))
  const metadata = { format: 'aitoia-video', version: 6, aspectRatio: '16:9', scenes: [{}],
    components: [{ id: 'videos', title: 'Referências', type: 'Produtos', media: assets.map(item => item.name), mediaTypes: samples.map(item => item[1]) }],
    references: { video: 'midias/referencia-semext', videoType: 'video/x-m4v', transition: ['midias/transicao-semext'], transitionTypes: ['video/quicktime'] } }
  const archive = await zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(metadata)]) }, ...assets,
    { name: 'midias/referencia-semext', blob: new Blob([bmff('isom')]) }, { name: 'midias/transicao-semext', blob: new Blob([bmff('qt  ')]) }])
  const copy = await readStudioProject(archive, 'video')
  for (let index = 0; index < samples.length; index++) {
    const file = copy.components[0].files[index]
    assert.equal(file.type, samples[index][1])
    assert.equal(commonVideoType(file), samples[index][1])
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), samples[index][2])
  }
  assert.equal(copy.reference.type, 'video/x-m4v')
  assert.equal(copy.transitionClips[0].type, 'video/quicktime')
  const invalid = { ...metadata, components: [{ id: 'bad', title: 'Arquivo', type: 'Produtos', media: ['midias/falso.mov'], mediaTypes: ['video/quicktime'] }], references: undefined }
  for (const bytes of [Buffer.from('not a video file'), bmff('xxxx').subarray(0, 16)]) {
    const badZip = await zipAitoIAFiles([{ name: 'projeto.json', blob: new Blob([JSON.stringify(invalid)]) }, { name: 'midias/falso.mov', blob: new Blob([bytes]) }])
    await assert.rejects(readStudioProject(badZip, 'video'), /ZIP precisa conter/)
  }
})
