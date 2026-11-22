<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import AitoVideoProgress from 'components/AitoVideoProgress.vue'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { canRemoveGeneration, forgetLocalGeneration, generationIdentity, localGenerationActivity } from 'src/services/aitoiaGenerationActivity'
import { confirmStudioRemoval } from 'src/services/aitoiaStudioConfirm'
import { readGeneratedClipForJob } from 'src/services/aitoiaVideoRemote'
import { sameVideoGeneration, videoGenerationActive } from 'src/services/aitoiaVideoJobs'
import { failedVideo, videoRefundNotice, videoReleasePending } from 'src/services/aitoiaVideoRelease'

const props = defineProps({ state: { type: Object, required: true } })
const { accountId, access } = props.state
const open = ref(false)
const remoteJobs = shallowRef([])
const customerQueue = shallowRef(null)
const saturated = ref(false)
const refreshing = ref(false)
const refreshFailed = ref(false)
const time = ref(Date.now())
const preview = shallowRef(null)
const previewing = ref('')
const previewError = ref('')
const removing = ref('')
const removalError = ref('')
const removedIds = shallowRef(new Set())
let pollTimer
let pollRequest
let previewRequest
let removalRequest
let disposed = false

const types = { remake: 'Cena refeita', studio: 'Clipe do estúdio', chat: 'Vídeo no chat' }
const isActive = item => item.active ?? videoGenerationActive(item.status)
const sortTime = item => typeof item.createdAt === 'number' ? item.createdAt : Date.parse(item.createdAt) || 0
const projectsFor = item => Array.isArray(item.associatedProjects) ? item.associatedProjects.filter(project => project?.id) : []
const owned = computed(() => localGenerationActivity.value.filter(item => item.owner === accountId.value))
const jobs = computed(() => {
  const upstream = remoteJobs.value.map(job => ({ title: types[job.source] || 'Vídeo', kind: 'video', ...job }))
  const local = owned.value.filter(job => !upstream.some(item => item.requestId === job.requestId || item.id && item.id === job.id) &&
    time.value - job.createdAt < (job.kind === 'video' && isActive(job) ? 120000 : 24 * 60 * 60_000))
  return [...upstream, ...local].filter(item => !removedIds.value.has(generationIdentity(item)) &&
    !(item.status === 'completed' && Date.parse(item.orphanExpiresAt) <= time.value)).sort((left, right) =>
    Number(isActive(right)) - Number(isActive(left)) || sortTime(right) - sortTime(left)).slice(0, 8)
})
const active = computed(() => jobs.value.some(isActive))
const latest = computed(() => jobs.value[0])
const label = computed(() => active.value ? 'Ver andamento das gerações' : 'Ver gerações')
const statusIcon = computed(() => latest.value?.status === 'completed' ? 'mdi-check-circle-outline' :
  latest.value?.status === 'uncertain' ? 'mdi-clock-alert-outline' : 'mdi-alert-circle-outline')

function timeToExpire(deadline) {
  const expires = Date.parse(deadline)
  if (!Number.isFinite(expires)) return ''
  const remaining = expires - time.value
  if (remaining <= 0) return 'Prazo encerrado'
  if (remaining < 60_000) return 'Expira em menos de 1 min'
  const minutes = Math.floor(remaining / 60_000)
  const hours = Math.floor(minutes / 60)
  const duration = [hours && `${hours} h`, (!hours || minutes % 60) && `${minutes % 60} min`].filter(Boolean)
  return `Expira em ${duration.join(' ')}`
}

function queuePoll(delay) {
  clearTimeout(pollTimer)
  if (disposed || !accountId.value) return
  pollTimer = setTimeout(refresh, delay ?? (document.hidden ? 25000 : active.value || open.value ? 7000 : 15000))
}

async function refresh() {
  if (pollRequest || disposed || !accountId.value) return
  const owner = access()
  if (!owner.current()) return
  const controller = new AbortController()
  pollRequest = controller
  refreshing.value = true
  time.value = Date.now()
  try {
    const { data } = await owner.get('/aitoia/video/generations', { signal: controller.signal })
    if (!controller.signal.aborted && owner.current() && Array.isArray(data?.data?.jobs)) {
      const { jobs: rows, activeGeneration, activeGenerations, queue } = data.data
      const activeRows = activeGenerations || (activeGeneration ? [activeGeneration] : [])
      const next = [...activeRows.filter(job => !rows.some(item => sameVideoGeneration(item, job))), ...rows]
      if (next.some(job => {
        const previous = remoteJobs.value.find(item => sameVideoGeneration(item, job))
        return previous && ((isActive(previous) && !isActive(job)) ||
          (videoReleasePending(previous) && !videoReleasePending(job)))
      })) void props.state.refreshStatus({ silent: true })
      remoteJobs.value = next
      customerQueue.value = data.data.customerQueue || null
      saturated.value = queue?.saturated === true
      refreshFailed.value = false
    }
  } catch {
    if (!controller.signal.aborted && owner.current()) refreshFailed.value = true
  } finally {
    if (pollRequest === controller) {
      pollRequest = null
      refreshing.value = false
      queuePoll()
    }
  }
}

function clearPreview() {
  previewRequest?.abort()
  previewRequest = null
  previewing.value = ''
  previewError.value = ''
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}

function reset() {
  clearTimeout(pollTimer)
  pollRequest?.abort()
  pollRequest = null
  refreshing.value = false
  removalRequest?.abort()
  removalRequest = null
  removing.value = ''
  removalError.value = ''
  clearPreview()
}

watch(accountId, id => {
  reset()
  open.value = false
  remoteJobs.value = []
  customerQueue.value = null
  saturated.value = false
  removedIds.value = new Set()
  refreshFailed.value = false
  if (id) queuePoll(0)
}, { immediate: true })
watch(owned, () => queuePoll(350))
watch(jobs, rows => {
  const id = preview.value?.id || previewing.value
  if (id && !rows.some(item => item.id === id)) clearPreview()
})
watch(open, visible => {
  if (visible) queuePoll(0)
  else clearPreview()
})
onBeforeUnmount(() => { disposed = true; reset() })

function askRemove(job) {
  if (removing.value || isActive(job) || videoReleasePending(job) || !canRemoveGeneration(job)) return
  const owner = access()
  const ownerId = accountId.value
  const failed = job.status !== 'completed'
  const message = failed ? 'O aviso sairá desta lista. O histórico financeiro será preservado e nenhuma geração será reenviada.' : projectsFor(job).length
    ? 'O clipe original sairá de Gerações. As cópias salvas nos projetos continuam disponíveis.'
    : 'O clipe sairá de Gerações e ficará indisponível para abrir ou baixar.'
  confirmStudioRemoval(failed ? 'Remover aviso de falha?' : 'Remover clipe gerado?', message, () => {
    if (!disposed && owner.current() && accountId.value === ownerId) void removeClip(job, owner, ownerId)
  })
}

async function removeClip(job, owner, ownerId) {
  if (removing.value || isActive(job) || videoReleasePending(job) || !canRemoveGeneration(job)) return
  const key = generationIdentity(job)
  const controller = new AbortController()
  removalRequest = controller
  removing.value = key
  removalError.value = ''
  try {
    if (job.id) await owner.delete(`/aitoia/video/generations/${encodeURIComponent(job.id)}`, { signal: controller.signal })
    if (!controller.signal.aborted && owner.current()) {
      removedIds.value = new Set([...removedIds.value, key])
      remoteJobs.value = remoteJobs.value.filter(item => generationIdentity(item) !== key)
      forgetLocalGeneration(ownerId, job)
      if (job.id && (preview.value?.id === job.id || previewing.value === job.id)) clearPreview()
      queuePoll(350)
    }
  } catch (cause) {
    if (!controller.signal.aborted && owner.current()) {
      removalError.value = cause.response?.data?.message || 'Não foi possível remover esta geração. Tente novamente.'
    }
  } finally {
    if (removalRequest === controller) { removalRequest = null; removing.value = '' }
  }
}

async function openClip(job) {
  if (preview.value?.id === job.id) return
  clearPreview()
  const owner = access()
  const controller = new AbortController()
  previewRequest = controller
  previewing.value = job.id
  try {
    const file = await readGeneratedClipForJob({ id: job.id }, controller.signal, owner.get)
    if (!controller.signal.aborted && owner.current()) {
      preview.value = { id: job.id, file, url: URL.createObjectURL(file) }
    }
  } catch (cause) {
    if (!controller.signal.aborted && owner.current()) {
      previewError.value = cause.response?.status === 404 || cause.response?.status === 410
        ? 'O prazo para prévia deste clipe terminou. Confira a cópia salva no projeto.'
        : 'Não foi possível abrir o clipe agora. Tente novamente.'
    }
  } finally {
    if (previewRequest === controller) { previewRequest = null; previewing.value = '' }
  }
}
</script>

<template>
  <q-btn v-if="accountId" flat dense round class="aito-generation-button"
    :aria-label="label" aria-haspopup="dialog" @click="open = true">
    <q-spinner v-if="active" size="19px" color="teal-3" />
    <q-icon v-else-if="latest" :name="statusIcon" :color="latest.status === 'completed' ? 'teal-3' : 'amber-4'" size="22px" />
    <q-icon v-else name="mdi-progress-clock" size="22px" />
    <q-badge v-if="customerQueue?.active" floating rounded color="teal-8">{{ customerQueue.active }}</q-badge>
    <q-tooltip>{{ label }}</q-tooltip>
  </q-btn>

  <q-dialog v-model="open" aria-labelledby="aito-generation-heading">
    <q-card class="aito-ai-theme aito-generation-dialog">
      <q-card-section class="aito-generation-dialog__header">
        <h2 id="aito-generation-heading">Gerações</h2>
        <span v-if="customerQueue" class="aito-generation-dialog__counter" role="status">{{ customerQueue.active }}/{{ customerQueue.limit }} vídeos ativos</span>
        <q-btn flat dense round icon="mdi-refresh" aria-label="Atualizar gerações" :loading="refreshing" @click="refresh" />
        <q-btn v-close-popup flat dense round icon="mdi-close" aria-label="Fechar gerações" />
      </q-card-section>
      <q-card-section class="aito-generation-dialog__list">
        <div v-if="saturated" class="aito-generation-dialog__demand" role="status">
          <q-icon name="mdi-alert-outline" size="17px" /> A geração pode demorar mais devido à alta demanda de vídeos no AitoIA.
        </div>
        <p v-if="customerQueue && customerQueue.active >= customerQueue.limit" role="status">Aguarde uma vaga na sua fila para enviar outro vídeo.</p>
        <p v-if="refreshFailed" role="status">Falha ao atualizar a fila. Tente novamente.</p>
        <p v-if="removalError" role="alert">{{ removalError }}</p>
        <p v-if="!jobs.length">Nenhuma geração recente.</p>
        <article v-for="item in jobs" :key="item.requestId || item.id">
          <strong>{{ item.title }}</strong>
          <small v-if="item.modelLabel">{{ item.modelLabel }}<template v-if="item.sourceSeconds"> · {{ item.sourceSeconds }} s</template></small>
          <AitoVideoProgress v-if="item.kind === 'video' && videoGenerationActive(item.status)" :stage="item.status" :percent="item.progress" />
          <template v-else-if="item.kind !== 'video' && isActive(item)">
            <q-linear-progress indeterminate rounded color="teal-4" aria-label="Geração em andamento" />
            <small role="status">Gerando {{ item.kind === 'image' ? 'imagem' : 'locução' }}</small>
          </template>
          <span v-else-if="item.status === 'completed'" class="aito-generation-dialog__done"><q-icon name="mdi-check-circle-outline" /> Concluída</span>
          <small v-else role="status">{{ item.message || (failedVideo(item) ? 'A geração falhou.' : 'Geração encerrada.') }}</small>
          <span v-if="item.kind === 'video' && videoRefundNotice(item)" class="aito-generation-dialog__refund" role="status">
            <q-icon :name="videoReleasePending(item) ? 'mdi-clock-outline' : 'mdi-cash-refund'" /> {{ videoRefundNotice(item) }}
          </span>
          <div v-if="item.kind === 'video' && item.status === 'completed' && item.id" class="aito-generation-dialog__details">
            <small v-if="projectsFor(item).length">
              <q-icon name="mdi-folder-outline" size="16px" />
              {{ projectsFor(item).length === 1 ? 'Projeto' : 'Projetos' }} · {{ projectsFor(item).map(project => project.title || 'Projeto sem nome').join(', ') }}
            </small>
            <small v-else-if="item.orphanExpiresAt"><q-icon name="mdi-clock-outline" size="16px" /> {{ timeToExpire(item.orphanExpiresAt) }}</small>
            <small v-if="item.available === false && projectsFor(item).length">Abra o projeto para ver a cópia salva.</small>
            <div class="aito-generation-dialog__actions">
              <q-btn v-if="item.available !== false && preview?.id !== item.id" flat no-caps dense icon="mdi-play-circle-outline" label="Ver clipe"
                :loading="previewing === item.id" :disable="removing === item.id" @click="openClip(item)" />
              <q-btn flat no-caps dense icon="mdi-delete-outline" label="Remover" :aria-label="`Remover ${item.title}`"
                :loading="removing === item.id" :disable="Boolean(removing) && removing !== item.id" @click="askRemove(item)" />
            </div>
          </div>
          <q-btn v-if="!isActive(item) && !videoReleasePending(item) && item.status !== 'completed' && canRemoveGeneration(item)" flat no-caps dense
            icon="mdi-delete-outline" label="Remover aviso" :aria-label="`Remover aviso de ${item.title}`"
            :loading="removing === generationIdentity(item)" :disable="Boolean(removing)" @click="askRemove(item)" />
          <template v-if="preview?.id === item.id">
            <video :src="preview.url" controls playsinline preload="metadata" :aria-label="item.title" />
            <q-btn flat no-caps dense icon="mdi-download-outline" label="Baixar clipe" @click="downloadAitoIAFile(preview.file, preview.file.name)" />
          </template>
        </article>
        <p v-if="previewError" role="alert">{{ previewError }}</p>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.aito-generation-button { flex-shrink: 0; }
.aito-generation-dialog { width: min(550px, 100%); color: var(--aito-ai-text); background: var(--aito-ai-surface); border: 1px solid var(--aito-ai-line); }
.aito-generation-dialog__header { display: flex; align-items: center; gap: 7px; border-bottom: 1px solid var(--aito-ai-line); }
.aito-generation-dialog__header h2 { flex: 1; margin: 0; font-size: 1.2rem; line-height: 1.2; }
.aito-generation-dialog__counter { color: var(--aito-ai-muted); font-size: .78rem; }
.aito-generation-dialog__refund { display: inline-flex; align-items: center; gap: 5px; color: var(--aito-ai-accent); font-size: .82rem; }
.aito-generation-dialog__list { display: grid; gap: 9px; max-height: min(70dvh, 540px); overflow-y: auto; }
.aito-generation-dialog__list article { display: grid; gap: 6px; justify-items: start; padding: 11px; border: 1px solid var(--aito-ai-line); border-radius: 9px; background: var(--aito-ai-panel); }
.aito-generation-dialog__demand { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 8px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); font-size: .82rem; }
html[data-aito-ia-theme='light'] .aito-generation-dialog__demand { color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); }
.aito-generation-dialog__demand .q-icon { flex: 0 0 auto; }
.aito-generation-dialog__list :is(small, p) { margin: 0; color: var(--aito-ai-muted); }
.aito-generation-dialog__details { display: grid; gap: 3px; width: 100%; }
.aito-generation-dialog__details small { overflow-wrap: anywhere; }
.aito-generation-dialog__actions { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.aito-generation-dialog__list .q-btn, .aito-generation-dialog__done { color: var(--aito-ai-accent); }
.aito-generation-dialog__list video { width: 100%; max-height: 290px; background: #000; border-radius: 7px; }
</style>
