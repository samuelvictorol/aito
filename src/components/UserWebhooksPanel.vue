<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { io } from 'socket.io-client'
import { api, apiBaseURL } from 'boot/axios'

const $q = useQuasar()
const endpoint = '/desktop-webhook-console'
const tokenKinds = [
  { value: 'verify', label: 'Verificação da Meta' },
  { value: 'integration', label: 'Integração externa' },
]
const eventKinds = [
  { value: 'relay', label: 'Entregas do relay', icon: 'mdi-transfer' },
  { value: 'meta', label: 'Eventos Meta', icon: 'mdi-whatsapp' },
]

const installations = ref([])
const selectedId = ref(null)
const detail = ref(null)
const events = ref([])
const eventKind = ref('relay')
const live = ref(false)
const loading = reactive({ installations: false, details: false, events: false, event: false, create: false })
const errors = reactive({ installations: '', details: '', events: '', event: '', create: '' })
const tokenDialog = ref(false)
const tokenDraft = reactive({ name: '', kind: 'verify', token: '' })
const createdToken = ref(null)
const eventDialog = ref(false)
const openedEvent = ref(null)
const revoking = ref(null)
let socket, poll, debounce, expiryTimer
let disposed = false
let listRequest = 0
let detailRequest = 0
let eventsRequest = 0
let eventRequest = 0
let tokenRequest = 0

const selection = computed(() => installations.value.find(item => item.licenseId === selectedId.value))
const selectedSlug = computed(() => selection.value?.slug)
const options = computed(() => installations.value.map(item => ({
  value: item.licenseId,
  label: 'Licença Desktop · ' + item.licenseId.slice(-8).toUpperCase()
    + (!item.active ? ' · inativa' : !item.slug ? ' · sem instalação' : item.connected ? ' · conectada' : ' · offline'),
})))
const webhookUrl = computed(() => selection.value?.active ? detail.value?.url : null)
const connected = computed(() => Boolean(selection.value?.active && detail.value?.connected))
const manageable = computed(() => Boolean(selectedSlug.value && selection.value?.active && detail.value?.manageable))
const tokens = computed(() => detail.value?.tokens || [])
const status = computed(() => {
  if (!selection.value?.active) return { label: 'Licença inativa', icon: 'mdi-lock-outline', color: 'warning' }
  if (!selectedSlug.value) return { label: 'Aguardando instalação', icon: 'mdi-monitor-arrow-down', color: 'neutral' }
  if (loading.details && !detail.value) return { label: 'Consultando o Desktop', icon: 'mdi-sync', color: 'neutral' }
  if (connected.value) return { label: 'Desktop conectado', icon: 'mdi-lan-connect', color: 'positive' }
  return { label: 'Desktop desconectado', icon: 'mdi-lan-disconnect', color: 'neutral' }
})

const sessionToken = () => localStorage.getItem('aito_user_token')
const config = params => ({ headers: { Authorization: 'Bearer ' + (sessionToken() || '') }, params })
const urlFor = (slug, suffix = '') => endpoint + '/' + encodeURIComponent(slug) + suffix
const failure = (error, fallback) => error.response?.data?.message || fallback

function formatDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

function tokenLabel(kind) {
  return tokenKinds.find(item => item.value === kind)?.label || 'Webhook'
}

function eventDate(event) {
  return formatDate(event.receivedAt || event.createdAt)
}

function eventSize(event) {
  if (event.size == null || !Number.isFinite(Number(event.size))) return ''
  return Number(event.size).toLocaleString('pt-BR') + ' bytes'
}

function eventLabel(event) {
  const kind = event.field || event.kind || event.source
  return {
    verify: 'Validação do endereço',
    integration: 'Integração externa',
    meta: 'WhatsApp Cloud',
    messages: 'Mensagens',
    message_template_status_update: 'Atualização de template',
  }[kind] || kind || 'Evento de webhook'
}

function eventStatus(event) {
  const state = event.processingStatus ?? event.status
  const code = Number(state)
  if (Number.isInteger(code) && code >= 200 && code < 600) {
    return { label: String(code), tone: code < 300 ? 'positive' : 'warning' }
  }
  const labels = {
    processed: { label: 'Processado', tone: 'positive' },
    delivered: { label: 'Entregue', tone: 'positive' },
    received: { label: 'Recebido', tone: 'positive' },
    accepted: { label: 'Aceito', tone: 'positive' },
    pending: { label: 'Pendente', tone: 'neutral' },
    queued: { label: 'Na fila', tone: 'neutral' },
    failed: { label: 'Falhou', tone: 'warning' },
    rejected: { label: 'Recusado', tone: 'warning' },
    ignored: { label: 'Ignorado', tone: 'neutral' },
  }
  return labels[state] || { label: state || '—', tone: 'neutral' }
}

const eventJson = computed(() => {
  let payload = openedEvent.value?.payload
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { /* Keep plain text as a JSON string. */ }
  }
  if (payload == null) return ''
  return JSON.stringify(payload, (key, value) => {
    if (/token|authorization|secret|password|api[_-]?key|signature/i.test(key)) return '[oculto]'
    if (typeof value === 'string') return value.replace(/\bBearer\s+[A-Za-z0-9_~+./=-]+/gi, 'Bearer [oculto]')
    return value
  }, 2)
})

function clearLiveData() {
  eventsRequest++
  events.value = []
  errors.events = ''
  loading.events = false
  eventDialog.value = false
  tokenDialog.value = false
  clearEventDialog()
  clearTokenDialog()
}

function clearConsole() {
  detailRequest++
  detail.value = null
  loading.details = false
  errors.details = ''
  clearLiveData()
}

function handleDenied(slug, error, statuses = [401, 403, 404]) {
  const code = error.response?.status
  if (slug !== selectedSlug.value || !statuses.includes(code)) return false
  clearConsole()
  if (code === 401) {
    installations.value = []
    errors.installations = failure(error, 'Entre novamente para abrir os webhooks.')
  } else {
    installations.value = installations.value.map(item => item.slug !== slug ? item : {
      ...item,
      ...(code === 403 ? { active: false } : { slug: null, url: null }),
      connected: false,
      manageable: false,
    })
  }
  return true
}

async function loadInstallations() {
  const request = ++listRequest
  loading.installations = true
  errors.installations = ''
  try {
    const { data } = await api.get(endpoint, config())
    if (request !== listRequest) return
    installations.value = data.data.items || []
    if (!installations.value.some(item => item.licenseId === selectedId.value)) {
      selectedId.value = (installations.value.find(item => item.manageable)
        || installations.value.find(item => item.active && item.slug)
        || installations.value.find(item => item.slug)
        || installations.value[0])?.licenseId || null
    }
    return true
  } catch (error) {
    if (request !== listRequest) return
    clearConsole()
    if ([401, 403].includes(error.response?.status)) installations.value = []
    errors.installations = failure(error, 'Não foi possível carregar suas licenças Desktop.')
  } finally {
    if (request === listRequest) loading.installations = false
  }
}

async function loadDetails(slug) {
  if (slug !== selectedSlug.value || !selection.value?.active) return
  const request = ++detailRequest
  loading.details = true
  errors.details = ''
  try {
    const { data } = await api.get(urlFor(slug), config())
    if (request !== detailRequest) return
    detail.value = data.data
    if (manageable.value) await loadEvents(slug, eventKind.value)
    else clearLiveData()
  } catch (error) {
    if (request !== detailRequest || handleDenied(slug, error)) return
    clearConsole()
    errors.details = failure(error, 'Não foi possível consultar esta instalação.')
  } finally {
    if (request === detailRequest) loading.details = false
  }
}

async function loadEvents(slug, kind) {
  const request = ++eventsRequest
  loading.events = true
  errors.events = ''
  try {
    const { data } = await api.get(urlFor(slug, '/events'), config({ kind }))
    if (request === eventsRequest) events.value = data.data.items || []
  } catch (error) {
    if (request !== eventsRequest || handleDenied(slug, error)) return
    events.value = []
    errors.events = failure(error, 'Não foi possível consultar os registros desta instalação.')
  } finally {
    if (request === eventsRequest) loading.events = false
  }
}

async function refresh() {
  const previousSlug = selectedSlug.value
  const wasActive = selection.value?.active
  if (await loadInstallations() && wasActive && previousSlug && previousSlug === selectedSlug.value) {
    await loadDetails(previousSlug)
  }
}

watch([selectedId, selectedSlug, () => selection.value?.active], ([, slug, active]) => {
  clearConsole()
  if (slug && active) void loadDetails(slug)
})

watch([selectedId, () => selection.value?.active, () => selection.value?.expiresAt], ([id, active, expiresAt]) => {
  clearTimeout(expiryTimer)
  if (!active || !expiresAt) return
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return
  function scheduleExpiryCheck() {
    const remaining = expires - Date.now()
    expiryTimer = setTimeout(() => {
      if (id !== selectedId.value) return
      if (Date.now() < expires) return scheduleExpiryCheck()
      clearConsole()
      void refresh()
    }, Math.max(0, Math.min(remaining, 2147483647)))
  }
  scheduleExpiryCheck()
})

watch(eventKind, kind => {
  events.value = []
  eventDialog.value = false
  if (manageable.value) void loadEvents(selectedSlug.value, kind)
})

async function copy(value, label) {
  if (!value) return
  try {
    await copyToClipboard(value)
    $q.notify({ type: 'positive', message: label + ' copiado.' })
  } catch {
    $q.notify({ type: 'warning', message: 'Selecione o texto para copiá-lo manualmente.' })
  }
}

function openTokenDialog() {
  if (!manageable.value) return
  Object.assign(tokenDraft, { name: '', kind: 'verify', token: '' })
  errors.create = ''
  createdToken.value = null
  tokenDialog.value = true
}

function clearTokenDialog() {
  tokenRequest++
  loading.create = false
  tokenDraft.token = ''
  createdToken.value = null
}

async function createToken() {
  const slug = selectedSlug.value
  if (!manageable.value || !tokenDraft.name.trim() || loading.create) return
  const token = tokenDraft.token.trim()
  if (token && !/^[!-~]{16,512}$/.test(token)) {
    errors.create = 'Use de 16 a 512 caracteres sem espaços ou deixe o campo em branco.'
    return
  }
  const request = ++tokenRequest
  loading.create = true
  errors.create = ''
  try {
    const { data } = await api.post(urlFor(slug, '/tokens'), {
      name: tokenDraft.name.trim(),
      kind: tokenDraft.kind,
      ...(token ? { token } : {}),
    }, config())
    if (disposed || request !== tokenRequest || !tokenDialog.value || slug !== selectedSlug.value) return
    createdToken.value = data.data
    tokenDraft.token = ''
    void loadDetails(slug)
  } catch (error) {
    if (!disposed && request === tokenRequest && slug === selectedSlug.value && !handleDenied(slug, error, [401, 403])) {
      errors.create = failure(error, 'Não foi possível criar o token.')
    }
  } finally {
    if (request === tokenRequest) loading.create = false
  }
}

function confirmRevocation(token) {
  const slug = selectedSlug.value
  $q.dialog({
    title: 'Revogar token?',
    message: 'Entregas que usam este token precisarão de uma nova credencial.',
    ok: { label: 'Revogar', color: 'negative', flat: true },
    cancel: { label: 'Cancelar', flat: true },
  }).onOk(async () => {
    if (disposed || !manageable.value || slug !== selectedSlug.value || revoking.value) return
    revoking.value = token._id
    try {
      await api.delete(urlFor(slug, '/tokens/' + encodeURIComponent(token._id)), config())
      if (disposed || slug !== selectedSlug.value) return
      await loadDetails(slug)
      $q.notify({ type: 'positive', message: 'Token revogado.' })
    } catch (error) {
      if (!disposed && slug === selectedSlug.value && !handleDenied(slug, error, [401, 403])) {
        $q.notify({ type: 'negative', message: failure(error, 'Não foi possível revogar o token.') })
      }
    } finally {
      revoking.value = null
    }
  })
}

async function openEvent(event) {
  if (!manageable.value || !event.id) return
  const request = ++eventRequest
  const slug = selectedSlug.value
  const kind = eventKind.value
  eventDialog.value = true
  openedEvent.value = event
  errors.event = ''
  loading.event = true
  try {
    const { data } = await api.get(urlFor(slug, '/events/' + encodeURIComponent(event.id)), config({ kind }))
    if (request === eventRequest) openedEvent.value = data.data
  } catch (error) {
    if (request === eventRequest && !handleDenied(slug, error, [401, 403])) {
      errors.event = failure(error, 'Não foi possível abrir este registro.')
    }
  } finally {
    if (request === eventRequest) loading.event = false
  }
}

function clearEventDialog() {
  eventRequest++
  openedEvent.value = null
  loading.event = false
  errors.event = ''
}

function scheduleRefresh() {
  if (disposed || debounce) return
  debounce = setTimeout(() => {
    debounce = undefined
    void refresh()
  }, 2000)
}

function onLicenseChanged(event) {
  if (!event?.licenseId || event.licenseId === selectedId.value) {
    listRequest++
    loading.installations = false
    clearConsole()
  }
  clearTimeout(debounce)
  debounce = undefined
  void refresh()
}

onMounted(() => {
  void refresh()
  const origin = new URL(apiBaseURL, window.location.origin).origin
  socket = io(origin + '/products', { auth: done => done({ token: sessionToken() }) })
  socket.on('connect', () => { live.value = true; scheduleRefresh() })
  socket.on('disconnect', () => { live.value = false })
  socket.on('desktop.webhook.updated', scheduleRefresh)
  socket.on('license.updated', onLicenseChanged)
  window.addEventListener('focus', scheduleRefresh)
  poll = setInterval(() => {
    const expiryDue = selection.value?.active && Date.parse(selection.value.expiresAt) <= Date.now()
    if (!socket.connected || !manageable.value || errors.events || errors.details || expiryDue) scheduleRefresh()
  }, 15000)
})

onBeforeUnmount(() => {
  disposed = true
  listRequest++
  detailRequest++
  eventsRequest++
  eventRequest++
  clearTokenDialog()
  clearEventDialog()
  socket?.disconnect()
  clearInterval(poll)
  clearTimeout(debounce)
  clearTimeout(expiryTimer)
  window.removeEventListener('focus', scheduleRefresh)
})
</script>

<template>
  <section class="webhook-console" aria-labelledby="webhook-console-title">
    <header class="webhook-console__hero">
      <div class="webhook-console__hero-icon"><q-icon name="mdi-webhook" size="32px" /></div>
      <div class="webhook-console__hero-text">
        <small>CENTRAL DE INTEGRAÇÕES</small>
        <h1 id="webhook-console-title">Webhooks</h1>
        <p>Gerencie os endereços e tokens do seu Desktop e acompanhe as entregas em um só lugar.</p>
      </div>
      <q-btn outline no-caps color="teal-3" icon="mdi-refresh" label="Atualizar" :loading="loading.installations || loading.details" @click="refresh" />
    </header>

    <p v-if="errors.installations" class="webhook-console__error" role="alert">{{ errors.installations }}</p>
    <div v-if="loading.installations && !installations.length" class="webhook-console__empty" role="status">
      <q-spinner color="teal-3" size="28px" /> Carregando licenças Desktop…
    </div>
    <div v-else-if="!installations.length && !errors.installations" class="webhook-console__empty">
      <q-icon name="mdi-monitor-dashboard" size="32px" />
      <div><h2>Vincule seu Desktop para começar</h2><p>Seu endereço de webhook aparece aqui quando uma instalação é vinculada à sua licença.</p></div>
      <q-btn outline no-caps color="teal-3" label="Meus produtos" to="/app?tab=products" />
    </div>

    <template v-if="selection">
      <section class="webhook-console__panel webhook-console__installation" aria-label="Instalação Desktop">
        <q-select v-model="selectedId" :options="options" dark outlined emit-value map-options label="Instalação e licença" color="teal-3" />
        <div class="webhook-console__install-status">
          <span :class="['webhook-console__pill', 'webhook-console__pill--' + status.color]">
            <q-icon :name="status.icon" /> {{ status.label }}
          </span>
          <small>{{ selection.expiresAt ? 'Vencimento · ' + formatDate(selection.expiresAt) : 'Licença sem data de vencimento' }}</small>
        </div>
      </section>

      <p v-if="errors.details" class="webhook-console__error" role="alert">{{ errors.details }}</p>
      <p v-else-if="!selection.active" class="webhook-console__notice">Regularize sua licença em <router-link to="/app?tab=products">Meus produtos</router-link> para habilitar as entregas.</p>
      <p v-else-if="!selectedSlug" class="webhook-console__notice">Abra o Desktop atualizado e ative a licença para registrar o endereço desta instalação.</p>
      <p v-else-if="!connected && !loading.details" class="webhook-console__notice">Abra o Desktop atualizado e mantenha-o conectado para receber eventos e consultar tokens e registros.</p>
      <p v-else-if="connected && detail && !manageable" class="webhook-console__notice">Atualize o Desktop para gerenciar tokens e consultar registros pelo portal.</p>

      <div class="webhook-console__columns">
        <section class="webhook-console__panel">
          <header class="webhook-console__panel-header">
            <q-icon name="mdi-link-variant" size="24px" /><div><h2>Endereço de recebimento</h2><p>Use esta URL HTTPS para configurar a Meta ou sua integração.</p></div>
          </header>
          <div v-if="webhookUrl" class="webhook-console__url">
            <code>{{ webhookUrl }}</code>
            <q-btn flat round color="teal-3" icon="mdi-content-copy" aria-label="Copiar endereço do webhook" @click="copy(webhookUrl, 'Endereço')"><q-tooltip>Copiar endereço</q-tooltip></q-btn>
          </div>
          <div v-else class="webhook-console__placeholder">O endereço fica disponível quando o Desktop registra a instalação.</div>
        </section>

        <section class="webhook-console__panel">
          <header class="webhook-console__panel-header">
            <q-icon name="mdi-key-chain-variant" size="24px" />
            <div><h2>Tokens</h2><p>Crie chaves para a verificação da Meta e integrações externas.</p></div>
            <q-btn unelevated no-caps color="teal-4" text-color="black" icon="mdi-plus" label="Novo token" :disable="!manageable" @click="openTokenDialog" />
          </header>
          <div v-if="loading.details && !detail" class="webhook-console__placeholder" role="status"><q-spinner color="teal-3" /> Consultando instalação…</div>
          <ul v-else-if="manageable && tokens.length" class="webhook-console__tokens">
            <li v-for="token in tokens" :key="token._id">
              <div><strong>{{ token.name }}</strong><small>{{ tokenLabel(token.kind) }} · {{ formatDate(token.createdAt) }}</small></div>
              <q-btn flat round color="red-3" icon="mdi-key-remove" :aria-label="'Revogar ' + token.name" :loading="revoking === token._id" @click="confirmRevocation(token)"><q-tooltip>Revogar token</q-tooltip></q-btn>
            </li>
          </ul>
          <div v-else class="webhook-console__placeholder">{{ manageable ? 'Nenhum token criado nesta instalação.' : 'Conecte uma instalação com licença ativa para gerenciar tokens.' }}</div>
        </section>
      </div>

      <section class="webhook-console__panel webhook-console__activity">
        <header class="webhook-console__panel-header">
          <q-icon name="mdi-chart-timeline-variant" size="24px" />
          <div><h2>Atividade e logs</h2><p>Consulte as entregas recentes e abra um registro para ver os detalhes e o JSON.</p></div>
          <span :class="['webhook-console__pill', 'webhook-console__pill--' + (live && manageable ? 'positive' : 'neutral')]">
            <q-icon :name="live && manageable ? 'mdi-access-point' : 'mdi-clock-outline'" />
            {{ live && manageable ? 'Ao vivo' : 'Atualização periódica' }}
          </span>
        </header>
        <q-tabs v-model="eventKind" align="left" active-color="teal-3" indicator-color="teal-3" no-caps>
          <q-tab v-for="kind in eventKinds" :key="kind.value" :name="kind.value" :label="kind.label" :icon="kind.icon" inline-label />
        </q-tabs>
        <p v-if="errors.events" class="webhook-console__error" role="alert">{{ errors.events }}</p>
        <div v-if="loading.events && !events.length" class="webhook-console__placeholder" role="status"><q-spinner color="teal-3" /> Carregando registros…</div>
        <div v-else-if="!manageable || !events.length" class="webhook-console__placeholder">{{ manageable ? 'Nenhum registro neste painel.' : 'Os registros ficam disponíveis com o Desktop conectado e a licença ativa.' }}</div>
        <ul v-else class="webhook-console__events">
          <li v-for="event in events" :key="event.id">
            <button type="button" class="webhook-console__event" @click="openEvent(event)">
              <div><strong>{{ eventLabel(event) }}</strong><small>{{ event.source || 'Webhook' }}</small></div>
              <span :class="['webhook-console__pill', 'webhook-console__pill--' + eventStatus(event).tone]">{{ eventStatus(event).label }}</span>
              <time :datetime="event.receivedAt || event.createdAt">{{ eventDate(event) }}</time>
              <q-icon name="mdi-chevron-right" size="20px" />
            </button>
          </li>
        </ul>
      </section>
    </template>

    <q-dialog v-model="tokenDialog" :persistent="loading.create" @hide="clearTokenDialog">
      <q-card dark class="webhook-console__dialog">
        <q-card-section>
          <h2>{{ createdToken ? 'Token criado' : 'Criar token de webhook' }}</h2>
          <p v-if="createdToken">Copie e guarde o token agora. Por segurança, esta é a única vez que ele será exibido.</p>
        </q-card-section>
        <q-card-section v-if="createdToken">
          <div class="webhook-console__url"><code>{{ createdToken.token }}</code><q-btn flat round color="teal-3" icon="mdi-content-copy" aria-label="Copiar token" @click="copy(createdToken.token, 'Token')" /></div>
        </q-card-section>
        <q-form v-else @submit.prevent="createToken">
          <q-card-section class="webhook-console__form">
            <q-input v-model="tokenDraft.name" outlined dark autofocus label="Nome do token" maxlength="80" :rules="[value => !!value.trim() || 'Informe um nome.']" />
            <q-select v-model="tokenDraft.kind" :options="tokenKinds" outlined dark emit-value map-options label="Finalidade" />
            <p v-if="tokenDraft.kind === 'verify'">Informe o mesmo token no campo de verificação do webhook da Meta.</p>
            <p v-else>Envie o token no cabeçalho <code>Authorization: Bearer</code> ao chamar este webhook.</p>
            <q-input v-model="tokenDraft.token" outlined dark type="password" label="Token personalizado (opcional)" maxlength="512" autocomplete="off" hint="Deixe em branco para gerar um token seguro." />
            <p v-if="errors.create" class="webhook-console__error" role="alert">{{ errors.create }}</p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps label="Cancelar" :disable="loading.create" />
            <q-btn unelevated no-caps color="teal-4" text-color="black" type="submit" label="Criar token" :loading="loading.create" :disable="!manageable" />
          </q-card-actions>
        </q-form>
        <q-card-actions v-if="createdToken" align="right"><q-btn v-close-popup flat no-caps label="Concluir" color="teal-3" /></q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="eventDialog" @hide="clearEventDialog">
      <q-card dark class="webhook-console__dialog webhook-console__dialog--event">
        <q-card-section v-if="openedEvent" class="webhook-console__panel-header">
          <q-icon name="mdi-code-json" size="25px" /><div><h2>{{ eventLabel(openedEvent) }}</h2><p>{{ eventDate(openedEvent) }} · {{ eventStatus(openedEvent).label }}<template v-if="eventSize(openedEvent)"> · {{ eventSize(openedEvent) }}</template></p></div>
          <q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar detalhes" />
        </q-card-section>
        <q-card-section>
          <div v-if="loading.event" role="status"><q-spinner color="teal-3" /> Carregando JSON…</div>
          <p v-else-if="errors.event" class="webhook-console__error" role="alert">{{ errors.event }}</p>
          <template v-else-if="eventJson">
            <p v-if="openedEvent?.truncated">O evento excede o limite de visualização no portal. A prévia está abaixo.</p>
            <pre tabindex="0" aria-label="Conteúdo JSON do evento">{{ eventJson }}</pre>
          </template>
          <p v-else>Este registro contém apenas os dados da entrega.</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.webhook-console { display: grid; gap: 1rem; color: #edfff9; }
.webhook-console p { margin: .35rem 0 0; color: #b2ccc7; line-height: 1.55; }
.webhook-console__hero { display: flex; align-items: center; gap: 1rem; margin-bottom: .35rem; }
.webhook-console__hero-icon { display: grid; flex: 0 0 66px; height: 66px; place-items: center; color: #9affea; border: 1px solid #337369; border-radius: 1.15rem; background: linear-gradient(145deg, #205a50, #12312e); }
.webhook-console__hero-text, .webhook-console__panel-header > div { flex: 1; min-width: 0; }
.webhook-console__hero small { color: #92f5e2; font-weight: 800; font-size: .68rem; letter-spacing: .13em; }
.webhook-console__hero h1 { margin: .1rem 0 0; font-weight: 850; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.1; letter-spacing: -.055em; }
.webhook-console__panel, .webhook-console__empty { padding: 1.1rem; border: 1px solid #27534c; border-radius: .95rem; background: #0b1f1f; }
.webhook-console__empty { display: flex; align-items: center; gap: 1rem; color: #9de9d9; }
.webhook-console__empty > div { flex: 1; }
.webhook-console__installation { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.webhook-console__installation > .q-field { width: min(100%, 25rem); }
.webhook-console__install-status { display: grid; justify-items: end; gap: .35rem; }
.webhook-console__install-status small, .webhook-console__tokens small, .webhook-console__event small { display: block; color: #a7c3bd; }
.webhook-console__columns { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 1rem; }
.webhook-console__panel-header { display: flex; align-items: flex-start; gap: .75rem; }
.webhook-console__panel-header > .q-icon { color: #8df4dc; margin-top: .14rem; }
.webhook-console h2, .webhook-console__dialog h2 { margin: 0; font-size: 1.12rem; font-weight: 750; line-height: 1.35; }
.webhook-console__pill { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .55rem; border-radius: 2rem; white-space: nowrap; font-size: .73rem; font-weight: 700; }
.webhook-console__pill--positive { background: #12483a; color: #9ff9db; }
.webhook-console__pill--warning { background: #4e341b; color: #ffdca3; }
.webhook-console__pill--neutral { background: #233738; color: #cbdfd9; }
.webhook-console__url, .webhook-console__placeholder { display: flex; align-items: center; gap: .55rem; margin-top: .9rem; padding: .75rem; border-radius: .65rem; background: #071615; color: #c2e2dc; }
.webhook-console__url code { flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: all; }
.webhook-console__placeholder { min-height: 3rem; color: #a8c3bd; }
.webhook-console__tokens, .webhook-console__events { padding: 0; margin: .85rem 0 0; list-style: none; }
.webhook-console__tokens li { display: flex; align-items: center; justify-content: space-between; gap: .6rem; padding: .5rem .1rem; border-top: 1px solid #244741; overflow-wrap: anywhere; }
.webhook-console__activity .q-tabs { margin-top: .85rem; border-bottom: 1px solid #244741; }
.webhook-console__event { display: grid; grid-template-columns: minmax(0, 1fr) max-content max-content auto; align-items: center; gap: .75rem; width: 100%; min-width: 0; text-align: left; padding: .7rem .55rem; border: 0; border-bottom: 1px solid #244741; border-radius: .35rem; background: transparent; color: #edfff9; font: inherit; cursor: pointer; }
.webhook-console__event:hover, .webhook-console__event:focus-visible { background: #163733; }
.webhook-console__event > div { min-width: 0; overflow-wrap: anywhere; }
.webhook-console__event time { color: #b4cdc7; font-size: .8rem; font-variant-numeric: tabular-nums; }
.webhook-console p.webhook-console__error, .webhook-console__dialog p.webhook-console__error { margin: 0; padding: .7rem .8rem; border-radius: .55rem; background: #472c27; color: #ffd0c5; }
.webhook-console p.webhook-console__notice { margin: 0; padding: .7rem .8rem; border-left: 3px solid #5b9e91; background: #102928; color: #d3ece7; }
.webhook-console__notice a { color: #8df4dc; }
.webhook-console__dialog { width: min(34rem, 94vw); max-width: 100%; background: #102826; color: #edfff9; }
.webhook-console__dialog--event { width: min(46rem, 94vw); }
.webhook-console__dialog p { color: #bfd7d1; margin: .4rem 0 0; }
.webhook-console__dialog pre { max-height: 52vh; overflow: auto; margin: 0; padding: .9rem; border-radius: .55rem; background: #081715; color: #cef6ea; white-space: pre-wrap; overflow-wrap: anywhere; }
.webhook-console__form { display: grid; gap: .7rem; padding-top: 0; }
.webhook-console__form p { margin: 0; }
@media (max-width: 760px) {
  .webhook-console__columns { grid-template-columns: minmax(0, 1fr); }
  .webhook-console__hero, .webhook-console__empty { flex-wrap: wrap; }
  .webhook-console__hero-text { flex-basis: calc(100% - 6rem); }
  .webhook-console__panel { padding: .85rem; }
}
@media (max-width: 460px) {
  .webhook-console__installation { align-items: stretch; flex-direction: column; }
  .webhook-console__install-status { justify-items: start; }
  .webhook-console__panel-header { flex-wrap: wrap; }
  .webhook-console__panel-header > div { flex-basis: calc(100% - 3rem); }
  .webhook-console__event { grid-template-columns: minmax(0, 1fr) max-content auto; gap: .35rem .55rem; }
  .webhook-console__event time { grid-row: 2; grid-column: 1 / 3; }
  .webhook-console__event > .q-icon { grid-column: 3; grid-row: 1 / 3; }
}
</style>
