import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProductTypes, normalizeProductCatalog, productSubtotal, productLicenseTerm, productTermLabel } from '../src/services/product-cart.js'

test('a cart contains only the two independent products once, without accepting arbitrary SKU keys', () => {
  assert.deepEqual(normalizeProductTypes(['cloud', 'desktop', 'desktop', '__proto__', 'free']), ['desktop', 'cloud'])
  assert.deepEqual(normalizeProductTypes('desktop'), [])
  assert.deepEqual(normalizeProductTypes([]), [])
})

test('catalog keeps product-specific price and term data with object and array API payloads', () => {
  const desktop = { productType: 'desktop', priceCents: 42000, available: true, licenseDays: 365, permanent: false }
  const cloud = { productType: 'cloud', priceCents: 199700, available: true, permanent: true }
  for (const payload of [{ products: { desktop, cloud } }, { products: [desktop, cloud] }, { desktop, cloud }]) {
    const catalog = normalizeProductCatalog(payload)
    assert.equal(catalog.desktop.licenseDays, 365)
    assert.equal(catalog.desktop.permanent, false)
    assert.equal(catalog.cloud.permanent, true)
    assert.equal(productSubtotal(['desktop', 'cloud', 'desktop'], catalog), 241700)
  }
})

test('legacy combined-product API cannot authorize either new product checkout', () => {
  const catalog = normalizeProductCatalog({ priceCents: 39700, available: true })
  assert.equal(catalog.desktop.available, false)
  assert.equal(catalog.cloud.available, false)
  assert.equal(productSubtotal(['cloud', 'not-a-product'], catalog), 199700)
})

test('term labels follow admin-defined duration and never present a timed token as lifetime', () => {
  assert.equal(productTermLabel({ permanent: false, durationDays: 365 }), 'por 1 ano')
  assert.equal(productTermLabel({ permanent: false, durationDays: 30 }), 'por 30 dias')
  assert.equal(productTermLabel({ permanent: true, durationDays: null }), 'vitalício')
  assert.deepEqual(productLicenseTerm({ licenseTerm: { permanent: false, durationDays: 90 } }), { permanent: false, durationDays: 90 })
})
