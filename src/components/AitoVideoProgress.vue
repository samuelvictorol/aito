<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: String, required: true } })
const stages = {
  submitting: { percent: 0, label: 'Enviando pedido' },
  queued: { percent: 33, label: 'Na fila da Higgsfield' },
  in_progress: { percent: 67, label: 'Gerando vídeo' },
  completed: { percent: 100, label: 'Geração concluída' },
}
const current = computed(() => stages[props.stage] || stages.submitting)
</script>

<template>
  <div class="video-progress">
    <div class="video-progress__status" role="status">
      <span>{{ current.label }}</span><strong>{{ current.percent }}% do fluxo</strong>
    </div>
    <q-linear-progress :value="current.percent / 100" color="teal-4" track-color="blue-grey-9" rounded
      size="6px" aria-label="Progresso por etapas da geração de vídeo" />
  </div>
</template>

<style scoped>
.video-progress { width: min(100%, 26rem); display: grid; gap: 7px; }
.video-progress__status { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; font-size: .83rem; }
.video-progress__status strong { color: var(--aito-ai-accent); }
</style>
