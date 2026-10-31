<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { api, messageOf } from '../services.js'
import { inPrototype } from '../../../services/prototype-runtime.js'
const prototype = inPrototype()
import MediaPreview from './MediaPreview.vue'
import { formatWhatsApp } from '../whatsapp-format.js'
import { MapPin, Paperclip, Send, X, RotateCcw, Braces, BookOpen, Plus } from '@lucide/vue'
const props = defineProps({ flow: Object, assets: Array, paymentConfigs: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'step'])
const messages = ref([]), draft = ref(''), busy = ref(false), error = ref(''), context = ref({}), feed = ref(null)
const aiLive = ref(false), aiResponse = ref('Resposta de teste da IA.'), selectedAsset = ref('')
const fixtures = ref('{}'), optionsOpen = ref(false), trace = ref([])
const collectWindow = ref(3000), pending = ref([])
const attachmentMode = ref(''), locationForm = ref({ latitude: '', longitude: '', description: '' })
const operatorDraft = ref(''), clockOffset = ref(0), advanceMinutes = ref(30)
const catalogPreview = ref(null)
const failedRequest = ref(null)
let collectionTimer, feedObserver, lastInputAt = 0
onMounted(async () => { try { collectWindow.value = (await api.get("/settings")).data.runtime.collectWindowMs || 3000 } catch { /* usa padrão */ } })
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && feed.value) {
    feedObserver = new ResizeObserver(() => scroll()); feedObserver.observe(feed.value)
  }
})
let generation = 0, timer, finishWait, requestController
function cancelWait() { clearTimeout(timer); finishWait?.(); finishWait = null }
function reset() { clearTimeout(collectionTimer); pending.value = []; selectedAsset.value = ''; attachmentMode.value = ''; locationForm.value = { latitude: '', longitude: '', description: '' }; operatorDraft.value = ''; clockOffset.value = 0; catalogPreview.value = null; failedRequest.value = null; generation++; requestController?.abort(); requestController = null; cancelWait(); messages.value = []; context.value = {}; trace.value = []; error.value = ''; busy.value = false; emit('step', null) }
async function scroll() { await nextTick(); feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'auto' }) }
function wait(ms) { return new Promise((resolve) => { finishWait = resolve; timer = setTimeout(resolve, ms) }) }
function schedulePending() { clearTimeout(collectionTimer); if (pending.value.length && !failedRequest.value && !busy.value) collectionTimer = setTimeout(dispatch, Math.max(0, lastInputAt + collectWindow.value - Date.now())) }
function queueInput(input, outputs) {
  lastInputAt = Date.now(); error.value = ''
  pending.value.push(input)
  for (const output of outputs) messages.value.push({ from: 'client', output, time: new Date(Date.now() + clockOffset.value) })
  scroll(); schedulePending()
}
function send() {
  const text = draft.value.trim(), assetId = selectedAsset.value
  if (!text && !assetId) return
  const output = assetId ? { type: 'media', assetId, caption: text } : { type: 'text', text }
  queueInput({ text: text || 'Analise o arquivo recebido.', ...(assetId ? { assetId } : {}) }, [output])
  draft.value = ''; selectedAsset.value = ''; attachmentMode.value = ''
}
function sendLocation() {
  const { latitude, longitude, description } = locationForm.value
  const location = { latitude: Number(latitude), longitude: Number(longitude), description: description.trim() }
  if (String(latitude).trim() === '' || String(longitude).trim() === '' || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    error.value = 'Informe latitude entre -90 e 90 e longitude entre -180 e 180.'; return
  }
  queueInput({ text: '[Localização]', location }, [{ type: 'location', latitude: location.latitude, longitude: location.longitude, locationName: 'Localização compartilhada', locationAddress: location.description }])
  attachmentMode.value = ''; locationForm.value = { latitude: '', longitude: '', description: '' }
}
function quickSend(text) { draft.value = text; send() }
function addProduct(product) {
  const command = props.flow.settings?.order?.commands?.find(item => item.operation === 'add')?.command || '/add'
  quickSend(`${command} ${product.code} 1`)
}
function money(cents) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function quickReplies() {
  if (context.value.mode === 'human' || context.value.mode === 'closed') return []
  const order = context.value.order, config = props.flow.settings?.order
  if (config?.enabled && order && order.stage !== 'completed') {
    if (order.stage === 'fulfillment') return ['1', '2']
    if (order.stage === 'address') return []
    const commands = config.commands?.length ? config.commands : []
    return commands.filter(item => ['cart', 'help', ...(order.stage === 'review' ? ['finalize', 'editOrder', 'editAddress'] : ['confirm'])].includes(item.operation)).map(item => item.command)
  }
  return [...new Set(props.flow.edges?.filter(edge => edge.source === context.value.nodeId).flatMap(edge => edge.keywords || []) || [])].slice(0, 8)
}
function sendOperator() {
  if (context.value.mode !== 'human' || !operatorDraft.value.trim()) return
  messages.value.push({ from: 'bot', operator: true, output: { type: 'text', text: operatorDraft.value.trim() }, time: new Date(Date.now() + clockOffset.value) })
  operatorDraft.value = ''; context.value = { ...context.value, lastInteractionAt: Date.now() + clockOffset.value }; scroll()
}
function returnToBot() {
  if (busy.value || pending.value.length || failedRequest.value) return
  context.value = { ...context.value, mode: 'bot', nodeId: null, paymentNodeId: null, variables: {}, ai: null, lastInteractionAt: null }
  trace.value.push('Atendimento devolvido ao bot'); emit('step', null)
}
function advanceClock() {
  clockOffset.value += Number(advanceMinutes.value) * 60000
  trace.value.push(`Tempo avançado em ${advanceMinutes.value} min`)
}
async function dispatch() {
  if (busy.value || failedRequest.value || !pending.value.length) return
  const request = { ...pending.value.shift() }
  // Rich messages keep their own position and context instead of replacing a previous attachment.
  while (!request.assetId && !request.location && pending.value.length && !pending.value[0].assetId && !pending.value[0].location) request.text += '\n' + pending.value.shift().text
  await runRequest(request)
}
async function runRequest(request) {
  const current = generation; error.value = ''; busy.value = true
  const controller = new AbortController(); requestController = controller
  try {
    let responses
    try { responses = JSON.parse(fixtures.value); if (!responses || Array.isArray(responses) || typeof responses !== 'object') throw new Error() } catch { throw new Error('Respostas de teste: informe um objeto JSON válido.') }
    const { data } = await api.post('/flows/simulate', { flow: props.flow, ...request, now: Date.now() + clockOffset.value, context: context.value, fixtures: responses, paymentConfigs: props.paymentConfigs, aiLive: aiLive.value, aiResponse: aiResponse.value }, { signal: controller.signal })
    await applyEvents(data, current)
  } catch (cause) { if (current === generation) { error.value = messageOf(cause); failedRequest.value = request } }
  finally { if (current === generation) { requestController = null; busy.value = false; schedulePending() } }
}
async function retry() {
  if (busy.value || !failedRequest.value) return
  const request = failedRequest.value; failedRequest.value = null
  await runRequest(request)
}
async function applyEvents(data, current) {
    if (current === generation && data.catalog) catalogPreview.value = data.catalog
    let previous = 0
    for (const event of data.events) {
      if (current !== generation) return
      await wait(Math.max(0, event.at - previous)); previous = event.at
      if (current !== generation) return
      emit('step', event.nodeId)
      if (event.type === 'message') { messages.value.push({ from: 'bot', output: event.output, time: new Date(Date.now() + clockOffset.value) }); await scroll() }
      else trace.value.push(event.label)
    }
    if (current === generation) { context.value = data.context; error.value = data.error || ''; if (!data.events?.length && data.context?.nodeId) trace.value.push('A etapa atual aguarda uma entrada. Se esperava uma resposta, confira as mensagens e as configurações gerais do fluxo.'); emit('step', data.context?.nodeId); await scroll() }
}
async function settle(paymentEvent) {
  if (busy.value || failedRequest.value || !context.value.paymentNodeId) return
  clearTimeout(collectionTimer)
  await runRequest({ paymentEvent })
}
function time(value) { return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
onBeforeUnmount(() => { feedObserver?.disconnect(); reset() })
</script>
<template>
  <div class="sim-overlay" @click.self="emit('close')">
    <section class="sim-dialog" role="dialog" aria-modal="true" aria-label="Simular fluxo" @keydown.esc.stop="emit('close')">
      <header class="sim-tools"><b>Simular fluxo</b><button title="Respostas de teste das APIs" @click="optionsOpen = !optionsOpen"><Braces :size="18" /></button><button title="Reiniciar conversa" @click="reset"><RotateCcw :size="18" /></button><button title="Fechar simulador" @click="emit('close')"><X :size="18" /></button></header>
      <div v-if="optionsOpen" class="fixture-editor"><label><input v-model="aiLive" :disabled="prototype" type="checkbox">{{ prototype ? 'IA fictícia · sem consumo de créditos' : 'Usar IA real (consome créditos OpenAI)' }}</label><label v-if="!aiLive">Resposta de teste da IA<textarea v-model="aiResponse"></textarea></label><label>Respostas das APIs por ID do card<textarea v-model="fixtures" spellcheck="false" aria-label="Respostas das APIs por ID do card"></textarea></label><div v-for="node in flow.nodes.filter(n => n.type === 'action' && n.data.action.type === 'http')" :key="node.nodeId">{{ node.data.label }}: <code>{{ node.nodeId }}</code></div><div class="sim-clock"><label>Avançar tempo<select v-model.number="advanceMinutes"><option :value="1">1 minuto</option><option :value="5">5 minutos</option><option :value="30">30 minutos</option><option :value="60">1 hora</option></select></label><button type="button" :disabled="busy || pending.length > 0" @click="advanceClock">Avançar</button></div></div>
      <div class="phone">
        <div class="phone-status"><span>9:41</span><span>▮▮▮ 100%</span></div>
        <header class="chat-header"><span class="avatar">{{ flow.name?.charAt(0) || 'B' }}</span><div><strong>{{ flow.name }}</strong><small>{{ busy ? 'Respondendo…' : context.mode === 'human' ? 'Atendimento humano' : context.mode === 'closed' ? 'Conversa encerrada' : 'Conta comercial · Simulação' }}</small></div><span>⋮</span></header>
        <div ref="feed" class="chat-feed" aria-live="polite">
          <span class="day">Hoje</span>
          <article v-for="(message,index) in messages" :key="index" :class="['bubble', message.from]">
            <MediaPreview v-if="message.output.type === 'media'" :asset="message.output.asset || assets.find(a => a._id === message.output.assetId)" :document="message.output.sendAsDocument" />
            <template v-else-if="message.output.type === 'location'"><div class="location">⌖</div><b>{{ message.output.locationName }}</b><p>{{ message.output.locationAddress }}</p><small>{{ message.output.latitude }}, {{ message.output.longitude }}</small></template>
            <template v-else-if="message.output.type === 'contact'"><b>◉ {{ message.output.contactName }}</b><p>{{ message.output.contactPhone }}</p></template>
            <p v-if="message.output.text || message.output.caption" v-html="formatWhatsApp(message.output.text || message.output.caption)"></p>
            <footer><span v-if="message.operator">Atendente · </span>{{ time(message.time) }} <span v-if="message.from === 'client'">✓✓</span></footer>
          </article>
        </div>
        <div v-if="context.paymentNodeId" class="sim-payment"><button :disabled="busy" @click="settle('paid')">Simular pago</button><button :disabled="busy" @click="settle('declined')">Simular recusado</button></div>
        <div v-if="quickReplies().length" class="sim-quick-replies"><button v-for="reply in quickReplies()" :key="reply" type="button" :disabled="busy || pending.length > 0 || !!failedRequest" @click="quickSend(reply)">{{ reply }}</button></div>
        <div v-if="attachmentMode" class="sim-attachment">
          <header><b>{{ attachmentMode === 'location' ? 'Compartilhar localização' : attachmentMode === 'catalog' ? catalogPreview?.title : 'Enviar arquivo' }}</b><button type="button" title="Fechar anexo" @click="attachmentMode = ''; selectedAsset = ''"><X :size="16" /></button></header>
          <form v-if="attachmentMode === 'location'" @submit.prevent="sendLocation">
            <div class="coordinates"><label>Latitude<input v-model="locationForm.latitude" aria-label="Latitude" type="number" step="any" min="-90" max="90" required placeholder="0"></label><label>Longitude<input v-model="locationForm.longitude" aria-label="Longitude" type="number" step="any" min="-180" max="180" required placeholder="0"></label></div>
            <label>Endereço ou complemento<input v-model="locationForm.description" aria-label="Endereço da localização" maxlength="1000" placeholder="Rua Exemplo, 100, sala 2"></label>
            <button class="send-location" type="submit">Enviar localização</button>
          </form>
          <div v-else-if="attachmentMode === 'catalog'" class="sim-catalog"><div v-for="product in catalogPreview?.products || []" :key="product.code" class="sim-product"><div><b>{{ product.name }}</b><small>{{ product.code }} · {{ money(product.priceCents) }}{{ product.available ? '' : ' · Indisponível' }}</small></div><button type="button" :title="`Adicionar ${product.name} ao pedido de teste`" :aria-label="`Adicionar ${product.name}`" :disabled="!product.available || context.mode !== 'bot' || !['cart', 'review'].includes(context.order?.stage) || busy || pending.length > 0 || !!failedRequest" @click="addProduct(product)"><Plus :size="18" /></button></div><p v-if="!catalogPreview?.products?.length">Nenhum produto disponível.</p></div>
          <select v-else v-model="selectedAsset" class="sim-asset" aria-label="Anexar arquivo de teste"><option value="">Selecione um arquivo…</option><option v-for="asset in assets" :key="asset._id" :value="asset._id">{{ asset.name }}</option></select>
        </div>
        <div class="attachment-actions"><button type="button" :aria-pressed="attachmentMode === 'location'" @click="attachmentMode = attachmentMode === 'location' ? '' : 'location'"><MapPin :size="14" />Localização</button><button v-if="assets.length" type="button" :aria-pressed="attachmentMode === 'file'" @click="attachmentMode = attachmentMode === 'file' ? '' : 'file'"><Paperclip :size="14" />Arquivo</button><button v-if="catalogPreview" type="button" :aria-pressed="attachmentMode === 'catalog'" @click="attachmentMode = attachmentMode === 'catalog' ? '' : 'catalog'"><BookOpen :size="14" />Catálogo</button><button v-if="context.mode === 'human' || context.mode === 'closed'" type="button" :disabled="busy || pending.length > 0 || !!failedRequest" @click="returnToBot">Retomar bot</button></div>
        <form v-if="context.mode === 'human'" class="operator-composer" @submit.prevent="sendOperator"><input v-model="operatorDraft" aria-label="Resposta do atendente" placeholder="Resposta do atendente"><button type="submit" title="Enviar como atendente" :disabled="!operatorDraft.trim()"><Send :size="16" /></button></form>
        <form class="composer" @submit.prevent="send"><input v-model="draft" aria-label="Mensagem do cliente" placeholder="Mensagem do cliente" autofocus><button title="Enviar mensagem" :disabled="!draft.trim() && !selectedAsset"><Send :size="18" /></button></form>
      </div>
      <p v-if="error" class="sim-error" role="alert">{{ error }} <button v-if="failedRequest" type="button" :disabled="busy" @click="retry">Tentar novamente</button></p>
      <details v-if="context.order" class="execution"><summary>Pedido · {{ money(context.order.totalCents) }}</summary><p v-for="item in context.order.items" :key="item.code">{{ item.quantity }} × {{ item.name }} · {{ money(item.quantity * item.unitPriceCents) }}</p><p>{{ context.order.fulfillment === 'delivery' ? 'Entrega' : context.order.fulfillment === 'pickup' ? 'Retirada' : 'Recebimento pendente' }} · {{ context.order.address?.text }}</p></details>
      <details v-if="trace.length || context.tags?.length" class="execution"><summary>Etapas e etiquetas</summary>{{ trace.join(' → ') }}<p>{{ context.tags?.join(', ') }}</p></details>
    </section>
  </div>
</template>
<style scoped>
.sim-overlay{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;padding:12px;background:#14221eb3}.sim-dialog{width:min(420px,100%);max-height:96dvh;overflow:auto}.sim-tools{display:flex;align-items:center;gap:8px;color:white;padding:0 4px 10px}.sim-tools b{flex:1}.sim-tools button{width:32px;height:32px;border:0;border-radius:6px;background:white;color:#253a34;font-size:19px}.sim-asset{background:#fff;color:#173e33;padding:8px;margin:0 10px;border:1px solid #abbfb4;border-radius:6px;font-size:11px}.phone{color:#152f29;color-scheme:light;height:min(700px,80dvh);display:flex;flex-direction:column;overflow:hidden;border:8px solid #242729;border-radius:34px;background:#f0f2f5;box-shadow:0 12px 40px #0005}.phone-status{display:flex;justify-content:space-between;padding:10px 20px 8px;background:#fff;font-size:11px;font-weight:700}.chat-header{display:flex;align-items:center;gap:10px;padding:12px;background:#fff}.chat-header>div{flex:1;min-width:0}.chat-header strong{display:block;overflow-wrap:anywhere;font-size:14px}.chat-header small{display:block;font-size:11px;color:#63716b;margin-top:3px}.avatar{display:grid;place-items:center;width:38px;height:38px;flex-shrink:0;border-radius:50%;background:#d5ede4;color:#156b52;font-weight:700}.chat-feed{flex:1;min-height:0;overflow:auto;padding:15px 12px;display:flex;flex-direction:column;gap:8px;background:#e5e9e3}.day{align-self:center;background:#fff;padding:5px 10px;border-radius:6px;font-size:11px;color:#60706b}.bubble{max-width:88%;min-width:70px;padding:8px 9px 5px;border-radius:7px;background:#fff;align-self:flex-start;box-shadow:0 1px 1px #0002;overflow-wrap:anywhere}.bubble.client{align-self:flex-end;background:#d9fdd3}.bubble p{margin:0;white-space:pre-wrap;font-size:14px;line-height:1.4}.bubble footer{text-align:right;font-size:10px;color:#718078;margin-top:4px}.bubble footer span{color:#379ace}.composer{display:flex;gap:8px;padding:10px;align-items:center}.composer input{min-width:0;flex:1;border:0;border-radius:20px;padding:12px;font-size:14px}.composer button{border:0;border-radius:50%;width:40px;height:40px;color:#fff;background:#16876c}.composer button:disabled{opacity:.45}.sim-error{padding:10px;background:#fff0f2;color:#a2233a;border-radius:6px;font-size:13px}.location{font-size:38px;text-align:center;background:#dae9dd}.fixture-editor,.execution{padding:12px;background:white;font-size:12px;overflow-wrap:anywhere}.fixture-editor textarea{display:block;width:100%;min-height:95px;font-family:monospace}.execution{margin-top:8px;border-radius:6px}@media(max-width:480px){.sim-overlay{padding:7px}.sim-asset{background:#fff;color:#173e33;padding:8px;margin:0 10px;border:1px solid #abbfb4;border-radius:6px;font-size:11px}.phone{color:#152f29;color-scheme:light;height:78dvh}.sim-tools{padding-bottom:6px}}
.sim-payment{display:flex;gap:8px;justify-content:center;padding:7px;background:#eef6f0}.sim-payment button{padding:6px 10px;border:1px solid #16876c;border-radius:6px;background:white;color:#16876c;font-size:11px;cursor:pointer}
</style>

<style scoped>
.sim-catalog{max-height:180px;overflow-y:auto}.sim-product{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e0e9e3}.sim-product>div{min-width:0;flex:1}.sim-product b,.sim-product small{display:block;overflow-wrap:anywhere}.sim-product b{font-size:12px}.sim-product small{font-size:11px;color:#597266;margin-top:3px}.sim-product button{width:32px;height:32px;display:grid;place-items:center;flex-shrink:0;border:1px solid #aecdbc;border-radius:6px;background:#eaf7ee;color:#17664c;font-size:18px}.sim-product button:disabled{opacity:.4}.sim-catalog>p{font-size:12px}
</style>

<style scoped>
.phone{min-height:0}.chat-feed .bubble{flex-shrink:0}.phone>header,.phone-status,.composer,.sim-payment,.sim-quick-replies,.attachment-actions,.sim-attachment,.operator-composer{flex-shrink:0}.sim-quick-replies,.attachment-actions{display:flex;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto;scrollbar-width:thin}.sim-quick-replies button,.attachment-actions button,.sim-clock button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:5px 9px;border:1px solid #bfd3c9;border-radius:6px;color:#195c48;background:white;font-size:12px;line-height:1.2;white-space:nowrap;flex-shrink:0}.attachment-actions button[aria-pressed=true]{background:#d6eee2;border-color:#16876c}.sim-quick-replies button:disabled,.attachment-actions button:disabled{opacity:.45}.sim-attachment{padding:8px 12px;background:#fff;border-top:1px solid #d4dfd9}.sim-attachment header{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;font-size:12px}.sim-attachment header button{width:28px;height:28px;border:0;border-radius:6px;background:#f0f5f2;color:#34594a;font-size:18px}.sim-attachment form{display:grid;gap:8px}.sim-attachment label,.sim-clock label{display:grid;gap:4px;font-size:11px;min-width:0}.coordinates{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.sim-attachment input,.sim-clock select{width:100%;min-width:0;box-sizing:border-box;padding:7px;border:1px solid #b5cfc2;border-radius:6px;font-size:12px;background:white;color:#183d2f}.send-location{border:0;border-radius:6px;padding:9px;color:white;background:#16876c;font-size:12px}.sim-attachment .sim-asset{width:100%;margin:0}.operator-composer{display:flex;gap:8px;padding:8px 10px;background:#e4efff}.operator-composer input{min-width:0;flex:1;padding:9px;border:1px solid #abc4e6;border-radius:6px;color:#23405e;background:white;font-size:12px}.operator-composer button{flex-shrink:0;width:34px;height:34px;border:0;border-radius:6px;background:#326fb5;color:white}.sim-clock{display:flex;gap:8px;align-items:flex-end;margin-top:10px}.sim-clock label{flex:1}.fixture-editor{max-height:35dvh;overflow-y:auto}.attachment-actions{border-top:1px solid #d4dfd9}.composer button{display:grid;place-items:center;flex-shrink:0;padding:0;line-height:1}.sim-tools button{display:grid;place-items:center;padding:0;line-height:1}.phone{height:min(740px,82dvh)}@media(max-height:680px){.sim-attachment{max-height:35dvh;overflow-y:auto}.phone{height:80dvh}.chat-header{padding:7px 10px}.phone-status{padding-top:5px}.composer{padding:6px 10px}}
</style>

<style scoped src="../flow-simulator-mobile.css"></style>
