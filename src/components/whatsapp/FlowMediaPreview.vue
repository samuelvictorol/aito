<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { waApi, messageOf } from 'src/services/whatsapp'
const props = defineProps({ assetId: String, name: String })
const root = ref(null), url = ref(''), mime = ref(''), loading = ref(false), error = ref(''), expanded = ref(false)
const kind = computed(() => mime.value.split('/')[0])
let observer, controller, generation = 0, visible = false, previousFocus
function stopPlayers() { root.value?.querySelectorAll('audio,video').forEach(player => player.pause()) }
function release() { stopPlayers(); if (url.value) URL.revokeObjectURL(url.value); url.value = ''; mime.value = '' }
async function load() {
  if (!props.assetId || loading.value || url.value) return
  const current = ++generation; controller?.abort(); controller = new AbortController(); loading.value = true; error.value = ''
  try {
    const { data } = await waApi.get(`/media/${props.assetId}`, { responseType: 'blob', params: { playback: 1 }, signal: controller.signal })
    if (current !== generation) return
    mime.value = data.type; url.value = URL.createObjectURL(data)
  } catch (cause) { if (current === generation && cause.code !== 'ERR_CANCELED') error.value = messageOf(cause) }
  finally { if (current === generation) loading.value = false }
}
async function open() { stopPlayers(); previousFocus = document.activeElement; expanded.value = true; await nextTick(); root.value?.querySelector('.preview-close')?.focus() }
function close() { stopPlayers(); expanded.value = false; previousFocus?.focus() }
function download() { const link = document.createElement('a'); link.href = url.value; link.download = props.name || 'arquivo'; link.click() }
function trap(event) {
  if (event.key !== 'Tab') return
  const elements = [...root.value.querySelectorAll('.preview-expanded button,.preview-expanded video')];
  if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus() }
}
watch(() => props.assetId, () => { generation++; controller?.abort(); close(); release(); loading.value = false; error.value = ''; if (visible) load() })
onMounted(() => { observer = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); if (visible) load() }, { rootMargin: '80px' }); observer.observe(root.value) })
onBeforeUnmount(() => { generation++; controller?.abort(); observer?.disconnect(); release() })
</script>
<template>
  <div ref="root" class="flow-media-preview" @keydown.stop>
    <span v-if="loading" role="status">Carregando mídia…</span>
    <div v-else-if="error" role="alert">{{ error }} <button type="button" @click="release(); load()">Tentar novamente</button></div>
    <template v-else-if="url">
      <img v-if="kind === 'image'" :src="url" :alt="name || 'Imagem'" class="preview-small" @error="error = 'Não foi possível exibir a imagem.'">
      <video v-else-if="kind === 'video'" :src="url" class="preview-small" controls playsinline preload="metadata" @error="error = 'Vídeo indisponível neste navegador.'" />
      <audio v-else-if="kind === 'audio'" :src="url" controls preload="metadata" aria-label="Ouvir áudio" @error="error = 'Áudio indisponível neste navegador.'" />
      <span v-else>{{ name || 'Documento' }}</span>
      <button v-if="['image','video'].includes(kind)" type="button" @click="open">Ampliar mídia</button>
      <button v-else-if="kind !== 'audio'" type="button" @click="download">Baixar arquivo</button>
    </template>
    <button v-else type="button" @click="load">Carregar prévia</button>
    <div v-if="expanded" class="preview-expanded" role="dialog" aria-modal="true" aria-label="Mídia ampliada" @keydown.esc.stop.prevent="close" @keydown="trap" @click.self="close">
      <button type="button" class="preview-close" @click="close">Fechar tela cheia</button>
      <img v-if="kind === 'image'" :src="url" :alt="name || 'Imagem ampliada'">
      <video v-else :src="url" controls playsinline preload="metadata" />
    </div>
  </div>
</template>
<style scoped>
.flow-media-preview{display:grid;gap:8px;min-width:0;min-height:32px;width:100%;max-width:280px;font-size:12px;overflow-wrap:anywhere}.preview-small{display:block;width:100%;max-height:150px;object-fit:contain;border-radius:8px;background:#103a3010}.flow-media-preview audio{width:100%;min-width:0;height:40px}.flow-media-preview button{border:1px solid #a9cabe;border-radius:7px;background:#eff8f3;color:#145444;padding:8px;cursor:pointer}.preview-expanded{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:#071816f5;padding:65px 16px 20px}.preview-expanded img,.preview-expanded video{width:auto;max-width:100%;max-height:calc(100dvh - 100px);object-fit:contain}.preview-expanded .preview-close{position:absolute;top:16px;right:16px;color:white;background:#146f5c;border:0}
</style>
