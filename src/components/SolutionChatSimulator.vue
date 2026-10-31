<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { getSimulatorFlow, simulatorFlows, simulatorReply } from 'src/data/solutionSimulator'
const selected = ref('dentist'), nodeId = ref('start'), messages = ref([]), draft = ref(''), typing = ref(false), playing = ref(false), stream = ref(null)
const flow = computed(() => getSimulatorFlow(selected.value))
const node = computed(() => flow.value.nodes[nodeId.value])
let replyTimer, playTimer, sequence = 0
function scroll() { nextTick(() => { if (stream.value) stream.value.scrollTop = stream.value.scrollHeight }) }
function stop() { playing.value = false; clearTimeout(playTimer) }
function begin(id, automatic = false) {
  if (!automatic) stop()
  clearTimeout(replyTimer); selected.value = id; nodeId.value = 'start'; draft.value = ''; typing.value = false
  messages.value = [{ id: ++sequence, direction: 'bot', ...flow.value.nodes.start }]; scroll()
}
function send(text = draft.value, automatic = false) {
  if (typing.value || !String(text).trim()) return
  if (!automatic) stop()
  const reply = simulatorReply(selected.value, nodeId.value, text)
  messages.value.push({ id: ++sequence, direction: 'user', text: String(text).trim().slice(0, 500) }); draft.value = ''; typing.value = true; scroll()
  replyTimer = setTimeout(() => {
    nodeId.value = reply.nodeId; messages.value.push({ id: ++sequence, direction: 'bot', ...reply.node }); typing.value = false; scroll()
    if (playing.value) schedule()
  }, 650)
}
function nextFlow(automatic = false) { begin(simulatorFlows[(simulatorFlows.findIndex(item => item.id === selected.value) + 1) % simulatorFlows.length].id, automatic) }
function schedule() {
  clearTimeout(playTimer)
  playTimer = setTimeout(() => {
    if (!playing.value) return
    if (node.value.end) { nextFlow(true); schedule() } else send(node.value.options[0][0], true)
  }, 2800)
}
function togglePlayback() { if (playing.value) stop(); else { playing.value = true; if (!typing.value) schedule() } }
begin('dentist')
onBeforeUnmount(() => { clearTimeout(replyTimer); clearTimeout(playTimer) })
</script>
<template>
  <div class="simulator">
    <div class="scenario-tabs" role="group" aria-label="Escolha uma demonstração de atendimento">
      <button v-for="item in simulatorFlows" :key="item.id" type="button" :aria-pressed="selected === item.id" @click="begin(item.id)"><q-icon :name="item.icon"/>{{ item.label }}</button>
    </div>
    <div class="demo-phone">
      <div class="phone-island" aria-hidden="true"/>
      <header class="chat-top"><img src="/aito-logo-restored.png" alt="AitoSoftwares" width="36" height="36"/><div><strong>{{ flow.business }}</strong><small>{{ typing ? 'digitando…' : flow.subtitle }}</small></div><q-icon name="mdi-shield-check-outline"/></header>
      <div ref="stream" class="chat-stream" role="log" aria-live="polite" aria-label="Conversa fictícia do simulador">
        <span class="demo-day">DEMONSTRAÇÃO · NENHUM ENVIO REAL</span>
        <article v-for="message in messages" :key="message.id" class="chat-bubble" :class="{ 'chat-bubble--user': message.direction === 'user' }">
          <p>{{ message.text }}</p>
          <div v-if="message.products" class="demo-products"><div v-for="product in message.products" :key="product.name"><span>{{ product.emoji }}</span><strong>{{ product.name }}</strong><small>{{ product.price }}</small></div></div>
          <div v-if="message.payment" class="demo-checkout"><q-icon name="mdi-credit-card-outline"/><div><b>R$ 89,90</b><small>Pagamento fictício · sem cobrança</small></div></div>
          <small class="bubble-time">Agora <span v-if="message.direction === 'user'">✓✓</span></small>
        </article>
        <div v-if="typing" class="typing-dots" aria-label="Preparando resposta"><i/><i/><i/></div>
      </div>
      <div class="reply-options" aria-label="Respostas rápidas">
        <button v-for="([label], index) in (node.options || [])" :key="label" type="button" :disabled="typing" @click="send(label)">{{ index + 1 }}. {{ label }}</button>
        <template v-if="node.end"><button type="button" @click="begin(selected)">Recomeçar</button><button type="button" @click="nextFlow()">Próximo exemplo →</button></template>
      </div>
      <form class="demo-composer" @submit.prevent="send()"><input v-model="draft" aria-label="Mensagem para o simulador" placeholder="Digite uma opção ou “menu”…" maxlength="500" @focus="stop"/><button type="submit" :disabled="typing || !draft.trim()" aria-label="Enviar no simulador"><q-icon name="mdi-send"/></button></form>
    </div>
    <div class="simulator-foot"><button type="button" :aria-pressed="playing" @click="togglePlayback"><q-icon :name="playing ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'"/>{{ playing ? 'Pausar reprodução' : 'Ver os 3 exemplos em loop' }}</button><span>Interaja à vontade. Tudo aqui é fictício.</span></div>
  </div>
</template>
<style scoped>
.simulator{width:100%;max-width:395px;margin:auto;color:#153c35}.scenario-tabs{display:flex;gap:5px;margin:0 auto 14px;justify-content:center;flex-wrap:wrap}.scenario-tabs button{font:inherit;font-size:11px;line-height:1.4;display:flex;align-items:center;gap:4px;padding:9px 10px;border:1px solid #9bcabd;border-radius:999px;background:#f3fff9;color:#275c4e;cursor:pointer}.scenario-tabs button[aria-pressed=true]{color:white;background:#0d7962;border-color:#0d7962}.demo-phone{padding:9px;border-radius:38px;border:2px solid #657e76;background:#142e2a;box-shadow:0 30px 65px #063e342e;position:relative;overflow:hidden}.phone-island{position:absolute;top:7px;left:50%;transform:translateX(-50%);width:85px;height:16px;background:#142e2a;border-radius:0 0 14px 14px;z-index:1}.chat-top{display:flex;gap:9px;align-items:center;padding:22px 12px 12px;background:#f8fffc;border-radius:26px 26px 0 0}.chat-top img{object-fit:contain;background:#d3f8eb;border-radius:50%;padding:4px}.chat-top>div{flex:1;min-width:0}.chat-top strong{display:block;font-size:14px;line-height:1.5}.chat-top small{display:block;font-size:9px;color:#67867b}.chat-stream{height:290px;overflow:auto;overscroll-behavior:contain;padding:14px 11px;background-color:#eaeae1;background-image:radial-gradient(#a4bdb64d .7px,transparent .7px);background-size:13px 13px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin}.demo-day{align-self:center;background:#fff9;padding:5px 8px;border-radius:6px;font-size:8px;letter-spacing:.04em;color:#60776e}.chat-bubble{align-self:flex-start;width:fit-content;max-width:94%;padding:11px 12px 6px;background:#fff;border-radius:0 12px 12px 12px;box-shadow:0 2px 5px #163d3310;font-size:12px;line-height:1.65}.chat-bubble--user{align-self:flex-end;background:#d7f7c8;border-radius:12px 0 12px 12px}.chat-bubble p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.bubble-time{display:block;text-align:right;color:#6b8175;font-size:8px;line-height:1.4;margin-top:5px}.bubble-time span{color:#238dab}.reply-options{padding:9px;background:#f4faf6;display:flex;flex-wrap:wrap;gap:6px}.reply-options button{font:inherit;flex:1 1 44%;padding:8px;border:1px solid #bad9cc;border-radius:9px;background:white;color:#087460;cursor:pointer;font-size:10px;line-height:1.4;min-height:37px}.reply-options button:disabled{opacity:.45}.demo-composer{display:flex;padding:8px;gap:7px;background:#f4faf6;border-radius:0 0 26px 26px}.demo-composer input{flex:1;min-width:0;padding:11px;border:1px solid #d1e3d9;border-radius:22px;background:white;font:inherit;font-size:10px;color:#163c31}.demo-composer button{border:0;border-radius:50%;width:37px;height:37px;background:#0c8a70;color:white;font-size:17px;cursor:pointer}.demo-composer button:disabled{opacity:.4}.simulator-foot{display:flex;align-items:center;flex-direction:column;gap:7px;padding-top:14px}.simulator-foot button{background:transparent;border:0;color:#126b55;font:inherit;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:5px}.simulator-foot span{font-size:10px;color:#66877a}.typing-dots{display:flex;gap:4px;padding:10px;border-radius:10px;background:white;align-self:flex-start}.typing-dots i{height:4px;width:4px;border-radius:50%;background:#7d9d8d;animation:blink 1s infinite alternate}.typing-dots i:nth-child(2){animation-delay:.3s}.typing-dots i:nth-child(3){animation-delay:.6s}.demo-products{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.demo-products>div{padding:8px;border:1px solid #daeade;border-radius:9px;background:#f7faf6}.demo-products span{display:block;font-size:26px;text-align:center}.demo-products strong,.demo-products small{display:block;font-size:10px}.demo-checkout{display:flex;gap:10px;align-items:center;margin-top:10px;padding:10px;border-radius:10px;background:#e8f7ee}.demo-checkout .q-icon{font-size:25px}.demo-checkout b,.demo-checkout small{display:block}.demo-checkout small{font-size:9px}button:focus-visible,input:focus-visible{outline:3px solid #1fc89c;outline-offset:2px}@keyframes blink{to{opacity:.3;transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.typing-dots i{animation:none}}@media(max-width:600px){.simulator{max-width:355px}.chat-stream{height:270px}}
</style>
