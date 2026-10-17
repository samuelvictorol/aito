<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ name: String, alt: String, portrait: Boolean, eager: Boolean, sizes: { type: String, default: '(max-width: 700px) 90vw, 600px' } })
const open = ref(false), original = ref(false), usePng = ref(false), failed = ref(false)
const widths = computed(() => props.portrait ? [420, 720] : [840, 1440])
const revision = '20261017-2'
const asset = (width, format) => `/product-demo/${props.name}-${width}.${format}?v=${revision}`
const src = computed(() => asset(widths.value[1], usePng.value ? 'png' : 'webp'))
const srcset = computed(() => widths.value.map(width => `${asset(width, usePng.value ? 'png' : 'webp')} ${width}w`).join(', '))
const fullSize = computed(() => asset(widths.value[1], 'png'))
function recoverImage() {
  if (usePng.value) failed.value = true
  else usePng.value = true
}
watch(() => props.name, () => { usePng.value = false; failed.value = false })
watch(open, () => { original.value = false })
</script>

<template>
  <button type="button" class="demo-image" :aria-label="`Ampliar: ${alt}`" @click="open = true">
    <img v-if="!failed" :src="src" :srcset="srcset" :sizes="sizes" :alt="alt" :loading="eager ? 'eager' : 'lazy'" :fetchpriority="eager ? 'high' : 'auto'" decoding="async" :width="portrait ? 720 : 1440" :height="portrait ? 1360 : 900" @error="recoverImage" />
    <span v-else class="demo-image__unavailable">{{ alt }}<small>Toque para abrir a versão PNG.</small></span>
    <span class="demo-image__zoom" aria-hidden="true"><q-icon name="mdi-magnify-plus-outline" /></span>
  </button>
  <q-dialog v-model="open" maximized>
    <section class="demo-viewer">
      <header><div><strong>{{ alt }}</strong><small>Demonstração ilustrativa com dados fictícios</small></div><q-btn flat no-caps :label="original ? 'Ajustar à tela' : 'Tamanho original'" @click="original = !original" /><q-btn flat round icon="mdi-close" aria-label="Fechar imagem" v-close-popup /></header>
      <div class="demo-viewer__content" :class="{ 'is-original': original }"><img :src="fullSize" :alt="alt" /></div>
    </section>
  </q-dialog>
</template>

<style scoped>
.demo-image{display:block;position:relative;width:100%;height:100%;padding:0;overflow:hidden;border:0;background:#f0f5f3;cursor:zoom-in}.demo-image img{display:block;width:100%;height:100%;object-fit:contain}.demo-image__unavailable{display:grid;place-content:center;height:100%;gap:12px;padding:18px;color:#164a40;text-align:center;font-size:14px}.demo-image__unavailable small{font-size:11px}.demo-image__zoom{position:absolute;bottom:8px;right:8px;display:grid;place-items:center;width:30px;height:30px;border:1px solid #84c6b3;border-radius:50%;background:#062d2be8;color:#defff5;font-size:20px}.demo-image:focus-visible{outline:3px solid #45dbc0;outline-offset:-3px}.demo-viewer{display:flex;flex-direction:column;height:100dvh;color:#e9fff8;background:#061c20}.demo-viewer header{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #315c51}.demo-viewer header>div{flex:1;min-width:0}.demo-viewer strong,.demo-viewer small{display:block;overflow-wrap:anywhere}.demo-viewer strong{font-size:14px}.demo-viewer small{margin-top:4px;color:#9cbfb2;font-size:11px}.demo-viewer__content{display:flex;flex:1;min-height:0;overflow:auto;align-items:center;justify-content:center;padding:16px}.demo-viewer__content img{display:block;max-width:100%;max-height:100%;object-fit:contain}.demo-viewer__content.is-original{display:block}.demo-viewer__content.is-original img{max-width:none;max-height:none;width:auto;height:auto}@media(max-width:600px){.demo-viewer header{flex-wrap:wrap;padding:10px}.demo-viewer header>div{flex-basis:70%}.demo-viewer header .q-btn{font-size:11px}}
</style>
