// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { applyPwaBranding, publicManifestUrl, pwaBrand } from '../src/services/pwa-branding.js'
it('provides an absolute default icon for deep routes and uses configured branding without executable URLs', () => {
  const base='/comunicacao/app/'
  expect(pwaBrand({},base).logoUrl).toBe(base+'icons/aito-v2-180.png')
  expect(publicManifestUrl(base)).toBe('/comunicacao/api/settings/app.webmanifest')
  expect(pwaBrand({logoUrl:'javascript:alert(1)'},base).logoUrl).toBe(base+'icons/aito-v2-180.png')
  document.head.innerHTML=''
  applyPwaBranding({appName:'Marca de exemplo',logoUrl:'https://brand.example/logo.png'})
  expect(document.querySelector('link[rel="apple-touch-icon"]').href).toBe('https://brand.example/logo.png')
  expect(document.querySelector('meta[name="apple-mobile-web-app-title"]').content).toBe('Marca de exemplo')
})
