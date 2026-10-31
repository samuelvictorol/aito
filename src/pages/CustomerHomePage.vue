<template>
  <q-layout view="lHh Lpr lFf" class="customer-app">
    <q-page-container><q-page class="customer-app__page"><div class="customer-app__shell">
      <header class="customer-app__header"><router-link class="customer-app__brand" to="/"><img src="/aito-logo-restored.png" alt="" /><span>AITO<span>SOFTWARES</span></span></router-link><div class="customer-app__session"><strong>{{ firstName }}</strong><q-btn flat round icon="mdi-logout" aria-label="Sair" @click="logout"><q-tooltip>Sair</q-tooltip></q-btn></div></header>
      <nav class="customer-app__nav" aria-label="Area do cliente"><button v-for="item in menu" :key="item.id" type="button" :class="{ 'is-active': activeMenu === item.id }" @click="activeMenu = item.id"><q-icon :name="item.icon" /> {{ item.label }}</button></nav>

      <main v-if="activeMenu === 'projects'" class="customer-app__main customer-app__wide"><ProjectManager /></main>
      <main v-else-if="activeMenu === 'finance'" class="customer-app__main customer-app__wide"><FinanceDashboard /></main>
      <main v-else-if="activeMenu === 'tickets'" class="customer-app__main customer-app__wide"><SupportTicketsPanel /></main>
      <main v-else-if="activeMenu === 'contracts'" class="customer-app__main customer-app__wide"><ContractManager /></main>
      <main v-else-if="activeMenu === 'credentials'" class="customer-app__main customer-app__wide"><CredentialManager /></main>
      <main v-else-if="activeMenu === 'invoices'" class="customer-app__main customer-app__wide"><InvoiceManager /></main>
      <main v-else class="customer-app__main customer-app__profile"><p class="customer-app__eyebrow">Meu perfil</p><q-form class="customer-app__profile-form" @submit.prevent="saveProfile"><q-input v-model="profile.name" outlined label="Nome" /><q-input v-model="profile.email" outlined label="E-mail" readonly /><q-input v-model="profile.phone" outlined label="Telefone" readonly /><q-btn unelevated no-caps type="submit" label="Salvar nome" icon="mdi-content-save" :loading="saving" /></q-form></main>
    </div></q-page></q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import FinanceDashboard from 'components/FinanceDashboard.vue'
import SupportTicketsPanel from 'components/SupportTicketsPanel.vue'
import ContractManager from 'components/ContractManager.vue'
import CredentialManager from 'components/CredentialManager.vue'
import ProjectManager from 'components/ProjectManager.vue'
import InvoiceManager from 'components/InvoiceManager.vue'

const router = useRouter(); const $q = useQuasar(); const sessionUser = ref({}); const activeMenu = ref('projects'); const saving = ref(false); const profile = reactive({ name: '', email: '', phone: '' })
const menu = [{ id: 'projects', label: 'Projetos', icon: 'mdi-folder-star-outline' }, { id: 'finance', label: 'Financeiro', icon: 'mdi-cash-multiple' }, { id: 'tickets', label: 'Suporte', icon: 'mdi-help' }, { id: 'contracts', label: 'Contratos', icon: 'mdi-file-document-outline' }, { id: 'invoices', label: 'Notas fiscais', icon: 'mdi-receipt-text-outline' }, { id: 'credentials', label: 'Credenciais', icon: 'mdi-key-chain-variant' }, { id: 'profile', label: 'Meu perfil', icon: 'mdi-account-outline' }]
const firstName = computed(() => String(sessionUser.value.name || 'Cliente Aito').trim().split(/\s+/)[0])
onMounted(() => { try { sessionUser.value = JSON.parse(localStorage.getItem('aito_user') || '{}'); Object.assign(profile, sessionUser.value) } catch (error) { sessionUser.value = {} } })
function saveProfile () { saving.value = true; const next = { ...sessionUser.value, name: profile.name.trim() }; localStorage.setItem('aito_user', JSON.stringify(next)); sessionUser.value = next; saving.value = false; $q.notify({ type: 'positive', message: 'Perfil atualizado.' }) }
async function logout () { try { await api.post('/auth/logout',{}, {headers:{Authorization:'Bearer '+localStorage.getItem('aito_user_token')}}) } catch { $q.notify({type:'negative',message:'Não foi possível encerrar a sessão. Tente novamente.'}); return } localStorage.removeItem('aito_user_token'); localStorage.removeItem('aito_user'); router.push('/customer/login') }
</script>

<style scoped>
.customer-app { color: #effffb; background: #03090b; }.customer-app__page { min-height: 100vh; background: radial-gradient(circle at 70% 15%, rgba(19,188,157,.12), transparent 27rem), linear-gradient(rgba(19,188,157,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(19,188,157,.045) 1px, transparent 1px), #03090b; background-size: auto, 72px 72px, 72px 72px, auto; }.customer-app__shell { width: min(1220px, calc(100% - 2rem)); margin: auto; }.customer-app__header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid rgba(19,188,157,.2); }.customer-app__brand { display: inline-flex; align-items: center; gap: .6rem; color: #effffb; font-size: .76rem; font-weight: 900; letter-spacing: .12em; text-decoration: none; }.customer-app__brand img { width: 34px; height: 34px; object-fit: contain; }.customer-app__brand span span { color: #13bc9d; }.customer-app__session { display: flex; align-items: center; gap: .5rem; color: #8fffee; font-size: .78rem; }.customer-app__nav { display: flex; flex-wrap: wrap; gap: .4rem; padding: 1.2rem 0; border-bottom: 1px solid rgba(19,188,157,.14); }.customer-app__nav button { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .8rem; border: 1px solid rgba(19,188,157,.25); border-radius: .55rem; color: rgba(239,255,251,.7); background: rgba(3,25,26,.5); cursor: pointer; font: inherit; font-size: .74rem; }.customer-app__nav button.is-active { color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); }.customer-app__main { padding: 9vh 0; }.customer-app__wide { padding-top: 4rem; }.customer-app__eyebrow { color: #8fffee; font-size: .7rem; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }.customer-app h1 { max-width: 12ch; margin: .7rem 0 0; font-size: clamp(2.5rem,6vw,5rem); line-height: .96; background: linear-gradient(135deg,#effffb,#13bc9d,#8fffee); background-clip: text; -webkit-background-clip: text; color: transparent; }.customer-app__main > p:not(.customer-app__eyebrow) { max-width: 34rem; color: rgba(229,255,250,.7); line-height: 1.6; }.customer-app__cards { display: grid; grid-template-columns: repeat(3,1fr); gap: .8rem; margin-top: 3rem; }.customer-app__cards section { display: grid; gap: .45rem; padding: 1.2rem; border: 1px solid rgba(19,188,157,.25); border-radius: .7rem; background: rgba(4,24,25,.7); }.customer-app__cards .q-icon { color: #13bc9d; }.customer-app__cards span { color: #8fffee; font-size: .7rem; }.customer-app__cards strong { font-size: .95rem; }.customer-app__cards small { color: rgba(229,255,250,.58); line-height: 1.5; }.customer-app__dashboard { margin-top: 3rem; }.customer-app__profile-form { display: grid; max-width: 520px; gap: .8rem; margin-top: 2rem; }.customer-app__profile-form :deep(.q-field__control) { color: #effffb; background: rgba(4,24,25,.78); }.customer-app__profile-form :deep(.q-field__native),.customer-app__profile-form :deep(.q-field__label) { color: rgba(239,255,251,.78); }.customer-app__profile-form .q-btn { width: max-content; color: #03110f; background: linear-gradient(135deg,#8fffee,#13bc9d); font-weight: 800; }
@media (max-width: 700px) { .customer-app__cards { grid-template-columns: 1fr; } }
</style>
