<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card class="auth-dialog">
      <q-card-section class="auth-dialog__head">
        <div class="auth-dialog__brand">
          <q-img src="/aito-logo-restored.png" width="42px" height="42px" fit="contain" />
          <div>
            <span class="auth-dialog__eyebrow">AitoSoftwares</span>
            <h3>{{ authMode === 'login' ? 'Entrar na AitoSoftwares' : 'Criar acesso' }}</h3>
          </div>
        </div>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="isOpen = false" />
      </q-card-section>

      <q-card-section class="auth-dialog__tabs">
        <button type="button" :class="{ 'is-active': authMode === 'login' }" @click="authMode = 'login'">Entrar</button>
        <button v-if="!isAffiliate" type="button" :class="{ 'is-active': authMode === 'register' }" @click="authMode = 'register'">Criar acesso</button>
      </q-card-section>

      <q-card-section class="auth-dialog__body">
        <q-form @submit.prevent="submitAuth">
          <q-input v-if="authMode === 'login'" v-model="form.identifier" outlined dense lazy-rules label="E-mail ou telefone" autocomplete="username" :rules="[requiredRule]" />
          <q-input v-if="authMode === 'register'" v-model="form.name" outlined dense lazy-rules label="Nome" autocomplete="name" :rules="[requiredRule]" />
          <q-input v-if="authMode === 'register'" v-model="form.email" outlined dense lazy-rules label="E-mail" type="email" autocomplete="email" class="q-mt-sm" :rules="[requiredRule]" />
          <q-input v-if="authMode === 'register'" v-model="form.phone" outlined dense lazy-rules label="Telefone unico" autocomplete="tel" class="q-mt-sm" :rules="[requiredRule]" />
          <q-input v-model="form.password" outlined dense lazy-rules label="Senha" type="password" autocomplete="current-password" class="q-mt-sm" :rules="[requiredRule]" />
          <button type="submit" class="auth-dialog__action full-width q-mt-md" :disabled="loading">
            <q-spinner v-if="loading" size="18px" />
            <q-icon v-else name="mdi-login" size="18px" />
            {{ authMode === 'login' ? 'Entrar' : 'Cadastrar' }}
          </button>
        </q-form>

        <q-btn v-if="authMode === 'login'" flat no-caps class="auth-dialog__forgot full-width q-mt-sm" icon="mdi-lock-reset" label="Esqueci minha senha" @click="passwordResetOpen = true" />
        <div v-if="!isAffiliate" class="auth-dialog__separator"><span>ou</span></div>
        <button v-if="!isAffiliate" type="button" class="auth-dialog__action full-width" @click="continueWithGoogle">
          <q-icon name="mdi-google" size="18px" />
          Continuar com Google
        </button>
        <button v-if="isAffiliate" type="button" class="auth-dialog__action full-width q-mt-sm" @click="affiliateApplicationOpen = true">
          <q-icon name="mdi-account-star-outline" size="18px" />
          Quero me tornar afiliado
        </button>
        <q-btn v-if="showProjectLogin && !isAffiliate" outline no-caps class="auth-dialog__project full-width q-mt-sm" icon="mdi-briefcase-outline" label="Acompanhar projeto" @click="goToCustomerLogin" />
      </q-card-section>
    </q-card>
  </q-dialog>

  <LoginMfaDialog v-model="mfaOpen" :challenge="mfaChallenge" @verified="completeLogin" />
  <PasswordResetDialog v-if="!isAffiliate" v-model="passwordResetOpen" audience="user" :initial-email="form.identifier.includes('@') ? form.identifier : ''" @completed="handlePasswordResetCompleted" />
  <AffiliateApplicationDialog v-if="isAffiliate" v-model="affiliateApplicationOpen" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api, apiBaseURL } from 'boot/axios'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'
import LoginMfaDialog from 'components/LoginMfaDialog.vue'
import AffiliateApplicationDialog from 'components/AffiliateApplicationDialog.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialMode: { type: String, default: 'login' },
  initialEmail: { type: String, default: '' },
  returnPath: { type: String, default: '' },
  showProjectLogin: { type: Boolean, default: true },
  audience: { type: String, default: 'user' },
})
const emit = defineEmits(['update:modelValue', 'authenticated'])
const $q = useQuasar()
const router = useRouter()
const authMode = ref(props.initialMode === 'register' ? 'register' : 'login')
const loading = ref(false), mfaOpen=ref(false), mfaChallenge=ref(null)
const passwordResetOpen = ref(false)
const affiliateApplicationOpen = ref(false)
const form = reactive({ identifier: '', name: '', email: '', phone: '', password: '' })
const isOpen = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })
const isAffiliate = computed(() => props.audience === 'affiliate')
const requiredRule = (value) => Boolean(String(value || '').trim()) || 'Preencha este campo.'

function persistSession(data) {
  const role = isAffiliate.value ? 'affiliate' : data.user?.role==='customer'?'customer':'user'
  ;['aito_admin_token', 'aito_admin_user', 'aito_user_token', 'aito_user', 'aito_affiliate_token', 'aito_affiliate_user', 'aito_seller_token', 'aito_seller_user'].forEach((key) => localStorage.removeItem(key))
  const tokenKey = role === 'affiliate' ? 'aito_affiliate_token' : 'aito_user_token'
  const userKey = role === 'affiliate' ? 'aito_affiliate_user' : 'aito_user'
  localStorage.setItem(tokenKey, data.token)
  localStorage.setItem(userKey, JSON.stringify({ ...data.user, role }))
  return { ...data, user: { ...data.user, role } }
}

function completeLogin(response) {
    const data = persistSession(response)
    isOpen.value = false
    $q.notify({ type: 'positive', icon: 'mdi-login', message: 'Acesso realizado.' })
    emit('authenticated', data)
}

async function submitAuth() {
  loading.value = true
  try {
    const response = authMode.value === 'register'
      ? await api.post('/auth/register', { name: form.name, email: form.email, phone: form.phone, password: form.password })
      : await api.post(isAffiliate.value ? '/auth/affiliate/login' : '/auth/login', { identifier: form.identifier, password: form.password })
    if(response.data.requiresMfa){mfaChallenge.value=response.data;mfaOpen.value=true;return}
    completeLogin(response.data)
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel concluir o acesso.' })
  } finally {
    loading.value = false
  }
}

function continueWithGoogle() {
  if (props.returnPath) sessionStorage.setItem('aito_auth_return_path', props.returnPath)
  window.location.assign(`${apiBaseURL.replace(/\/$/, '')}/auth/google?audience=${encodeURIComponent(props.audience)}`)
}

function goToCustomerLogin() {
  isOpen.value = false
  router.push('/customer/login')
}

function handlePasswordResetCompleted({ email }) {
  authMode.value = 'login'
  form.identifier = email
  form.password = ''
}

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  authMode.value = !isAffiliate.value && props.initialMode === 'register' ? 'register' : 'login'
  if (props.initialEmail) form.identifier = props.initialEmail
})
</script>

<style scoped>
.auth-dialog { width: min(92vw, 30rem); border: 1px solid rgba(19, 188, 157, .42); border-radius: .95rem; color: #effffb; background: radial-gradient(circle at 10% 0%, rgba(19, 188, 157, .2), transparent 14rem), linear-gradient(145deg, rgba(3, 23, 24, .98), rgba(1, 10, 12, .98)); box-shadow: 0 30px 100px rgba(0, 0, 0, .55); }
.auth-dialog :deep(.q-field__control) { min-height: 2.85rem; color: #f0fffc; background: rgba(5, 33, 34, .86); }
.auth-dialog :deep(.q-field__native), .auth-dialog :deep(.q-field__input) { color: #f0fffc !important; caret-color: #8fffee; }
.auth-dialog :deep(.q-field__label) { color: rgba(208, 250, 242, .72); }
.auth-dialog :deep(.q-field--focused .q-field__label), .auth-dialog :deep(.q-field--float .q-field__label) { color: #8fffee; }
.auth-dialog :deep(.q-field--outlined .q-field__control:before) { border-color: rgba(80, 212, 190, .42); }
.auth-dialog :deep(.q-field--outlined:hover .q-field__control:before), .auth-dialog :deep(.q-field--focused .q-field__control:after) { border-color: #8fffee; }
.auth-dialog :deep(.q-field__bottom) { color: rgba(208, 250, 242, .72); }
.auth-dialog :deep(.q-field__messages) { color: #ff9eaf; }
.auth-dialog :deep(.q-field__marginal), .auth-dialog :deep(.q-btn--flat) { color: #8fffee; }
.auth-dialog__head { display: flex; padding: 1rem 1.1rem .45rem; align-items: flex-start; justify-content: space-between; }
.auth-dialog__brand { display: flex; align-items: center; gap: .7rem; }
.auth-dialog__eyebrow { display: block; color: #8fffee; font-size: .62rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.auth-dialog h3 { margin: .25rem 0 0; color: #f2fffc; font-size: 1.2rem; }
.auth-dialog__tabs { display: flex; gap: .45rem; padding: .5rem 1.1rem; border-top: 1px solid rgba(19, 188, 157, .16); border-bottom: 1px solid rgba(19, 188, 157, .16); }
.auth-dialog__tabs button { padding: .42rem .65rem; border: 0; border-radius: 999px; color: rgba(225, 255, 249, .62); background: transparent; font-size: .68rem; cursor: pointer; }
.auth-dialog__tabs button.is-active { color: #03120f; background: #13bc9d; font-weight: 800; }
.auth-dialog__body { padding: .5rem 1.1rem 1.25rem; }
.auth-dialog__action { display: flex; min-height: 2.7rem; align-items: center; justify-content: center; gap: .5rem; padding: .55rem .8rem; border: 1px solid rgba(19, 188, 157, .3); border-radius: 999px; color: #effffb; background: rgba(19, 188, 157, .08); font: inherit; font-size: .74rem; cursor: pointer; }
.auth-dialog__action:hover, .auth-dialog__action:focus-visible { border-color: rgba(143, 255, 238, .7); background: rgba(19, 188, 157, .17); outline: none; }
.auth-dialog__action:disabled { cursor: wait; opacity: .68; }
.auth-dialog__action .q-icon, .auth-dialog__action .q-spinner { color: #8fffee; }
.auth-dialog__forgot { color: #8fffee; font-size: .7rem; }
.auth-dialog__separator { display: flex; margin: 1rem 0; align-items: center; gap: .65rem; color: rgba(225, 255, 249, .4); font-size: .68rem; }
.auth-dialog__separator::before, .auth-dialog__separator::after { flex: 1; height: 1px; content: ''; background: rgba(19, 188, 157, .2); }
.auth-dialog__project { min-height: 2.7rem; border-color: rgba(143, 255, 238, .42); border-radius: 999px; color: #8fffee; background: rgba(19, 188, 157, .04); font-size: .74rem; }
</style>
