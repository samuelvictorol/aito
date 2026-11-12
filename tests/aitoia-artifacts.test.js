import assert from 'node:assert/strict'
import test from 'node:test'
import { artifactReferences, fileFromArtifact } from '../src/services/aitoiaArtifacts.js'
import { requestMessages } from '../src/services/aitoiaChat.js'

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
