import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ACTIONS, AREAS, apiPermission, canAction, canArea, firstAllowed, normalizedPermissions, routeAllowed, routeArea } from '../src/services/access.js'
import { vCanAction } from '../src/services/permission-directives.js'
const actor=permissions=>({role:'collaborator',permissions:{channels:[],...permissions}})
const source=path=>readFileSync(fileURLToPath(new URL('../src/'+path,import.meta.url)),'utf8')
const memory=()=>{const state=new Map();return{getItem:key=>state.get(key)||null,setItem:(key,value)=>state.set(key,value),removeItem:key=>state.delete(key)}}
beforeEach(()=>{vi.stubGlobal('localStorage',memory());vi.stubGlobal('sessionStorage',memory())})
describe('system-wide collaborator permissions',()=>{
  it('keeps existing channel chats while denying all new areas by default',()=>{
    const legacy=actor({channels:['whatsapp_web'],contacts:'view'})
    expect(canAction(legacy,'whatsapp_web','delete')).toBe(false);expect(canArea(legacy,'whatsapp_web',true)).toBe(true);expect(routeAllowed('/app-mobile',legacy)).toBe(true)
    for(const area of ['settings','collaborators','assistant','web_flows','web_settings','whitelabel','backup'])expect(canArea(legacy,area)).toBe(false)
    expect(normalizedPermissions(legacy.permissions).actions).toEqual({});expect(firstAllowed(legacy)).toBe('/app-mobile')
  })
  it('enforces view/manage restrictions and explicit sensitive grants',()=>{
    expect(canAction(actor({contacts:'view',actions:{'contacts.delete':true}}),'contacts','delete')).toBe(false)
    const manager=actor({contacts:'manage',settings:'manage',assistant:'manage',whatsapp_cloud:'manage',actions:{'contacts.delete':false}})
    expect(canAction(manager,'contacts','create')).toBe(true);expect(canAction(manager,'contacts','delete')).toBe(false)
    for(const [area,action] of [['settings','credentials'],['assistant','configure'],['whatsapp_cloud','configure']])expect(canAction(manager,area,action)).toBe(false)
    manager.permissions.actions['assistant.configure']=true;expect(canAction(manager,'assistant','configure')).toBe(true)
    expect(canAction(manager,'contacts','invented')).toBe(false);expect(canAction({role:'admin'},'settings','credentials')).toBe(true)
  })
  it('guards backup hash and Web subfeatures independently',()=>{
    const user=actor({channels:['whatsapp_web'],whatsapp_web:'none',web_flows:'view',assistant:'view',backup:'view'})
    expect(routeAllowed('/whatsapp-web/flows/123',user)).toBe(true);expect(routeAllowed('/whatsapp-web',user)).toBe(false)
    expect(routeAllowed('/whitelabel#storage',user)).toBe(true);expect(routeAllowed('/whitelabel',user)).toBe(false)
    expect(routeArea('/whatsapp-web/colaboradores')).toBe('collaborators');expect(routeAllowed('/collaborators',user)).toBe(false)
    expect(routeAllowed('/whatsapp-web/settings',user)).toBe(false);expect(firstAllowed(user)).toBe('/whatsapp-web/flows')
  })
  it('classifies destructive, sending, import, credentials and consent actions',()=>{
    const request=(url,method='post',data)=>apiPermission({url,method,data})
    expect(request('/contacts/import')).toEqual({area:'contacts',action:'import'})
    expect(request('/contacts/export','get')).toEqual({area:'contacts',action:'export'})
    expect(request('/privacy/contacts/123/consents')).toEqual({area:'contacts',action:'permissions'})
    expect(request('/settings/reveal/email','get')).toEqual({area:'settings',action:'credentials'})
    expect(request('/admin-assistant/confirm')).toEqual({area:'assistant',action:'execute'})
    expect(apiPermission({baseURL:'/api/whatsapp-web',url:'/chats/123/media',method:'post'})).toEqual({area:'whatsapp_web',action:'send'})
    expect(request('/whatsapp-web/chats/123/messages/456/action','post',{action:'delete'})).toEqual({area:'whatsapp_web',action:'delete'})
    expect(request('/whatsapp-web/chats/123/read','patch')).toBe(null)
    expect(request('/whatsapp-web/chats/123/messages','get')).toBe(null)
    expect(request('/whatsapp-web/assets')).toEqual({area:'web_files',action:'import'})
    expect(request('/media')).toEqual({area:'templates',action:'import'})
    expect(request('/whatsapp-web/flows/123/active','patch')).toEqual({area:'web_flows',action:'execute'})
    expect(request('/whatsapp-web/integrations/contact-groups','post')).toEqual({area:'web_contacts',action:'create'})
    expect(request('/telegram/conversations/123/messages')).toEqual({area:'telegram',action:'send'})
    expect(request('/telegram/settings','put')).toEqual({area:'telegram',action:'configure'})
  })
  it('hides unavailable actions and restores display only for authorized actions',()=>{
    const el={style:{display:'inline-flex'},setAttribute:vi.fn(),removeAttribute:vi.fn()}
    sessionStorage.setItem('aito.communication.user',JSON.stringify(actor({contacts:'manage',actions:{'contacts.delete':false}})))
    vCanAction.beforeMount(el,{value:'contacts.delete'});expect(el.style.display).toBe('none');expect(el.setAttribute).toHaveBeenCalledWith('aria-hidden','true')
    vCanAction.updated(el,{value:'contacts.edit'});expect(el.style.display).toBe('inline-flex');vCanAction.unmounted(el)
  })
  it('places team management above contacts and preserves the public collaborator login',()=>{
    const layout=(source('layouts/MainLayout.vue') + source('services/app-navigation.js')),workspace=source('modules/whatsapp-web/WorkspaceLayout.vue'),router=source('router/index.js')
    expect(layout.indexOf("label: 'Colaboradores'")).toBeLessThan(layout.indexOf("label: 'Contatos'"))
    expect(layout).toContain("to: '/collaborators'");expect(workspace).not.toContain("label: 'Colaboradores'")
    expect(router).toContain("name: 'whatsapp-web-collaborators', redirect: { name: 'collaborators' }")
    expect(router).toContain("alias: ['/colaboradores', '/colaboradores/login']")
    expect(source('services/collaborator-accounts.js')).not.toContain('whatsapp-web')
    expect(AREAS).toHaveLength(29);expect(new Set(ACTIONS).size).toBe(ACTIONS.length)
  })
})
