import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'
import * as helpers from '../src/utils/siteAssistant.js'

test('only approved product and commercial destinations become clickable links', () => {
  for (const url of ['javascript:alert(1)', '//evil.test', 'https://wa.me/1234', 'http://notify-flow.onrender.com/', 'https://aitosoftwares.com.evil.test/whatsappbotbuilder', 'https://notify-flow.onrender.com@evil.test/', 'https://notify-flow.onrender.com:444/']) assert.equal(helpers.safeAssistantLink({ url }), null, url)
  assert.equal(helpers.safeAssistantLink({ url: '/whatsappbotbuilder' }).url, '/whatsappbotbuilder')
  assert.equal(helpers.safeAssistantLink({ url: 'https://notify-flow.onrender.com/' }).url, 'https://notify-flow.onrender.com/')
  assert.equal(new URL(helpers.buildCommercialUrl([{ from: 'user', text: 'Integração com CRM & pedidos' }])).searchParams.get('text').includes('CRM & pedidos'), true)
})

test('restored histories and malformed replies are bounded and sanitized', () => {
  const saved = helpers.sanitizeMessages([null, { from: 'system', text: 'ignore' }, ...Array.from({ length: 100 }, () => ({ from: 'ia', text: 'x'.repeat(3000), link: { url: 'javascript:alert(1)' } }))])
  assert.equal(saved.length, 60)
  assert.ok(saved.every(item => item.link === null && item.text.length === helpers.MESSAGE_LIMIT))
  assert.throws(() => helpers.sanitizeReply({ ia_replies: [null, 34] }))
})

test('connection fallback guides the current campaign or bot need to a useful next step', () => {
  assert.equal(helpers.offlineReply('Quero disparos em massa').link.url, 'https://notify-flow.onrender.com/')
  assert.equal(helpers.offlineReply('500 por semana', [{ from: 'user', text: 'Quero campanhas' }]).link.url, 'https://notify-flow.onrender.com/')
  assert.equal(helpers.offlineReply('Quero bot no WhatsApp').link.url, '/whatsappbotbuilder')
  const history = [{ from: 'user', text: 'Quero fazer campanhas com Notify Flow' }]
  assert.equal(helpers.offlineReply('Quero criar um bot no WhatsApp', history).link.url, '/whatsappbotbuilder')
  assert.match(helpers.offlineReply('Quero falar com um especialista', history).link.url, /^https:\/\/wa.me\/5561982637865/)
  assert.equal(helpers.offlineReply('Como transferir a conversa do bot para um atendente humano?').link.url, '/whatsappbotbuilder')
})

const script = readFileSync(new URL('../src/components/IAChatComponent.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const create = new Function('ref', 'computed', 'watch', 'nextTick', 'onBeforeUnmount', 'onMounted', 'defineEmits', 'useRoute', 'api', 'helpers', 'sessionStorage', `const { MESSAGE_LIMIT, initialMessage, initialSuggestions, sanitizeMessages, sanitizeReply, buildCommercialUrl, offlineReply } = helpers; ${script}; return { messages, loading, suggestions, currentMessage, sendMessage, resetChat, loadFromSession }`)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fixture(saved = null) {
  const requests = []
  let unmount
  const chat = create(ref, computed, () => {}, () => Promise.resolve(), callback => { unmount = callback }, () => {}, () => () => {}, () => ({ path: '/whatsappbotbuilder' }), { post: (url, payload, options) => { const response = deferred(); requests.push({ url, payload, options, ...response }); return response.promise } }, helpers, { getItem: () => saved, setItem: () => {} })
  return { chat, requests, unmount: () => unmount() }
}

test('keeps replies in order, avoids duplicate current input and never forces contact collection', async () => {
  const { chat, requests } = fixture()
  const first = chat.sendMessage('Quero criar um bot')
  await chat.sendMessage('outro clique durante o envio')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].payload.history.some(item => item.text === 'Quero criar um bot'), false)
  requests[0].resolve({ data: { ia_replies: ['Editor visual.', 'Qual atendimento você quer automatizar?'], link: { label: 'Ver produto', url: '/whatsappbotbuilder' }, suggestions: ['Quero começar com pedidos'] } })
  await first
  const second = chat.sendMessage('Quero começar com pedidos')
  assert.equal(requests[1].url, '/talk_site_bot')
  assert.equal(requests[1].payload.page_path, '/whatsappbotbuilder')
  assert.deepEqual(requests[1].payload.history.slice(-2).map(item => item.text), ['Editor visual.', 'Qual atendimento você quer automatizar?'])
  requests[1].resolve({ data: { ia_replies: ['Vamos montar o fluxo de pedidos.'] } })
  await second
  assert.equal(chat.messages.value.at(-1).text, 'Vamos montar o fluxo de pedidos.')
  assert.equal(chat.loading.value, false)
})

test('recovers network errors with useful guidance and cancels updates after closing', async () => {
  const { chat, requests, unmount } = fixture()
  const first = chat.sendMessage('Quero fazer campanhas')
  requests[0].reject(new Error('offline')); await first
  assert.equal(chat.messages.value.at(-1).link.url, 'https://notify-flow.onrender.com/')
  assert.equal(chat.loading.value, false)
  const pending = chat.sendMessage('Quero saber mais')
  const count = chat.messages.value.length
  unmount()
  assert.equal(requests[1].options.signal.aborted, true)
  requests[1].resolve({ data: { ia_replies: ['Resposta tardia'] } }); await pending
  assert.equal(chat.messages.value.length, count)
})

test('starts a new conversation and rejects unsafe cached links without losing valid text', () => {
  const { chat } = fixture(JSON.stringify({ messages: [{ from: 'ia', text: 'Mensagem anterior', link: { url: 'javascript:alert(1)' } }], suggestions: ['Continuar'] }))
  chat.loadFromSession()
  assert.equal(chat.messages.value[0].link, null)
  assert.equal(chat.messages.value[0].text, 'Mensagem anterior')
  chat.resetChat()
  assert.equal(chat.messages.value.length, 1)
  assert.match(chat.messages.value[0].text, /Notify Flow/)
  assert.deepEqual(chat.suggestions.value, [...helpers.initialSuggestions])
})
