import { createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { sealAitoProviderCredential } from '../src/services/aitoProviderCredentials.js'

test('provider credentials use an ephemeral key and bind ciphertext to the provider and revision', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const encryption = { publicKey: publicKey.export({ format: 'jwk' }), algorithm: 'ECDH-ES+A256GCM' }
  const secret = 'credential-fixture-' + 'a'.repeat(480)
  const revision = 'fixture-revision'
  const sealed = await sealAitoProviderCredential(encryption, 'higgsfield', revision, secret)
  const another = await sealAitoProviderCredential(encryption, 'higgsfield', revision, secret)
  assert.equal(sealed.revision, revision)
  assert.notEqual(sealed.ephemeralKey.x, another.ephemeralKey.x)
  assert.ok(!JSON.stringify(sealed).includes(secret))

  function decrypt(provider, credentialRevision) {
    const shared = diffieHellman({ privateKey, publicKey: createPublicKey({ key: sealed.ephemeralKey, format: 'jwk' }) })
    const key = hkdfSync('sha256', shared, Buffer.alloc(32), 'aito.provider-credentials.transport.v1', 32)
    const ciphertext = Buffer.from(sealed.ciphertext, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64url'))
    decipher.setAAD(Buffer.from(`aito.provider-credentials.v1:${provider}:${credentialRevision}`))
    decipher.setAuthTag(ciphertext.subarray(-16))
    return Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString('utf8')
  }

  assert.equal(decrypt('higgsfield', revision), secret)
  assert.throws(() => decrypt('openai', revision))
  assert.throws(() => decrypt('higgsfield', 'stale-revision'))
})
