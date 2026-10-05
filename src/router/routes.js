const routes = [
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
  { path: '/whatsappbotbuilder', name: 'whatsappbotbuilder-product', component: () => import('pages/WhatsAppBotBuilderProductPage.vue') },
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
  {
    path: '/customer',
    name: 'customer-app',
    meta: { requiresAuth: 'customer' },
    component: () => import('pages/CustomerHomePage.vue'),
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
    path: '/vendedor/login',
    name: 'seller-login',
    component: () => import('pages/SellerLoginPage.vue'),
  },
  {
    path: '/vendedor',
    name: 'seller-chat',
    component: () => import('pages/SellerChatPage.vue'),
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
