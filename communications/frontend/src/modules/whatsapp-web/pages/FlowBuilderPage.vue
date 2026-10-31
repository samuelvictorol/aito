<script setup>
import RouterLink from '../../../components/PrototypeAwareRouterLink.vue'
import { vCanAction } from '../../../services/permission-directives.js'
import { canArea, canAction } from '../../../services/access.js'
import { getStoredUser } from '../../../services/tokens.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { VueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { MessageSquare, GitBranch, Zap, CircleStop, Image, Clock3, DollarSign, MessagesSquare, Sparkles } from '@lucide/vue'
import FlowNode from '../components/FlowNode.vue'
import MediaPreview from '../components/MediaPreview.vue'
import FlowGeneralSettings from '../components/FlowGeneralSettings.vue'
import FlowSimulator from '../components/FlowSimulator.vue'
import { api, messageOf } from '../services.js'
import { inPrototype } from '../../../services/prototype-runtime.js'

const prototype = inPrototype()

const mayEdit = computed(() => canAction(getStoredUser(), 'web_flows', 'edit'))
const mayExecute = computed(() => canAction(getStoredUser(), 'web_flows', 'execute'))
const route = useRoute(), router = useRouter()
const nodes = ref([]), edges = ref([])
const meta = ref({ name: '', description: '', active: false, channels: ['whatsapp'], settings: {} })
const assets = ref([]), selectedNodeId = ref(''), selectedEdgeId = ref(''), keywordDraft = ref('')
const paymentConfigs = ref([]), aiProfiles = ref([]), contactGroups = ref([])
const loading = ref(true), saving = ref(false), dirty = ref(false), toast = ref(''), analysis = ref({ errors: [], warnings: [], conflicts: [] })
const previewOpen = ref(false), testingAction = ref(false), actionResult = ref(null), uploading = ref(false)
const history = ref([]), future = ref([])
const fullscreen = ref(false), inspectorOpen = ref(false), simulatorOpen = ref(false), simulationNode = ref(null), jsonInput = ref(null)
const generalOpen = ref(false), builderRoot = ref(null)
let flowInstance
function onFlowInit(instance) { flowInstance = instance; setTimeout(() => instance.fitView({ padding: 0.2, maxZoom: 1 }), 50) }
async function toggleFullscreen(diagram = false) { if (diagram) { fullscreen.value = !fullscreen.value; await nextTick(); flowInstance?.fitView({ padding: 0.2 }); return } try { if (document.fullscreenElement) await document.exitFullscreen(); else await builderRoot.value.requestFullscreen() } catch { showToast('Tela cheia indisponível neste navegador.') } }
let copiedGraph = null, lastEscape = 0
let savedSnapshot = '', trackedSnapshot = '', historyTimer, suspendTracking = true

const selectedNode = computed(() => nodes.value.find((item) => item.id === selectedNodeId.value))
const selectedEdge = computed(() => edges.value.find((item) => item.id === selectedEdgeId.value))
const canUndo = computed(() => history.value.length > 0 || serializeEditor() !== trackedSnapshot)
const canRedo = computed(() => future.value.length > 0)

function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() }
function defaultAction(type = 'http') { return { type, integrationKey: '', recipients: [], contactGroupIds: [], message: '', method: 'POST', url: '', headers: [{ name: 'Content-Type', value: 'application/json' }], body: '{\n  "mensagem": "{{mensagem}}",\n  "telefone": "{{telefone}}"\n}', timeoutMs: 10000, resultVariable: 'api_result', continueOnError: false, waitMs: 1000, variableName: '', variableValue: '', chatAction: '', chatActionValue: 60 } }
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
  meta.value = { name: flow.name, description: flow.description, active: flow.active, channels: ['whatsapp'], settings: { messageIntervalMs: 1000, humanIdleMinutes: 0, humanReturnMessage: "", ...flow.settings } }
  nodes.value = (flow.nodes || []).map((node) => ({
    id: node.nodeId, type: 'bot', position: node.position,
    data: { ...node.data, returnToNodeId: node.data?.returnToNodeId || '', ai: { profileKey: '', includeHistory: true, historyLimit: 12, ...(node.data?.ai || {}) }, messages: (node.data?.messages || []).map((item) => ({ ...defaultOutput(item.type), ...item, assetId: item.assetId || null })), action: { ...defaultAction(node.data?.action?.type), ...(node.data?.action || {}) }, kind: node.type },
  }))
  edges.value = (flow.edges || []).map((edge) => ({ id: edge.edgeId, source: edge.source, target: edge.target, label: edge.label || edge.keywords?.join(' · ') || 'automático', markerEnd: MarkerType.ArrowClosed, data: { keywords: [...(edge.keywords || [])], regex: edge.regex || '', matchMode: edge.matchMode || 'any', priority: edge.priority || 0, event: edge.event || '' }, style: { stroke: '#249e85', strokeWidth: 2 } }))
}

function flowPayload() {
  return {
    ...meta.value, channels: ['whatsapp'], settings: { ...meta.value.settings },
    nodes: nodes.value.map((node) => ({ nodeId: node.id, type: node.data.kind, position: node.position, data: { label: node.data.label, returnToNodeId: node.data.returnToNodeId || '', ai: { ...node.data.ai }, messages: (node.data.messages || []).map((item) => ({ ...item })), action: { ...node.data.action, headers: (node.data.action?.headers || []).map((item) => ({ ...item })) }, addTags: node.data.addTags || [], removeTags: node.data.removeTags || [], resetContext: Boolean(node.data.resetContext) } })),
    edges: edges.value.map((edge) => ({ edgeId: edge.id, source: edge.source, target: edge.target, label: edge.label || '', keywords: edge.data?.keywords || [], regex: edge.data?.regex || '', matchMode: edge.data?.matchMode || 'any', priority: Number(edge.data?.priority || 0), event: edge.data?.event || '' })),
  }
}
const previewData = computed(() => JSON.stringify(flowPayload(), null, 2))

function serializeEditor() { return JSON.stringify(flowPayload()) }
function applySnapshot(snapshot) {
  if (!snapshot) return
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
    history.value = []; future.value = []; applySnapshot(savedSnapshot); showToast('Alterações descartadas.')
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

async function loadAssets() { if (!canArea(getStoredUser(), 'web_files')) { assets.value = []; return } try { assets.value = (await api.get('/assets', { params: { limit: 100 } })).data.items } catch { assets.value = [] } }
async function loadIntegrations() {
  if (!canArea(getStoredUser(), 'web_integrations')) { paymentConfigs.value = []; aiProfiles.value = []; contactGroups.value = []; return }
  const results = await Promise.allSettled([api.get('/integrations/infinitepay/configs'), api.get('/integrations/openai/profiles'), api.get('/integrations/contact-groups')])
  ;[paymentConfigs.value, aiProfiles.value, contactGroups.value] = results.map(result => result.status === 'fulfilled' ? result.value.data.items : [])
}
async function load() {
  loading.value = true; suspendTracking = true
  try {
    const { data } = await api.get(`/flows/${route.params.id}`)
    mapFlow(data.flow); analysis.value = data.analysis
    savedSnapshot = serializeEditor(); trackedSnapshot = savedSnapshot; history.value = []; future.value = []; dirty.value = false
  } catch (cause) { showToast(messageOf(cause)) }
  finally { loading.value = false; await nextTick(); suspendTracking = false }
  await Promise.allSettled([loadAssets(), loadIntegrations()])
}
async function save() {
  if (prototype) { showToast('Demonstração: o fluxo pode ser editado nesta tela, mas não pode ser salvo ou aplicado.'); return }
  if (!mayEdit.value) return
  saving.value = true; flushHistory()
  try {
    const { data } = await api.put(`/flows/${route.params.id}`, flowPayload())
    suspendTracking = true; analysis.value = data.analysis; mapFlow(data.flow)
    savedSnapshot = serializeEditor(); trackedSnapshot = savedSnapshot; history.value = []; future.value = []; dirty.value = false
    await nextTick(); suspendTracking = false; showToast('Fluxo salvo e aplicado em tempo real.')
  } catch (cause) {
    const payload = cause?.response?.data; analysis.value = payload?.analysis || analysis.value; showToast(messageOf(cause))
  } finally { saving.value = false }
}
function showToast(value) { toast.value = value; window.setTimeout(() => { if (toast.value === value) toast.value = '' }, 3400) }

function addNode(kind = 'message', preset) {
  if (!mayEdit.value) return
  const id = crypto.randomUUID(), count = nodes.value.length
  const labels = { message: 'Mensagem', choice: 'Decisão', action: 'Ação', ai: 'IA', end: 'Final' }
  const messages = preset === 'infinitepay' ? [{ ...defaultOutput('text'), text: 'Para concluir o pagamento, acesse: {{payment_url}}' }] : kind === 'action' || kind === 'ai' ? [] : [defaultOutput(preset === 'media' ? 'media' : 'text')]
  const action = defaultAction(['wait', 'infinitepay', 'whatsapp'].includes(preset) ? preset : 'http')
  const base = preset === 'media' ? 'Arquivo' : preset === 'wait' ? 'Espera' : preset === 'infinitepay' ? 'Pagamento' : preset === 'whatsapp' ? 'Chat WhatsApp' : labels[kind] || 'Novo card'
  let label = base, suffix = 2
  while (nodes.value.some(node => node.data.label.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))) label = `${base} ${suffix++}`
  nodes.value.push({ id, type: 'bot', position: { x: 180 + (count % 3) * 290, y: 100 + Math.floor(count / 3) * 200 }, data: { kind: preset === 'media' ? 'message' : kind, label, messages, action, ai: { profileKey: '', includeHistory: true, historyLimit: 12 }, returnToNodeId: '', addTags: [], removeTags: [], resetContext: false } })
  selectedNodeId.value = id; selectedEdgeId.value = ''; previewOpen.value = false
}
function connect(params) {
  if (!mayEdit.value) return
  const id = crypto.randomUUID()
  edges.value.push({ ...params, id, label: 'nova condição', markerEnd: MarkerType.ArrowClosed, data: { keywords: [], regex: '', matchMode: 'any', priority: 0, event: '' }, style: { stroke: '#249e85', strokeWidth: 2 } })
  selectedEdgeId.value = id; selectedNodeId.value = ''; previewOpen.value = false
}
function selectNode({ node }) { selectedNodeId.value = node.id; selectedEdgeId.value = ''; previewOpen.value = false }
function selectEdge({ edge }) { selectedEdgeId.value = edge.id; selectedNodeId.value = ''; previewOpen.value = false }
function clearSelection() { selectedNodeId.value = ''; selectedEdgeId.value = '' }
function removeSelected() {
  if (!mayEdit.value) return
  if (selectedNode.value) {
    if (selectedNode.value.data.kind === 'start') { showToast('O card inicial não pode ser removido.'); return }
    if (!confirm(`Remover o card “${selectedNode.value.data.label}” e suas conexões?`)) return
    const id = selectedNode.value.id; nodes.value = nodes.value.filter((node) => node.id !== id); edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  } else if (selectedEdge.value) edges.value = edges.value.filter((edge) => edge.id !== selectedEdge.value.id)
  clearSelection()
}
function syncKeywords() { if (selectedEdge.value) selectedEdge.value.data.keywords = keywordDraft.value.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) }
function syncRecipients(event) { if (selectedNode.value) selectedNode.value.data.action.recipients = event.target.value.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean) }
function tags(value) { return String(value || '').split(/[;,\n]+/).map((item) => normalize(item).replaceAll(' ', '-')).filter(Boolean) }
function setTags(key, value) { if (selectedNode.value) selectedNode.value.data[key] = tags(value) }
const addTagsText = computed({ get: () => selectedNode.value?.data?.addTags?.join(', ') || '', set: (value) => setTags('addTags', value) })
const removeTagsText = computed({ get: () => selectedNode.value?.data?.removeTags?.join(', ') || '', set: (value) => setTags('removeTags', value) })
function addOutput(type) { selectedNode.value?.data.messages.push(defaultOutput(type)) }
function removeOutput(index) { selectedNode.value?.data.messages.splice(index, 1) }
function moveOutput(index, offset) {
  const list = selectedNode.value?.data.messages, target = index + offset
  if (!list || target < 0 || target >= list.length) return
  flushHistory(); list.splice(target, 0, list.splice(index, 1)[0])
}
function exportFlow() {
  if (!canAction(getStoredUser(), 'web_flows', 'export')) return
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'wpp-flow', version: 1, flow: flowPayload() }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `${meta.value.name.replace(/[^a-z0-9_-]/gi, '_') || 'fluxo'}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importFlow(event) {
  if (!mayEdit.value || !canAction(getStoredUser(), 'web_flows', 'import')) return
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('O JSON deve ter no máximo 2 MB.')
    const document = JSON.parse(await file.text())
    const { data } = await api.post('/flows/import', document)
    if (!data.valid) throw new Error(data.errors.join(' '))
    flushHistory(); mapFlow({ ...data.flow, active: meta.value.active }); clearSelection(); analysis.value = data
    await nextTick(); flowInstance?.fitView({ padding: 0.2, maxZoom: 1 });
    showToast('Fluxo importado. Revise e salve para aplicar. As mídias usam a biblioteca desta instalação.')
  } catch (cause) { showToast(messageOf(cause)) }
}
function copySelection(event) {
  const selected = nodes.value.filter(node => node.selected || node.id === selectedNodeId.value).filter(node => node.data.kind !== 'start')
  if (!selected.length) return
  const ids = new Set(selected.map(node => node.id))
  copiedGraph = JSON.parse(JSON.stringify({ nodes: selected, edges: edges.value.filter(edge => ids.has(edge.source) && ids.has(edge.target)) }))
  event.preventDefault(); showToast('Cards copiados.')
}
function pasteSelection(event) {
  if (!mayEdit.value) return
  if (!copiedGraph) return
  event.preventDefault(); flushHistory()
  const graph = JSON.parse(JSON.stringify(copiedGraph)), ids = new Map(graph.nodes.map(node => [node.id, crypto.randomUUID()]))
  nodes.value.forEach(node => { node.selected = false })
  for (const node of graph.nodes) {
    node.id = ids.get(node.id); node.selected = true; node.position.x += 48; node.position.y += 48
    if (node.data.returnToNodeId && ids.has(node.data.returnToNodeId)) node.data.returnToNodeId = ids.get(node.data.returnToNodeId)
    const base = node.data.label, titles = new Set([...nodes.value, ...graph.nodes.filter(item => item !== node)].map(item => item.data.label.toLocaleLowerCase('pt-BR')))
    let suffix = 2, title = `${base} ${suffix}`
    while (titles.has(title.toLocaleLowerCase('pt-BR'))) title = `${base} ${++suffix}`
    node.data.label = title
    node.data.messages?.forEach(output => { output.outputId = crypto.randomUUID() })
  }
  nodes.value.push(...graph.nodes)
  edges.value.push(...graph.edges.map(edge => ({ ...edge, id: crypto.randomUUID(), source: ids.get(edge.source), target: ids.get(edge.target), selected: false })))
  selectedNodeId.value = graph.nodes[0]?.id || ''; selectedEdgeId.value = ''
  copiedGraph = graph
}
function escapeFullscreen(event) {
  if (event.key !== 'Escape' || !fullscreen.value || event.repeat) return
  event.preventDefault()
  const now = performance.now()
  if (lastEscape && now - lastEscape < 450) { fullscreen.value = false; lastEscape = 0 }
  else { lastEscape = now; showToast('Pressione Esc novamente para sair da tela cheia.') }
}
function addHeader() { selectedNode.value?.data.action.headers.push({ name: '', value: '' }) }
function removeHeader(index) { selectedNode.value?.data.action.headers.splice(index, 1) }
async function uploadAsset(event, output) {
  if (!mayEdit.value || !canAction(getStoredUser(), 'web_files', 'import')) return
  const file = event.target.files?.[0]; if (!file) return
  uploading.value = true
  try {
    const form = new FormData(); form.append('file', file); form.append('name', file.name)
    const { data } = await api.post('/assets', form); assets.value.unshift(data); output.assetId = data._id; showToast('Arquivo salvo na biblioteca.')
  } catch (cause) { showToast(messageOf(cause)) }
  finally { uploading.value = false; event.target.value = '' }
}
async function testAction() {
  if (!mayExecute.value) return
  if (!selectedNode.value) return
  testingAction.value = true; actionResult.value = null
  try { actionResult.value = (await api.post('/actions/test', { action: selectedNode.value.data.action, variables: { nome: 'Cliente de teste', telefone: '5511999999999', mensagem: 'Olá, teste interativo' } })).data }
  catch (cause) { actionResult.value = cause?.response?.data || { error: messageOf(cause) } }
  finally { testingAction.value = false }
}
function openPreview() { previewOpen.value = !previewOpen.value; if (previewOpen.value) clearSelection() }
function beforeUnload(event) { if (dirty.value && !prototype) { event.preventDefault(); event.returnValue = '' } }
function keydown(event) {
  if (!mayEdit.value) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return }
  if (simulatorOpen.value || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { copySelection(event); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { pasteSelection(event); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
  if ((event.key === 'Delete' || event.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) && (selectedNode.value || selectedEdge.value)) { event.preventDefault(); removeSelected() }
}

onBeforeRouteLeave((_to, _from, next) => { if (!prototype && dirty.value && !confirm('Há alterações não salvas. Sair e descartá-las?')) next(false); else next() })
onMounted(() => { load(); window.addEventListener('beforeunload', beforeUnload); window.addEventListener('keydown', keydown); window.addEventListener('keydown', escapeFullscreen, true) })
onBeforeUnmount(() => { clearTimeout(historyTimer); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keydown); window.removeEventListener('keydown', escapeFullscreen, true) })
</script>

<template>
  <section ref="builderRoot" :class="['builder-page', { 'is-fullscreen': fullscreen }]">
    <div class="builder-head">
      <button class="icon-button" title="Voltar para os fluxos" @click="router.push('/whatsapp-web/flows')">←</button>
      <div><input v-model="meta.name" :readonly="!mayEdit" class="title-input" aria-label="Nome do fluxo"><span>{{ prototype ? 'Demonstração interativa · alterações temporárias' : dirty ? 'Alterações ainda não salvas' : 'Tudo salvo e sincronizado' }}</span></div>
      <label class="toggle"><input v-model="meta.active" :disabled="prototype || !mayEdit || !mayExecute" type="checkbox"> Fluxo ativo</label>
      <input ref="jsonInput" type="file" accept=".json,application/json" hidden @change="importFlow">
      <button v-can-action="'web_flows.import'" :disabled="!mayEdit" class="icon-button responsive-action" title="Importar fluxo JSON" aria-label="Importar fluxo JSON" @click="jsonInput.click()"><span aria-hidden="true">↥</span><span class="action-label">Importar JSON</span></button>
      <button v-can-action="'web_flows.export'" class="icon-button responsive-action" title="Exportar fluxo JSON" aria-label="Exportar fluxo JSON" @click="exportFlow"><span aria-hidden="true">↧</span><span class="action-label">Exportar JSON</span></button>
      <button v-can-action="'web_flows.execute'" class="icon-button responsive-action" title="Simular bot" aria-label="Simular bot" @click="simulatorOpen = true"><span aria-hidden="true">▷</span><span class="action-label">Simular bot</span></button>
      <button class="icon-button responsive-action" title="Tela cheia do diagrama (Esc duas vezes para sair)" aria-label="Tela cheia do diagrama" :disabled="fullscreen" @click="fullscreen = true; lastEscape = 0"><span aria-hidden="true">⛶</span><span class="action-label">Diagrama</span></button>
      <button class="icon-button responsive-action" title="Configurações gerais do fluxo" aria-label="Configurações gerais do fluxo" @click="generalOpen = true"><span aria-hidden="true">⚙</span><span class="action-label">Configurações</span></button><button class="icon-button responsive-action" title="Tela cheia do navegador" aria-label="Tela cheia do navegador" @click="toggleFullscreen()"><span aria-hidden="true">⛶</span><span class="action-label">Tela cheia</span></button><button v-if="dirty" class="btn ghost" @click="discard">Descartar</button>
      <button v-can-action="'web_flows.edit'" class="btn" :disabled="prototype || saving || localConflicts.length > 0" @click="save">{{ prototype ? 'Salvar indisponível na demonstração' : saving ? 'Salvando…' : 'Salvar e aplicar' }}</button>
    </div>
    <div v-if="analysis.errors?.length || localConflicts.length" class="validation danger"><b>Corrija antes de salvar:</b> {{ analysis.errors?.[0] || `Há ${localConflicts.length} palavra(s)-chave repetida(s).` }}</div>
    <div v-else-if="analysis.warnings?.length" class="validation"><b>Atenção:</b> {{ analysis.warnings[0] }}</div>
    <div v-if="loading" class="card empty">Carregando editor…</div>
    <div v-else class="builder-shell card">
      <div class="canvas-toolbar">
        <button :disabled="!mayEdit" class="tool-button" data-help="Envia balões com o intervalo das configurações gerais." @click="addNode('message')"><MessageSquare class="tool-icon" aria-hidden="true" /><span class="tool-label">Mensagem</span></button>
        <button :disabled="!mayEdit" class="tool-button" data-help="Avalia palavras, opções ou expressão regular para escolher um caminho." @click="addNode('choice')"><GitBranch class="tool-icon" aria-hidden="true" /><span class="tool-label">Decisão</span></button>
        <button :disabled="!mayEdit" class="tool-button" data-help="Chama uma API, define variável, aguarda ou executa uma operação na conversa." @click="addNode('action')"><Zap class="tool-icon" aria-hidden="true" /><span class="tool-label">Ação</span></button>
        <button :disabled="!mayEdit" class="tool-button" data-help="Encerra a jornada atual e prepara o próximo contato para recomeçar." @click="addNode('end')"><CircleStop class="tool-icon" aria-hidden="true" /><span class="tool-label">Final</span></button>
        <button :disabled="!mayEdit" class="tool-button extra" data-help="Cria um card já preparado para escolher imagem, áudio, vídeo ou documento." @click="addNode('message','media')"><Image class="tool-icon" aria-hidden="true" /><span class="tool-label">Arquivo</span></button>
        <button :disabled="!mayEdit" class="tool-button extra" data-help="Cria uma pausa silenciosa antes do próximo card." @click="addNode('action','wait')"><Clock3 class="tool-icon" aria-hidden="true" /><span class="tool-label">Espera</span></button>
        <button :disabled="!mayEdit" class="tool-button extra" data-help="Gera um link de pagamento." @click="addNode('action','infinitepay')"><DollarSign class="tool-icon" aria-hidden="true" /><span class="tool-label">InfinitePay</span></button>
        <button :disabled="!mayEdit" class="tool-button extra" data-help="Configura mensagens para outros chats." @click="addNode('action','whatsapp')"><MessagesSquare class="tool-icon" aria-hidden="true" /><span class="tool-label">Chat WhatsApp</span></button>
        <button :disabled="!mayEdit" class="tool-button extra" data-help="Adiciona atendimento por inteligência artificial." @click="addNode('ai')"><Sparkles class="tool-icon" aria-hidden="true" /><span class="tool-label">IA</span></button>
        <span class="toolbar-spacer"></span>
        <button class="icon-button" title="Desfazer (Ctrl+Z)" :disabled="!mayEdit || !canUndo" @click="undo">↶</button>
        <button class="icon-button" title="Refazer (Ctrl+Shift+Z)" :disabled="!mayEdit || !canRedo" @click="redo">↷</button>
        <button :class="['icon-button',{active:previewOpen}]" title="Visualizar dados do fluxograma" @click="openPreview">{ }</button>
        <button v-if="selectedNode || selectedEdge" class="icon-button delete-button" title="Remover seleção (Delete)" @click="removeSelected">×</button>
      </div>
      <div class="flow-canvas">
        <VueFlow :nodes-draggable="mayEdit" :nodes-connectable="mayEdit" :edges-updatable="mayEdit" @init="onFlowInit" v-model:nodes="nodes" v-model:edges="edges" :delete-key-code="null" fit-view-on-init :min-zoom="0.03" :max-zoom="1.8" @connect="connect" @node-click="selectNode" @edge-click="selectEdge" @pane-click="clearSelection">
          <template #node-bot="props"><FlowNode v-bind="props" :assets="assets" :order-stage="meta.settings.order?.enabled ? Object.entries(meta.settings.order.nodes || {}).find(([, id]) => id === props.id)?.[0] : ''" :class="{ 'simulating-node': simulationNode === props.id }" /></template>
          <Background pattern-color="#cbdad6" :gap="22" />
          <MiniMap pannable zoomable node-color="#75d9c3" />
          <Controls />
        </VueFlow>
      </div>
      <button v-if="inspectorOpen" class="inspector-backdrop" aria-label="Fechar configuração" @click="inspectorOpen = false"></button>
      <button class="mobile-config btn" @click="inspectorOpen = true">{{ selectedNode ? 'Configurar Card' : selectedEdge ? 'Configurar conexão' : 'Configurar fluxo' }}</button>
      <aside :class="['inspector', { 'is-open': inspectorOpen }]" :role="inspectorOpen ? 'dialog' : undefined" :aria-modal="inspectorOpen || undefined" aria-label="Configurar fluxo" @keydown.esc="inspectorOpen = false">
        <button class="inspector-close icon-button" title="Fechar configuração" @click="inspectorOpen = false">×</button>
        <fieldset class="permission-fields" :disabled="!mayEdit"><template v-if="previewOpen">
          <span class="eyebrow">Preview técnico</span><h2>Dados do fluxograma</h2>
          <p class="tip">Este é exatamente o conteúdo validado e salvo. Credenciais não aparecem aqui: use <code v-pre>{{secret.NOME}}</code>.</p>
          <pre class="data-preview">{{ previewData }}</pre>
        </template>
        <template v-else-if="selectedNode">
          <div class="inspector-title"><div><span class="eyebrow">Configurar card</span><h2>{{ selectedNode.data.label }}</h2></div><button v-if="selectedNode.data.kind !== 'start'" class="icon-button delete-button" title="Remover este card" @click="removeSelected">×</button></div>
          <div class="field"><label>Tipo</label><select v-model="selectedNode.data.kind" :disabled="selectedNode.data.kind === 'start'"><option value="start">Início</option><option value="message">Mensagem</option><option value="choice">Decisão</option><option value="action">Ação</option><option value="ai">IA</option><option value="end">Final</option></select></div>
          <div class="field"><label>Título interno</label><input v-model="selectedNode.data.label"></div>
          <div v-if="selectedNode.data.kind === 'ai'" class="action-editor"><div class="field"><label>Perfil OpenAI</label><select v-model="selectedNode.data.ai.profileKey"><option value="">Selecione…</option><option v-for="profile in aiProfiles" :key="profile.key" :value="profile.key">{{ profile.title }} · {{ profile.model }}</option></select></div><label class="toggle compact"><input v-model="selectedNode.data.ai.includeHistory" type="checkbox"> Considerar histórico da conversa</label><div class="field"><label>Últimas mensagens</label><input v-model.number="selectedNode.data.ai.historyLimit" type="number" min="0" max="50"></div><p class="tip">0 considera todo o histórico disponível. Configure modelos, mídia e contexto em Integrações.</p></div>

          <div v-if="selectedNode.data.kind === 'action'" class="action-editor">
            <div class="field"><label>O que executar?</label><select v-model="selectedNode.data.action.type"><option value="http">Chamar endpoint HTTP</option><option value="wait">Aguardar</option><option value="set_variable">Definir variável</option><option value="chat">Ação na conversa</option><option value="infinitepay">Gerar link InfinitePay</option><option value="whatsapp">Enviar para outros chats</option></select></div>
            <template v-if="selectedNode.data.action.type === 'infinitepay'"><div class="field"><label>Configuração InfinitePay</label><select v-model="selectedNode.data.action.integrationKey"><option value="">Selecione…</option><option v-for="item in paymentConfigs.filter(config => config.enabled)" :key="item.key" :value="item.key">{{ item.title }} · R$ {{ (item.priceCents / 100).toFixed(2).replace('.', ',') }}</option></select><small>Edite preço, mensagens e webhook em Integrações. Conecte as saídas Pago e Recusado deste card.</small></div></template>
            <template v-else-if="selectedNode.data.action.type === 'whatsapp'"><div class="field"><label>Mensagem</label><textarea v-model="selectedNode.data.action.message" @keydown.stop></textarea></div><div class="field"><label>Telefones ou IDs de grupo, um por linha</label><textarea :value="selectedNode.data.action.recipients.join('\n')" @change="syncRecipients" @keydown.stop></textarea></div><div class="field"><label>Grupos de contatos</label><select v-model="selectedNode.data.action.contactGroupIds" multiple><option v-for="group in contactGroups" :key="group._id" :value="group._id">{{ group.name }}</option></select></div><small v-pre>Variáveis: {{nome_contato}}, {{num_contato}}, {{imgurl_contato}}, {{metadata}}.</small></template>
            <template v-if="selectedNode.data.action.type === 'http'">
              <div class="method-url"><select v-model="selectedNode.data.action.method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input v-model="selectedNode.data.action.url" placeholder="https://api.exemplo.com/webhook"></div>
              <div class="subhead"><b>Cabeçalhos</b><button @click="addHeader">＋ adicionar</button></div>
              <div v-for="(header,index) in selectedNode.data.action.headers" :key="index" class="header-row"><input v-model="header.name" placeholder="Authorization"><input v-model="header.value" placeholder="Bearer {{secret.CRM_TOKEN}}"><button title="Remover cabeçalho" @click="removeHeader(index)">×</button></div>
              <div class="field"><label>Payload</label><textarea v-model="selectedNode.data.action.body" class="code-input" spellcheck="false" @keydown.stop></textarea><small>Variáveis: <code v-pre>{{mensagem}}</code>, <code v-pre>{{telefone}}</code>, <code v-pre>{{nome}}</code> e <code v-pre>{{secret.NOME}}</code>.</small></div>
              <div class="two-fields"><div class="field"><label>Timeout (ms)</label><input v-model.number="selectedNode.data.action.timeoutMs" type="number" min="500" max="30000"></div><div class="field"><label>Salvar resposta em</label><input v-model="selectedNode.data.action.resultVariable" placeholder="api_result"></div></div>
              <label class="toggle compact"><input v-model="selectedNode.data.action.continueOnError" type="checkbox"> Continuar se a API falhar</label>
              <button v-can-action="'web_flows.execute'" class="btn test-button" :disabled="testingAction" @click="testAction">{{ testingAction ? 'Testando…' : '▶ Testar ação agora' }}</button>
              <pre v-if="actionResult" :class="['test-result',{failed:actionResult.ok===false||actionResult.error}]">{{ JSON.stringify(actionResult,null,2) }}</pre>
            </template>
            <template v-else-if="selectedNode.data.action.type === 'wait'"><div class="field"><label>Tempo de espera (ms)</label><input v-model.number="selectedNode.data.action.waitMs" type="number" min="0" max="60000"><small>A pausa acontece sem mostrar “digitando”.</small></div></template>
            <template v-else-if="selectedNode.data.action.type === 'set_variable'"><div class="field"><label>Nome da variável</label><input v-model="selectedNode.data.action.variableName" placeholder="protocolo"></div><div class="field"><label>Valor</label><textarea v-model="selectedNode.data.action.variableValue" @keydown.stop></textarea></div></template>
            <template v-else-if="selectedNode.data.action.type === 'chat'"><div class="field"><label>Operação</label><select v-model="selectedNode.data.action.chatAction"><option value="">Selecione…</option><option value="takeover">Encaminhar para atendimento humano</option><option value="bot">Retornar ao início do bot</option><option value="close">Finalizar atendimento</option><option value="seen">Marcar como lida</option><option value="unread">Marcar como não lida</option><option value="archive">Arquivar</option><option value="unarchive">Desarquivar</option><option value="pin">Fixar</option><option value="unpin">Desafixar</option><option value="mute">Silenciar</option><option value="unmute">Remover silêncio</option></select></div><div v-if="selectedNode.data.action.chatAction==='mute'" class="field"><label>Minutos</label><input v-model.number="selectedNode.data.action.chatActionValue" type="number" min="1"></div></template>
          </div>

          <template v-if="(selectedNode.data.kind !== 'action' && selectedNode.data.kind !== 'ai') || selectedNode.data.action.type === 'infinitepay'">
            <div class="messages-head"><div><b>Mensagens enviadas</b><small>1 segundo entre cada balão</small></div><div class="add-output"><button title="Adicionar texto" @click="addOutput('text')">＋ Texto</button><button title="Adicionar arquivo" @click="addOutput('media')">▧</button><button title="Adicionar localização" @click="addOutput('location')">⌖</button><button title="Adicionar contato" @click="addOutput('contact')">◉</button></div></div>
            <article v-for="(output,index) in selectedNode.data.messages" :key="output.outputId" class="output-card">
              <header><span>Balão {{ index + 1 }}</span><select v-model="output.type"><option value="text">Texto</option><option value="media">Arquivo</option><option value="location">Localização</option><option value="contact">Contato</option></select><button title="Mover balão para cima" :disabled="index === 0" @click="moveOutput(index,-1)">↑</button><button title="Mover balão para baixo" :disabled="index === selectedNode.data.messages.length-1" @click="moveOutput(index,1)">↓</button><button title="Remover este balão" @click="removeOutput(index)">×</button></header>
              <textarea v-if="output.type === 'text'" v-model="output.text" placeholder="Escreva a mensagem…" @keydown.stop></textarea>
              <template v-else-if="output.type === 'media'">
                <select v-model="output.assetId"><option :value="null">Selecione da biblioteca…</option><option v-for="asset in assets" :key="asset._id" :value="asset._id">{{ asset.name }} · {{ Math.ceil(asset.size/1024) }} KB</option></select>
                <label v-can-action="'web_files.import'" class="inline-upload">{{ uploading ? 'Enviando…' : '＋ Fazer upload' }}<input type="file" :disabled="uploading" @change="uploadAsset($event,output)"></label>
                <input v-model="output.caption" placeholder="Legenda opcional">
                <MediaPreview v-if="output.assetId" :asset="assets.find(asset => asset._id === output.assetId)" :document="output.sendAsDocument" />
                <div class="checks compact"><label><input v-model="output.sendAsVoice" type="checkbox"> Enviar áudio como voz</label><label><input v-model="output.sendAsDocument" type="checkbox"> Enviar como documento</label></div>
              </template>
              <template v-else-if="output.type === 'location'"><input v-model="output.locationName" placeholder="Nome do local"><input v-model="output.locationAddress" placeholder="Endereço"><div class="two-fields"><input v-model.number="output.latitude" type="number" step="any" placeholder="Latitude"><input v-model.number="output.longitude" type="number" step="any" placeholder="Longitude"></div></template>
              <template v-else><input v-model="output.contactName" placeholder="Nome para identificar no fluxo"><input v-model="output.contactPhone" inputmode="tel" placeholder="5511999999999"></template>
            </article>
            <p v-if="!selectedNode.data.messages.length" class="tip">Este card não envia nada. Adicione um balão acima ou use-o apenas para organizar caminhos.</p>
          </template>
          <div class="field"><label>Adicionar etiquetas</label><input v-model="addTagsText" placeholder="lead, interesse"></div>
          <div class="field"><label>Remover etiquetas</label><input v-model="removeTagsText"></div>
          <div v-if="selectedNode.data.kind !== 'start' && selectedNode.data.kind !== 'ai' && selectedNode.data.action.type !== 'infinitepay'" class="field"><label>Ao concluir, retornar à etapa</label><select v-model="selectedNode.data.returnToNodeId"><option value="">{{ selectedNode.data.kind === 'end' ? 'Reiniciar conversa' : 'Seguir setas ou aguardar' }}</option><option v-for="node in nodes.filter(item => item.id !== selectedNode.id)" :key="node.id" :value="node.id">{{ node.data.label }}</option></select></div>
          <label class="toggle compact"><input v-model="selectedNode.data.resetContext" type="checkbox"> Reiniciar contexto após este card</label>
        </template>
        <template v-else-if="selectedEdge">
          <span class="eyebrow">Condição da seta</span><h2>Quando seguir este caminho?</h2>
          <div v-if="nodes.find(node => node.id === selectedEdge.source)?.data.action?.type === 'infinitepay'" class="field"><label>Resultado do pagamento</label><select v-model="selectedEdge.data.event"><option value="">Ao gerar link</option><option value="paid">Pago</option><option value="declined">Recusado</option></select></div>
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
          <div class="channel-only"><span>◉</span><div><b>WhatsApp Web</b><small>Canal deste atendimento</small></div></div>
          <p class="tip">O agrupamento de mensagens é configurado no Monitoramento e vale para o bot e o simulador. <RouterLink to="/whatsapp-web/logs">Abrir monitoramento</RouterLink></p>
          <div class="field"><label>Resetar conversa após (minutos)</label><input v-model.number="meta.settings.resetAfterMinutes" type="number" min="1" max="43200"></div>
          <div class="field"><label>Resposta quando não entender</label><textarea v-model="meta.settings.fallbackMessage" @keydown.stop></textarea></div>
          <label class="toggle compact"><input v-model="meta.settings.matchFirstMessage" type="checkbox"> Interpretar a primeira mensagem além de cumprimentar</label>
          <p class="tip">O intervalo entre balões e o retorno automático estão nas configurações gerais.</p>
        </template></fieldset>
      </aside>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
    <div v-if="generalOpen" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Configurações gerais"><section class="card general-dialog"><header><h2>Configurações gerais do fluxo</h2><button class="icon-button" aria-label="Fechar" @click="generalOpen = false">×</button></header><fieldset class="permission-fields" :disabled="!mayEdit"><FlowGeneralSettings :nodes="nodes" v-model="meta.settings" /></fieldset><button class="btn" @click="generalOpen = false">Concluir</button><p>As alterações são aplicadas ao salvar o fluxo.</p></section></div><FlowSimulator v-if="simulatorOpen" :flow="flowPayload()" :assets="assets" :payment-configs="paymentConfigs" @close="simulatorOpen = false; simulationNode = null" @step="simulationNode = $event" />
  </section>
</template>

<style scoped>
.permission-fields{border:0;padding:0;margin:0;min-width:0}.tool-button:disabled{opacity:.4;cursor:default}
.builder-page{max-width:none}.builder-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.builder-head>div:nth-child(2){flex:1}.builder-head span{display:block;color:#70827d;font-size:.68rem}.title-input{width:min(520px,100%);border:0;background:transparent;font:800 1.25rem Inter,'Segoe UI',sans-serif;outline:none}.validation{margin-bottom:10px;padding:9px 13px;border:1px solid #eedcad;border-radius:10px;color:#795e16;background:#fffaf0;font-size:.75rem}.validation.danger{border-color:#f3c1c8;color:#a82d40;background:#fff2f4}.builder-shell{display:grid;height:calc(100vh - 170px);min-height:680px;grid-template-columns:minmax(0,1fr) 390px;grid-template-rows:auto 1fr;overflow:hidden}.canvas-toolbar{display:flex;align-items:center;gap:6px;padding:9px;border-bottom:1px solid var(--line);grid-column:1;overflow:visible}.tool-button{position:relative;min-height:36px;padding:0 11px;border:1px solid var(--line);border-radius:11px;color:#17342e;background:white;font-size:.7rem;font-weight:750}.tool-button:hover{border-color:#45b89f;background:#f3fcf9}.tool-button.extra{color:#586e68;background:#f8fbfa}.tool-button:hover::after{position:absolute;top:44px;left:0;z-index:40;width:210px;padding:9px;border-radius:9px;color:white;background:#173d35;box-shadow:0 8px 20px rgba(0,0,0,.18);content:attr(data-help);font-size:.65rem;font-weight:500;line-height:1.4;text-align:left}.toolbar-spacer{flex:1}.canvas-toolbar .icon-button{flex:0 0 36px;width:36px;height:36px}.icon-button.active{color:white;background:#147561}.icon-button:disabled{opacity:.35}.delete-button{color:#c7354b}.flow-canvas{min-width:0;background:#f7faf9}.inspector{grid-column:2;grid-row:1/3;padding:20px;border-left:1px solid var(--line);overflow-y:auto;background:#fff}.inspector h2{margin:6px 0 18px;font:800 1.05rem Inter,'Segoe UI',sans-serif}.inspector .field{margin-bottom:13px}.inspector-title{display:flex;align-items:flex-start;justify-content:space-between}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-items:center}.checks{display:flex;gap:14px}.checks.compact{align-items:flex-start;flex-direction:column;gap:6px;font-size:.67rem}.tip{padding:10px;border-radius:10px;color:#567069;background:#eef8f5;font-size:.7rem;line-height:1.45}.conflict textarea{border-color:#d6485d;background:#fff8f9}.conflict small{color:#c1364a}.messages-head{display:flex;align-items:center;justify-content:space-between;margin:17px 0 9px}.messages-head b,.messages-head small{display:block}.messages-head b{font-size:.78rem}.messages-head small{margin-top:2px;color:#83928e;font-size:.6rem}.add-output{display:flex;gap:4px}.add-output button,.subhead button{padding:5px 7px;border:1px solid var(--line);border-radius:7px;color:#176d5d;background:white;font-size:.6rem}.output-card{display:grid;gap:8px;margin-bottom:10px;padding:10px;border:1px solid #dfe9e6;border-radius:12px;background:#f9fcfb}.output-card header{display:flex;align-items:center;gap:6px}.output-card header span{flex:1;color:#5e736d;font-size:.64rem;font-weight:750}.output-card header select{width:auto;padding:4px 7px;border:1px solid var(--line);border-radius:7px;font-size:.62rem}.output-card header button,.header-row button{border:0;color:#ba3549;background:transparent}.output-card textarea,.output-card input,.output-card>select,.method-url input,.method-url select,.header-row input{width:100%;padding:8px 9px;border:1px solid #d7e3df;border-radius:8px;background:white;font-size:.7rem}.output-card textarea{min-height:86px;resize:vertical}.inline-upload{display:inline-flex;justify-content:center;padding:7px;border:1px dashed #8fcabb;border-radius:8px;color:#17715f;background:#f1fbf8;font-size:.65rem;cursor:pointer}.inline-upload input{display:none}.method-url{display:grid;grid-template-columns:92px 1fr;gap:6px;margin-bottom:12px}.subhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:.7rem}.header-row{display:grid;grid-template-columns:.8fr 1.2fr auto;gap:5px;margin-bottom:6px}.code-input{min-height:130px!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.68rem}.toggle.compact{margin:4px 0 13px;font-size:.7rem}.test-button{width:100%}.test-result,.data-preview{max-height:310px;padding:11px;border-radius:10px;overflow:auto;color:#d8fff6;background:#12342d;font-size:.62rem;line-height:1.45;white-space:pre-wrap}.test-result.failed{color:#ffe2e6;background:#4b1f27}.data-preview{max-height:calc(100vh - 290px)}.channel-only{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:11px;border:1px solid #cce8e1;border-radius:11px;background:#f0fbf8}.channel-only>span{font-size:1.2rem}.channel-only b,.channel-only small{display:block}.channel-only b{font-size:.72rem}.channel-only small{color:#72837e;font-size:.62rem}.full-button{width:100%}@media(max-width:1150px){.builder-shell{grid-template-columns:minmax(0,1fr) 340px}}@media(max-width:900px){.builder-shell{height:auto;grid-template-columns:1fr;grid-template-rows:auto 560px auto}.canvas-toolbar{grid-column:1;flex-wrap:wrap;overflow:visible}.toolbar-spacer{flex:1 1 12px}.tool-button:hover::after{display:none}.flow-canvas{grid-row:2}.flow-canvas :deep(.vue-flow__minimap){display:none}.inspector{grid-column:1;grid-row:3;max-height:none;border-top:1px solid var(--line);border-left:0}.builder-head{align-items:stretch;flex-wrap:wrap}.builder-head>div:nth-child(2){min-width:60%}}@media(max-width:600px){.builder-shell{grid-template-rows:auto 470px auto}.builder-head .toggle{order:4}.canvas-toolbar{align-items:stretch}.toolbar-spacer{display:none}.two-fields,.method-url{grid-template-columns:1fr}.inspector{padding:15px}}
</style>

<style scoped>
.permission-fields{border:0;padding:0;margin:0;min-width:0}.tool-button:disabled{opacity:.4;cursor:default}
.builder-head{flex-wrap:wrap}.builder-head>div:nth-child(2){min-width:160px}.builder-shell{min-height:480px}.canvas-toolbar{flex-wrap:wrap}.builder-page{--ink:#152f29;--muted:#608175;--line:#c9ddd3;--card:white;color:#152f29;color-scheme:light}.general-dialog{width:min(650px,100%);padding:22px;max-height:90dvh;overflow:auto}.general-dialog header{display:flex;align-items:center;justify-content:space-between}.general-dialog p{font-size:12px}.modal-backdrop{position:fixed;inset:0;z-index:2500;display:grid;place-items:center;padding:14px;background:#041514bb}.builder-page.is-fullscreen{position:fixed;inset:0;z-index:1500;background:#f5f8f7;padding:14px;display:flex;flex-direction:column;overflow:hidden}.is-fullscreen .builder-shell{flex:1;min-height:0;height:auto}.flow-canvas{min-height:0}.mobile-config,.inspector-close,.inspector-backdrop{display:none}.simulating-node{outline:3px solid #218bee}.output-card header button:disabled{opacity:.25}.toast{z-index:2500}.output-card{border-radius:8px}
.output-card input,.output-card textarea,.output-card select,.method-url input,.method-url select,.header-row input{color:var(--ink);background:#fff}
@media(max-width:900px){.builder-shell,.is-fullscreen .builder-shell{height:max(450px,calc(100dvh - 265px));min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}.inspector{display:none}.inspector.is-open{display:block;position:fixed;inset:auto 8px 8px;z-index:1901;max-height:85dvh;border:1px solid #cddad5;border-radius:8px;padding:18px;box-shadow:0 10px 40px #0003;background:#fff}.inspector-close{display:block;margin-left:auto}.inspector-backdrop{display:block;position:fixed;inset:0;z-index:1900;border:0;background:#14221e88}.mobile-config{display:block;position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:1501;white-space:nowrap;box-shadow:0 4px 18px #0003}.builder-head .icon-button{width:34px;height:34px}.canvas-toolbar{gap:4px;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:thin}.canvas-toolbar .tool-button.extra{display:inline-flex}.canvas-toolbar .tool-button,.canvas-toolbar .icon-button{flex:0 0 auto}.canvas-toolbar .toolbar-spacer{display:none}.tool-button{padding:0 7px}.builder-page{padding-bottom:64px}.is-fullscreen.builder-page{padding:8px 8px 68px}.builder-head .title-input{max-width:100%}.builder-head>div:nth-child(2){flex-basis:calc(100% - 50px)}.builder-head .btn{font-size:12px}.inspector .two-fields{grid-template-columns:1fr 1fr}}
</style>

<style scoped>
.permission-fields{border:0;padding:0;margin:0;min-width:0}.tool-button:disabled{opacity:.4;cursor:default}
.builder-page{font-family:Inter,'Segoe UI',sans-serif}.builder-head{color:#e6fff6;background:#0d292a;padding:12px;border:1px solid #2b554e;border-radius:12px}.builder-head .title-input{color:#e6fff6;background:transparent}.builder-page .icon-button{color:#245548;background:white;font-family:Inter,'Segoe UI',sans-serif;white-space:nowrap;flex-shrink:0}.builder-page .field input,.builder-page .field textarea,.builder-page .field select{background:white;color:#173e33;border-color:#bdd6ca}.builder-page .field label{color:#315f4c}.builder-page h2,.builder-page h3{font-family:Inter,'Segoe UI',sans-serif}.builder-page .card{background:white;color:#173e33}.builder-page .general-dialog header{color:#173e33}.builder-page .btn.ghost{color:#74debd}.builder-page .builder-shell .btn.ghost{color:#1d785e}.builder-page .code-input{color:#173e33;background:#f4faf7}.builder-head .icon-button{background:#173d38;color:#d0f5e6;border-color:#578779}.builder-head span{color:#8db4a3}.canvas-toolbar{color:#173e33}.builder-page .general-dialog{color:#173e33}.general-dialog .field label{color:#315f4c}
</style>

<style scoped>.builder-head .title-input{font-family:Inter,'Segoe UI',sans-serif}</style>

<style scoped>.builder-head{position:sticky;top:76px;z-index:60}.is-fullscreen .builder-head{position:relative;top:0}@media(max-width:700px){.builder-head{top:68px}}</style>

<style scoped>
.permission-fields{border:0;padding:0;margin:0;min-width:0}.tool-button:disabled{opacity:.4;cursor:default}
.builder-page .responsive-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:auto;min-width:38px;height:38px;padding:0 10px;font-size:12px}.builder-page .responsive-action span{color:inherit;font-size:inherit}.builder-page .responsive-action .action-label{display:inline}.builder-head>div:nth-child(2){min-width:180px;flex-basis:260px}.canvas-toolbar .tool-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;flex:0 0 auto;height:36px;min-height:36px;padding:0 10px;line-height:1;white-space:nowrap;border-radius:8px;text-align:center}.canvas-toolbar .tool-button .tool-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;font-size:14px;line-height:1}.canvas-toolbar .tool-button .tool-label{display:block;line-height:1.2}
@media(max-width:700px){.builder-page .responsive-action{width:38px;min-width:38px;padding:0}.builder-page .responsive-action .action-label{display:none}.builder-page .responsive-action span{font-size:18px}}
</style>

<style scoped src="../flow-builder-mobile.css"></style>
