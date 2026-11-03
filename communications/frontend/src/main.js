import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dialog, Loading, Notify, Lang } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/mdi-v7/mdi-v7.css'
import '@quasar/extras/bootstrap-icons/bootstrap-icons.css'
import 'quasar/src/css/index.sass'
import './css/app.css'
import './css/screen-privacy.css'

import { initializeInstallPrompt } from './services/install-app.js'
import { initializeEmbeddedSession } from './services/embedded-session.js'
import { communicationHostTarget } from './services/embedded-host.js'
import { installLocalization, initializeLocale } from './i18n/index.js'
import App from './App.vue'
import router from './router/index.js'
import { useAuthStore } from './stores/auth.js'

const hostTarget = window.parent === window ? communicationHostTarget(location.pathname + location.search + location.hash) : null
if (hostTarget) {
  // Existing iOS shortcuts still launch the old child URL. Recover the host
  // before mounting so its navigation and administrator SSO stay available.
  window.location.replace(hostTarget)
  await new Promise(() => {})
}
await initializeEmbeddedSession()
await initializeLocale()
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(Quasar, {
  plugins: { Dialog, Loading, Notify },
  config: {
    brand: {
      primary: '#35BCA4',
      secondary: '#82F8E6',
      dark: '#031515',
    },
    notify: {
      position: 'top-right',
      timeout: 3500,
      progress: true,
    },
  },
})
installLocalization(app,Lang)
app.use(router)

window.addEventListener('auth:expired', () => {
  const auth = useAuthStore(pinia)
  auth.clearSession()
  if (router.currentRoute.value.meta.requiresAuth) {
    router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }
})

initializeInstallPrompt()
app.mount('#app')
if (window.parent !== window) window.parent.postMessage({type:'aito.communication.mounted'}, location.origin)
