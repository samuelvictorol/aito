<template>
  <router-view /><CosmicScene v-if="screenLoading"/><button v-if="['/','/whatsapp-solucoes'].includes(route.path)" type="button" class="kit-buy-float" @click="openKit"><q-icon name="mdi-shopping-outline"/> Comprar o kit</button>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CosmicScene from './components/CosmicScene.vue'
import {screenLoading} from './services/screen-loading'
import {useRoute} from 'vue-router'
import { useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()
const route=useRoute()
function openKit(){if(route.path==='/whatsapp-solucoes')document.getElementById('planos')?.scrollIntoView({behavior:'smooth'});else router.push('/whatsapp-solucoes')}

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

<style>.kit-buy-float{border:1px solid #b0ffe4;cursor:pointer;position:fixed;bottom:22px;left:22px;z-index:6000;display:flex;align-items:center;gap:9px;padding:15px 21px;border-radius:100px;background:#91ffe0;color:#07362b;text-decoration:none;font-size:13px;font-weight:800;box-shadow:0 8px 30px #0007}@media(max-width:600px){.kit-buy-float{bottom:14px;left:12px;font-size:11px;padding:12px}}</style>