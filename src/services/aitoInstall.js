export const AITO_INSTALL_PATH = '/aitoia'

const offerRoutes = new Set(['aito-tokens-product', 'user-app', 'aito-ia', 'aito-ia-marketing-studio'])

export function offersAitoInstall(route) {
  return offerRoutes.has(route.name) && !(route.name === 'user-app' && route.query?.tab === 'profile')
}

export function installPlatform({ userAgent = '', platform, maxTouchPoints = 0, userAgentData } = {}) {
  if (/iPhone|iPad|iPod/i.test(userAgent) ||
      (platform === 'MacIntel' || /Macintosh/i.test(userAgent)) && maxTouchPoints > 1) return 'ios'
  if (userAgentData?.platform === 'Android' || /Android/i.test(userAgent)) return 'android'
  return 'desktop'
}

export function isInstalledAito(browser) {
  return browser.navigator.standalone === true ||
    browser.matchMedia?.('(display-mode: standalone)')?.matches === true
}
