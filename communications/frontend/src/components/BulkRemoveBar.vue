<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { http, unwrap, errorMessage } from '../services/http.js'
const props = defineProps({ target: { type: String, required: true }, selected: { type: Array, default: () => [] }, floating: Boolean, active: { type: Boolean, default: true } })
const emit = defineEmits(['removed'])
const $q = useQuasar(), busy = ref(false), completed = ref(0)
function confirm() {
  const ids = [...new Set(props.selected.map(item => String(item.id || item._id || item)))]
  const target = props.target
  if (!ids.length || busy.value) return
  $q.dialog({ title: `Remover ${ids.length} ${target === 'contacts' ? 'contato(s)' : target === 'contact-groups' ? 'grupo(s)' : 'conversa(s)'}?`,
    message: target === 'contacts' ? 'Os contatos selecionados serão removidos, suas permissões revogadas e os vínculos limpos. Confirme apenas se deseja concluir a remoção.' : target === 'contact-groups' ? 'Os grupos selecionados deixarão de receber notificações. Os contatos e os grupos nos aplicativos dos participantes serão preservados.' : 'As conversas selecionadas e seu histórico sairão do painel. Os contatos serão preservados. O WhatsApp/Telegram dos participantes não será alterado.',
    cancel: { flat: true, label: 'Cancelar' }, ok: { color: 'negative', label: 'Confirmar remoção' }, persistent: true }).onOk(async () => {
    busy.value = true; completed.value = 0
    const removed = []; let failed = 0
    try {
      for (let start = 0; start < ids.length; start += target === 'contact-groups' ? 1 : 10) {
        if (target === 'contact-groups') {
          try { await http.delete('/contact-groups/' + ids[start]); removed.push(ids[start]) } catch { failed += 1 }
          completed.value = start + 1
        } else {
          const result = unwrap(await http.post('/bulk/remove', { target, ids: ids.slice(start, start + 10), confirmed: true }, { timeout: 120000 }))
          removed.push(...result.results.filter(item => item.removed).map(item => item.id)); failed += result.failed
          completed.value = Math.min(start + 10, ids.length)
        }
      }
      $q.notify({ type: failed ? 'warning' : 'positive', message: `${removed.length} removido(s)${failed ? `; ${failed} não puderam ser removidos.` : '.'}` })
    } catch (error) { $q.notify({ type: 'negative', message: errorMessage(error) }) }
    finally { busy.value = false; emit('removed', removed) }
  })
}
</script>
<template>
  <Teleport to="body" :disabled="!floating">
  <div v-if="selected.length && active" class="bulk-remove-bar" :class="{ 'bulk-remove-bar--floating': floating }" role="status" aria-live="polite">
    <strong>{{ busy ? `${completed}/${selected.length} processados` : `${selected.length} selecionado(s)` }}</strong>
    <q-btn color="negative" outline no-caps icon="delete_outline" label="Remover selecionados" :loading="busy" @click="confirm" />
  </div>
  </Teleport>
</template>
<style scoped>.bulk-remove-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;margin:10px 0;border:1px solid #efc7cd;border-radius:14px;background:#fff5f6}.bulk-remove-bar strong{font-size:13px}.bulk-remove-bar--floating{position:fixed;z-index:1900;left:50%;bottom:calc(48px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,calc(100vw - 32px));box-shadow:0 12px 40px #64172525;margin:0}@media(max-width:480px){.bulk-remove-bar{align-items:stretch}.bulk-remove-bar .q-btn{width:100%}.bulk-remove-bar--floating{padding:10px 12px;gap:6px;bottom:calc(56px + env(safe-area-inset-bottom))}}</style>
