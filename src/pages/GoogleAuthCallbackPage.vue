<template>
  <q-layout view="lHh Lpr lFf" class="google-callback">
    <q-page-container>
      <q-page class="google-callback__page flex flex-center">
        <div class="google-callback__panel" role="status" aria-live="polite">
          <q-spinner-gears color="secondary" size="42px" />
          <strong>Concluindo seu acesso</strong>
          <span>{{ message }}</span>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { takeGoogleReturnPath } from 'src/services/google-login'

const $q = useQuasar(), router = useRouter(), message = ref('Validando sua conta Google…')

onMounted(async () => {
  const params = new URLSearchParams(window.location.hash.slice(1))
  window.history.replaceState(window.history.state, '', '/auth/google/callback')
  const target = takeGoogleReturnPath()
  try {
    if (params.get('session') !== '1') throw new Error(params.get('error') || 'Inicie novamente o acesso com o Google.')
    const { data } = await api.post('/auth/google/session')
    if (!data?.token || !['user', 'customer'].includes(data.user?.role)) throw new Error()
    for (const key of ['aito_admin_token', 'aito_admin_user', 'aito_user_token', 'aito_user', 'aito_affiliate_token', 'aito_affiliate_user', 'aito_seller_token', 'aito_seller_user']) localStorage.removeItem(key)
    localStorage.setItem('aito_user_token', data.token)
    localStorage.setItem('aito_user', JSON.stringify(data.user))
    message.value = 'Acesso confirmado. Redirecionando…'
    await router.replace(target || (data.user.role === 'customer' ? '/customer' : '/app'))
  } catch (error) {
    $q.notify({ type: 'negative', message: params.get('error') || error.response?.data?.message || 'Não foi possível concluir o acesso com o Google.' })
    await router.replace(target === '/produto/acesso' ? target : '/?auth=login')
  }
})
</script>

<style scoped>
.google-callback__page {
  min-height: 100vh;
  color: #effffb;
  background: radial-gradient(circle at 50% 20%, rgba(19, 188, 157, 0.18), transparent 25rem), #03090b;
}

.google-callback__panel {
  display: grid;
  width: min(90vw, 24rem);
  padding: 2rem;
  justify-items: center;
  gap: 0.8rem;
  border: 1px solid rgba(19, 188, 157, 0.3);
  border-radius: 1rem;
  background: rgba(4, 24, 25, 0.78);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
  text-align: center;
}

.google-callback__panel strong { font-size: 1.05rem; }
.google-callback__panel span { color: rgba(230, 255, 250, 0.68); font-size: 0.8rem; }
</style>
