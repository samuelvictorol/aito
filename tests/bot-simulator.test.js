import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'

// Exercise the component's conversation controller without a browser or a live API.
const script = readFileSync(new URL('../src/components/whatsapp/BotSimulator.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const create = new Function('ref', 'computed', 'nextTick', 'onMounted', 'onBeforeUnmount', 'defineProps', 'defineEmits', 'botApi', 'waApi', 'messageOf', 'setTimeout', 'clearTimeout', 'Date', `${script}\nreturn { input, messages, state, events, busy, mocks, error, retryAvailable, send, paymentEvent, reset, retry, loadSettings }`)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { for (let count = 0; count < 30; count++) await Promise.resolve() }
function fixture() {
  let now = 0, timerId = 0
  const timers = new Map(), requests = []
  const schedule = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id }
  const simulator = create(ref, computed, callback => Promise.resolve().then(callback), () => {}, () => {}, () => ({ flowId: 'demo', flow: { nodes: [] }, paymentConfigs: [{ key: 'demo' }] }), () => () => {}, { post: (url, body, options) => { const response = deferred(); requests.push({ url, body, options, ...response }); return response.promise } }, { get: async () => ({ data: { collectWindowMs: 200 } }) }, error => error.message, schedule, id => timers.delete(id), { now: () => now })
  async function advance(ms) {
    const target = now + ms
    for (let iteration = 0; iteration < 1000; iteration++) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((left, right) => left[1].at - right[1].at)[0]
      if (!next) { now = target; await flush(); return }
      now = next[1].at; timers.delete(next[0]); next[1].callback(); await flush()
    }
    throw new Error('The simulator did not finish its timer queue')
  }
  const send = async text => { simulator.input.value = text; await simulator.send() }
  return { simulator, requests, advance, send }
}

test('input received during delayed output continues with the returned conversation state', async () => {
  const { simulator, requests, send, advance } = fixture()
  await send('oi'); await advance(200)
  requests[0].resolve({ data: { state: { nodeId: 'menu' }, outputs: [{ text: 'Olá', delayMs: 1000 }, { text: 'Escolha 1', delayMs: 2000 }] } }); await flush()
  await send('1'); await advance(2000)
  assert.equal(requests.length, 2)
  assert.equal(requests[1].body.text, '1')
  assert.equal(requests[1].body.state.nodeId, 'menu')
  requests[1].resolve({ data: { state: { nodeId: null }, outputs: [{ text: 'Concluído', delayMs: 1000 }] } }); await flush(); await advance(1000)
  assert.deepEqual(simulator.messages.value.filter(message => message.from === 'bot').map(message => message.text), ['Olá', 'Escolha 1', 'Concluído'])
  assert.equal(simulator.busy.value, false)
})

test('payment results use configured fixtures and resume queued input after delayed responses', async () => {
  const { simulator, requests, send, advance } = fixture()
  simulator.state.value = { paymentNodeId: 'pay' }; simulator.mocks.value = '{"api":{"status":200,"body":{"ok":true}}}'
  const payment = simulator.paymentEvent('paid')
  assert.equal(requests[0].body.paymentEvent, 'paid')
  assert.equal(requests[0].body.httpResponses.api.status, 200)
  await simulator.paymentEvent('paid'); assert.equal(requests.length, 1)
  requests[0].resolve({ data: { state: { nodeId: 'choice' }, outputs: [{ text: 'Pagamento aprovado. Digite 1.', delayMs: 1500 }] } }); await flush()
  await send('1'); await advance(1499)
  assert.equal(simulator.messages.value.some(message => message.from === 'bot'), false)
  await advance(1); await payment
  assert.equal(requests.length, 2)
  assert.equal(requests[1].body.state.nodeId, 'choice')
  simulator.reset()
})

test('a failed request can be retried without losing it or overtaking queued messages', async () => {
  const { simulator, requests, send, advance } = fixture()
  await send('primeiro'); await advance(200)
  requests[0].reject(new Error('Conexão interrompida')); await flush()
  assert.equal(simulator.retryAvailable.value, true)
  await send('segundo'); await advance(200)
  assert.equal(requests.length, 1)
  const retry = simulator.retry(); assert.equal(requests[1].body.text, 'primeiro')
  requests[1].resolve({ data: { state: { nodeId: 'menu' }, outputs: [] } }); await flush(); await retry; await advance(0)
  assert.equal(requests[2].body.text, 'segundo')
  assert.equal(requests[2].body.state.nodeId, 'menu')
  assert.deepEqual(simulator.messages.value.map(message => message.text), ['primeiro', 'segundo'])
  simulator.reset()
})

test('invalid fixtures can be corrected and retried with the original message', async () => {
  const { simulator, requests, send, advance } = fixture()
  simulator.mocks.value = '{'
  await send('oi'); await advance(200)
  assert.equal(requests.length, 0); assert.equal(simulator.retryAvailable.value, true)
  simulator.mocks.value = '{"api":{"status":200}}'
  const retry = simulator.retry()
  assert.equal(requests[0].body.text, 'oi'); assert.equal(requests[0].body.httpResponses.api.status, 200)
  requests[0].resolve({ data: { state: { nodeId: 'menu' }, outputs: [] } }); await retry
  assert.equal(simulator.retryAvailable.value, false)
})

test('reset aborts outstanding work and ignores late state, output and errors', async () => {
  const { simulator, requests, send, advance } = fixture()
  await send('oi'); await advance(200)
  simulator.reset(); assert.equal(requests[0].options.signal.aborted, true)
  requests[0].resolve({ data: { state: { nodeId: 'stale' }, outputs: [{ text: 'Antigo', delayMs: 0 }], events: ['Antigo'] } }); await flush(); await advance(10000)
  assert.deepEqual(simulator.messages.value, []); assert.deepEqual(simulator.events.value, []); assert.equal(simulator.state.value, null)
  await send('nova'); await advance(200)
  simulator.reset(); requests[1].reject(new Error('Erro antigo')); await flush()
  assert.equal(simulator.error.value, ''); assert.equal(simulator.retryAvailable.value, false); assert.equal(simulator.busy.value, false)
})
