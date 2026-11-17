<script setup>
import { useAitoIATheme } from 'src/composables/useAitoIATheme'

const { theme, setTheme } = useAitoIATheme()
</script>

<template>
  <div class="aito-theme-toggle">
    <span class="aito-theme-toggle__label"><q-icon name="mdi-palette-outline" size="17px" /> Tema</span>
    <q-btn-toggle :model-value="theme" @update:model-value="setTheme" unelevated no-caps aria-label="Tema da interface"
      :options="[{ value: 'light', label: 'Claro', icon: 'mdi-white-balance-sunny' }, { value: 'dark', label: 'Escuro', icon: 'mdi-moon-waning-crescent' }]" />
  </div>
</template>

<style scoped>
.aito-theme-toggle { display: grid; gap: 7px; min-width: 0; color: var(--aito-ai-text); }
.aito-theme-toggle__label { display: flex; align-items: center; gap: 7px; font-size: .79rem; font-weight: 650; }
.aito-theme-toggle__label .q-icon { color: var(--aito-ai-accent); }
.aito-theme-toggle .q-btn-toggle { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 3px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-bg); }
.aito-theme-toggle :deep(.q-btn) { min-width: 0; min-height: 35px; padding: 4px 6px; color: var(--aito-ai-muted); border-radius: 7px !important; font-size: .77rem; }
.aito-theme-toggle :deep(.q-btn[aria-pressed='true']) { color: var(--aito-ai-accent) !important; background: var(--aito-ai-accent-soft) !important; font-weight: 750; }
.aito-theme-toggle :deep(.q-icon.on-left) { margin-right: 5px; }
</style>
