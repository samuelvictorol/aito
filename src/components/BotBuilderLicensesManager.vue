<script setup>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
const $q = useQuasar(), items = ref([]), orders = ref([]), paymentEvents = ref([]), busy = ref(false), retrying = ref(''), visible = ref({})
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('aito_admin_token') || ''}` } })
async function load() {
  busy.value = true
  try { const data = (await api.get('/admin/botbuilder/licenses', headers())).data.data; items.value = data.items || []; orders.value = data.orders || []; paymentEvents.value = data.paymentEvents || [] }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Falha ao carregar licenças.' }) }
  finally { busy.value = false }
}
async function update(path, body = {}) {
  busy.value = true
  try { await api.post(path, body, headers()); await load() }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Operação não concluída.' }) }
  finally { busy.value = false }
}
async function active(item) {
  try { await api.patch(`/admin/botbuilder/licenses/${item._id}`, { active: !item.active }, headers()); await load() }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Falha ao atualizar licença.' }) }
}
function confirmRotate(item) { $q.dialog({ title: 'Gerar novo token?', message: 'O token antigo deixa de funcionar imediatamente. A instalação terá que atualizar o .env.', cancel: true }).onOk(() => update(`/admin/botbuilder/licenses/${item._id}/rotate`)) }
function confirmReset(item) { $q.dialog({ title: 'Transferir instalação?', message: 'Um novo token será criado. O servidor anterior perderá acesso, e o comprador deverá atualizar o .env.', cancel: true }).onOk(() => update(`/admin/botbuilder/licenses/${item._id}/installation/reset`)) }
function eventFor(order) { return paymentEvents.value.find(event => event.orderNsu === order.orderNsu) }
function eventStatus(event) { return ({ queued: 'Verificação na fila', processing: 'Verificando', verified: 'Confirmado', failed: 'Falha na verificação' })[event?.state] || 'Aguardando retorno da InfinitePay' }
async function retryOrder(order) {
  retrying.value = order.orderNsu
  try { await api.post(`/admin/botbuilder/orders/${encodeURIComponent(order.orderNsu)}/retry`, {}, headers()); await load(); $q.notify({ type: 'positive', message: 'Pagamento revalidado. Confira o estado do pedido.' }) }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Ainda não foi possível confirmar este pagamento.' }); await load() }
  finally { retrying.value = '' }
}
async function copy(value) { await navigator.clipboard.writeText(value); $q.notify({ type: 'positive', message: 'Token copiado.' }) }
onMounted(load)
</script>
<template>
  <section class="licenses"><header><div><span>PRODUTO DIGITAL</span><h2>Licenças WhatsApp BotBuilder</h2><p>Compradores do site, do WhatsApp e acesso do administrador. Cada token ativa uma instalação.</p></div><div><q-btn flat icon="mdi-refresh" label="Atualizar" :loading="busy" @click="load" /><q-btn color="teal-7" no-caps icon="mdi-key-plus" label="Meu token de admin" @click="update('/admin/botbuilder/licenses/admin')" /></div></header>
    <div class="licenses__grid"><article v-for="item in items" :key="item._id"><div class="licenses__row"><strong>{{ item.ownerName || item.ownerPhone || item.ownerEmail || item.ownerId }}</strong><q-badge :color="item.active ? 'teal-7' : 'red-8'">{{ item.active ? 'Ativo' : 'Suspenso' }}</q-badge></div><small>{{ item.ownerType === 'user' ? 'Estudante' : item.ownerType === 'whatsapp' ? 'Compra pelo WhatsApp' : 'Admin' }} · {{ item.ownerPhone || item.ownerEmail || item.ownerId }}</small><div class="licenses__token"><code>{{ visible[item._id] ? item.token : '••••••••••••••••••••••••' }}</code><q-btn flat dense icon="mdi-eye" @click="visible[item._id] = !visible[item._id]" /><q-btn flat dense icon="mdi-content-copy" @click="copy(item.token)" /></div><small>Instalação: {{ item.installationId || 'Ainda não ativada' }}</small><div class="licenses__actions"><q-btn flat dense no-caps label="Novo token" @click="confirmRotate(item)" /><q-btn flat dense no-caps label="Transferir instalação" @click="confirmReset(item)" /><q-btn flat dense no-caps :color="item.active ? 'red-4' : 'teal-3'" :label="item.active ? 'Suspender' : 'Reativar'" @click="active(item)" /></div></article></div>
    <h3>Compras pelo site</h3><div class="licenses__orders"><article v-for="order in orders" :key="order._id"><div class="licenses__order-info"><strong>{{ order.userId?.name || 'Conta removida' }}</strong><span>{{ order.userId?.email }} · {{ order.orderNsu }}</span><small>{{ eventStatus(eventFor(order)) }}<template v-if="eventFor(order)?.error"> · {{ eventFor(order).error }}</template></small></div><q-badge :color="order.status === 'paid' ? 'teal-7' : 'amber-8'">{{ order.status === 'paid' ? 'Pago' : 'Aguardando' }}</q-badge><a v-if="order.receiptUrl" :href="order.receiptUrl" target="_blank" rel="noopener noreferrer">Comprovante ↗</a><q-btn v-if="order.status !== 'paid' && eventFor(order)" outline dense no-caps color="teal-3" label="Reverificar" :loading="retrying === order.orderNsu" @click="retryOrder(order)" /></article></div>
  </section>
</template>
<style scoped>
.licenses{color:#effffb}.licenses header,.licenses__row{display:flex;align-items:center;justify-content:space-between;gap:1rem}.licenses header{flex-wrap:wrap}.licenses header span{font-size:.68rem;font-weight:800;letter-spacing:.14em;color:#8fffee}.licenses h2{margin:.3rem 0}.licenses p,.licenses small{color:#b9d6d0}.licenses__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}.licenses__grid article,.licenses__orders article{padding:1rem;border:1px solid #2b5855;border-radius:.7rem;background:#092324}.licenses__grid small{display:block;margin:.4rem 0}.licenses__token{display:flex;align-items:center;gap:.3rem;padding:.35rem;border-radius:.4rem;background:#031514;overflow:hidden}.licenses__token code{flex:1;overflow:hidden;text-overflow:ellipsis}.licenses__actions{display:flex;flex-wrap:wrap;gap:.2rem}.licenses__orders{display:grid;gap:.4rem}.licenses__orders article{display:flex;flex-wrap:wrap;gap:1rem;align-items:center}.licenses__orders span{color:#b9d6d0;overflow-wrap:anywhere}.licenses a{color:#8fffee}@media(max-width:700px){.licenses__grid{grid-template-columns:1fr}.licenses__orders article{display:grid}}
.licenses__order-info{flex:1;min-width:0}.licenses__order-info strong,.licenses__order-info span,.licenses__order-info small{display:block}.licenses__order-info small{margin-top:4px;color:#c9ded8;overflow-wrap:anywhere;font-size:10px}
</style>
