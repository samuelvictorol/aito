<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute(), router = useRouter(), frame = ref(null), error = ref(''), loading = ref(true), version = ref(0)
const demo = computed(() => route.meta.communicationDemo === true)
const section = computed(() => Array.isArray(route.params.section) ? route.params.section.join('/') : String(route.params.section || ''))
const frameUrl = computed(() => '/comunicacao/app/' + (demo.value ? 'prototype' + (section.value ? '/' + section.value : '') : section.value) + route.fullPath.slice(route.path.length))
async function receive(event) {
  if (event.origin !== location.origin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'aito.communication.branding') {
    const brand = event.data.branding || {}
    let icon = '/comunicacao/app/icons/aito-v2-180.png'
    try { const url = new URL(brand.logoUrl, location.origin); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) icon = url.href } catch {}
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', icon)
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', String(brand.appName || 'AitoSoftwares').slice(0, 80))
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/comunicacao/api/settings/app.webmanifest')
    return
  }
  if (event.data?.type === 'aito.communication.mounted') { loading.value = false; return }
  if (event.data?.type !== 'aito.communication.ready' || demo.value) return
  const requestId = event.data.requestId
  if (!/^[a-f\d-]{36}$/i.test(requestId || '')) return
  try {
    const token = localStorage.getItem('aito_admin_token')
    const response = await fetch('/comunicacao/session', { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' }, body: '{}' })
    const envelope = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) { await router.replace({name:'admin-login',query:{redirect:route.fullPath}}); return }
      throw new Error(envelope.message || envelope.error?.message || 'A comunicação ainda não está pronta. Confira Sistema e tente novamente.')
    }
    if (event.source !== frame.value?.contentWindow) return
    event.source.postMessage({ type: 'aito.communication.session', requestId, data: envelope.data || envelope }, location.origin)
    error.value = ''
  } catch (cause) { error.value = cause.message; loading.value = false }
}
function retry() { error.value = ''; loading.value = true; version.value++ }
onMounted(() => window.addEventListener('message', receive))
onBeforeUnmount(() => window.removeEventListener('message', receive))
</script>
<template>
  <div class="communication-host">
    <header class="communication-host__bar"><router-link :to="demo?'/whatsapp-solucoes':'/admin'"><q-icon name="mdi-arrow-left"/>{{demo?'Conhecer o kit':'Painel AitoSoftwares'}}</router-link><strong>{{demo?'Demonstração gratuita':'Comunicação'}}</strong><router-link v-if="!demo" to="/admin/comunicacao/sistema"><q-icon name="mdi-cog-outline"/>Sistema</router-link><a v-else href="https://aitosoftwares.com/whatsapp-solucoes#planos">Ver planos <q-icon name="mdi-arrow-top-right"/></a></header>
    <main class="communication-host__main"><iframe ref="frame" :key="version" :src="frameUrl" :title="demo?'Demonstração do ecossistema de comunicação':'Painel de comunicação AitoSoftwares'" allow="microphone; camera; clipboard-write; fullscreen; autoplay; geolocation" referrerpolicy="same-origin"/>
      <div v-if="loading || error" class="communication-host__status" role="status"><q-spinner v-if="loading" color="teal-4" size="40px"/><q-icon v-else name="mdi-cloud-alert-outline" size="38px"/><strong>{{loading?'Abrindo sua central de comunicação':error}}</strong><span v-if="loading">Preparando seus canais e ferramentas.</span><div v-else><q-btn outline no-caps color="teal-3" label="Tentar novamente" @click="retry"/><q-btn v-if="!demo" flat no-caps color="teal-2" label="Abrir Sistema" to="/admin/comunicacao/sistema"/></div></div>
    </main>
  </div>
</template>
<style scoped>
.communication-host{height:100dvh;display:flex;flex-direction:column;background:#f1fbf7}.communication-host__bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;padding:7px 16px;color:#d7f9ed;background:#062c29;border-bottom:1px solid #315e54;font-size:11px;line-height:1.5}.communication-host__bar a{display:flex;align-items:center;gap:6px;color:#c8efdf;text-decoration:none}.communication-host__bar strong{font-size:11px;font-weight:600}.communication-host__main{position:relative;flex:1;min-height:0}.communication-host iframe{height:100%;width:100%;display:block;border:0}.communication-host__status{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:17px;padding:25px;background:#061d20;color:#d4f6e8;text-align:center}.communication-host__status strong{max-width:580px;line-height:1.8}.communication-host__status span{font-size:12px;color:#92b9aa}.communication-host__status>div{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}@media(max-width:550px){.communication-host__bar{padding:8px 10px;gap:8px;font-size:10px}.communication-host__bar strong{display:none}}
</style>
