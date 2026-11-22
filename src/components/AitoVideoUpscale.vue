<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useQuasar } from 'quasar'
import { filesForComponent } from 'src/services/aitoiaComponentReferences'
import { commonVideoType, videoReferenceAccept } from 'src/services/aitoiaVideoCompatibility'

const props = defineProps({ clips: { type: Array, default: () => [] }, components: { type: Array, default: () => [] }, access: Function, disabled: Boolean, signedIn: Boolean })
const emit = defineEmits(['busy', 'ready', 'login'])
const $q = useQuasar()
const file = shallowRef(null), preview = ref(''), resolution = ref('1080p'), enhancement = ref('balanced'), processing = ref(false), chosen = ref('')
let controller
const sources = computed(() => [...props.clips.filter(item => item.file && !item.expired).map(item => ({ id: item.id, title: item.title || item.file.name, file: item.file })),
  ...props.components.flatMap(item => filesForComponent(item).filter(asset => asset.type.startsWith('video/')).map((asset, index) => ({ id: `${item.id}:${index}`, title: `${item.title}${index ? ` · ${index + 1}` : ''}`, file: asset })))])
function chooseFile(value) {
  if (!value || processing.value) return
  try {
    commonVideoType(value)
    if (preview.value) URL.revokeObjectURL(preview.value)
    file.value = value; preview.value = URL.createObjectURL(value)
  } catch (error) { $q.notify({ type: 'negative', position: 'top', message: error.message }) }
}
async function upscale() {
  if (!props.signedIn) return emit('login')
  if (!file.value || props.disabled || processing.value) return
  const source = file.value
  const access = props.access()
  controller = new AbortController(); processing.value = true; emit('busy', true)
  try {
    const { data } = await access.post('/aitoia/video/upscale', source, { headers: { 'Content-Type': commonVideoType(source) },
      params: { filename: source.name, resolution: resolution.value, enhancement: enhancement.value }, responseType: 'blob', signal: controller.signal, timeout: 190000 })
    controller.signal.throwIfAborted()
    if (!access.current()) return
    if (!(data instanceof Blob) || !data.size || data.type.split(';')[0] !== 'video/mp4') throw Error('O processamento não retornou um vídeo válido.')
    const title = `${source.name.replace(/\.[^.]+$/, '')} · ${resolution.value}`
    emit('ready', { file: new File([data], `${title}.mp4`, { type: 'video/mp4' }), title })
    $q.notify({ type: 'positive', position: 'top', message: 'Upscale concluído e salvo nas cenas do projeto.' })
  } catch (cause) {
    if (!controller.signal.aborted) {
      let detail = cause.response?.data
      if (detail instanceof Blob && detail.size < 20000) { try { detail = JSON.parse(await detail.text()) } catch { detail = null } }
      $q.notify({ type: 'negative', position: 'top', message: detail?.message || cause.message || 'Não foi possível processar o vídeo.' })
    }
  } finally { processing.value = false; emit('busy', false); controller = null }
}
defineExpose({ chooseFile })
onBeforeUnmount(() => { controller?.abort(); if (preview.value) URL.revokeObjectURL(preview.value) })
</script>

<template>
  <section class="video-upscale" aria-labelledby="video-upscale-heading">
    <header><q-icon name="mdi-arrow-expand-all" size="30px" /><div><h2 id="video-upscale-heading">Upscale Video</h2><p>Ajuste a resolução e a nitidez de cenas de até 30 segundos.</p></div><span>Processamento de vídeo · 0 AitoTokens</span></header>
    <div class="video-upscale__grid">
      <div class="video-upscale__controls">
        <label class="video-upscale__upload"><q-icon name="mdi-file-video-outline" size="30px" /><strong>{{ file?.name || 'Anexar uma cena' }}</strong><small>MP4, MOV, WebM, MKV, AVI ou 3GP · até 60 MB</small><input type="file" :accept="videoReferenceAccept" :disabled="disabled || processing" @change="chooseFile($event.target.files[0]); $event.target.value = ''" /></label>
        <label v-if="sources.length">Ou escolha uma cena do projeto<select v-model="chosen" :disabled="disabled || processing" @change="chooseFile(sources.find(item => item.id === chosen)?.file)"><option value="">Selecionar cena</option><option v-for="item in sources" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
        <div class="video-upscale__options"><label>Resolução<select v-model="resolution" :disabled="disabled || processing"><option v-for="value in ['420p','720p','1080p','1440p','2160p']" :key="value" :value="value">{{ value === '2160p' ? '2160p · 4K' : value }}</option></select></label><label>Acabamento<select v-model="enhancement" :disabled="disabled || processing"><option value="preserve">Preservar aparência</option><option value="balanced">Equilibrado</option><option value="detail">Realçar detalhes</option></select></label></div>
        <button type="button" class="video-upscale__primary" :disabled="!file || disabled || processing" @click="upscale"><q-spinner v-if="processing" size="19px" /><q-icon v-else name="mdi-arrow-expand-all" />{{ processing ? 'Processando vídeo…' : 'Fazer upscale' }}</button>
        <button v-if="processing" type="button" class="video-upscale__cancel" @click="controller?.abort()">Cancelar</button>
        <q-linear-progress v-if="processing" indeterminate :color="'blue-grey-5'" aria-label="Processando upscale" />
      </div>
      <div class="video-upscale__preview"><video v-if="preview" :src="preview" controls playsinline preload="metadata" /><div v-else><q-icon name="mdi-video-outline" size="56px" /><span>A prévia da cena aparece aqui</span></div></div>
    </div>
  </section>
</template>

<style scoped>
.video-upscale { grid-column:1/-1; padding:clamp(16px,3vw,28px); border:1px solid var(--aito-ai-line); border-radius:18px; background:var(--aito-ai-surface); color:var(--aito-ai-text); }
.video-upscale header { display:flex; align-items:center; gap:14px; margin-bottom:24px; }.video-upscale header>.q-icon{color:var(--aito-ai-accent)}.video-upscale h2{margin:0 0 5px;font-size:1.35rem;font-weight:700}.video-upscale p{margin:0;color:var(--aito-ai-muted);font-size:.85rem}.video-upscale header>span{margin-left:auto;font-size:.7rem;color:var(--aito-ai-gold);background:var(--aito-ai-gold-soft);padding:8px;border-radius:8px}
.video-upscale__grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.video-upscale__controls{display:grid;gap:15px}.video-upscale label{display:grid;gap:7px;color:var(--aito-ai-muted);font-size:.83rem}.video-upscale input,.video-upscale select{width:100%;padding:11px;border:1px solid var(--aito-ai-line);border-radius:9px;background:var(--aito-ai-bg);color:var(--aito-ai-text);font:inherit}.video-upscale__upload{padding:25px;text-align:center;justify-items:center;gap:12px!important;border:1px dashed var(--aito-ai-line);border-radius:13px;background:var(--aito-ai-panel);overflow-wrap:anywhere}.video-upscale__upload strong{color:var(--aito-ai-text)}.video-upscale__upload small{font-size:.72rem}.video-upscale__options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.video-upscale__primary,.video-upscale__cancel{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:0;border-radius:10px;font:inherit;cursor:pointer}.video-upscale__primary{color:var(--aito-ai-on-accent);background:var(--aito-ai-gradient);font-weight:700}.video-upscale__cancel{background:var(--aito-ai-panel);color:var(--aito-ai-text);border:1px solid var(--aito-ai-line)}.video-upscale button:disabled{opacity:.5;cursor:default}.video-upscale__preview{display:grid;place-items:center;min-width:0;min-height:250px;border:1px solid var(--aito-ai-line);border-radius:13px;background:var(--aito-ai-media-bg);overflow:hidden}.video-upscale__preview video{width:100%;max-height:460px}.video-upscale__preview>div{display:grid;justify-items:center;gap:14px;color:var(--aito-ai-muted);font-size:.8rem}@media(max-width:700px){.video-upscale__grid{grid-template-columns:1fr}.video-upscale header{flex-wrap:wrap}.video-upscale header>span{margin-left:0}.video-upscale__preview{min-height:180px}}
</style>
