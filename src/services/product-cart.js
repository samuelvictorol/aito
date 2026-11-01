import { ref } from 'vue'

export const PRODUCT_TYPES = Object.freeze(['desktop', 'cloud'])
export const CART_KEY = 'aito.products.cart.v1'
export function normalizeProductTypes(value) {
  return PRODUCT_TYPES.filter(type => Array.isArray(value) && value.includes(type))
}
export function defaultProductCatalog() {
  return {
    desktop: { productType: 'desktop', title: 'Kit AitoNotify + WhatsApp BotBuilder · Desktop', priceCents: 39700, originalPriceCents: 49700, available: false, durationDays: 365, permanent: false, media: {} },
    cloud: { productType: 'cloud', title: 'AitoNotify + WhatsApp BotBuilder · Código-fonte Whitelabel', priceCents: 199700, originalPriceCents: 249000, available: false, durationDays: null, permanent: true, media: {} },
  }
}
export function normalizeProductCatalog(payload = {}) {
  const catalog = defaultProductCatalog(), products = payload.products || payload.catalog || (payload.desktop || payload.cloud ? payload : null)
  if (Array.isArray(products)) for (const item of products) {
    if (PRODUCT_TYPES.includes(item?.productType)) catalog[item.productType] = { ...catalog[item.productType], ...item }
  }
  else if (products && typeof products === 'object') for (const type of PRODUCT_TYPES) {
    if (products[type] && typeof products[type] === 'object') catalog[type] = { ...catalog[type], ...products[type], productType: type }
  }
  if (!products && typeof payload.priceCents === 'number') {
    const type = PRODUCT_TYPES.includes(payload.productType) ? payload.productType : 'desktop'
    // Old combined-product servers cannot honor distinct entitlements or terms.
    // Keep their media/price preview, but require the split catalog to sell.
    catalog[type] = { ...catalog[type], ...payload, productType: type, available: false }
  }
  return catalog
}
function restored() {
  try { return normalizeProductTypes(JSON.parse(localStorage.getItem(CART_KEY) || '[]')) } catch { return [] }
}
const selected = ref(restored())
export function useProductCart() {
  function set(types) {
    selected.value = normalizeProductTypes(types)
    try { localStorage.setItem(CART_KEY, JSON.stringify(selected.value)) } catch { /* The current tab still works without storage. */ }
  }
  return { selected, set, add: type => set([...selected.value, type]), remove: type => set(selected.value.filter(item => item !== type)), clear: () => set([]) }
}
export function productSubtotal(types, catalog) {
  return normalizeProductTypes(types).reduce((total, type) => total + Math.max(0, Number(catalog[type]?.priceCents) || 0), 0)
}
export function productLicenseTerm(offer = {}) {
  const permanent = offer.licenseTerm?.permanent ?? offer.licensePermanent ?? offer.permanent ?? false
  const raw = offer.licenseTerm?.durationDays ?? offer.licenseDurationDays ?? offer.durationDays ?? offer.licenseDays ?? 365
  return { permanent: permanent === true, durationDays: permanent === true ? null : Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : 365 }
}
export function productTermLabel(offer) {
  const term = productLicenseTerm(offer)
  return term.permanent ? 'vitalício' : term.durationDays === 365 ? 'por 1 ano' : `por ${term.durationDays} dias`
}
