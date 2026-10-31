<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card class="generated-credentials-card">
      <q-card-section class="generated-credentials-card__head">
        <div><span class="generated-credentials-card__eyebrow">Acesso do cliente</span><h3>Credenciais geradas</h3></div>
        <q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="isOpen = false" />
      </q-card-section>
      <q-card-section class="generated-credentials-card__body">
        <p>Guarde ou compartilhe estas informações com o cliente. A senha só será exibida novamente se uma nova senha for gerada.</p>
        <q-banner v-if="!customer?.email" rounded class="bg-orange-1 text-orange-10 q-mb-md">Este cadastro contém apenas telefone. Cadastre um e-mail no perfil do cliente para habilitar o login com validação multifator.</q-banner><div class="generated-credentials-card__welcome">Seja Bem Vindo(a) à AitoSoftwares!</div>
        <div class="generated-credentials-card__field"><span>Cliente</span><strong>{{ customer?.name || '-' }}</strong></div>
        <div class="generated-credentials-card__field"><span>E-mail</span><strong>{{ customer?.email || '-' }}</strong></div>
        <div class="generated-credentials-card__field"><span>Senha temporária</span><code>{{ password || '-' }}</code></div>
        <div class="generated-credentials-card__field"><span>Login</span><a :href="loginUrl" target="_blank" rel="noopener noreferrer">{{ loginUrl }}</a></div>
        <div class="generated-credentials-card__actions">
          <q-btn unelevated no-caps class="generated-credentials-card__primary" icon="mdi-share-variant" label="Compartilhar credenciais" @click="share" />
          <q-btn flat no-caps class="generated-credentials-card__secondary" icon="mdi-content-copy" label="Copiar texto" @click="copy" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  customer: { type: Object, default: () => ({}) },
  password: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const $q = useQuasar()
const isOpen = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })
const loginUrl = computed(() => `${window.location.origin}/customer/login`)
const shareText = computed(() => `Seja Bem Vindo(a) à AitoSoftwares!\n\nAqui estão suas credenciais:\nE-mail: ${props.customer?.email || '-'}\nSenha: ${props.password || '-'}\n\nFaça login em: ${loginUrl.value}`)

async function copy() {
  try {
    await navigator.clipboard.writeText(shareText.value)
    $q.notify({ type: 'positive', message: 'Credenciais copiadas.' })
  } catch (error) {
    $q.notify({ type: 'warning', message: 'Nao foi possivel copiar automaticamente.' })
  }
}

async function share() {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Acesso AitoSoftwares', text: shareText.value })
      return
    }
    await copy()
  } catch (error) {
    if (error?.name !== 'AbortError') $q.notify({ type: 'warning', message: 'Nao foi possivel compartilhar agora.' })
  }
}
</script>

<style scoped>
.generated-credentials-card { width: min(94vw, 520px); color: #effffb; border: 1px solid rgba(19,188,157,.35); border-radius: 16px; background: #061819; box-shadow: 0 28px 90px rgba(0,0,0,.48); }
.generated-credentials-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; border-bottom:1px solid rgba(143,255,238,.14); }
.generated-credentials-card__eyebrow { color:#8fffee; font-size:.64rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
.generated-credentials-card h3 { margin:.35rem 0 0; font-size:1.2rem; }
.generated-credentials-card__body p { margin:0 0 1rem; color:rgba(229,255,250,.68); font-size:.78rem; line-height:1.5; }
.generated-credentials-card__welcome { padding:.8rem; border:1px solid rgba(19,188,157,.22); border-radius:.65rem; color:#8fffee; background:rgba(19,188,157,.08); font-weight:800; }
.generated-credentials-card__field { display:grid; gap:.25rem; padding:.8rem 0; border-bottom:1px solid rgba(143,255,238,.09); }
.generated-credentials-card__field span { color:rgba(229,255,250,.5); font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; }
.generated-credentials-card__field strong, .generated-credentials-card__field code, .generated-credentials-card__field a { overflow-wrap:anywhere; color:#effffb; font-size:.82rem; }
.generated-credentials-card__field code { color:#8fffee; }
.generated-credentials-card__field a { color:#8fffee; text-decoration:none; }
.generated-credentials-card__actions { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1.2rem; }
.generated-credentials-card__primary { color:#03110f; background:linear-gradient(135deg,#8fffee,#13bc9d); font-weight:800; }
.generated-credentials-card__secondary { color:#8fffee; }
@media (max-width:600px) { .generated-credentials-card__actions > * { width:100%; } }
</style>
