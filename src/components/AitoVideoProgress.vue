<script setup>
import { computed } from 'vue'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'

const props = defineProps({ stage: { type: String, required: true }, percent: Number })
const { isDark } = useAitoIATheme()
const stages = {
  submitting: 'Confirmando envio',
  queued: 'Na fila de geração',
  in_progress: 'Gerando vídeo na Higgsfield',
  uncertain: 'Confirmando a geração com a Higgsfield',
  completed: 'Geração concluída',
}
const label = computed(() => stages[props.stage] || stages.in_progress)
const amount = computed(() => props.stage === 'completed' ? 100 :
  props.stage === 'in_progress' && Number.isFinite(props.percent) ? Math.min(99, Math.max(0, Math.round(props.percent))) : null)
</script>

<template>
  <div class="video-progress">
    <div class="video-progress__status" role="status">
      <span>{{ label }}</span><strong v-if="amount !== null">{{ amount }}%</strong>
    </div>
    <q-linear-progress :indeterminate="amount === null" :value="(amount ?? 0) / 100" :color="isDark ? 'teal-4' : 'teal-8'" :track-color="isDark ? 'blue-grey-9' : 'teal-2'" rounded
      size="6px" aria-label="Progresso da geração de vídeo" />
  </div>
</template>

<style scoped>
.video-progress { width: min(100%, 26rem); display: grid; gap: 7px; }
.video-progress__status { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; font-size: .83rem; }
.video-progress__status strong { color: var(--aito-ai-accent); }
</style>
