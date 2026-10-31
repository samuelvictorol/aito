import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createHelpGuides, filterHelpGuides, HELP_GROUPS, youtubeVideoId, youtubeWatchUrl, youtubeEmbedUrl } from '../src/services/help-guides.js'
function source(path) { return readFileSync(fileURLToPath(new URL(`../src/${path}`, import.meta.url)), 'utf8') }
const guides=createHelpGuides({name:'Escola QA',whatsappCommand:'/avisar',telegramCommand:'/iniciar',origin:'https://painel.example.test'})
describe('Central de Ajuda por menu',()=>{
  it('cobre os destinos do menu e as opções Web com passos, campos e dúvidas',()=>{
    const paths=[...(source('layouts/MainLayout.vue') + source('services/app-navigation.js')).matchAll(/to:\s*'(\/[^']*)'/g)].map(match=>match[1])
    const web=['','/connection','/flows','/native-flows','/contacts','/catalog','/files','/integrations','/logs','/settings'].map(path=>'/whatsapp-web'+path)
    const targets=new Set(guides.map(guide=>guide.to))
    for(const path of [...paths,...web])expect(targets.has(path),'missing guide '+path).toBe(true)
    const ids=guides.map(guide=>guide.id);expect(new Set(ids).size).toBe(ids.length)
    for(const guide of guides){expect(guide.steps.length).toBeGreaterThanOrEqual(3);expect(guide.fields.length).toBeGreaterThanOrEqual(3);expect(guide.faqs.length).toBeGreaterThanOrEqual(2);expect(HELP_GROUPS.some(group=>group.id===guide.group)).toBe(true);for(const related of guide.related)expect(ids).toContain(related)}
  })
  it('pesquisa palavras sem acento, combina termos e respeita categorias',()=>{
    expect(filterHelpGuides(guides,'verificacao')).toContainEqual(expect.objectContaining({id:'settings'}))
    expect(filterHelpGuides(guides,'phone number')).toHaveLength(1);expect(filterHelpGuides(guides,'phone number')[0].id).toBe('whatsapp-cloud')
    expect(filterHelpGuides(guides,'App Secret','governance')).toEqual([])
    expect(filterHelpGuides(guides,'','channels').every(guide=>guide.group==='channels')).toBe(true)
    expect(filterHelpGuides(guides,'xyz-sem-resultado')).toEqual([])
  })
  it('usa marca, comandos e callback locais e explica limites reais do agente',()=>{
    const data=JSON.stringify(guides)
    for(const text of ['Escola QA','/avisar','/iniciar','https://painel.example.test/comunicacao/api/webhooks/telegram'])expect(data).toContain(text)
    const agent=JSON.stringify(guides.find(guide=>guide.id==='assistant'))
    for(const text of ['Contexto e configuração','remoção/substituição explícita','revisão','bloqueado'])expect(agent).toContain(text)
    expect(guides.find(guide=>guide.id==='gmail').links[0].url).toContain('support.google.com')
    expect(guides.find(guide=>guide.id==='telegram').links[0].url).toContain('core.telegram.org')
    expect(guides.find(guide=>guide.id==='web-integrations').links[0].url).toContain('developers.openai.com')
    expect(data).not.toContain('aitosoftwares.com')
  })
  it('normaliza vídeos e só gera embed nocookie para URLs seguras',()=>{
    const id='aBcD_123-xy'
    for(const url of [`https://www.youtube.com/watch?v=${id}&t=12`,`https://youtu.be/${id}?si=test`,`https://youtube.com/shorts/${id}`,`https://www.youtube-nocookie.com/embed/${id}`,`https://youtube-nocookie.com/embed/${id}`]){
      expect(youtubeVideoId(url)).toBe(id);expect(youtubeWatchUrl(url)).toBe(`https://www.youtube.com/watch?v=${id}`);expect(youtubeEmbedUrl(url)).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0`)
    }
    for(const url of ['javascript:alert(1)',`http://youtu.be/${id}`,`https://youtube.com.evil.test/watch?v=${id}`,`https://youtube.com@evil.test/watch?v=${id}`,`https://u:p@youtube.com/watch?v=${id}`,`https://youtube.com:444/watch?v=${id}`,`https://youtu.be/${id}/extra`,`https://youtube.com/watch?v=${id}&v=otherID_123`,`https://youtube.com\\@evil.test/watch?v=${id}`,'https://youtu.be/short','https://www.youtube.com/watch?v=aBcD_12\n3-xy']){
      expect(youtubeVideoId(url),url).toBe(null);expect(youtubeEmbedUrl(url)).toBe('')
    }
  })
  it('preserva rota autenticada, busca acessível e player somente após clique',()=>{
    expect(source('router/index.js')).toContain("path: 'help'");expect((source('layouts/MainLayout.vue') + source('services/app-navigation.js'))).toContain("label: 'Ajuda'")
    const page=source('pages/HelpPage.vue')
    for(const text of ['route.query.guide','aria-label="Buscar na ajuda"','v-if="videoLoaded&&embedUrl"','videoLoaded=true','Configurar vídeo deste guia',"http.put('/help-guides'",'<q-tabs','<q-tab-panels','<q-carousel','help-mobile-topics'])expect(page).toContain(text)
    expect(page).not.toContain('localStorage');expect(page).toContain('src="/comunicacao/app/meuperfil.png"');expect(page).toContain('@error="profileImageAvailable=false"')
    const help=source('components/ContextHelp.vue');expect(help).toContain('aria-haspopup="dialog"');expect(help).toContain(':maximized="$q.screen.lt.sm"')
  })
  it('mantém contexto dos provedores e o segredo do webhook protegido',()=>{
    const home=source('pages/HomePage.vue'),cloud=source('pages/WhatsappCloudPage.vue')
    for(const text of ['title="Callback automático do Telegram"','title="Callback do WhatsApp Cloud"','title="Phone Number ID"','delete telegramSource.webhookSecret','savedCredentialPreviews','http.get(`/settings/reveal/${channel}`)','aria-label="Copiar URL de callback do Telegram"'])expect(home).toContain(text)
    expect(home).not.toContain('aria-label="Copiar webhook secret"');expect(cloud).toContain('title="Cadastro pelo webhook"');expect(cloud).toContain('title="Eventos seguros do webhook"')
  })
})
