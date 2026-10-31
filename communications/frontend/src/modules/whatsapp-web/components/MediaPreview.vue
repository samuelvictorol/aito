<script setup>
import { vAuthSrc, vAuthHref } from '../authenticated-media.js'
import { computed, ref } from 'vue'
const props = defineProps({ asset: Object, document: Boolean })
const expanded = ref(false)
const kind = computed(() => props.asset?.kind || props.asset?.mimeType?.split('/')[0])
</script>
<template>
  <div class="media-preview nodrag nowheel">
    <span v-if="!asset" class="missing">Arquivo indisponível</span>
    <a v-else-if="document" v-auth-href="asset.url" target="_blank" rel="noopener">▧ {{ asset.name || asset.filename }}</a>
    <template v-else-if="kind === 'image' || kind === 'sticker'"><img v-auth-src="asset.url" :alt="asset.name" loading="lazy"><button type="button" @click="expanded = true">Ampliar imagem</button></template>
    <template v-else-if="kind === 'video'"><video v-auth-src="asset.url" controls preload="metadata"></video><button type="button" @click="expanded = true">Ampliar vídeo</button></template>
    <audio v-else-if="kind === 'audio'" v-auth-src="asset.url" controls preload="metadata"></audio>
    <a v-else v-auth-href="asset.url" target="_blank" rel="noopener">▧ {{ asset.name || asset.filename }}</a>
    <Teleport to="body"><div v-if="expanded" class="media-overlay" role="dialog" aria-modal="true" aria-label="Visualizar mídia" @click.self="expanded = false" @keydown.esc.stop="expanded = false"><section><button type="button" autofocus aria-label="Fechar mídia ampliada" @click="expanded = false">× Fechar</button><img v-if="kind === 'image' || kind === 'sticker'" v-auth-src="asset.url" :alt="asset.name"><video v-else v-auth-src="asset.url" controls preload="metadata"></video></section></div></Teleport>
  </div>
</template>
<style scoped>
.media-preview{min-width:0;max-width:100%;overflow:hidden}.media-preview img,.media-preview video{display:block;width:100%;max-height:160px;object-fit:contain;border-radius:6px}.media-preview audio{display:block;width:100%;min-width:0;height:38px}.media-preview a,.missing{display:block;padding:10px;font-size:12px;overflow-wrap:anywhere}.missing{color:#a22d43}.media-preview button{border:1px solid #80aa9c;background:#e9f9f3;color:#164537;border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11px}.media-overlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;background:#030c0eea;padding:20px}.media-overlay section{display:grid;gap:12px;max-width:100%;max-height:94dvh}.media-overlay section>button{justify-self:end;color:#effffb;background:#173c38;border:1px solid #74988c;border-radius:8px;padding:9px 14px}.media-overlay img,.media-overlay video{max-width:94vw;max-height:82dvh;object-fit:contain}
</style>
