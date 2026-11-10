<script setup>
import { ref } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ authOptions: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const opened = ref(false)
const busy = ref(false)
const status = ref(null)
const challenge = ref(null)
const error = ref('')
const currentPassword = ref('')
const code = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const endpoint = '/auth/admin/credentials'
const options = () => ({ ...props.authOptions, timeout: 30_000 })

function resetForm() {
  challenge.value = null
  error.value = ''
  currentPassword.value = ''
  code.value = ''
  newPassword.value = ''
  repeatPassword.value = ''
}

function passwordRule(value) {
  const minimum = status.value.passwordMinLength
  const maximum = status.value.passwordMaxBytes
  if (value.length < minimum) return `Use pelo menos ${minimum} caracteres.`
  return new TextEncoder().encode(value).length <= maximum || `Use no máximo ${maximum} bytes.`
}

async function open() {
  resetForm()
  status.value = null
  opened.value = true
  busy.value = true
  try {
    const { data } = await api.get(endpoint, options())
    status.value = data
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível verificar o acesso. Tente novamente.'
  } finally {
    busy.value = false
  }
}

async function requestCode() {
  if (busy.value || !status.value?.emailMfaConfigured) return
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post(`${endpoint}/challenge`, { currentPassword: currentPassword.value }, options())
    challenge.value = data
    currentPassword.value = ''
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível enviar o código. Tente novamente.'
  } finally {
    busy.value = false
  }
}

async function confirm() {
  if (busy.value || !challenge.value) return
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post(`${endpoint}/confirm`, {
      challengeId: challenge.value.challengeId,
      code: code.value,
      newPassword: newPassword.value,
    }, options())
    if (!data.changed || !data.requiresLogin) throw new Error('Alteração não confirmada')
    resetForm()
    opened.value = false
    emit('changed')
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível confirmar a troca. Tente novamente.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="admin-password">
    <q-icon name="mdi-lock-reset" size="30px" aria-hidden="true" />
    <div>
      <h2>Senha do administrador</h2>
      <p>Troque sua senha com um código por e-mail. Seu e-mail de acesso permanece o mesmo.</p>
    </div>
    <q-btn unelevated no-caps color="teal-8" label="Alterar senha" @click="open" />
  </section>

  <q-dialog v-model="opened" :persistent="busy" @hide="resetForm">
    <q-card class="password-dialog">
      <q-card-section class="row items-start no-wrap">
        <div class="col">
          <h2 class="text-h6 q-my-none">Alterar senha do administrador</h2>
          <p class="q-mb-none q-mt-xs">Confirme seu acesso pelo Gmail e pelo multifator.</p>
        </div>
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar" :disable="busy" />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ error }}</q-banner>
        <q-linear-progress v-if="busy && !status" indeterminate color="teal-7" aria-label="Consultando configuração do multifator" />
        <q-btn v-else-if="!status" flat no-caps color="teal-8" label="Tentar novamente" @click="open" />
        <q-banner v-else-if="!status.emailMfaConfigured" rounded class="bg-amber-1 text-brown-10">
          Conecte o Gmail na Comunicação e salve a integração de validação por e-mail nesta página.
        </q-banner>
        <q-form v-else-if="!challenge" class="password-form" @submit="requestCode">
          <p class="q-mb-sm">Enviaremos um código para <strong>{{ status.emailMasked }}</strong>.</p>
          <q-input v-model="currentPassword" outlined autofocus type="password" autocomplete="current-password"
            maxlength="256" label="Senha atual" :disable="busy" :rules="[v => Boolean(v) || 'Informe sua senha atual.']" />
          <q-btn class="self-end" unelevated no-caps color="teal-8" type="submit" label="Receber código por e-mail" :loading="busy" />
        </q-form>
        <q-form v-else class="password-form" @submit="confirm">
          <p class="q-mb-sm">Código enviado para <strong>{{ challenge.emailMasked }}</strong>. Ele pode ser usado uma vez e expira em {{ Math.ceil(challenge.expiresInSeconds / 60) }} min.</p>
          <q-input v-model="code" outlined autofocus mask="######" inputmode="numeric" autocomplete="one-time-code"
            label="Código de 6 dígitos" :disable="busy" :rules="[v => /^\d{6}$/.test(v) || 'Informe os seis dígitos.']" />
          <q-input v-model="newPassword" outlined type="password" autocomplete="new-password" :maxlength="status.passwordMaxBytes"
            label="Nova senha" :disable="busy" :rules="[passwordRule]" />
          <q-input v-model="repeatPassword" outlined type="password" autocomplete="new-password" :maxlength="status.passwordMaxBytes"
            label="Repita a nova senha" :disable="busy" :rules="[v => Boolean(v) && v === newPassword || 'As senhas precisam ser iguais.']" />
          <div class="password-actions">
            <q-btn flat no-caps color="teal-8" label="Pedir outro código" :disable="busy" @click="resetForm" />
            <q-btn unelevated no-caps color="teal-8" type="submit" label="Alterar senha e sair" :loading="busy" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.admin-password{display:flex;align-items:center;gap:14px;padding:clamp(16px,3vw,24px);margin-bottom:16px;border:1px solid #c3e4d6;border-radius:18px;color:#153d33;background:linear-gradient(135deg,#f5fffa,#e1f5ec)}
.admin-password>div{flex:1}
.admin-password>.q-icon{color:#167259}
.admin-password h2{font-size:1.2rem;line-height:1.3;margin:0 0 4px;font-weight:700}
.admin-password p,.password-dialog p{font-size:.85rem;color:#426b5e;overflow-wrap:anywhere}
.admin-password p{margin:0}
.password-dialog{width:min(500px,calc(100vw - 28px));color:#173b32;border-radius:18px;background:#fbfffd}
.password-form{display:flex;flex-direction:column;gap:8px}
.password-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
@media(max-width:600px){.admin-password{flex-wrap:wrap;align-items:flex-start}.admin-password>.q-btn{width:100%}.password-actions>.q-btn{width:100%}}
</style>
