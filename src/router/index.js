import { installLeadAttribution } from '../services/lead-attribution'
import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  if (!process.env.SERVER) installLeadAttribution(Router)

  Router.beforeEach((to) => {
    if (process.env.SERVER) return true

    const token = localStorage.getItem('aito_user_token')
    const affiliateToken = localStorage.getItem('aito_affiliate_token')
    let sessionUser = {}
    try {
      sessionUser = JSON.parse(localStorage.getItem('aito_user') || '{}')
    } catch (error) {
      sessionUser = {}
    }

    if (to.meta?.requiresAuth === 'user' && !token) {
      return '/'
    }



    if (to.meta?.requiresAuth === 'customer' && !token) {
      return '/customer/login'
    }

    if (to.meta?.requiresAuth === 'customer' && sessionUser.role !== 'customer') {
      return '/customer/login'
    }

    if (to.meta?.requiresAuth === 'admin' && !localStorage.getItem('aito_admin_token')) {
      return '/admin/login'
    }

    if (to.meta?.requiresAuth === 'affiliate' && !affiliateToken) return '/'
    if (to.meta?.requiresAuth === 'affiliate') {
      try {
        const affiliate = JSON.parse(localStorage.getItem('aito_affiliate_user') || '{}')
        if (affiliate.role !== 'affiliate') return '/'
      } catch (error) { return '/' }
    }

    return true
  })

  return Router
})
