<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { AITO_INSTALL_PATH } from 'src/services/aitoInstall'

const open = defineModel({ type: Boolean, required: true })
const props = defineProps({ platform: { type: String, required: true }, nativePrompt: Boolean, installing: Boolean })
const emit = defineEmits(['install'])
const route = useRoute()
const onInstallPage = computed(() => route.path === AITO_INSTALL_PATH)
const canInstall = computed(() => props.platform !== 'ios' && (props.nativePrompt || props.installing))
const deviceIcon = computed(() => ({ ios: 'mdi-apple', android: 'mdi-android', desktop: 'mdi-monitor' })[props.platform])
</script>

<template>
  <q-dialog v-model="open" aria-labelledby="aito-install-title">
    <q-card dark class="install-card">
      <header class="install-card__header">
        <img src="/icons/aitoia-180.png" alt="" width="52" height="52" />
        <q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar instalação" />
      </header>
      <h2 id="aito-install-title">Instale o Aito IA</h2>
      <p>Abra seus chats e estúdios pelo ícone do app.</p>

      <div v-if="!canInstall" class="install-card__guide">
        <q-icon :name="deviceIcon" size="22px" />
        <div>
          <strong>{{ platform === 'ios' ? 'No iPhone ou iPad' : platform === 'android' ? 'No Chrome para Android' : 'No computador' }}</strong>
          <ol v-if="platform === 'ios'">
            <li>Abra o Aito IA no Safari.</li>
            <li>Toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.</li>
            <li>Se aparecer, ative <b>Abrir como App Web</b>. Toque em <b>Adicionar</b>.</li>
          </ol>
          <ol v-else-if="platform === 'android'">
            <li>Abra o Aito IA no Chrome e toque em <b>⋮</b>.</li>
            <li>Toque em <b>Adicionar à tela inicial</b> ou <b>Instalar app</b> e confirme.</li>
          </ol>
          <ol v-else>
            <li>Abra o Aito IA no Chrome ou Edge.</li>
            <li>Use o ícone de instalação na barra de endereço ou procure <b>Instalar página como app</b> no menu do navegador.</li>
          </ol>
        </div>
      </div>

      <q-btn v-if="canInstall" unelevated no-caps class="install-card__action" icon="mdi-download-box-outline"
        label="Instalar Aito IA" :loading="installing" @click="emit('install')" />
      <q-btn v-else-if="!onInstallPage" v-close-popup unelevated no-caps class="install-card__action"
        :to="AITO_INSTALL_PATH" icon="mdi-arrow-right" label="Abrir Aito IA" />
      <q-btn v-else v-close-popup unelevated no-caps class="install-card__action" label="Entendi" />
    </q-card>
  </q-dialog>
</template>

<style scoped>
.install-card { width: min(440px, 100%); padding: clamp(18px, 5vw, 28px); border: 1px solid #519d8f80; border-radius: 20px; background: radial-gradient(ellipse at top left, #1b5249, transparent 68%), #091c1b; color: #effcf8; }
.install-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.install-card__header img { border-radius: 13px; }
.install-card h2 { margin: 16px 0 6px; font-size: clamp(1.45rem, 5vw, 1.9rem); font-weight: 750; line-height: 1.15; }
.install-card p { margin: 0 0 18px; color: #c3dbd4; }
.install-card__guide { display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 14px; margin-bottom: 16px; background: #173a36; border-radius: 12px; }
.install-card__guide > .q-icon { color: #99f1dd; }
.install-card__guide ol { padding-inline-start: 19px; margin: 6px 0 0; color: #d5e9e3; }
.install-card__guide li + li { margin-top: 4px; }
.install-card__action { min-height: 44px; width: 100%; background: #a7efde; color: #102e28; font-weight: 700; }
</style>
