<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { waApi, formatDate, messageOf, sizeText, statusText, currentAdmin } from 'src/services/whatsapp'
import { messageAsset } from 'src/services/whatsapp-message-state'
const props = defineProps({ message: { type: Object, required: true }, canDeleteSent: Boolean })
const emit = defineEmits(['reply', 'forward', 'delete', 'retry', 'load-media'])
const root = ref(null), mediaUrl = ref(''), mediaError = ref(''), mediaLoading = ref(false), zoom = ref(false)
const adminId = currentAdmin().id
const ownsMessage = computed(() => props.message.actor?.id === adminId)
let observer, abortController, generation = 0, unloadTimer
const asset = computed(() => messageAsset(props.message))
const assetId = computed(() => typeof props.message.assetId === 'string' ? props.message.assetId : asset.value._id)
const mime = computed(() => asset.value.mime || props.message.mime || '')
const pending = computed(() => ['queued', 'processing', 'dispatching', 'preparing', 'uploading'].includes(props.message.status))
const progress = computed(() => Math.max(0, Math.min(100, Number(props.message.progress) || 0)))
const progressColor = computed(() => `hsl(${195 + progress.value / 10}, ${8 + progress.value * .68}%, ${55 + progress.value * .18}%)`)
const locationUrl = computed(() => { const place = props.message.location || props.message; const lat = Number(place.latitude), lng = Number(place.longitude); return Number.isFinite(lat) && Number.isFinite(lng) ? `https://maps.google.com/?q=${lat},${lng}` : '' })
function releaseUrl() { if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value); mediaUrl.value = '' }
async function loadMedia() {
  if (!assetId.value || mediaUrl.value || mediaLoading.value || props.message.deleted) return
  const current = ++generation
  abortController?.abort(); abortController = new AbortController(); mediaLoading.value = true; mediaError.value = ''
  try {
    const { data } = await waApi.get(`/media/${assetId.value}`, { responseType: 'blob', signal: abortController.signal, params: mime.value.startsWith('audio/') ? { playback: 1 } : undefined })
    if (current === generation) mediaUrl.value = URL.createObjectURL(data)
  } catch (error) { if (current === generation && error.code !== 'ERR_CANCELED') mediaError.value = error.response?.status === 404 ? 'Arquivo indisponível ou expirado.' : messageOf(error) }
  finally { if (current === generation) mediaLoading.value = false }
}
async function download() { await loadMedia(); if (!mediaUrl.value) return; const link = document.createElement('a'); link.href = mediaUrl.value; link.download = asset.value.name || 'arquivo'; link.click() }
onMounted(() => { observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { clearTimeout(unloadTimer); loadMedia() } else { clearTimeout(unloadTimer); unloadTimer = setTimeout(() => { const player = root.value?.querySelector('audio,video'); if (!player || player.paused) releaseUrl() }, 10000) } }, { rootMargin: '150px' }); if (root.value) observer.observe(root.value) })
watch(assetId, () => { ++generation; abortController?.abort(); mediaLoading.value = false; releaseUrl(); loadMedia() })
watch(() => props.message.deleted, (deleted) => { if (deleted) { zoom.value = false; ++generation; abortController?.abort(); releaseUrl() } })
onBeforeUnmount(() => { ++generation; clearTimeout(unloadTimer); observer?.disconnect(); abortController?.abort(); releaseUrl() })
</script>

<template>
  <article ref="root" :class="['wa-bubble', { outgoing: message.direction === 'out', deleted: message.deleted }]">
    <header><strong>{{ message.direction === 'out' ? (message.actor?.name || (message.source === 'bot' ? 'Bot' : 'WhatsApp')) : 'Cliente' }}</strong><q-btn flat round dense size="sm" icon="mdi-dots-vertical" aria-label="Ações da mensagem"><q-menu><q-list dense style="min-width:180px"><q-item v-close-popup clickable :disable="!!message.deleted || !!message.local" @click="emit('reply', message)"><q-item-section>Responder</q-item-section></q-item><q-item v-close-popup clickable :disable="!!message.deleted || !!message.local" @click="emit('forward', message)"><q-item-section>Encaminhar</q-item-section></q-item><q-item v-if="!message.deleted" v-close-popup clickable :disable="!!message.local || (message.direction === 'out' && (!canDeleteSent || ['processing', 'dispatching', 'uncertain'].includes(message.status)))" @click="emit('delete', message)"><q-item-section class="text-negative">{{ message.direction === 'out' ? message.whatsappId ? 'Apagar para todos' : 'Cancelar envio' : 'Apagar do painel' }}</q-item-section></q-item></q-list></q-menu></q-btn></header>
    <div v-if="message.quoted" class="wa-quote">{{ message.quoted.text || 'Mensagem respondida' }}</div>
    <p v-if="message.deleted" class="wa-deleted">Mensagem apagada</p>
    <template v-else>
      <div v-if="assetId || ['media', 'image', 'audio', 'video', 'file', 'sticker', 'document', 'ptt'].includes(message.type)" class="wa-media">
        <div v-if="!assetId" class="wa-media-placeholder"><q-icon name="mdi-file-outline" size="24px" /><span>{{ asset.name || message.mediaError?.message || 'Arquivo em processamento' }}</span><q-btn v-if="!message.local && message.mediaError?.retryable" flat dense no-caps label="Carregar mídia" @click="emit('load-media', message)" /></div>
        <div v-if="mediaLoading" class="wa-media-placeholder"><q-spinner color="light-blue-3" size="26px" /><span>Carregando arquivo…</span></div>
        <div v-else-if="mediaError" class="wa-media-placeholder"><q-icon name="mdi-file-alert-outline" size="24px" /><span>{{ mediaError }}</span><q-btn flat dense no-caps label="Tentar carregar" @click="loadMedia" /></div>
        <template v-else-if="mediaUrl">
          <button v-if="mime.startsWith('image/')" class="wa-image" aria-label="Ampliar imagem" @click="zoom = true"><img :src="mediaUrl" :alt="asset.name || 'Imagem recebida'" loading="lazy" /><q-icon name="mdi-magnify-plus-outline" /></button>
          <audio v-else-if="mime.startsWith('audio/')" :src="mediaUrl" controls preload="metadata" />
          <video v-else-if="mime.startsWith('video/')" :src="mediaUrl" controls playsinline preload="metadata" />
          <div v-else class="wa-file"><q-icon name="mdi-file-document-outline" size="28px" /><span>{{ asset.name || 'Arquivo' }}<small>{{ sizeText(asset.size) }}</small></span></div>
          <q-btn flat dense no-caps icon="mdi-download" :label="asset.name || 'Baixar arquivo'" class="wa-download" @click="download" />
        </template>
      </div>
      <a v-if="message.type === 'location' && locationUrl" :href="locationUrl" target="_blank" rel="noopener noreferrer" class="wa-location"><q-icon name="mdi-map-marker-outline" />{{ message.location?.name || message.locationName || 'Ver localização' }}</a>
      <div v-if="message.type === 'contact'" class="wa-contact"><q-icon name="mdi-account-box-outline" />{{ message.contact?.name || message.contactName }}<span>{{ message.contact?.phone || message.contactPhone }}</span></div>
      <p v-if="message.text" class="wa-message-text">{{ message.text }}</p>
    </template>
    <footer><time :datetime="message.createdAt">{{ formatDate(message.createdAt, true) }}</time><span v-if="pending" class="wa-progress" :title="statusText(message.status)" role="status" :aria-label="`${statusText(message.status)} ${progress}%`"><q-circular-progress :value="progress" size="17px" :thickness=".2" track-color="grey-7" :style="{ color: progressColor }" :indeterminate="!progress" /><small>{{ progress ? `${Math.round(progress)}%` : '' }}</small></span><q-icon v-else-if="message.direction === 'out'" :name="['failed', 'uncertain'].includes(message.status) ? 'mdi-alert-circle-outline' : ['read', 'delivered'].includes(message.status) ? 'mdi-check-all' : 'mdi-check'" :color="['failed', 'uncertain'].includes(message.status) ? 'amber-5' : message.status === 'read' ? 'light-blue-3' : 'grey-5'"><q-tooltip>{{ statusText(message.status) }}</q-tooltip></q-icon></footer>
    <div v-if="['failed', 'uncertain'].includes(message.status)" class="wa-error"><span>{{ message.error || (message.status === 'uncertain' ? 'Aguardando confirmação. Confira no WhatsApp antes de reenviar.' : 'Não foi possível enviar.') }}</span><q-btn v-if="message.status === 'failed' && (message.local ? !!message.retryPayload : ownsMessage)" flat dense no-caps label="Tentar novamente" @click="emit('retry', message)" /></div>
    <q-dialog v-model="zoom"><q-card class="wa-zoom"><q-btn flat round icon="mdi-close" class="wa-zoom-close" aria-label="Fechar imagem" v-close-popup /><img :src="mediaUrl" :alt="asset.name || 'Imagem'" /><q-btn flat no-caps icon="mdi-download" label="Salvar imagem" @click="download" /></q-card></q-dialog>
  </article>
</template>

<style scoped>
.wa-bubble{align-self:flex-start;width:fit-content;max-width:min(78%,490px);min-width:155px;padding:7px 12px 9px;border:1px solid #244044;border-radius:3px 15px 15px;background:#163237;color:#e4f2ed;box-shadow:0 3px 12px #00000010}.wa-bubble.outgoing{align-self:flex-end;background:#12493f;border-color:#205c50;border-radius:15px 3px 15px 15px}.wa-bubble.deleted{opacity:.65}.wa-bubble header{display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:10px;color:#a6d5c7}.wa-bubble header strong{font-weight:500}.wa-bubble footer{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:5px;color:#a4beb8;font-size:9px}.wa-message-text{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}.wa-quote{padding:7px 9px;border-left:3px solid #59d1b6;border-radius:4px;background:#ffffff08;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}.wa-deleted{font-style:italic;color:#b0c7bd}.wa-media img,.wa-media video{display:block;width:100%;max-height:360px;object-fit:contain;border-radius:7px}.wa-media audio{width:min(320px,100%);margin-top:8px}.wa-media-placeholder{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:9px;min-height:95px;max-width:300px;font-size:11px}.wa-image{display:block;position:relative;padding:0;border:0;background:transparent;cursor:zoom-in}.wa-image>.q-icon{position:absolute;right:7px;top:7px;padding:4px;border-radius:50%;color:white;background:#082e34bd;font-size:20px}.wa-file{display:flex;gap:9px;align-items:center;padding:13px 0;overflow-wrap:anywhere}.wa-file small{display:block;color:#9cb5b0}.wa-download{max-width:100%;font-size:10px;overflow-wrap:anywhere}.wa-download :deep(.q-btn__content){word-break:break-word}.wa-progress{display:flex;align-items:center;gap:4px}.wa-error{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px;padding:7px;border-radius:5px;color:#ffcf80;background:#674b292e;font-size:11px;overflow-wrap:anywhere}.wa-location{display:flex;gap:5px;color:#a5f6df;padding:14px 0}.wa-contact{padding:12px 0}.wa-contact span{display:block}.wa-zoom{position:relative;background:#0d2328;color:white;max-width:94vw!important}.wa-zoom img{display:block;max-height:80vh;max-width:90vw;object-fit:contain}.wa-zoom-close{position:absolute;top:7px;right:7px;background:#0008;z-index:1}@media(max-width:600px){.wa-bubble{max-width:88%}.wa-media audio{width:235px}}
</style>
