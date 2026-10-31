const routes = [
  { path: '/admin/comunicacao/sistema', name: 'communication-system', meta: {requiresAuth:'admin'}, component: () => import('pages/CommunicationSystemPage.vue') },
  { path: '/admin/comunicacao/:section(.*)*', name: 'communication-admin', meta: {requiresAuth:'admin'}, component: () => import('pages/CommunicationPage.vue') },
  { path: '/whatsapp-solucoes/teste-gratis/:section(.*)*', name: 'communication-demo', meta: {communicationDemo:true}, component: () => import('pages/CommunicationPage.vue') },
  { path: '/prototype/:section(.*)*', redirect: to => ({path:'/whatsapp-solucoes/teste-gratis/'+(Array.isArray(to.params.section)?to.params.section.join('/'):to.params.section||''),query:to.query,hash:to.hash}) },
  ...['/colaboradores', '/colaboradores/login', '/whatsapp-web/atendente', '/whatsapp-web/catalogo/:slug', '/invite/:slug', '/notificacao/:slug', '/meu-perfil'].map(path => ({path,component:()=>import('pages/CommunicationPublicRedirectPage.vue')})),
  { path: '/produto/acesso', component: () => import('pages/ProductAccessPage.vue') },
  {
    path: '/',
    name: 'landing-3d',
    component: () => import('pages/AitoLanding3DPage.vue'),
  },
  {
    path: '/auth/google/callback',
    name: 'google-auth-callback',
    component: () => import('pages/GoogleAuthCallbackPage.vue'),
  },
  {
    path: '/surpresa',
    name: 'dance-surprise',
    component: () => import('pages/AitoDancePage.vue'),
  },
  {
    path: '/aitolearn',
    name: 'aitolearn-catalog',
    component: () => import('pages/AitoLearnLaunchPage.vue'),
  },
  { path: '/whatsapp-solucoes', name: 'whatsapp-solutions-product', component: () => import('pages/WhatsAppBotBuilderProductPage.vue') },
  { path: '/whatsappbotbuilder', name: 'whatsappbotbuilder-product', redirect: to => ({ path: '/whatsapp-solucoes', query: to.query, hash: to.hash }) },
  {
    path: '/cursos/pagamento',
    name: 'course-payment',
    component: () => import('pages/CoursePaymentPage.vue'),
  },
  {
    path: '/cursos',
    name: 'course-marketplace-legacy',
    redirect: '/aitolearn',
  },
  {
    path: '/cursos/:slug/aulas',
    name: 'course-learning',
    component: () => import('pages/CourseLearningPage.vue'),
  },
  {
    path: '/cursos/:slug',
    name: 'course-preview',
    component: () => import('pages/CoursePreviewPage.vue'),
  },
  {
    path: '/certificados/verificar/:token',
    name: 'certificate-verification',
    component: () => import('pages/CertificateVerificationPage.vue'),
  },
  {
    path: '/app',
    name: 'user-app',
    meta: { requiresAuth: 'user' },
    component: () => import('pages/UserHomePage.vue'),
  },
  {
    path: '/affiliate',
    name: 'affiliate-app',
    meta: { requiresAuth: 'affiliate' },
    component: () => import('pages/AffiliateHomePage.vue'),
  },
  { path:'/affiliate/login',name:'affiliate-login',component:()=>import('pages/AffiliateLoginPage.vue') },
  {
    path: '/customer',
    name: 'customer-app',
    meta: { requiresAuth: 'customer' },
    redirect: '/app',
  },
  {
    path: '/customer/login',
    name: 'customer-login',
    component: () => import('pages/CustomerLoginPage.vue'),
  },
  {
    path: '/politica-privacidade',
    name: 'privacy-policy',
    component: () => import('pages/LegalPage.vue'),
    props: { type: 'privacy' },
  },
  {
    path: '/termos-servico',
    name: 'terms-of-service',
    component: () => import('pages/LegalPage.vue'),
    props: { type: 'terms' },
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('pages/AdminLoginPage.vue'),
  },
  {
    path: '/admin',
    name: 'admin-panel',
    meta: { requiresAuth: 'admin' },
    component: () => import('pages/AdminPanelPage.vue'),
  },
  {
    path: '/vendedor',
    alias: ['/vendedor/login', '/vendedor/chat'],
    name: 'whatsapp-moved',
    component: () => import('pages/WhatsAppMovedPage.vue'),
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
