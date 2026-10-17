<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { botApi, waApi, messageOf } from 'src/services/whatsapp'
import FlowMediaPreview from './FlowMediaPreview.vue'
import { formatWhatsApp } from 'src/services/whatsapp-format'
const props = defineProps({ flowId: String, flow: Object, assets: Array, paymentConfigs: Array })
const emit = defineEmits(['close'])
const messages = ref([]), input = ref(''), busy = ref(false), state = ref(null), error = ref(''), events = ref([]), list = ref(null), mocks = ref('{}')
const retryAvailable = ref(false)
const aiLive = ref(false), aiResponse = ref('Resposta de teste da IA.')
const hasAI = computed(() => props.flow.nodes.some(node => node.type === 'ai'))
const httpNodes = computed(() => props.flow.nodes.filter(node => node.type === 'action' && node.data.action.type === 'http'))
let generation = 0, collectTimer, pending = [], timers = new Map(), lastInputAt = 0, settingsRevision = 0, activeRequest, failedRequest
const collectWindowMs = ref(3000), settingsReady = ref(false)
async function loadSettings() {
  const revision = ++settingsRevision
  try {
    const { data } = await waApi.get('/bot-settings')
    if (revision === settingsRevision) { collectWindowMs.value = data.collectWindowMs; settingsReady.value = true }
  } catch (cause) { if (revision === settingsRevision) throw cause }
}
onMounted(() => { const current = generation; loadSettings().catch(cause => { if (current === generation) error.value = messageOf(cause) }) })
function scroll() { nextTick(() => { if (list.value) list.value.scrollTop = list.value.scrollHeight }) }
function reset() { generation++; activeRequest?.abort(); activeRequest = null; failedRequest = null; retryAvailable.value = false; clearTimeout(collectTimer); for (const [timer, resolve] of timers) { clearTimeout(timer); resolve() }; timers.clear(); pending = []; messages.value = []; state.value = null; events.value = []; error.value = ''; busy.value = false }
function wait(ms) { return new Promise(resolve => { const timer = setTimeout(() => { timers.delete(timer); resolve() }, ms); timers.set(timer, resolve) }) }
function scheduleRun() { clearTimeout(collectTimer); if (pending.length && !busy.value && !failedRequest && settingsReady.value) collectTimer = setTimeout(run, Math.max(0, lastInputAt + collectWindowMs.value - Date.now())) }
async function retrySettings() {
  const current = generation
  try { await loadSettings(); if (current === generation) { error.value = ''; scheduleRun() } } catch (cause) { if (current === generation) error.value = messageOf(cause) }
}
async function send() {
  const text = input.value.trim(); if (!text) return
  lastInputAt = Date.now(); const current = generation
  messages.value.push({ from: 'client', text }); pending.push(text); input.value = ''; scroll()
  clearTimeout(collectTimer)
  try { await loadSettings(); if (current === generation) scheduleRun() } catch (cause) { if (current === generation) { settingsReady.value = false; error.value = messageOf(cause) } }
}
async function run() {
  if (busy.value || failedRequest || !pending.length) return
  const text = pending.join('\n'); pending = []
  await simulate({ text })
}
async function simulate(request) {
  const current = generation, controller = new AbortController()
  activeRequest = controller; busy.value = true; error.value = ''; retryAvailable.value = false
  try {
    let httpResponses; try { httpResponses = JSON.parse(mocks.value) } catch { throw new Error('O JSON das respostas de teste é inválido.') }
    if (!httpResponses || Array.isArray(httpResponses) || typeof httpResponses !== 'object') throw new Error('As respostas de teste precisam ser um objeto JSON por card.')
    const { data } = await botApi.post(`/flows/${props.flowId}/simulate`, { flow: props.flow, state: state.value, ...request, httpResponses, aiLive: aiLive.value, aiResponse: aiResponse.value, paymentConfigs: props.paymentConfigs }, { timeout: 240000, signal: controller.signal })
    if (current !== generation) return
    state.value = data.state; events.value.push(...(data.events || []))
    let elapsed = 0
    for (const output of data.outputs || []) {
      await wait(Math.max(0, output.delayMs - elapsed)); elapsed = output.delayMs
      if (current !== generation) return
      messages.value.push({ ...output, from: 'bot' }); scroll()
    }
    if (!data.outputs?.length && !data.events?.length) events.value.push('O fluxo aguardou a próxima mensagem sem enviar uma resposta.')
  } catch (cause) { if (current === generation) { failedRequest = request; retryAvailable.value = true; error.value = messageOf(cause) } }
  finally { if (current === generation) { activeRequest = null; busy.value = false; scheduleRun() } }
}
async function paymentEvent(event) {
  if (busy.value || failedRequest) return
  await simulate({ paymentEvent: event })
}
async function retry() {
  if (busy.value || !failedRequest) return
  const request = failedRequest; failedRequest = null
  await simulate(request)
}
function assetName(id) { return props.assets?.find(asset => asset._id === id)?.name || 'Arquivo da biblioteca' }
function exampleMocks() { mocks.value = JSON.stringify(Object.fromEntries(httpNodes.value.map(node => [node.nodeId, { status: 200, body: { ok: true } }])), null, 2) }
onBeforeUnmount(reset)
</script>
<template>
  <div class="sim-overlay" role="dialog" aria-modal="true" aria-label="Simular bot" @keydown.esc.stop="emit('close')" @keydown.stop>
    <section class="sim-panel">
      <header><div><h2>Simular bot</h2></div><button aria-label="Fechar simulador" @click="emit('close')">✕</button></header>
      <div class="sim-layout">
        <div class="phone">
          <div class="phone-top"><span>◉</span><div><b>{{ flow.name }}</b><small>{{ busy ? 'Respondendo…' : 'WhatsApp · simulação' }}</small></div></div>
          <div ref="list" class="phone-chat" aria-live="polite">
            <p v-if="!messages.length" class="phone-notice">Envie uma mensagem para começar.</p>
            <article v-for="(message,index) in messages" :key="index" :class="['phone-bubble', message.from]">
              <FlowMediaPreview v-if="message.type === 'media' && message.assetId" :asset-id="message.assetId" :name="assetName(message.assetId)" />
              <div v-if="message.type === 'location'">📍 {{ message.locationName }}<small>{{ message.locationAddress }} · {{ message.latitude }}, {{ message.longitude }}</small></div>
              <div v-if="message.type === 'contact'">👤 {{ message.contactName }}<small>{{ message.contactPhone }}</small></div>
              <div class="formatted" v-html="formatWhatsApp(message.type === 'media' ? message.caption : message.text)"></div>
              <footer>{{ message.from === 'client' ? 'Você' : 'Bot' }} · {{ index + 1 }} <span v-if="message.from === 'client'">✓✓</span></footer>
            </article>
          </div>
          <form class="phone-compose" @submit.prevent="send"><input v-model="input" aria-label="Mensagem do cliente" placeholder="Mensagem" maxlength="4096"><button :disabled="!input.trim() || !settingsReady" aria-label="Enviar mensagem de teste">➤</button></form>
        </div>
        <aside class="sim-info"><button @click="reset">Reiniciar conversa</button>
          <section v-if="state?.paymentNodeId" class="q-my-md"><p>Teste a resposta da InfinitePay sem criar uma compra real.</p><div class="payment-test-actions"><button :disabled="busy || retryAvailable" @click="paymentEvent('paid')">Simular aprovação</button><button :disabled="busy || retryAvailable" @click="paymentEvent('declined')">Simular recusa</button></div></section>
          <section v-if="hasAI" class="q-my-md"><label><input v-model="aiLive" type="checkbox" :disabled="busy" @change="reset"> Usar IA real (consome API)</label><label v-if="!aiLive"><small>Resposta de teste</small><textarea v-model="aiResponse" rows="3"></textarea></label></section>
          <details v-if="httpNodes.length"><summary>Respostas das integrações</summary><p>Informe status e body para cada card. <button @click="exampleMocks">Preencher exemplo</button></p><textarea v-model="mocks" aria-label="JSON das respostas de teste" rows="10"></textarea><ul><li v-for="node in httpNodes" :key="node.nodeId">{{ node.data.label }}: <code>{{ node.nodeId }}</code></li></ul></details>
          <p v-if="error" role="alert" class="sim-error">{{ error }}</p><button v-if="retryAvailable" :disabled="busy" @click="retry">Tentar novamente</button><button v-if="!settingsReady" @click="retrySettings">Tentar carregar configuração</button><ul aria-live="polite"><li v-for="(event,index) in events" :key="index">{{ event }}</li></ul>
        </aside>
      </div>
    </section>
  </div>
</template>
<style scoped>
.sim-overlay{position:fixed;inset:0;z-index:7500;background:#001b22bc;display:grid;place-items:center;padding:18px;color:#163c34}.sim-panel{background:#f2f8f5;border-radius:20px;width:min(860px,100%);max-height:95dvh;overflow:auto;padding:22px}.sim-panel>header{display:flex;align-items:start;justify-content:space-between;gap:12px}.sim-panel h2{font-size:20px;margin:0 0 6px}.sim-panel p{font-size:12px;line-height:1.6}.sim-panel button{background:#087563;border:0;border-radius:9px;color:white;padding:10px;cursor:pointer}.sim-layout{display:grid;grid-template-columns:minmax(0,390px) minmax(0,1fr);gap:24px}.phone{border:9px solid #19332f;border-radius:36px;overflow:hidden;background:#efeae2;box-shadow:0 12px 35px #143a3025;display:flex;flex-direction:column;height:580px;max-height:72dvh}.phone-top{display:flex;gap:12px;align-items:center;background:#075e54;color:white;padding:18px 15px}.phone-top small,.phone-bubble small{display:block;font-size:10px;margin-top:4px}.phone-chat{flex:1;overflow:auto;padding:16px 12px;display:flex;flex-direction:column;gap:10px;min-height:0;background:radial-gradient(#839a8822 1px,transparent 1px) 0 0/18px 18px}.phone-notice{background:#fff6d6;padding:8px;text-align:center;border-radius:8px}.phone-bubble{width:fit-content;max-width:88%;padding:8px 11px;background:white;border-radius:0 10px 10px;box-shadow:0 1px 2px #0002;font-size:13px;overflow-wrap:anywhere}.phone-bubble.client{align-self:flex-end;background:#d9fdd3;border-radius:10px 0 10px 10px}.phone-bubble footer{text-align:right;font-size:9px;color:#688277;margin-top:5px}.phone-bubble footer span{color:#36a5ce}.formatted{white-space:pre-wrap}.formatted :deep(code){font-family:monospace;background:#0001}.phone-compose{display:flex;gap:8px;padding:10px;background:#f0f2f5}.phone-compose input{min-width:0;flex:1;border:0;border-radius:20px;background:white;padding:12px;color:#163c34}.phone-compose button{border-radius:50%;width:42px}.sim-info{font-size:12px;overflow-wrap:anywhere}.sim-info textarea{width:100%;font-family:monospace;background:white;color:#173c32;border:1px solid #b7cfc7;border-radius:6px;padding:8px}.sim-error{color:#af273e}.attachment{padding:12px;background:#f1f5f2;border-radius:5px}@media(max-width:650px){.sim-overlay{padding:0}.sim-panel{border-radius:0;max-height:100dvh;height:100dvh;padding:15px}.sim-layout{grid-template-columns:1fr}.phone{width:min(100%,390px);margin:auto;height:65dvh}.sim-info{padding-bottom:30px}}
</style>
