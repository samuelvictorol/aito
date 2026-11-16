<template>
  <q-layout view="lHh Lpr lFf" class="user-app">
    <q-page-container><q-page class="user-app__page"><div class="user-app__shell">
      <header class="user-app__header"><router-link class="user-app__brand" to="/sobre"><img src="/aito-logo-restored.png" alt="" /><span>AITO<span>SOFTWARES</span></span></router-link><div class="user-app__session"><NotificationBell /><div class="user-app__identity"><strong>{{ firstName }}</strong><small>{{ sessionUser.email }}</small></div><q-btn flat round icon="mdi-logout" aria-label="Sair" @click="logout"><q-tooltip>Sair</q-tooltip></q-btn></div></header>
      <nav class="user-app__nav" aria-label="Área do usuário">
        <button v-for="item in menu" :key="item.id" type="button" :class="{ 'is-active': activeMenu === item.id }" :aria-current="activeMenu === item.id ? 'page' : undefined" @click="showTab(item.id)"><q-icon :name="item.icon" /> {{ item.label }}</button>
        <router-link class="user-app__ai-link" :to="{ name: 'aito-ia' }"><q-icon name="mdi-creation" /> AitoIA <q-icon name="mdi-arrow-top-right" aria-hidden="true" /></router-link>
        <router-link class="user-app__ai-link" :to="{ name: 'aito-ia-video-studio' }"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo <q-icon name="mdi-arrow-top-right" aria-hidden="true" /></router-link>
      </nav>

      <main v-if="activeMenu === 'courses'" class="user-app__main user-app__wide"><UserCoursesPanel /></main>
      <main v-else-if="activeMenu === 'certificates'" class="user-app__main user-app__wide"><UserCertificatesPanel /></main>
      <main v-else-if="activeMenu === 'products'" class="user-app__main user-app__wide">
        <UserProductsPanel />
      </main>
      <main v-else-if="activeMenu === 'webhooks'" class="user-app__main user-app__wide"><UserWebhooksPanel /></main>
      <main v-else-if="activeMenu === 'wpp-colab'" class="user-app__main user-app__wide"><UserWhatsappCollaboratorsPanel /></main>
      <main v-else-if="activeMenu === 'profile'" class="user-app__main user-app__profile">
        <span class="user-app__eyebrow">Meu perfil</span><h1>Seu acesso, do seu jeito.</h1>
        <q-form class="user-app__profile-form" @submit.prevent="saveProfile"><q-input v-model="profile.name" outlined label="Nome" /><q-input v-model="profile.email" outlined label="E-mail" readonly /><q-input v-model="profile.phone" outlined label="Telefone com DDI e DDD" /><q-btn unelevated no-caps type="submit" label="Salvar perfil" icon="mdi-content-save" :loading="saving" /></q-form>
        <UserCodexKey />
      </main>
      <main v-else-if="activeMenu === 'finance'" class="user-app__main user-app__wide"><UserFinancePanel /></main>
      <main v-else-if="activeMenu === 'aito-tokens'" class="user-app__main user-app__wide"><UserAitoTokensPanel /></main>
      <main v-else class="user-app__main user-app__wide"><SupportTicketsPanel id="customer-support" tabindex="-1" aria-label="Chamados de suporte" /></main>
      <router-link to="/" class="user-app__assistant" aria-label="Abrir AitoIA com modelos OpenAI">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcset="/icons/aitoia-192.png" />
          <img src="/ia.gif" alt="" width="40" height="40" />
        </picture>
        <span class="user-app__assistant-label"><strong>AitoIA</strong><span><img src="/chatgpt-mark.svg" alt="" width="13" height="13" /> Modelos OpenAI</span></span>
      </router-link>
      <AitoCodexThemeShortcut class="user-app__theme" />
    </div></q-page></q-page-container>
    <q-dialog v-model="phoneRequired" persistent>
      <q-card class="user-app__phone-dialog">
        <q-form @submit.prevent="savePhone">
          <q-card-section><h2>Cadastre seu telefone</h2><p>Informe seu número com DDI e DDD para completar o perfil.</p>
            <q-input v-model="phoneDraft" outlined label="Telefone com DDI e DDD" type="tel" autocomplete="tel"
              autofocus :disable="saving" :error="Boolean(phoneError)" :error-message="phoneError" /></q-card-section>
          <q-card-actions align="right"><q-btn unelevated color="teal-8" no-caps type="submit"
            label="Salvar telefone" :loading="saving" :disable="!phoneDraft.trim()" /></q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { api } from 'boot/axios'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import SupportTicketsPanel from 'components/SupportTicketsPanel.vue'
import UserCoursesPanel from 'components/UserCoursesPanel.vue'
import UserCertificatesPanel from 'components/UserCertificatesPanel.vue'
import UserProductsPanel from 'components/UserProductsPanel.vue'
import NotificationBell from 'components/NotificationBell.vue'
import AitoCodexThemeShortcut from 'components/AitoCodexThemeShortcut.vue'

const UserWebhooksPanel = defineAsyncComponent(() => import('components/UserWebhooksPanel.vue'))
const UserWhatsappCollaboratorsPanel = defineAsyncComponent(() => import('components/UserWhatsappCollaboratorsPanel.vue'))
const UserFinancePanel = defineAsyncComponent(() => import('components/UserFinancePanel.vue'))
const UserAitoTokensPanel = defineAsyncComponent(() => import('components/UserAitoTokensPanel.vue'))
const UserCodexKey = defineAsyncComponent(() => import('components/UserCodexKey.vue'))
const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const sessionUser = ref({})
const sessionToken = localStorage.getItem('aito_user_token')
const saving = ref(false)
const phoneRequired = ref(false)
const phoneDraft = ref('')
const phoneError = ref('')
const hasPhone = value => /^[1-9]\d{9,14}$/.test(String(value || '').replace(/[+().\s-]/g, ''))
function acceptProfile(user) {
  sessionUser.value = user
  Object.assign(profile, user, { phone: hasPhone(user.phone) ? user.phone : '' })
  localStorage.setItem('aito_user', JSON.stringify(user))
  phoneRequired.value = !hasPhone(user.phone)
}
async function savePhone() {
  saving.value = true
  phoneError.value = ''
  try {
    const { data } = await api.patch('/products/aitonotify/profile', { phone: phoneDraft.value },
      { headers: { Authorization: 'Bearer ' + localStorage.getItem('aito_user_token') } })
    acceptProfile(data.data)
  } catch (error) {
    phoneError.value = error.response?.data?.message || 'Não foi possível salvar o telefone.'
  } finally { saving.value = false }
}
const profile = reactive({ name: '', email: '', phone: '' })
const menu = [
  { id: 'products', label: 'Meus produtos', icon: 'mdi-shield-key-outline' },
  { id: 'finance', label: 'Financeiro', icon: 'mdi-receipt-text-clock-outline' },
  { id: 'aito-tokens', label: 'AitoTokens', icon: 'mdi-circle-multiple-outline' },
  { id: 'webhooks', label: 'Webhooks', icon: 'mdi-webhook' },
  { id: 'wpp-colab', label: 'WhatsApp da equipe', icon: 'mdi-whatsapp' },
  { id: 'tickets', label: 'Suporte', icon: 'mdi-lifebuoy' },
  { id: 'profile', label: 'Meus dados', icon: 'mdi-account-outline' },
]
const activeMenu = computed(() => menu.find(item => item.id === route.query.tab)?.id || 'products')
const showTab = tab => router.push({ query: { ...route.query, tab } })
const firstName = computed(() => String(sessionUser.value.name || 'Usuario Aito').trim().split(/\s+/)[0])
function refreshChangedAccount (event) {
  if (event.type === 'storage' && event.key !== null && event.key !== 'aito_user_token') return
  if (localStorage.getItem('aito_user_token') !== sessionToken) window.location.reload()
}
onMounted(() => {
  window.addEventListener('storage', refreshChangedAccount)
  window.addEventListener('aito:session-expired', refreshChangedAccount)
})
onBeforeUnmount(() => {
  window.removeEventListener('storage', refreshChangedAccount)
  window.removeEventListener('aito:session-expired', refreshChangedAccount)
})
onMounted(async () => { if(sessionStorage.getItem('aito.productClaim')){router.replace('/produto/acesso');return} try { const response=await api.get('/products/aitonotify/profile',{headers:{Authorization:'Bearer '+localStorage.getItem('aito_user_token')}});acceptProfile(response.data.data) } catch (error) { sessionUser.value = {} } })
async function saveProfile () { saving.value = true; try { const response=await api.patch('/products/aitonotify/profile',{name:profile.name.trim(),phone:profile.phone},{headers:{Authorization:'Bearer '+localStorage.getItem('aito_user_token')}});acceptProfile(response.data.data);$q.notify({type:'positive',message:'Perfil salvo.'}) }catch(error){$q.notify({type:'negative',message:error.response?.data?.message || 'Não foi possível salvar.'})}finally{saving.value=false} }

async function logout () { try { await api.post('/auth/logout',{}, {headers:{Authorization:'Bearer '+localStorage.getItem('aito_user_token')},withCredentials:true}); localStorage.removeItem('aito_user_token'); localStorage.removeItem('aito_user'); router.push('/sobre') } catch { $q.notify({type:'negative',message:'Não foi possível encerrar o acesso neste dispositivo. Tente novamente.'}) } }
</script>

<style scoped>
.user-app__phone-dialog { width: min(440px, 94vw); background: #f3faf6; color: #173e32; border-radius: 18px; }
.user-app__phone-dialog h2 { font-size: 1.4rem; margin: 0; }
.user-app { color: #effffb; background: #03090b; }
.user-app__page { min-height: 100vh; padding-bottom: calc(7.5rem + env(safe-area-inset-bottom)); background: radial-gradient(circle at 70% 18%, rgba(19,188,157,.16), transparent 25rem), #03090b; }
.user-app__shell { width: min(1180px, calc(100% - 2rem)); margin: 0 auto; }
.user-app__header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 0; border-bottom: 1px solid rgba(19,188,157,.18); }
.user-app__session { display: flex; align-items: center; gap: .8rem; }.user-app__session>.user-app__identity { display: grid; gap: .12rem; text-align: right; }.user-app__session strong { color: #effffb; font-size: .78rem; }.user-app__session small { color: rgba(230,255,250,.58); font-size: .64rem; }
.user-app__brand { display: flex; align-items: center; gap: .65rem; color: #effffb; font-size: .78rem; font-weight: 800; letter-spacing: .12em; text-decoration: none; }.user-app__brand img { width: 34px; height: 34px; }.user-app__brand span span { color: #13bc9d; }
.user-app__nav { display: flex; flex-wrap: wrap; gap: .4rem; padding: 1.1rem 0; border-bottom: 1px solid rgba(19,188,157,.14); }.user-app__nav button { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .75rem; border: 1px solid rgba(19,188,157,.25); border-radius: .5rem; color: rgba(239,255,251,.7); background: rgba(3,25,26,.5); cursor: pointer; font: inherit; font-size: .72rem; }.user-app__nav button.is-active { color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); }
.user-app__ai-link { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .75rem; border: 1px solid #e5c17266; border-radius: .5rem; color: #ffe3a6; background: #bd84341a; font-size: .72rem; font-weight: 700; text-decoration: none; }
.user-app__ai-link:hover { background: #bd843435; }
.user-app__ai-link:focus-visible { outline: 2px solid #ffe3a6; outline-offset: 2px; }
.user-app__assistant { position: fixed; z-index: 20; inset-inline-end: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); display: flex; align-items: center; gap: .6rem; min-height: 3.3rem; padding: .35rem .8rem .35rem .5rem; border: 1px solid #73d9c0; border-radius: 999px; background: #0c2729; color: #f2fffa; box-shadow: 0 .35rem 1rem #0009; text-decoration: none; }
.user-app__assistant:hover { background: #143c3c; }
.user-app__theme { --aito-theme-shortcut-offset: 3.85rem; }
.user-app__assistant:focus-visible { outline: 2px solid #a4fce4; outline-offset: 3px; }
.user-app__assistant picture { display: grid; place-items: center; width: 40px; height: 40px; }
.user-app__assistant picture img { object-fit: contain; }
.user-app__assistant-label { display: grid; gap: .125rem; }
.user-app__assistant-label strong { font-size: .94rem; line-height: 1.15; }
.user-app__assistant-label span { display: flex; align-items: center; gap: .3rem; color: #c6e6df; font-size: .69rem; white-space: nowrap; }
.user-app__main { padding: 10vh 0; }.user-app__wide { padding-top: 4rem; }.user-app__eyebrow { color: #8fffee; font-size: .7rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }.user-app h1 { max-width: 12ch; margin: .8rem 0 0; font-size: clamp(2.4rem,6vw,5rem); line-height: .98; background: linear-gradient(135deg,#f3fffd,#13bc9d,#8fffee); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }.user-app p { max-width: 32rem; color: rgba(230,255,250,.72); line-height: 1.6; }.user-app__grid { display: grid; margin-top: 3rem; grid-template-columns: repeat(3,1fr); gap: .8rem; }.user-app__grid section { display: grid; gap: .5rem; padding: 1.2rem; border: 1px solid rgba(19,188,157,.25); border-radius: .8rem; background: rgba(4,24,25,.72); }.user-app__grid strong { color: #effffb; }.user-app__grid span { color: rgba(230,255,250,.58); font-size: .75rem; }.user-app__grid .q-icon { color: #13bc9d; }.user-app__grid .q-btn,.user-app__profile-form .q-btn { width: max-content; color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); font-weight: 800; }.user-app__profile-form { display: grid; max-width: 520px; gap: .8rem; margin-top: 2rem; }.user-app__profile-form :deep(.q-field__control) { color: #effffb; background: rgba(4,24,25,.78); }.user-app__profile-form :deep(.q-field__native),.user-app__profile-form :deep(.q-field__label) { color: rgba(239,255,251,.78); }
@media (max-width: 700px) { .user-app__grid { grid-template-columns: 1fr; } .user-app__session>.user-app__identity { display: none; } }
</style>
