export const codexPluginVersion = '0.2.8'
export const codexPluginFilename = `PluginCodex-${codexPluginVersion}.zip`
export const codexPluginZipPath = '/downloads/aitoia-codex.zip'
export const codexPluginZipUrl = `${codexPluginZipPath}?v=${codexPluginVersion}`
export const codexOfficialUrl = 'https://openai.com/codex/'
export const codexProductPath = '/aitoia-codex'

export const codexOfferInterval = 10 * 60 * 1000
export const codexOfferStorageKey = 'aito.codex-offer.last-shown.v1'

const promotedRoutes = new Set([
  'landing-3d', 'aito-tokens-product', 'aito-codex-product', 'user-app', 'aito-ia',
  'aito-ia-video-studio', 'aito-ia-marketing-studio',
  'whatsapp-solutions-product', 'whatsapp-solutions-source', 'bio-links',
])

export function offersCodex(route, adminSession) {
  return !adminSession && !route.query?.auth &&
    (route.name !== 'user-app' || route.query?.tab !== 'profile') && promotedRoutes.has(route.name)
}

export function codexOfferDelay(now, lastShown) {
  const recordedAt = Number(lastShown)
  return recordedAt > 0 && recordedAt <= now ? Math.max(0, codexOfferInterval - (now - recordedAt)) : 0
}
