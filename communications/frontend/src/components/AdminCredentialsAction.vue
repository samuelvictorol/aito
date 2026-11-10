<script setup>
import { reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { errorMessage, http, unwrap } from '../services/http.js'
import { useAuthStore } from '../stores/auth.js'

const emit = defineEmits(['configure'])
defineProps({ hostManagementUrl: String })
const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const opened = ref(false)
const busy = ref(false)
const error = ref('')
const status = ref(null)
const challenge = ref(null)
const code = ref('')
const form = reactive({ email: '', password: '', newPassword: '' })
const reasons = {
  'host-managed': 'Sua conta usa o acesso do painel principal. Gerencie suas credenciais por lá.',
  'environment-managed': 'As credenciais desta conta são gerenciadas pela hospedagem.',
  'gmail-required': 'Configure o Gmail em Credenciais e canais para receber os códigos de confirmação.',
  'mfa-required': 'Ative a autenticação multifator do administrador antes de alterar suas credenciais.'
}
let targetConfiguration
const validPassword = value => !value || (value.length >= 12 && new TextEncoder().encode(value).length <= 72) || 'Use pelo menos 12 caracteres e no máximo 72 bytes.'

function clearForm() {
  Object.assign(form, { email: '', password: '', newPassword: '' })
  challenge.value = null
  code.value = ''
  error.value = ''
}

async function load() {
  clearForm()
  status.value = null
  opened.value = true
  busy.value = true
  try {
    status.value = unwrap(await http.get('/auth/mfa/credentials'))
    form.email = status.value.email
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}

async function request() {
  if (busy.value || !status.value?.available) return
  busy.value = true
  error.value = ''
  try {
    challenge.value = unwrap(await http.post('/auth/mfa/credentials/challenge', {
      password: form.password,
      ...(form.email !== status.value.email && { email: form.email }),
      ...(form.newPassword && { newPassword: form.newPassword })
    }))
    form.password = form.newPassword = ''
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}

async function confirm() {
  if (busy.value || !challenge.value) return
  busy.value = true
  error.value = ''
  try {
    const { stage, challengeId } = challenge.value
    const result = unwrap(await http.post('/auth/mfa/credentials/confirm', { stage, challengeId, code: code.value }))
    code.value = ''
    if (!result.changed) {
      challenge.value = result
      return
    }
    opened.value = false
    await auth.logout()
    await router.replace('/login')
    $q.notify({ type: 'positive', message: 'Credenciais atualizadas. Entre novamente.' })
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}

function configure() {
  targetConfiguration = status.value?.reason
  opened.value = false
}

function close() {
  clearForm()
  if (targetConfiguration) emit('configure', targetConfiguration)
  targetConfiguration = undefined
}
</script>

<template>
  <q-btn outline no-caps color="primary" icon="manage_accounts" label="Alterar credenciais" @click="load" />
  <q-dialog v-model="opened" :persistent="busy" @hide="close">
    <q-card class="admin-credentials-dialog">
      <q-card-section class="row items-start no-wrap q-gutter-sm">
        <q-icon name="admin_panel_settings" color="primary" size="28px" />
        <div class="col">
          <h2 class="text-h6 q-my-none">Credenciais do administrador</h2>
          <p class="text-grey-7 q-mb-none">Altere o e-mail ou a senha do seu acesso ao painel.</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" aria-label="Fechar" :disable="busy" />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md" rounded role="alert">{{ error }}</q-banner>
        <q-linear-progress v-if="busy && !status" indeterminate color="primary" aria-label="Consultando os requisitos" />
        <q-btn v-else-if="!status" no-caps flat color="primary" label="Tentar novamente" @click="load" />
        <template v-else-if="!status.available">
          <q-banner class="bg-amber-1 text-brown-10" rounded>{{ reasons[status.reason] }}</q-banner>
          <q-btn v-if="status.reason === 'gmail-required' || status.reason === 'mfa-required'" class="q-mt-md" unelevated no-caps color="primary" :label="status.reason === 'gmail-required' ? 'Configurar Gmail' : 'Configurar multifator'" @click="configure" />
          <q-btn v-else-if="status.reason === 'host-managed' && hostManagementUrl" class="q-mt-md" unelevated no-caps color="primary" label="Abrir painel principal" :href="hostManagementUrl" target="_top" />
        </template>
        <q-form v-else-if="!challenge" class="column q-gutter-md" @submit="request">
          <q-input v-model.trim="form.email" outlined label="E-mail de acesso" type="email" maxlength="254" autocomplete="username" required />
          <q-input v-model="form.newPassword" outlined label="Nova senha (opcional)" type="password" maxlength="72" autocomplete="new-password" :rules="[validPassword]" />
          <q-input v-model="form.password" outlined label="Senha atual" type="password" maxlength="256" autocomplete="current-password" :rules="[v => v.length >= 8 || 'Informe sua senha atual']" />
          <q-btn class="self-end" unelevated no-caps color="primary" type="submit" label="Receber código de confirmação" :loading="busy" />
        </q-form>
        <q-form v-else class="column q-gutter-md" @submit="confirm">
          <div><strong>{{ challenge.stage === 'current' ? 'Confirme o e-mail atual' : 'Confirme o novo e-mail' }}</strong><p class="q-mb-none">Enviamos um código de confirmação para {{ challenge.maskedEmail }}.</p></div>
          <q-input v-model="code" outlined inputmode="numeric" autocomplete="one-time-code" maxlength="6" label="Código de confirmação" :rules="[v => /^\d{6}$/.test(v) || 'Informe os 6 dígitos']" />
          <div class="row justify-end q-gutter-sm">
            <q-btn flat no-caps color="primary" label="Recomeçar" :disable="busy" @click="load" />
            <q-btn unelevated no-caps color="primary" type="submit" label="Confirmar código" :loading="busy" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.admin-credentials-dialog { width: min(520px, 94vw); border-radius: 20px; }
</style>
