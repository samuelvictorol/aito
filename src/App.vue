<template>
  <router-view /><CosmicScene v-if="screenLoading"/>
  <AitoCodexOffer />
</template>

<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CosmicScene from './components/CosmicScene.vue'
import {screenLoading} from './services/screen-loading'
import { useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()
const AitoCodexOffer = defineAsyncComponent(() => import('./components/AitoCodexOffer.vue'))

function handleSessionExpired(event) {
  const loginPath = event.detail?.loginPath || '/?auth=login'
  $q.notify({
    type: 'warning',
    position: 'top',
    icon: 'mdi-login',
    timeout: 10000,
    message: 'Sua sessão expirou. Faça login novamente.',
    actions: [{ label: 'Fazer login', color: 'white', icon: 'mdi-login', handler: () => router.push(loginPath) }],
  })
}

onMounted(() => window.addEventListener('aito:session-expired', handleSessionExpired))
onBeforeUnmount(() => window.removeEventListener('aito:session-expired', handleSessionExpired))
</script>
