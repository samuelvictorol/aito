import { landingHeroVideo, botBuilderHeroVideo, desktopSolutionVideos } from './landingHeroVideo.js'

export const learnPreviewDefault = 'https://www.youtube.com/watch?v=ekZtwCJvH1g'
export const landingVideoDefaults = {
  'home-presentation': landingHeroVideo.src,
  'desktop-presentation': botBuilderHeroVideo.src,
  'desktop-notifications': desktopSolutionVideos.notifications.src,
  'desktop-botbuilder': desktopSolutionVideos.botBuilder.src,
  'desktop-installation': desktopSolutionVideos.installation.src,
  'aitolearn-preview': learnPreviewDefault,
}

export const landingVideoPages = [
  { title: 'AitoSoftwares', path: '/', slots: [
    { id: 'home-presentation', section: 'Seu próximo passo começa com uma ideia', anchor: 'inicio' },
  ] },
  { title: 'AitoIA Desktop', path: '/whatsapp-solucoes', slots: [
    { id: 'desktop-presentation', section: 'Apresentação do Kit Desktop', anchor: 'apresentacao' },
    { id: 'desktop-notifications', section: 'Notificações com a API oficial', anchor: 'notificacoes' },
    { id: 'desktop-botbuilder', section: 'Conheça o WhatsApp Bot Builder', anchor: 'chatbots' },
    { id: 'desktop-installation', section: 'Passo a passo de instalação', anchor: 'instalacao' },
  ] },
  { title: 'AitoIA Whitelabel', path: '/whatsapp-solucoes-whitelabel', slots: [
    { id: 'whitelabel-presentation', section: 'Da primeira mensagem ao próximo passo', anchor: 'apresentacao' },
  ] },
  { title: 'AitoTokens', path: '/aitotokens', slots: [
    { id: 'aitotokens-presentation', section: 'Um saldo para criar com IA', anchor: 'apresentacao' },
  ] },
  { title: 'AitoLearn', path: '/aitolearn', slots: [
    { id: 'aitolearn-preview', section: 'Aula demonstrativa · A plataforma', anchor: 'metodo' },
  ] },
]
