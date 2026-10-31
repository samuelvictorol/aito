<script setup>
defineProps({ backdrop: Boolean })
const colors = ['#14bc9d', '#8fffee', '#4d997b', '#cee9ad']
// Independent samples avoid diagonal bands while preserving a stable sky.
let seed = 0x41a7c93d
function random() {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return (seed >>> 0) / 4294967296
}
const stars = Array.from({ length: 210 }, () => {
  const size = .55 + random() * 1.05
  const color = colors[Math.floor(random() * colors.length)]
  return {
    left: `${random() * 100}%`, top: `${random() * 100}%`,
    width: `${size}px`, height: `${size}px`, background: color, color,
    '--star-dim': .06 + random() * .13,
    '--star-bright': .3 + random() * .53,
    animationDelay: `${-random() * 12}s`,
    animationDuration: `${3.2 + random() * 5.8}s`,
  }
})
</script>
<template>
  <div :class="['cosmic-scene', { 'cosmic-scene--backdrop': backdrop }]" :role="backdrop ? undefined : 'status'" :aria-label="backdrop ? undefined : 'Carregando'" :aria-hidden="backdrop || undefined">
    <i v-for="(star, index) in stars" :key="index" :style="star" />
    <img src="/aito-logo-restored.png" alt="" fetchpriority="high" />
  </div>
</template>
<style scoped>
.cosmic-scene{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#10231b55,transparent 65%),#030505}
.cosmic-scene i{position:absolute;border-radius:50%;box-shadow:0 0 5px 1px currentColor;animation:cosmic-shine 5s ease-in-out infinite;opacity:var(--star-dim)}
.cosmic-scene img{width:86px;height:86px;object-fit:contain;filter:drop-shadow(0 0 25px #12bc9d66);animation:cosmic-logo 4s ease-in-out infinite}
.cosmic-scene--backdrop{z-index:0;pointer-events:none}
.cosmic-scene--backdrop img{position:absolute;width:260px;height:260px;opacity:.035;right:7%;bottom:7%;animation:none}
@keyframes cosmic-shine{0%,100%{opacity:var(--star-dim);transform:scale(.8)}45%{opacity:var(--star-bright);transform:scale(1.15)}70%{opacity:var(--star-dim)}}
@keyframes cosmic-logo{50%{filter:drop-shadow(0 0 40px #12bc9d99);transform:scale(1.04)}}
@media(prefers-reduced-motion:reduce){.cosmic-scene i,.cosmic-scene img{animation:none}.cosmic-scene i{opacity:.3}}
</style>
