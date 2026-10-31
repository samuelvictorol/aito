import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { ref } from 'vue'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const routes = new Function(read('src/router/routes.js').replace('export default routes', 'return routes'))()

test('product and account routes remain available while legacy chat URLs show migration guidance', () => {
  for (const path of ['/whatsappbotbuilder', '/app', '/customer', '/admin', '/cursos/pagamento', '/auth/google/callback']) {
    assert.ok(routes.some(route => route.path === path), `Missing commercial route ${path}`)
  }
  const moved = routes.find(route => route.path === '/vendedor')
  assert.deepEqual(moved.alias, ['/vendedor/login', '/vendedor/chat'])
  assert.match(String(moved.component), /WhatsAppMovedPage/)
  const guidance = read('src/pages/WhatsAppMovedPage.vue')
  assert.match(guidance, /href="\/comunicacao\/app\/colaboradores"/)
  assert.doesNotMatch(guidance, /localStorage|sessionStorage|Authorization|\$route/)
})

function sourceFiles(directory) {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? sourceFiles(path) : /\.(vue|js|scss)$/.test(path) ? [path] : []
  })
}

test('site sources do not import a local WhatsApp runtime or visual editor dependencies', () => {
  for (const path of sourceFiles('src')) {
    assert.doesNotMatch(read(path), /@vue-flow|\/admin\/whatsapp|\/seller\/conversations|\/seller\/whatsapp|bot-editor-guard|components\/whatsapp\//, path)
  }
  const dependencies = JSON.parse(read('package.json')).dependencies
  assert.equal(Object.keys(dependencies).some(name => name.startsWith('@vue-flow/')), false)
  assert.ok(dependencies['socket.io-client'], 'Product payment confirmations still use Socket.IO')
  for (const path of ['src/pages/WhatsAppBotBuilderProductPage.vue', 'src/components/UserProductsPanel.vue']) {
    const source = read(path)
    assert.match(source, /\/products\/(?:whatsappbotbuilder|aitonotify)/)
    assert.match(source, /purchase\.updated/)
  }
})

test('customer license controls use commercial admin contracts without a WhatsApp contact', async () => {
  const requests = [], notifications = [], events = []
  const script = read('src/components/LicenseTokenList.vue').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
  const license = { _id: 'license-123', token: 'old-qa-token', active: true }
  const controller = new Function('ref', 'useQuasar', 'defineProps', 'defineEmits', 'api', 'localStorage', `${script}\nreturn { rotate, toggle }`)(
    ref,
    () => ({ notify: value => notifications.push(value) }),
    () => ({ licenses: [license] }),
    () => event => events.push(event),
    {
      post: async (path, body, config) => { requests.push({ method: 'POST', path, body, config }); return { data: { data: { token: 'rotated-qa-token' } } } },
      patch: async (path, body, config) => { requests.push({ method: 'PATCH', path, body, config }); return { data: { data: body } } },
    },
    { getItem: key => key === 'aito_admin_token' ? 'qa-admin-token' : null },
  )
  await controller.rotate(license)
  await controller.toggle(license)
  assert.deepEqual(requests.map(({ method, path }) => ({ method, path })), [
    { method: 'POST', path: '/admin/botbuilder/licenses/license-123/rotate' },
    { method: 'PATCH', path: '/admin/botbuilder/licenses/license-123' },
  ])
  assert.equal(requests[0].config.headers.Authorization, 'Bearer qa-admin-token')
  assert.equal(requests[1].config.headers.Authorization, 'Bearer qa-admin-token')
  assert.deepEqual(requests[1].body, { active: false })
  assert.equal(license.token, 'rotated-qa-token')
  assert.equal(license.active, false)
  assert.deepEqual(events, ['changed', 'changed'])
  assert.equal(notifications[0].type, 'positive')
})
