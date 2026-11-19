<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import { adminConfirmationHeaders } from 'src/services/adminConfirmation'
import AdminPasswordDialog from './AdminPasswordDialog.vue'

const props = defineProps({ enabled: Boolean })
const endpoint = '/aitoia/admin/voice-previews'
const state = shallowRef(null)
const busy = ref(false)
const message = ref('')
const passwordOpen = ref(false)
const controller = new AbortController()
const $q = useQuasar()
const estimated = computed(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD',
  maximumFractionDigits: 4 }).format(state.value?.maximumRemainingProviderUsd || 0))

async function load() {
  try {
    const { data } = await api.get(endpoint, { ...financeHeaders(true), signal: controller.signal })
    state.value = data.data
  } catch (error) {
    if (!controller.signal.aborted) message.value = error.response?.data?.message || 'Não foi possível consultar as amostras.'
  }
}

function start() {
  if (busy.value || !props.enabled || !state.value?.remaining) return
  message.value = ''
  passwordOpen.value = true
}

async function apply(confirmation) {
  if (!confirmation?.confirmationToken || busy.value) return
  busy.value = true
  const config = { ...adminConfirmationHeaders(confirmation), signal: controller.signal }
  try {
    for (let batch = 0; batch < 9; batch++) {
      const { data } = await api.post(endpoint, {}, config)
      state.value = data.data
      if (!state.value?.remaining || !state.value?.generated) break
    }
    if (state.value?.available) $q.notify({ type: 'positive', message: `${state.value.available} amostras disponíveis no estúdio.` })
    if (state.value?.remaining) message.value = 'Ainda existem amostras para preparar. Retome a preparação quando precisar.'
  } catch (error) {
    if (!controller.signal.aborted) {
      message.value = error.response?.data?.message || 'Não foi possível concluir o lote de amostras.'
      await load()
    }
  } finally { busy.value = false }
}

onMounted(load)
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <section class="voice-previews" aria-label="Amostras de locução">
    <q-icon name="mdi-waveform" color="teal-3" size="23px" />
    <div>
      <strong>Amostras de locução</strong>
      <p v-if="state">{{ state.available }} de {{ state.total }} disponíveis. O cliente pode ouvir as amostras sem usar AitoTokens.</p>
      <p v-if="state?.remaining">Gerar as restantes usa até {{ estimated }} da reserva OpenAI da plataforma.</p>
      <p v-if="state?.reserved" role="status">{{ state.reserved }} em geração ou aguardando verificação do provedor.</p>
      <p v-if="message" role="status">{{ message }}</p>
    </div>
    <q-btn v-if="state?.remaining" flat dense no-caps color="teal-3" label="Preparar amostras"
      :disable="!enabled || passwordOpen" :loading="busy" @click="start" />
    <AdminPasswordDialog v-model="passwordOpen" @verified="apply" />
  </section>
</template>

<style scoped>
.voice-previews { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 13px; border: 1px solid #56887866; border-radius: 12px; }
.voice-previews p { margin: 3px 0 0; color: #b1ccc5; overflow-wrap: anywhere; }
@media (max-width: 600px) { .voice-previews { grid-template-columns: auto minmax(0, 1fr); } .voice-previews :deep(.q-btn) { grid-column: 2; justify-self: start; } }
</style>
