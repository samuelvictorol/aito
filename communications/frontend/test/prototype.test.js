import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { isPrototypePath, prototypeDestination } from '../src/services/prototype-mode.js'
import { DEMO_SECTIONS, DEMO_CONTACTS, DEMO_COMMANDS, prototypeSection, prototypeUrl, tourSections } from '../src/services/prototype-data.js'
import { http } from '../src/services/http.js'
import { prototypeContacts, prototypeRequest } from '../src/services/prototype-api.js'
import { PROTOTYPE_FLOW, simulatePrototypeFlow } from '../src/services/prototype-flow.js'
import { getStoredUser, getAccessToken, setStoredUser, setAccessToken, clearStoredSession } from '../src/services/tokens.js'
import { prototypeAuth, prototypeApp } from '../src/services/prototype-runtime.js'
import { useAuthStore } from '../src/stores/auth.js'
import { useAppStore } from '../src/stores/app.js'
const source=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8')
afterEach(()=>vi.unstubAllGlobals())
describe('isolated public prototype',()=>{
  it('recognizes only the dedicated namespace and maps every guided screen',()=>{
    expect(isPrototypePath('/prototype')).toBe(true);expect(isPrototypePath('/prototype/app-mobile?from=demo')).toBe(true)
    for(const path of ['/prototype-evil','/app-mobile','/login','/api/contacts'])expect(isPrototypePath(path)).toBe(false)
    expect(DEMO_SECTIONS).toHaveLength(32)
    expect(new Set(DEMO_SECTIONS.map(item=>item.key)).size).toBe(32)
    expect([1,2,3].flatMap(tourSections)).toHaveLength(32)
    for(const section of DEMO_SECTIONS)expect(prototypeSection(prototypeUrl(section.key))?.key).toBe(section.key)
    expect(prototypeSection('/prototype/app-mobile/web').key).toBe('whatsapp-web')
    expect(prototypeSection('/prototype/app-mobile/cloud').key).toBe('whatsapp-cloud')
    expect(prototypeSection('/prototype/whatsapp-web/flows/exemplo').key).toBe('whatsapp-web/flows')
    expect(prototypeSection('/prototype/unknown')).toBeNull()
    expect(prototypeDestination({path:'/app-mobile/web',query:{from:'demo'},hash:''})).toEqual({path:'/prototype/app-mobile/web',query:{from:'demo'},hash:''})
    expect(prototypeDestination({path:'/whitelabel',hash:'#storage'}).path).toBe('/prototype/backup')
  })
  it('serves cloned fictional reads without credentials or reaching the supplied network adapter',async()=>{
    vi.stubGlobal('location',{pathname:'/prototype/templates'})
    const adapter=vi.fn(async()=>({status:200,data:{},headers:{}}))
    const response=await http.get('/contacts',{adapter,headers:{Authorization:'Bearer real-secret'}})
    expect(response.data.contacts).toHaveLength(4)
    expect(response.config.headers.Authorization).toBeUndefined()
    expect(response.config.withCredentials).toBe(false)
    response.data.contacts[0].name='Temporary local edit'
    expect((await http.get('/contacts',{adapter})).data.contacts[0].name).toBe('Ana Martins')
    for(const method of ['post','put','patch','delete'])await expect(http.request({url:'/contacts',method,adapter})).rejects.toThrow('Demonstração')
    expect(adapter).not.toHaveBeenCalled()
  })
  it('isolates account identity and stores without reading or replacing an existing login',()=>{
    vi.stubGlobal('location',{pathname:'/prototype/settings'})
    const storage={getItem:vi.fn(()=>{throw Error('Real storage must not be accessed')}),setItem:vi.fn(),removeItem:vi.fn()}
    vi.stubGlobal('localStorage',storage);vi.stubGlobal('sessionStorage',storage)
    expect(useAuthStore()).toBe(prototypeAuth);expect(useAppStore()).toBe(prototypeApp)
    expect(getAccessToken()).toBeNull();expect(getStoredUser().email).toBe('admin@example.com')
    setAccessToken('fake');setStoredUser({email:'fake@example.com'});clearStoredSession()
    expect(storage.getItem).not.toHaveBeenCalled();expect(storage.setItem).not.toHaveBeenCalled();expect(storage.removeItem).not.toHaveBeenCalled()
  })
  it('rejects session changes, provider calls, credentials and deletion even when manually requested',()=>{
    for(const [url,method] of [['/whatsapp/start','post'],['/whatsapp/logout','post'],['/actions/test','post'],['/settings/credentials','post'],['/integrations/openai/profiles/test','put'],['/integrations/infinitepay/configs/test','delete'],['/flows/demo-flow','put']])expect(()=>prototypeRequest({baseURL:'/api/whatsapp-web',url,method,data:{}})).toThrow('Demonstração')
    expect(()=>prototypeRequest({url:'/admin-assistant/confirm',method:'post',data:{}})).toThrow('Demonstração')
    expect(()=>prototypeRequest({url:'/flows/simulate',method:'post',data:{}})).toThrow('Demonstração')
  })
  it('runs the graph currently being edited locally, including choices and an AI placeholder',()=>{
    const flow=structuredClone(PROTOTYPE_FLOW)
    flow.nodes.find(n=>n.nodeId==='services').data.messages[0].text='Resposta editada no canvas'
    const first=simulatePrototypeFlow({flow,text:'Olá'})
    expect(first.context.nodeId).toBe('choice')
    const choice=simulatePrototypeFlow({flow,text:'1',context:first.context})
    expect(choice.events.some(e=>e.output?.text==='Resposta editada no canvas')).toBe(true)
    expect(choice.context.mode).toBe('closed')
    const ai=simulatePrototypeFlow({flow,text:'2',context:first.context})
    const answer=simulatePrototypeFlow({flow,text:'Minha dúvida',context:ai.context,aiLive:true})
    expect(answer.events.some(e=>e.output?.text.includes('Resposta fictícia'))).toBe(true)
    expect(PROTOTYPE_FLOW.nodes.find(n=>n.nodeId==='services').data.messages[0].text).not.toBe('Resposta editada no canvas')
  })
  it('produces a local escaped site preview without persisting or executing supplied HTML',()=>{
    const response=prototypeRequest({url:'/site-templates/preview',method:'post',data:{title:'Teste',sections:[{title:'<script>alert(1)</script>',text:'Texto de exemplo'}]}})
    expect(response.data.document).toContain('&lt;script&gt;')
    expect(response.data.document).not.toContain('<script>')
    expect(prototypeRequest({url:'/site-templates',method:'get'}).data.items[0].name).toBe('Orientações completas')
  })
  it('reuses the original pages and menu while the agent and fixtures stay fictional',()=>{
    expect(source('pages/PrototypePage.vue')).toContain("import('./TemplatesPage.vue')")
    expect(source('pages/PrototypePage.vue')).toContain("import('../modules/whatsapp-web/pages/FlowBuilderPage.vue')")
    expect(source('components/prototype/PrototypeNavigation.vue')).toContain('createAppNavigation')
    expect(DEMO_CONTACTS.every(item=>item.email.endsWith('@example.com'))).toBe(true)
    expect(prototypeContacts.every(item=>Array.isArray(item.channels)&&item.channels.every(c=>c.authorized&&c.consentStatus==='granted'))).toBe(true)
    expect(source('components/prototype/PrototypeAssistant.vue')).not.toMatch(/\bfetch\(|\baxios\.|\/admin-assistant/)
    expect(DEMO_COMMANDS.map(item=>item.command)).toEqual(expect.arrayContaining(['/login','/notify-me','menu','/desligar']))
    expect(source('router/index.js').indexOf('if (to.meta.prototype) return')).toBeLessThan(source('router/index.js').indexOf('await auth.bootstrap()'))
  })
})
