<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card class="password-reset-card">
      <q-card-section class="password-reset-card__head">
        <div class="password-reset-card__brand">
          <q-img src="/aito-logo-restored.png" width="42px" height="42px" fit="contain" />
          <div>
            <span class="password-reset-card__eyebrow">AitoSoftwares</span>
            <h3>Recuperar acesso</h3>
          </div>
        </div>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="isOpen = false" />
      </q-card-section>

      <q-card-section class="password-reset-card__body">
        <template v-if="step === 'request'">
          <p>Informe o e-mail cadastrado. Enviaremos um codigo temporario para redefinir sua senha.</p>
          <q-form @submit.prevent="requestCode">
            <q-input v-model.trim="form.email" outlined autofocus type="email" autocomplete="email" label="E-mail cadastrado" :rules="[emailRule]" />
            <q-btn unelevated no-caps class="password-reset-card__primary full-width q-mt-md" icon="mdi-email-fast-outline" label="Enviar codigo" type="submit" :loading="loading" />
          </q-form>
        </template>

        <template v-else-if="step === 'verify'">
          <p>Confira o lixo eletrônico ou spam caso não encontre o e-mail. Digite o codigo temporario enviado para redefinir sua senha.</p>
          <q-form @submit.prevent="verifyCode">
            <q-input v-model="form.email" outlined readonly label="E-mail" />
            <q-input v-model.trim="form.code" outlined autofocus inputmode="numeric" maxlength="6" label="Codigo temporario" class="q-mt-sm" :rules="[codeRule]" />
            <q-btn unelevated no-caps class="password-reset-card__primary full-width q-mt-md" icon="mdi-shield-check-outline" label="Validar codigo" type="submit" :loading="loading" />
          </q-form>
          <q-btn flat no-caps class="password-reset-card__back full-width q-mt-sm" icon="mdi-arrow-left" label="Usar outro e-mail" @click="step = 'request'" />
        </template>

        <template v-else>
          <p>Codigo validado. Agora escolha uma nova senha para sua conta.</p>
          <q-form @submit.prevent="resetPassword">
            <q-input v-model="form.password" outlined type="password" autocomplete="new-password" label="Nova senha" :rules="[passwordRule]" />
            <q-input v-model="form.passwordConfirmation" outlined type="password" autocomplete="new-password" label="Confirmar nova senha" class="q-mt-sm" :rules="[confirmationRule]" />
            <q-btn unelevated no-caps class="password-reset-card__primary full-width q-mt-md" icon="mdi-lock-check-outline" label="Redefinir senha" type="submit" :loading="loading" />
          </q-form>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  audience: { type: String, default: 'user' },
  initialEmail: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'completed'])
const $q = useQuasar()
const step = ref('request')
const loading = ref(false)
const resetToken = ref('')
const form = reactive({ email: '', code: '', password: '', passwordConfirmation: '' })
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const emailRule = (value) => {
  const email = String(value || '').trim()
  return (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || 'Informe um e-mail valido.'
}
const codeRule = (value) => /^\d{6}$/.test(String(value || '').trim()) || 'Digite o codigo de 6 digitos.'
const passwordRule = (value) => String(value || '').length >= 6 || 'Use pelo menos 6 caracteres.'
const confirmationRule = (value) => String(value || '') === form.password || 'As senhas precisam ser iguais.'

function endpoint(action) {
  return props.audience === 'customer' ? `/auth/customer/${action}` : `/auth/${action}`
}

async function requestCode() {
  loading.value = true
  try {
    const { data } = await api.post(endpoint('forgot-password'), { email: form.email })
    step.value = 'verify'
    $q.notify({ type: 'positive', message: data.message || 'Confira seu e-mail para continuar.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel enviar o codigo.' })
  } finally {
    loading.value = false
  }
}

async function verifyCode() {
  loading.value = true
  try {
    const { data } = await api.post(endpoint('verify-reset-code'), { email: form.email, code: form.code })
    resetToken.value = data.resetToken
    step.value = 'password'
    $q.notify({ type: 'positive', message: data.message || 'Codigo validado.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Codigo invalido ou expirado.' })
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  if (form.password !== form.passwordConfirmation) {
    $q.notify({ type: 'warning', message: 'As senhas precisam ser iguais.' })
    return
  }

  loading.value = true
  try {
    const { data } = await api.post(endpoint('reset-password'), {
      email: form.email,
      resetToken: resetToken.value,
      newPassword: form.password,
    })
    $q.notify({ type: 'positive', message: data.message || 'Senha redefinida com sucesso.' })
    emit('completed', { email: form.email })
    isOpen.value = false
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel redefinir a senha.' })
  } finally {
    loading.value = false
  }
}

function clearForm() {
  step.value = 'request'
  resetToken.value = ''
  form.email = ''
  form.code = ''
  form.password = ''
  form.passwordConfirmation = ''
}

watch(() => props.modelValue, (visible) => {
  if (visible) {
    if (props.initialEmail) form.email = props.initialEmail
    return
  }
  clearForm()
})
</script>

<style scoped>
.password-reset-card { width: min(94vw, 430px); color: #effffb; border: 1px solid rgba(19, 188, 157, .4); border-radius: 16px; background: rgba(3, 24, 24, .98); box-shadow: 0 28px 90px rgba(0, 0, 0, .48); }
.password-reset-card__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(143, 255, 238, .14); }
.password-reset-card__brand { display: flex; align-items: center; gap: .7rem; }
.password-reset-card__eyebrow { display: block; color: #8fffee; font-size: .63rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.password-reset-card h3 { margin: .22rem 0 0; color: #effffb; font-size: 1.16rem; }
.password-reset-card__body p { margin: 0 0 1.1rem; color: rgba(229, 255, 250, .72); font-size: .8rem; line-height: 1.5; }
.password-reset-card__body :deep(.q-field__control) { color: #effffb; background: rgba(7, 40, 40, .8); }
.password-reset-card__body :deep(.q-field__native), .password-reset-card__body :deep(.q-field__label) { color: rgba(239, 255, 251, .86); }
.password-reset-card__primary { min-height: 2.7rem; color: #03110f; border-radius: 999px; background: linear-gradient(135deg, #8fffee, #13bc9d); font-weight: 800; }
.password-reset-card__back { color: #8fffee; }
</style>
