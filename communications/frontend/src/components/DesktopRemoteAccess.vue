<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { getAccessToken } from '../services/tokens.js'
import { inPrototype } from '../services/prototype-runtime.js'
const available = Boolean(window.desktopData) && !inPrototype(), $q = useQuasar()
const state = ref({}), token = ref(''), domain = ref(''), busy = ref(false), error = ref('')
let timer
async function load() {
  if (!available || busy.value) return
  try { const result = await window.desktopData.tunnelStatus(getAccessToken()); if (!result.ok) throw Error(result.message); state.value = result; if (!domain.value) domain.value = result.domain; error.value = result.error || '' } catch (cause) { error.value = cause.message }
}
async function change(enabled) {
  busy.value = true; error.value = ''
  try {
    const result = await window.desktopData.tunnelSave({ token: getAccessToken(), settings: { ...(token.value ? { authtoken: token.value } : {}), domain: domain.value, enabled } })
    if (!result.ok) throw Error(result.message)
    state.value = result; token.value = ''; $q.notify({ type: 'positive', message: enabled ? 'Acesso de colaboradores conectado.' : 'Acesso externo desativado.' })
  } catch (cause) { error.value = cause.message } finally { busy.value = false }
}
async function share() {
  try { if (navigator.share) await navigator.share({ title: 'Acesso do colaborador', text: 'Entre com seu perfil de colaborador.', url: state.value.url || location.origin + '/comunicacao/app/colaboradores' }); else { await navigator.clipboard.writeText(state.value.url || location.origin + '/comunicacao/app/colaboradores'); $q.notify({type:'positive',message:'Link copiado.'}) } } catch (cause) { if (cause.name !== 'AbortError') $q.notify({type:'warning',message:'Copie o endereço mostrado no campo.'}) }
}
onMounted(() => { if (available) { load(); timer = setInterval(load, 15000) } })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <q-card v-if="available" flat bordered class="remote-access q-mb-lg"><q-card-section>
    <div class="row items-center q-gutter-sm"><q-icon name="public" color="primary" size="28px"/><h2 class="col">Compartilhar atendimento</h2><q-badge :color="state.connected ? 'positive' : 'grey-7'">{{ state.connected ? 'Conectado' : 'Desconectado' }}</q-badge></div>
    <p>Permita que colaboradores acessem os canais e ferramentas autorizados pelo navegador. O computador, o aplicativo e o ngrok precisam continuar ligados.</p>
    <div class="remote-fields"><q-input v-model="token" outlined type="password" autocomplete="new-password" label="Authtoken ngrok" :hint="state.configured ? 'Token já protegido no cofre. Preencha apenas para substituir.' : 'Copie em dashboard.ngrok.com/get-started/your-authtoken.'" :disable="busy" maxlength="512"/><q-input v-model="domain" outlined label="Domínio ngrok (opcional)" hint="Exemplo: seu-dominio.ngrok-free.app. Use um domínio da sua conta." :disable="busy" maxlength="253"/></div>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mt-md">{{ error }}</q-banner>
    <q-input v-if="state.url" :model-value="state.url" outlined readonly label="Link do colaborador" class="q-mt-md"><template #append><q-btn flat round icon="share" aria-label="Compartilhar link de login" @click="share"/></template></q-input>
    <div class="row q-gutter-sm q-mt-md"><q-btn color="primary" unelevated no-caps :label="state.connected ? 'Salvar e reconectar' : 'Salvar e conectar'" :loading="busy" @click="change(true)"/><q-btn v-if="state.connected || state.enabled" outline color="negative" no-caps label="Desativar acesso externo" :disable="busy" @click="change(false)"/></div>
    <p class="text-caption q-mt-md q-mb-none">O link abre o login individual; não concede acesso automaticamente. Autenticação, multifator e permissões do perfil continuam valendo. O painel administrativo permanece exclusivo do aplicativo.</p>
  </q-card-section></q-card>
  <q-banner v-else-if="!inPrototype()" rounded class="q-mb-lg bg-teal-1 text-teal-10">Cada colaborador entra com seu perfil e acessa somente o que você autorizou.<template #action><q-btn flat no-caps icon="share" label="Compartilhar login do colaborador" @click="share"/></template></q-banner>
</template>
<style scoped>.remote-access{border-radius:18px;background:color-mix(in srgb,var(--q-primary) 4%,white)}h2{font-size:20px;margin:0}p{font-size:14px;line-height:1.7}.remote-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:650px){.remote-fields{grid-template-columns:1fr}}</style>
