<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import AuthDialog from '../components/AuthDialog.vue'
const router=useRouter(), login=ref(false), busy=ref(false), message=ref('Entre na sua conta para vincular a compra recebida no WhatsApp.')
async function claim(){
  if(!localStorage.getItem('aito_user_token')){login.value=true;return}
  busy.value=true
  try{const accessToken=sessionStorage.getItem('aito.productClaim');if(!accessToken)throw Error('Abra o link enviado no WhatsApp após a compra.');await api.post('/products/aitonotify/claim',{accessToken},{headers:{Authorization:'Bearer '+localStorage.getItem('aito_user_token')}});sessionStorage.removeItem('aito.productClaim');router.replace('/app?tab=products')}
  catch(error){message.value=error.response?.data?.message || error.message}
  finally{busy.value=false}
}
onMounted(()=>{const token=new URLSearchParams(location.hash.slice(1)).get('token');if(token && /^[A-Za-z0-9_-]{43}$/.test(token)){sessionStorage.setItem('aito.productClaim',token);history.replaceState(null,'','/produto/acesso')}claim()})
</script>
<template><q-layout><q-page-container><q-page class="claim-page"><q-card flat bordered><q-card-section><q-icon name="mdi-shield-check-outline" size="48px" color="teal"/><h1>Sua compra, na sua conta.</h1><p>{{message}}</p><q-btn unelevated no-caps color="teal" label="Entrar e vincular meu produto" :loading="busy" @click="claim"/><q-btn flat no-caps label="Voltar ao site" to="/whatsapp-solucoes"/></q-card-section></q-card><AuthDialog v-model="login" audience="user" @authenticated="claim"/></q-page></q-page-container></q-layout></template>
<style scoped>.claim-page{display:grid;place-items:center;padding:24px;background:#eaf7f1}.claim-page>.q-card{width:600px;max-width:100%;border-radius:24px;padding:28px}h1{font-size:28px;line-height:1.3}p{line-height:1.7}</style>
