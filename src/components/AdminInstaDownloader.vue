<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'

const $q = useQuasar(), link = ref(''), busy = ref(false), result = shallowRef(null), video = ref(''), cover = ref(''), file = shallowRef(null)
const linkInput = ref(null)
const base = '/admin/insta-downloader'
let controller
const canShare = computed(() => Boolean(file.value && navigator.canShare?.({ files: [file.value] })))
function clear() { if (video.value) URL.revokeObjectURL(video.value); if (cover.value) URL.revokeObjectURL(cover.value); video.value = ''; cover.value = ''; file.value = null; result.value = null }

function instagramLink(text) {
  const match = text.trim().match(/(?:^|[\s(<"'“«])((?:https:\/\/)?(?:www\.)?instagram\.com\/[^\s<>"'“”«»]+)/iu)
  if (!match) return ''
  const url = match[1].replace(/[)\]}.,;!]+$/u, '')
  return /^https:\/\//i.test(url) ? url : 'https://' + url
}

function onNativePaste(event) {
  const url = instagramLink(event.clipboardData?.getData('text/plain') || '')
  if (url) {
    event.preventDefault()
    link.value = url
  }
}

async function pasteLink() {
  try {
    const url = instagramLink(await navigator.clipboard.readText())
    if (url) link.value = url
    else $q.notify({ type: 'warning', position: 'top', message: 'Copie o link de um vídeo ou Reel do Instagram.' })
  } catch {
    $q.notify({ type: 'warning', position: 'top', message: 'Use a opção Colar do seu navegador no campo do link.' })
  }
  linkInput.value?.focus()
}

async function convert() {
  if (busy.value || !link.value.trim()) return
  const url = instagramLink(link.value)
  if (!url) {
    $q.notify({ type: 'warning', position: 'top', message: 'Cole um link de vídeo ou Reel do Instagram.' })
    linkInput.value?.focus()
    return
  }
  controller = new AbortController(); busy.value = true; clear()
  try {
    const options = { ...financeHeaders(true), signal: controller.signal, timeout: 195000 }
    const { data } = await api.post(base + '/convert', { url }, options)
    const item = data.data
    const [clip, image] = await Promise.all([
      api.get(`${base}/${item.id}/video`, { ...options, responseType: 'blob', timeout: 60000 }),
      api.get(`${base}/${item.id}/thumbnail`, { ...options, responseType: 'blob', timeout: 30000 }),
    ])
    if (!(clip.data instanceof Blob) || !clip.data.size || clip.data.type.split(';')[0] !== 'video/mp4') throw Error('O vídeo não foi recebido completamente. Converta o link novamente.')
    file.value = new File([clip.data], `instagram-${item.id}.mp4`, { type: 'video/mp4' })
    video.value = URL.createObjectURL(file.value)
    if (image.data instanceof Blob && image.data.type === 'image/jpeg') cover.value = URL.createObjectURL(image.data)
    result.value = item
  } catch (error) {
    let detail = error.response?.data
    if (detail instanceof Blob && detail.size < 20000) { try { detail = JSON.parse(await detail.text()) } catch { detail = null } }
    if (!controller.signal.aborted) $q.notify({ type: 'negative', position: 'top', message: detail?.message || error.message || 'Não foi possível converter este vídeo.' })
  } finally { busy.value = false; controller = null }
}
function download() {
  if (!file.value || !video.value) return
  const anchor = document.createElement('a'); anchor.href = video.value; anchor.download = file.value.name; document.body.appendChild(anchor); anchor.click(); anchor.remove()
}
async function savePhotos() {
  if (!file.value) return
  try { await navigator.share({ files: [file.value], title: result.value?.title || 'Vídeo do Instagram' }) }
  catch (error) { if (error.name !== 'AbortError') $q.notify({ type: 'warning', position: 'top', message: 'Use Baixar vídeo ou compartilhe pelo menu do navegador.' }) }
}
onBeforeUnmount(() => { controller?.abort(); clear() })
</script>

<template>
  <section class="insta-downloader" aria-labelledby="insta-downloader-title">
    <header><span class="insta-downloader__icon"><q-icon name="mdi-instagram" size="34px" /></span><div><p>FERRAMENTAS DO ADMIN</p><h2 id="insta-downloader-title">InstaDownloader</h2><span>Do link à sua biblioteca de vídeos.</span></div></header>
    <q-form class="insta-downloader__form" @submit.prevent="convert">
      <q-input
        ref="linkInput" v-model="link" outlined dark inputmode="url"
        label="Link do vídeo ou Reel" placeholder="https://www.instagram.com/reel/…"
        autocapitalize="none" autocomplete="off" maxlength="2048" :spellcheck="false"
        :disable="busy" @change="link = $event" @paste="onNativePaste"
      >
        <template #prepend><q-icon name="mdi-link-variant" /></template>
        <template #append>
          <q-btn flat round dense type="button" icon="mdi-content-paste" aria-label="Colar link" title="Colar link" :disable="busy" @click.stop="pasteLink" />
        </template>
      </q-input>
      <q-btn unelevated no-caps icon="mdi-download-circle-outline" label="Converter" type="submit" class="insta-downloader__convert" :loading="busy" :disable="!link.trim() || busy" />
    </q-form>
    <div v-if="busy" class="insta-downloader__loading" role="status"><q-spinner size="26px" /><span>Preparando um MP4 compatível com celular…</span><q-btn flat dense no-caps label="Cancelar" @click="controller?.abort()" /></div>
    <div v-if="result" class="insta-downloader__result">
      <div class="insta-downloader__preview"><video :src="video" :poster="cover" controls playsinline preload="metadata" /></div>
      <div class="insta-downloader__details"><q-badge outline color="pink-3">MP4 · pronto para salvar</q-badge><h3>{{ result.title }}</h3><p v-if="result.uploader">{{ result.uploader }}</p><span>{{ Math.round(result.duration) }} s · {{ (result.size / 1048576).toFixed(1) }} MB</span>
        <div class="insta-downloader__actions"><q-btn unelevated no-caps icon="mdi-download" label="Baixar vídeo" class="insta-downloader__convert" @click="download" /><q-btn v-if="canShare" outline no-caps icon="mdi-image-multiple-outline" label="Salvar no Fotos / compartilhar" @click="savePhotos" /></div>
        <small v-if="canShare">No iPhone, escolha “Salvar Vídeo” no menu de compartilhamento.</small>
        <small>O arquivo preparado fica no servidor por até 15 minutos. O download já carregado fica disponível nesta tela.</small>
      </div>
    </div>
    <div v-else-if="!busy" class="insta-downloader__empty"><q-icon name="mdi-play-box-outline" size="52px" /><p>Cole um link e clique em Converter para conferir a capa e salvar o vídeo.</p></div>
    <p class="insta-downloader__hint">Vídeos públicos do Instagram · até 10 minutos e 60 MB. Publicações com vários vídeos usam o primeiro vídeo disponível. Conteúdo que exige login ou está indisponível não pode ser convertido.</p>
  </section>
</template>

<style scoped>
.insta-downloader{padding:clamp(18px,3vw,34px);border:1px solid #405052;border-radius:22px;background:linear-gradient(130deg,#132326,#111b23 65%);color:#eff9f6;max-width:1200px;margin:auto}.insta-downloader header{display:flex;gap:17px;align-items:center;margin-bottom:26px}.insta-downloader__icon{display:grid;place-items:center;min-width:66px;height:66px;border-radius:19px;color:#fff;background:linear-gradient(140deg,#9160d2,#d45497 60%,#e6a45e)}.insta-downloader header p{font-size:.65rem;font-weight:700;letter-spacing:.13em;color:#c5a9da;margin:0}.insta-downloader h2{font-size:clamp(1.5rem,3vw,2rem);line-height:1.3;margin:4px 0;font-weight:750}.insta-downloader header span:not(.insta-downloader__icon){color:#b8cccc;font-size:.85rem}.insta-downloader__form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}.insta-downloader__convert{background:linear-gradient(130deg,#bd5a9b,#885bbb);color:#fff;min-height:48px;padding:0 22px}.insta-downloader__loading{display:flex;gap:12px;align-items:center;justify-content:center;margin:35px 0;color:#e0c6f0}.insta-downloader__result{display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,1fr);gap:25px;margin-top:25px;padding-top:25px;border-top:1px solid #405052}.insta-downloader__preview{display:grid;place-items:center;max-height:560px;min-height:200px;background:#080d11;border-radius:15px;overflow:hidden}.insta-downloader video{max-width:100%;max-height:560px;display:block}.insta-downloader__details h3{font-size:1.15rem;line-height:1.5;margin:17px 0 8px;overflow-wrap:anywhere}.insta-downloader__details p,.insta-downloader__details>span{color:#b8cccc;font-size:.8rem}.insta-downloader__actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 16px}.insta-downloader__details small{display:block;color:#acc0c4;font-size:.72rem;line-height:1.6;margin-top:10px}.insta-downloader__empty{display:grid;justify-items:center;gap:13px;text-align:center;padding:55px 15px;color:#8da9b1}.insta-downloader__empty p{max-width:430px;line-height:1.6;margin:0;font-size:.9rem}.insta-downloader__hint{color:#91a9af;font-size:.73rem;line-height:1.7;margin:24px 0 0}@media(max-width:650px){.insta-downloader__form,.insta-downloader__result{grid-template-columns:1fr}.insta-downloader__loading{flex-wrap:wrap}.insta-downloader__preview,.insta-downloader video{max-height:420px}.insta-downloader__actions{display:grid}.insta-downloader__details{min-width:0}}
</style>
