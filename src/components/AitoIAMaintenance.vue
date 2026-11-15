<script setup>
import { computed, ref } from 'vue'
import { useAitoAvailability } from 'src/composables/useAitoAvailability'
import 'src/css/aitoia-theme.css'

const props = defineProps({ area: String, checking: Boolean, compact: Boolean })
const emit = defineEmits(['retry'])
const { availability, refreshAvailability } = useAitoAvailability()
const retrying = ref(false)
const title = computed(() => ({
  chat: 'Chat em manutenção',
  video: 'Vídeo em manutenção',
  marketing: 'Estúdio de Marketing em manutenção',
  system: 'AitoIA em manutenção',
})[props.area] || 'AitoIA em manutenção')

async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    await refreshAvailability()
    emit('retry')
  } finally { retrying.value = false }
}
</script>

<template>
  <section class="aito-ai-theme aito-maintenance" :class="{ 'aito-maintenance--compact': compact }" aria-label="Disponibilidade da AitoIA">
    <div class="aito-maintenance__panel" role="status">
      <img src="/ia.gif" alt="AitoIA" width="68" height="68" />
      <q-linear-progress v-if="checking" indeterminate rounded color="teal-4" size="4px"
        class="aito-maintenance__progress" aria-label="Verificando disponibilidade" />
      <template v-else>
        <component :is="compact ? 'h2' : 'h1'">{{ title }}</component>
        <p>Desculpe o transtorno. Estamos trazendo novas funcionalidades.</p>
        <div class="aito-maintenance__actions">
          <q-btn no-caps unelevated color="teal-8" label="Tentar novamente" :loading="retrying" @click="retry" />
          <q-btn v-if="!compact && area !== 'chat' && availability?.chat" no-caps outline :to="{ name: 'aito-ia' }" label="Abrir Chat" />
          <q-btn v-if="!compact && area !== 'video' && availability?.video" no-caps outline :to="{ name: 'aito-ia-video-studio' }" label="Abrir Estúdio de Vídeo" />
          <q-btn v-if="!compact" no-caps flat :to="{ name: 'landing-3d' }" label="Quem somos" />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.aito-maintenance { display: grid; min-height: 100vh; min-height: 100dvh; place-items: center; padding: 20px; color: var(--aito-ai-text); background: var(--aito-ai-bg); }
.aito-maintenance--compact { min-height: 0; padding: 0; background: transparent; }
.aito-maintenance__panel { width: min(100%, 520px); padding: clamp(20px, 7vw, 40px); border: 1px solid var(--aito-ai-line); border-radius: 20px; text-align: center; background: var(--aito-ai-panel); }
.aito-maintenance--compact .aito-maintenance__panel { border: 0; background: transparent; }
.aito-maintenance img { object-fit: contain; }
.aito-maintenance__progress { width: min(100%, 160px); margin: 16px auto 0; }
.aito-maintenance :is(h1, h2) { margin: 12px 0; font-size: clamp(1.4rem, 4vw, 2rem); font-weight: 750; line-height: 1.2; }
.aito-maintenance p { margin: 0; color: var(--aito-ai-muted); }
.aito-maintenance__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 22px; }
</style>
