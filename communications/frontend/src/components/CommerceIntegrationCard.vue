<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { http, unwrap, errorMessage } from '../services/http.js'
const $q = useQuasar(), status = ref(null), secret = ref(''), busy = ref(false)
const credentialName = 'BOTBUILDER_COMMERCE_SECRET'
async function load() { try { status.value = unwrap(await http.get('/whatsapp-web/integrations/commerce/status')) } catch (error) { $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível conferir a integração comercial.') }) } }
async function save() {
  if (secret.value.trim().length < 32 || status.value?.source === 'environment') return
  busy.value = true
  try {
    const records = unwrap(await http.get('/whatsapp-web/settings/credentials'))?.items || []
    const current = records.find(item => item.name === credentialName)
    const body = { name: credentialName, description: 'Entrega de licenças e acesso privado de compradores na AitoSoftwares', value: secret.value.trim() }
    if (current) await http.put(`/whatsapp-web/settings/credentials/${current._id}`, body)
    else await http.post('/whatsapp-web/settings/credentials', body)
    secret.value = ''; await load(); $q.notify({ type: 'positive', message: 'Chave comercial salva no cofre protegido.' })
  } catch (error) { $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível salvar a chave comercial.') }) }
  finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <section class="glass-card commerce-link">
    <header><q-icon name="verified_user"/><div><h2>Compras e licenças · AitoSoftwares</h2><p>Conecta o pagamento confirmado ao token e ao painel privado de download do comprador.</p></div><q-badge :color="status?.configured ? 'positive' : 'warning'">{{ status?.configured ? 'Configurada' : 'Configuração pendente' }}</q-badge></header>
    <p>Use a mesma chave comercial na API AitoSoftwares. Esta chave é diferente da licença do aplicativo e do token do app de autenticação por e-mail.</p>
    <div v-if="status" class="commerce-status"><span>Origem: <strong>{{ status.source === 'environment' ? 'Ambiente do servidor' : status.source === 'vault' ? 'Cofre criptografado' : 'Não cadastrada' }}</strong></span><code v-if="status.fingerprint">Impressão SHA-256: {{ status.fingerprint }}</code><q-btn flat dense no-caps icon="refresh" label="Conferir" :disable="busy" @click="load"/></div>
    <q-banner v-if="status?.source === 'environment'" rounded class="bg-amber-1 text-brown-9">A variável de ambiente tem prioridade. Para mudar o valor efetivo, atualize o ambiente e reinicie o serviço.</q-banner>
    <q-form v-else class="commerce-form" @submit.prevent="save"><q-input v-model="secret" outlined type="password" autocomplete="new-password" label="Nova chave comercial compartilhada" hint="Mínimo de 32 caracteres. O valor atual nunca é devolvido; compare apenas a impressão digital nos dois sistemas." :rules="[value => value.trim().length >= 32 || 'Informe ao menos 32 caracteres.']"/><q-btn color="primary" unelevated no-caps label="Salvar no cofre" type="submit" :loading="busy" :disable="secret.trim().length < 32"/></q-form>
  </section>
</template>
<style scoped>
.commerce-link{padding:24px;margin-bottom:24px}.commerce-link header{display:flex;align-items:center;gap:13px}.commerce-link header>div{flex:1;min-width:0}.commerce-link header>.q-icon{font-size:30px;color:var(--q-primary)}.commerce-link h2{font-size:20px;line-height:1.4;margin:0}.commerce-link p{font-size:12px;line-height:1.8;color:var(--muted,#59756a);margin:10px 0}.commerce-status{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin:14px 0;font-size:12px}.commerce-status code{overflow-wrap:anywhere}.commerce-form{display:flex;align-items:flex-start;gap:14px;margin-top:18px}.commerce-form>.q-input{flex:1;min-width:0}.commerce-form>.q-btn{margin-top:7px}@media(max-width:650px){.commerce-link{padding:18px}.commerce-link header{flex-wrap:wrap}.commerce-link header>div{flex-basis:80%}.commerce-form{flex-direction:column}.commerce-form>.q-input,.commerce-form>.q-btn{width:100%}}
</style>
