const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0))
const label = new TextEncoder().encode('aito-assistant-key-v1')
const curve = { name: 'ECDH', namedCurve: 'P-256' }

export async function sealAssistantKey(apiKey, serverPublicKey) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Abra o painel por HTTPS para proteger a chave OpenAI.')
  const pair = await subtle.generateKey(curve, true, ['deriveBits'])
  const peer = await subtle.importKey('raw', decode(serverPublicKey), curve, false, [])
  const shared = await subtle.deriveBits({ name: 'ECDH', public: peer }, pair.privateKey, 256)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const material = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  const key = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: iv, info: label }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  )
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(apiKey))
  return { publicKey: encode(await subtle.exportKey('raw', pair.publicKey)), iv: encode(iv), ciphertext: encode(ciphertext) }
}
