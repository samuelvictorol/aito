<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { assistantApi } from '../services/admin-assistant.js'
import { errorMessage } from '../services/http.js'
const props = defineProps({ file: { type: Object, required: true } })
const source = ref(''), busy = ref(false), error = ref('')
const image = computed(() => /^image\//.test(props.file.mimeType || '') || props.file.kind === 'image')
const icon = computed(() => image.value ? 'image' : /json/.test(props.file.mimeType || '') ? 'data_object' : /pdf/.test(props.file.mimeType || '') ? 'picture_as_pdf' : 'description')
let blob, generation = 0
function revoke() { if (source.value) URL.revokeObjectURL(source.value); source.value = ''; blob = null }
async function load() {
  if (blob) return blob
  busy.value = true; error.value = ''
  try { blob = await assistantApi.download(props.file.url || '/admin-assistant/files/' + props.file.id); return blob }
  catch (cause) { error.value = errorMessage(cause, 'Arquivo indisponível.'); throw cause }
  finally { busy.value = false }
}
async function download() {
  try { const bytes = await load(), url = URL.createObjectURL(bytes), link = document.createElement('a'); link.href = url; link.download = props.file.name || 'arquivo'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000) } catch { /* The inline state gives the reason. */ }
}
watch(() => props.file.id, async () => {
  const current = ++generation; revoke(); error.value = ''
  if (!image.value) return
  try { const bytes = await load(); if (current === generation) source.value = URL.createObjectURL(bytes) } catch { /* Show a useful error instead of a broken image. */ }
}, { immediate: true })
onBeforeUnmount(() => { generation++; revoke() })
</script>
<template><article class="assistant-file"><img v-if="image && source" :src="source" :alt="file.name || 'Imagem da conversa'" loading="lazy"/><div class="assistant-file__row"><q-icon :name="icon" size="22px"/><span>{{file.name || 'Arquivo gerado'}}</span><q-btn flat round dense icon="download" :loading="busy" aria-label="Baixar arquivo" @click="download"/></div><small v-if="error" role="alert">{{error}}</small></article></template>
<style scoped>.assistant-file{min-width:0;max-width:100%;border:1px solid var(--aito-line,#3b3d41);border-radius:12px;overflow:hidden;background:var(--aito-panel,#2b2d31)}.assistant-file>img{display:block;width:100%;max-height:320px;object-fit:contain;background:#fff}.assistant-file__row{display:flex;align-items:center;gap:10px;padding:8px 10px;font-size:12px}.assistant-file__row span{overflow-wrap:anywhere;flex:1;min-width:0}.assistant-file small{display:block;padding:0 10px 10px;color:#b23939;font-size:11px}</style>
