export function siteManifest(route) {
  if (route.name === 'notification-generator' || ['/gn', '/generate-notifications'].includes(route.path)) {
    return { url: '/notification-lab.webmanifest', title: 'Notification Lab', icon: '/comunicacao/app/icons/aito-v2-180.png' }
  }
  if (route.meta?.requiresAuth === 'admin' || /^\/admin(?:\/|$)/.test(route.path)) {
    return { url: '/comunicacao/app/manifest.webmanifest', title: 'AitoNotify', icon: '/comunicacao/app/icons/aito-v2-180.png' }
  }
  return { url: '/aitoia.webmanifest', title: 'Aito IA', icon: '/icons/aitoia-180.png' }
}

export function applySiteManifest(route) {
  const { url, title, icon } = siteManifest(route)
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', url)
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', icon)
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', title)
}
