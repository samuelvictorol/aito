// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { readPrivacyPreference, privacyPreferenceKey, startScreenPrivacy, stopScreenPrivacy, setPersonalDataVisible } from '../src/services/screen-privacy.js'
import { useChatFocus } from '../src/services/chat-focus.js'
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
afterEach(() => { stopScreenPrivacy(); localStorage.clear(); document.body.replaceChildren() })
test('privacy masks identities and sensitive values without hiding cards, headings, chat copy or controls', async () => {
  document.body.innerHTML = `<main class="q-page-container"><button class="chat-row"><strong data-sensitive title="Full Name">Samuel</strong><img data-sensitive src="avatar.png"></button><label class="q-field"><span class="q-field__label">Email</span><input value="private@example.com"></label><button class="q-btn">Enviar</button></main><div class="q-dialog"><h2>Configurar canal</h2><p>Conecte seu número</p><input type="text" aria-label="Modelo" value="gpt-5"><img class="logo" src="logo.png"></div>`
  startScreenPrivacy({ id: 'one', role: 'admin' }); setPersonalDataVisible(false)
  expect(document.documentElement.dataset.screenPrivacy).toBe('hidden')
  expect(document.querySelector('strong').hasAttribute('data-private-text')).toBe(true)
  expect(document.querySelector('strong').hasAttribute('title')).toBe(false)
  expect(document.querySelector('img').hasAttribute('data-private-value')).toBe(true)
  expect(document.querySelector('input').hasAttribute('data-private-value')).toBe(true)
  expect(document.querySelector('.q-field__label').hasAttribute('data-private-text')).toBe(false)
  expect(document.querySelector('.q-btn').hasAttribute('data-private-text')).toBe(false)
  const p = document.createElement('p'); p.textContent = 'New incoming message'; document.querySelector('main').append(p); await flush()
  expect(p.hasAttribute('data-private-text')).toBe(false)
  expect(document.querySelector('h2').hasAttribute('data-private-text')).toBe(false)
  expect(document.querySelector('.logo').hasAttribute('data-private-value')).toBe(false)
  expect(document.querySelector('[aria-label=Modelo]').hasAttribute('data-private-value')).toBe(false)
  p.textContent = '5511999999999'; await flush(); expect(p.hasAttribute('data-private-text')).toBe(true)
  p.textContent = 'Atendimento concluído'; await flush(); expect(p.hasAttribute('data-private-text')).toBe(false)
  setPersonalDataVisible(true); expect(document.querySelector('strong').title).toBe('Full Name')
  expect(document.querySelector('input').value).toBe('private@example.com')
  setPersonalDataVisible(false); startScreenPrivacy({ id: 'two', role: 'admin' }); expect(document.documentElement.dataset.screenPrivacy).toBe('visible')
  startScreenPrivacy({ id: 'one', role: 'admin' }); expect(document.documentElement.dataset.screenPrivacy).toBe('hidden')
  stopScreenPrivacy(); expect(document.documentElement.dataset.screenPrivacy).toBeUndefined()
})
test('restricted storage does not break privacy defaults and preferences are isolated by identity', () => {
  expect(readPrivacyPreference({getItem(){throw Error('denied')}}, 'key')).toBe(true)
  expect(privacyPreferenceKey({id:'one',role:'admin'})).not.toBe(privacyPreferenceKey({id:'one',role:'collaborator'}))
})
test('chat focus persists per channel and can return to the list on mobile without changing the desktop preference', () => {
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
  const web = useChatFocus('web'); web.toggleChatList(); expect(web.chatListCollapsed.value).toBe(true)
  expect(useChatFocus('web').chatListCollapsed.value).toBe(true); expect(useChatFocus('cloud').chatListCollapsed.value).toBe(false)
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true }); let returned = false
  web.toggleChatList(() => { returned = true }); expect(returned).toBe(true); expect(web.chatListCollapsed.value).toBe(true)
})
