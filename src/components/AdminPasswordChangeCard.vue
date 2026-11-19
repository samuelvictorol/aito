<script setup>
import { ref } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ authOptions: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const opened = ref(false)
const busy = ref(false)
const status = ref(null)
const error = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const endpoint = '/auth/admin/credentials'
const options = () => ({ ...props.authOptions, timeout: 30_000 })

function resetForm() {
  error.value = ''
  currentPassword.value = ''
  newPassword.value = ''
  repeatPassword.value = ''
}

function passwordRule(value) {
  const minimum = status.value.passwordMinLength
  const maximum = status.value.passwordMaxBytes
  if (Array.from(value).length < minimum) return `Use pelo menos ${minimum} caracteres.`
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

async function confirm() {
  if (busy.value || !status.value) return
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post(`${endpoint}/confirm`, {
      currentPassword: currentPassword.value,
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
      <p>Confirme sua senha atual para cadastrar uma nova.</p>
    </div>
    <q-btn unelevated no-caps color="teal-8" label="Alterar senha" @click="open" />
  </section>

  <q-dialog v-model="opened" :persistent="busy" @hide="resetForm">
    <q-card class="password-dialog">
      <q-card-section class="row items-start no-wrap">
        <div class="col">
          <h2 class="text-h6 q-my-none">Alterar senha do administrador</h2>
          <p class="q-mb-none q-mt-xs">Após a alteração, entre novamente no painel.</p>
        </div>
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar" :disable="busy" />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ error }}</q-banner>
        <q-linear-progress v-if="busy && !status" indeterminate color="teal-7" aria-label="Consultando configuração da senha" />
        <q-btn v-else-if="!status" flat no-caps color="teal-8" label="Tentar novamente" @click="open" />
        <q-form v-else class="password-form" @submit.prevent="confirm">
          <q-input v-model="currentPassword" outlined autofocus type="password" autocomplete="current-password"
            maxlength="1024" label="Senha atual" :disable="busy" :rules="[v => Boolean(v) || 'Informe sua senha atual.']" />
          <q-input v-model="newPassword" outlined type="password" autocomplete="new-password" :maxlength="status.passwordMaxBytes"
            label="Nova senha" :disable="busy" :rules="[passwordRule]" />
          <q-input v-model="repeatPassword" outlined type="password" autocomplete="new-password" :maxlength="status.passwordMaxBytes"
            label="Repita a nova senha" :disable="busy" :rules="[v => Boolean(v) && v === newPassword || 'As senhas precisam ser iguais.']" />
          <div class="password-actions">
            <q-btn v-close-popup flat no-caps color="teal-8" label="Cancelar" :disable="busy" />
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
