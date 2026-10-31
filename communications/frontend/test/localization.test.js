// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import es from '../src/i18n/es.json'
import { uiText, setLocale, currentLocale, normalizeLocale } from '../src/i18n/index.js'
import { localizeSource } from '../build/localization-plugin.mjs'

afterEach(async()=>{await setLocale('pt-BR')})
describe('local catalogues and safe product-copy localization',()=>{
  it('covers the same product copy in both languages and preserves technical placeholders',()=>{
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
    expect(Object.keys(en).length).toBeGreaterThan(6500)
    for(const[key,value]of Object.entries(en)){expect(value).not.toMatch(/ZXQ|QXZ|⟦/);for(const marker of key.match(/\{\{[^}]+\}\}|\{\d+\}/g)||[]){expect(value).toContain(marker);expect(es[key]).toContain(marker)}}
  })
  it('persists the choice, supports Portuguese fallback and keeps customer content verbatim',async()=>{
    await setLocale('en-US');expect(currentLocale()).toBe('en-US');expect(uiText('Contatos')).toBe('Contacts');expect(document.documentElement.lang).toBe('en-US');expect(localStorage.getItem('notify.locale')).toBe('en-US')
    expect(uiText('Client-authored message: Maria, +5561999990000')).toBe('Client-authored message: Maria, +5561999990000')
    await setLocale('es');expect(uiText('Configurações')).toBe('Configuración');expect(uiText('Nome')).toBe('Nombre');expect(normalizeLocale('malicious')).toBe('pt-BR')
  })
  it('translates product UI at compilation without changing routes, channel identifiers, data bindings or matchers',()=>{
    const source=`<script setup>const options=[{label:'Contatos',value:'email'}];const typeLabels={message:'Mensagem'};function statusLabel(){return 'Enviado'};const payload={confirmation:'REMOVER HISTORICO SELECIONADO'};const url='/api/contacts';const isNarrow=matchMedia('(pointer: coarse)');const isMatch=value.includes('Contatos')</script><template><h1>Configurações</h1><q-input label="Nome" v-model="contact.name"/><p>{{ contact.message }}</p></template>`
    const result=localizeSource(source,'Example.vue',{translate:true,has:key=>Boolean(en[key])}).code
    expect(result).toContain('$ui("Configurações")');expect(result).toContain('value:\'email\'');expect(result).toContain("value.includes('Contatos')");expect(result).toContain("matchMedia('(pointer: coarse)')");expect(result).toContain("'/api/contacts'");expect(result).toContain('contact.message');expect(result).toContain('v-model="contact.name"')
    expect(result).toContain("confirmation:'REMOVER HISTORICO SELECIONADO'")
    expect(result).toContain('message:__uiTextSetup("Mensagem")');expect(result).toContain('return __uiTextSetup("Enviado")')
  })
})
