import { desktopSolutions, desktopSolutionsFaq, desktopSolutionsSeo } from './desktopSolutions.js'
import { institutionalServices } from './landingInstitutional.js'
import { notificationGeneratorSeo } from './notificationGeneratorSeo.js'

export const siteOrigin = 'https://aitosoftwares.com'
const siteName = 'AitoSoftwares'
const socialImage = `${siteOrigin}/icons/aitoia-512.png`
const socialImageAlt = 'Robô da Aito IA em fundo verde escuro'

export const homeIntro = 'Use modelos OpenAI para conversar, analisar arquivos e criar imagens. Produza vídeos e peças de marketing no navegador com a mesma carteira AitoTokens.'
export const homeLinks = [
  { path: '/aitoia-video-studio', label: 'Estúdio de Vídeo com IA' },
  { path: '/aitoia-marketing-studio', label: 'Estúdio de Marketing' },
  { path: '/whatsapp-solucoes', label: 'Soluções para WhatsApp' },
  { path: '/sobre', label: 'Desenvolvimento sob medida' },
]

const organization = {
  '@type': 'Organization', '@id': `${siteOrigin}/#organization`, name: siteName, url: `${siteOrigin}/`,
  logo: `${siteOrigin}/aito-logo-restored.png`, sameAs: ['https://www.instagram.com/aitosoftwares/'],
}
const desktopSeo = desktopSolutionsSeo()

export const publicPages = {
  '/': {
    title: 'Aito IA | Chat, Vídeo e Marketing com IA | AitoSoftwares',
    heading: 'Aito IA para trabalhar e criar',
    description: homeIntro,
    links: homeLinks,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [organization, {
        '@type': 'WebSite', '@id': `${siteOrigin}/#website`, name: siteName, url: `${siteOrigin}/`, inLanguage: 'pt-BR',
        description: homeIntro, publisher: { '@id': organization['@id'] },
      }],
    },
  },
  '/sobre': {
    title: 'Software sob Medida, Cloud e Automação | AitoSoftwares',
    heading: 'Desenvolvimento de software sob medida',
    description: 'A AitoSoftwares desenvolve sistemas sob medida, migra operações para a nuvem e integra IA, WhatsApp, CRM e ERP. Conheça os serviços e cases.',
    features: institutionalServices.map(({ title, text }) => ({ title, text })),
    links: [{ path: '/sobre#cases', label: 'Cases e produtos' }, { path: '/sobre#contato', label: 'Solicitar diagnóstico gratuito' }],
  },
  '/whatsapp-solucoes': {
    title: desktopSeo.title,
    heading: 'Notificações e chatbots para WhatsApp no Desktop',
    description: desktopSeo.meta.description.content,
    intro: desktopSolutions.intro,
    sections: [desktopSolutions.notifications, desktopSolutions.bot, desktopSolutions.agent],
    faq: desktopSolutionsFaq,
    links: [{ path: '/whatsapp-solucoes-whitelabel', label: 'Versão Whitelabel com código-fonte' }],
  },
  '/whatsapp-solucoes-whitelabel': {
    title: 'Software Whitelabel para WhatsApp, Chatbot e Notificações | AitoSoftwares',
    heading: 'Soluções para WhatsApp Whitelabel',
    description: 'Adapte e hospede o código-fonte do Bot Builder e do AitoNotify com sua marca. Inclui fluxos, agentes de IA e notificações por WhatsApp, Telegram e e-mail.',
    links: [{ path: '/whatsapp-solucoes', label: 'Conhecer a versão Desktop para Windows' }],
  },
  '/aitoia-video-studio': {
    title: 'Estúdio de Vídeo com IA | Aito IA',
    heading: 'Estúdio de Vídeo da Aito IA',
    description: 'Crie vídeos com modelos Higgsfield, refaça cenas a partir de um vídeo de referência, organize personagens, grave locuções e exporte no navegador.',
    features: [
      { title: 'Criação de cenas com IA', text: 'Use um prompt com referências de imagem ou vídeo, conforme o modelo.' },
      { title: 'Refazer vídeos', text: 'Divida o vídeo de referência em cenas para editar e regenerar trechos.' },
      { title: 'Composição por código', text: 'Use modelos de motion para renderizar cenas e adicionar ao vídeo master.' },
    ],
    links: [{ path: '/aitotokens', label: 'Como funcionam os AitoTokens' }],
  },
  '/aitoia-marketing-studio': {
    title: 'Estúdio de Marketing com IA | Aito IA',
    heading: 'Estúdio de Marketing da Aito IA',
    description: 'Gere e edite imagens para campanhas de marketing com modelos OpenAI. Use referências, salve componentes da marca e escolha o formato da peça no navegador.',
    links: [{ path: '/aitoia-video-studio', label: 'Estúdio de Vídeo com IA' }, { path: '/aitotokens', label: 'Como funcionam os AitoTokens' }],
  },
  '/aitotokens': {
    title: 'AitoTokens | Créditos de IA para produtos e projetos',
    heading: 'Créditos AitoTokens',
    description: 'Recarregue em reais e acompanhe o consumo de IA no chat, nos estúdios e no Codex. Conecte projetos e produtos compatíveis usando sua AitoKey.',
    links: [{ path: '/', label: 'Abrir Aito IA' }, { path: '/aitoia-codex', label: 'Conhecer Aito IA para Codex' }],
  },
  '/aitoia-codex': {
    title: 'Aito IA para Codex no Windows | Crédito por uso com AitoTokens',
    heading: 'Aito IA para Codex',
    description: 'Use modelos GPT no Codex oficial para Windows com uma AitoKey. Analise repositórios, edite arquivos e rode testes usando créditos AitoTokens.',
    links: [{ path: '/aitocodex-theme', label: 'Instalar o tema Aito IA no Codex' }, { path: '/aitotokens', label: 'Planos de recarga AitoTokens' }],
  },
  '/aitocodex-theme': {
    title: 'Tema Aito IA para Codex | Cores, Ícones e Mascote',
    heading: 'Tema Aito IA para Codex',
    description: 'Baixe os arquivos e veja como instalar as cores, os ícones e o mascote Aito IA no Codex.',
    links: [{ path: '/aitoia-codex', label: 'Conhecer Aito IA para Codex' }],
  },
  '/links': {
    title: 'Links da AitoSoftwares | Aito IA, Codex, WhatsApp e Lembr.it',
    heading: 'Links da AitoSoftwares',
    description: 'Abrir o Aito IA, os estúdios de vídeo e marketing, o AitoCodex, as soluções de WhatsApp e os serviços da AitoSoftwares.',
    links: [{ path: '/', label: 'Aito IA' }, { path: '/aitoia-codex', label: 'AitoCodex' }, ...homeLinks],
  },
  '/generate-notifications': {
    title: notificationGeneratorSeo.title,
    heading: 'Aito Notification Lab',
    description: notificationGeneratorSeo.meta.description.content,
  },
  '/aitolearn': {
    title: 'AitoLearn | Cursos de Desenvolvimento da AitoSoftwares',
    heading: 'Cursos AitoLearn',
    description: 'Conheça os cursos de desenvolvimento da AitoSoftwares, confira o conteúdo das aulas e veja as opções de acesso no AitoLearn.',
  },
  '/politica-privacidade': {
    title: 'Política de Privacidade | AitoSoftwares',
    heading: 'Política de Privacidade',
    description: 'Conheça o tratamento de dados pessoais na AitoSoftwares, seus direitos e o canal de atendimento para solicitações de privacidade.',
  },
  '/termos-servico': {
    title: 'Termos de Serviço | AitoSoftwares',
    heading: 'Termos de Serviço',
    description: 'Consulte as condições de uso dos serviços, produtos digitais e cursos da AitoSoftwares.',
  },
}

export const publicPageAliases = { '/aitoia': '/', '/gn': '/generate-notifications', '/quem-somos': '/sobre' }

export function publicPageSeo(path = '/') {
  const cleanPath = path.replace(/\/+$/, '') || '/'
  const canonicalPath = publicPageAliases[cleanPath] || cleanPath
  const page = publicPages[canonicalPath]
  if (!page) return { title: siteName }

  const { title, description, structuredData } = page
  const canonical = new URL(canonicalPath, siteOrigin).href
  const meta = {
    description: { name: 'description', content: description },
    robots: { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ogTitle: { property: 'og:title', content: title },
    ogDescription: { property: 'og:description', content: description },
    ogUrl: { property: 'og:url', content: canonical },
    ogType: { property: 'og:type', content: 'website' },
    ogLocale: { property: 'og:locale', content: 'pt_BR' },
    ogSiteName: { property: 'og:site_name', content: siteName },
    ogImage: { property: 'og:image', content: socialImage },
    ogImageType: { property: 'og:image:type', content: 'image/png' },
    ogImageWidth: { property: 'og:image:width', content: '512' },
    ogImageHeight: { property: 'og:image:height', content: '512' },
    ogImageAlt: { property: 'og:image:alt', content: socialImageAlt },
    twitterCard: { name: 'twitter:card', content: 'summary' },
  }
  const script = structuredData ? {
    siteIdentity: { type: 'application/ld+json', innerHTML: JSON.stringify(structuredData).replaceAll('<', '\\u003c') },
  } : canonicalPath === '/whatsapp-solucoes' ? desktopSeo.script
    : canonicalPath === '/generate-notifications' ? notificationGeneratorSeo.script : {}

  return { title, meta, link: { canonical: { rel: 'canonical', href: canonical } }, script }
}
