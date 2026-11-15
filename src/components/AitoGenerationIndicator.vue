<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import AitoVideoProgress from 'components/AitoVideoProgress.vue'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { localGenerationActivity } from 'src/services/aitoiaGenerationActivity'
import { readGeneratedClipForJob } from 'src/services/aitoiaVideoRemote'
import { videoGenerationActive } from 'src/services/aitoiaVideoJobs'

const props = defineProps({ state: { type: Object, required: true } })
const { accountId, access } = props.state
const open = ref(false)
const remoteJobs = shallowRef([])
const refreshing = ref(false)
const refreshFailed = ref(false)
const time = ref(Date.now())
const preview = shallowRef(null)
const previewing = ref('')
const previewError = ref('')
let pollTimer
let pollRequest
let previewRequest
let disposed = false

const types = { remake: 'Cena refeita', studio: 'Clipe do estúdio', chat: 'Vídeo no chat' }
const isActive = item => item.active ?? videoGenerationActive(item.status)
const sortTime = item => typeof item.createdAt === 'number' ? item.createdAt : Date.parse(item.createdAt) || 0
const owned = computed(() => localGenerationActivity.value.filter(item => item.owner === accountId.value))
const jobs = computed(() => {
  const upstream = remoteJobs.value.map(job => ({ title: types[job.source] || 'Vídeo', kind: 'video', ...job }))
  const local = owned.value.filter(job => !upstream.some(item => item.requestId === job.requestId || item.id && item.id === job.id) &&
    time.value - job.createdAt < (job.kind === 'video' && isActive(job) ? 120000 : 24 * 60 * 60_000))
  return [...upstream, ...local].sort((left, right) =>
    Number(isActive(right)) - Number(isActive(left)) || sortTime(right) - sortTime(left)).slice(0, 8)
})
const active = computed(() => jobs.value.some(isActive))
const latest = computed(() => jobs.value[0])
const label = computed(() => active.value ? 'Ver andamento das gerações' : 'Ver resultados das gerações')
const statusIcon = computed(() => latest.value?.status === 'completed' ? 'mdi-check-circle-outline' :
  latest.value?.status === 'uncertain' ? 'mdi-clock-alert-outline' : 'mdi-alert-circle-outline')

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
      const { jobs: rows, activeGeneration } = data.data
      remoteJobs.value = activeGeneration && !rows.some(item => item.id === activeGeneration.id)
        ? [activeGeneration, ...rows] : rows
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
  clearPreview()
}

watch(accountId, id => {
  reset()
  open.value = false
  remoteJobs.value = []
  refreshFailed.value = false
  if (id) queuePoll(0)
}, { immediate: true })
watch(owned, () => queuePoll(350))
watch(open, visible => {
  if (visible) queuePoll(0)
  else clearPreview()
})
onBeforeUnmount(() => { disposed = true; reset() })

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
  <q-btn v-if="accountId && latest" flat dense round class="aito-generation-button"
    :aria-label="label" aria-haspopup="dialog" @click="open = true">
    <q-spinner v-if="active" size="19px" color="teal-3" />
    <q-icon v-else :name="statusIcon" :color="latest.status === 'completed' ? 'teal-3' : 'amber-4'" size="22px" />
    <q-tooltip>{{ label }}</q-tooltip>
  </q-btn>

  <q-dialog v-model="open" aria-labelledby="aito-generation-heading">
    <q-card class="aito-ai-theme aito-generation-dialog">
      <q-card-section class="aito-generation-dialog__header">
        <h2 id="aito-generation-heading">Gerações</h2>
        <q-btn flat dense round icon="mdi-refresh" aria-label="Atualizar gerações" :loading="refreshing" @click="refresh" />
        <q-btn v-close-popup flat dense round icon="mdi-close" aria-label="Fechar gerações" />
      </q-card-section>
      <q-card-section class="aito-generation-dialog__list">
        <p v-if="refreshFailed" role="status">Falha ao atualizar a fila. Tente novamente.</p>
        <p v-if="!jobs.length">Nenhuma geração recente.</p>
        <article v-for="item in jobs" :key="item.requestId || item.id">
          <strong>{{ item.title }}</strong>
          <small v-if="item.modelLabel">{{ item.modelLabel }}<template v-if="item.sourceSeconds"> · {{ item.sourceSeconds }} s</template></small>
          <AitoVideoProgress v-if="item.kind === 'video' && isActive(item)" :stage="item.status" :percent="item.progress" />
          <template v-else-if="isActive(item)">
            <q-linear-progress indeterminate rounded color="teal-4" aria-label="Geração em andamento" />
            <small role="status">Gerando {{ item.kind === 'image' ? 'imagem' : 'locução' }}</small>
          </template>
          <span v-else-if="item.status === 'completed'" class="aito-generation-dialog__done"><q-icon name="mdi-check-circle-outline" /> Concluída</span>
          <small v-else role="status">{{ item.message || (item.status === 'uncertain' ? 'Aguardando confirmação do provedor.' : 'Geração encerrada.') }}</small>
          <q-btn v-if="item.kind === 'video' && item.status === 'completed' && item.id && preview?.id !== item.id"
            flat no-caps dense icon="mdi-play-circle-outline" label="Ver clipe" :loading="previewing === item.id" @click="openClip(item)" />
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
.aito-generation-dialog__list { display: grid; gap: 9px; max-height: min(70dvh, 540px); overflow-y: auto; }
.aito-generation-dialog__list article { display: grid; gap: 6px; justify-items: start; padding: 11px; border: 1px solid var(--aito-ai-line); border-radius: 9px; background: var(--aito-ai-panel); }
.aito-generation-dialog__list :is(small, p) { margin: 0; color: var(--aito-ai-muted); }
.aito-generation-dialog__list .q-btn, .aito-generation-dialog__done { color: var(--aito-ai-accent); }
.aito-generation-dialog__list video { width: 100%; max-height: 290px; background: #000; border-radius: 7px; }
</style>
