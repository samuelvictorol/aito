import { createAitoIALocalStore } from './aitoiaLocal.js'

const key = owner => 'video-handoff:' + owner
const ttl = 60 * 60 * 1000

export async function saveVideoDraft(owner, draft) {
  if (!owner) throw new Error('Entre para levar o rascunho ao Estúdio.')
  const store = createAitoIALocalStore(key(owner))
  try {
    await store.remove('draft')
    await store.save({ ...draft, id: 'draft', discardAt: Date.now() + ttl })
  } finally { store.dispose() }
}

export async function clearVideoDraft(owner) {
  if (!owner) return
  const store = createAitoIALocalStore(key(owner))
  try { await store.remove('draft') } finally { store.dispose() }
}

export async function readVideoDraft(owner) {
  if (!owner) return null
  const store = createAitoIALocalStore(key(owner))
  try {
    const [draft] = await store.list()
    if (!draft || draft.discardAt > Date.now()) return draft || null
    await store.remove('draft')
    return null
  } finally { store.dispose() }
}

export function requestsVideoGeneration(value) {
  const text = String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
  const request = text.replace(/^(?:por favor[, ]+|please\s+)/i, '')
    .replace(/^(?:(?:voce\s+)?(?:pode|poderia|consegue|quero)\s+(?:que voce\s+)?|voce\s+)?(?:me\s+)?/i, '')
  return /^(?:gere|gerar|crie|criar|faca|fazer|produza|produzir|renderize|renderizar|generate|create|make|render)\s+(?:(?:para mim|pra mim|for me)\s+)?(?:(?:um|uma|o|a|the|an?)\s+)?(?:video|clipe|clip|animacao)s?\b/i.test(request)
}
