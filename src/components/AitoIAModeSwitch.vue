<script setup>
import { ref } from 'vue'

defineProps({
  mode: { type: String, default: 'chat' },
  busy: Boolean,
})
const emit = defineEmits(['chat-video'])
const open = ref(false)
</script>

<template>
  <nav class="aito-mode" aria-label="Ferramentas AitoIA">
    <router-link v-if="mode !== 'chat' && !busy" :to="{ name: 'aito-ia' }"><q-icon name="mdi-message-text-outline" /> Chat</router-link>
    <span v-else :class="{ 'is-current': mode === 'chat' }" :aria-current="mode === 'chat' ? 'page' : undefined"><q-icon name="mdi-message-text-outline" /> Chat</span>
    <span v-if="mode === 'video'" class="is-current" aria-current="page"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</span>
    <button v-else-if="mode === 'chat'" type="button" :disabled="busy" @click="open = true"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</button>
    <router-link v-else-if="!busy" :to="{ name: 'aito-ia-video-studio' }"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</router-link>
    <span v-else aria-disabled="true"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</span>
    <router-link v-if="mode !== 'marketing' && !busy" :to="{ name: 'aito-ia-marketing-studio' }"><q-icon name="mdi-image-multiple-outline" /> Estúdio de Marketing</router-link>
    <span v-else :class="{ 'is-current': mode === 'marketing' }" :aria-current="mode === 'marketing' ? 'page' : undefined"><q-icon name="mdi-image-multiple-outline" /> Estúdio de Marketing</span>
  </nav>
  <q-dialog v-model="open">
    <q-card dark class="aito-ai-theme aito-mode-dialog" aria-labelledby="aito-video-mode-title">
      <header>
        <q-icon name="mdi-movie-open-play-outline" size="25px" />
        <h2 id="aito-video-mode-title">Como você quer criar seu vídeo?</h2>
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar" />
      </header>
      <div class="aito-mode-dialog__actions">
        <button v-close-popup type="button" @click="emit('chat-video')">
          <span class="aito-mode-dialog__option-icon" aria-hidden="true"><q-icon name="mdi-message-text-outline" size="23px" /></span>
          <span><strong>Gerar no chat</strong><small>Descreva o clipe, anexe referências e confirme o preço da Higgsfield.</small></span>
          <q-icon class="aito-mode-dialog__arrow" name="mdi-chevron-right" size="20px" aria-hidden="true" />
        </button>
        <router-link v-close-popup :to="{ name: 'aito-ia-video-studio' }">
          <span class="aito-mode-dialog__option-icon aito-mode-dialog__option-icon--studio" aria-hidden="true"><q-icon name="mdi-movie-open-play-outline" size="23px" /></span>
          <span><strong>Abrir Estúdio de vídeo</strong><small>Organize cenas, combine clipes e locução e exporte o vídeo completo.</small></span>
          <q-icon class="aito-mode-dialog__arrow" name="mdi-chevron-right" size="20px" aria-hidden="true" />
        </router-link>
      </div>
      <footer><img src="/aitotokens.svg" alt="" width="18" height="18" /> As duas opções usam sua carteira AitoTokens.</footer>
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
.aito-mode-dialog h2 { flex: 1; margin: 0; color: var(--aito-ai-text); font-size: 1.12rem; font-weight: 750; line-height: 1.3; }
.aito-mode-dialog__actions { display: grid; gap: 8px; margin: 14px 0; }
.aito-mode-dialog__actions :is(button, a) { display: grid; grid-template-columns: 40px minmax(0, 1fr) 20px; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--aito-ai-line); border-radius: 10px; color: var(--aito-ai-text); background: var(--aito-ai-panel); text-decoration: none; text-align: left; font: inherit; cursor: pointer; }
.aito-mode-dialog__actions :is(button, a):hover, .aito-mode-dialog__actions :is(button, a):focus-visible { border-color: var(--aito-ai-accent); }
.aito-mode-dialog__actions strong, .aito-mode-dialog__actions small { display: block; }
.aito-mode-dialog__actions small { margin-top: 2px; color: var(--aito-ai-muted); font-size: .82rem; }
.aito-mode-dialog__option-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.aito-mode-dialog__option-icon--studio { background: var(--aito-ai-gold-soft); color: var(--aito-ai-gold); }
.aito-mode-dialog__arrow { color: var(--aito-ai-muted); }
.aito-mode-dialog footer { display: flex; align-items: center; gap: 6px; color: var(--aito-ai-muted); font-size: .8rem; }
@media (max-width: 520px) { .aito-mode :is(a, span, button) { gap: 4px; padding-inline: 4px; font-size: .69rem; } .aito-mode :deep(.q-icon) { font-size: 14px; } }
</style>
