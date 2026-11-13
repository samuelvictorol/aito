import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

test('admin worker shows customer, recharge and provider alerts', async () => {
  const shown = []
  const handlers = {}
  const self = {
    addEventListener: (event, listener) => { handlers[event] = listener },
    registration: {
      getNotifications: async () => [],
      showNotification: async (title, options) => shown.push({ title, ...options }),
    },
  }
  vm.runInNewContext(fs.readFileSync(new URL('../public/admin-notifications-sw.js', import.meta.url), 'utf8'), { self })
  for (const [index, type] of ['aito.admin-customer', 'aito.admin-recharge', 'aito.admin-provider-alert'].entries()) {
    const payload = { type, id: String(index + 1).repeat(24), title: 'Aviso', body: 'Informação' }
    let done
    handlers.push({ data: { json: () => payload }, waitUntil: value => { done = value } })
    await done
  }
  assert.equal(shown.length, 3)
  assert.ok(shown.every(item => item.data.url === '/admin'))
})
test('admin purchase worker validates payload, deduplicates active notices and always opens the admin',async()=>{const handlers={},shown=[],opened=[],visible=new Set();const self={location:{origin:'https://aitosoftwares.com'},addEventListener:(event,listener)=>handlers[event]=listener,skipWaiting(){},clients:{claim(){},matchAll:async()=>[],openWindow:async url=>opened.push(url)},registration:{getNotifications:async({tag})=>visible.has(tag)?[{}]:[],showNotification:async(title,data)=>{shown.push({title,data});visible.add(data.tag)}}};vm.runInNewContext(fs.readFileSync(new URL('../public/admin-notifications-sw.js',import.meta.url),'utf8'),{self});const push=async payload=>{let done;handlers.push({data:{json:()=>payload},waitUntil:value=>done=value});await done};await push({type:'other',id:'a'.repeat(24),title:'No',body:'No'});assert.equal(shown.length,0);const purchase={type:'aito.admin-purchase',id:'a'.repeat(24),title:'Nova compra',body:'Maria · R$ 397,00 · Desktop',url:'https://evil.invalid/'};await push(purchase);await push(purchase);assert.equal(shown.length,1);assert.equal(shown[0].data.data.url,'/admin');let clicked;handlers.notificationclick({notification:{close(){}},waitUntil:value=>clicked=value});await clicked;assert.deepEqual(opened,['https://aitosoftwares.com/admin'])})
