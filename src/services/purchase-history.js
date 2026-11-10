export const purchaseKinds = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'cloud', label: 'Whitelabel' },
  { value: 'renewal', label: 'Renovação Desktop' },
  { value: 'course', label: 'Curso' },
  { value: 'other', label: 'Outros produtos e serviços' },
]

export function purchaseKind(kind) {
  if (kind === 'bundle') return 'Desktop e Whitelabel'
  return purchaseKinds.find(option => option.value === kind)?.label || 'Compra'
}

export function purchasePeriod({ periodMonths, periodDays, permanent } = {}) {
  if (permanent) return 'Acesso permanente'
  if (periodMonths) return `${periodMonths} ${periodMonths === 1 ? 'mês' : 'meses'}`
  if (periodDays) return `${periodDays} ${periodDays === 1 ? 'dia' : 'dias'}`
  return ''
}

export function purchaseDate(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : '—'
}

export function purchaseMoney(cents, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'BRL' }).format(Number(cents || 0) / 100)
}

export function safeReceiptUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return ''
  try {
    const url = new URL(value)
    const isInfinitePay = ['infinitepay.io', 'infinitepay.com.br'].some(domain =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
    return isInfinitePay && url.protocol === 'https:' && !url.port && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}

export function financeHeaders(admin = false) {
  const key = admin ? 'aito_admin_token' : 'aito_user_token'
  return { headers: { Authorization: `Bearer ${localStorage.getItem(key) || ''}` } }
}
