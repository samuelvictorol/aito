import { ref } from 'vue'

export const personalDataVisible = ref(true)
let preferenceKey = '', observer, documentRef, active = false
const hiddenTitles = new Map()
const roots = '.q-page-container, .q-dialog, .q-menu, .q-notification'
const publicContent = '[data-privacy-public], .q-tab, .q-icon, .material-icons, .q-field__label, .q-field__bottom, .q-field__prepend, .q-field__append, .q-checkbox, .q-radio, .q-toggle, th, nav, script, style'
// Mark identities at their source, never an entire panel or card. Ordinary copy,
// message content, status badges, headings and configuration controls stay usable.
const sensitiveText = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){10,15}(?!\d)|\b(?:sk-proj-|sk-)[\w-]{12,}|\bBearer\s+\S{12,}/i
const sensitiveField = /e-?mail|telefone|phone|celular|cpf|cnpj|endereço|address|senha|password|secret|token|api.?key|chave.*(?:api|acesso)|connection.*string|(?:mongo|redis|banco).*(?:url|uri)|código.*(?:acesso|verificação|validação)/i

function isSensitiveInput(node) {
  const field = node.closest('.q-field, .field')
  const description = [node.name, node.id, node.getAttribute('aria-label'), node.placeholder, field?.querySelector('.q-field__label, label')?.textContent].join(' ')
  return node.closest('[data-sensitive]') || ['email', 'tel', 'password'].includes(node.type) || sensitiveField.test(description) || sensitiveText.test(node.value || '')
}

export function privacyPreferenceKey(user = {}) {
  return `aito.communication.screen-privacy:${user.role || 'admin'}:${user.id || user._id || user.email || 'current'}`
}
export function readPrivacyPreference(storage, key) {
  try { return storage.getItem(key) !== 'hidden' } catch { return true }
}
function mark(element) {
  if (!element?.querySelectorAll) return
  for (const node of [element, ...element.querySelectorAll('*')]) {
    if (!node.closest(roots) || node.closest(publicContent)) continue
    const explicit = Boolean(node.closest('[data-sensitive]'))
    const ownText = [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.textContent).join(' ')
    const privateText = Boolean(ownText.trim()) && (explicit || (!node.children.length && sensitiveText.test(ownText)))
    node.toggleAttribute('data-private-text', privateText)
    const privateValue = node.matches('input, textarea') ? Boolean(isSensitiveInput(node)) : explicit && node.matches('img, video, audio, canvas, iframe, svg')
    node.toggleAttribute('data-private-value', privateValue)
    if (node.getAttribute('title') && (explicit || privateText || sensitiveText.test(node.title))) { hiddenTitles.set(node, node.title); node.removeAttribute('title') }
  }
}
function sync() {
  if (!active) return
  documentRef.documentElement.dataset.screenPrivacy = personalDataVisible.value ? 'visible' : 'hidden'
  if (!personalDataVisible.value) mark(documentRef.body)
  else restoreTitles()
}
function restoreTitles() { for (const [node, title] of hiddenTitles) if (node.isConnected && !node.hasAttribute('title')) node.setAttribute('title', title); hiddenTitles.clear() }
export function setPersonalDataVisible(value) {
  personalDataVisible.value = Boolean(value)
  try { localStorage.setItem(preferenceKey, value ? 'visible' : 'hidden') } catch { /* Restricted storage must not prevent masking. */ }
  sync()
}
export function startScreenPrivacy(user, doc = document) {
  stopScreenPrivacy()
  active = true; documentRef = doc; preferenceKey = privacyPreferenceKey(user)
  personalDataVisible.value = readPrivacyPreference(localStorage, preferenceKey)
  sync()
  doc.body.addEventListener('input', onInput, true)
  observer = new MutationObserver(records => {
    if (personalDataVisible.value) return
    for (const record of records) {
      if (record.type === 'attributes') mark(record.target)
      else if (record.type === 'characterData') mark(record.target.parentElement)
      else for (const node of record.addedNodes) mark(node.nodeType === 1 ? node : node.parentElement)
    }
  })
  observer.observe(doc.body, { childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'value', 'type', 'data-sensitive'], subtree: true })
}
function onInput(event) { if (!personalDataVisible.value) mark(event.target) }
export function stopScreenPrivacy() {
  observer?.disconnect(); observer = null; active = false
  if (documentRef) { delete documentRef.documentElement.dataset.screenPrivacy; documentRef.body.removeEventListener('input', onInput, true) }
  restoreTitles()
}
