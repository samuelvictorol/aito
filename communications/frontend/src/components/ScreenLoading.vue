<script setup>
import { computed } from 'vue'
import { useWhiteLabel } from '../services/whitelabel.js'

defineProps({ label: { type: String, default: 'Carregando tela' } })
const { branding, ready } = useWhiteLabel()
const hue = Math.random() * 360
const fallback = Array.from({ length: 15 }, (_, index) => `hsl(${Math.round((hue + index * 137.508) % 360)} 86% 74%)`)
const palette = computed(() => {
  if (!ready.value) return fallback
  const colors = [branding.primaryColor, branding.secondaryColor, branding.accentColor].filter(color => /^#[0-9a-f]{6}$/i.test(color || ''))
  return colors.length ? [...new Set(colors)] : fallback
})
// Jittered cells spread tiny stars across the whole viewport without dense clusters.
const stars = Array.from({ length: 240 }, (_, index) => ({
  x: ((index % 20) + .12 + Math.random() * .76) / 20 * 100,
  y: (Math.floor(index / 20) + .1 + Math.random() * .8) / 12 * 100,
  size: (.45 + Math.random() * .95).toFixed(2),
  opacity: (.6 + Math.random() * .4).toFixed(2),
  duration: (2.1 + Math.random() * 3.6).toFixed(2),
  delay: (-Math.random() * 8).toFixed(2),
}))
const theme = computed(() => ({ '--loading-accent': ready.value ? palette.value[0] : fallback[0], '--loading-glow': ready.value ? palette.value[palette.value.length - 1] : fallback[7] }))
const fallbackLogo = '/comunicacao/app/icons/aito-v2-180.png'
function logoFailed(event) {
  if (event.target.getAttribute('src') !== fallbackLogo) event.target.src = fallbackLogo
  else event.target.hidden = true
}
function starStyle(star, index) {
  return { left: `${star.x}%`, top: `${star.y}%`, '--star-size': `${star.size}px`, '--star-opacity': star.opacity, '--star-duration': `${star.duration}s`, '--star-delay': `${star.delay}s`, '--star-color': palette.value[index % palette.value.length] }
}
</script>

<template>
  <div class="spa-loading" :style="theme" role="status" aria-live="polite" aria-atomic="true" aria-busy="true" :aria-label="label">
    <div class="spa-loading__sky" aria-hidden="true"><i v-for="(star, index) in stars" :key="index" class="spa-loading__star" :style="starStyle(star, index)" /></div>
    <div class="spa-loading__content">
      <img class="spa-loading__logo" :src="branding.logoUrl || fallbackLogo" alt="" decoding="async" fetchpriority="high" @error="logoFailed" />
      <strong class="spa-loading__title">{{ branding.appName }}</strong>
    </div>
  </div>
</template>
