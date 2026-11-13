<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders, purchaseMoney } from 'src/services/purchase-history'

const state = ref(null)
const critical = computed(() => state.value?.severity === 'critical')
const affected = computed(() => state.value?.providers?.filter(provider => provider.severity !== 'normal') || [])
const accountNames = { openai: 'OpenAI', higgsfield: 'Higgsfield' }
let poll
let pending

async function refresh() {
  if (document.hidden || pending || !localStorage.getItem('aito_admin_token')) return
  const controller = new AbortController()
  pending = controller
  try {
    const { data } = await api.get('/admin/push/provider-alerts', { ...financeHeaders(true), timeout: 8000, signal: controller.signal })
    if (!controller.signal.aborted) state.value = data.data
  } catch { /* Preserve the last confirmed balance while reconnecting. */ }
  finally { if (pending === controller) pending = null }
}
onMounted(() => {
  refresh()
  poll = setInterval(refresh, 45000)
  document.addEventListener('visibilitychange', refresh)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  pending?.abort()
  document.removeEventListener('visibilitychange', refresh)
})
</script>

<template>
  <div v-if="affected.length" class="provider-alert-float" :class="{ 'is-critical': critical }">
    <q-btn round unelevated :icon="critical ? 'mdi-alert-octagon-outline' : 'mdi-alert-outline'"
      :aria-label="critical ? 'Ver saldo crítico de provedores' : 'Ver alerta de saldo de provedores'">
      <q-menu dark anchor="top right" self="bottom right" :offset="[0, 8]">
        <q-list class="q-pa-sm">
          <q-item v-for="row in affected" :key="row.provider">
            <q-item-section>
              <q-item-label>{{ accountNames[row.provider] }}</q-item-label>
              <q-item-label caption>{{ purchaseMoney(row.estimatedBalanceUsdCents, 'USD') }} estimados · limite de {{ purchaseMoney(row.alertThresholdUsdCents, 'USD') }}</q-item-label>
              <q-item-label v-if="row.rapidDrop" caption>Queda rápida na última hora</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-close-popup clickable :to="{ name: 'admin-panel', query: { tab: 'aito-tokens' } }"><q-item-section>Abrir AitoTokens</q-item-section><q-item-section side><q-icon name="mdi-arrow-right" /></q-item-section></q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<style scoped>
.provider-alert-float { position: fixed; right: max(env(safe-area-inset-right), 16px); bottom: max(env(safe-area-inset-bottom), 16px); z-index: 1400; color: #291a00; }
.provider-alert-float .q-btn { background: #fbd05d; box-shadow: 0 3px 15px #08090990; font-size: 13px; }
.provider-alert-float.is-critical .q-btn { color: white; background: #c82244; }
</style>
