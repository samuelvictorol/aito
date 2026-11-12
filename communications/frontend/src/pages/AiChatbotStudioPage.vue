<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { onBeforeRouteLeave } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MarkerType, VueFlow } from '@vue-flow/core'
import AdminAssistant from '../components/AdminAssistant.vue'
import AssistantFloat from '../components/AssistantFloat.vue'
import WhatsAppWebShortcuts from '../components/WhatsAppWebShortcuts.vue'
import FlowBuilderPage from '../modules/whatsapp-web/pages/FlowBuilderPage.vue'
import FlowNode from '../modules/whatsapp-web/components/FlowNode.vue'
import FlowSimulator from '../modules/whatsapp-web/components/FlowSimulator.vue'
import { api, messageOf } from '../modules/whatsapp-web/services.js'
import { canAction, canArea } from '../services/access.js'
import { getStoredUser } from '../services/tokens.js'
import '../modules/whatsapp-web/styles.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const $q = useQuasar()
const editor = ref(null)
const agent = ref(null)
const editorFullscreen = ref(false)
const editorSimulationOpen = ref(false)
const editorState = ref(null)
const selected = ref(null)
const flows = ref([])
const loading = ref(false)
const error = ref('')
const notice = ref('')
const creating = ref(false)
const newName = ref('')
const saving = ref(false)
const actions = ref([])
const mode = ref('editor')
const proposalId = ref('')
const proposalView = ref(null)
const proposalSimulation = ref(null)
const linksOpen = ref(false)
const linksLoading = ref(false)
const linksError = ref('')
const links = ref(null)
let listRequest = 0
let destroyed = false

const user = getStoredUser()
const mayCreate = canAction(user, 'web_flows', 'create')
const maySimulate = canAction(user, 'web_flows', 'execute')
const maySeeFlows = canArea(user, 'web_flows')
const activeFlow = computed(() => editorState.value?.id === selected.value?._id ? editorState.value : null)
const options = computed(() => selected.value && !flows.value.some(flow => flow._id === selected.value._id)
  ? [selected.value, ...flows.value]
  : flows.value)

function flowTarget(action) {
  const pathname = action.path?.split('?')[0]
  const match = /^\/whatsapp-web\/flows(?:\/([a-f0-9]{24})(?:\/(active|duplicate))?)?\/?$/i.exec(pathname || '')
  return match ? { id: match[1], operation: match[2] } : null
}

const proposals = computed(() => actions.value.filter(action => {
  const target = flowTarget(action)
  return action.status === 'pending' && target && !target.operation && ['POST', 'PUT'].includes(action.method)
    && Array.isArray(action.preview?.data?.nodes) && (!target.id || target.id === selected.value?._id)
}))
const proposal = computed(() => proposals.value.find(action => action.id === proposalId.value) || proposals.value.at(-1))
const reviewingProposal = computed(() => mode.value === 'proposal' && Boolean(proposal.value))
// The assistant's public preview masks sensitive data and caps every array at 100 entries.
const previewMayBePartial = computed(() => {
  const flow = proposal.value?.preview.data
  return Boolean(flow && (flow.nodes.length >= 100 || flow.edges?.length >= 100))
})
const simulatorReady = computed(() => reviewingProposal.value ? !previewMayBePartial.value : Boolean(activeFlow.value?.loaded))
const simulatorOpen = computed(() => editorSimulationOpen.value || Boolean(proposalSimulation.value))
const graph = computed(() => {
  const flow = proposal.value?.preview.data
  if (!flow) return { nodes: [], edges: [] }
  const nodes = flow.nodes.map((node, index) => ({
    id: String(node.nodeId || node.id),
    type: 'bot',
    position: {
      x: Number.isFinite(node.position?.x) ? node.position.x : (index % 3) * 300,
      y: Number.isFinite(node.position?.y) ? node.position.y : Math.floor(index / 3) * 180,
    },
    data: { ...node.data, kind: node.type },
  }))
  const nodeIds = new Set(nodes.map(node => node.id))
  const edges = (flow.edges || []).filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge, index) => ({
    id: String(edge.edgeId || edge.id || index), source: edge.source, target: edge.target,
    label: edge.label || edge.keywords?.join(' · ') || 'Automático',
    markerEnd: MarkerType.ArrowClosed,
    style: { stroke: '#239f82', strokeWidth: 2 },
  }))
  return { nodes, edges }
})

const contextText = computed(() => {
  const current = activeFlow.value
  const context = [
    'Estúdio de chatbot WhatsApp QR Code. Use as rotas existentes para consultar o fluxo, catálogo, perfis de IA, esperas, arquivos e configurações. Valide o fluxograma completo com validate_flow e prepare uma ação revisável; o diagrama da proposta será exibido ao lado. Para uma criação, use POST /whatsapp-web/flows com active=false. Para alterar um fluxo existente, releia o registro, preserve as partes fora do pedido e use PUT /whatsapp-web/flows/:id com expectedVersion numérico igual à versão consultada. Faça uma proposta consolidada por vez e peça revisão antes de publicar ou ativar.',
    'Para URLs, consulte GET /whatsapp-web/flows/public-links. Use somente URLs retornadas por essa operação. Para o perfil, use o endereço público base; os tokens pessoais são emitidos pelos mecanismos próprios da instalação. Oriente a configurar credenciais no diálogo do sistema, sem coletar chaves no chat.',
  ]
  if (current?.loaded) {
    context.push(`Fluxo aberto: ${JSON.stringify({ id: current.id, nome: current.name, versao: current.version })}.`)
    if (current.dirty) context.push('Há alterações locais sem salvar. Aguarde o administrador salvar ou descartar antes de aplicar uma alteração a este fluxo.')
  } else {
    context.push('Nenhum fluxo selecionado. Para modificar um existente, peça que o administrador abra o fluxo desejado no estúdio.')
  }
  return context.join('\n')
})

const actionInProgress = computed(() => Boolean(selected.value && actions.value.some(action => action.status === 'executing' && flowTarget(action)?.id === selected.value._id)))
function canApplyAction(action) {
  const target = flowTarget(action)
  if (!target?.id) return true
  const current = activeFlow.value
  if (!current?.loaded || current.id !== target.id || current.dirty || current.loading || current.saving) return false
  return action.method !== 'PUT' || action.preview?.data?.expectedVersion === current.version
}

function onActionsUpdated(value) {
  const known = new Set(proposals.value.map(action => action.id))
  actions.value = Array.isArray(value) ? value : []
  const latest = proposals.value.findLast(action => !known.has(action.id))
  if (latest) {
    proposalId.value = latest.id
    mode.value = 'proposal'
  } else if (!proposal.value) {
    mode.value = 'editor'
  }
}

async function loadFlows(search = '') {
  if (!maySeeFlows) return
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/flows', { params: { limit: 50, search } })
    if (request === listRequest && !destroyed) flows.value = data.items || []
  } catch (cause) {
    if (request === listRequest && !destroyed) error.value = messageOf(cause)
  } finally {
    if (request === listRequest && !destroyed) loading.value = false
  }
}

function setFlow(flow) {
  if (selected.value?._id !== flow?._id) {
    closeSimulation()
    editorFullscreen.value = false
    editorState.value = null
  }
  selected.value = flow
  mode.value = 'editor'
  proposalId.value = ''
  notice.value = ''
}

function chooseFlow(flow) {
  if (flow?._id === selected.value?._id) return
  if (!activeFlow.value?.dirty) {
    setFlow(flow)
    return
  }
  $q.dialog({ title: 'Trocar de fluxo?', message: 'As alterações ainda abertas neste editor serão descartadas.', cancel: true })
    .onOk(() => setFlow(flow))
}

function filterFlows(search, update) {
  loadFlows(search).finally(() => update())
}

async function createFlow() {
  if (!newName.value.trim() || saving.value || activeFlow.value?.dirty) return
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.post('/flows', {
      name: newName.value.trim(), active: false, channels: ['whatsapp'],
      nodes: [{
        nodeId: 'start', type: 'start', position: { x: 160, y: 160 },
        data: { label: 'Boas-vindas', messages: [{ outputId: crypto.randomUUID(), type: 'text', text: 'Olá, {{nome}}! Como posso ajudar?' }] },
      }],
      edges: [],
    })
    if (destroyed) return
    setFlow(data.flow)
    creating.value = false
    newName.value = ''
    await loadFlows()
  } catch (cause) {
    if (!destroyed) error.value = messageOf(cause)
  } finally { saving.value = false }
}

async function onActionApplied(action) {
  const target = flowTarget(action)
  if (!target) {
    if (/^\/whatsapp-web\/(?:catalog|assets|integrations)\b/.test(action.path || '')) {
      await editor.value?.reloadResources()
      if (linksOpen.value) await loadLinks()
    }
    return
  }
  if (action.method === 'DELETE' && target.id === selected.value?._id) {
    if (!activeFlow.value?.dirty) setFlow(null)
  } else if (action.method === 'POST' && !activeFlow.value?.dirty) {
    const created = action.result?.flow || action.result
    if (/^[a-f0-9]{24}$/i.test(created?._id || '')) setFlow(created)
  } else if (target.id === selected.value?._id) {
    mode.value = 'editor'
    const refreshed = await editor.value?.reloadIfClean()
    if (!refreshed && !destroyed) notice.value = 'O agente aplicou uma alteração. Salve ou descarte suas edições locais e atualize o editor para carregar a revisão.'
  }
  await loadFlows()
}

function onSaved(flow) {
  selected.value = flow
  void loadFlows()
}

async function simulate() {
  if (simulatorOpen.value) { closeSimulation(); return }
  if (!simulatorReady.value || !maySimulate || actionInProgress.value) return
  if ($q.screen.lt.md) agent.value?.minimize()
  if (!reviewingProposal.value) {
    editor.value?.simulate()
    return
  }
  const flow = JSON.parse(JSON.stringify(proposal.value.preview.data))
  proposalSimulation.value = { flow, assets: [], paymentConfigs: [] }
  const current = proposalSimulation.value
  const results = await Promise.allSettled([
    canArea(user, 'web_files') ? api.get('/assets', { params: { limit: 100 } }) : null,
    canArea(user, 'web_integrations') ? api.get('/integrations/infinitepay/configs') : null,
  ])
  if (destroyed || proposalSimulation.value !== current) return
  const [assets, paymentConfigs] = results.map(result => result.status === 'fulfilled' ? result.value?.data?.items || [] : [])
  Object.assign(current, { assets, paymentConfigs })
}

function closeSimulation() {
  editor.value?.closeSimulation()
  editorSimulationOpen.value = false
  proposalSimulation.value = null
}

function onAgentVisibility(open) {
  if (open && $q.screen.lt.md) closeSimulation()
}

function onFullscreenChange(open) {
  editorFullscreen.value = open
  if (open) {
    agent.value?.minimize()
    closeSimulation()
  }
}

watch(mode, () => {
  closeSimulation()
  editor.value?.exitFullscreen()
})

async function refreshEditor() {
  if (await editor.value?.reloadIfClean()) notice.value = ''
}

async function showProposal() {
  mode.value = 'proposal'
  await nextTick()
  proposalView.value?.scrollIntoView({ block: 'start' })
  proposalView.value?.focus({ preventScroll: true })
}

async function loadLinks() {
  linksOpen.value = true
  linksLoading.value = true
  linksError.value = ''
  try { links.value = (await api.get('/flows/public-links')).data }
  catch (cause) { linksError.value = messageOf(cause) }
  finally { linksLoading.value = false }
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url)
    $q.notify({ type: 'positive', message: 'Link copiado.' })
  } catch {
    $q.notify({ type: 'warning', message: 'Selecione o endereço exibido para copiar.' })
  }
}

onBeforeRouteLeave(() => window.confirm(
  activeFlow.value?.dirty
    ? 'O fluxo tem alterações sem salvar. Sair da tela e descartar essas alterações?'
    : 'Sair da tela Criar chatbot?',
))

onMounted(() => loadFlows())
onBeforeUnmount(() => { destroyed = true })
</script>

<template>
  <main class="chatbot-studio">
    <header class="studio-hero">
      <div>
        <q-btn class="studio-back" flat dense no-caps icon="arrow_back" label="Agente de IA" to="/agent-ai" />
        <div class="studio-badges"><span><q-icon name="qr_code_2" /> WhatsApp QR Code</span><span><q-icon name="auto_awesome" /> IA</span></div>
        <h1>Criar chatbot</h1>
        <p>Desenhe a conversa, ajuste decisões com a IA e percorra o atendimento no simulador.</p>
      </div>
      <div class="studio-hero-actions">
        <q-btn v-if="maySeeFlows" outline no-caps icon="link" label="Links públicos" @click="loadLinks" />
        <q-btn v-if="maySimulate" class="studio-simulate" unelevated no-caps icon="smartphone" :label="simulatorOpen ? 'Fechar simulador' : reviewingProposal ? 'Simular proposta' : 'Abrir simulador'" :disable="!simulatorOpen && (!simulatorReady || actionInProgress)" @click="simulate" />
      </div>
    </header>

    <q-banner v-if="error && !creating" rounded class="bg-red-1 text-red-10 q-mb-md" role="alert">
      {{ error }}
      <template #action><q-btn flat no-caps label="Tentar novamente" @click="loadFlows()" /></template>
    </q-banner>

    <WhatsAppWebShortcuts :user="user" />

    <div class="studio-grid">
      <section class="studio-workspace" aria-label="Área de criação do fluxo">
        <header v-if="maySeeFlows" class="studio-picker">
          <q-select :model-value="selected" :options="options" option-value="_id" option-label="name" use-input input-debounce="300" outlined dense clearable label="Abrir um fluxo" :loading="loading" :disable="actionInProgress || activeFlow?.saving" @filter="filterFlows" @update:model-value="chooseFlow">
            <template #no-option><q-item><q-item-section>{{ loading ? 'Carregando…' : 'Nenhum fluxo encontrado' }}</q-item-section></q-item></template>
          </q-select>
          <q-btn v-if="mayCreate" outline no-caps color="primary" icon="add" label="Novo fluxo" :disable="Boolean(activeFlow?.dirty || activeFlow?.saving || actionInProgress)" @click="creating = true" />
        </header>

        <div v-if="proposal" class="studio-modes" role="group" aria-label="Visualização do fluxo">
          <q-btn flat no-caps icon="account_tree" label="Editor" :aria-pressed="mode === 'editor'" :class="{ 'studio-mode-active': mode === 'editor' }" @click="mode = 'editor'" />
          <q-btn flat no-caps icon="auto_awesome" label="Proposta da IA" :aria-pressed="mode === 'proposal'" :class="{ 'studio-mode-active': mode === 'proposal' }" @click="mode = 'proposal'" />
        </div>
        <q-banner v-if="notice" rounded class="bg-amber-1 text-brown-9 q-mb-md" role="status">
          {{ notice }}
          <template #action><q-btn flat no-caps label="Atualizar editor" :disable="activeFlow?.dirty || activeFlow?.saving" @click="refreshEditor" /></template>
        </q-banner>

        <Teleport to="body" :disabled="!editorFullscreen">
          <div v-if="selected" v-show="mode === 'editor'" class="studio-builder whatsapp-web-workspace">
            <FlowBuilderPage ref="editor" :key="selected._id" :flow-id="selected._id" studio :locked="actionInProgress"
              @state-change="editorState = $event" @saved="onSaved"
              @fullscreen-change="onFullscreenChange" @simulation-change="editorSimulationOpen = $event" />
          </div>
        </Teleport>
        <div v-if="!selected && mode === 'editor'" class="studio-empty">
          <div class="studio-empty-mark"><q-icon name="account_tree" size="32px" /></div>
          <h2>O seu próximo atendimento começa aqui</h2>
          <p>Abra um fluxo existente, crie o primeiro card ou conte ao agente como quer receber seus clientes.</p>
          <div class="studio-steps"><span>Boas-vindas</span><q-icon name="east" /><span>Decisão</span><q-icon name="east" /><span>Resposta</span></div>
        </div>

        <section v-if="mode === 'proposal' && proposal" ref="proposalView" class="studio-proposal" tabindex="-1" aria-label="Diagrama proposto pelo agente">
          <header>
            <div><span class="studio-kicker">AGUARDANDO REVISÃO</span><h2>{{ proposal.preview.data.name || proposal.title }}</h2><p>{{ graph.nodes.length }} etapas · {{ graph.edges.length }} conexões</p></div>
            <q-select v-if="proposals.length > 1" v-model="proposalId" :options="proposals" option-value="id" option-label="title" emit-value map-options outlined dense label="Proposta" />
          </header>
          <q-banner v-if="!canApplyAction(proposal)" dense class="bg-amber-1 text-brown-9" role="status">
            Abra a versão mais recente do fluxo e conclua as edições locais. Se o fluxo mudou, peça uma nova proposta para essa versão.
            <template #action><q-btn flat no-caps label="Atualizar editor" :disable="activeFlow?.dirty || activeFlow?.saving || activeFlow?.loading" @click="refreshEditor" /></template>
          </q-banner>
          <p v-else-if="previewMayBePartial" class="studio-review-hint">A prévia mostra até 100 etapas ou conexões. Confirme a proposta para testar o diagrama completo.</p>
          <p v-else class="studio-review-hint">Teste a proposta no simulador com respostas fictícias e confirme a alteração pelo painel do agente.</p>
          <VueFlow :id="`studio-preview-${proposal.id}`" :key="proposal.id" class="studio-graph" :nodes="graph.nodes" :edges="graph.edges" :nodes-draggable="false" :nodes-connectable="false" :edges-updatable="false" :delete-key-code="null" fit-view-on-init :min-zoom="0.02">
            <template #node-bot="node"><FlowNode v-bind="node" /></template>
            <Background pattern-color="#b5d5cc" :gap="20" />
            <Controls :show-interactive="false" />
          </VueFlow>
        </section>
        <nav v-if="maySeeFlows" class="studio-resources" aria-label="Recursos do chatbot">
          <q-btn v-if="proposal && !reviewingProposal" flat no-caps icon="account_tree" label="Ver proposta no diagrama" @click="showProposal" />
          <q-btn v-if="canArea(user, 'web_catalog')" flat no-caps icon="storefront" label="Catálogo" to="/whatsapp-web/catalog" />
          <q-btn v-if="canArea(user, 'web_integrations')" flat no-caps icon="hub" label="Integrações e perfis de IA" to="/whatsapp-web/integrations" />
          <q-btn v-if="canArea(user, 'web_connection')" flat no-caps icon="qr_code_2" label="Conexão WhatsApp" to="/whatsapp-web/connection" />
        </nav>
      </section>

    </div>
    <AdminAssistant ref="agent" scope="chatbot" :workspace-context="contextText" :action-allowed="canApplyAction"
      @actions-updated="onActionsUpdated" @action-applied="onActionApplied" @visibility-change="onAgentVisibility" />
    <Teleport to="body">
      <AssistantFloat v-if="maySimulate" kind="simulator" :expanded="simulatorOpen" :disabled="!simulatorOpen && !simulatorReady"
        :label="simulatorOpen ? 'Fechar simulador' : simulatorReady ? 'Abrir simulador' : 'Abra um fluxo para simular'"
        :loading="!simulatorOpen && actionInProgress" @toggle="simulate">
        <q-icon :name="simulatorOpen ? 'close' : 'smartphone'" />
      </AssistantFloat>
    </Teleport>

    <FlowSimulator
      v-if="proposalSimulation"
      v-bind="proposalSimulation"
      detached docked
      preview-only
      @close="proposalSimulation = null"
    />

    <q-dialog v-model="creating" :persistent="saving">
      <q-card class="studio-dialog"><q-form @submit="createFlow">
        <q-card-section><h2>Novo fluxo</h2><p>Comece com uma mensagem de boas-vindas e adicione as próximas etapas.</p></q-card-section>
        <q-card-section><q-input v-model="newName" outlined autofocus maxlength="120" label="Nome do chatbot" :rules="[value => Boolean(value?.trim()) || 'Informe o nome.']" /><q-banner v-if="error" dense class="bg-red-1 text-red-10" role="alert">{{ error }}</q-banner></q-card-section>
        <q-card-actions align="right"><q-btn flat no-caps label="Cancelar" :disable="saving" v-close-popup /><q-btn color="primary" unelevated no-caps type="submit" label="Criar fluxo" :loading="saving" /></q-card-actions>
      </q-form></q-card>
    </q-dialog>

    <q-dialog v-model="linksOpen">
      <q-card class="studio-dialog">
        <q-card-section class="row items-center"><h2 class="col">Links públicos</h2><q-btn flat round icon="close" aria-label="Fechar links públicos" v-close-popup /></q-card-section>
        <q-card-section v-if="linksLoading"><q-spinner color="primary" /> Consultando a instalação…</q-card-section>
        <q-card-section v-else-if="linksError" class="text-negative" role="alert">{{ linksError }}</q-card-section>
        <q-card-section v-else-if="!links?.profile">Configure um endereço HTTPS público para disponibilizar as páginas desta instalação.</q-card-section>
        <q-card-section v-else>
          <p v-if="links.desktopPortal">As páginas do Desktop ficam disponíveis enquanto a licença estiver válida, o aplicativo estiver aberto e o acesso público conectado.</p>
          <q-list separator>
            <q-item v-for="link in [{ title: 'Perfil do contato', url: links.profile }, ...links.catalogs]" :key="link.url">
              <q-item-section><q-item-label>{{ link.title }}</q-item-label><q-item-label caption class="studio-url">{{ link.url }}</q-item-label></q-item-section>
              <q-item-section side><q-btn flat round icon="content_copy" :aria-label="`Copiar link ${link.title}`" @click="copyLink(link.url)" /></q-item-section>
              <q-item-section side><q-btn flat round icon="open_in_new" :aria-label="`Abrir ${link.title}`" :href="link.url" target="_blank" rel="noopener noreferrer" /></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </main>
</template>

<style scoped>
.flow-canvas :deep(.vue-flow__edge.selected .vue-flow__edge-path),
.studio-graph :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #007c64 !important;
  stroke-width: 4 !important;
  filter: drop-shadow(0 0 4px #43dfbc);
}

.chatbot-studio { max-width: 1660px; margin: auto; padding: clamp(12px, 2vw, 26px); padding-bottom: 90px; color: #13352d; background: linear-gradient(155deg,#f8fffc,#ebf9f2); }
.studio-hero { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 16px; padding: clamp(18px, 3vw, 35px); border: 1px solid #b9e6d2; border-radius: 24px; background: radial-gradient(ellipse at top right, #a1e3cb, transparent 69%), linear-gradient(135deg,#f4fff9,#c5efdc); color: #143d30; }
.studio-back { margin: -8px 0 16px; color: #1c5d48; }
.studio-badges, .studio-hero-actions, .studio-resources, .studio-modes { display: flex; flex-wrap: wrap; gap: 8px; }
.studio-badges span { display: inline-flex; gap: 6px; align-items: center; border-radius: 999px; background: #f6fffb; color: #194b38; border: 1px solid #8ccdb4; padding: 5px 10px; font-size: .75rem; font-weight: 700; }
.studio-hero h1 { margin: 10px 0 5px; font-size: clamp(1.9rem, 4vw, 3.25rem); line-height: 1.12; font-weight: 800; letter-spacing: -.04em; }
.studio-hero p { max-width: 510px; margin: 0; color: #315e51; }
.studio-simulate { background: #18765b; color: white; font-weight: 750; }
.studio-workspace { min-width: 0; }
.studio-picker { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.studio-picker .q-select { flex: 1; min-width: 0; }
.studio-builder { padding: 0; }
.studio-empty, .studio-proposal { border: 1px solid #cee8e0; border-radius: 18px; background: #fafffd; overflow: hidden; }
.studio-proposal { scroll-margin-top: 76px; }
.studio-empty { display: grid; min-height: 360px; align-content: center; justify-items: center; gap: 12px; padding: 24px; text-align: center; }
.studio-empty-mark { display: grid; place-items: center; width: 62px; height: 62px; border-radius: 20px; color: #136753; background: #dff7ed; }
.studio-empty h2, .studio-proposal h2, .studio-dialog h2 { margin: 0; line-height: 1.25; font-size: 1.25rem; font-weight: 780; overflow-wrap: anywhere; }
.studio-empty p, .studio-proposal p, .studio-dialog p { margin: 0; color: #506e65; }
.studio-empty p { max-width: 360px; }
.studio-steps { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; color: #386e5f; }
.studio-steps span { padding: 7px 10px; border: 1px solid #cce6dc; background: #f0fbf7; border-radius: 10px; font-size: .76rem; font-weight: 650; }
.studio-resources { margin-top: 12px; }
.studio-resources .q-btn { color: #176354; }
.studio-modes { margin: 0 0 12px; }
.studio-mode-active { background: #d8f5e9; color: #125846; }
.studio-proposal > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 17px; border-bottom: 1px solid #cee8e0; }
.studio-kicker { display: block; color: #216f5b; font-size: .68rem; font-weight: 800; letter-spacing: .12em; margin-bottom: 4px; }
.studio-proposal .studio-review-hint { padding: 10px 17px; font-size: .81rem; }
.studio-graph { height: clamp(340px, 54dvh, 700px); background: #eef8f5; }
.studio-dialog { width: min(620px, 100%); max-width: calc(100vw - 30px); }
.studio-dialog p { margin-top: 8px; }
.studio-url { overflow-wrap: anywhere; user-select: text; }
@media (max-width: 620px) {
  .studio-hero { align-items: stretch; flex-direction: column; }
  .studio-hero-actions .q-btn { flex: 1 0 auto; }
  .studio-picker { align-items: stretch; flex-direction: column; }
  .studio-empty { min-height: 290px; padding: 18px; }
  .studio-resources .q-btn { min-height: 44px; }
}
</style>
