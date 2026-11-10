<template>
  <div class="notification-bell">
    <q-btn flat round icon="mdi-bell-outline" aria-label="Abrir notificações" :aria-expanded="menuOpen" @click="open">
      <q-badge v-if="unread" floating rounded color="teal-3" text-color="dark" :label="unread > 9 ? '9+' : unread" />
      <q-tooltip v-if="!menuOpen">Notificações</q-tooltip>
    <q-menu v-model="menuOpen" no-parent-event anchor="bottom right" self="top right" class="notification-bell__menu">
      <div class="notification-bell__head"><strong>Notificações</strong><q-btn v-if="unread" flat dense no-caps label="Marcar lidas" :loading="marking" @click="markAllRead" /></div>
      <div v-if="loading && !notifications.length" class="notification-bell__empty"><q-spinner color="teal-3" /></div>
      <div v-else-if="!notifications.length" class="notification-bell__empty"><q-icon name="mdi-bell-sleep-outline" size="28px" /><span>Nenhuma novidade por aqui.</span></div>
      <button v-for="notification in notifications" :key="notification._id" type="button" class="notification-bell__item is-unread" :disabled="marking" @click="openNotification(notification)"><q-icon :name="notification.type === 'course-new' ? 'mdi-school-outline' : 'mdi-information-outline'" /><span><strong>{{ notification.title }}</strong><small>{{ notification.message }}</small><em>{{ formatDate(notification.createdAt) }}</em></span></button>
    </q-menu>
    </q-btn>
    <q-dialog v-model="detailOpen"><q-card class="notification-detail"><q-card-section class="notification-detail__head"><h2>{{selected?.title}}</h2><q-btn flat round dense icon="mdi-close" aria-label="Fechar notificação" v-close-popup/></q-card-section><q-card-section class="notification-detail__message">{{selected?.message}}</q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Fechar" v-close-popup/><q-btn v-if="safeTarget(selected)" unelevated color="teal-7" no-caps label="Abrir link" icon="mdi-arrow-top-right" @click="navigate(selected)"/></q-card-actions></q-card></q-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'

const selected=ref(null),detailOpen=ref(false)
const router = useRouter()
const menuOpen = ref(false)
const notifications = ref([])
const unread = computed(() => notifications.value.length)
const loading = ref(false)
const marking = ref(false)
let pollTimer
let requestVersion = 0
let sessionToken = ''
const accessToken = () => localStorage.getItem('aito_user_token') || ''
const headers = (token = accessToken()) => ({ headers: { Authorization: `Bearer ${token}` } })
function formatDate (value) { return value ? new Date(value).toLocaleDateString('pt-BR') : '-' }
async function load () {
  const token = accessToken()
  if (token !== sessionToken) {
    sessionToken = token
    removeRead()
    selected.value = null
    detailOpen.value = false
    menuOpen.value = false
  }
  if (!token) return
  const version = ++requestVersion
  loading.value = true
  try {
    const { data } = await api.get('/notifications', { ...headers(token), params: { unread: true } })
    if (version === requestVersion && token === accessToken()) {
      notifications.value = (data.data || []).filter((item) => !item.read)
    }
  } catch { /* Keep the most recent successful list when polling fails. */ }
  finally { if (version === requestVersion) loading.value = false }
}
function removeRead (id) {
  // Discard a poll that started before the read was saved.
  requestVersion += 1
  loading.value = false
  notifications.value = id ? notifications.value.filter((item) => item._id !== id) : []
}
function safeTarget(notification) { const value=notification?.actionUrl || (notification?.relatedSlug ? `/cursos/${encodeURIComponent(notification.relatedSlug)}` : ''); if(!value)return ''; try { const url=new URL(value,window.location.origin); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url : '' } catch { return '' } }
function navigate(notification) { const url=safeTarget(notification); if(!url)return; detailOpen.value=false; if(url.origin===window.location.origin)router.push(url.pathname+url.search+url.hash); else window.open(url.href,'_blank','noopener,noreferrer') }
async function openNotification (notification) {
  const token = accessToken()
  if (marking.value || !token || token !== sessionToken) return
  marking.value = true
  try {
    await api.patch(`/notifications/${notification._id}/read`, {}, headers(token))
    if (token !== accessToken()) return
    removeRead(notification._id)
  } catch (error) {
    if (token !== accessToken()) return
    if (error.response?.status === 404) {
      removeRead(notification._id)
      return
    }
  } finally { marking.value = false }
  selected.value = notification
  menuOpen.value = false
  detailOpen.value = true
}
async function markAllRead () {
  const token = accessToken()
  if (marking.value || !token || token !== sessionToken) return
  marking.value = true
  try {
    await api.patch('/notifications/read', {}, headers(token))
    if (token === accessToken()) removeRead()
  } catch { /* Leave unread notices available for retry. */ }
  finally { marking.value = false }
}
function open () { menuOpen.value = !menuOpen.value; if(menuOpen.value)load() }
onMounted(() => {
  load()
  pollTimer = window.setInterval(load, 60000)
  window.addEventListener('aito:notification-read', load)
})
onBeforeUnmount(() => {
  requestVersion += 1
  window.clearInterval(pollTimer)
  window.removeEventListener('aito:notification-read', load)
})
</script>

<style>
.notification-bell{position:relative}.notification-bell .q-btn{color:#8fffee}.notification-bell__menu{max-height:min(65vh,560px);overflow-y:auto;width:min(380px,calc(100vw - 2rem));padding:.45rem;color:#effffb;background:#061819;border:1px solid rgba(19,188,157,.3)}.notification-bell__head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem .6rem;border-bottom:1px solid rgba(19,188,157,.15)}.notification-bell__head strong{font-size:.8rem}.notification-bell__head .q-btn{color:#8fffee;font-size:.68rem}.notification-bell__item{display:flex;width:100%;gap:.6rem;padding:.7rem .6rem;border:0;border-bottom:1px solid rgba(19,188,157,.1);color:rgba(239,255,251,.62);background:transparent;text-align:left;cursor:pointer;font:inherit}.notification-bell__item.is-unread{color:#effffb;background:rgba(19,188,157,.08)}.notification-bell__item>.q-icon{flex:none;color:#50dcc4}.notification-bell__item span{display:grid;gap:.2rem}.notification-bell__item strong{font-size:.72rem}.notification-bell__item small{font-size:.67rem;line-height:1.4}.notification-bell__item em{color:rgba(239,255,251,.4);font-size:.6rem;font-style:normal}.notification-bell__empty{display:grid;justify-items:center;gap:.4rem;padding:1.5rem;color:rgba(239,255,251,.55);font-size:.7rem;text-align:center}
.notification-detail{width:560px;max-width:calc(100vw - 24px);background:#071e1f;color:#edfff8;border:1px solid #3b7560;border-radius:15px;max-height:85dvh;overflow-y:auto}.notification-detail__head{display:flex;align-items:flex-start;gap:15px}.notification-detail__head h2{flex:1;font-size:21px;line-height:1.5;margin:0}.notification-detail__message{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.9;color:#c2dbcd}
</style>

<style>
.notification-bell__menu{background:#08282b!important;color:#f2fffb!important;border:1px solid #528b80!important;border-radius:16px!important;box-shadow:0 18px 55px #0009!important;text-transform:none;letter-spacing:normal;width:min(410px,calc(100vw - 24px));max-width:calc(100vw - 24px);padding:8px}
.notification-bell__head{padding:12px 10px}.notification-bell__head strong{font-size:16px;color:#fff;font-weight:750}.notification-bell__head .q-btn{font-size:12px;color:#a2ffe5!important}
.notification-bell__item{gap:12px;padding:15px 12px;border-radius:10px;min-height:75px;color:#d5eae5!important;text-transform:none;letter-spacing:normal}.notification-bell__item.is-unread{background:#17483f;color:#fff!important;border-left:3px solid #8effdb}.notification-bell__item:hover{background:#21534b}.notification-bell__item>.q-icon{font-size:23px;color:#9fffe3;margin-top:2px}.notification-bell__item span{min-width:0;gap:5px}.notification-bell__item strong{font-size:14px;line-height:1.45;color:#fff;font-weight:700;overflow-wrap:anywhere}.notification-bell__item small{font-size:13px;line-height:1.65;color:#dcf2eb;white-space:pre-wrap;overflow-wrap:anywhere}.notification-bell__item em{font-size:11px;color:#b1cfc6}.notification-bell__empty{font-size:13px;color:#d1e8df}.notification-detail__message{font-size:15px;color:#e0f4eb}.notification-detail__head h2{color:#fff}
.notification-bell__item:focus-visible{outline:2px solid #a4ffe4;outline-offset:-3px}
</style>
