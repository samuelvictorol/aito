import test from 'node:test'
import assert from 'node:assert/strict'
import { checkImageReference, putImageReference, putVideoReference, readGeneratedClipForJob } from '../src/services/aitoiaVideoRemote.js'

test('accepts supported image types and resolves a blank browser MIME from the filename', () => {
  assert.equal(checkImageReference(new File(['image'], 'cena.JPG')), 'image/jpeg')
  assert.equal(checkImageReference(new File(['image'], 'cena', { type: 'image/webp' })), 'image/webp')
  assert.throws(() => checkImageReference(new File(['image'], 'cena.jpg', { type: 'image/gif' })), /10 MB/)
  assert.throws(() => checkImageReference({ name: 'cena.png', size: 10 * 1024 * 1024 + 1 }), /10 MB/)
  assert.throws(() => checkImageReference(new File([], 'cena.png')), /10 MB/)
})

test('uses the signed headers on a credential-free direct PUT and rejects an unsafe ticket', async t => {
  const file = new File(['image'], 'cena.jpg', { type: 'image/jpeg' })
  const video = new File(['video'], 'cena.mp4', { type: 'video/mp4' })
  const signal = new AbortController().signal
  const ticket = { uploadUrl: 'https://storage.example.test/ref?signature=fixture', referenceToken: 'sealed-reference',
    uploadHeaders: { 'Content-Type': 'image/jpeg', 'X-Amz-Tagging': 'retention=temporary' } }
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200 }))
  await assert.rejects(putImageReference(file, { ...ticket, uploadHeaders: { ...ticket.uploadHeaders, Authorization: 'invalid' } }, signal), /autorizou/)
  await assert.rejects(putVideoReference(video, ticket, signal), /autorizou/)
  assert.equal(request.mock.callCount(), 0)
  assert.equal(await putImageReference(file, ticket, signal), ticket.referenceToken)
  const [url, init] = request.mock.calls[0].arguments
  assert.equal(url, ticket.uploadUrl)
  assert.equal(init.method, 'PUT')
  assert.equal(init.body, file)
  assert.equal(init.credentials, 'omit')
  assert.equal(init.referrerPolicy, 'no-referrer')
  assert.equal(init.redirect, 'error')
  assert.equal(init.signal, signal)
  assert.deepEqual(Object.fromEntries(init.headers), { 'content-type': 'image/jpeg', 'x-amz-tagging': 'retention=temporary' })
})

test('downloads through the authenticated job only when a remote clip is unreadable', async t => {
  const signal = new AbortController().signal
  const remote = t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers, undefined)
    throw new TypeError('Unavailable from the browser')
  })
  const authorizedFetch = t.mock.fn(async (url, options) => {
    assert.equal(url, '/aitoia/video/generations/job%2Fid/file')
    assert.deepEqual(options, { responseType: 'blob', signal })
    return { data: new Blob(['clip fixture'], { type: 'video/mp4' }) }
  })
  const job = { id: 'job/id', remoteUrl: 'https://video.example.test/clip.mp4' }
  const file = await readGeneratedClipForJob(job, signal, authorizedFetch)
  assert.equal(file.name, 'clipe-aitoia.mp4')
  assert.equal(await file.text(), 'clip fixture')
  assert.equal(await readGeneratedClipForJob({ ...job, file }, signal, authorizedFetch), file)
  assert.equal(remote.mock.callCount(), 1)
  assert.equal(authorizedFetch.mock.callCount(), 1)
})
