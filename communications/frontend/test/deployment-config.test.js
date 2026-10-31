import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const hostFile=path=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8')
const childFile=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
describe('deploy incorporado à AitoSoftwares',()=>{
  it('compila as duas aplicações independentemente e publica o filho com fallback próprio',()=>{
    const scripts=JSON.parse(hostFile('package.json')).scripts
    expect(scripts.build).toContain('build:communication')
    expect(scripts.build).toContain('assemble-communication.mjs')
    expect(scripts.prebuild).toContain('npm ci --prefix communications/frontend')
    expect(hostFile('Dockerfile')).toContain('RUN npm run build')
    expect(hostFile('public/_redirects')).toContain('/comunicacao/api/* https://api.aitosoftwares.com/comunicacao/api/:splat 200!')
    const nginx=hostFile('nginx.conf')
    expect(nginx).toContain('location /comunicacao/app/')
    expect(nginx).toContain('try_files $uri $uri/ /comunicacao/app/index.html;')
    expect(nginx).toContain('proxy_ssl_server_name on;')
    expect(nginx).toContain('proxy_set_header Upgrade $http_upgrade;')
    expect(nginx).toContain('session(?:/|$)')
  })
  it('isola assets, API, sockets e service worker no mount da comunicação',()=>{
    const vite=childFile('vite.config.js')
    expect(vite).toContain("base: '/comunicacao/app/'")
    expect(vite).toContain("JSON.stringify('/comunicacao/api')")
    expect(childFile('src/services/socket.js')).toContain("path: '/comunicacao/socket.io'")
    expect(childFile('src/modules/whatsapp-web/services.js')).toContain("path: '/comunicacao/whatsapp-web/socket.io'")
    expect(childFile('src/services/browser-push.js')).toContain("scope: '/comunicacao/app/'")
    expect(JSON.parse(childFile('public/manifest.webmanifest')).scope).toBe('/comunicacao/app/')
  })
})
