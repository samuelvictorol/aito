const linkInText = /(?:^|[\s(<"'“«])((?:https:\/\/)?(?:www\.)?instagram\.com\/[^\s<>"'“”«»]+)/iu
const postPath = /^\/(?:(?!share\/)[a-z\d._]{1,30}\/)?(reels?|p|tv)\/([\w-]{1,100})\/?$/i

export function instagramLink(text) {
  if (typeof text !== 'string') return ''
  const match = text.trim().match(linkInText)
  if (!match) return ''
  const shared = match[1].replace(/[)\]}.,;!]+$/u, '')
  try {
    const url = new URL(/^https:\/\//i.test(shared) ? shared : 'https://' + shared)
    const post = postPath.exec(url.pathname)
    if (!post || url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
        url.port || url.username || url.password) return ''
    return 'https://www.instagram.com/' + post[1].toLowerCase() + '/' + post[2] + '/'
  } catch { return '' }
}

const statuses = { queued: 'Na fila', processing: 'Convertendo', ready: 'Pronto para baixar', failed: 'Falhou', expired: 'Download expirado' }
const origins = { chat: 'Chat', studio: 'Estúdio' }
export const reelStatus = value => statuses[value] || 'Consultando'
export const reelOrigin = value => origins[value] || 'Admin'
export const reelIsPending = job => ['queued', 'processing'].includes(job?.status)
export const reelTokens = value => new Intl.NumberFormat('pt-BR').format(Number(value) || 0)
export const reelDate = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
