<template>
  <q-layout view="lHh Lpr lFf" class="google-callback">
    <q-page-container>
      <q-page class="google-callback__page flex flex-center">
        <div class="google-callback__panel" role="status" aria-live="polite">
          <q-spinner-gears color="secondary" size="42px" />
          <strong>Concluindo seu acesso</strong>
          <span>{{ message }}</span>
        </div>
      </q-page>
    </q-page-container>
    <LoginMfaDialog v-model="mfaOpen" :challenge="mfaChallenge" @verified="finish" />
  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import LoginMfaDialog from 'components/LoginMfaDialog.vue'
const $q=useQuasar(),router=useRouter(),message=ref('Validando sua conta Google…'),mfaOpen=ref(false),mfaChallenge=ref(null)
function goHomeWithError(text){sessionStorage.removeItem('aito_auth_return_path');$q.notify({type:'negative',message:text});router.replace('/')}
function finish(data){const user=data.user,role=user.role==='customer'?'customer':'user';for(const key of ['aito_admin_token','aito_admin_user','aito_user_token','aito_user','aito_affiliate_token','aito_affiliate_user','aito_seller_token','aito_seller_user'])localStorage.removeItem(key);localStorage.setItem('aito_user_token',data.token);localStorage.setItem('aito_user',JSON.stringify({...user,role}));const target=sessionStorage.getItem('aito_auth_return_path');sessionStorage.removeItem('aito_auth_return_path');message.value='Acesso confirmado. Redirecionando…';router.replace(target&&target.startsWith('/')&&!target.startsWith('//')?target:role==='customer'?'/customer':'/app')}
onMounted(async()=>{const params=new URLSearchParams(window.location.hash.replace(/^#/,''));window.history.replaceState({},document.title,'/auth/google/callback');if(params.get('error'))return goHomeWithError(params.get('error'));try{if(params.get('mfa')){const challenge=JSON.parse(params.get('mfa'));if(!challenge.requiresMfa||!challenge.challengeId)throw Error();mfaChallenge.value=challenge;mfaOpen.value=true;message.value='Confirme o código enviado por e-mail. Confira também o lixo eletrônico.';return}if(params.get('session')==='1'){finish((await api.post('/auth/session')).data);return}throw Error()}catch{goHomeWithError('Não foi possível concluir seu acesso. Entre novamente.')}})
</script>

<style scoped>
.google-callback__page {
  min-height: 100vh;
  color: #effffb;
  background: radial-gradient(circle at 50% 20%, rgba(19, 188, 157, 0.18), transparent 25rem), #03090b;
}

.google-callback__panel {
  display: grid;
  width: min(90vw, 24rem);
  padding: 2rem;
  justify-items: center;
  gap: 0.8rem;
  border: 1px solid rgba(19, 188, 157, 0.3);
  border-radius: 1rem;
  background: rgba(4, 24, 25, 0.78);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
  text-align: center;
}

.google-callback__panel strong { font-size: 1.05rem; }
.google-callback__panel span { color: rgba(230, 255, 250, 0.68); font-size: 0.8rem; }
</style>
