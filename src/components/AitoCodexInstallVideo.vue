<script setup>
import LandingVideoMonitor from './landing3d/LandingVideoMonitor.vue'
</script>

<template>
  <LandingVideoMonitor
    class="codex-tutorial"
    video-slot="codex-installation"
    :video="null"
    title="Passo a passo para instalar o plugin AitoIA no Codex"
    eyebrow="GUIA DE INSTALAÇÃO"
    headline="Instale o AitoIA no Codex"
    description="Siga o passo a passo no Windows."
  />
</template>

<style scoped>
.codex-tutorial :deep(.video-monitor__frame) { padding: 6px 6px 0; border-radius: 12px; }
.codex-tutorial :deep(.video-monitor__screen) { aspect-ratio: 16 / 9; }
.codex-tutorial :deep(.video-monitor__placeholder) { gap: 6px; padding: 10px; }
.codex-tutorial :deep(.video-monitor__placeholder img) { width: clamp(27px, 5vw, 44px); height: clamp(27px, 5vw, 44px); }
.codex-tutorial :deep(.video-monitor__chin) { height: 18px; }
.codex-tutorial :deep(.video-monitor__stand) { height: 17px; }
.codex-tutorial :deep(.video-monitor__base) { height: 5px; }
</style>
