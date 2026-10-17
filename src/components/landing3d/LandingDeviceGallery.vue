<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  slides: { type: Array, default: () => [] },
  device: { type: String, default: 'laptop' },
  label: String,
  interval: { type: Number, default: 6500 },
  reducedMotion: Boolean,
})
const images = computed(() => props.slides.filter(item => item?.src).slice(0, 5))
const active = ref(0), open = ref(false), hovering = ref(false), focused = ref(false), visible = ref(false), pageVisible = ref(true), paused = ref(false), root = ref(null)
const selected = computed(() => images.value[active.value])
let timer, observer
const change = step => { active.value = (active.value + step + images.value.length) % Math.max(images.value.length, 1) }
function visibility() { pageVisible.value = !document.hidden }
watch(images, () => { active.value = 0 })
onMounted(() => {
  visibility()
  document.addEventListener('visibilitychange', visibility)
  observer = new IntersectionObserver(([entry]) => { visible.value = entry.isIntersecting })
  observer.observe(root.value)
  timer = setInterval(() => {
    if (images.value.length > 1 && visible.value && pageVisible.value && !hovering.value && !focused.value && !open.value && !paused.value && !props.reducedMotion) change(1)
  }, Math.max(props.interval, 4000))
})
onBeforeUnmount(() => { clearInterval(timer); observer?.disconnect(); document.removeEventListener('visibilitychange', visibility) })
</script>

<template>
  <figure ref="root" class="device-gallery" :class="`device-gallery--${device}`" :aria-label="label" @mouseenter="hovering = true" @mouseleave="hovering = false" @focusin="focused = true" @focusout="focused = !!root?.contains($event.relatedTarget)">
    <div class="device-gallery__body">
      <span class="device-gallery__camera" aria-hidden="true"></span>
      <button class="device-gallery__screen" type="button" :aria-label="`Ampliar: ${selected?.alt || label}`" :disabled="!selected" @click="open = true">
        <img v-for="(slide,index) in images" :key="slide.src" :src="slide.src" :alt="index === active ? slide.alt : ''" :aria-hidden="index !== active" :class="{ 'is-active': index === active }" loading="lazy" decoding="async" />
        <span v-if="!images.length" class="device-gallery__empty">Seu próximo projeto<br />ganha vida aqui.</span>
        <span class="device-gallery__zoom" aria-hidden="true"><q-icon name="mdi-magnify-plus-outline" /></span>
      </button>
      <span v-if="device === 'phone'" class="device-gallery__home" aria-hidden="true"></span>
    </div>
    <div v-if="device === 'laptop'" class="device-gallery__base" aria-hidden="true"></div>
    <figcaption><span>{{ label }}</span><div v-if="images.length > 1" class="device-gallery__controls">
      <button v-for="(slide,index) in images" :key="index" type="button" :class="{ 'is-current': index === active }" :aria-label="`Mostrar imagem ${index + 1}: ${slide.alt}`" :aria-pressed="index === active" @click="active = index"><span></span></button>
      <button type="button" :aria-label="paused ? 'Retomar imagens' : 'Pausar imagens'" :aria-pressed="paused" @click="paused = !paused"><q-icon :name="paused ? 'mdi-play' : 'mdi-pause'" /></button>
    </div></figcaption>
  </figure>
  <q-dialog v-model="open" maximized>
    <div class="gallery-viewer" :aria-label="label">
      <header><div><strong>{{ selected?.alt }}</strong><small>{{ active + 1 }} / {{ images.length }} · Tela ilustrativa</small></div><q-btn flat round icon="mdi-close" aria-label="Fechar imagem ampliada" v-close-popup /></header>
      <div class="gallery-viewer__image"><img :src="selected?.fullSrc || selected?.src" :alt="selected?.alt" /></div>
      <footer v-if="images.length > 1"><q-btn flat no-caps icon="mdi-chevron-left" label="Anterior" @click="change(-1)" /><q-btn flat no-caps label="Próxima" icon-right="mdi-chevron-right" @click="change(1)" /></footer>
    </div>
  </q-dialog>
</template>

<style scoped>
.device-gallery{margin:0;width:100%;min-width:0}.device-gallery__body{position:relative;padding:16px 12px 20px;border:1px solid #58726b;border-radius:18px 18px 4px 4px;background:linear-gradient(145deg,#2f4843,#0b1417);box-shadow:0 25px 70px #0008}.device-gallery__camera{position:absolute;top:6px;left:50%;width:4px;height:4px;border-radius:50%;background:#718e83}.device-gallery__screen{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;padding:0;border:0;border-radius:5px;background:#061b20;cursor:zoom-in}.device-gallery__screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 900ms ease}.device-gallery__screen img.is-active{opacity:1}.device-gallery__zoom{position:absolute;right:10px;bottom:10px;display:grid;place-items:center;width:32px;height:32px;border:1px solid #75c4ad;border-radius:50%;background:#082b2ee8;color:#bffff0;font-size:21px}.device-gallery__base{position:relative;height:17px;margin:0 -3%;border-radius:0 0 50% 50%;background:linear-gradient(#8ba399,#273d37);box-shadow:0 10px 25px #0009}.device-gallery__base::before{content:'';position:absolute;top:0;left:40%;width:20%;height:5px;border-radius:0 0 8px 8px;background:#1e3330}.device-gallery figcaption{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;color:#a9cfc3;font-size:12px}.device-gallery__controls{display:flex;align-items:center}.device-gallery__controls button{display:grid;place-items:center;width:30px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:#92cfbd;cursor:pointer}.device-gallery__controls button span{width:6px;height:6px;border-radius:50%;background:#3b6259}.device-gallery__controls button.is-current span{background:#89f2d3;box-shadow:0 0 10px #4ce5bd80}.device-gallery button:focus-visible{outline:2px solid #8fffee;outline-offset:3px}.device-gallery--phone{width:240px;max-width:100%}.device-gallery--phone .device-gallery__body{padding:9px 7px 15px;border-radius:35px;border-width:2px}.device-gallery--phone .device-gallery__screen{aspect-ratio:720/1360;border-radius:25px}.device-gallery--phone .device-gallery__camera{top:9px;left:35%;width:30%;height:9px;border-radius:0 0 9px 9px;z-index:2;background:#0b1719}.device-gallery__home{position:absolute;bottom:6px;left:35%;width:30%;height:3px;border-radius:4px;background:#829f94}.device-gallery--phone figcaption{flex-direction:column;gap:5px;margin-top:12px}.device-gallery__empty{display:grid;place-content:center;height:100%;color:#8de3c9;font:600 22px/1.4 sans-serif}.gallery-viewer{display:flex;flex-direction:column;width:100%;height:100dvh;background:#041317;color:#e7fff6}.gallery-viewer header{display:flex;align-items:center;gap:15px;padding:16px 20px;border-bottom:1px solid #2a4e45}.gallery-viewer header>div{flex:1}.gallery-viewer strong,.gallery-viewer small{display:block}.gallery-viewer small{margin-top:5px;color:#88b5a6;font-size:11px}.gallery-viewer__image{display:flex;align-items:center;justify-content:center;flex:1;min-height:0;padding:20px}.gallery-viewer__image img{max-width:100%;max-height:100%;object-fit:contain}.gallery-viewer footer{display:flex;justify-content:center;gap:24px;padding:12px}@media(max-width:767px){.device-gallery__body{padding:12px 7px 13px;border-radius:12px 12px 3px 3px}.device-gallery__base{height:12px}.device-gallery--phone{width:200px}.device-gallery--phone .device-gallery__body{padding:8px 6px 14px;border-radius:30px}.device-gallery figcaption{font-size:11px}.gallery-viewer header{padding:12px}.gallery-viewer strong{font-size:13px}}@media(prefers-reduced-motion:reduce){.device-gallery__screen img{transition:none}}
</style>
