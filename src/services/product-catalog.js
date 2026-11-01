export const PRODUCT_TYPES = ['desktop', 'cloud']
export function licenseProductType(license = {}) {
  if (['desktop', 'cloud', 'legacy'].includes(license.productType)) return license.productType
  if (String(license.token || '').startsWith('aito_dsk_')) return 'desktop'
  if (String(license.token || '').startsWith('aito_src_')) return 'cloud'
  return 'legacy'
}
export function productLabel(type) {
  return ({ desktop: 'Desktop · executável', cloud: 'Whitelabel · código-fonte / Cloud', legacy: 'Licença da compra anterior' })[type] || 'Produto'
}
export function licensePackages(license) {
  const type = licenseProductType(license)
  const base = type === 'legacy' ? PRODUCT_TYPES : [type]
  return Array.isArray(license.allowedPackages) ? base.filter(value => license.allowedPackages.includes(value)) : base
}
export function normalizeCatalog(value = {}) {
  return Array.isArray(value) ? Object.fromEntries(value.filter(item => PRODUCT_TYPES.includes(item.productType)).map(item => [item.productType, item])) : value
}
