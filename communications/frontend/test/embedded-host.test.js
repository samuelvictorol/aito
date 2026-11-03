import { describe, expect, it } from 'vitest'
import { communicationHostTarget, installedAppContext } from '../src/services/embedded-host.js'

describe('installed AitoSoftwares communication host', () => {
  it('recovers legacy direct launches without dropping a deep conversation link', () => {
    expect(communicationHostTarget('/comunicacao/app/app-mobile/web?chatId=example#latest'))
      .toBe('/admin/comunicacao/app-mobile/web?chatId=example#latest')
    expect(communicationHostTarget('/comunicacao/app/')).toBe('/admin/comunicacao')
    expect(communicationHostTarget('/comunicacao/app/settings')).toBe('/admin/comunicacao/settings')
  })
  it('keeps public collaborator, invitation, notification and demo pages outside administrator navigation', () => {
    for (const path of ['prototype/app-mobile','colaboradores/login','whatsapp-web/atendente','whatsapp-web/catalogo/example','invite/example','notificacao/example','meu-perfil']) {
      expect(communicationHostTarget('/comunicacao/app/' + path)).toBe(null)
    }
    for (const path of ['/admin/comunicacao/app-mobile','/comunicacao/application/app-mobile','//other.example/comunicacao/app/app-mobile','https://other.example/comunicacao/app/app-mobile']) {
      expect(communicationHostTarget(path)).toBe(null)
    }
  })
  it('recognizes a same-origin installed host from its embedded child', () => {
    const parent={location:{origin:'https://aitosoftwares.com'},navigator:{standalone:true},matchMedia:()=>({matches:false})}
    const child={location:{origin:'https://aitosoftwares.com'},navigator:{standalone:false},parent,matchMedia:()=>({matches:false})}
    expect(installedAppContext(child)).toBe(true)
    expect(installedAppContext({...child,location:{origin:'https://other.example'}})).toBe(false)
  })
  it('tolerates blocked access to an unrelated parent and normal browser windows', () => {
    const view={matchMedia:()=>({matches:false}),navigator:{standalone:false},location:{origin:'https://aitosoftwares.com'}}
    view.parent=view
    expect(installedAppContext(view)).toBe(false)
    const denied={...view,get parent(){throw Error('SecurityError')}}
    expect(installedAppContext(denied)).toBe(false)
    expect(installedAppContext({...view,navigator:{standalone:true}})).toBe(true)
  })
})
