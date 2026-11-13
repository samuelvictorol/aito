const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const privacyHosts = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com'])

export function youtubeVideoId(value) {
  if (typeof value !== 'string' || value.length > 2048) return ''
  try {
    const text = value.trim()
    if (!text || /[\x00-\x20\x7f\\<>]/.test(text)) return ''
    const url = new URL(/^(?:m\.|www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(text) ? 'https://' + text : text)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return ''
    const path = url.pathname.replace(/\/$/, '')
    let id = ''
    if (url.hostname === 'youtu.be') id = /^\/([\w-]{11})$/.exec(path)?.[1]
    else if (youtubeHosts.has(url.hostname)) id = url.pathname === '/watch' && url.searchParams.getAll('v').length === 1
      ? url.searchParams.get('v') : /^\/(?:embed|shorts|live)\/([\w-]{11})$/.exec(path)?.[1]
    else if (privacyHosts.has(url.hostname)) id = /^\/embed\/([\w-]{11})$/.exec(path)?.[1]
    return typeof id === 'string' && /^[\w-]{11}$/.test(id) ? id : ''
  } catch { return '' }
}

export function youtubeEmbedUrl(value) {
  const id = youtubeVideoId(value)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0` : ''
}

export function landingVideoSource(overrides, slot, fallback = '') {
  if (!slot || !Object.hasOwn(overrides, slot)) return fallback
  const video = overrides[slot]
  if (video === null) return ''
  return youtubeVideoId(video) ? video : fallback
}
