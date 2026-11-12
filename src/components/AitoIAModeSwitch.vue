<script setup>
import { ref } from 'vue'

defineProps({ studio: Boolean, busy: Boolean })
const emit = defineEmits(['chat-video'])
const open = ref(false)
</script>

<template>
  <nav class="aito-mode" aria-label="Ferramentas AitoIA">
    <router-link v-if="studio && !busy" :to="{ name: 'aito-ia' }"><q-icon name="mdi-message-text-outline" /> Chat</router-link>
    <span v-else :class="{ 'is-current': !studio }" :aria-current="!studio ? 'page' : undefined"><q-icon name="mdi-message-text-outline" /> Chat</span>
    <span v-if="studio" class="is-current" aria-current="page"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</span>
    <button v-else type="button" :disabled="busy" @click="open = true"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</button>
  </nav>
  <q-dialog v-model="open">
    <q-card dark class="aito-ai-theme aito-mode-dialog">
      <header><q-icon name="mdi-movie-open-play-outline" size="23px" /><h2>Como você quer criar seu vídeo?</h2></header>
      <div class="aito-mode-dialog__actions">
        <button v-close-popup type="button" @click="emit('chat-video')"><strong>Gerar no chat com Higgsfield</strong><span>Descreva o clipe ou adicione um vídeo-base e imagens de referência. Escolha o modelo, consulte o preço e confirme a geração com AitoTokens.</span></button>
        <router-link v-close-popup :to="{ name: 'aito-ia-video-studio' }"><strong>Abrir o Estúdio de vídeo</strong><span>Monte cenas na sequência, combine clipes e locução e exporte o vídeo completo.</span></router-link>
      </div>
      <button v-close-popup class="aito-mode-dialog__close" type="button">Voltar</button>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.aito-mode { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--aito-ai-line); border-radius: 11px; }
.aito-mode :is(a, span, button) { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 5px 8px; border: 0; border-radius: 7px; color: var(--aito-ai-muted); background: transparent; white-space: nowrap; font: inherit; font-size: .79rem; font-weight: 700; text-decoration: none; }
.aito-mode :is(a, button):hover, .aito-mode .is-current { background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.aito-mode button { cursor: pointer; }
.aito-mode button:disabled { opacity: .55; cursor: default; }
.aito-mode :deep(.q-icon) { font-size: 17px; }
.aito-mode-dialog { width: min(490px, 100%); padding: 18px; border: 1px solid var(--aito-ai-line); border-radius: 15px; background: var(--aito-ai-surface); color: var(--aito-ai-text); }
.aito-mode-dialog header { display: flex; align-items: center; gap: 8px; color: var(--aito-ai-accent); }
.aito-mode-dialog h2 { margin: 0; color: var(--aito-ai-text); font-size: 1.12rem; font-weight: 750; line-height: 1.3; }
.aito-mode-dialog__actions { display: grid; gap: 8px; margin: 14px 0; }
.aito-mode-dialog__actions :is(button, a) { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--aito-ai-line); border-radius: 10px; color: var(--aito-ai-text); background: var(--aito-ai-panel); text-decoration: none; text-align: left; font: inherit; cursor: pointer; }
.aito-mode-dialog__actions :is(button, a):hover { border-color: var(--aito-ai-accent); }
.aito-mode-dialog__actions span { color: var(--aito-ai-muted); font-size: .83rem; }
.aito-mode-dialog__close { padding: 6px; border: 0; color: var(--aito-ai-muted); background: transparent; cursor: pointer; }
@media (max-width: 520px) { .aito-mode :is(a, span, button) { gap: 4px; padding-inline: 5px; font-size: .69rem; } .aito-mode :deep(.q-icon) { font-size: 14px; } }
</style>
