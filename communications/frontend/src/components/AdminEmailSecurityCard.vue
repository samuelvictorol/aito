<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { http, unwrap, errorMessage } from '../services/http.js'
import { useAuthStore } from '../stores/auth.js'
const $q = useQuasar(), router = useRouter(), auth = useAuthStore()
const form = reactive({ enabled: false, password: '', sender: { email: '', name: '' } })
const challenge = ref(null), code = ref(''), busy = ref(false), current = ref(null)
const expanded = ref(false), loading = ref(true), loadError = ref('')
async function load() {
  loading.value = true; loadError.value = ''
  try {
    const value = unwrap(await http.get('/auth/mfa/settings'))
    form.enabled = current.value = value.enabled === true
    expanded.value = !current.value
    Object.assign(form.sender, value.sender)
  } catch (error) { loadError.value = errorMessage(error); expanded.value = true }
  finally { loading.value = false }
}
onMounted(load)
async function request() { busy.value = true; try { challenge.value = unwrap(await http.post('/auth/mfa/settings/challenge', form)); form.password = '' } catch (error) { $q.notify({ type: 'negative', message: errorMessage(error) }) } finally { busy.value = false } }
async function confirm() { busy.value = true; try { await http.post('/auth/mfa/settings/confirm', { challengeId: challenge.value.challengeId, code: code.value }); await auth.logout(); await router.replace('/login'); $q.notify({ type: 'positive', message: 'Segurança atualizada. Entre novamente para aplicar a configuração.' }) } catch (error) { $q.notify({ type: 'negative', message: errorMessage(error) }) } finally { busy.value = false } }
</script>
<template>
  <q-card id="admin-email-security" flat class="glass-card q-mb-lg admin-email-security" :class="{ 'admin-email-security--active': current === true, 'admin-email-security--inactive': current === false }">
    <q-expansion-item v-model="expanded" expand-separator>
      <template #header>
        <q-item-section avatar><q-icon :name="current === true ? 'verified_user' : 'shield'" :color="current === true ? 'positive' : current === false ? 'negative' : 'grey-7'" size="28px"/></q-item-section>
        <q-item-section><h2 class="text-h6 q-my-none">Validação do administrador por e-mail</h2><div class="q-mt-xs"><q-badge :color="current === true ? 'positive' : current === false ? 'negative' : 'grey-7'">{{ loading ? 'Consultando…' : current === true ? 'Ativada' : current === false ? 'Desativada' : 'Estado indisponível' }}</q-badge></div></q-item-section>
      </template>
      <div class="admin-email-security__body">
      <q-banner v-if="loadError" rounded class="bg-red-1 text-negative" role="alert">{{ loadError }}<template #action><q-btn flat no-caps label="Tentar novamente" @click="load"/></template></q-banner>
      <template v-if="!loading && !loadError">
      <p class="text-grey-7 q-mt-sm">Ao ativar, seu acesso exige senha e um código enviado ao seu e-mail de administrador. Configure o Gmail abaixo antes de começar.</p>
    <q-form v-if="!challenge" @submit="request"><q-toggle v-model="form.enabled" label="Exigir código de e-mail no meu login"/><div class="security-fields"><q-input v-model.trim="form.sender.email" outlined label="E-mail remetente (opcional)" hint="Vazio usa o remetente do Gmail. Outro endereço precisa estar autorizado nessa conta."/><q-input v-model.trim="form.sender.name" outlined maxlength="80" label="Nome do remetente (opcional)"/><q-input v-model="form.password" outlined type="password" autocomplete="current-password" label="Confirme sua senha atual" :rules="[v => v.length >= 8 || 'Informe sua senha atual']"/></div><q-btn color="primary" no-caps label="Receber código para salvar" type="submit" :loading="busy"/></q-form>
    <q-form v-else @submit="confirm"><p>Enviamos um código para {{ challenge.maskedEmail }}. Verifique também o lixo eletrônico ou a pasta Spam. A configuração só muda depois da confirmação.</p><q-input v-model="code" outlined inputmode="numeric" autocomplete="one-time-code" maxlength="6" label="Código de confirmação" :rules="[v => /^\d{6}$/.test(v) || 'Informe os 6 dígitos']"/><q-btn color="primary" no-caps label="Confirmar configuração" type="submit" :loading="busy"/><q-btn flat no-caps label="Cancelar" @click="challenge = null; code = ''"/></q-form>
      </template>
      </div>
    </q-expansion-item>
  </q-card>
</template>
<style scoped>
.admin-email-security { overflow: hidden; border: 1px solid #dbe5e1; }
.admin-email-security--inactive { background: #fff3f4; border-color: #edb8bf; }
.admin-email-security--active { background: #eefaf2; border-color: #b7dfc3; }
.admin-email-security :deep(.q-expansion-item__container > .q-item) { padding: 16px 20px; }
.admin-email-security__body { padding: 0 20px 20px; }
.security-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.security-fields>.q-field:last-child{grid-column:1/-1}
@media(max-width:650px){.security-fields{grid-template-columns:1fr}.admin-email-security :deep(.q-expansion-item__container > .q-item){padding:14px}.admin-email-security__body{padding:0 14px 16px}.admin-email-security h2{font-size:16px;line-height:1.4}}
</style>
