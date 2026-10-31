<script setup>
import { computed, onMounted, ref } from 'vue'
import { VueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { api, messageOf } from '../services.js'

const items = ref([])
const selectedId = ref('')
const loading = ref(true)
const error = ref('')
const selected = computed(() => items.value.find((item) => String(item.id || item._id) === selectedId.value) || items.value[0])
const commandLabels = computed(() => (selected.value?.commands || []).map((command) => typeof command === 'string' ? command : command.command).filter(Boolean).join(' · '))
const nodes = computed(() => (selected.value?.nodes || []).map((node, index) => ({
  ...node,
  id: String(node.id || node.nodeId || `native-${index}`),
  type: 'default',
  position: node.position || { x: index % 2 ? 370 : 40, y: Math.floor(index / 2) * 150 + 40 },
  data: { ...node.data, label: node.data?.label || node.label || node.name || node.type || 'Etapa' },
  style: { width: '250px', whiteSpace: 'pre-wrap', borderRadius: '13px', padding: '16px', border: '1px solid var(--line)', color: 'var(--ink)', background: 'var(--card)' },
})))
const edges = computed(() => (selected.value?.edges || []).map((edge, index) => ({
  ...edge,
  id: String(edge.id || `native-edge-${index}`),
  source: String(edge.source || edge.from || ''),
  target: String(edge.target || edge.to || ''),
  markerEnd: MarkerType.ArrowClosed,
  animated: false,
  style: { stroke: 'var(--primary-dark)' },
})))
async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/native-flows')
    items.value = data.items || []
    selectedId.value = String(items.value[0]?.id || items.value[0]?._id || '')
  } catch (cause) { error.value = messageOf(cause) }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section>
    <header class="page-head"><div><span class="eyebrow">Automações da plataforma</span><h1>Comandos nativos</h1><p>Veja como os comandos de acesso, permissões e ajuda são processados. Estes fluxos representam o comportamento do sistema e são somente para consulta.</p></div><button class="btn secondary" @click="load">Atualizar</button></header>
    <p v-if="error" class="native-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="card empty" role="status">Carregando comandos…</div>
    <div v-else-if="!items.length" class="card empty">Nenhum comando disponível.</div>
    <div v-else class="native-workspace">
      <nav class="card native-list" aria-label="Fluxos dos comandos nativos"><button v-for="item in items" :key="item.id || item._id" :class="{ active: selected === item }" @click="selectedId = String(item.id || item._id)"><strong>{{ item.name || item.command || item.trigger }}</strong><small>{{ item.description }}</small></button></nav>
      <article class="card native-diagram"><header><div><h2>{{ selected?.name }}</h2><p>{{ selected?.description }}</p><small v-if="commandLabels">{{ commandLabels }}</small></div><span class="status-chip">Somente leitura</span></header><VueFlow v-if="nodes.length" :key="selectedId" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :edges-updatable="false" :elements-selectable="true" fit-view-on-init :min-zoom="0.2" :max-zoom="1.6" aria-label="Diagrama do comando"><Background pattern-color="#a8c6bc" :gap="22"/><Controls :show-interactive="false"/></VueFlow><p v-else class="empty">O diagrama deste comando ainda não está disponível.</p></article>
    </div>
  </section>
</template>

<style scoped>
.native-workspace{display:grid;grid-template-columns:minmax(210px,280px) minmax(0,1fr);gap:18px}.native-list{display:grid;align-content:start;gap:8px;padding:12px}.native-list button{display:grid;gap:7px;text-align:left;padding:14px;border:1px solid transparent;border-radius:11px;background:transparent;color:var(--ink)}.native-list button.active{border-color:var(--primary-dark);background:color-mix(in srgb,var(--mint) 20%,white)}.native-list strong{font-size:13px}.native-list small{font-size:12px;line-height:1.5;color:var(--muted)}.native-diagram{min-width:0;overflow:hidden}.native-diagram>header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:20px;border-bottom:1px solid var(--line)}.native-diagram h2{font-size:18px;margin:0 0 7px}.native-diagram p{font-size:13px;color:var(--muted);margin:0}.native-diagram header small{display:block;margin-top:8px;color:var(--primary-dark)}.native-diagram .vue-flow{height:580px;min-height:400px;background:var(--app-background)}.native-error{color:#b72b42}@media(max-width:900px){.native-workspace{grid-template-columns:1fr}.native-list{display:flex;overflow:auto}.native-list button{min-width:210px}.native-diagram .vue-flow{height:490px}}@media(max-width:600px){.native-diagram>header{flex-direction:column;padding:16px}}
</style>
