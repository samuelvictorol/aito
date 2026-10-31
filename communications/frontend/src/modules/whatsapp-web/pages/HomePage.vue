<script setup>
import RouterLink from '../../../components/PrototypeAwareRouterLink.vue'
import { inPrototype } from '../../../services/prototype-runtime.js'
const prototype = inPrototype()
import { vCanAction } from '../../../services/permission-directives.js'
import { canArea, canAction } from '../../../services/access.js'
import { getStoredUser } from '../../../services/tokens.js'
import { vAuthSrc } from '../authenticated-media.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { api, formatDate, messageOf, socket } from '../services.js'
import { connectionMemoryState } from '../connection-resources.js'
import { connectionStatus } from '../connection-status.js'

const mayImport = computed(() => canAction(getStoredUser(), 'web_connection', 'import') && canAction(getStoredUser(), 'web_settings', 'configure'))
const data = ref({ whatsapp: { state: 'STARTING' }, queue: {} })
const qrImage = ref('')
const loading = ref('')
const toast = ref('')
const settings = ref(null)
const importBackup = ref(false)
const importContacts = ref(false)
const readiness = ref(null)
const now = ref(Date.now())
let clock, qrGeneration = 0

const connection = computed(() => connectionStatus(data.value.whatsapp, now.value))
const connected = computed(() => connection.value.connected)
const stateLabel = computed(() => connection.value.label)
const queueCount = computed(() => Number(data.value.queue?.wait || 0) + Number(data.value.queue?.delayed || 0) + Number(data.value.queue?.active || 0))
const resources = computed(() => data.value.whatsapp?.resources)
const resourcesBlocked = computed(() => connectionMemoryState(resources.value).blocked)
const resourcesAwaitingRecovery = computed(() => connectionMemoryState(resources.value).awaitingManualRecovery)
const memoryLabel = (bytes) => Number.isFinite(bytes) ? `${Math.round(bytes / (1024 * 1024))} MB` : 'Não informado'

watch(() => data.value.whatsapp?.qr, async (value) => {
  const generation = ++qrGeneration
  qrImage.value = ''
  if (!value) return
  const image = await QRCode.toDataURL(value, { width: 380, margin: 2, color: { dark: '#092d26', light: '#ffffff' } })
  if (generation === qrGeneration && value === data.value.whatsapp?.qr) qrImage.value = image
}, { immediate: true })

function show(value) { toast.value = value; setTimeout(() => { if (toast.value === value) toast.value = '' }, 4200) }
async function load() {
  try {
    const [dashboard, configuration, flowReadiness] = await Promise.allSettled([api.get('/dashboard'), canArea(getStoredUser(), 'web_settings') ? api.get('/settings') : Promise.resolve({ data: {} }), canArea(getStoredUser(), 'web_flows') ? api.get('/flow-readiness') : Promise.resolve({ data: {} })])
    if (dashboard.status === 'fulfilled') data.value = dashboard.value.data
    else show(messageOf(dashboard.reason))
    if (configuration.status === 'fulfilled') {
      settings.value = configuration.value.data
      importBackup.value = configuration.value.data.runtime?.importHistoryOnConnect === true
      importContacts.value = configuration.value.data.runtime?.importContactsOnConnect === true
    }
    if (flowReadiness.status === 'fulfilled') readiness.value = flowReadiness.value.data
  }
  catch (cause) { show(messageOf(cause)) }
}
async function updateBackup() {
  if (prototype) return
  if (!mayImport.value) return
  loading.value = 'backup'
  try {
    settings.value = (await api.put('/settings', { runtime: { importHistoryOnConnect: importBackup.value } })).data
    importBackup.value = settings.value.runtime?.importHistoryOnConnect === true
    show(importBackup.value ? 'Importação de backup habilitada. O histórico não aciona o bot.' : 'Importação desativada. Apenas mensagens novas serão processadas.')
  } catch (cause) { importBackup.value = settings.value?.runtime?.importHistoryOnConnect === true; show(messageOf(cause)) }
  finally { loading.value = '' }
}
async function updateContactsImport() {
  if (prototype) return
  if (!mayImport.value) return
  loading.value = 'contacts'
  try {
    settings.value = (await api.put('/settings', { runtime: { importContactsOnConnect: importContacts.value } })).data
    if (importContacts.value && connected.value) { await api.post('/whatsapp/sync-contacts', { confirmed: true }); show('Importação da agenda iniciada. Os contatos existentes serão atualizados sem duplicação.') }
    else show(importContacts.value ? 'A agenda será importada quando a sessão conectar.' : 'Importação da agenda desativada. Contatos já salvos foram preservados.')
  } catch (cause) { importContacts.value = settings.value?.runtime?.importContactsOnConnect === true; show(messageOf(cause)) }
  finally { loading.value = '' }
}
async function invoke(name, endpoint, success) {
  if (prototype) return
  if (loading.value || (endpoint !== '/whatsapp/sync' && connection.value.actionsBlocked)) return
  loading.value = name
  try { await api.post(endpoint, ['/whatsapp/sync', '/whatsapp/sync-contacts'].includes(endpoint) ? { confirmed: true } : undefined); await load(); if (success) show(success) }
  catch (cause) { show(messageOf(cause)) }
  finally { loading.value = '' }
}
async function regenerate() {
  if (prototype) return
  if (loading.value || connection.value.actionsBlocked) return
  if (!confirm('Gerar um novo QR Code desvincula o aparelho atual e apaga a sessão salva. Para retomar a mesma sessão sem desvincular, use “Tentar reconectar”. Continuar com outro pareamento?')) return
  await invoke('regenerate', '/whatsapp/regenerate', 'Novo pareamento iniciado. Aguarde o QR Code.')
}
function onStatus(status) { data.value = { ...data.value, whatsapp: status } }
function onQr(payload) { data.value = { ...data.value, whatsapp: { ...data.value.whatsapp, state: 'QR_REQUIRED', ready: false, authenticated: false, qr: payload.qr } } }

onMounted(() => { load(); clock = setInterval(() => { now.value = Date.now() }, 1000); socket.on('whatsapp:status', onStatus); socket.on('whatsapp:qr', onQr) })
onBeforeUnmount(() => { clearInterval(clock); qrGeneration++; socket.off('whatsapp:status', onStatus); socket.off('whatsapp:qr', onQr) })
</script>

<template>
  <section class="connection-page">
    <div class="page-head"><div><span class="eyebrow">WhatsApp Web direto</span><h1>Conexão do WhatsApp</h1><p>Conecte o aparelho pelo QR Code e acompanhe a sessão.</p></div><RouterLink v-if="canArea(getStoredUser(), 'web_flows')" class="btn" to="/whatsapp-web/flows">Abrir fluxos →</RouterLink></div>
    <aside v-if="readiness?.issues?.length" class="flow-readiness card" role="status"><strong>{{ readiness.flowName || 'Fluxo ativo' }}: complete as configurações</strong><p>Confira os itens abaixo antes de usar o atendimento.</p><ul><li v-for="issue in readiness.issues" :key="`${issue.code}-${issue.nodeId || issue.key || issue.assetId}`">{{ issue.message }}</li></ul><RouterLink class="btn secondary" to="/whatsapp-web/flows">Conferir fluxo</RouterLink><RouterLink v-if="canArea(getStoredUser(), 'web_integrations')" class="btn secondary" to="/whatsapp-web/integrations">Abrir integrações</RouterLink></aside>
    <div class="grid stats-grid">
      <div class="card stat-card"><span>Fluxos</span><strong>{{ data.flows || 0 }}</strong><small>{{ data.activeFlows || 0 }} ativo</small></div>
      <div class="card stat-card"><span>Conversas</span><strong>{{ data.chats || 0 }}</strong><small>Somente WhatsApp Web</small></div>
      <div class="card stat-card"><span>Mensagens</span><strong>{{ data.messages || 0 }}</strong><small>Recebidas e enviadas</small></div>
      <div class="card stat-card"><span>Fila</span><strong>{{ queueCount }}</strong><small>Processamento econômico</small></div>
    </div>
    <div class="home-grid">
      <article class="card connection-card">
        <header><div><span class="eyebrow">Sessão do aparelho</span><h2>{{ stateLabel }}</h2></div><span :class="['status-chip', connected ? '' : 'warn']"><i class="status-dot"></i>{{ connection.badge }}</span></header>
        <div v-if="connected" class="profile-ready">
          <img v-if="data.whatsapp.self?.avatarUrl" v-auth-src="data.whatsapp.self.avatarUrl" alt="Foto do WhatsApp">
          <span v-else>✓</span>
          <div><b>{{ data.whatsapp.self?.name || 'WhatsApp conectado' }}</b><small>+{{ data.whatsapp.self?.number }}</small><em>Mensagens novas chegam pelo evento em tempo real.</em></div>
        </div>
        <div v-else class="qr-box" :aria-busy="connection.booting || connection.closing">
          <img v-if="connection.showQr && qrImage" v-auth-src="qrImage" alt="QR Code do WhatsApp">
          <div v-else class="qr-placeholder" role="status" aria-live="polite"><span aria-hidden="true">{{ connection.booting || connection.closing ? '…' : '⌁' }}</span><small>{{ connection.message }}</small></div>
        </div>
        <p class="helper"><template v-if="connection.showQr">{{ connection.message }} </template>Tentar reconectar preserva a sessão salva. Novo QR desvincula o aparelho atual e serve para iniciar outro pareamento.</p>
        <div class="actions">
          <button v-can-action="'web_connection.configure'" v-if="connection.showStart" class="btn" :disabled="prototype || loading || connection.actionsBlocked" @click="invoke('connect','/whatsapp/connect')">Iniciar sessão</button>
          <button v-can-action="'web_connection.configure'" v-if="!connected" class="btn secondary" :disabled="prototype || loading || connection.actionsBlocked" @click="invoke('recover','/whatsapp/recover','Reconexão iniciada.')">Tentar reconectar</button>
          <button v-can-action="'web_connection.import'" v-if="connected && importBackup" class="btn secondary" :disabled="prototype || loading || data.whatsapp.historySyncing" @click="invoke('sync','/whatsapp/sync','Importação iniciada. O backup não aciona o bot.')">{{ data.whatsapp.historySyncing ? 'Importando…' : 'Importar conversas do backup' }}</button>
          <p v-if="data.whatsapp.historyError" class="error">{{ data.whatsapp.historyError }}</p>
          <button v-can-action="'web_connection.configure'" class="btn danger" :disabled="prototype || loading || connection.actionsBlocked" @click="regenerate">Novo QR</button>
        </div>
        <div v-if="mayImport" class="backup-policy"><label class="toggle"><input v-model="importContacts" type="checkbox" :disabled="prototype || Boolean(loading) || !settings" @change="updateContactsImport">Importar contatos da agenda do WhatsApp</label><small>Desmarcado por padrão. Marque para importar agora, se conectado, e sincronizar nas próximas conexões. Quem enviar mensagem continuará sendo salvo automaticamente. Desmarcar preserva os contatos existentes.</small><button v-can-action="'web_connection.import'" v-if="connected && importContacts" class="btn secondary" :disabled="prototype || Boolean(loading)" @click="invoke('contacts','/whatsapp/sync-contacts','Importação da agenda iniciada.')">Importar agenda novamente</button></div>
        <div v-if="mayImport" class="backup-policy"><label class="toggle"><input v-model="importBackup" type="checkbox" :disabled="prototype || Boolean(loading) || !settings" @change="updateBackup">Importar mensagens de backup ao conectar</label><small>Desativado por padrão. Ao habilitar, o backup fica disponível no histórico. Mensagens anteriores à conexão não acionam fluxos ou comandos.</small></div>
        <p v-if="resourcesAwaitingRecovery && !connection.booting && !connection.closing && !connected" class="resource-recovery" role="status">A memória voltou ao limite seguro. Use “Tentar reconectar” para retomar a sessão preservada.</p>
        <p v-else-if="data.whatsapp.lastError" class="error resource-error" role="status">{{ data.whatsapp.lastError }}</p>
      </article>
      <aside class="side-cards">
        <article class="card policy-card"><span class="policy-icon">↩</span><div><span class="eyebrow">Política receptiva</span><h3>Atendimento e avisos configurados</h3><p>O operador responde na janela de 24 horas. Cards de Chat WhatsApp e confirmações de pagamento enviam avisos aos destinatários que você configurar.</p></div></article>
        <article class="card policy-card"><span class="policy-icon">◫</span><div><span class="eyebrow">Recursos da sessão</span><h3>{{ resourcesBlocked ? 'Conexão protegida por limite de memória' : 'Memória acompanhada pelo servidor' }}</h3><p>O WhatsApp Web usa um navegador no servidor. Se faltar memória, a conexão aguarda com a sessão preservada e o painel continua disponível.</p><dl v-if="resources" class="resource-budget"><div><dt>Limite do serviço</dt><dd>{{ memoryLabel(resources.limitBytes) }}</dd></div><div><dt>Em uso</dt><dd>{{ memoryLabel(resources.usedBytes) }}</dd></div><div><dt>Mínimo para conectar</dt><dd>{{ memoryLabel(resources.minimumBytes) }}</dd></div></dl></div></article>
        <article class="card status-detail"><span><b>Histórico recente</b><small>{{ data.whatsapp.historySyncing ? 'Importando agora…' : data.whatsapp.historySyncedAt ? `Última vez: ${formatDate(data.whatsapp.historySyncedAt, true)}` : 'Importação manual disponível ao conectar' }}</small></span><span v-if="connection.diskVerified"><b>Persistência</b><small>Disco persistente verificado</small></span><span><b>Arquivos</b><small>{{ data.assets || 0 }} item(ns) na biblioteca</small></span></article>
      </aside>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped>
.stat-card small{color:#8a9995;font-size:.68rem}.home-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr);gap:18px;margin-top:18px}.connection-card{padding:24px}.connection-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.connection-card h2{margin:5px 0 18px;font:800 1.35rem Inter,'Segoe UI',sans-serif}.qr-box{display:grid;min-height:350px;place-items:center;border:1px dashed #bad8d0;border-radius:18px;background:#f8fffd}.qr-box img{width:min(315px,90%)}.qr-placeholder{display:grid;place-items:center;color:#77a69c}.qr-placeholder span{font-size:4rem}.qr-placeholder small{font-size:.72rem}.profile-ready{display:flex;min-height:350px;align-items:center;justify-content:center;gap:18px}.profile-ready>img,.profile-ready>span{display:grid;width:92px;height:92px;place-items:center;border-radius:50%;background:#dcf8f0;font-size:2.4rem;object-fit:cover}.profile-ready b,.profile-ready small,.profile-ready em{display:block}.profile-ready small{margin-top:4px;color:#5f756f}.profile-ready em{margin-top:11px;color:#879792;font-size:.68rem;font-style:normal}.helper{color:#697d77;font-size:.73rem;line-height:1.55}.actions{display:flex;flex-wrap:wrap;gap:9px}.error{color:#b32c41;font-size:.72rem}.side-cards{display:grid;gap:14px}.policy-card{display:flex;align-items:flex-start;gap:14px;padding:20px}.policy-icon{display:grid;flex:0 0 48px;width:48px;height:48px;place-items:center;border-radius:14px;color:#0b6656;background:#dff8f1;font-size:1.4rem}.policy-card h3{margin:5px 0 7px;font:800 1rem Inter,'Segoe UI',sans-serif}.policy-card p{margin:0;color:#687b76;font-size:.74rem;line-height:1.5}.status-detail{display:grid;padding:8px 20px}.status-detail span{padding:14px 0;border-bottom:1px solid var(--line)}.status-detail span:last-child{border-bottom:0}.status-detail b,.status-detail small{display:block}.status-detail b{font-size:.75rem}.status-detail small{margin-top:4px;color:#7a8b86;font-size:.67rem}@media(max-width:980px){.home-grid{grid-template-columns:1fr}}@media(max-width:600px){.connection-card{padding:16px}.connection-card>header{align-items:flex-start;flex-direction:column}.qr-box,.profile-ready{min-height:280px}.profile-ready{flex-direction:column;text-align:center}}
</style>

<style scoped>
.qr-placeholder{max-width:420px;padding:20px;text-align:center;gap:10px}.qr-placeholder small{font-size:.85rem;line-height:1.6}
.backup-policy{display:grid;gap:8px;margin-top:18px;padding:14px;border:1px solid var(--line);border-radius:12px}.backup-policy .toggle{font-size:12px;font-weight:650}.backup-policy small{font-size:12px;line-height:1.5;color:var(--muted)}.flow-readiness{padding:18px;margin-bottom:20px;background:#fff8e8;border-color:#e6ca83}.flow-readiness p,.flow-readiness li{font-size:13px;line-height:1.6}.flow-readiness p{margin:6px 0}.flow-readiness .btn{margin:5px 8px 0 0}
</style>

<style scoped src="../connection-mobile.css"></style>
