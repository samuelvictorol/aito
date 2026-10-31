<script setup>
import { vCanAction } from '../services/permission-directives.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '../components/PageHeader.vue'
import CompactPagination from '../components/CompactPagination.vue'
import { errorMessage, fetchAll } from '../services/http.js'
import { canAction, canChannel } from '../services/access.js'
import { getStoredUser } from '../services/tokens.js'
import { templateSetChannels, templateSetId, templateSetTemplateIds } from '../services/template-sets.js'
import {
  createNotificationSchedule,
  listNotificationSchedules,
  removeNotificationSchedule,
  scheduleStatus,
  updateNotificationSchedule,
} from '../services/notification-schedules.js'

const $q = useQuasar()
const canGlobal = ['whatsapp_web', 'whatsapp_cloud', 'telegram', 'email'].every(channel => canChannel(getStoredUser(), channel))
const loading = ref(true)
const saving = ref(false)
const dialog = ref(false)
const editing = ref(null)
const schedules = ref([])
const contacts = ref([])
const groups = ref([])
const templates = ref([])
const templateSets = ref([])
const search = ref('')
const statusFilter = ref(null)
const sourceFilter = ref(null)
const pagination = reactive({ page: 1, rowsPerPage: 20, rowsNumber: 0 })

const form = reactive({
  name: '',
  kind: 'template',
  templateId: null,
  templateSetId: null,
  contactIds: [],
  groupIds: [],
  variables: {},
  recurrenceType: 'once',
  startsAt: '',
  intervalValue: 5,
  intervalUnit: 'hours',
  endsAt: '',
  maxOccurrences: null,
})

const statusOptions = [
  { label: 'Programado', value: 'scheduled' },
  { label: 'Pausado', value: 'paused' },
  { label: 'Processando', value: 'processing' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Cancelado', value: 'cancelled' },
  { label: 'Falhou', value: 'failed' },
]
const sourceOptions = [
  { label: 'Criado no NotifyFlow', value: 'admin' },
  { label: 'Criado por integração', value: 'integration' },
]
const intervalUnitOptions = [
  { label: 'Minutos', value: 'minutes' },
  { label: 'Horas', value: 'hours' },
]
const builtInVariables = new Set(['displayName', 'email', 'phone', 'telegramUsername'])

const contactOptions = computed(() => contacts.value.map((item) => ({
  label: item.displayName || item.name || item.email || item.phone || 'Contato sem nome',
  value: item.id || item._id,
})))
const groupOptions = computed(() => groups.value.map((item) => ({
  label: item.name || 'Grupo sem nome',
  value: item.id || item._id,
})))
const templateOptions = computed(() => templates.value
  .filter((item) => item.active !== false && ['telegram', 'whatsapp_cloud', 'whatsapp_web', 'email'].includes(item.channel))
  .map((item) => ({
    label: `${item.name || item.title} · ${channelLabel(item.channel)}`,
    value: item.id || item._id,
  })))
const templateSetOptions = computed(() => templateSets.value.map((item) => ({
  label: item.name,
  caption: `${templateSetChannels(item).map(channelLabel).join(', ') || 'Sem canais'}`,
  value: templateSetId(item),
})))
const pageCount = computed(() => Math.max(1, Math.ceil(pagination.rowsNumber / pagination.rowsPerPage)))
const selectedTemplateIds = computed(() => {
  if (form.kind === 'template') return form.templateId ? [form.templateId] : []
  const set = templateSets.value.find((item) => String(templateSetId(item)) === String(form.templateSetId))
  return Object.values(templateSetTemplateIds(set || {})).filter(Boolean)
})
const activeTemplates = computed(() => selectedTemplateIds.value
  .map((id) => templates.value.find((item) => String(item.id || item._id) === String(id)))
  .filter(Boolean))
const activeVariableKeys = computed(() => [...new Set(activeTemplates.value
  .flatMap((template) => Array.isArray(template.variables)
    ? template.variables
    : String(template.variables || '').split(','))
  .map((key) => String(key).trim())
  .filter((key) => key && !builtInVariables.has(key)))])
const selectedRecipientCount = computed(() => form.contactIds.length + form.groupIds.length)

watch(activeVariableKeys, (keys) => {
  form.variables = Object.fromEntries(keys.map((key) => [key, form.variables[key] ?? '']))
}, { deep: true })

watch(() => form.kind, () => {
  if (form.kind === 'template') form.templateSetId = null
  else form.templateId = null
})

function channelLabel(channel) {
  return {
    telegram: 'Telegram',
    whatsapp_cloud: 'WhatsApp Cloud',
    whatsapp_web: 'WhatsApp Web',
    email: 'Gmail',
    global: 'Conjunto',
  }[channel] || channel || '—'
}

function sourceLabel(source) {
  return source === 'integration' ? 'Integração' : 'NotifyFlow'
}

function variableLabel(key) {
  return String(key).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function toLocalInput(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function defaultStart() {
  return toLocalInput(new Date(Date.now() + 60 * 60_000))
}

function recurrenceLabel(schedule) {
  const recurrence = schedule.recurrence || {}
  if (recurrence.type === 'once') return 'Disparo único'
  const minutes = Number(recurrence.everyMinutes || 0)
  const interval = minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60}h`
    : `${minutes}min`
  const limits = [
    recurrence.maxOccurrences ? `${recurrence.maxOccurrences} ocorrência(s)` : '',
    recurrence.endsAt ? `até ${formatDate(recurrence.endsAt)}` : '',
  ].filter(Boolean).join(' · ')
  return `A cada ${interval}${limits ? ` · ${limits}` : ''}`
}

function resetForm() {
  editing.value = null
  Object.assign(form, {
    name: '',
    kind: 'template',
    templateId: null,
    templateSetId: null,
    contactIds: [],
    groupIds: [],
    variables: {},
    recurrenceType: 'once',
    startsAt: defaultStart(),
    intervalValue: 5,
    intervalUnit: 'hours',
    endsAt: '',
    maxOccurrences: null,
  })
}

function openCreate() {
  resetForm()
  dialog.value = true
}

function openEdit(schedule) {
  const recurrence = schedule.recurrence || {}
  const minutes = Number(recurrence.everyMinutes || 300)
  editing.value = schedule
  Object.assign(form, {
    name: schedule.name || '',
    kind: schedule.kind || 'template',
    templateId: schedule.templateId || null,
    templateSetId: schedule.templateSetId || null,
    contactIds: [...(schedule.contactIds || [])],
    groupIds: [...(schedule.groupIds || [])],
    variables: { ...(schedule.variables || {}) },
    recurrenceType: recurrence.type || 'once',
    startsAt: toLocalInput(schedule.nextRunAt || recurrence.startsAt || defaultStart()),
    intervalValue: minutes >= 60 && minutes % 60 === 0 ? minutes / 60 : minutes,
    intervalUnit: minutes >= 60 && minutes % 60 === 0 ? 'hours' : 'minutes',
    endsAt: recurrence.endsAt ? toLocalInput(recurrence.endsAt) : '',
    maxOccurrences: recurrence.maxOccurrences || null,
  })
  dialog.value = true
}

function recurrencePayload() {
  const startsAt = new Date(form.startsAt)
  if (Number.isNaN(startsAt.getTime())) throw new Error('Informe a data e hora inicial.')
  if (form.recurrenceType === 'once') return { type: 'once', at: startsAt.toISOString() }
  const amount = Number(form.intervalValue)
  if (!Number.isInteger(amount) || amount < 1) throw new Error('O intervalo deve ser um número inteiro positivo.')
  const payload = {
    type: 'interval',
    startsAt: startsAt.toISOString(),
    ...(form.intervalUnit === 'hours' ? { everyHours: amount } : { everyMinutes: amount }),
  }
  if (form.endsAt) payload.endsAt = new Date(form.endsAt).toISOString()
  if (form.maxOccurrences) payload.maxOccurrences = Number(form.maxOccurrences)
  return payload
}

function runtimeVariables() {
  return Object.fromEntries(activeVariableKeys.value.map((key) => [key, form.variables[key]]))
}

function validateForm() {
  if (!form.name.trim()) throw new Error('Informe um nome para a programação.')
  if (!editing.value && !selectedRecipientCount.value) throw new Error('Selecione ao menos um contato ou grupo.')
  if (form.kind === 'template' && !form.templateId) throw new Error('Selecione o template.')
  if (form.kind === 'global' && !form.templateSetId) throw new Error('Selecione o conjunto de templates.')
  const missing = activeVariableKeys.value.filter((key) => form.variables[key] === '' || form.variables[key] == null)
  if (missing.length) throw new Error(`Preencha os parâmetros: ${missing.map(variableLabel).join(', ')}.`)
}

async function loadReferences() {
  const [contactItems, groupItems, templateItems, setItems] = await Promise.all([
    fetchAll('/contacts', { params: { active: true }, preferredKey: 'contacts' }),
    fetchAll('/contact-groups', { params: { active: true }, preferredKey: 'groups' }),
    fetchAll('/templates', { params: { active: true }, preferredKey: 'templates' }),
    fetchAll('/template-sets', { preferredKey: 'templateSets' }),
  ])
  contacts.value = contactItems
  groups.value = groupItems
  templates.value = templateItems
  templateSets.value = setItems
}

async function loadSchedules(reset = false) {
  if (reset) pagination.page = 1
  loading.value = true
  try {
    const result = await listNotificationSchedules({
      page: pagination.page,
      limit: pagination.rowsPerPage,
      search: search.value.trim() || undefined,
      status: statusFilter.value || undefined,
      source: sourceFilter.value || undefined,
    })
    schedules.value = result.items
    pagination.rowsNumber = result.pagination.rowsNumber
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível carregar as programações.') })
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canAction(getStoredUser(), 'schedules', 'send') || !canAction(getStoredUser(), 'schedules', editing.value ? 'edit' : 'create')) return
  saving.value = true
  try {
    validateForm()
    const recurrence = recurrencePayload()
    if (editing.value) {
      await updateNotificationSchedule(editing.value.id, {
        name: form.name.trim(),
        variables: runtimeVariables(),
        recurrence,
        ...(editing.value.status === 'failed' ? { status: 'scheduled' } : {}),
      })
    } else {
      await createNotificationSchedule({
        name: form.name.trim(),
        kind: form.kind,
        templateId: form.kind === 'template' ? form.templateId : undefined,
        templateSetId: form.kind === 'global' ? form.templateSetId : undefined,
        variables: runtimeVariables(),
        contactIds: form.contactIds,
        groupIds: form.groupIds,
        recurrence,
      })
    }
    dialog.value = false
    $q.notify({
      type: 'positive',
      message: editing.value ? 'Programação atualizada e reenfileirada.' : 'Programação criada e colocada na fila.',
    })
    await loadSchedules(editing.value == null)
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, error.message || 'Não foi possível salvar a programação.') })
  } finally {
    saving.value = false
  }
}

async function togglePause(schedule) {
  const next = ['paused', 'failed'].includes(schedule.status) ? 'scheduled' : 'paused'
  if (!canAction(getStoredUser(), 'schedules', 'edit') || next === 'scheduled' && !canAction(getStoredUser(), 'schedules', 'send')) return
  try {
    await updateNotificationSchedule(schedule.id, { status: next })
    $q.notify({ type: 'positive', message: next === 'paused' ? 'Programação pausada.' : 'Programação retomada e reenfileirada.' })
    await loadSchedules()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível alterar a programação.') })
  }
}

function confirmRemove(schedule) {
  $q.dialog({
    title: 'Cancelar programação?',
    message: `“${schedule.name}” não fará novos disparos. O histórico já criado será preservado.`,
    cancel: true,
    persistent: true,
    ok: { label: 'Cancelar programação', color: 'negative' },
  }).onOk(async () => {
    try {
      await removeNotificationSchedule(schedule.id)
      $q.notify({ type: 'positive', message: 'Programação cancelada.' })
      await loadSchedules()
    } catch (error) {
      $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível cancelar a programação.') })
    }
  })
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadReferences(), loadSchedules()])
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível preparar a página.') })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <q-page class="page-container schedules-page">
    <PageHeader
      eyebrow="Fila programável"
      title="Programações"
      icon="schedule_send"
      description="Agende um disparo futuro ou repita templates e conjuntos em intervalos como 5 em 5 horas. Cada ocorrência passa pela fila Redis."
    >
      <template #actions>
        <q-btn outline color="primary" no-caps icon="refresh" label="Atualizar" :loading="loading" @click="loadSchedules" />
        <q-btn v-can-action="'schedules.create'" v-if="canAction(getStoredUser(), 'schedules', 'send')" color="primary" unelevated no-caps icon="add_alarm" label="Nova programação" @click="openCreate" />
      </template>
    </PageHeader>

    <section class="glass-card section-card">
      <div class="schedule-toolbar">
        <q-input
          v-model="search"
          outlined
          dense
          clearable
          debounce="350"
          label="Buscar por nome ou template"
          @update:model-value="loadSchedules(true)"
        >
          <template #append><q-icon name="search" /></template>
        </q-input>
        <q-select
          v-model="statusFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          :options="statusOptions"
          label="Status"
          @update:model-value="loadSchedules(true)"
        />
        <q-select
          v-model="sourceFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          :options="sourceOptions"
          label="Origem"
          @update:model-value="loadSchedules(true)"
        />
      </div>

      <q-inner-loading :showing="loading" />
      <div v-if="!loading && !schedules.length" class="empty-schedules">
        <q-icon name="event_busy" size="48px" color="grey-5" />
        <strong>Nenhuma programação encontrada</strong>
        <span>Crie um envio único ou recorrente para contatos e grupos.</span>
        <q-btn v-can-action="'schedules.create'" v-if="canAction(getStoredUser(), 'schedules', 'send')" color="primary" flat no-caps icon="add" label="Criar agora" @click="openCreate" />
      </div>

      <div v-else class="schedule-grid">
        <article v-for="schedule in schedules" :key="schedule.id" class="schedule-card">
          <header>
            <q-avatar :color="scheduleStatus(schedule.status).color" text-color="white" :icon="scheduleStatus(schedule.status).icon" />
            <div class="schedule-title">
              <strong>{{ schedule.name }}</strong>
              <span>{{ schedule.templateName || (schedule.kind === 'global' ? 'Conjunto de templates' : 'Template') }}</span>
            </div>
            <q-badge :color="scheduleStatus(schedule.status).color" rounded>{{ scheduleStatus(schedule.status).label }}</q-badge>
          </header>

          <div class="schedule-meta">
            <div><span>Próximo disparo</span><strong>{{ formatDate(schedule.nextRunAt) }}</strong></div>
            <div><span>Recorrência</span><strong>{{ recurrenceLabel(schedule) }}</strong></div>
            <div><span>Origem e canal</span><strong>{{ sourceLabel(schedule.source) }} · {{ channelLabel(schedule.channel) }}</strong></div>
            <div><span>Execuções</span><strong>{{ schedule.runCount || 0 }}</strong></div>
          </div>

          <q-banner v-if="schedule.enqueuePending || schedule.errorMessage" dense rounded class="queue-warning">
            <template #avatar><q-icon name="warning_amber" color="warning" /></template>
            {{ schedule.errorMessage || 'Aguardando recuperação automática da fila.' }}
          </q-banner>

          <footer>
            <span v-if="schedule.lastRunAt">Último: {{ formatDate(schedule.lastRunAt) }}</span>
            <span v-else>Criado em {{ formatDate(schedule.createdAt) }}</span>
            <div>
              <q-btn v-can-action="'schedules.edit'"
                v-if="['scheduled', 'paused', 'failed'].includes(schedule.status) && (schedule.status === 'scheduled' || canAction(getStoredUser(), 'schedules', 'send'))"
                flat
                dense
                no-caps
                :icon="['paused', 'failed'].includes(schedule.status) ? 'play_arrow' : 'pause'"
                :label="schedule.status === 'failed' ? 'Reenfileirar' : schedule.status === 'paused' ? 'Retomar' : 'Pausar'"
                @click="togglePause(schedule)"
              />
              <q-btn v-can-action="'schedules.edit'"
                v-if="schedule.source === 'admin' && ['scheduled', 'paused', 'failed'].includes(schedule.status) && canAction(getStoredUser(), 'schedules', 'send')"
                flat
                dense
                no-caps
                icon="edit"
                label="Editar"
                @click="openEdit(schedule)"
              />
              <q-btn v-can-action="'schedules.delete'"
                v-if="['scheduled', 'paused', 'failed'].includes(schedule.status)"
                flat
                dense
                round
                color="negative"
                icon="delete_outline"
                aria-label="Cancelar programação"
                @click="confirmRemove(schedule)"
              />
            </div>
          </footer>
        </article>
      </div>

      <div v-if="pageCount > 1" class="row justify-center q-mt-lg">
        <CompactPagination v-model="pagination.page" :max="pageCount" aria-label="Páginas de programações" @update:model-value="loadSchedules()" />
      </div>
    </section>

    <q-dialog v-model="dialog" persistent>
      <q-card class="schedule-dialog">
        <q-card-section class="row items-start no-wrap">
          <div>
            <div class="text-h6">{{ editing ? 'Editar programação' : 'Nova programação' }}</div>
            <div class="text-caption text-grey-7">A fila revalida contatos, canais e templates em cada ocorrência.</div>
          </div>
          <q-space />
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>
        <q-separator />

        <q-form @submit.prevent="save">
          <q-card-section class="dialog-scroll-body schedule-form">
            <q-input v-model="form.name" outlined label="Nome da programação *" maxlength="160" class="full-span" />

            <q-banner v-if="editing" rounded class="full-span edit-note">
              <template #avatar><q-icon name="info" color="primary" /></template>
              Destinatários e templates permanecem os mesmos. Para trocá-los, cancele esta programação e crie outra.
            </q-banner>

            <q-btn-toggle
              v-model="form.kind"
              no-caps
              unelevated
              toggle-color="primary"
              color="grey-2"
              text-color="dark"
              :disable="Boolean(editing)"
              :options="[
                { label: 'Template individual', value: 'template', icon: 'description' },
                { label: 'Conjunto', value: 'global', icon: 'hub' },
              ].filter(item => item.value !== 'global' || canGlobal)"
              class="full-span kind-toggle"
            />

            <q-select
              v-if="form.kind === 'template'"
              v-model="form.templateId"
              outlined
              use-input
              emit-value
              map-options
              :disable="Boolean(editing)"
              :options="templateOptions"
              label="Template *"
              class="full-span"
            />
            <q-select
              v-else
              v-model="form.templateSetId"
              outlined
              use-input
              emit-value
              map-options
              :disable="Boolean(editing)"
              :options="templateSetOptions"
              label="Conjunto de templates *"
              class="full-span"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section><q-item-label>{{ scope.opt.label }}</q-item-label><q-item-label caption>{{ scope.opt.caption }}</q-item-label></q-item-section>
                </q-item>
              </template>
            </q-select>

            <q-select
              v-model="form.contactIds"
              outlined
              multiple
              use-input
              use-chips
              emit-value
              map-options
              :disable="Boolean(editing)"
              :options="contactOptions"
              label="Contatos"
            />
            <q-select
              v-model="form.groupIds"
              outlined
              multiple
              use-input
              use-chips
              emit-value
              map-options
              :disable="Boolean(editing)"
              :options="groupOptions"
              label="Grupos"
            />

            <section v-if="activeVariableKeys.length" class="runtime-fields full-span">
              <header><div><strong>Parâmetros dinâmicos</strong><span>Valores usados em todas as ocorrências.</span></div><q-badge outline color="primary">{{ activeVariableKeys.length }} campo(s)</q-badge></header>
              <div>
                <q-input
                  v-for="key in activeVariableKeys"
                  :key="key"
                  v-model="form.variables[key]"
                  outlined
                  :label="`${variableLabel(key)} *`"
                >
                  <template #prepend><q-icon name="data_object" color="primary" /></template>
                </q-input>
              </div>
            </section>

            <section class="recurrence-card full-span">
              <header><div><strong>Quando disparar</strong><span>Uma vez no futuro ou em um loop controlado.</span></div></header>
              <q-btn-toggle
                v-model="form.recurrenceType"
                no-caps
                unelevated
                toggle-color="primary"
                color="grey-2"
                text-color="dark"
                :options="[
                  { label: 'Uma vez', value: 'once', icon: 'event' },
                  { label: 'Repetir', value: 'interval', icon: 'repeat' },
                ]"
              />
              <div class="recurrence-grid">
                <q-input v-model="form.startsAt" outlined type="datetime-local" stack-label label="Data e hora inicial *" />
                <template v-if="form.recurrenceType === 'interval'">
                  <q-input v-model.number="form.intervalValue" outlined type="number" min="1" step="1" label="Repetir a cada *" />
                  <q-select v-model="form.intervalUnit" outlined emit-value map-options :options="intervalUnitOptions" label="Unidade *" />
                  <q-input v-model="form.endsAt" outlined clearable type="datetime-local" stack-label label="Encerrar em (opcional)" />
                  <q-input v-model.number="form.maxOccurrences" outlined clearable type="number" min="1" step="1" label="Máximo de ocorrências" />
                </template>
              </div>
            </section>
          </q-card-section>

          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <div class="recipient-summary"><q-icon name="groups" /> {{ editing ? 'Destinatários preservados' : `${selectedRecipientCount} seleção(ões) de destino` }}</div>
            <q-space />
            <q-btn v-close-popup flat no-caps label="Cancelar" />
            <q-btn v-can-action="editing ? 'schedules.edit' : 'schedules.create'" v-if="canAction(getStoredUser(), 'schedules', 'send')" type="submit" color="primary" unelevated no-caps icon="schedule_send" :label="editing ? 'Salvar e reenfileirar' : 'Criar programação'" :loading="saving" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.schedule-toolbar { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(170px, .35fr) minmax(190px, .4fr); gap: 12px; margin-bottom: 20px; }
.schedule-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 18px; }
.schedule-card { display: flex; flex-direction: column; min-width: 0; padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-strong); }
.schedule-card > header { display: flex; align-items: flex-start; gap: 12px; }
.schedule-title { min-width: 0; flex: 1; }
.schedule-title strong, .schedule-title span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.schedule-title strong { font-size: 1.05rem; }
.schedule-title span { margin-top: 3px; color: var(--muted); font-size: .8rem; }
.schedule-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
.schedule-meta div { min-width: 0; padding: 11px 12px; border-radius: 13px; background: color-mix(in srgb, var(--surface) 82%, transparent); }
.schedule-meta span, .schedule-meta strong { display: block; }
.schedule-meta span { color: var(--muted); font-size: .72rem; font-weight: 700; text-transform: uppercase; }
.schedule-meta strong { margin-top: 4px; overflow-wrap: anywhere; font-size: .88rem; }
.schedule-card > footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 14px; color: var(--muted); font-size: .78rem; }
.schedule-card > footer > div { display: flex; align-items: center; }
.queue-warning, .edit-note { background: color-mix(in srgb, var(--warning-soft, #fff8df) 85%, transparent); }
.empty-schedules { display: grid; justify-items: center; gap: 8px; padding: 58px 20px; color: var(--muted); text-align: center; }
.schedule-dialog { width: min(880px, calc(100vw - 28px)); max-width: 880px; }
.schedule-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; max-height: min(72vh, 780px); overflow-y: auto; }
.full-span { grid-column: 1 / -1; }
.kind-toggle { justify-self: start; }
.runtime-fields, .recurrence-card { padding: 18px; border: 1px solid var(--line); border-radius: 17px; background: color-mix(in srgb, var(--surface) 86%, transparent); }
.runtime-fields > header, .recurrence-card > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
.runtime-fields header strong, .runtime-fields header span, .recurrence-card header strong, .recurrence-card header span { display: block; }
.runtime-fields header span, .recurrence-card header span { color: var(--muted); font-size: .8rem; }
.runtime-fields > div, .recurrence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.recurrence-grid { margin-top: 16px; }
.recipient-summary { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: .8rem; }
@media (max-width: 760px) {
  .schedule-toolbar, .schedule-form, .runtime-fields > div, .recurrence-grid { grid-template-columns: 1fr; }
  .schedule-card > footer { align-items: stretch; flex-direction: column; }
  .schedule-card > footer > div { flex-wrap: wrap; justify-content: flex-end; }
  .kind-toggle { width: 100%; }
  .kind-toggle :deep(.q-btn) { flex: 1; }
  .recipient-summary { display: none; }
}
@media (max-width: 460px) {
  .schedule-meta { grid-template-columns: 1fr; }
  .schedule-card { padding: 16px; }
  .schedule-card > header { flex-wrap: wrap; }
}
</style>
