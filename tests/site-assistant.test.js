import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, reactive, computed } from 'vue'
import * as helpers from '../src/utils/siteAssistant.js'
import { guidedAssistantReply, waitForAssistantBubble, assistantMenu } from '../src/utils/siteAssistantFlow.js'
import * as identity from '../src/utils/siteAssistantIdentity.js'

test('only approved product and commercial destinations become clickable links', () => {
  for (const url of ['javascript:alert(1)', '//evil.test', 'https://wa.me/1234', 'http://notify-flow.onrender.com/', 'https://aitosoftwares.com.evil.test/whatsappbotbuilder', 'https://notify-flow.onrender.com@evil.test/', 'https://notify-flow.onrender.com:444/']) assert.equal(helpers.safeAssistantLink({ url }), null, url)
  assert.equal(helpers.safeAssistantLink({ url: '/whatsappbotbuilder' }).url, '/whatsapp-solucoes')
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
  assert.equal(helpers.offlineReply('Quero disparos em massa').link.url, '/whatsapp-solucoes')
  assert.equal(helpers.offlineReply('500 por semana', [{ from: 'user', text: 'Quero campanhas' }]).link.url, '/whatsapp-solucoes')
  assert.equal(helpers.offlineReply('Quero bot no WhatsApp').link.url, '/whatsapp-solucoes')
  const history = [{ from: 'user', text: 'Quero fazer campanhas com Notify Flow' }]
  assert.equal(helpers.offlineReply('Quero criar um bot no WhatsApp', history).link.url, '/whatsapp-solucoes')
  assert.match(helpers.offlineReply('Quero falar com um especialista', history).link.url, /^https:\/\/wa.me\/5561982637865/)
  assert.equal(helpers.offlineReply('Como transferir a conversa do bot para um atendente humano?').link.url, '/whatsapp-solucoes')
})

const script = readFileSync(new URL('../src/components/IAChatComponent.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const create = new Function('ref', 'reactive', 'computed', 'watch', 'nextTick', 'onBeforeUnmount', 'onMounted', 'defineEmits', 'useRoute', 'api', 'helpers', 'sessionStorage', `const { MESSAGE_LIMIT, initialSuggestions, sanitizeMessages, sanitizeReply, buildCommercialUrl, waitForAssistantBubble, identityGreeting, identityContactQuestion, identityWelcome, parseVisitorName, parseVisitorContact } = helpers; ${script}; return { messages, loading, suggestions, currentMessage, sendMessage, resetChat, loadFromSession, scrollAreaRef, trackScroll, scrollToBottom, conversationToken, visitor, identify, identificationStep }`)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fixture(saved = null, wait = async () => {}, identified = true) {
  const requests = []
  let unmount
  const chat = create(ref, reactive, computed, () => {}, () => Promise.resolve(), callback => { unmount = callback }, () => {}, () => () => {}, () => ({ path: '/whatsapp-solucoes' }), { post: (url, payload, options) => { const response = deferred(); requests.push({ url, payload, options, ...response }); return response.promise } }, { ...helpers, ...identity, waitForAssistantBubble: wait }, { getItem: () => saved, setItem: () => {}, removeItem: () => {} })
  if (identified) chat.conversationToken.value = 'q'.repeat(43)
  return { chat, requests, unmount: () => unmount() }
}

test('keeps identified replies in order and avoids duplicate current input', async () => {
  const { chat, requests } = fixture()
  const first = chat.sendMessage('Quero criar um bot')
  await chat.sendMessage('outro clique durante o envio')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].payload.history.some(item => item.text === 'Quero criar um bot'), false)
  requests[0].resolve({ data: { ia_replies: ['Editor visual.', 'Qual atendimento você quer automatizar?'], link: { label: 'Ver produto', url: '/whatsappbotbuilder' }, suggestions: ['Quero começar com pedidos'] } })
  await first
  const second = chat.sendMessage('Quero começar com pedidos')
  assert.equal(requests[1].url, '/talk_site_bot')
  assert.equal(requests[1].payload.page_path, '/whatsapp-solucoes')
  assert.deepEqual(requests[1].payload.history.slice(-2).map(item => item.text), ['Editor visual.', 'Qual atendimento você quer automatizar?'])
  requests[1].resolve({ data: { ia_replies: ['Vamos montar o fluxo de pedidos.'] } })
  await second
  assert.equal(chat.messages.value.at(-1).text, 'Vamos montar o fluxo de pedidos.')
  assert.equal(chat.loading.value, false)
})

test('asks the name, then contact in chat and only then opens the identified conversation', async () => {
  const { chat, requests } = fixture(null, async () => {}, false)
  assert.match(chat.messages.value[0].text, /como você se chama/)
  await chat.sendMessage('123')
  assert.equal(chat.identificationStep.value, 'name')
  await chat.sendMessage('Visitante de teste')
  assert.match(chat.messages.value.at(-1).text, /Prazer, Visitante/)
  await chat.sendMessage('contato inválido')
  assert.equal(requests.length, 0)
  assert.equal(chat.identificationStep.value, 'contact')
  const pending = chat.sendMessage('visitor@example.test e (62) 99999-1234')
  assert.equal(requests[0].url, '/site-assistant/start')
  assert.equal(requests[0].payload.email, 'visitor@example.test')
  assert.equal(requests[0].payload.phone, '62999991234')
  assert.equal(requests[0].payload.name, 'Visitante de teste')
  assert.equal(chat.conversationToken.value, '')
  requests[0].resolve({ data: { conversationToken: 'v'.repeat(43), name: 'Visitante de teste' } })
  await pending
  assert.equal(chat.conversationToken.value, 'v'.repeat(43))
  assert.match(chat.messages.value.at(-1).text, /Obrigado, Visitante/)
  assert.deepEqual(chat.suggestions.value, [...assistantMenu])
})

test('resetting during contact submission cancels identification and ignores the late session', async () => {
  const { chat, requests } = fixture(null, async () => {}, false)
  await chat.sendMessage('Maria')
  const pending = chat.sendMessage('maria@example.test')
  chat.resetChat()
  assert.equal(requests[0].options.signal.aborted, true)
  requests[0].resolve({ data: { conversationToken: 'v'.repeat(43), name: 'Maria' } })
  await pending
  assert.equal(chat.conversationToken.value, '')
  assert.equal(chat.identificationStep.value, 'name')
  assert.equal(chat.messages.value.length, 1)
})

test('offers the complete AitoNotify package through source purchase or monthly service', () => {
  assert.equal(helpers.initialSuggestions.length, 4)
  const comparison = guidedAssistantReply('Soluções para WhatsApp')
  assert.deepEqual(comparison.suggestions.slice(0, 2), ['Comprar código-fonte', 'Usar mensal'])
  assert.match(comparison.ia_replies.join(' '), /API oficial da Meta/)
  const source = guidedAssistantReply('Comprar código-fonte')
  assert.equal(source.link.url, '/whatsapp-solucoes')
  assert.match(source.ia_replies.join(' '), /token de licença/)
  const monthly = guidedAssistantReply('Usar mensal')
  const url = new URL(monthly.link.url)
  assert.equal(url.pathname, '/5561982637865')
  assert.match(url.searchParams.get('text'), /AitoNotify.*plano mensal/)
  assert.equal(guidedAssistantReply('Comprar pelo site', [{ from: 'user', text: 'WhatsApp BotBuilder' }]).link.url, '/whatsapp-solucoes')
  assert.deepEqual(guidedAssistantReply('Voltar ao início').suggestions, [...assistantMenu])
  assert.equal(helpers.sanitizeReply({ ia_replies: ['Olá'], suggestions: assistantMenu }).suggestions.length, 4)
})

test('delivers bubbles one at a time and clearing cancels the pending turn', async () => {
  const waits = []
  const { chat, requests } = fixture(null, signal => {
    const pending = deferred()
    signal.addEventListener('abort', () => pending.reject(new Error('cancelled')), { once: true })
    waits.push(pending)
    return pending.promise
  })
  const turn = chat.sendMessage('Soluções para WhatsApp')
  assert.equal(requests.length, 1)
  requests[0].resolve({ data: { ia_replies: ['Primeiro balão', 'Segundo balão'] } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(chat.messages.value.length, 2)
  assert.equal(chat.loading.value, true)
  waits[0].resolve()
  await Promise.resolve(); await Promise.resolve()
  assert.equal(chat.messages.value.length, 3)
  assert.equal(waits.length, 2)
  chat.resetChat()
  await turn
  assert.equal(chat.messages.value.length, 1)
  assert.equal(chat.loading.value, false)
  assert.deepEqual(chat.suggestions.value, [])
})

test('native scroll follows new messages only while the visitor stays at the bottom', () => {
  const { chat } = fixture()
  const area = { scrollTop: 0, scrollHeight: 1200, clientHeight: 400 }
  chat.scrollAreaRef.value = area
  chat.scrollToBottom()
  assert.equal(area.scrollTop, 1200)
  area.scrollTop = 100
  chat.trackScroll(); chat.scrollToBottom()
  assert.equal(area.scrollTop, 100)
  area.scrollTop = 800
  chat.trackScroll(); chat.scrollToBottom()
  assert.equal(area.scrollTop, 1200)
})

test('bubble delay is cancellable when the assistant closes', async () => {
  const controller = new AbortController()
  const pending = waitForAssistantBubble(controller.signal, 'Mensagem', 1)
  controller.abort()
  await assert.rejects(pending, /cancelada/)
})

test('recovers network errors with useful guidance and cancels updates after closing', async () => {
  const { chat, requests, unmount } = fixture()
  const first = chat.sendMessage('Quero fazer campanhas')
  requests[0].reject(new Error('offline')); await first
  assert.equal(chat.messages.value.at(-1).link, null)
  assert.match(chat.messages.value.at(-1).text, /conexão/)
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
  assert.match(chat.messages.value[0].text, /como você se chama/)
  assert.equal(chat.conversationToken.value, '')
  assert.deepEqual(chat.suggestions.value, [])
})
