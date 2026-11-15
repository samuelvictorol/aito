import assert from 'node:assert/strict'
import test from 'node:test'
import { createVideoProjectLinks, projectVideoIds } from '../src/services/aitoiaVideoProjectLinks.js'

const id = (owner, digit) => Buffer.from(`usage:${owner}:${digit.repeat(8)}-aaaa-bbbb-cccc-dddddddddddd`).toString('base64url')
const user = 'f'.repeat(24)
const administrator = 'admin:env-admin-fixture'
const main = id(user, '1')
const scene = id(user, '2')
const component = id(user, '3')
const remake = id(administrator, '4')
const file = new Blob(['test asset'], { type: 'video/mp4' })
const packed = { $aitoAsset: 'a'.repeat(64) }

test('a generated video stays linked while any saved project placement retains its file', () => {
  const project = {
    clips: [{ id: main, file }, { id: id(user, 'a'), file, expiresAt: 1 }, { id: id(user, 'b'), remoteUrl: 'https://example.org/video' }],
    scenes: [{ clipId: scene, file }, { clipId: main, file: packed }, { clipId: 'local-upload', file }],
    components: [{ sourceClipId: component, file }],
    remake: { scenes: [{ result: { id: remake, file } }] },
    activeJob: { id: id(user, 'c') },
  }
  assert.deepEqual(projectVideoIds(project), [main, scene, component, remake].sort())
  project.clips = []
  assert.ok(projectVideoIds(project).includes(main))
  project.scenes.pop()
  project.scenes.pop()
  assert.deepEqual(projectVideoIds(project), [scene, component, remake].sort())
})

test('a pending project deletion is retried only when its owning account returns', { timeout: 3000 }, async t => {
  const storage = new Map()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  })
  let account = user
  let failOnce = true
  const sent = []
  let onPut
  const access = () => {
    const owner = account
    return { current: () => owner === account, put: async (path, body) => {
      if (failOnce) { failOnce = false; onPut?.(); throw Error('offline') }
      sent.push({ owner, path, body })
      onPut?.()
    } }
  }
  let links = createVideoProjectLinks({ owner: () => account, access })
  t.after(() => links.dispose())
  const failed = new Promise(resolve => { onPut = resolve })
  links.remove('project-old', user)
  await failed
  links.dispose()

  account = 'another-owner'
  links = createVideoProjectLinks({ owner: () => account, access })
  const afterSwitch = new Promise(resolve => { onPut = resolve })
  links.save({ id: 'project-current', title: 'Projeto novo', expiresAt: Date.now() + 10000, clips: [{ id: scene, file }] }, account)
  await afterSwitch
  assert.deepEqual(sent.map(({ owner, path }) => [owner, path.split('/').at(-1)]), [[account, 'project-current']])

  account = user
  const afterReturn = new Promise(resolve => { onPut = resolve })
  links.retry(0)
  await afterReturn
  assert.equal(sent[1].owner, user)
  assert.equal(sent[1].path, '/aitoia/video/generations/projects/project-old')
  assert.deepEqual(sent[1].body.ids, [])
})
