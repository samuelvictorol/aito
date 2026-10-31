<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { browserPushSupport, browserPushIsEnabled, enableBrowserPush, disableBrowserPush, startAdminPush } from '../services/browser-push.js'
import { errorMessage } from '../services/http.js'
import { playAppSound } from '../services/sounds.js'

const support = browserPushSupport()
const enabled = ref(false)
const expanded = ref(false)
const busy = ref(false)
const error = ref('')
function onState(event) { enabled.value = event.detail.enabled === true }
onMounted(async () => {
  window.addEventListener('notify:browser-push-state', onState)
  enabled.value = await browserPushIsEnabled().catch(() => false)
})
onBeforeUnmount(() => window.removeEventListener('notify:browser-push-state', onState))
async function activate() {
  error.value = ''
  busy.value = true
  try {
    void startAdminPush({ restore: false })
    enabled.value = await enableBrowserPush({ askPermission: true })
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
async function deactivate() {
  busy.value = true
  try { await disableBrowserPush({ forget: true }); enabled.value = false }
  catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
</script>

<template>
  <q-card flat class="glass-card q-mb-lg browser-alerts" aria-label="Notificações do navegador">
    <q-expansion-item v-model="expanded" expand-separator>
      <template #header>
        <q-item-section avatar><q-icon name="notifications_active" size="28px" color="primary" /></q-item-section>
        <q-item-section><h2 class="text-h6 q-my-none">Alertas de novas mensagens</h2><q-item-label caption>WhatsApp Cloud e Web, mesmo em outras telas do painel.</q-item-label><div class="q-mt-xs"><q-badge :color="enabled ? 'positive' : 'grey-7'" :label="enabled ? 'Ativados neste dispositivo' : 'Desativados neste dispositivo'" /></div></q-item-section>
      </template>
    <div class="browser-alerts__body">
    <div class="browser-alerts__examples"><span><strong>🔵 Jorge</strong><br>beleza! recebi sua notificação</span><span><strong>🟢 Maria</strong><br>enviou uma imagem</span></div>
    <p class="text-muted q-mt-sm">Receba uma prévia no celular ou computador. No computador, cada canal tem seu próprio som enquanto o painel administrativo estiver aberto, após sua primeira interação.</p>
    <q-banner v-if="support.message" rounded class="bg-teal-1 text-dark q-mb-md">{{ support.message }}</q-banner>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ error }}</q-banner>
    <div class="browser-alerts__actions">
      <q-btn v-if="!enabled" color="primary" icon="notifications" label="Ativar notificações neste dispositivo" no-caps :disable="!support.supported" :loading="busy" @click="activate" />
      <q-btn v-else outline color="primary" icon="notifications_off" label="Desativar neste dispositivo" no-caps :loading="busy" @click="deactivate" />
      <q-btn flat color="primary" icon="volume_up" label="Testar som Cloud" no-caps @click="playAppSound('whatsapp_cloud')" />
      <q-btn flat color="primary" icon="volume_up" label="Testar som Web" no-caps @click="playAppSound('whatsapp_web')" />
    </div>
    <div class="text-caption text-muted q-mt-sm">Exclusivo para administradores. Ao sair da conta ou abrir uma página pública/de usuário neste navegador, os alertas são interrompidos. A entrega também depende das permissões e dos ajustes de foco do dispositivo.</div>
    </div>
    </q-expansion-item>
  </q-card>
</template>

<style scoped>
.browser-alerts { overflow: hidden; }
.browser-alerts :deep(.q-expansion-item__container > .q-item) { padding: 16px 20px; }
.browser-alerts__body { padding: 0 20px 20px; }
.browser-alerts__examples { display: grid; gap: 8px; margin-top: 18px; }
.browser-alerts__examples span { border-radius: 12px; padding: 10px 14px; background: #effaf7; overflow-wrap: anywhere; }
.browser-alerts__actions { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 480px) { .browser-alerts__actions { display: grid; } .browser-alerts__actions :deep(.q-btn__content) { white-space: normal; } }
</style>
