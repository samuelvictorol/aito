<script setup>
defineProps({
  mode: { type: String, default: 'chat' },
  busy: Boolean,
})
</script>

<template>
  <nav class="aito-mode" aria-label="Ferramentas AitoIA">
    <router-link v-if="mode !== 'chat' && !busy" :to="{ name: 'aito-ia' }"><q-icon name="mdi-message-text-outline" /> Chat</router-link>
    <span v-else :class="{ 'is-current': mode === 'chat' }" :aria-current="mode === 'chat' ? 'page' : undefined"><q-icon name="mdi-message-text-outline" /> Chat</span>
    <span v-if="mode === 'video'" class="is-current" aria-current="page"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</span>
    <router-link v-else-if="!busy" :to="{ name: 'aito-ia-video-studio' }"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</router-link>
    <span v-else aria-disabled="true"><q-icon name="mdi-movie-open-play-outline" /> Estúdio de vídeo</span>
    <router-link v-if="mode !== 'marketing' && !busy" :to="{ name: 'aito-ia-marketing-studio' }"><q-icon name="mdi-image-multiple-outline" /> Estúdio de Marketing</router-link>
    <span v-else :class="{ 'is-current': mode === 'marketing' }" :aria-current="mode === 'marketing' ? 'page' : undefined"><q-icon name="mdi-image-multiple-outline" /> Estúdio de Marketing</span>
  </nav>
</template>

<style scoped>
.aito-mode { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--aito-ai-line); border-radius: 11px; }
.aito-mode :is(a, span) { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 5px 8px; border: 0; border-radius: 7px; color: var(--aito-ai-muted); background: transparent; white-space: nowrap; font: inherit; font-size: .79rem; font-weight: 700; text-decoration: none; }
.aito-mode a:hover, .aito-mode .is-current { background: var(--aito-ai-accent-soft); color: var(--aito-ai-accent); }
.aito-mode :deep(.q-icon) { font-size: 17px; }
@media (max-width: 520px) { .aito-mode :is(a, span) { gap: 4px; padding-inline: 4px; font-size: .69rem; } .aito-mode :deep(.q-icon) { font-size: 14px; } }
</style>
