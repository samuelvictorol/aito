<script setup>
import { useQuasar } from 'quasar'
const $q = useQuasar()
defineProps({ collapsed: Boolean })
defineEmits(['toggle'])
</script>
<template>
  <q-btn data-privacy-public flat round dense :icon="collapsed || $q.screen.width <= 850 ? 'view_sidebar' : 'fullscreen'" :aria-expanded="!collapsed && $q.screen.width > 850" :aria-label="collapsed || $q.screen.width <= 850 ? 'Mostrar lista de conversas' : 'Recolher lista de conversas'" @click="$emit('toggle')">
    <q-tooltip>{{ collapsed ? 'Mostrar conversas' : 'Focar nesta conversa' }}</q-tooltip>
  </q-btn>
</template>
