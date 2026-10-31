<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { http, errorMessage } from '../services/http.js'
import { profileHttp } from '../services/profile.js'
const props = defineProps({ content: Object, publicAccess: Boolean, mediaBase: { type: String, default: '/site-templates/media/' }, compact: Boolean })
const emit = defineEmits(['error'])
const source = ref(''), busy = ref(false), error = ref('')
let controller, generation = 0
const mediaCache = new Map()
function clear() { controller?.abort(); source.value = '' }
function dataUrl(blob) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Não foi possível preparar o arquivo.')); reader.readAsDataURL(blob) }) }
watch(() => [props.content, props.mediaBase], async () => {
  clear(); const version = ++generation; if (!props.content) return
  controller = new AbortController(); busy.value = true; error.value = ''
  try {
    let doc = props.content.document
    for (const media of props.content.media || []) {
      const key = props.mediaBase + media.id
      let url = !props.publicAccess && mediaCache.get(key)
      if (!url) {
        const response = await (props.publicAccess ? profileHttp : http).get(key, { responseType: 'blob', signal: controller.signal })
        if (version !== generation) return
        url = await dataUrl(response.data)
        if (!props.publicAccess && version === generation) mediaCache.set(key, url)
      }
      if (version !== generation) return
      doc = doc.replaceAll('site-media:' + media.id, url)
    }
    if (version === generation) source.value = doc
    const retained = new Set((props.content.media || []).map(media => props.mediaBase + media.id))
    for (const key of mediaCache.keys()) if (!retained.has(key)) mediaCache.delete(key)
  } catch (cause) { if (version === generation && cause.code !== 'ERR_CANCELED') { error.value = errorMessage(cause, 'Não foi possível carregar os arquivos.'); emit('error', cause) } }
  finally { if (version === generation) busy.value = false }
}, { immediate: true })
onBeforeUnmount(() => { generation++; clear(); mediaCache.clear() })
</script>
<template><div class="site-document-frame" :class="{ 'site-document-frame--compact': compact }"><div v-if="busy" class="site-document-state"><q-spinner color="purple"/><span>Preparando conteúdo…</span></div><q-banner v-if="error" class="bg-red-1 text-negative">{{error}}</q-banner><iframe v-if="source" :srcdoc="source" sandbox="allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerpolicy="no-referrer" title="Conteúdo completo da notificação"/></div></template>
<style scoped>.site-document-frame{width:100%;min-height:400px;display:flex;flex-direction:column}.site-document-frame iframe{display:block;width:100%;flex:1;border:0;min-height:650px;border-radius:14px;background:#f4f8f7}.site-document-state{display:flex;justify-content:center;align-items:center;gap:12px;padding:50px;font-size:13px}.site-document-frame--compact iframe{min-height:65dvh}@media(max-width:600px){.site-document-frame iframe{min-height:75dvh;border-radius:0}}</style>
