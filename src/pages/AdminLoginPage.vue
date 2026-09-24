<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="login-page row items-center justify-center">
        <q-form class="login-panel" @submit="login">
          <div class="login-brand">
            <q-img src="/favicon.png" width="58px" height="38px" fit="contain" />
            <div>
              <div class="text-h6 text-weight-bold">Aito Admin</div>
              <div class="text-caption text-grey-7">Gestão e atendimento AitoSoftwares</div>
            </div>
          </div>

          <q-input v-model="form.email" outlined dense label="Email admin" type="email" autocomplete="username" />
          <q-input v-model="form.password" outlined dense label="Senha" type="password" autocomplete="current-password" class="q-mt-sm" />

          <q-btn unelevated no-caps class="full-width q-mt-md login-btn" icon="mdi-login" label="Entrar" type="submit" :loading="loading" />
          <q-btn flat no-caps class="full-width q-mt-sm login-home-btn" icon="mdi-home-outline" label="Inicio" type="button" @click="$router.push('/')" />
        </q-form>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import { api } from 'boot/axios'

export default {
  name: 'AdminLoginPage',
  data () {
    return {
      loading: false,
      form: {
        email: '',
        password: ''
      }
    }
  },
  methods: {
    async login () {
      this.loading = true
      try {
        const { data } = await api.post('/admin/auth/login', this.form)
        localStorage.removeItem('aito_user_token')
        localStorage.removeItem('aito_user')
        localStorage.removeItem('aito_seller_token')
        localStorage.removeItem('aito_seller_user')
        localStorage.setItem('aito_admin_token', data.token)
        localStorage.setItem('aito_admin_user', JSON.stringify({ ...data.user, role: 'admin' }))
        this.$router.push('/admin')
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel entrar.' })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  background: #000;
  color: #effffb;
  isolation: isolate;
}

.login-page::before {
  position: absolute;
  inset: 0;
  z-index: -2;
  content: '';
  background: radial-gradient(circle at 50% 42%, rgba(19,188,157,.18), transparent 25rem), linear-gradient(180deg,#000 0%,#020706 100%);
}

.login-page::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  opacity: .18;
  background: linear-gradient(rgba(19,188,157,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(19,188,157,.11) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, #000 0 36%, transparent 70%);
}

.login-panel {
  width: min(420px, calc(100vw - 32px));
  padding: 28px;
  background: rgba(4,24,25,.86);
  border: 1px solid rgba(19,188,157,.34);
  border-radius: 8px;
  box-shadow: 0 18px 55px rgba(0,0,0,.35);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.login-btn {
  background: linear-gradient(135deg,#8fffee,#13bc9d);
  color: #03110f;
  border-radius: 8px;
  font-weight: 800;
}

.login-panel :deep(.q-field__control) { color: #effffb; background: rgba(7,40,40,.74); }
.login-panel :deep(.q-field__native), .login-panel :deep(.q-field__label) { color: rgba(239,255,251,.8); }
.login-home-btn { color: #8fffee; }
.login-brand .text-caption { color: rgba(229,255,250,.58) !important; }
.login-brand .text-h6 { color: #effffb; }
</style>
