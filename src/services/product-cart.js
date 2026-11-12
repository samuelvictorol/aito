import { ref } from 'vue'

export const PRODUCT_TYPES = Object.freeze(['desktop', 'cloud'])
export const CART_KEY = 'aito.products.cart.v1'
export function normalizeProductTypes(value) {
  return PRODUCT_TYPES.filter(type => Array.isArray(value) && value.includes(type))
}
export function defaultProductCatalog() {
  return {
    desktop: { productType: 'desktop', title: 'AitoIA + Kit AitoNotify e WhatsApp Bot Builder · Desktop', priceCents: 199700, originalPriceCents: 199700,desktopPlans:[{months:1,label:'Mensal',priceCents:11000,enabled:true},{months:6,label:'Semestral',priceCents:59700,enabled:true},{months:12,label:'Anual',priceCents:199700,enabled:true}],durationMonths:12, available: false, durationDays: null, permanent: false, media: {} },
    cloud: { productType: 'cloud', title: 'AitoIA + Kit AitoNotify e WhatsApp Bot Builder · Código-fonte Whitelabel', priceCents: 199700, originalPriceCents: 249000, available: false, durationDays: null, permanent: true, media: {} },
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
let savedMonths=1;try{savedMonths=Number(localStorage.getItem(CART_KEY+'.months'))||1}catch{}
const desktopMonths=ref([1,6,12].includes(savedMonths)?savedMonths:1)
export function useProductCart() {
  function set(types) {
    selected.value = normalizeProductTypes(types)
    try { localStorage.setItem(CART_KEY, JSON.stringify(selected.value)) } catch { /* The current tab still works without storage. */ }
  }
  return {desktopMonths,setDesktopMonths:months=>{if(![1,6,12].includes(months))return;desktopMonths.value=months;try{localStorage.setItem(CART_KEY+'.months',String(months))}catch{}}, selected, set, add: type => set([...selected.value, type]), remove: type => set(selected.value.filter(item => item !== type)), clear: () => set([]) }
}
export function productSubtotal(types, catalog) {
  return normalizeProductTypes(types).reduce((total, type) => total + Math.max(0, Number(catalog[type]?.priceCents) || 0), 0)
}
export function productLicenseTerm(offer = {}) {
  const months=offer.durationMonths??offer.licenseDurationMonths??offer.licenseTerm?.durationMonths;if(months)return {permanent:false,durationMonths:Number(months)};
  const permanent = offer.licenseTerm?.permanent ?? offer.licensePermanent ?? offer.permanent ?? false
  const raw = offer.licenseTerm?.durationDays ?? offer.licenseDurationDays ?? offer.durationDays ?? offer.licenseDays ?? 365
  return { permanent: permanent === true, durationDays: permanent === true ? null : Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : 365 }
}
export function productTermLabel(offer) {
  const term = productLicenseTerm(offer)
  return term.durationMonths?`por ${term.durationMonths} ${term.durationMonths===1?'mês':'meses'}`:term.permanent ? 'vitalício' : term.durationDays === 365 ? 'por 1 ano' : `por ${term.durationDays} dias`
}
