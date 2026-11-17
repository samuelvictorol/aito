<script setup>
import { useAitoIATheme } from 'src/composables/useAitoIATheme'
import { videoModelSpecialty } from 'src/data/aitoiaVideoCatalog'

defineProps({
  modelValue: String,
  models: { type: Array, required: true },
  label: { type: String, default: 'Modelo de vídeo' },
  disable: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const { isDark } = useAitoIATheme()
</script>

<template>
  <q-select class="aito-video-model-select" :model-value="modelValue" :options="models" :label="label"
    option-value="id" emit-value map-options outlined dense :dark="isDark" :disable="disable"
    @update:model-value="emit('update:modelValue', $event)">
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
          <q-item-label v-if="videoModelSpecialty(scope.opt)" caption>{{ videoModelSpecialty(scope.opt) }}</q-item-label>
        </q-item-section>
        <q-tooltip v-if="videoModelSpecialty(scope.opt)" :delay="350">{{ videoModelSpecialty(scope.opt) }}</q-tooltip>
      </q-item>
    </template>
  </q-select>
</template>

<style scoped>
.aito-video-model-select { min-width: 0; align-self: start; }
.aito-video-model-select :deep(.q-field__control) { background: var(--aito-ai-bg); border-radius: 9px; }
</style>
