<template>
  <q-layout view="lHh Lpr lFf" class="customer-login">
    <q-page-container>
      <q-page class="customer-login__page row items-center justify-center">
        <q-form class="customer-login__panel" @submit.prevent="login">
          <div class="customer-login__brand">
            <q-img src="/aito-logo-restored.png" width="58px" height="38px" fit="contain" />
            <div>
              <div class="text-h6 text-weight-bold">Acesso do Cliente</div>
            </div>
          </div>


          <q-input v-model="form.identifier" outlined dense label="E-mail ou telefone" autocomplete="username" :rules="[requiredRule]" />
          <q-input v-model="form.password" outlined dense label="Senha" type="password" autocomplete="current-password" class="q-mt-sm" :rules="[requiredRule]" />

          <q-btn unelevated no-caps class="full-width q-mt-md customer-login__button" icon="mdi-briefcase-outline" label="Entrar no portal" type="submit" :loading="loading" />
          <q-btn flat no-caps class="full-width customer-login__forgot q-mt-md" icon="mdi-lock-reset" label="Esqueci minha senha" type="button" @click="forgotOpen = true" />
          <q-btn flat no-caps class="full-width q-mt-sm customer-login__back" icon="mdi-arrow-left" label="Voltar para a AitoSoftwares" type="button" @click="$router.push('/')" />
        </q-form>
      </q-page>
    </q-page-container>
    <LoginMfaDialog v-model="mfaOpen" :challenge="mfaChallenge" @verified="completeLogin" />
    <PasswordResetDialog v-model="forgotOpen" audience="customer" :initial-email="form.identifier.includes('@') ? form.identifier : ''" @completed="handlePasswordResetCompleted" />
  </q-layout>
</template>

<script>
import { api } from 'boot/axios'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'
import LoginMfaDialog from 'components/LoginMfaDialog.vue'

export default {
  name: 'CustomerLoginPage',
  components: { PasswordResetDialog, LoginMfaDialog },
  data () {
    return {
      loading: false,
      mfaOpen:false,
      mfaChallenge:null,
      forgotOpen: false,
      form: { identifier: '', password: '' }
    }
  },
  methods: {
    requiredRule (value) {
      return Boolean(String(value || '').trim()) || 'Preencha este campo.'
    },
    completeLogin(data) {
        ;['aito_admin_token', 'aito_admin_user', 'aito_user_token', 'aito_user', 'aito_seller_token', 'aito_seller_user'].forEach((key) => localStorage.removeItem(key))
        localStorage.setItem('aito_user_token', data.token)
        localStorage.setItem('aito_user', JSON.stringify({ ...data.user, role: 'customer' }))
        this.$q.notify({ type: 'positive', message: 'Acesso do cliente confirmado.' })
        this.$router.push('/customer')
    },
    async login () {
      this.loading = true
      try {
        const { data } = await api.post('/auth/customer/login', this.form)
        if(data.requiresMfa){this.mfaChallenge=data;this.mfaOpen=true;return}
        this.completeLogin(data)
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel entrar no portal.' })
      } finally {
        this.loading = false
      }
    },
    handlePasswordResetCompleted ({ email }) {
      this.form.identifier = email
      this.form.password = ''
    }
  }
}
</script>

<style scoped>
.customer-login { color: #effffb; background: #03090b; }
.customer-login__page { min-height: 100vh; padding: 1rem; background: radial-gradient(circle at 75% 12%, rgba(19,188,157,.2), transparent 26rem), #03090b; }
.customer-login__panel { width: min(440px, 100%); padding: clamp(1.4rem, 5vw, 2.2rem); border: 1px solid rgba(19,188,157,.34); border-radius: .9rem; background: rgba(4,24,25,.88); box-shadow: 0 28px 80px rgba(0,0,0,.34); }
.customer-login__brand { display: flex; align-items: center; gap: .7rem; margin-bottom: 1.2rem; }
.customer-login__brand .text-h6 { color: #effffb; }
.customer-login__brand .text-caption { color: rgba(229,255,250,.58); }
.customer-login__intro { margin: 0 0 1.2rem; color: rgba(229,255,250,.68); font-size: .8rem; line-height: 1.55; }
.customer-login__panel :deep(.q-field__control) { color: #effffb; background: rgba(7,40,40,.7); }
.customer-login__panel :deep(.q-field__native), .customer-login__panel :deep(.q-field__label) { color: rgba(239,255,251,.82); }
.customer-login__button { color: #03110f; background: linear-gradient(135deg, #8fffee, #13bc9d); font-weight: 800; }
.customer-login__forgot { color: #8fffee; font-size: .75rem; }
.customer-login__back { color: #8fffee; }
</style>
