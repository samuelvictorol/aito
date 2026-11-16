import assert from 'node:assert/strict'
import test from 'node:test'
import { artifactReferences, fileFromArtifact } from '../src/services/aitoiaArtifacts.js'
import { checkAttachment, fileKind, requestMessages } from '../src/services/aitoiaChat.js'

test('chat exports usable PDF, Word and JSON files from model output', async () => {
  const artifact = { title: '../Relatório', content: '# Orçamento\n\nRevisão concluída.' }
  const pdf = await fileFromArtifact({ ...artifact, format: 'pdf' })
  assert.equal(pdf.name, '_Relatório.pdf')
  assert.equal(await pdf.blob.slice(0, 5).text(), '%PDF-')
  const word = await fileFromArtifact({ ...artifact, format: 'docx' })
  assert.deepEqual([...new Uint8Array(await word.blob.slice(0, 4).arrayBuffer())], [80, 75, 3, 4])
  const json = await fileFromArtifact({ ...artifact, format: 'json', content: '{"versão":1}' })
  assert.deepEqual(JSON.parse(await json.blob.text()), { versão: 1 })
  await assert.rejects(fileFromArtifact({ ...artifact, format: 'json' }), SyntaxError)
})

test('assistant output files are available as references without being resent as assistant-role blobs', async () => {
  const attachment = { id: 'image-1', type: 'image/webp', blob: new Blob(['output']) }
  const messages = [{ role: 'assistant', text: 'Sua imagem está pronta.', attachments: [attachment] },
    { role: 'user', text: 'Mude a cor.' }]
  assert.deepEqual(artifactReferences(messages), [attachment])
  const { input } = await requestMessages(messages)
  assert.deepEqual(input[0].content, [{ type: 'input_text', text: 'Sua imagem está pronta.' }])
})

test('chat combines timestamped video frames and a reusable transcript without uploading the original', async t => {
  const times = []
  class Video extends EventTarget {
    readyState = 2
    duration = 8
    videoWidth = 1920
    videoHeight = 1080
    removeAttribute() {}
    load() {}
    get currentTime() { return times.at(-1) || 0 }
    set currentTime(value) { times.push(value) }
  }
  const canvas = { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,YQ==' }
  t.mock.method(globalThis.URL, 'createObjectURL', () => 'blob:fixture')
  const revoked = t.mock.method(globalThis.URL, 'revokeObjectURL', () => {})
  globalThis.document = { createElement: name => name === 'canvas' ? canvas : new Video() }
  t.after(() => { delete globalThis.document })
  const attachment = { name: 'cenas.mp4', type: 'video/mp4', blob: new Blob(['source-video'], { type: 'video/mp4' }) }
  assert.equal(fileKind(attachment), 'video')
  assert.equal(checkAttachment({ ...attachment, size: 49 * 1024 * 1024 }), 'O vídeo pode ter até 48 MB.')
  const messages = [{ role: 'user', text: 'Resuma as cenas', attachments: [attachment] }]
  const transcribeVideo = t.mock.fn(async file => {
    assert.equal(file, attachment)
    return 'Bem-vindo ao nosso vídeo!'
  })
  const { input } = await requestMessages(messages, { transcribeVideo })
  const content = input[0].content
  assert.equal(content.filter(part => part.type === 'input_image').length, 5)
  assert.equal(content.filter(part => part.type === 'input_file').length, 0)
  assert.equal(canvas.width, 768)
  assert.deepEqual(times.map(time => +time.toFixed(3)), [1.995, 3.99, 5.985, 7.98])
  assert.match(content[1].text, /amostras em ordem cronológica/)
  assert.match(content[2].text, /Quadro em 0.00 s/)
  assert.match(content.at(-1).text, /Bem-vindo ao nosso vídeo!/)
  assert.equal(transcribeVideo.mock.callCount(), 1)
  assert.equal(revoked.mock.callCount(), 1)

  attachment.videoTranscript = 'Transcrição já disponível.'
  times.length = 0
  const followUp = await requestMessages([...messages, { role: 'user', text: 'O que foi dito?' }], { transcribeVideo })
  assert.match(followUp.input[0].content.at(-1).text, /Transcrição já disponível/)
  assert.equal(transcribeVideo.mock.callCount(), 1)
})
