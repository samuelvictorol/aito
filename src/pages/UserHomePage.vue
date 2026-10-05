<template>
  <q-layout view="lHh Lpr lFf" class="user-app">
    <q-page-container><q-page class="user-app__page"><div class="user-app__shell">
      <header class="user-app__header"><router-link class="user-app__brand" to="/"><img src="/favicon.png" alt="" /><span>AITO<span>SOFTWARES</span></span></router-link><div class="user-app__session"><NotificationBell /><div><strong>{{ firstName }}</strong><small>{{ sessionUser.email }}</small></div><q-btn flat round icon="mdi-logout" aria-label="Sair" @click="logout"><q-tooltip>Sair</q-tooltip></q-btn></div></header>
      <nav class="user-app__nav" aria-label="Area do usuario"><button v-for="item in menu" :key="item.id" type="button" :class="{ 'is-active': activeMenu === item.id }" @click="activeMenu = item.id"><q-icon :name="item.icon" /> {{ item.label }}</button></nav>

      <main v-if="activeMenu === 'courses'" class="user-app__main user-app__wide"><UserCoursesPanel /></main>
      <main v-else-if="activeMenu === 'certificates'" class="user-app__main user-app__wide"><UserCertificatesPanel /></main>
      <main v-else-if="activeMenu === 'products'" class="user-app__main user-app__wide"><UserProductsPanel /></main>
      <main v-else-if="activeMenu === 'profile'" class="user-app__main user-app__profile"><span class="user-app__eyebrow">Meu perfil</span><h1>Seu acesso, do seu jeito.</h1><q-form class="user-app__profile-form" @submit.prevent="saveProfile"><q-input v-model="profile.name" outlined label="Nome" /><q-input v-model="profile.email" outlined label="E-mail" readonly /><q-input v-model="profile.phone" outlined label="Telefone" readonly /><q-btn unelevated no-caps type="submit" label="Salvar nome" icon="mdi-content-save" :loading="saving" /></q-form></main>
      <main v-else-if="activeMenu === 'finance'" class="user-app__main user-app__wide"><FinanceDashboard title="Meu financeiro" /></main>
      <main v-else class="user-app__main user-app__wide"><SupportTicketsPanel /></main>
    </div></q-page></q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import FinanceDashboard from 'components/FinanceDashboard.vue'
import SupportTicketsPanel from 'components/SupportTicketsPanel.vue'
import UserCoursesPanel from 'components/UserCoursesPanel.vue'
import UserCertificatesPanel from 'components/UserCertificatesPanel.vue'
import UserProductsPanel from 'components/UserProductsPanel.vue'
import NotificationBell from 'components/NotificationBell.vue'

const router = useRouter(); const $q = useQuasar(); const sessionUser = ref({}); const activeMenu = ref(new URLSearchParams(window.location.search).get('tab') === 'products' ? 'products' : 'courses'); const saving = ref(false); const profile = reactive({ name: '', email: '', phone: '' })
const menu = [{ id: 'courses', label: 'Meus cursos', icon: 'mdi-school-outline' }, { id: 'products', label: 'Meus produtos', icon: 'mdi-package-variant-closed' }, { id: 'certificates', label: 'Certificados', icon: 'mdi-certificate-outline' }, { id: 'profile', label: 'Meu perfil', icon: 'mdi-account-outline' }, { id: 'finance', label: 'Financeiro', icon: 'mdi-cash-multiple' }, { id: 'tickets', label: 'Meus chamados', icon: 'mdi-lifebuoy' }]
const firstName = computed(() => String(sessionUser.value.name || 'Usuario Aito').trim().split(/\s+/)[0])
onMounted(() => { try { sessionUser.value = JSON.parse(localStorage.getItem('aito_user') || '{}'); Object.assign(profile, sessionUser.value) } catch (error) { sessionUser.value = {} } })
function saveProfile () { saving.value = true; const next = { ...sessionUser.value, name: profile.name.trim() }; localStorage.setItem('aito_user', JSON.stringify(next)); sessionUser.value = next; saving.value = false; $q.notify({ type: 'positive', message: 'Perfil atualizado.' }) }
function logout () { localStorage.removeItem('aito_user_token'); localStorage.removeItem('aito_user'); router.push('/') }
</script>

<style scoped>
.user-app { color: #effffb; background: #03090b; }
.user-app__page { min-height: 100vh; background: radial-gradient(circle at 70% 18%, rgba(19,188,157,.16), transparent 25rem), #03090b; }
.user-app__shell { width: min(1180px, calc(100% - 2rem)); margin: 0 auto; }
.user-app__header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 0; border-bottom: 1px solid rgba(19,188,157,.18); }
.user-app__session { display: flex; align-items: center; gap: .8rem; }.user-app__session>div { display: grid; gap: .12rem; text-align: right; }.user-app__session strong { color: #effffb; font-size: .78rem; }.user-app__session small { color: rgba(230,255,250,.58); font-size: .64rem; }
.user-app__brand { display: flex; align-items: center; gap: .65rem; color: #effffb; font-size: .78rem; font-weight: 800; letter-spacing: .12em; text-decoration: none; }.user-app__brand img { width: 34px; height: 34px; }.user-app__brand span span { color: #13bc9d; }
.user-app__nav { display: flex; flex-wrap: wrap; gap: .4rem; padding: 1.1rem 0; border-bottom: 1px solid rgba(19,188,157,.14); }.user-app__nav button { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .75rem; border: 1px solid rgba(19,188,157,.25); border-radius: .5rem; color: rgba(239,255,251,.7); background: rgba(3,25,26,.5); cursor: pointer; font: inherit; font-size: .72rem; }.user-app__nav button.is-active { color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); }
.user-app__main { padding: 10vh 0; }.user-app__wide { padding-top: 4rem; }.user-app__eyebrow { color: #8fffee; font-size: .7rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }.user-app h1 { max-width: 12ch; margin: .8rem 0 0; font-size: clamp(2.4rem,6vw,5rem); line-height: .98; background: linear-gradient(135deg,#f3fffd,#13bc9d,#8fffee); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }.user-app p { max-width: 32rem; color: rgba(230,255,250,.72); line-height: 1.6; }.user-app__grid { display: grid; margin-top: 3rem; grid-template-columns: repeat(3,1fr); gap: .8rem; }.user-app__grid section { display: grid; gap: .5rem; padding: 1.2rem; border: 1px solid rgba(19,188,157,.25); border-radius: .8rem; background: rgba(4,24,25,.72); }.user-app__grid strong { color: #effffb; }.user-app__grid span { color: rgba(230,255,250,.58); font-size: .75rem; }.user-app__grid .q-icon { color: #13bc9d; }.user-app__grid .q-btn,.user-app__profile-form .q-btn { width: max-content; color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); font-weight: 800; }.user-app__profile-form { display: grid; max-width: 520px; gap: .8rem; margin-top: 2rem; }.user-app__profile-form :deep(.q-field__control) { color: #effffb; background: rgba(4,24,25,.78); }.user-app__profile-form :deep(.q-field__native),.user-app__profile-form :deep(.q-field__label) { color: rgba(239,255,251,.78); }
@media (max-width: 700px) { .user-app__grid { grid-template-columns: 1fr; } .user-app__session>div { display: none; } }
</style>
