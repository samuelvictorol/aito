<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const emit = defineEmits(['claimed'])
const $q = useQuasar()
const offer = ref(null)
const dialog = ref(false)
const saving = ref(false)
const error = ref('')
const endpoint = '/products/aitonotify/trial'
const options = () => ({ headers: { Authorization: 'Bearer ' + (localStorage.getItem('aito_user_token') || '') } })

onMounted(async () => {
  try { offer.value = (await api.get(endpoint, options())).data.data }
  catch { /* The product library remains available if the trial cannot load. */ }
})

async function claim() {
  if (saving.value || offer.value?.state !== 'available') return
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.post(endpoint, { acceptedTermsVersion: offer.value.terms.version }, options())
    if (data.data?.state !== 'claimed') throw new Error('Resgate não confirmado')
    dialog.value = false
    offer.value = data.data
    $q.notify({ type: 'positive', message: 'Seus 7 dias começaram. Baixe o instalador e copie a chave na sua biblioteca.' })
    emit('claimed')
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível resgatar agora. Tente novamente.'
  } finally { saving.value = false }
}
</script>

<template>
  <section v-if="offer?.state === 'available'" class="desktop-trial" aria-labelledby="desktop-trial-title">
    <div class="desktop-trial__icon"><q-icon name="mdi-gift-outline" size="30px" /></div>
    <div class="desktop-trial__body">
      <span>TESTE DESKTOP</span>
      <h2 id="desktop-trial-title">Você ganhou 7 dias grátis do Kit Desktop</h2>
      <p>Resgate o acesso completo para Windows. O prazo começa no resgate, sem cartão e sem cobrança automática.</p>
    </div>
    <q-btn unelevated no-caps color="amber-4" text-color="dark" icon="mdi-arrow-right" label="Resgatar meus 7 dias" @click="error = ''; dialog = true" />
    <q-dialog v-model="dialog" :persistent="saving">
      <q-card dark class="desktop-trial__dialog">
        <q-card-section>
          <h2>{{ offer.terms.title }}</h2>
          <p>{{ offer.terms.content }}</p>
          <q-banner v-if="error" dense rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Voltar" :disable="saving" v-close-popup />
          <q-btn unelevated no-caps color="amber-4" text-color="dark" label="Aceitar e iniciar teste" :loading="saving" @click="claim" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.desktop-trial{display:flex;align-items:center;gap:16px;margin-bottom:22px;padding:clamp(16px,3vw,26px);border:1px solid #c4a961;border-radius:18px;background:linear-gradient(125deg,#332917,#102b26);color:#fff7df}
.desktop-trial__body{flex:1;min-width:0}.desktop-trial__body span{font-size:.7rem;font-weight:800;letter-spacing:.12em;color:#ffde96}.desktop-trial h2,.desktop-trial__dialog h2{margin:4px 0 8px;font-size:clamp(1.16rem,2.5vw,1.6rem);line-height:1.25}.desktop-trial p,.desktop-trial__dialog p{margin:0;max-width:none;color:#f0e6d1;line-height:1.65}.desktop-trial__icon{display:grid;place-items:center;width:53px;height:53px;flex:none;border-radius:14px;color:#ffe2a2;background:#ffdc9025}
.desktop-trial__dialog{width:min(560px,calc(100vw - 28px));background:#142c27}.desktop-trial__dialog .q-banner{margin-top:12px}
@media(max-width:650px){.desktop-trial{flex-wrap:wrap}.desktop-trial>.q-btn{width:100%}}
</style>
