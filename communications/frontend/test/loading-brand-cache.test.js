import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const mocks=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../src/services/http.js',()=>({http:{get:mocks.get},unwrap:r=>r.data}))
const KEY='aito.communication.loading-brand.v1';let values
beforeEach(()=>{vi.resetModules();mocks.get.mockReset();values=new Map();vi.stubGlobal('localStorage',{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)})})
afterEach(()=>vi.unstubAllGlobals())
const cached=branding=>JSON.stringify({version:1,savedAt:Date.now(),branding})
describe('public loading brand cache',()=>{
  it('stores only public identity and preserves it during an API outage',async()=>{
    const {applyBranding,useWhiteLabel}=await import('../src/services/whitelabel.js')
    applyBranding({appName:'Minha Central',logoUrl:'https://example.com/logo.png',accessToken:'never-store'})
    const stored=JSON.parse(values.get(KEY))
    expect(Object.keys(stored.branding).sort()).toEqual(['accentColor','appName','backgroundColor','logoUrl','primaryColor','secondaryColor'])
    expect(JSON.stringify(stored)).not.toContain('never-store')
    mocks.get.mockRejectedValueOnce(Error('offline'));await useWhiteLabel().load()
    expect(useWhiteLabel().branding.appName).toBe('Minha Central');expect(useWhiteLabel().ready.value).toBe(true)
  })
  it('hydrates immediately but still fetches fresh settings and sanitizes cached logo URLs',async()=>{
    values.set(KEY,cached({appName:'Anterior',logoUrl:'javascript:alert(1)'}))
    const {useWhiteLabel}=await import('../src/services/whitelabel.js');const identity=useWhiteLabel()
    expect(identity.ready.value).toBe(true);expect(identity.loaded.value).toBe(false);expect(identity.branding.logoUrl).toBe('')
    mocks.get.mockResolvedValueOnce({data:{identity:{name:'Atual'}}});await identity.load()
    expect(mocks.get).toHaveBeenCalledWith('/settings/whitelabel');expect(identity.branding.appName).toBe('Atual')
  })
  it('ignores stale cache and tolerates unavailable browser storage',async()=>{
    values.set(KEY,JSON.stringify({version:1,savedAt:Date.now()-31*86400000,branding:{appName:'Vencido'}}))
    const {useWhiteLabel,applyBranding}=await import('../src/services/whitelabel.js')
    expect(useWhiteLabel().branding.appName).toBe('Notify Flow')
    vi.stubGlobal('localStorage',{setItem:()=>{throw Error('blocked')}})
    expect(()=>applyBranding({appName:'Funciona'})).not.toThrow();expect(useWhiteLabel().branding.appName).toBe('Funciona')
  })
  it('uses textContent and public validated logo URLs in the pre-SPA bootstrap',()=>{
    const source=readFileSync(new URL('../public/loading-brand-v1.js',import.meta.url),'utf8')
    const execute=branding=>{
      const title={},logo={addEventListener:vi.fn()},style={setProperty:vi.fn()},stars=[{style:{setProperty:vi.fn()}}]
      const root={style,querySelector:selector=>selector.endsWith('__title')?title:logo,querySelectorAll:()=>stars}
      runInNewContext(source,{localStorage:{getItem:()=>cached(branding)},document:{querySelector:()=>root},URL})
      return {title,logo,stars}
    }
    const result=execute({appName:'<b>Literal</b>',logoUrl:'https://example.com/logo.png',primaryColor:'#123ABC'})
    expect(result.title.textContent).toBe('<b>Literal</b>');expect(result.logo.src).toBe('https://example.com/logo.png')
    expect(result.stars[0].style.setProperty).toHaveBeenCalledWith('--star-color','#123ABC')
    for(const logoUrl of ['javascript:alert(1)','https://127.0.0.1/secret','https://192.168.1.1/secret','https://token@example.com/secret'])expect(execute({appName:'Nome',logoUrl}).logo.src).toBeUndefined()
  })
})
