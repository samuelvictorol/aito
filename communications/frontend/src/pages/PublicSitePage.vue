<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { profileHttp, getProfileExpiresAt } from '../services/profile.js'
import { errorMessage, unwrap } from '../services/http.js'
import { inPrototype } from '../services/prototype-runtime.js'
import WhiteLabelBrand from '../components/WhiteLabelBrand.vue'
import SiteDocumentFrame from '../components/SiteDocumentFrame.vue'
const route = useRoute(), content = ref(null), loading = ref(false), status = ref(0), error = ref('')
let timer, sessionTimer, version = 0
function expire() { content.value = null; status.value = 410; error.value = 'Esta página expirou e saiu do ar.' }
function scheduleExpiration() { if (!content.value) return; const remaining = new Date(content.value.expiresAt).getTime() - Date.now(); if (remaining <= 0) expire(); else timer = setTimeout(scheduleExpiration, Math.min(2147483647, remaining)) }
function sessionExpired() { if (content.value?.visibility === 'private') { content.value = null; status.value = 401; error.value = 'Sua sessão expirou. Entre novamente para continuar.' } }
async function load() {
  const current = ++version; clearTimeout(timer); clearTimeout(sessionTimer); content.value = null; loading.value = true; error.value = ''
  try {
    const value = unwrap(await profileHttp.get('/public/sites/' + encodeURIComponent(route.params.slug)))
    if (current !== version) return
    if (value.expiresAt && new Date(value.expiresAt) <= new Date()) { expire(); return }
    content.value = value; status.value = 200
    if (value.expiresAt) scheduleExpiration()
    if (value.visibility === 'private' && getProfileExpiresAt()) sessionTimer = setTimeout(sessionExpired, Math.max(0, Math.min(2147483647, new Date(getProfileExpiresAt()).getTime() - Date.now())))
  } catch (cause) { if (current === version) { status.value = cause.response?.status || 500; error.value = errorMessage(cause, 'Não foi possível abrir esta página.') } }
  finally { if (current === version) loading.value = false }
}
function mediaFailed(cause) { if ([401,403,404,410].includes(cause.response?.status)) { content.value = null; status.value = cause.response.status; error.value = 'O acesso a esta notificação não está mais disponível.' } }
function visible() { if (document.visibilityState === 'visible') load() }
function rememberReturn() { if (!inPrototype()) localStorage.setItem('aito.communication.siteReturn', JSON.stringify({ path: route.path, at: Date.now() })) }
function profileChanged(event) { if (event.key === 'aito.communication.profileAccessToken') { if (event.newValue) load(); else sessionExpired() } }
watch(() => route.params.slug, load)
onMounted(() => { load(); window.addEventListener('notify:profile-session-expired', sessionExpired); window.addEventListener('storage', profileChanged); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { version++; clearTimeout(timer); clearTimeout(sessionTimer); window.removeEventListener('notify:profile-session-expired', sessionExpired); window.removeEventListener('storage', profileChanged); document.removeEventListener('visibilitychange', visible) })
</script>
<template><main class="public-site"><header><WhiteLabelBrand compact/><q-badge v-if="content?.visibility==='private'" color="purple" icon="lock">Acesso privado</q-badge></header><div v-if="loading" class="site-state"><q-spinner color="primary" size="32px"/> Carregando notificação…</div><section v-else-if="!content" class="site-state"><q-icon :name="status===401||status===403?'lock':'public_off'" size="48px" color="purple"/><h1>{{status===401?'Entre para continuar':status===403?'Acesso restrito':status===410?'Notificação expirada':'Notificação indisponível'}}</h1><p>{{error}}</p><q-btn v-if="status===401" color="primary" no-caps label="Entrar no Meu perfil" @click="rememberReturn" :to="{path:'/meu-perfil',query:{retorno:route.path}}"/><q-btn flat no-caps label="Tentar novamente" @click="load"/></section><SiteDocumentFrame v-else :content="content" public-access :media-base="'/public/sites/'+route.params.slug+'/media/'" @error="mediaFailed"/></main></template>
<style scoped>.public-site{width:100%;background:#f4f8f7;min-height:100%;padding:20px clamp(10px,3vw,40px)}.public-site>header{max-width:1020px;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:10px 0 20px}.site-state{max-width:650px;margin:8vh auto;padding:30px;text-align:center;background:white;border-radius:20px;display:flex;align-items:center;flex-direction:column;gap:14px}.site-state h1{font-size:27px;line-height:1.3;margin:5px 0}.site-state p{font-size:14px;line-height:1.7;color:#637c70}@media(max-width:600px){.public-site{padding:12px 0}.public-site>header{padding:8px 14px 18px}}</style>
