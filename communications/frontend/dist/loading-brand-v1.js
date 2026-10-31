/* Public identity only. Runs before the SPA bundle, under script-src self. */
;(() => {
  try {
    const raw = localStorage.getItem('aito.communication.loading-brand.v1')
    if (!raw || raw.length > 5000) return
    const value = JSON.parse(raw)
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() + 60000 || Date.now() - value.savedAt > 30 * 86400000) return
    const brand = value.branding, root = document.querySelector('.spa-loading--bootstrap')
    if (!root || !brand || typeof brand.appName !== 'string') return
    root.querySelector('.spa-loading__title').textContent = brand.appName.trim().slice(0, 80) || 'Notify Flow'
    const colors = [brand.primaryColor, brand.secondaryColor, brand.accentColor].filter(color => /^#[a-f0-9]{6}$/i.test(color || ''))
    if (colors.length) {
      root.style.setProperty('--loading-accent', colors[0])
      root.querySelectorAll('.spa-loading__star').forEach((star,index) => star.style.setProperty('--star-color', colors[index % colors.length]))
    }
    if (!brand.logoUrl || typeof brand.logoUrl !== 'string' || brand.logoUrl.length > 2048) return
    const url = new URL(brand.logoUrl), host = url.hostname.replace(/\.$/, '').toLowerCase(), ip = host.split('.').map(Number)
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.includes(':') || /\.(?:localhost|local|internal|lan)$/.test(host)) return
    if (ip.length === 4 && ip.every(Number.isInteger) && (ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 || ip[0] === 169 && ip[1] === 254 || ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31 || ip[0] === 192 && ip[1] === 168)) return
    const logo = root.querySelector('.spa-loading__logo')
    logo.addEventListener('error', () => { logo.src = '/comunicacao/app/icons/aito-v2-180.png' }, {once:true})
    logo.src = url.href
  } catch { /* Blocked storage or an old cache never prevents loading. */ }
})()
