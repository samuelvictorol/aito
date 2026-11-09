<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import AssistantSettingsDialog from './AssistantSettingsDialog.vue'
import { ASSISTANT_CONFIG_EVENT, assistantApi } from '../services/admin-assistant.js'
import { errorMessage } from '../services/http.js'

const router = useRouter()
const $q = useQuasar()
const configured = ref(null)
const settings = ref(false)
const opening = ref(false)
const title = computed(() => configured.value === false ? 'Configurar Agente de IA' : 'Abrir Agente de IA')
let revision = 0
function onConfigurationChanged({ detail }) {
  revision++
  configured.value = Boolean(detail.configured)
}
async function loadStatus() {
  const request = revision
  const value = await assistantApi.config()
  if (request === revision) configured.value = Boolean(value.configured)
}
async function openAgent() {
  opening.value = true
  try {
    if (configured.value === null) await loadStatus()
    if (configured.value) await router.push({ name: 'ai-agent' })
    else settings.value = true
  } catch (cause) {
    $q.notify({ type: 'negative', message: errorMessage(cause, 'Não foi possível consultar o agente.') })
  } finally { opening.value = false }
}
function onSaved(value) {
  if (value.configured) void router.push({ name: 'ai-agent' })
}
onMounted(() => {
  window.addEventListener(ASSISTANT_CONFIG_EVENT, onConfigurationChanged)
  void loadStatus().catch(() => {})
})
onBeforeUnmount(() => window.removeEventListener(ASSISTANT_CONFIG_EVENT, onConfigurationChanged))
</script>

<template>
  <q-btn
    dense round unelevated icon="auto_awesome"
    class="agent-entry" :class="{ 'agent-entry--ready': configured, 'agent-entry--pending': configured === false }"
    :aria-label="title" :loading="opening" @click="openAgent"
  >
    <q-tooltip>{{ title }}</q-tooltip>
  </q-btn>
  <AssistantSettingsDialog v-model="settings" @saved="onSaved" />
</template>

<style scoped>
.agent-entry{margin-inline:4px;min-width:36px;min-height:36px;color:#30564d;background:#e9f3f0}
.agent-entry--pending{color:#523b09;background:linear-gradient(145deg,#fff1b3,#efb83e);box-shadow:0 3px 12px #d6a42c35}
.agent-entry--ready{color:#103f35;background:linear-gradient(145deg,#b2f5d9,#4cceaa);box-shadow:0 3px 12px #26a48030}
</style>
