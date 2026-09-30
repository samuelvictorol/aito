// Escape first: flow text and customer input must never become executable HTML.
export function formatWhatsApp(value) {
  const escaped = String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  return escaped.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map(part => {
    if (part.startsWith('```')) return `<code>${part.slice(3, -3)}</code>`
    if (part.startsWith('`')) return `<code>${part.slice(1, -1)}</code>`
    return part.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/_([^_\n]+)_/g, '<em>$1</em>').replace(/~([^~\n]+)~/g, '<s>$1</s>')
  }).join('')
}
