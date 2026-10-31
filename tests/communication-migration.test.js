import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isPrototypePath } from '../communications/frontend/src/services/prototype-mode.js'
import { communicationUrl, communicationPayload } from '../communications/frontend/src/services/communication-urls.js'
import { protectedMediaPath } from '../communications/frontend/src/modules/whatsapp-web/media-url.js'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('embedded prototype remains an isolated demo under the new public mount',()=>{
  assert.equal(isPrototypePath('/comunicacao/app/prototype/whatsapp-web/flows/demo-flow'),true)
  assert.equal(isPrototypePath('/comunicacao/app/whatsapp-web'),false)
  assert.equal(isPrototypePath('/admin/comunicacao'),false)
})
test('stored media links are remapped without altering opaque signatures or third party content',()=>{
  assert.equal(communicationUrl('/api/media/abc?sig=opaque'),'/comunicacao/api/media/abc?sig=opaque')
  assert.equal(communicationUrl('https://notify-flow.onrender.com/invite/demo','https://aitosoftwares.com'),'https://aitosoftwares.com/comunicacao/app/invite/demo')
  assert.equal(communicationUrl('https://example.com/api/media/abc'),'https://example.com/api/media/abc')
  assert.deepEqual(communicationPayload({media:{url:'/api/media/abc'},token:'nf_live_opaque'}),{media:{url:'/comunicacao/api/media/abc'},token:'nf_live_opaque'})
  assert.equal(protectedMediaPath('https://notify-flow.onrender.com/api/whatsapp-web/assets/abc/content?sig=opaque','/comunicacao/api/whatsapp-web','https://aitosoftwares.com'),'/assets/abc/content?sig=opaque')
  assert.equal(protectedMediaPath('https://evil.test/api/whatsapp-web/assets/abc/content','/comunicacao/api/whatsapp-web','https://aitosoftwares.com'),null)
})
test('host gates administration and exposes the public prototype separately; landing floats are never suppressed',()=>{
  const routes=new Function(read('src/router/routes.js').replace('export default routes','return routes'))()
  assert.equal(routes.find(r=>r.name==='communication-admin').meta.requiresAuth,'admin')
  assert.equal(routes.find(r=>r.name==='communication-demo').meta.communicationDemo,true)
  assert.ok(routes.find(r=>r.name==='communication-system'))
  assert.doesNotMatch(read('src/pages/WhatsAppBotBuilderProductPage.vue'),/demoInView|v-show="!demo/)
  const bridge=read('communications/frontend/src/services/embedded-session.js')
  assert.match(bridge,/event\.origin !== location\.origin/)
  assert.match(bridge,/event\.source !== window\.parent/)
  assert.doesNotMatch(bridge,/aito_admin_token/)
})

test('Netlify preserves API/session proxies and independent SPA fallbacks with automatic child dependency installation',()=>{
  const redirects=read('public/_redirects')
  assert.ok(redirects.indexOf('/comunicacao/api/*')<redirects.indexOf('/comunicacao/app/*'))
  assert.ok(redirects.indexOf('/comunicacao/app/*')<redirects.lastIndexOf('/* /index.html'))
  assert.match(redirects,/\/comunicacao\/session https:\/\/api\.aitosoftwares\.com\/comunicacao\/session 200!/)
  assert.match(JSON.parse(read('package.json')).scripts.prebuild,/npm ci --prefix communications\/frontend/)
  assert.match(read('communications/frontend/vite.config.js'),/VITE_SOCKET_URL.*https:\/\/api\.aitosoftwares\.com/)
  assert.doesNotMatch(redirects,/^\/comunicacao\/app\s+\/comunicacao\/app\//m)
  assert.match(read('netlify.toml'),/command = "npm run build"/)
  assert.match(read('netlify.toml'),/publish = "dist\/spa"/)
})
