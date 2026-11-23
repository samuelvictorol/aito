import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { checkImageReference, checkVideoReference, normalizeVideoReference, putImageReference, putVideoReference, readGeneratedClip, readGeneratedClipForJob } from '../src/services/aitoiaVideoRemote.js'

test('accepts a 9 MB MP4 with a generic browser MIME and separates format and size errors', () => {
  const bytes = new Uint8Array(9 * 1024 * 1024)
  const file = new File([bytes], 'video-base.MP4', { type: 'application/octet-stream', lastModified: 123 })
  const normalized = normalizeVideoReference(file)
  assert.equal(normalized.type, 'video/mp4')
  assert.equal(normalized.size, file.size)
  assert.equal(normalized.name, file.name)
  assert.equal(normalized.lastModified, file.lastModified)
  assert.equal(normalizeVideoReference(normalized), normalized)
  assert.equal(checkVideoReference(new File([bytes], 'camera.mp4', { type: 'video/quicktime' })), 'video/quicktime')
  assert.equal(checkVideoReference(new File([bytes], 'camera.mov', { type: 'video/quicktime' })), 'video/quicktime')
  assert.equal(checkVideoReference(new File([bytes], 'camera.webm', { type: 'video/webm' })), 'video/webm')
  assert.throws(() => checkVideoReference({ name: 'camera.mp4', size: 60 * 1024 * 1024 + 1 }), /limite de 60 MB/)
  assert.throws(() => checkVideoReference(new File([], 'camera.mp4')), /vazio/)
})

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

test('rejects incomplete provider downloads and accepts real video bytes with a generic storage MIME', async t => {
  const response = t.mock.method(globalThis, 'fetch', async () => new Response('incomplete', { headers: { 'Content-Type': 'video/mp4', 'Content-Length': '200' } }))
  const signal = new AbortController().signal
  await assert.rejects(readGeneratedClip('https://video.example.test/clip.mp4', signal), /incompleto/)
  response.mock.mockImplementation(async () => new Response('complete', { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '8' } }))
  const file = await readGeneratedClip('https://video.example.test/clip.mp4', signal)
  assert.equal(file.type, 'video/mp4')
  assert.equal(file.name, 'clipe-aitoia.mp4')
  assert.equal(await file.text(), 'complete')
})

test('recovers missing or empty stored blobs using the source generation instead of a copied component id', async t => {
  const remote = t.mock.method(globalThis, 'fetch', async () => { throw Error('expired URL') })
  const get = t.mock.fn(async path => {
    assert.equal(path, '/aitoia/video/generations/owner%2Fgeneration/file')
    return { data: new Blob(['original'], { type: 'video/mp4' }) }
  })
  const file = await readGeneratedClipForJob({ id: 'component-copy', sourceClipId: 'owner/generation', file: new Blob([], { type: 'video/mp4' }),
    remoteUrl: 'https://video.example.test/expired.mp4' }, new AbortController().signal, get)
  assert.equal(await file.text(), 'original')
  assert.equal(get.mock.callCount(), 1)
  assert.equal(remote.mock.callCount(), 1)
})

test('a fresh or cached generated movie is normalized before use but healthy AVC bytes need no conversion', async t => {
  const bytes = await readFile(new URL('fixtures/avc-clip.mp4', import.meta.url))
  const source = new File([bytes], 'original.mp4', { type: 'video/mp4' })
  const post = t.mock.fn(async () => { throw Error('must not convert a compatible movie') })
  const signal = new AbortController().signal
  assert.equal(await readGeneratedClipForJob({ id: 'source', file: source }, signal, null, post), source)
  assert.equal(post.mock.callCount(), 0)
  const webm = new File(['provider webm'], 'generated.webm', { type: 'video/webm' })
  post.mock.mockImplementation(async (path, file, config) => {
    assert.equal(path, '/aitoia/video/normalize')
    assert.equal(file, webm)
    assert.equal(config.headers['Content-Type'], 'video/webm')
    assert.equal(config.params.preserveResolution, true)
    return { data: new Blob([bytes], { type: 'video/mp4' }) }
  })
  const output = await readGeneratedClipForJob({ id: 'source', file: webm }, signal, null, post)
  assert.equal(output.type, 'video/mp4')
  assert.equal(output.size, bytes.length)
  assert.equal(post.mock.callCount(), 1)
})

test('explicit recovery bypasses damaged local bytes and normalizes the original without generating or charging again', async t => {
  const source = new File(['damaged local bytes'], 'cached.mp4', { type: 'video/mp4' })
  const remote = t.mock.method(globalThis, 'fetch', async () => { throw Error('must not use an expired provider URL') })
  const get = t.mock.fn(async path => {
    assert.equal(path, '/aitoia/video/generations/source-id/file')
    return { data: new Blob(['original source'], { type: 'video/mp4' }) }
  })
  const post = t.mock.fn(async (path, file, config) => {
    assert.equal(path, '/aitoia/video/normalize')
    assert.equal(await file.text(), 'original source')
    assert.equal(config.params.preserveResolution, true)
    return { data: new Blob(['repaired compatible movie'], { type: 'video/mp4' }) }
  })
  const output = await readGeneratedClipForJob({ id: 'copied-component', sourceClipId: 'source-id', file: source }, new AbortController().signal, get, post, { repair: true })
  assert.equal(await output.text(), 'repaired compatible movie')
  assert.equal(remote.mock.callCount(), 0)
  assert.equal(get.mock.callCount(), 1)
  assert.equal(post.mock.callCount(), 1)
})

test('recovery respects account permissions and expiry instead of bypassing an authenticated denial', async t => {
  const remote = t.mock.method(globalThis, 'fetch', async () => { throw Error('must not request provider media') })
  const post = t.mock.fn(async () => { throw Error('must not normalize denied content') })
  for (const status of [401, 403, 410]) {
    const denied = Object.assign(Error('denied'), { response: { status } })
    await assert.rejects(readGeneratedClipForJob({ id: 'source-id', remoteUrl: 'https://video.example.test/clip.mp4' }, new AbortController().signal,
      async () => { throw denied }, post, { repair: true }), error => error === denied)
  }
  assert.equal(remote.mock.callCount(), 0)
  assert.equal(post.mock.callCount(), 0)
})

test('a corrupt persisted MP4 is recovered automatically from the owned original before download', async t => {
  const bytes = await readFile(new URL('fixtures/avc-clip.mp4', import.meta.url))
  const damaged = new File(['plausible MIME but corrupted body'], 'cached.mp4', { type: 'video/mp4' })
  const remote = t.mock.method(globalThis, 'fetch', async () => { throw Error('must use the owned original') })
  const get = t.mock.fn(async path => {
    assert.equal(path, '/aitoia/video/generations/source-id/file')
    return { data: new Blob([bytes], { type: 'video/mp4' }) }
  })
  const post = t.mock.fn(async (path, body) => {
    assert.equal(path, '/aitoia/video/normalize')
    assert.equal(body, damaged)
    throw Object.assign(Error('invalid video bytes'), { response: { status: 422 } })
  })
  const output = await readGeneratedClipForJob({ id: 'copy', sourceClipId: 'source-id', file: damaged }, new AbortController().signal, get, post)
  assert.equal(output.size, bytes.length)
  assert.deepEqual(Buffer.from(await output.arrayBuffer()), bytes)
  assert.equal(post.mock.callCount(), 1)
  assert.equal(get.mock.callCount(), 1)
  assert.equal(remote.mock.callCount(), 0)
})

test('automatic local recovery does not retry on processing throttling, outages, permissions or cancellation', async t => {
  const source = new File(['incompatible'], 'cached.webm', { type: 'video/webm' })
  const get = t.mock.fn(async () => { throw Error('must not download while unavailable') })
  const signal = new AbortController().signal
  for (const status of [401, 403, 410, 429, 503]) {
    const denied = Object.assign(Error('processing unavailable'), { response: { status } })
    await assert.rejects(readGeneratedClipForJob({ id: 'source', file: source, remoteUrl: 'https://video.example.test/clip.mp4' }, signal,
      get, async () => { throw denied }), error => error === denied)
  }
  const controller = new AbortController()
  await assert.rejects(readGeneratedClipForJob({ id: 'source', file: source, remoteUrl: 'https://video.example.test/clip.mp4' }, controller.signal,
    get, async () => { controller.abort(); throw Object.assign(Error('interrupted'), { response: { status: 422 } }) }), { name: 'AbortError' })
  assert.equal(get.mock.callCount(), 0)
})

test('an archived generated clip can recover by its signed generation id after its provider URL was removed', async t => {
  const id = Buffer.from('usage:0123456789abcdef01234567:12345678-1234-1234-1234-123456789abc').toString('base64url')
  const get = t.mock.fn(async path => {
    assert.equal(path, `/aitoia/video/generations/${id}/file`)
    return { data: new Blob(['owned original'], { type: 'video/mp4' }) }
  })
  const post = t.mock.fn(async (_path, file) => {
    assert.equal(await file.text(), 'owned original')
    return { data: new Blob(['compatible video'], { type: 'video/mp4' }) }
  })
  const output = await readGeneratedClipForJob({ id, file: new File(['damaged'], 'cached.mp4', { type: 'video/mp4' }) }, new AbortController().signal,
    get, post, { repair: true })
  assert.equal(await output.text(), 'compatible video')
  assert.equal(get.mock.callCount(), 1)
  assert.equal(post.mock.callCount(), 1)
})
