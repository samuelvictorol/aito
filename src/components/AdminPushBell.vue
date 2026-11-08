<script setup>
import {ref,onMounted} from 'vue'
import {useQuasar} from 'quasar'
import {api} from 'boot/axios'
import {support} from '../services/notification-lab.js'
const enabled=ref(false),busy=ref(false),publicKey=ref(''),$q=useQuasar()
const headers=()=>({headers:{Authorization:'Bearer '+localStorage.getItem('aito_admin_token')}})
onMounted(async()=>{try{publicKey.value=(await api.get('/admin/push/config',headers())).data.data.publicKey;const registration=await navigator.serviceWorker?.getRegistration('/admin');const subscription=await registration?.pushManager.getSubscription();if(subscription&&matchesKey(subscription)){await api.post('/admin/push/subscription',{subscription:subscription.toJSON()},headers());enabled.value=true}}catch{}})
function matchesKey(subscription){const bytes=subscription.options?.applicationServerKey;return !bytes||btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')===publicKey.value}
async function enable(){if(busy.value)return;busy.value=true;try{
 const state=support();if(state.installRequired)throw Error('No iPhone, abra o aplicativo adicionado à Tela de Início para ativar.');if(!state.available)throw Error('Use um navegador compatível com notificações push.');
 const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;if(permission!=='granted')throw Error('Permita notificações nos ajustes do navegador ou aplicativo.');
 if(!publicKey.value)publicKey.value=(await api.get('/admin/push/config',headers())).data.data.publicKey;
 const registration=await navigator.serviceWorker.register('/admin-notifications-sw.js',{scope:'/admin',updateViaCache:'none'});
 if(!registration.active)await new Promise((resolve,reject)=>{const worker=registration.installing||registration.waiting;if(!worker)return reject(Error('Tente ativar as notificações novamente.'));const timer=setTimeout(()=>reject(Error('Tente novamente após preparar as notificações.')),15000);const check=()=>{if(worker.state==='activated'){clearTimeout(timer);resolve()}};worker.addEventListener('statechange',check);check()});
 let subscription=await registration.pushManager.getSubscription();if(subscription&&!matchesKey(subscription)){await subscription.unsubscribe();subscription=null}if(!subscription){const key=publicKey.value.replace(/-/g,'+').replace(/_/g,'/');subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(key+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0))})}
 await api.post('/admin/push/subscription',{subscription:subscription.toJSON()},headers());enabled.value=true;$q.notify({type:'positive',message:'Este dispositivo receberá avisos de novas compras.'})
 }catch(error){$q.notify({type:'negative',message:error.response?.data?.message||error.message})}finally{busy.value=false}}
</script>
<template><q-btn flat round :icon="enabled?'mdi-bell-check-outline':'mdi-bell-ring-outline'" :loading="busy" :aria-label="enabled?'Notificações de compras habilitadas':'Habilitar notificações de compras neste dispositivo'" @click="enable"><q-tooltip>{{enabled?'Compras: dispositivo cadastrado':'Ativar avisos de compras · iPhone e Android'}}</q-tooltip><q-badge v-if="!enabled" floating color="orange" rounded>!</q-badge></q-btn></template>
