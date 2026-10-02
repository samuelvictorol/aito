<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { VueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import FlowNode from './FlowNode.vue'
import FlowMediaPreview from './FlowMediaPreview.vue'
import BotSimulator from './BotSimulator.vue'
import { registerEditorGuard } from 'src/services/bot-editor-guard'
import { botApi as api, messageOf, currentAdmin } from 'src/services/whatsapp'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const props = defineProps({ flowId: { type: String, required: true } })
const emit = defineEmits(['back', 'saved'])
const simulationText = ref('Olá')
const version = ref(0)
const editorRoot = ref(null), inspectorOpen = ref(false), simulatorOpen = ref(false), fullscreen = ref(false)
const copiedNode = ref(null)
let unregisterGuard, headObserver, flowInstance
const diagramOnly = ref(false)
const conflictDraft = ref(null)
const draftKey = `aito.bot.flow.${currentAdmin().id || 'admin'}.${props.flowId}`
const nodes = ref([]), edges = ref([])
const meta = ref({ name: '', description: '', active: false, channels: ['whatsapp'], settings: {} })
const aiProfiles = ref([])
const defaultAI = () => ({ profileKey: '', includeHistory: true, historyLimit: 20 })
const assets = ref([]), selectedNodeId = ref(''), selectedEdgeId = ref(''), keywordDraft = ref('')
const loading = ref(true), saving = ref(false), dirty = ref(false), toast = ref(''), analysis = ref({ errors: [], warnings: [], conflicts: [] })
const previewOpen = ref(false), testingAction = ref(false), actionResult = ref(null), uploading = ref(false)
const history = ref([]), future = ref([])
let savedSnapshot = '', trackedSnapshot = '', historyTimer, suspendTracking = true

const selectedNode = computed(() => nodes.value.find((item) => item.id === selectedNodeId.value))
const selectedEdge = computed(() => edges.value.find((item) => item.id === selectedEdgeId.value))
const canUndo = computed(() => history.value.length > 0 || serializeEditor() !== trackedSnapshot)
const canRedo = computed(() => future.value.length > 0)

function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() }
function defaultAction(type = 'http') { return { type, method: 'POST', url: '', headers: [{ name: 'Content-Type', value: 'application/json' }], body: '{\n  "mensagem": "{{mensagem}}",\n  "telefone": "{{telefone}}"\n}', timeoutMs: 10000, resultVariable: 'api_result', continueOnError: false, waitMs: 1000, variableName: '', variableValue: '', chatAction: '', chatActionValue: 60 } }
function defaultOutput(type = 'text') { return { outputId: crypto.randomUUID(), type, text: type === 'text' ? 'Digite aqui a resposta do bot.' : '', assetId: null, caption: '', sendAsVoice: false, sendAsDocument: false, latitude: null, longitude: null, locationName: '', locationAddress: '', contactPhone: '', contactName: '' } }

const localConflicts = computed(() => {
  const seen = new Map(), conflicts = []
  for (const edge of edges.value) for (const raw of edge.data?.keywords || []) {
    const word = normalize(raw).replaceAll(' ', ''), key = `${edge.source}:${word}`
    if (word && seen.has(key) && seen.get(key) !== edge.id) conflicts.push({ keyword: word, edgeIds: [seen.get(key), edge.id] })
    else if (word) seen.set(key, edge.id)
  }
  return conflicts
})
const edgeHasConflict = computed(() => selectedEdge.value && localConflicts.value.some((item) => item.edgeIds.includes(selectedEdge.value.id)))

function mapFlow(flow) {
  version.value = flow.version || version.value
  meta.value = { name: flow.name, description: flow.description, active: flow.active, channels: ['whatsapp'], settings: { messageIntervalMs: 1000, ...flow.settings } }
  nodes.value = (flow.nodes || []).map((node) => ({
    id: node.nodeId, type: 'bot', position: node.position,
    data: { ...node.data, ai: { ...defaultAI(), ...node.data?.ai }, messages: (node.data?.messages || []).map((item) => ({ ...defaultOutput(item.type), ...item, assetId: item.assetId || null })), action: { ...defaultAction(node.data?.action?.type), ...(node.data?.action || {}) }, kind: node.type },
  }))
  edges.value = (flow.edges || []).map((edge) => ({ id: edge.edgeId, source: edge.source, target: edge.target, label: edge.label || edge.keywords?.join(' · ') || 'automático', markerEnd: MarkerType.ArrowClosed, data: { keywords: [...(edge.keywords || [])], regex: edge.regex || '', matchMode: edge.matchMode || 'any', priority: edge.priority || 0 }, style: { stroke: '#249e85', strokeWidth: 2 } }))
}

function flowPayload() {
  return {
    ...meta.value, version: version.value, channels: ['whatsapp'], settings: { ...meta.value.settings, messageIntervalMs: 1000 },
    nodes: nodes.value.map((node) => ({ nodeId: node.id, type: node.data.kind, position: node.position, data: { ...(node.data.kind === 'ai' ? { ai: { ...node.data.ai } } : {}), label: node.data.label, messages: (node.data.messages || []).map((item) => ({ ...item })), action: { ...node.data.action, headers: (node.data.action?.headers || []).map((item) => ({ ...item })) }, addTags: node.data.addTags || [], removeTags: node.data.removeTags || [], resetContext: Boolean(node.data.resetContext) } })),
    edges: edges.value.map((edge) => ({ edgeId: edge.id, source: edge.source, target: edge.target, label: edge.label || '', keywords: edge.data?.keywords || [], regex: edge.data?.regex || '', matchMode: edge.data?.matchMode || 'any', priority: Number(edge.data?.priority || 0) })),
  }
}
const previewData = computed(() => JSON.stringify(flowPayload(), null, 2))

function serializeEditor() { return JSON.stringify(flowPayload()) }
function applySnapshot(snapshot) {
  if (!snapshot) return
  clearTimeout(historyTimer)
  suspendTracking = true
  const value = JSON.parse(snapshot)
  mapFlow(value)
  selectedNodeId.value = ''; selectedEdgeId.value = ''; previewOpen.value = false
  trackedSnapshot = snapshot
  dirty.value = snapshot !== savedSnapshot
  nextTick(() => { suspendTracking = false })
}
function flushHistory() {
  clearTimeout(historyTimer)
  const current = serializeEditor()
  if (trackedSnapshot && current !== trackedSnapshot) {
    history.value.push(trackedSnapshot)
    if (history.value.length > 80) history.value.shift()
    trackedSnapshot = current
    future.value = []
  }
}
function undo() {
  flushHistory()
  const previous = history.value.pop()
  if (!previous) return
  future.value.push(serializeEditor())
  applySnapshot(previous)
}
function redo() {
  const next = future.value.pop()
  if (!next) return
  history.value.push(serializeEditor())
  applySnapshot(next)
}
function discard() {
  if (!dirty.value || confirm('Descartar todas as alterações feitas desde o último salvamento?')) {
    history.value = []; future.value = []; applySnapshot(savedSnapshot); sessionStorage.removeItem(draftKey); showToast('Alterações descartadas.')
  }
}

watch([meta, nodes, edges], () => {
  if (suspendTracking || loading.value) return
  const current = serializeEditor()
  dirty.value = current !== savedSnapshot
  clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    if (current !== trackedSnapshot) {
      history.value.push(trackedSnapshot)
      if (history.value.length > 80) history.value.shift()
      trackedSnapshot = current
      future.value = []
    }
  }, 400)
}, { deep: true })

watch(selectedEdgeId, () => { keywordDraft.value = selectedEdge.value?.data?.keywords?.join('\n') || '' })

async function loadAssets() { try { assets.value = (await api.get('/assets', { params: { limit: 100 } })).data.items } catch { assets.value = [] } }
async function load() {
  loading.value = true; suspendTracking = true
  try {
    const [{ data }] = await Promise.all([api.get(`/flows/${props.flowId}`), loadAssets(), api.get('/ai-profiles').then(response => { aiProfiles.value = response.data.items }).catch(() => { aiProfiles.value = []; showToast('Configurações de IA indisponíveis. Atualize a página após a atualização do servidor.') })])
    mapFlow(data.flow); analysis.value = data.analysis
    savedSnapshot = serializeEditor(); trackedSnapshot = savedSnapshot; history.value = []; future.value = []; dirty.value = false
    try { const draft = sessionStorage.getItem(draftKey); if (draft && draft !== savedSnapshot) { const parsed = JSON.parse(draft); if (parsed.version === version.value) { mapFlow(parsed); dirty.value = true; trackedSnapshot = serializeEditor(); showToast('Rascunho recuperado. Revise e salve para aplicar.'); } else conflictDraft.value = parsed; } } catch { /* Invalid local drafts are ignored. */ }
  } catch (cause) { showToast(messageOf(cause)) }
  finally { loading.value = false; await nextTick(); suspendTracking = false }
}
async function save() {
  if (saving.value || loading.value) return
  saving.value = true; flushHistory()
  try {
    const { data } = await api.put(`/flows/${props.flowId}`, flowPayload())
    suspendTracking = true; analysis.value = data.analysis; mapFlow(data.flow)
    savedSnapshot = serializeEditor(); trackedSnapshot = savedSnapshot; history.value = []; future.value = []; dirty.value = false
    sessionStorage.removeItem(draftKey); conflictDraft.value = null
    await nextTick(); suspendTracking = false; showToast(meta.value.active ? 'Fluxo salvo e aplicado.' : 'Fluxo salvo. Ative-o na lista quando estiver pronto.'); emit('saved')
  } catch (cause) {
    const payload = cause?.response?.data; analysis.value = payload?.analysis || analysis.value; showToast(messageOf(cause))
    if (cause?.response?.status === 409) { try { sessionStorage.setItem(draftKey, serializeEditor()) } catch { /* Keep the current editor if browser storage fails. */ }; await load() }
  } finally { saving.value = false }
}
function showToast(value) { toast.value = value; window.setTimeout(() => { if (toast.value === value) toast.value = '' }, 3400) }

function addNode(kind = 'message', preset) {
  const id = crypto.randomUUID(), count = nodes.value.length
  const labels = { message: 'Mensagens', choice: 'Decisão', action: 'Ação', ai: 'Funções com I.A.', end: 'Final' }
  const messages = ['action', 'ai'].includes(kind) ? [] : [defaultOutput(preset === 'media' ? 'media' : 'text')]
  const action = defaultAction(preset === 'wait' ? 'wait' : 'http')
  nodes.value.push({ id, type: 'bot', position: { x: 180 + (count % 3) * 290, y: 100 + Math.floor(count / 3) * 200 }, data: { ai: defaultAI(), kind: preset === 'media' ? 'message' : kind, label: preset === 'media' ? 'Arquivo' : preset === 'wait' ? 'Espera' : labels[kind] || 'Novo card', messages, action, addTags: [], removeTags: [], resetContext: false } })
  selectedNodeId.value = id; selectedEdgeId.value = ''; previewOpen.value = false
}
function connect(params) {
  const id = crypto.randomUUID()
  edges.value.push({ ...params, id, label: 'nova condição', markerEnd: MarkerType.ArrowClosed, data: { keywords: [], regex: '', matchMode: 'any', priority: 0 }, style: { stroke: '#249e85', strokeWidth: 2 } })
  selectedEdgeId.value = id; selectedNodeId.value = ''; previewOpen.value = false
}
function selectNode({ node }) { selectedNodeId.value = node.id; selectedEdgeId.value = ''; previewOpen.value = false }
function selectEdge({ edge }) { selectedEdgeId.value = edge.id; selectedNodeId.value = ''; previewOpen.value = false }
function clearSelection() { selectedNodeId.value = ''; selectedEdgeId.value = '' }
function removeSelected() {
  if (selectedNode.value) {
    if (selectedNode.value.data.kind === 'start') { showToast('O card inicial não pode ser removido.'); return }
    if (!confirm(`Remover o card “${selectedNode.value.data.label}” e suas conexões?`)) return
    const id = selectedNode.value.id; nodes.value = nodes.value.filter((node) => node.id !== id); edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  } else if (selectedEdge.value) edges.value = edges.value.filter((edge) => edge.id !== selectedEdge.value.id)
  clearSelection()
}
function syncKeywords() { if (selectedEdge.value) selectedEdge.value.data.keywords = keywordDraft.value.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) }
function tags(value) { return String(value || '').split(/[;,\n]+/).map((item) => normalize(item).replaceAll(' ', '-')).filter(Boolean) }
function setTags(key, value) { if (selectedNode.value) selectedNode.value.data[key] = tags(value) }
const addTagsText = computed({ get: () => selectedNode.value?.data?.addTags?.join(', ') || '', set: (value) => setTags('addTags', value) })
const removeTagsText = computed({ get: () => selectedNode.value?.data?.removeTags?.join(', ') || '', set: (value) => setTags('removeTags', value) })
function addOutput(type) { selectedNode.value?.data.messages.push(defaultOutput(type)) }
function moveOutput(index, offset) {
  const outputs = selectedNode.value?.data.messages, target = index + offset
  if (!outputs || target < 0 || target >= outputs.length) return
  flushHistory(); outputs.splice(target, 0, outputs.splice(index, 1)[0]); flushHistory()
}
function removeOutput(index) { selectedNode.value?.data.messages.splice(index, 1) }
function addHeader() { selectedNode.value?.data.action.headers.push({ name: '', value: '' }) }
function removeHeader(index) { selectedNode.value?.data.action.headers.splice(index, 1) }
async function uploadAsset(event, output) {
  const file = event.target.files?.[0]; if (!file) return
  uploading.value = true
  try {
    const form = new FormData(); form.append('file', file); form.append('name', file.name); form.append('permanent', 'true')
    const { data } = await api.post('/assets', form); assets.value.unshift(data); output.assetId = data._id; showToast('Arquivo salvo na biblioteca.')
  } catch (cause) { showToast(messageOf(cause)) }
  finally { uploading.value = false; event.target.value = '' }
}
async function testAction() {
  if (!selectedNode.value) return
  testingAction.value = true; actionResult.value = null
  try { actionResult.value = (await api.post(`/flows/${props.flowId}/simulate`, { flow: flowPayload(), nodeId: selectedNode.value.id, text: simulationText.value, isNewContext: false })).data }
  catch (cause) { actionResult.value = cause?.response?.data || { error: messageOf(cause) } }
  finally { testingAction.value = false }
}
function openPreview() { inspectorOpen.value = true; previewOpen.value = !previewOpen.value; if (previewOpen.value) clearSelection() }
function canLeave() {
  if (saving.value) { showToast('Aguarde o salvamento terminar.'); return false }
  if (!dirty.value) return true
  if (!confirm('Há alterações não salvas. Sair e descartar? Para salvar, cancele e use Salvar e aplicar.')) return false
  clearTimeout(historyTimer); dirty.value = false; sessionStorage.removeItem(draftKey)
  return true
}
function goBack() { if (canLeave()) emit('back') }
function copyNode() {
  if (!selectedNode.value || selectedNode.value.data.kind === 'start') return
  copiedNode.value = JSON.parse(JSON.stringify(selectedNode.value))
  showToast('Card copiado. Use Ctrl+V ou Colar card.')
}
function pasteNode() {
  if (!copiedNode.value || nodes.value.length >= 150) return
  flushHistory()
  const node = JSON.parse(JSON.stringify(copiedNode.value))
  node.id = crypto.randomUUID(); node.selected = false
  node.position = { x: node.position.x + 45, y: node.position.y + 45 }
  node.data.messages = node.data.messages.map(output => ({ ...output, outputId: crypto.randomUUID() }))
  nodes.value.push(node); selectedNodeId.value = node.id; selectedEdgeId.value = ''
  copiedNode.value = node
}
async function exportJson() {
  try {
    const { data } = await api.post('/flows/export', flowPayload())
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url
    link.download = `${meta.value.name.replace(/[^a-z0-9_-]/gi, '_') || 'fluxograma'}.aito.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) { showToast(messageOf(cause)) }
}
async function toggleFullscreen(onlyDiagram = false) {
  diagramOnly.value = onlyDiagram
  if (fullscreen.value) {
    if (document.fullscreenElement) await document.exitFullscreen()
    fullscreen.value = false; diagramOnly.value = false
  } else {
    fullscreen.value = true
    try { await editorRoot.value.requestFullscreen?.() } catch { /* CSS fills the viewport on browsers without Fullscreen support. */ }
  }
  await nextTick(); window.requestAnimationFrame(() => flowInstance?.fitView({ padding: 0.2 }))
}
function fullscreenChanged() { if (!document.fullscreenElement) { fullscreen.value = false; diagramOnly.value = false } }
function restoreConflictingDraft() { const previous = conflictDraft.value; if (!previous) return; mapFlow({ ...previous, version: version.value }); conflictDraft.value = null; dirty.value = true; showToast('Rascunho recuperado para revisão. Salve somente após comparar as alterações.') }
function beforeUnload(event) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
function keydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return }
  if (event.target?.closest('input,textarea,select,[contenteditable=true]')) return
  if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'd'].includes(event.key.toLowerCase())) { event.preventDefault(); if (event.key.toLowerCase() !== 'v') copyNode(); if (event.key.toLowerCase() !== 'c') pasteNode(); return }
  if (event.key === 'Escape' && fullscreen.value && !document.fullscreenElement) { fullscreen.value = false; diagramOnly.value = false; return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
  if ((event.key === 'Delete' || event.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) && (selectedNode.value || selectedEdge.value)) { event.preventDefault(); removeSelected() }
}

onBeforeRouteLeave(() => canLeave())
onMounted(() => { unregisterGuard = registerEditorGuard(canLeave); document.addEventListener('fullscreenchange', fullscreenChanged); headObserver = new ResizeObserver(entries => editorRoot.value?.style.setProperty('--builder-head-height', `${entries[0].target.offsetHeight + 12}px`)); headObserver.observe(editorRoot.value.querySelector('.builder-head')); load(); window.addEventListener('beforeunload', beforeUnload); window.addEventListener('keydown', keydown) })
onBeforeUnmount(() => { unregisterGuard?.(); headObserver?.disconnect(); document.removeEventListener('fullscreenchange', fullscreenChanged); if (dirty.value) { try { sessionStorage.setItem(draftKey, serializeEditor()) } catch { /* Browser storage may be disabled. */ } }; clearTimeout(historyTimer); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keydown) })
</script>

<template>
  <section ref="editorRoot" :class="['builder-page', { fullscreen, 'diagram-only': diagramOnly }]">
    <div class="builder-head">
      <button class="icon-button" title="Voltar para os fluxos" @click="goBack">←</button>
      <div><input v-model="meta.name" class="title-input" aria-label="Nome do fluxo"><span>{{ dirty ? 'Alterações ainda não salvas' : 'Tudo salvo e sincronizado' }}</span></div>
      <span class="status-chip">{{ meta.active ? 'Fluxo ativo' : 'Rascunho' }}</span>
      <button v-if="dirty" class="btn ghost" @click="discard">Descartar</button>
      <button class="btn ghost" @click="simulatorOpen = true">Simular bot</button>
      <button class="btn" :disabled="loading || saving || localConflicts.length > 0" @click="save">{{ saving ? 'Salvando…' : 'Salvar e aplicar' }}</button>
    </div>
    <div v-if="analysis.errors?.length || localConflicts.length" class="validation danger"><b>Corrija antes de salvar:</b> {{ analysis.errors?.[0] || `Há ${localConflicts.length} palavra(s)-chave repetida(s).` }}</div>
    <div v-if="conflictDraft" class="validation"><b>Outro administrador atualizou este fluxo.</b> A versão atual está aberta e seu rascunho foi preservado. <button class="btn ghost" @click="restoreConflictingDraft">Revisar meu rascunho</button></div>
    <div v-else-if="analysis.warnings?.length" class="validation"><b>Atenção:</b> {{ analysis.warnings[0] }}</div>
    <div v-if="loading" class="card empty">Carregando editor…</div>
    <div v-else class="builder-shell card">
      <div class="canvas-toolbar">
        <button class="tool-button" data-help="Envia um ou vários balões, com 1 segundo entre eles." @click="addNode('message')">＋ Mensagem</button>
        <button class="tool-button" data-help="Avalia palavras, opções ou expressão regular para escolher um caminho." @click="addNode('choice')">◇ Decisão</button>
        <button class="tool-button" data-help="Chama uma API, define variável, aguarda ou executa uma operação na conversa." @click="addNode('action')">⚡ Ação</button>
        <button class="tool-button" data-help="Encerra a jornada atual e prepara o próximo contato para recomeçar." @click="addNode('end')">◎ Final</button>
        <button class="tool-button extra" data-help="Cria um card já preparado para escolher imagem, áudio, vídeo ou documento." @click="addNode('message','media')">▧ Arquivo</button>
        <button class="tool-button extra" data-help="Cria uma pausa silenciosa antes do próximo card." @click="addNode('action','wait')">◷ Espera</button>
        <button class="tool-button" @click="addNode('ai')">✦ Funções com I.A.</button>
        <span class="toolbar-spacer"></span>
        <button class="tool-button" title="Exportar arquivo Aito JSON" @click="exportJson">Exportar JSON</button>
        <button class="icon-button" title="Tela cheia" @click="toggleFullscreen(false)"><q-icon name="mdi-fullscreen" /></button>
        <button class="icon-button" title="Tela cheia do diagrama" @click="toggleFullscreen(true)"><q-icon name="mdi-fit-to-screen-outline" /></button>
        <button class="icon-button" title="Copiar card (Ctrl+C)" :disabled="!selectedNode || selectedNode.data.kind === 'start'" @click="copyNode"><q-icon name="mdi-content-copy" /></button>
        <button class="icon-button" title="Colar card (Ctrl+V)" :disabled="!copiedNode" @click="pasteNode"><q-icon name="mdi-content-paste" /></button>

        <button class="icon-button" title="Desfazer (Ctrl+Z)" :disabled="!canUndo" @click="undo">↶</button>
        <button class="icon-button" title="Refazer (Ctrl+Shift+Z)" :disabled="!canRedo" @click="redo">↷</button>
        <button :class="['icon-button',{active:previewOpen}]" title="Visualizar dados do fluxograma" @click="openPreview"><q-icon name="mdi-code-json" /></button>
        <button v-if="selectedNode || selectedEdge" class="icon-button delete-button" title="Remover seleção (Delete)" @click="removeSelected">×</button>
      </div>
      <div class="flow-canvas">
        <VueFlow @init="flowInstance = $event" v-model:nodes="nodes" v-model:edges="edges" fit-view-on-init :min-zoom="0.25" :max-zoom="1.8" @connect="connect" @node-click="selectNode" @edge-click="selectEdge" @pane-click="clearSelection">
          <template #node-bot="props"><FlowNode v-bind="props" /></template>
          <Background pattern-color="#cbdad6" :gap="22" />
          <MiniMap pannable zoomable node-color="#75d9c3" />
          <Controls />
        </VueFlow>
      </div>
      <div v-if="inspectorOpen" class="inspector-backdrop" @click="inspectorOpen = false"></div>
      <aside :class="['inspector', { 'mobile-open': inspectorOpen }]" :role="inspectorOpen ? 'dialog' : undefined" :aria-modal="inspectorOpen || undefined" aria-label="Configurar card">
        <button class="inspector-close btn" @click="inspectorOpen = false">Concluir configuração</button>
        <template v-if="previewOpen">
          <span class="eyebrow">Preview técnico</span><h2>Dados do fluxograma</h2>
          <p class="tip">Este é exatamente o conteúdo validado e salvo. Credenciais não aparecem aqui: use <code v-pre>{{secret.NOME}}</code>.</p>
          <pre class="data-preview">{{ previewData }}</pre>
        </template>
        <template v-else-if="selectedNode">
          <div class="inspector-title"><div><span class="eyebrow">Configurar card</span><h2>{{ selectedNode.data.label }}</h2></div><button v-if="selectedNode.data.kind !== 'start'" class="icon-button delete-button" title="Remover este card" @click="removeSelected">×</button></div>
          <div class="field"><label>Tipo</label><select v-model="selectedNode.data.kind" :disabled="selectedNode.data.kind === 'start'"><option value="start">Início</option><option value="message">Mensagem</option><option value="choice">Decisão</option><option value="action">Ação</option><option value="ai">Funções com I.A.</option><option value="end">Final</option></select></div>
          <div class="field"><label>Título interno</label><input v-model="selectedNode.data.label"></div>

          <section v-if="selectedNode.data.kind === 'ai'">
            <div class="field"><label>Configuração de IA</label><select v-model="selectedNode.data.ai.profileKey"><option value="">Selecione…</option><option v-for="profile in aiProfiles" :key="profile.key" :value="profile.key">{{ profile.title }} · {{ profile.model }}</option></select><small>Cadastre os assistentes na aba Integrações.</small></div>
            <label class="toggle"><input v-model="selectedNode.data.ai.includeHistory" type="checkbox"> Enviar contexto desta conversa</label>
            <div v-if="selectedNode.data.ai.includeHistory" class="field"><label>Últimas mensagens enviadas e recebidas</label><input v-model.number="selectedNode.data.ai.historyLimit" type="number" min="1" max="50"></div>
            <p class="tip">Ao entrar, envia os balões abaixo e aguarda a próxima pergunta. A IA responde até o cliente usar menu, uma condição de saída ou atingir o tempo de inatividade.</p>
          </section>
          <div v-if="selectedNode.data.kind === 'action'" class="action-editor">
            <div class="field"><label>O que executar?</label><select v-model="selectedNode.data.action.type"><option value="http">Chamar endpoint HTTP</option><option value="wait">Aguardar</option><option value="set_variable">Definir variável</option><option value="chat">Ação na conversa</option></select></div>
            <template v-if="selectedNode.data.action.type === 'http'">
              <div class="method-url"><select v-model="selectedNode.data.action.method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input v-model="selectedNode.data.action.url" placeholder="https://api.exemplo.com/webhook"></div>
              <div class="subhead"><b>Cabeçalhos</b><button @click="addHeader">＋ adicionar</button></div>
              <div v-for="(header,index) in selectedNode.data.action.headers" :key="index" class="header-row"><input v-model="header.name" placeholder="Authorization"><input v-model="header.value" placeholder="Bearer {{secret.CRM_TOKEN}}"><button title="Remover cabeçalho" @click="removeHeader(index)">×</button></div>
              <div class="field"><label>Payload</label><textarea v-model="selectedNode.data.action.body" class="code-input" spellcheck="false" @keydown.stop></textarea><small>Variáveis: <code v-pre>{{mensagem}}</code>, <code v-pre>{{telefone}}</code>, <code v-pre>{{nome}}</code> e <code v-pre>{{secret.NOME}}</code>.</small></div>
              <div class="two-fields"><div class="field"><label>Timeout (ms)</label><input v-model.number="selectedNode.data.action.timeoutMs" type="number" min="500" max="30000"></div><div class="field"><label>Salvar resposta em</label><input v-model="selectedNode.data.action.resultVariable" placeholder="api_result"></div></div>
              <label class="toggle compact"><input v-model="selectedNode.data.action.continueOnError" type="checkbox"> Continuar se a API falhar</label>
              <button class="btn test-button" :disabled="testingAction" @click="testAction">{{ testingAction ? 'Testando…' : '▶ Simular ação (sem envio)' }}</button>
              <pre v-if="actionResult" :class="['test-result',{failed:actionResult.ok===false||actionResult.error}]">{{ JSON.stringify(actionResult,null,2) }}</pre>
            </template>
            <template v-else-if="selectedNode.data.action.type === 'wait'"><div class="field"><label>Tempo de espera (ms)</label><input v-model.number="selectedNode.data.action.waitMs" type="number" min="0" max="60000"><small>A pausa acontece sem mostrar “digitando”.</small></div></template>
            <template v-else-if="selectedNode.data.action.type === 'set_variable'"><div class="field"><label>Nome da variável</label><input v-model="selectedNode.data.action.variableName" placeholder="protocolo"></div><div class="field"><label>Valor</label><textarea v-model="selectedNode.data.action.variableValue" @keydown.stop></textarea></div></template>
            <template v-else><div class="field"><label>Operação</label><select v-model="selectedNode.data.action.chatAction"><option value="">Selecione…</option><option value="takeover">Encaminhar para atendimento humano</option><option value="bot">Retomar bot</option><option value="close">Finalizar atendimento</option><option value="seen">Marcar como lida</option><option value="unread">Marcar como não lida</option><option value="archive">Arquivar</option><option value="unarchive">Desarquivar</option><option value="pin">Fixar</option><option value="unpin">Desafixar</option><option value="mute">Silenciar</option><option value="unmute">Remover silêncio</option></select></div><div v-if="selectedNode.data.action.chatAction==='mute'" class="field"><label>Minutos</label><input v-model.number="selectedNode.data.action.chatActionValue" type="number" min="1"></div></template>
          </div>

          <template v-if="selectedNode.data.kind !== 'action'">
            <div class="messages-head"><div><b>Mensagens enviadas</b><small>1 segundo entre cada balão</small></div><div class="add-output"><button title="Adicionar texto" @click="addOutput('text')">＋ Texto</button><button title="Adicionar arquivo" @click="addOutput('media')">▧</button><button title="Adicionar localização" @click="addOutput('location')">⌖</button><button title="Adicionar contato" @click="addOutput('contact')">◉</button></div></div>
            <article v-for="(output,index) in selectedNode.data.messages" :key="output.outputId" class="output-card">
              <header><span>Balão {{ index + 1 }}</span><select v-model="output.type"><option value="text">Texto</option><option value="media">Arquivo</option><option value="location">Localização</option><option value="contact">Contato</option></select><button title="Mover balão para cima" aria-label="Mover balão para cima" :disabled="index === 0" @click="moveOutput(index, -1)">↑</button><button title="Mover balão para baixo" aria-label="Mover balão para baixo" :disabled="index === selectedNode.data.messages.length - 1" @click="moveOutput(index, 1)">↓</button><button title="Remover este balão" @click="removeOutput(index)">×</button></header>
              <textarea v-if="output.type === 'text'" v-model="output.text" placeholder="Escreva a mensagem…" @keydown.stop></textarea>
              <template v-else-if="output.type === 'media'">
                <select v-model="output.assetId"><option :value="null">Selecione da biblioteca…</option><option v-for="asset in assets" :key="asset._id" :value="asset._id">{{ asset.name }} · {{ Math.ceil(asset.size/1024) }} KB</option></select>
                <label class="inline-upload">{{ uploading ? 'Enviando…' : '＋ Fazer upload' }}<input type="file" :disabled="uploading" @change="uploadAsset($event,output)"></label>
                <FlowMediaPreview v-if="output.assetId" :asset-id="output.assetId" :name="assets.find(asset => asset._id === output.assetId)?.name" />
                <input v-model="output.caption" placeholder="Legenda opcional">
                <div class="checks compact"><label><input v-model="output.sendAsVoice" type="checkbox"> Enviar áudio como voz</label><label><input v-model="output.sendAsDocument" type="checkbox"> Enviar como documento</label></div>
              </template>
              <template v-else-if="output.type === 'location'"><input v-model="output.locationName" placeholder="Nome do local"><input v-model="output.locationAddress" placeholder="Endereço"><div class="two-fields"><input v-model.number="output.latitude" type="number" step="any" placeholder="Latitude"><input v-model.number="output.longitude" type="number" step="any" placeholder="Longitude"></div></template>
              <template v-else><input v-model="output.contactName" placeholder="Nome para identificar no fluxo"><input v-model="output.contactPhone" inputmode="tel" placeholder="5511999999999"></template>
            </article>
            <p v-if="!selectedNode.data.messages.length" class="tip">Este card não envia nada. Adicione um balão acima ou use-o apenas para organizar caminhos.</p>
          </template>
          <div class="field"><label>Adicionar etiquetas</label><input v-model="addTagsText" placeholder="lead, interesse"></div>
          <div class="field"><label>Remover etiquetas</label><input v-model="removeTagsText"></div>
          <label class="toggle compact"><input v-model="selectedNode.data.resetContext" type="checkbox"> Reiniciar contexto após este card</label>
        </template>
        <template v-else-if="selectedEdge">
          <span class="eyebrow">Condição da seta</span><h2>Quando seguir este caminho?</h2>
          <div :class="['field',{conflict:edgeHasConflict}]"><label>Palavras e opções</label><textarea v-model="keywordDraft" placeholder="1&#10;orçamento&#10;quero comprar" @input="syncKeywords" @keydown.stop></textarea><small v-if="edgeHasConflict">Uma palavra já existe em outra seta deste card.</small><small v-else>Uma por linha. Enter agora funciona normalmente. Deixe vazio para uma passagem automática.</small></div>
          <div class="field"><label>Nome visual da seta</label><input v-model="selectedEdge.label"></div>
          <div class="field"><label>Regex opcional</label><input v-model="selectedEdge.data.regex" placeholder="^(quero|preciso).*bot"><small>Expressões potencialmente perigosas são recusadas.</small></div>
          <div class="two-fields"><div class="field"><label>Combinação</label><select v-model="selectedEdge.data.matchMode"><option value="any">Qualquer termo</option><option value="all">Todos os termos</option></select></div><div class="field"><label>Prioridade</label><input v-model.number="selectedEdge.data.priority" type="number"></div></div>
          <p class="tip">Se mais de uma condição combinar, segue a seta de maior prioridade. Uma seta sem condição continua automaticamente após mensagens ou ações.</p>
          <button class="btn danger full-button" @click="removeSelected">Remover esta conexão</button>
        </template>
        <template v-else>
          <span class="eyebrow">Configurações do fluxo</span><h2>Comportamento geral</h2>
          <div class="field"><label>Descrição</label><textarea v-model="meta.description" @keydown.stop></textarea></div>
          <div class="channel-only"><span>◉</span><div><b>WhatsApp Web</b><small>Triagem por regras, sem inteligência artificial</small></div></div>
          <div class="field"><label>Resetar conversa após (minutos)</label><input v-model.number="meta.settings.resetAfterMinutes" type="number" min="1" max="43200"></div>
          <div class="field"><label>Resposta quando não entender</label><textarea v-model="meta.settings.fallbackMessage" @keydown.stop></textarea></div>
          <label class="toggle compact"><input v-model="meta.settings.matchFirstMessage" type="checkbox"> Interpretar a primeira mensagem além de cumprimentar</label>
          <p class="tip">As mensagens múltiplas usam intervalo fixo de 1 segundo. Não há simulação de digitação.</p>
          <button class="btn full-button" @click="simulatorOpen = true">Simular bot</button>
          <p class="tip">Teste a conversa antes de salvar e aplicar.</p>
        </template>
      </aside>
    </div>
    <button class="configure-floating btn" @click="inspectorOpen = !inspectorOpen"><q-icon name="mdi-tune" />{{ selectedNode ? 'Configurar card' : selectedEdge ? 'Configurar conexão' : 'Configurar fluxo' }}</button>
    <BotSimulator v-if="simulatorOpen" :flow-id="flowId" :flow="flowPayload()" :assets="assets" @close="simulatorOpen = false" />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped>
.builder-page{--line:#d3e4dc;--ink:#152f29;--muted:#608175;color:#152f29;background:#f1f8f5;padding:16px}.builder-page button,.builder-page input,.builder-page textarea,.builder-page select{font:inherit}.builder-page button{cursor:pointer}.builder-page .card{border:1px solid var(--line);border-radius:12px;background:white}.builder-page .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 14px;border:0;border-radius:8px;color:white;background:#087563;font-size:12px;font-weight:700}.builder-page .btn:disabled{opacity:.5;cursor:not-allowed}.builder-page .btn.ghost{color:#157760;background:transparent}.builder-page .btn.danger{color:#b4324a;background:#ffecef}.builder-page .icon-button{display:grid;width:36px;height:36px;place-items:center;border:1px solid var(--line);border-radius:8px;background:white;color:#27594b}.builder-page .field{display:grid;gap:6px}.builder-page .field label{font-size:12px;font-weight:600}.builder-page .field input,.builder-page .field textarea,.builder-page .field select{width:100%;padding:9px;border:1px solid #c9ddd3;border-radius:7px;background:white;color:#16382e}.builder-page .field small{font-size:10px}.builder-page .field textarea{min-height:85px;resize:vertical}.builder-page .toggle{display:inline-flex;align-items:center;gap:7px}.builder-page .toggle input{accent-color:#0c9476}.builder-page .eyebrow{color:#168168;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.builder-page .toast{position:fixed;bottom:80px;pointer-events:none;right:20px;z-index:8000;max-width:90vw;padding:14px;background:#144e40;color:white;border-radius:10px}.builder-page .status-chip{padding:6px 9px;border-radius:15px;background:#d7eee3;color:#1a7357;font-size:11px}.builder-page .title-input{color:#152f29;font-family:inherit}.builder-page :deep(.vue-flow__controls-button){color:#173b2e;background:white}.builder-page .empty{display:grid;place-items:center;padding:50px}
.builder-page{max-width:none}.builder-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.builder-head>div:nth-child(2){flex:1}.builder-head span{display:block;color:#70827d;font-size:.68rem}.title-input{width:min(520px,100%);border:0;background:transparent;font-size:1.25rem;font-weight:800;outline:none}.validation{margin-bottom:10px;padding:9px 13px;border:1px solid #eedcad;border-radius:10px;color:#795e16;background:#fffaf0;font-size:.75rem}.validation.danger{border-color:#f3c1c8;color:#a82d40;background:#fff2f4}.builder-shell{display:grid;height:calc(100vh - 170px);min-height:680px;grid-template-columns:minmax(0,1fr) 390px;grid-template-rows:auto 1fr;overflow:hidden}.canvas-toolbar{display:flex;align-items:center;gap:6px;padding:9px;border-bottom:1px solid var(--line);grid-column:1;overflow:visible}.tool-button{position:relative;min-height:36px;padding:0 11px;border:1px solid var(--line);border-radius:11px;color:#17342e;background:white;font-size:.7rem;font-weight:750}.tool-button:hover{border-color:#45b89f;background:#f3fcf9}.tool-button.extra{color:#586e68;background:#f8fbfa}.tool-button:hover::after{position:absolute;top:44px;left:0;z-index:40;width:210px;padding:9px;border-radius:9px;color:white;background:#173d35;box-shadow:0 8px 20px rgba(0,0,0,.18);content:attr(data-help);font-size:.65rem;font-weight:500;line-height:1.4;text-align:left}.toolbar-spacer{flex:1}.canvas-toolbar .icon-button{flex:0 0 36px;width:36px;height:36px}.icon-button.active{color:white;background:#147561}.icon-button:disabled{opacity:.35}.delete-button{color:#c7354b}.flow-canvas{min-width:0;background:#f7faf9}.inspector{grid-column:2;grid-row:1/3;padding:20px;border-left:1px solid var(--line);overflow-y:auto;background:#fff}.inspector h2{margin:6px 0 18px;font-size:1.05rem;font-weight:800}.inspector .field{margin-bottom:13px}.inspector-title{display:flex;align-items:flex-start;justify-content:space-between}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-items:center}.checks{display:flex;gap:14px}.checks.compact{align-items:flex-start;flex-direction:column;gap:6px;font-size:.67rem}.tip{padding:10px;border-radius:10px;color:#567069;background:#eef8f5;font-size:.7rem;line-height:1.45}.conflict textarea{border-color:#d6485d;background:#fff8f9}.conflict small{color:#c1364a}.messages-head{display:flex;align-items:center;justify-content:space-between;margin:17px 0 9px}.messages-head b,.messages-head small{display:block}.messages-head b{font-size:.78rem}.messages-head small{margin-top:2px;color:#83928e;font-size:.6rem}.add-output{display:flex;gap:4px}.add-output button,.subhead button{padding:5px 7px;border:1px solid var(--line);border-radius:7px;color:#176d5d;background:white;font-size:.6rem}.output-card{display:grid;gap:8px;margin-bottom:10px;padding:10px;border:1px solid #dfe9e6;border-radius:12px;background:#f9fcfb}.output-card header{display:flex;align-items:center;gap:6px}.output-card header span{flex:1;color:#5e736d;font-size:.64rem;font-weight:750}.output-card header select{width:auto;padding:4px 7px;border:1px solid var(--line);border-radius:7px;font-size:.62rem}.output-card header button,.header-row button{border:0;color:#ba3549;background:transparent}.output-card textarea,.output-card input,.output-card>select,.method-url input,.method-url select,.header-row input{width:100%;padding:8px 9px;border:1px solid #d7e3df;border-radius:8px;background:white;font-size:.7rem}.output-card textarea{min-height:86px;resize:vertical}.inline-upload{display:inline-flex;justify-content:center;padding:7px;border:1px dashed #8fcabb;border-radius:8px;color:#17715f;background:#f1fbf8;font-size:.65rem;cursor:pointer}.inline-upload input{display:none}.method-url{display:grid;grid-template-columns:92px 1fr;gap:6px;margin-bottom:12px}.subhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:.7rem}.header-row{display:grid;grid-template-columns:.8fr 1.2fr auto;gap:5px;margin-bottom:6px}.code-input{min-height:130px!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.68rem}.toggle.compact{margin:4px 0 13px;font-size:.7rem}.test-button{width:100%}.test-result,.data-preview{max-height:310px;padding:11px;border-radius:10px;overflow:auto;color:#d8fff6;background:#12342d;font-size:.62rem;line-height:1.45;white-space:pre-wrap}.test-result.failed{color:#ffe2e6;background:#4b1f27}.data-preview{max-height:calc(100vh - 290px)}.channel-only{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:11px;border:1px solid #cce8e1;border-radius:11px;background:#f0fbf8}.channel-only>span{font-size:1.2rem}.channel-only b,.channel-only small{display:block}.channel-only b{font-size:.72rem}.channel-only small{color:#72837e;font-size:.62rem}.full-button{width:100%}@media(max-width:1150px){.builder-shell{grid-template-columns:minmax(0,1fr) 340px}.tool-button.extra{display:none}}@media(max-width:900px){.builder-shell{height:auto;grid-template-columns:1fr;grid-template-rows:auto 560px auto}.canvas-toolbar{grid-column:1;flex-wrap:wrap;overflow:visible}.toolbar-spacer{flex:1 1 12px}.tool-button:hover::after{display:none}.flow-canvas{grid-row:2}.flow-canvas :deep(.vue-flow__minimap){display:none}.inspector{grid-column:1;grid-row:3;max-height:none;border-top:1px solid var(--line);border-left:0}.builder-head{align-items:stretch;flex-wrap:wrap}.builder-head>div:nth-child(2){min-width:60%}}@media(max-width:600px){.builder-shell{grid-template-rows:auto 470px auto}.builder-head .toggle{order:4}.canvas-toolbar{align-items:stretch}.toolbar-spacer{display:none}.two-fields,.method-url{grid-template-columns:1fr}.inspector{padding:15px}}
.simulation-preview article{margin:10px 0;padding:11px 14px;border-radius:8px;border:1px solid #bee2d2;background:#e3f7ee}.simulation-preview article strong{font-size:10px;color:#438872}.simulation-preview article p{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}

.builder-head{position:sticky;top:0;z-index:25;background:#f1f8f5;padding:10px 0;flex-wrap:wrap}
.builder-page .icon-button{white-space:nowrap;flex-shrink:0;line-height:1;padding:0}
.canvas-toolbar{flex-wrap:wrap;background:white}
.builder-page .configure-floating,.builder-page .inspector-close,.inspector-backdrop{display:none}
.builder-page.fullscreen{position:fixed;inset:0;z-index:6000;overflow:auto;height:100dvh;width:100%;padding:12px}
.fullscreen .builder-shell{height:calc(100dvh - 105px);min-height:400px}
.diagram-only .builder-shell{grid-template-columns:1fr}.diagram-only .inspector{display:none}
@media(max-width:900px){
 .builder-page{padding:8px 8px 80px}.builder-head{gap:6px}.builder-head .status-chip{display:none}
 .builder-shell{overflow:visible;min-height:0;grid-template-rows:auto minmax(420px,70dvh)}
 .canvas-toolbar{position:sticky;top:var(--builder-head-height,110px);z-index:20;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain}
 .tool-button{flex:none;white-space:nowrap}.tool-button.extra{display:block}
 .builder-head>div:nth-child(2){min-width:calc(100% - 48px)}
 .inspector{display:none}.inspector.mobile-open{display:block;position:fixed;inset:auto 0 0;max-height:85dvh;z-index:7001;border-radius:20px 20px 0 0;padding:18px;padding-bottom:max(22px,env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain}
 .inspector-backdrop{display:block;position:fixed;inset:0;background:#001b2080;z-index:7000}
 .inspector-close{display:flex!important;position:sticky;top:0;margin:0 0 16px auto;z-index:2}
 .builder-page .configure-floating{display:flex;position:fixed;right:16px;bottom:max(20px,env(safe-area-inset-bottom));z-index:30;box-shadow:0 5px 25px #00251c55}
 .fullscreen .builder-shell{height:calc(100dvh - 145px);grid-template-rows:auto 1fr;min-height:300px}
}
</style>
