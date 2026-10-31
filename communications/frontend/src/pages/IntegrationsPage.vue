<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import PageHeader from '../components/PageHeader.vue'
import CommerceIntegrationCard from '../components/CommerceIntegrationCard.vue'
import { canArea } from '../services/access.js'
import { getStoredUser } from '../services/tokens.js'
import { vCanAction } from '../services/permission-directives.js'
import CompactPagination from '../components/CompactPagination.vue'
import { errorMessage, fetchAll } from '../services/http.js'
import {
  INTEGRATION_SCOPES,
  createIntegrationApp,
  createIntegrationToken,
  getIntegrationApp,
  getIntegrationAppActivityDetail,
  integrationQueueLabel,
  integrationStatusColor,
  listIntegrationAppActivity,
  listIntegrationApps,
  removeIntegrationApp,
  revokeIntegrationToken,
  updateIntegrationApp,
} from '../services/integrations.js'

const $q = useQuasar()
const loading = ref(true)
const saving = ref(false)
const search = ref('')
const apps = ref([])
const templates = ref([])
const appDialog = ref(false)
const tokenDialog = ref(false)
const tokenRevealDialog = ref(false)
const activityDialog = ref(false)
const activityDetailDialog = ref(false)
const activityLoading = ref(false)
const activityDetailLoading = ref(false)
const editingId = ref(null)
const selectedApp = ref(null)
const activityApp = ref(null)
const activityItems = ref([])
const activityOverview = ref({})
const activityDetail = ref(null)
const revealedToken = ref('')
const pagination = reactive({ page: 1, rowsPerPage: 20, rowsNumber: 0 })
const activityPagination = reactive({ page: 1, rowsPerPage: 12, rowsNumber: 0 })
const activityFilters = reactive({ search: '', type: null, status: null, channel: null })
const form = reactive({
  name: '',
  description: '',
  emailAuthName: '',
  active: true,
  scopes: INTEGRATION_SCOPES.filter((scope) => scope.value !== 'auth:email').map((scope) => scope.value),
  allowedTemplateIds: [],
})
const tokenForm = reactive({ name: 'Token principal', scopes: [], expiresAt: '' })

const templateOptions = computed(() => templates.value.map((template) => ({
  label: `${template.name} · ${template.channel === 'email' ? 'Gmail' : 'WhatsApp'}`,
  value: template.id || template._id,
  channel: template.channel,
})))
const pageCount = computed(() => Math.max(1, Math.ceil(pagination.rowsNumber / pagination.rowsPerPage)))
const activityPageCount = computed(() => Math.max(
  1,
  Math.ceil(activityPagination.rowsNumber / activityPagination.rowsPerPage),
))
const activityTypeOptions = [
  { label: 'Notificações', value: 'notification' },
  { label: 'Agendamentos', value: 'schedule' },
]
const activityStatusOptions = [
  'queued',
  'processing',
  'sent',
  'partial',
  'failed',
  'scheduled',
  'completed',
  'cancelled',
].map((value) => ({ label: value, value }))
const activityChannelOptions = [
  { label: 'Gmail', value: 'email' },
  { label: 'WhatsApp', value: 'whatsapp_cloud' },
]

function resetForm(app = null) {
  editingId.value = app?.id || app?._id || null
  Object.assign(form, {
    name: app?.name || '',
    description: app?.description || '',
    emailAuthName: app?.emailAuthName || '',
    active: app?.active !== false,
    scopes: app?.scopes?.length ? [...app.scopes] : INTEGRATION_SCOPES.filter((scope) => scope.value !== 'auth:email').map((scope) => scope.value),
    allowedTemplateIds: (app?.allowedTemplates || []).map((template) => template.id || template._id),
  })
}

async function loadTemplates() {
  if (!canArea(getStoredUser(), 'templates')) return
  const [email, whatsapp] = await Promise.all([
    fetchAll('/templates', { params: { channel: 'email', active: true }, preferredKey: 'templates' }),
    fetchAll('/templates', { params: { channel: 'whatsapp_cloud', active: true }, preferredKey: 'templates' }),
  ])
  templates.value = [...email, ...whatsapp]
}

async function loadApps(reset = false) {
  if (reset) pagination.page = 1
  loading.value = true
  try {
    const result = await listIntegrationApps({
      page: pagination.page,
      limit: pagination.rowsPerPage,
      search: search.value.trim() || undefined,
    })
    apps.value = result.items
    pagination.rowsNumber = result.pagination.rowsNumber
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível carregar os apps.') })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (getStoredUser()?.role === 'collaborator') return
  resetForm()
  appDialog.value = true
}

function openEdit(app) {
  if (getStoredUser()?.role === 'collaborator') return
  resetForm(app)
  appDialog.value = true
}

async function saveApp() {
  if (getStoredUser()?.role === 'collaborator') return
  saving.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description || null,
      emailAuthName: form.emailAuthName || null,
      active: form.active,
      scopes: form.scopes,
      allowedTemplateIds: form.allowedTemplateIds,
    }
    if (editingId.value) await updateIntegrationApp(editingId.value, payload)
    else await createIntegrationApp(payload)
    appDialog.value = false
    $q.notify({ type: 'positive', message: editingId.value ? 'App atualizado.' : 'App criado.' })
    await loadApps()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível salvar o app.') })
  } finally {
    saving.value = false
  }
}

async function openTokens(app) {
  if (getStoredUser()?.role === 'collaborator') return
  try {
    selectedApp.value = await getIntegrationApp(app.id || app._id)
    tokenForm.name = 'Token principal'
    tokenForm.scopes = [...(selectedApp.value.scopes || [])]
    tokenForm.expiresAt = ''
    tokenDialog.value = true
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível abrir os tokens.') })
  }
}

async function issueToken() {
  if (getStoredUser()?.role === 'collaborator') return
  saving.value = true
  try {
    const created = await createIntegrationToken(selectedApp.value.id, {
      name: tokenForm.name,
      scopes: tokenForm.scopes,
      ...(tokenForm.expiresAt ? { expiresAt: new Date(tokenForm.expiresAt).toISOString() } : {}),
    })
    revealedToken.value = created.token
    selectedApp.value = await getIntegrationApp(selectedApp.value.id)
    tokenRevealDialog.value = true
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível gerar o token.') })
  } finally {
    saving.value = false
  }
}

async function copyToken() {
  await copyToClipboard(revealedToken.value)
  $q.notify({ type: 'positive', message: 'Token copiado. Guarde-o em um cofre seguro.' })
}

function closeTokenReveal() {
  revealedToken.value = ''
  tokenRevealDialog.value = false
}

function confirmRevoke(token) {
  if (getStoredUser()?.role === 'collaborator') return
  $q.dialog({
    title: 'Revogar token?',
    message: 'O sistema externo perderá acesso imediatamente. Esta ação não pode ser desfeita.',
    cancel: true,
    persistent: true,
    ok: { label: 'Revogar', color: 'negative' },
  }).onOk(async () => {
    try {
      await revokeIntegrationToken(selectedApp.value.id, token.id)
      selectedApp.value = await getIntegrationApp(selectedApp.value.id)
      $q.notify({ type: 'positive', message: 'Token revogado.' })
    } catch (error) {
      $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível revogar o token.') })
    }
  })
}

function confirmRemove(app) {
  if (getStoredUser()?.role === 'collaborator') return
  $q.dialog({
    title: `Remover ${app.name}?`,
    message: 'O app será desativado, seus tokens serão revogados e agendas futuras serão canceladas. O histórico será preservado.',
    cancel: true,
    persistent: true,
    ok: { label: 'Remover app', color: 'negative' },
  }).onOk(async () => {
    try {
      await removeIntegrationApp(app.id || app._id)
      $q.notify({ type: 'positive', message: 'App removido com segurança.' })
      await loadApps()
    } catch (error) {
      $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível remover o app.') })
    }
  })
}

async function loadActivity(reset = false) {
  if (!activityApp.value) return
  if (reset) activityPagination.page = 1
  activityLoading.value = true
  try {
    const result = await listIntegrationAppActivity(activityApp.value.id || activityApp.value._id, {
      page: activityPagination.page,
      limit: activityPagination.rowsPerPage,
      search: activityFilters.search.trim() || undefined,
      type: activityFilters.type || undefined,
      status: activityFilters.status || undefined,
      channel: activityFilters.channel || undefined,
    })
    activityItems.value = result.items
    activityOverview.value = result.overview
    Object.assign(activityPagination, result.pagination)
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível carregar os webhooks e filas.') })
  } finally {
    activityLoading.value = false
  }
}

async function openActivity(app) {
  activityApp.value = app
  Object.assign(activityFilters, { search: '', type: null, status: null, channel: null })
  activityPagination.page = 1
  activityDialog.value = true
  await loadActivity()
}

async function openActivityDetail(item) {
  activityDetail.value = null
  activityDetailDialog.value = true
  activityDetailLoading.value = true
  try {
    activityDetail.value = await getIntegrationAppActivityDetail(
      activityApp.value.id || activityApp.value._id,
      item.type,
      item.id,
    )
  } catch (error) {
    activityDetailDialog.value = false
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível abrir os detalhes da atividade.') })
  } finally {
    activityDetailLoading.value = false
  }
}

function scopeLabel(scope) {
  return INTEGRATION_SCOPES.find((item) => item.value === scope)?.label || scope
}

function channelIcon(channel) {
  return channel === 'email' ? 'mdi-gmail' : 'mdi-whatsapp'
}

function channelLabel(channel) {
  if (channel === 'email') return 'Gmail'
  if (channel === 'whatsapp_cloud') return 'WhatsApp'
  return channel === 'global' ? 'Gmail + WhatsApp' : channel || 'Canal não informado'
}

function activityTypeLabel(type) {
  return type === 'schedule' ? 'Agendamento' : 'Notificação'
}

function lifecycleIcon(stage) {
  return ({
    queue_entered: 'login',
    queue_exited: 'logout',
    delivery: 'send',
    completed: 'task_alt',
    failed: 'error',
  })[stage] || 'event'
}

function deliveryTotal(summary = {}) {
  return ['queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped']
    .reduce((total, key) => total + Number(summary[key] || 0), 0)
}

function formatDate(value) {
  if (!value) return 'Nunca'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

onMounted(async () => {
  await Promise.allSettled([loadTemplates(), loadApps()])
})
</script>

<template>
  <q-page class="page-container integrations-page">
    <PageHeader
      eyebrow="API externa"
      title="Integrações"
      icon="hub"
      description="Crie apps, limite os templates disponíveis e emita tokens com permissões explícitas. O segredo aparece uma única vez."
    >
      <template #actions>
        <q-btn v-can-action="'integrations.create'" color="primary" unelevated icon="add" label="Novo app" @click="openCreate" />
      </template>
    </PageHeader>
    <CommerceIntegrationCard v-if="getStoredUser()?.role === 'admin'"/>

    <section class="glass-card section-card">
      <div class="toolbar-row integrations-toolbar">
        <q-input
          v-model="search"
          outlined
          dense
          clearable
          debounce="350"
          label="Buscar app"
          class="search-field"
          @update:model-value="loadApps(true)"
          @keyup.enter="loadApps(true)"
          @clear="loadApps(true)"
        >
          <template #append><q-icon name="search" /></template>
        </q-input>
        <q-btn flat color="primary" icon="refresh" label="Atualizar" :loading="loading" @click="loadApps(true)" />
      </div>

      <q-inner-loading :showing="loading" />
      <div v-if="!loading && !apps.length" class="empty-apps">
        <q-icon name="extension_off" size="44px" color="grey-5" />
        <strong>Nenhum app encontrado</strong>
        <span>Crie a primeira integração e escolha exatamente quais templates ela poderá usar.</span>
      </div>
      <div v-else class="app-grid">
        <article v-for="app in apps" :key="app.id" class="integration-card">
          <div class="integration-card__header">
            <q-avatar color="primary" text-color="white" icon="apps" />
            <div class="integration-card__title">
              <div class="row items-center q-gutter-sm">
                <strong>{{ app.name }}</strong>
                <q-badge :color="app.active ? 'positive' : 'grey-6'" rounded>
                  {{ app.active ? 'Ativo' : 'Inativo' }}
                </q-badge>
              </div>
              <code>{{ app.publicId }}</code>
            </div>
            <q-btn flat round dense icon="more_vert">
              <q-menu>
                <q-list style="min-width: 180px">
                  <q-item v-if="getStoredUser()?.role !== 'collaborator'" clickable v-close-popup @click="openEdit(app)"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>Editar</q-item-section></q-item>
                  <q-item v-if="getStoredUser()?.role !== 'collaborator'" clickable v-close-popup @click="openTokens(app)"><q-item-section avatar><q-icon name="key" /></q-item-section><q-item-section>Tokens</q-item-section></q-item>
                  <q-item clickable v-close-popup @click="openActivity(app)"><q-item-section avatar><q-icon name="webhook" /></q-item-section><q-item-section>Webhooks e filas</q-item-section></q-item>
                  <q-separator />
                  <q-item v-if="getStoredUser()?.role !== 'collaborator'" clickable v-close-popup class="text-negative" @click="confirmRemove(app)"><q-item-section avatar><q-icon name="delete" /></q-item-section><q-item-section>Remover</q-item-section></q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <p>{{ app.description || 'Sem descrição.' }}</p>
          <div class="chip-row">
            <q-chip v-for="scope in app.scopes" :key="scope" dense icon="verified_user" color="teal-1" text-color="teal-9">
              {{ scopeLabel(scope) }}
            </q-chip>
          </div>
          <div class="template-list">
            <span class="template-list__label">Templates permitidos</span>
            <div v-if="app.allowedTemplates?.length" class="chip-row">
              <q-chip v-for="template in app.allowedTemplates" :key="template.id" dense outline color="primary" :icon="channelIcon(template.channel)">
                {{ template.name || 'Template removido' }}
              </q-chip>
            </div>
            <span v-else class="text-caption" :class="app.scopes?.every(scope => scope === 'auth:email') ? 'text-grey-7' : 'text-negative'">{{ app.scopes?.every(scope => scope === 'auth:email') ? 'Autenticação por e-mail dispensa template de campanha.' : 'Nenhum template permitido' }}</span>
          </div>
          <div v-if="app.scopes?.includes('auth:email')" class="email-auth-note"><q-icon name="mark_email_read"/><span>Códigos de acesso pelo Gmail configurado. Nome no e-mail: <strong>{{ app.emailAuthName || 'marca atual do painel' }}</strong>.</span></div>
          <div class="integration-card__footer">
            <span>Último uso: {{ formatDate(app.lastUsedAt) }}</span>
            <div>
              <q-btn flat dense color="primary" icon="webhook" label="Webhooks" @click="openActivity(app)" />
              <q-btn v-can-action="'integrations.configure'" flat dense color="primary" icon="key" label="Tokens" @click="openTokens(app)" />
              <q-btn v-can-action="'integrations.edit'" flat dense color="primary" icon="edit" label="Editar" @click="openEdit(app)" />
            </div>
          </div>
        </article>
      </div>

      <div v-if="pageCount > 1" class="row justify-center q-mt-lg">
        <CompactPagination v-model="pagination.page" :max="pageCount" aria-label="Páginas de integrações" @update:model-value="loadApps()" />
      </div>
    </section>

    <q-dialog v-model="appDialog" persistent>
      <q-card class="dialog-card dialog-card--medium">
        <q-card-section class="row items-center">
          <div>
            <div class="text-h6">{{ editingId ? 'Editar app' : 'Novo app' }}</div>
            <div class="text-caption text-grey-7">O app só poderá usar os templates e escopos selecionados.</div>
          </div>
          <q-space />
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>
        <q-separator />
        <q-form @submit.prevent="saveApp">
          <q-card-section class="dialog-scroll-body">
            <div class="form-grid">
              <q-input v-model="form.name" outlined label="Nome do app *" maxlength="160" :rules="[(v) => !!v || 'Informe o nome']" />
              <q-toggle v-model="form.active" label="App ativo" color="positive" />
              <q-input v-model="form.description" outlined type="textarea" autogrow label="Descrição" maxlength="2000" class="full-span" />
              <q-select
                v-model="form.scopes"
                outlined
                multiple
                emit-value
                map-options
                use-chips
                :options="INTEGRATION_SCOPES"
                label="Permissões *"
                class="full-span"
                :rules="[(v) => v?.length > 0 || 'Selecione ao menos uma permissão']"
              />
              <q-select
                v-model="form.allowedTemplateIds"
                outlined
                multiple
                emit-value
                map-options
                use-chips
                use-input
                input-debounce="0"
                :options="templateOptions"
                label="Templates permitidos"
                hint="Dispensáveis somente para apps com a permissão Validar acesso por e-mail."
                class="full-span"
                :rules="[(v) => v?.length > 0 || form.scopes.every(scope => scope === 'auth:email') || 'Selecione ao menos um template']"
              />
              <q-input v-if="form.scopes.includes('auth:email')" v-model="form.emailAuthName" outlined label="Nome do app nos e-mails de login" maxlength="120" hint="Opcional. Ex.: AitoSoftwares. O endereço remetente continua sendo o Gmail configurado neste painel." class="full-span"/>
              <q-banner v-if="form.scopes.includes('auth:email')" rounded class="bg-teal-1 text-teal-10 full-span">
                <template #avatar><q-icon name="verified_user"/></template>
                Seu servidor solicita o código em <code>/comunicacao/api/integrations/v1/auth/email/challenges</code>, verifica em <code>/verify</code> e confirma a identidade em <code>/introspect</code>. O código expira em 5 minutos e só funciona uma vez. Este acesso identifica o usuário do seu app e não libera o administrador daqui. Guarde o token de integração apenas no servidor externo.
              </q-banner>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Cancelar" />
            <q-btn v-can-action="'integrations.edit'" type="submit" color="primary" unelevated label="Salvar app" :loading="saving" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <q-dialog v-model="tokenDialog" persistent>
      <q-card class="dialog-card dialog-card--medium">
        <q-card-section class="row items-center">
          <div>
            <div class="text-h6">Tokens · {{ selectedApp?.name }}</div>
            <div class="text-caption text-grey-7">Revogue tokens que não são mais usados e rotacione segredos periodicamente.</div>
          </div>
          <q-space />
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>
        <q-separator />
        <q-card-section class="dialog-scroll-body">
          <div class="token-create glass-card">
            <strong>Gerar novo token</strong>
            <div class="form-grid q-mt-md">
              <q-input v-model="tokenForm.name" outlined dense label="Identificação *" />
              <q-input v-model="tokenForm.expiresAt" outlined dense type="datetime-local" stack-label label="Expira em (opcional)" />
              <q-select v-model="tokenForm.scopes" outlined dense multiple use-chips emit-value map-options :options="INTEGRATION_SCOPES" label="Permissões" class="full-span" />
            </div>
            <q-btn v-can-action="'integrations.configure'" class="q-mt-md" color="primary" unelevated icon="key" label="Gerar token" :loading="saving" @click="issueToken" />
          </div>
          <q-list bordered separator class="rounded-borders q-mt-lg">
            <q-item v-for="token in selectedApp?.tokens || []" :key="token.id">
              <q-item-section avatar><q-icon :name="token.active ? 'key' : 'key_off'" :color="token.active ? 'primary' : 'grey-6'" /></q-item-section>
              <q-item-section>
                <q-item-label>{{ token.name }}</q-item-label>
                <q-item-label caption>{{ token.prefix }} · último uso {{ formatDate(token.lastUsedAt) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn v-can-action="'integrations.configure'" v-if="token.active" flat dense color="negative" icon="block" label="Revogar" @click="confirmRevoke(token)" />
                <q-badge v-else color="grey-6">Revogado</q-badge>
              </q-item-section>
            </q-item>
            <q-item v-if="!selectedApp?.tokens?.length"><q-item-section class="text-grey-7">Nenhum token emitido.</q-item-section></q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="activityDialog" :maximized="$q.screen.lt.md">
      <q-card class="activity-dialog-card">
        <q-card-section class="row items-center activity-dialog-card__header">
          <div class="col">
            <div class="text-h6">Webhooks e atividade · {{ activityApp?.name }}</div>
            <div class="text-caption text-grey-7">
              Ciclo isolado deste app: entrada e saída da fila, processamento e entregas.
            </div>
          </div>
          <q-btn flat round icon="refresh" aria-label="Atualizar atividade" :loading="activityLoading" @click="loadActivity" />
          <q-btn v-close-popup flat round icon="close" aria-label="Fechar atividade" />
        </q-card-section>
        <q-separator />

        <q-card-section class="activity-dialog-card__body">
          <div class="activity-overview-grid">
            <div class="activity-overview-card">
              <q-icon name="pending_actions" color="primary" />
              <span>Na fila</span>
              <strong>{{ Number(activityOverview.queues?.[0]?.waiting || 0) }}</strong>
            </div>
            <div class="activity-overview-card">
              <q-icon name="sync" color="warning" />
              <span>Processando</span>
              <strong>{{ Number(activityOverview.queues?.[0]?.active || 0) }}</strong>
            </div>
            <div class="activity-overview-card">
              <q-icon name="schedule" color="info" />
              <span>Programados</span>
              <strong>{{ Number(activityOverview.queues?.[0]?.delayed || 0) }}</strong>
            </div>
            <div class="activity-overview-card">
              <q-icon name="task_alt" color="positive" />
              <span>Entregues</span>
              <strong>{{ Number(activityOverview.deliveries?.delivered || 0) }}</strong>
            </div>
            <div class="activity-overview-card">
              <q-icon name="error_outline" color="negative" />
              <span>Falhas</span>
              <strong>{{ Number(activityOverview.deliveries?.failed || 0) }}</strong>
            </div>
          </div>

          <div class="activity-filters q-mt-lg">
            <q-input
              v-model="activityFilters.search"
              outlined
              dense
              clearable
              debounce="350"
              label="Buscar template, tenant ou entidade"
              @update:model-value="loadActivity(true)"
              @keyup.enter="loadActivity(true)"
              @clear="loadActivity(true)"
            >
              <template #append><q-icon name="search" /></template>
            </q-input>
            <q-select v-model="activityFilters.type" outlined dense clearable emit-value map-options :options="activityTypeOptions" label="Tipo" @update:model-value="loadActivity(true)" />
            <q-select v-model="activityFilters.status" outlined dense clearable emit-value map-options :options="activityStatusOptions" label="Status" @update:model-value="loadActivity(true)" />
            <q-select v-model="activityFilters.channel" outlined dense clearable emit-value map-options :options="activityChannelOptions" label="Canal" @update:model-value="loadActivity(true)" />
          </div>

          <q-inner-loading :showing="activityLoading" />
          <div v-if="!activityLoading && !activityItems.length" class="empty-apps activity-empty">
            <q-icon name="webhook" size="42px" color="grey-5" />
            <strong>Nenhuma atividade encontrada</strong>
            <span>Os eventos aparecerão quando este app agendar ou disparar notificações.</span>
          </div>
          <div v-else class="activity-list q-mt-lg">
            <article v-for="item in activityItems" :key="`${item.type}:${item.id}`" class="activity-item">
              <div class="activity-item__icon">
                <q-icon :name="item.type === 'schedule' ? 'event_repeat' : 'notifications_active'" size="24px" color="primary" />
              </div>
              <div class="activity-item__content">
                <div class="row items-center q-gutter-sm">
                  <strong>{{ item.title || item.templateName || activityTypeLabel(item.type) }}</strong>
                  <q-badge :color="integrationStatusColor(item.status)">{{ item.status }}</q-badge>
                  <q-badge outline color="primary">{{ activityTypeLabel(item.type) }}</q-badge>
                </div>
                <div class="activity-item__meta">
                  <span><q-icon :name="channelIcon(item.channel)" /> {{ channelLabel(item.channel) }}</span>
                  <span><q-icon name="schedule" /> {{ formatDate(item.createdAt) }}</span>
                  <span><q-icon name="route" /> {{ integrationQueueLabel(item.queue?.phase) }}</span>
                  <span v-if="item.type === 'notification'"><q-icon name="send" /> {{ deliveryTotal(item.summary) }} entrega(s)</span>
                  <span v-else><q-icon name="repeat" /> {{ item.runCount || 0 }} execução(ões)</span>
                </div>
                <div v-if="item.metadata?.tenantId || item.metadata?.entityId" class="text-caption text-grey-7 q-mt-xs">
                  Tenant: {{ item.metadata?.tenantId || '—' }} · Entidade: {{ item.metadata?.entityType || '—' }}/{{ item.metadata?.entityId || '—' }}
                </div>
                <div v-if="item.error" class="text-caption text-negative q-mt-xs">{{ item.error }}</div>
              </div>
              <q-btn flat color="primary" icon-right="chevron_right" label="Detalhes" @click="openActivityDetail(item)" />
            </article>
          </div>

          <div v-if="activityPageCount > 1" class="row justify-center q-mt-lg">
            <CompactPagination v-model="activityPagination.page" :max="activityPageCount" aria-label="Páginas de atividade da integração" @update:model-value="loadActivity()" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="activityDetailDialog" :maximized="$q.screen.lt.sm">
      <q-card class="activity-detail-card">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">Detalhes da atividade</div>
            <div class="text-caption text-grey-7">Somente dados vinculados a {{ activityApp?.name }}.</div>
          </div>
          <q-btn v-close-popup flat round icon="close" aria-label="Fechar detalhes" />
        </q-card-section>
        <q-separator />
        <q-card-section class="activity-detail-card__body">
          <q-inner-loading :showing="activityDetailLoading" />
          <template v-if="activityDetail">
            <div class="activity-detail-heading">
              <div>
                <div class="text-h6">{{ activityDetail.title || activityDetail.templateName }}</div>
                <div class="text-caption text-grey-7">{{ activityTypeLabel(activityDetail.type) }} · {{ channelLabel(activityDetail.channel) }} · criado em {{ formatDate(activityDetail.createdAt) }}</div>
              </div>
              <q-badge :color="integrationStatusColor(activityDetail.status)">{{ activityDetail.status }}</q-badge>
            </div>

            <section v-if="activityDetail.deliveries?.length" class="q-mt-lg">
              <div class="text-subtitle1 text-weight-bold">Entregas</div>
              <q-list bordered separator class="rounded-borders q-mt-sm">
                <q-item v-for="delivery in activityDetail.deliveries" :key="delivery.id">
                  <q-item-section avatar><q-icon :name="channelIcon(delivery.channel)" :color="integrationStatusColor(delivery.status)" /></q-item-section>
                  <q-item-section>
                    <q-item-label>{{ delivery.recipient?.displayName || delivery.integrationRecipientId }}</q-item-label>
                    <q-item-label caption>
                      {{ delivery.recipient?.emailMasked || delivery.recipient?.phoneMasked || 'Destino protegido' }} · {{ delivery.attempts }} tentativa(s)
                    </q-item-label>
                    <q-item-label v-if="delivery.errorMessage" caption class="text-negative">{{ delivery.errorCode }} · {{ delivery.errorMessage }}</q-item-label>
                  </q-item-section>
                  <q-item-section side><q-badge :color="integrationStatusColor(delivery.status)">{{ delivery.status }}</q-badge></q-item-section>
                </q-item>
              </q-list>
            </section>

            <section v-if="activityDetail.notifications?.length" class="q-mt-lg">
              <div class="text-subtitle1 text-weight-bold">Execuções geradas</div>
              <q-list bordered separator class="rounded-borders q-mt-sm">
                <q-item v-for="notification in activityDetail.notifications" :key="notification.id" clickable @click="openActivityDetail(notification)">
                  <q-item-section avatar><q-icon name="notifications" color="primary" /></q-item-section>
                  <q-item-section>
                    <q-item-label>{{ notification.title || notification.templateName }}</q-item-label>
                    <q-item-label caption>{{ formatDate(notification.createdAt) }} · {{ integrationQueueLabel(notification.queue?.phase) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side><q-badge :color="integrationStatusColor(notification.status)">{{ notification.status }}</q-badge></q-item-section>
                </q-item>
              </q-list>
            </section>

            <section class="q-mt-lg">
              <div class="text-subtitle1 text-weight-bold">Linha do tempo da fila e entregas</div>
              <q-timeline color="primary" layout="dense" class="q-mt-md">
                <q-timeline-entry
                  v-for="event in activityDetail.timeline || []"
                  :key="event.id"
                  :icon="lifecycleIcon(event.stage)"
                  :color="event.level === 'error' ? 'negative' : event.level === 'warn' ? 'warning' : 'primary'"
                  :title="event.message"
                  :subtitle="`${formatDate(event.createdAt)} · ${event.action}`"
                >
                  <div v-if="event.context?.errorCode || event.context?.status" class="text-caption">
                    {{ event.context?.status || event.context?.errorCode }}
                  </div>
                </q-timeline-entry>
              </q-timeline>
              <div v-if="!activityDetail.timeline?.length" class="text-caption text-grey-7">
                Nenhum evento operacional retido para esta atividade.
              </div>
            </section>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog :model-value="tokenRevealDialog" persistent>
      <q-card class="dialog-card dialog-card--compact">
        <q-card-section>
          <div class="row items-center q-gutter-sm"><q-icon name="security" color="warning" size="28px" /><div class="text-h6">Copie o token agora</div></div>
          <p class="text-grey-8">Por segurança, o Notify Flow não mostrará este segredo novamente.</p>
          <q-input :model-value="revealedToken" outlined readonly type="textarea" autogrow class="token-secret">
            <template #append><q-btn flat round icon="content_copy" @click="copyToken" /></template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn color="primary" unelevated label="Já guardei o token" @click="closeTokenReveal" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.email-auth-note { display:flex; gap:8px; align-items:flex-start; padding:12px; border-radius:10px; background:color-mix(in srgb,var(--q-primary) 7%,white); font-size:12px; line-height:1.6; margin:15px 0; }
.email-auth-note .q-icon { flex:none; font-size:20px; color:var(--q-primary); }
.form-grid code { overflow-wrap:anywhere; font-size:11px; }
.integrations-toolbar .search-field { width: min(420px, 100%); }
.app-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 18px; }
.integration-card { display: flex; flex-direction: column; min-width: 0; padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-strong); }
.integration-card__header { display: flex; align-items: flex-start; gap: 12px; }
.integration-card__title { min-width: 0; flex: 1; }
.integration-card__title strong { font-size: 1.05rem; }
.integration-card__title code { display: block; margin-top: 4px; overflow: hidden; color: var(--muted); font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.integration-card > p { min-height: 44px; margin: 16px 0 12px; color: var(--muted); line-height: 1.45; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.template-list { margin-top: 16px; }
.template-list__label { display: block; margin-bottom: 8px; color: var(--muted); font-size: .76rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.integration-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 18px; color: var(--muted); font-size: .78rem; }
.empty-apps { display: grid; justify-items: center; gap: 8px; padding: 56px 20px; text-align: center; color: var(--muted); }
.token-create { padding: 18px; box-shadow: none; }
.token-secret :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
.activity-dialog-card { display: flex; flex-direction: column; width: min(1180px, calc(100vw - 32px)); max-width: 1180px !important; max-height: calc(100dvh - 32px); }
.activity-dialog-card__header { flex: 0 0 auto; gap: 4px; }
.activity-dialog-card__body, .activity-detail-card__body { position: relative; min-height: 220px; overflow-y: auto; }
.activity-overview-grid { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 10px; }
.activity-overview-card { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 10px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-strong); }
.activity-overview-card .q-icon { grid-row: span 2; }
.activity-overview-card span { color: var(--muted); font-size: .76rem; }
.activity-overview-card strong { font-size: 1.25rem; }
.activity-filters { display: grid; grid-template-columns: minmax(250px, 2fr) repeat(3, minmax(140px, 1fr)); gap: 10px; }
.activity-list { display: grid; gap: 10px; }
.activity-item { display: flex; align-items: center; gap: 14px; min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-strong); }
.activity-item__icon { display: grid; flex: 0 0 42px; width: 42px; height: 42px; place-items: center; border-radius: 12px; background: color-mix(in srgb, var(--q-primary) 10%, transparent); }
.activity-item__content { flex: 1; min-width: 0; }
.activity-item__meta { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 7px; color: var(--muted); font-size: .78rem; }
.activity-detail-card { display: flex; flex-direction: column; width: min(820px, calc(100vw - 32px)); max-width: 820px !important; max-height: calc(100dvh - 32px); }
.activity-detail-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.activity-empty { padding-block: 36px; }
@media (max-width: 650px) {
  .integrations-toolbar, .integration-card__footer { align-items: stretch; flex-direction: column; }
  .integration-card__footer > div { display: flex; justify-content: flex-end; }
  .form-grid { grid-template-columns: 1fr; }
  .form-grid > .full-span { grid-column: auto; }
  .activity-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .activity-filters { grid-template-columns: 1fr; }
  .activity-item { align-items: flex-start; flex-wrap: wrap; }
  .activity-item__content { min-width: calc(100% - 60px); }
  .activity-item > .q-btn { width: 100%; }
  .activity-dialog-card, .activity-detail-card { width: 100%; max-width: none !important; max-height: 100dvh; }
}
</style>
