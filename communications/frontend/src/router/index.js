import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useAppStore } from '../stores/app.js'
import { refreshAccessToken } from '../services/auth-refresh.js'
import { routeAllowed, firstAllowed } from '../services/access.js'
import { installRouteLoading } from '../services/route-loading.js'
import { prototypeDestination } from '../services/prototype-mode.js'

const routes = [
  {path:'/system-events',name:'system-events',component:()=>import('../components/SystemEventsConsole.vue'),meta:{requiresAuth:true}},
  { path: '/prototype/login', name: 'prototype-login', component: () => import('../pages/LoginPage.vue'), meta: { public: true, prototype: true } },
  { path: '/prototype/colaboradores', alias: '/prototype/whatsapp-web/atendente', name: 'prototype-team-login', component: () => import('../pages/LoginPage.vue'), props: { collaboratorOnly: true }, meta: { public: true, prototype: true } },
  { path: '/prototype/:section(.*)*', name: 'prototype', component: () => import('../pages/PrototypePage.vue'), meta: { public: true, prototype: true } },
  { path: '/notificacao/:slug', name: 'public-site', component: () => import('../pages/PublicSitePage.vue'), meta: { public: true } },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/invite/:slug',
    name: 'public-invite',
    component: () => import('../pages/PublicInvitePage.vue'),
    meta: { public: true },
  },
  {
    path: '/meu-perfil',
    name: 'my-profile',
    component: () => import('../pages/ProfilePage.vue'),
    meta: { public: true },
  },
  {
    path: '/whatsapp-web/catalogo/:slug',
    name: 'whatsapp-web-public-catalog',
    component: () => import('../modules/whatsapp-web/pages/PublicCatalogPage.vue'),
    meta: { public: true },
  },
  {
    path: '/whatsapp-web/atendente',
    alias: ['/colaboradores', '/colaboradores/login'],
    name: 'whatsapp-web-collaborator-session',
    component: () => import('../pages/LoginPage.vue'),
    props: { collaboratorOnly: true },
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('../pages/HomePage.vue') },
      { path: 'colaborador', name: 'collaborator-home', component: () => import('../pages/CollaboratorHomePage.vue') },
      { path: 'app-mobile', alias: ['/app', '/mobile-app'], name: 'app-mobile', component: () => import('../pages/MobileAppPage.vue'), meta: { appMobile: true } },
      { path: 'app-mobile/web', name: 'app-mobile-web', component: () => import('../pages/MobileAppPage.vue'), props: { channel: 'web' }, meta: { appMobile: true, whatsappWebChat: true } },
      { path: 'app-mobile/cloud', name: 'app-mobile-cloud', component: () => import('../pages/MobileAppPage.vue'), props: { channel: 'cloud' }, meta: { appMobile: true } },
      { path: 'collaborators', name: 'collaborators', component: () => import('../pages/CollaboratorsPage.vue') },
      { path: 'contacts', name: 'contacts', component: () => import('../pages/ContactsPage.vue') },
      { path: 'templates', name: 'templates', component: () => import('../pages/TemplatesPage.vue') },
      { path: 'notifications', alias: '/notification', name: 'notifications', component: () => import('../pages/NotificationsPage.vue') },
      { path: 'schedules', name: 'notification-schedules', component: () => import('../pages/NotificationSchedulesPage.vue') },
      { path: 'integrations', name: 'integrations', component: () => import('../pages/IntegrationsPage.vue') },
      { path: 'telegram', name: 'telegram', component: () => import('../pages/TelegramPage.vue'), meta: { channel: 'telegram' } },
      {
        path: 'chats',
        redirect: { name: 'whatsapp-cloud', query: { tab: 'conversations' } },
      },
      { path: 'whatsapp-cloud', name: 'whatsapp-cloud', component: () => import('../pages/WhatsappCloudPage.vue') },
      {
        path: 'whatsapp-web',
        component: () => import('../modules/whatsapp-web/WorkspaceLayout.vue'),
        children: [
          { path: '', name: 'whatsapp-web', component: () => import('../modules/whatsapp-web/pages/ChatsPage.vue'), meta: { whatsappWebChat: true } },
          { path: 'chats', name: 'whatsapp-web-chats', redirect: (to) => ({ name: 'whatsapp-web', query: to.query }), meta: { whatsappWebChat: true } },
          { path: 'connection', name: 'whatsapp-web-connection', component: () => import('../modules/whatsapp-web/pages/HomePage.vue') },
          { path: 'flows', name: 'whatsapp-web-flows', component: () => import('../modules/whatsapp-web/pages/FlowsPage.vue') },
          { path: 'flows/:id', name: 'whatsapp-web-flow-builder', component: () => import('../modules/whatsapp-web/pages/FlowBuilderPage.vue') },
          { path: 'native-flows', name: 'whatsapp-web-native-flows', component: () => import('../modules/whatsapp-web/pages/NativeFlowsPage.vue') },
          { path: 'contacts', name: 'whatsapp-web-contacts', component: () => import('../modules/whatsapp-web/pages/ContactsPage.vue') },
          { path: 'colaboradores', name: 'whatsapp-web-collaborators', redirect: { name: 'collaborators' } },
          { path: 'catalog', name: 'whatsapp-web-catalog', component: () => import('../modules/whatsapp-web/pages/CatalogPage.vue') },
          { path: 'files', name: 'whatsapp-web-assets', component: () => import('../modules/whatsapp-web/pages/AssetsPage.vue') },
          { path: 'integrations', name: 'whatsapp-web-integrations', component: () => import('../modules/whatsapp-web/pages/IntegrationsPage.vue') },
          { path: 'logs', name: 'whatsapp-web-logs', component: () => import('../modules/whatsapp-web/pages/LogsPage.vue') },
          { path: 'settings', name: 'whatsapp-web-settings', component: () => import('../modules/whatsapp-web/pages/SettingsPage.vue') },
        ],
      },
      { path: 'email', name: 'email', component: () => import('../pages/EmailPage.vue'), meta: { channel: 'email' } },
      {
        path: 'invites',
        name: 'invites',
        component: () => import('../pages/InvitesPage.vue'),
        meta: { requiresInviteChannels: true },
      },
      { path: 'terms', name: 'terms', component: () => import('../pages/TermsPage.vue') },
      { path: 'logins', name: 'profile-logins', component: () => import('../pages/LoginSettingsPage.vue') },
      { path: 'administrators', name: 'administrators', component: () => import('../pages/AdminAccountsPage.vue') },
      { path: 'whitelabel', name: 'whitelabel', component: () => import('../pages/WhiteLabelPage.vue') },
      { path: 'help', alias: '/ajuda', name: 'help', component: () => import('../pages/HelpPage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue'), meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (to) => to.hash ? { el: to.hash, top: 16 } : { top: 0 },
})

installRouteLoading(router)

router.beforeEach(async (to, from) => {
  // Links inside the original views remain inside the sandbox; a full login link explicitly exits it.
  if (from.meta.prototype && !to.meta.prototype) {
    return prototypeDestination(to)
  }
  if (to.meta.prototype) return
  const auth = useAuthStore()
  if (to.path === '/sistema') {
    await auth.bootstrap()
    if (auth.user?.role !== 'admin') return firstAllowed(auth.user)
    window.top.location.assign('/admin/comunicacao/sistema')
    return false
  }
  if (to.meta.appMobile && !auth.token && !auth.isCollaborator) {
    try { auth.token = await refreshAccessToken(); auth.ready = false } catch { /* The normal login redirect preserves the requested channel. */ }
  }
  await auth.bootstrap()

  if (to.meta.guestOnly && auth.isAuthenticated) return firstAllowed(auth.user)
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (!to.meta.public && !routeAllowed(to.fullPath, auth.user)) return firstAllowed(auth.user)

  if (to.meta.channel) {
    const app = useAppStore()
    await app.fetchStatus()
    if (!app.isChannelEnabled(to.meta.channel)) {
      if (auth.isCollaborator) return '/colaborador'
      return { name: 'home', query: { unavailable: to.meta.channel } }
    }
  }

  if (to.meta.requiresInviteChannels) {
    const app = useAppStore()
    await app.fetchStatus()
    if (!app.canAccessInvites) {
      if (auth.isCollaborator) return '/colaborador'
      return { name: 'home', query: { unavailable: 'invites' } }
    }
  }
})

export default router
