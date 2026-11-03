const canonical = 'https://aitosoftwares.com/generate-notifications'
const title = 'Gerador de notificações para iOS e Android | Aito Notification Lab'
const description = 'Crie e teste notificações personalizadas no seu próprio dispositivo. Edite título, mensagem e imagem, salve até três templates no navegador e teste no iPhone ou Android compatível.'

// Optional localized copy; keep a single canonical URL rather than inventing
// alternate-language routes which do not actually exist.
export const notificationGeneratorLocales = {
  en: {
    title: 'Personal notification generator for iPhone and Android | Aito Notification Lab',
    description: 'Preview your own notification title, message and image. Keep up to three templates in your browser and test notifications on a supported iPhone or Android device.',
  },
  es: {
    title: 'Generador de notificaciones para iPhone y Android | Aito Notification Lab',
    description: 'Prueba notificaciones personales con título, mensaje e imagen. Guarda hasta tres plantillas en tu navegador y comprueba su aspecto en un iPhone o Android compatible.',
  },
}

export const notificationGeneratorSeo = {
  title,
  meta: {
    description: { name: 'description', content: description },
    keywords: { name: 'keywords', content: 'gerador de notificações, notificações personalizadas, simulador de notificações, fake notifications iOS, fake notifications Android, notification generator, teste de notificações iPhone, web push' },
    robots: { name: 'robots', content: 'index,follow' },
    ogTitle: { property: 'og:title', content: title },
    ogDescription: { property: 'og:description', content: description },
    ogUrl: { property: 'og:url', content: canonical },
    ogType: { property: 'og:type', content: 'website' },
    ogImage: { property: 'og:image', content: 'https://aitosoftwares.com/aito-logo-restored.png' },
  },
  link: { canonical: { rel: 'canonical', href: canonical } },
  script: {
    notificationGenerator: { type: 'application/ld+json', innerHTML: JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Aito Notification Lab', url: canonical,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'iOS, Android, Windows, macOS',
      description, browserRequirements: 'Navegador com suporte a Service Worker e Web Push. No iOS, adicionar à Tela de Início e permitir notificações.',
      creator: { '@type': 'Organization', name: 'AitoSoftwares', url: 'https://aitosoftwares.com' },
    }) },
  },
}
