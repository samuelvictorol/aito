import assert from 'node:assert/strict'
import test from 'node:test'
import { challengeCalendarDay, createDailyChallengeTracker, dailyChallengeSession } from '../src/services/aitoDailyChallenge.js'

const alice = { accountId: '111111111111111111111111', token: 'alice-token' }
const bob = { accountId: '222222222222222222222222', token: 'bob-token' }
const response = (overrides = {}) => ({ eligible: true, streak: 1, today: '2026-11-17', completed: false,
  rewarded: false, rewardPending: false, visitedToday: true, rewardGranted: false, ...overrides })
function memoryStorage() {
  const rows = new Map()
  return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) }
}
function setup(options = {}) {
  let session = alice, visible = true, now = Date.parse('2026-11-17T14:00:00Z'), reply = response()
  const changes = [], rewards = [], requests = []
  const storage = options.storage || memoryStorage()
  const tracker = createDailyChallengeTracker({ getSession: () => session, visible: () => visible, now: () => now, storage,
    request: async token => { requests.push(token); return options.request ? options.request(token) : reply },
    onChange: change => changes.push(change), onReward: challenge => rewards.push(challenge) })
  return { tracker, storage, changes, rewards, requests, setSession: value => { session = value },
    setVisible: value => { visible = value }, setNow: value => { now = Date.parse(value) }, setReply: value => { reply = value } }
}

test('visits follow the Brasília calendar across midnight, independent of a UTC device date', () => {
  assert.equal(challengeCalendarDay(Date.parse('2026-11-18T02:59:59Z')), '2026-11-17')
  assert.equal(challengeCalendarDay(Date.parse('2026-11-18T03:00:00Z')), '2026-11-18')
})

test('only a customer session is eligible for the promotion request; administrator and corrupt storage are ignored', () => {
  const storage = memoryStorage()
  storage.setItem('aito_user_token', alice.token)
  storage.setItem('aito_user', JSON.stringify({ id: alice.accountId, role: 'user' }))
  assert.deepEqual(dailyChallengeSession(storage), alice)
  storage.setItem('aito_admin_token', 'admin-token')
  assert.equal(dailyChallengeSession(storage), null)
  storage.removeItem('aito_admin_token')
  storage.setItem('aito_user', JSON.stringify({ id: alice.accountId, role: 'affiliate' }))
  assert.equal(dailyChallengeSession(storage), null)
  storage.setItem('aito_user', '{')
  assert.equal(dailyChallengeSession(storage), null)
  assert.equal(dailyChallengeSession({ getItem() { throw Error('blocked') } }), null)
})

test('hidden pages never record visits, concurrent foreground events coalesce and one modal appears per account/day', async () => {
  const context = setup()
  context.setVisible(false)
  await context.tracker.enter()
  assert.equal(context.requests.length, 0)
  context.setVisible(true)
  await Promise.all([context.tracker.enter(), context.tracker.enter(), context.tracker.enter()])
  assert.deepEqual(context.requests, [alice.token])
  assert.equal(context.changes.filter(change => change.open === true).length, 1)
  context.tracker.dismiss()
  await context.tracker.enter()
  assert.equal(context.requests.length, 1)
  assert.equal(context.changes.at(-1).open, false)

  const reload = setup({ storage: context.storage })
  await reload.tracker.enter()
  assert.equal(reload.changes.some(change => change.open === true), false)
  reload.setNow('2026-11-18T14:00:00Z')
  reload.setReply(response({ today: '2026-11-18', streak: 2 }))
  await reload.tracker.enter()
  assert.equal(reload.changes.at(-1).open, true)
  assert.equal(reload.changes.at(-1).challenge.streak, 2)
})

test('hiding while a visit is in flight postpones presentation until the next visible entry', async () => {
  let resolve
  const context = setup({ request: () => new Promise(done => { resolve = done }) })
  const pending = context.tracker.enter()
  await Promise.resolve()
  context.setVisible(false)
  resolve(response())
  await pending
  assert.equal(context.changes.some(change => change.open === true), false)
  context.setVisible(true)
  await context.tracker.enter()
  assert.equal(context.requests.length, 1)
  assert.equal(context.changes.at(-1).open, true)
})

test('server state determines a reset and completion, while pending rewards never announce a balance credit', async () => {
  const context = setup()
  context.setReply(response({ reset: true }))
  await context.tracker.enter()
  assert.equal(context.changes.at(-1).challenge.reset, true)
  context.setNow('2026-11-20T14:00:00Z')
  context.setReply(response({ today: '2026-11-20', streak: 3, completed: true, rewardPending: true }))
  await context.tracker.enter()
  assert.equal(context.changes.at(-1).challenge.rewardPending, true)
  assert.equal(context.rewards.length, 0)
  const reload = setup({ storage: context.storage })
  reload.setNow('2026-11-21T14:00:00Z')
  reload.setReply(response({ today: '2026-11-21', streak: 3, completed: true, rewarded: true }))
  await reload.tracker.enter()
  assert.equal(reload.changes.some(change => change.open === true), false)
  assert.equal(reload.rewards.length, 0)
})

test('a prize refreshes the wallet only from an explicit server grant, never from a saved dismissal', async () => {
  const context = setup()
  context.setReply(response({ streak: 3, completed: true, rewarded: true, rewardGranted: true }))
  await context.tracker.enter()
  assert.equal(context.rewards.length, 1)
  await context.tracker.enter()
  assert.equal(context.rewards.length, 1)
  assert.equal(context.changes.at(-1).challenge.rewarded, true)
})

test('responses for a logged-out or switched account cannot open its modal or announce its reward', async () => {
  const resolvers = []
  const context = setup({ request: () => new Promise(done => resolvers.push(done)) })
  const first = context.tracker.enter()
  await Promise.resolve()
  context.setSession(bob)
  const second = context.tracker.enter()
  resolvers.shift()(response({ completed: true, rewardGranted: true }))
  await Promise.all([first, second])
  await Promise.resolve()
  assert.deepEqual(context.requests, [alice.token, bob.token])
  assert.equal(context.rewards.length, 0)
  resolvers.shift()(response({ eligible: false }))
  await new Promise(done => setImmediate(done))
  assert.equal(context.changes.some(change => change.open === true), false)
  context.setSession(null)
  await context.tracker.enter()
  assert.deepEqual(context.changes.at(-1), { challenge: null, open: false })
})

test('temporary failures retry on foreground entry and blocked local storage does not repeat the modal', async () => {
  let attempts = 0
  const context = setup({ request: async () => { if (++attempts === 1) throw Error('temporarily unavailable'); return response() },
    storage: { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } } })
  await context.tracker.enter()
  assert.equal(context.changes.some(change => change.open === true), false)
  await context.tracker.enter()
  context.tracker.dismiss()
  await context.tracker.enter()
  assert.equal(attempts, 2)
  assert.equal(context.changes.filter(change => change.open === true).length, 1)
})
