<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import MediaPreview from './MediaPreview.vue'

const props = defineProps({ data: { type: Object, required: true }, assets: { type: Array, default: () => [] }, orderStage: { type: String, default: '' } })
const typeLabel = computed(() => props.orderStage ? 'Pedido' : ({ start: 'Início', message: 'Mensagens', choice: 'Decisão', action: 'Ação', ai: 'IA', end: 'Final' })[props.data.kind] || 'Card')
const preview = computed(() => {
  const orderHints = { fulfillment: 'Pergunta retirada ou entrega e mantém o pedido atual.', address: 'Recebe endereço ou localização para entrega.', cart: 'Mostra catálogo e aceita comandos para montar o pedido.', review: 'Mostra itens, valores e endereço para confirmação.', completed: 'Registra o pedido, atualiza o estoque e envia o agradecimento.' }
  if (orderHints[props.orderStage]) return orderHints[props.orderStage]
  if (props.data.kind === 'action') {
    const action = props.data.action || {}
    if (action.type === 'http') return `${action.method || 'POST'} ${action.url || 'Configure o endpoint'}`
    if (action.type === 'wait') return `Aguardar ${action.waitMs || 0} ms`
    if (action.type === 'set_variable') return `Definir ${action.variableName || 'variável'}`
    if (action.type === 'infinitepay') return `InfinitePay: ${action.integrationKey || 'Escolha uma configuração'}`
    if (action.type === 'whatsapp') return `Enviar para ${(action.recipients || []).length + (action.contactGroupIds || []).length} destinatários/grupos`
    return action.chatAction ? `Conversa: ${action.chatAction}` : 'Configure a ação'
  }
  if (props.data.kind === 'ai') return `OpenAI: ${props.data.ai?.profileKey || 'Escolha um perfil'}`
  const messages = props.data.messages || []
  if (!messages.length) return props.data.kind === 'choice' ? 'Aguarda uma resposta e avalia as setas.' : 'Nenhuma mensagem configurada.'
  const first = messages[0]
  if (first.type === 'media') return `▧ Arquivo${first.caption ? ` · ${first.caption}` : ''}`
  if (first.type === 'location') return `⌖ ${first.locationName || 'Localização'}`
  if (first.type === 'contact') return `◉ ${first.contactName || first.contactPhone || 'Contato'}`
  return first.text || 'Mensagem vazia'
})
</script>

<template>
  <article :class="['flow-node', `flow-node--${data.kind || 'message'}`]">
    <Handle v-if="data.kind !== 'start'" type="target" :position="Position.Left" />
    <div class="node-heading"><span class="node-type">{{ typeLabel }}</span><span v-if="data.messages?.length" class="node-count">{{ data.messages.length }}</span></div>
    <strong>{{ data.label || 'Sem título' }}</strong>
    <p>{{ preview }}</p>
    <MediaPreview v-for="output in (data.messages || []).filter(item => item.type === 'media' && item.assetId)" :key="output.outputId" :asset="assets.find(asset => asset._id === output.assetId)" :document="output.sendAsDocument" />
    <div v-if="data.addTags?.length" class="node-tags"><span v-for="tag in data.addTags" :key="tag">#{{ tag }}</span></div>
    <Handle v-if="data.kind !== 'end'" type="source" :position="Position.Right" />
  </article>
</template>

<style scoped>
.flow-node{width:230px;padding:14px;border:1px solid #cfdfda;border-radius:14px;background:white;box-shadow:0 10px 25px rgba(12,43,36,.09);font-family:'DM Sans',sans-serif}.flow-node:hover{border-color:#38ae96}.flow-node--start{border-color:#36bc9f;background:#edfff9}.flow-node--choice{border-color:#82a5d8;background:#f5f8ff}.flow-node--action{border-color:#d69c4c;background:#fff9ee}.flow-node--end{border-color:#de7f8c;background:#fff5f6}.node-heading{display:flex;align-items:center;justify-content:space-between}.node-type{display:block;margin-bottom:5px;color:#16846e;font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.node-count{display:grid;min-width:20px;height:20px;place-items:center;border-radius:10px;color:#16715e;background:#dcf6ef;font-size:.58rem}.flow-node strong{display:block;font-size:.86rem}.flow-node p{display:-webkit-box;margin:7px 0 0;color:#6c7c78;font-size:.68rem;line-height:1.35;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.node-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.node-tags span{padding:2px 5px;border-radius:5px;background:#e8f6f2;color:#19715f;font-size:.56rem}.vue-flow__handle{width:10px;height:10px;border:2px solid white;background:#15977d}
</style>
