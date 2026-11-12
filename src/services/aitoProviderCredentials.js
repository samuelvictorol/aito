const encode = value => new TextEncoder().encode(value)
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

export async function sealAitoProviderCredential(encryption, provider, revision, credential) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Abra o painel em uma conexão HTTPS para cadastrar a credencial.')
  const { kty, crv, x, y } = encryption?.publicKey || {}
  if (encryption?.algorithm !== 'ECDH-ES+A256GCM' || kty !== 'EC' || crv !== 'P-256' ||
      typeof x !== 'string' || typeof y !== 'string' || typeof revision !== 'string' || !revision) {
    throw new Error('A proteção de credenciais está indisponível. Atualize o painel e tente novamente.')
  }

  const curve = { name: 'ECDH', namedCurve: 'P-256' }
  const server = await subtle.importKey('jwk', { kty, crv, x, y }, curve, false, [])
  const ephemeral = await subtle.generateKey(curve, false, ['deriveBits'])
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: server }, ephemeral.privateKey, 256))
  const plaintext = encode(credential)
  try {
    const material = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
    const key = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32),
      info: encode('aito.provider-credentials.transport.v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: encode(`aito.provider-credentials.v1:${provider}:${revision}`) }, key, plaintext)
    return { revision, ephemeralKey: await subtle.exportKey('jwk', ephemeral.publicKey),
      iv: base64url(iv), ciphertext: base64url(ciphertext) }
  } finally {
    shared.fill(0)
    plaintext.fill(0)
  }
}
