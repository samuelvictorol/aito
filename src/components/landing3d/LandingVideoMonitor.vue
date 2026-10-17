<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { landingHeroVideo } from 'src/data/landingHeroVideo'

const props = defineProps({
  video: { type: Object, default: () => landingHeroVideo },
  title: { type: String, default: 'Conheça a AitoSoftwares' },
  eyebrow: { type: String, default: 'AITOSOFTWARES EM MOVIMENTO' },
  headline: { type: String, default: 'Seu próximo passo\ncomeça com uma ideia.' },
  description: { type: String, default: 'Software, IA e automação para o seu negócio.' },
})
const screen = ref(null)
const visible = ref(false)
const playing = ref(false)
let observer
const source = computed(() => String(props.video?.src || '').trim())
const embed = computed(() => {
  try {
    const url = new URL(source.value)
    if (url.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`
    if (['www.youtube.com', 'youtube.com'].includes(url.hostname)) {
      const id = url.searchParams.get('v') || url.pathname.split('/').pop()
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : ''
    }
  } catch { /* Local video files use the native player. */ }
  return ''
})
onMounted(() => {
  if (!window.IntersectionObserver) { visible.value = true; return }
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { visible.value = true; observer.disconnect() }
  }, { rootMargin: '120px' })
  observer.observe(screen.value)
})
watch(source, () => { playing.value = false })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <figure class="video-monitor" :aria-label="title">
    <div ref="screen" class="video-monitor__frame">
      <div class="video-monitor__camera" aria-hidden="true"></div>
      <div class="video-monitor__screen">
        <iframe v-if="visible && embed && playing" :src="embed" :title="title" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>
        <video v-else-if="visible && source && !embed" :src="source" :poster="video.poster || undefined" controls playsinline preload="none" :aria-label="title"></video>
        <button v-else-if="embed" class="video-monitor__placeholder" type="button" @click="playing = true">
          <q-icon name="mdi-play-circle-outline" size="52px" />
          <strong>{{ title }}</strong><span>Assista à apresentação</span>
        </button>
        <div v-else class="video-monitor__placeholder">
          <img src="/aito-logo-restored.png" alt="" width="76" height="76" />
          <span class="video-monitor__eyebrow">{{ eyebrow }}</span>
          <strong class="video-monitor__headline">{{ headline }}</strong>
          <span>{{ description }}</span>
        </div>
      </div>
      <div class="video-monitor__chin"><span>AITO</span><i></i></div>
    </div>
    <div class="video-monitor__stand" aria-hidden="true"></div>
    <div class="video-monitor__base" aria-hidden="true"></div>
  </figure>
</template>

<style scoped>
.video-monitor{width:100%;margin:0;filter:drop-shadow(0 25px 45px #0009)}.video-monitor__frame{padding:9px 9px 0;border:1px solid #4f6d69;border-radius:17px;background:linear-gradient(145deg,#243e3b,#0d1719 65%);box-shadow:inset 0 1px #ffffff30,0 0 70px #0ab39316}.video-monitor__camera{width:4px;height:4px;margin:0 auto 7px;border-radius:50%;background:#49685f}.video-monitor__screen{aspect-ratio:16/10;overflow:hidden;border:1px solid #000;border-radius:5px;background:#041817}.video-monitor__screen iframe,.video-monitor__screen video{width:100%;height:100%;border:0;object-fit:contain}.video-monitor__placeholder{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;width:100%;height:100%;padding:20px;color:#ddfff6;background:radial-gradient(ellipse at 50% 20%,#176c583f,transparent 65%),linear-gradient(140deg,#091f22,#020d12);text-align:center;border:0;font:inherit}.video-monitor__placeholder img{object-fit:contain}.video-monitor__placeholder strong{font-size:clamp(1.1rem,2vw,1.85rem);line-height:1.3;font-weight:600}.video-monitor__headline{white-space:pre-line}.video-monitor__placeholder span{font-size:.65rem;color:#a5c7bf}.video-monitor__placeholder .video-monitor__eyebrow{font-size:.5rem;letter-spacing:.16em;color:#71d9bd}.video-monitor__placeholder:is(button){cursor:pointer}.video-monitor__chin{height:28px;display:flex;align-items:center;justify-content:center;position:relative;font-size:8px;letter-spacing:.2em;color:#a1b9b2}.video-monitor__chin i{position:absolute;right:10px;width:3px;height:3px;border-radius:50%;background:#78e8c5}.video-monitor__stand{width:17%;height:45px;margin:auto;background:linear-gradient(90deg,#142a2b,#39504b,#142a2b);clip-path:polygon(16% 0,84% 0,100% 100%,0 100%)}.video-monitor__base{width:42%;height:9px;margin:auto;border-radius:50% 50% 4px 4px;background:linear-gradient(#526b63,#182b2b)}@media(max-width:767px){.video-monitor{margin-top:0}.video-monitor__placeholder{gap:10px}.video-monitor__placeholder img{width:52px;height:52px}.video-monitor__stand{height:30px}}
</style>
