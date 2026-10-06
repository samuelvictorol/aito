<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'

defineProps({ licenses: { type: Array, default: () => [] } })
const $q = useQuasar()
const visible = ref({})
async function copy(token) {
  try {
    await navigator.clipboard.writeText(token)
    $q.notify({ type: 'positive', message: 'Token copiado.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Não foi possível copiar. Exiba o token para copiá-lo manualmente.' })
  }
}
</script>

<template>
  <div v-if="licenses.length" class="license-list">
    <div v-for="license in licenses" :key="license._id" class="license-list__item">
      <div class="license-list__heading"><strong>WhatsApp BotBuilder</strong><span :class="license.active ? 'is-active' : 'is-inactive'">{{ license.active ? 'Ativo' : 'Suspenso' }}</span></div>
      <div class="license-list__token"><code>{{ visible[license._id] ? license.token : '••••••••••••••••••••••••' }}</code><q-btn flat round dense size="sm" :icon="visible[license._id] ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" :aria-label="visible[license._id] ? 'Ocultar token' : 'Mostrar token'" @click="visible[license._id] = !visible[license._id]" /><q-btn flat round dense size="sm" icon="mdi-content-copy" aria-label="Copiar token" @click="copy(license.token)" /></div>
      <small>Instalação: {{ license.installationId || 'Ainda não ativada' }}</small>
    </div>
  </div>
</template>

<style scoped>
.license-list{display:grid;gap:8px;min-width:0}.license-list__item{min-width:0;padding:10px;border:1px solid #32615b;border-radius:9px;background:#092527}.license-list__heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.license-list__heading strong{color:#e9fff9;font-size:11px}.license-list__heading span{padding:2px 6px;border-radius:12px;font-size:9px}.is-active{color:#adf4db;background:#145747}.is-inactive{color:#ffbdc2;background:#5b2932}.license-list__token{display:flex;align-items:center;min-width:0;margin-top:6px;padding:3px 5px;border-radius:5px;background:#031819}.license-list__token code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#defdf4;font-size:10px}.license-list__token .q-btn{flex:none;color:#a9e4d4}.license-list__item small{display:block;margin-top:4px;color:#a0c0b7;font-size:9px;overflow-wrap:anywhere}
</style>
