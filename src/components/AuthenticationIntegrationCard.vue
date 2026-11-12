<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
const $q=useQuasar(),loading=ref(false),saving=ref(false),status=ref({configured:false}),url=ref('https://api.aitosoftwares.com/comunicacao/api'),token=ref('')
const options=()=>({headers:{Authorization:'Bearer '+localStorage.getItem('aito_admin_token')}})
async function load(){loading.value=true;try{status.value=(await api.get('/auth/mfa/integration',options())).data;url.value=status.value.url||url.value}catch(error){$q.notify({type:'negative',message:error.response?.data?.message||'Não foi possível verificar a integração de acesso.'})}finally{loading.value=false}}
async function save(){saving.value=true;try{await api.put('/auth/mfa/integration',{url:url.value,token:token.value},options());token.value='';await load();$q.notify({type:'positive',message:'Integração de acesso atualizada.'})}catch(error){$q.notify({type:'negative',message:error.response?.data?.message||'Não foi possível salvar a integração.'})}finally{saving.value=false}}
const whatsappLabel = computed(() => ({
  ready: 'WhatsApp Web conectado',
  disconnected: 'Conecte o QR Code do WhatsApp Web',
  external: 'WhatsApp disponível pela Comunicação integrada',
  unavailable: 'WhatsApp Web indisponível',
}[status.value.whatsappState] || 'Aguardando verificação'))
onMounted(load)
</script>
<template>
  <section class="access-security">
    <header>
      <div><span class="access-security__eyebrow">SEGURANÇA DO ACESSO</span><h2>Multifator por e-mail e WhatsApp</h2><p>Administradores e contas internas elegíveis recebem o mesmo código pelos canais disponíveis. O primeiro cadastro interno confirma o endereço pelo e-mail. O acesso com Google usa a autenticação do Google.</p></div>
      <q-badge :color="status.configured ? 'positive' : 'negative'" :label="loading ? 'Verificando…' : status.configured ? 'Integração configurada' : 'Configuração necessária'" />
    </header>
    <div class="access-security__facts">
      <div><q-icon name="mdi-email-lock-outline" /><span><strong>Validação por e-mail</strong><small>Enviada pelo Gmail da Comunicação.</small></span></div>
      <div><q-icon name="mdi-whatsapp" /><span><strong>{{ loading ? 'Verificando WhatsApp Web…' : whatsappLabel }}</strong><small>Envia para o telefone já cadastrado na conta.</small></span></div>
    </div>
    <q-banner rounded class="access-security__guide">
      <template #avatar><q-icon name="mdi-link-variant" /></template>
      Na Comunicação, autorize <strong>Validação de acesso por e-mail</strong> no app de integração, conecte o Gmail e mantenha a sessão de WhatsApp Web conectada pelo QR Code.
      <template #action><q-btn flat no-caps to="/admin/comunicacao/integrations" label="Abrir integrações" /></template>
    </q-banner>
    <q-form @submit.prevent="save" class="access-security__form">
      <q-input v-model.trim="url" outlined label="URL da API de comunicação" placeholder="https://api.aitosoftwares.com/comunicacao/api" :rules="[v => /^https:\/\//.test(v) || 'Use uma URL HTTPS.']" />
      <q-input v-model.trim="token" outlined type="password" autocomplete="new-password" label="Novo token do app externo" placeholder="nf_live_…" hint="Informe um novo valor para substituir a configuração." :rules="[v => v.startsWith('nf_live_') || 'Informe o token do app de integração.']" />
      <div class="access-security__actions">
        <q-btn flat no-caps icon="mdi-refresh" label="Atualizar estado" :loading="loading" @click="load" />
        <q-btn unelevated no-caps color="teal-7" icon="mdi-lock-check-outline" label="Salvar integração protegida" type="submit" :loading="saving" :disable="!token" />
      </div>
    </q-form>
  </section>
</template>
<style scoped>.access-security{padding:clamp(20px,4vw,34px);color:#eafff7;background:linear-gradient(145deg,#0b302d,#061d24);border:1px solid #2c6256;border-radius:22px}.access-security header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.access-security header>div{max-width:700px}.access-security__eyebrow{font-size:10px;font-weight:800;letter-spacing:.1em;color:#98e8d2}.access-security h2{font-size:clamp(23px,3vw,32px);line-height:1.25;margin:13px 0}.access-security p{font-size:13px;line-height:1.8;color:#aac9be}.access-security__facts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0}.access-security__facts>div{display:flex;gap:12px;padding:19px;border:1px solid #72c3a82f;border-radius:14px;background:#aaffd60a}.access-security__facts .q-icon{font-size:26px;color:#9ee7cd}.access-security__facts strong,.access-security__facts small{display:block}.access-security__facts strong{font-size:14px}.access-security__facts small{font-size:11px;color:#97b9ab;line-height:1.8;margin-top:6px}.access-security__guide{font-size:12px;line-height:1.8;background:#b8f4d916;color:#bfdcce}.access-security__form{display:grid;gap:17px;margin-top:25px}.access-security__actions{display:flex;justify-content:flex-end;gap:10px}.access-security__form :deep(.q-field__native),.access-security__form :deep(.q-field__label){color:#d6efe4}.access-security__form :deep(.q-field__control:before){border-color:#568878}.access-security__form :deep(.q-field__bottom){color:#a3c4b6}.access-security__note{font-size:10px!important;margin-bottom:0}@media(max-width:600px){.access-security header,.access-security__actions{flex-direction:column}.access-security__facts{grid-template-columns:1fr}.access-security__actions>.q-btn{width:100%}}
</style>
