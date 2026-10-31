import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
let listeners,manifest
beforeEach(()=>{vi.resetModules();listeners=new Map();manifest={href:''};vi.stubGlobal('window',{location:{pathname:'/prototype/app-mobile'},matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>listeners.set(name,fn)});vi.stubGlobal('navigator',{standalone:false});vi.stubGlobal('document',{querySelector:()=>manifest,createElement:()=>({})})})
afterEach(()=>vi.unstubAllGlobals())
describe('home screen shortcuts',()=>{
  it('keeps the demo and real app identities, scopes and targets separate',async()=>{
    const service=await import('../src/services/install-app.js');service.initializeInstallPrompt()
    expect(manifest.href).toBe('/comunicacao/app/prototype.webmanifest')
    expect(service.installTarget('/prototype/app-mobile/cloud')).toBe('/comunicacao/app/prototype/app-mobile')
    expect(service.installTarget('/app-mobile/web')).toBe('/comunicacao/app/app-mobile')
    service.configureInstallManifest('/app-mobile');expect(manifest.href).toBe('/comunicacao/api/settings/app.webmanifest')
  })
  it('uses the native prompt when the browser supplies it, once per event',async()=>{
    const service=await import('../src/services/install-app.js');const app=service.useInstallApp(),event={preventDefault:vi.fn(),prompt:vi.fn(async()=>{}),userChoice:Promise.resolve({outcome:'accepted'})}
    listeners.get('beforeinstallprompt')(event);expect(event.preventDefault).toHaveBeenCalled()
    expect(await app.request()).toBe(true);expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(await app.request()).toBe(false)
  })
  it('discards an old install event when switching between real and prototype modes',async()=>{
    const service=await import('../src/services/install-app.js');const app=service.useInstallApp(),prompt=vi.fn()
    listeners.get('beforeinstallprompt')({preventDefault(){},prompt,userChoice:Promise.resolve({})})
    service.configureInstallManifest('/app-mobile')
    expect(await app.request()).toBe(false);expect(prompt).not.toHaveBeenCalled()
  })
  it('falls back to manual guidance when installation is unavailable or fails',async()=>{
    const service=await import('../src/services/install-app.js');const app=service.useInstallApp()
    expect(await app.request()).toBe(false)
    listeners.get('beforeinstallprompt')({preventDefault(){},prompt:async()=>{throw Error('unsupported')}})
    expect(await app.request()).toBe(false)
  })
})
