<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  files: Object,
  fallbackPosition: String,
  animate: Boolean,
  type: String,
})
const missingCover = ref(false)
const playing = ref(false)
watch(() => props.files?.cover, () => { missingCover.value = false })
watch(() => [props.files?.motion, props.animate], () => { playing.value = false })
</script>

<template>
  <div class="aito-model-preview" :class="{ 'aito-model-preview--sprite': fallbackPosition && (!files || missingCover) }"
    :style="{ backgroundPosition: fallbackPosition }" aria-hidden="true">
    <q-icon v-if="!fallbackPosition && (!files || missingCover)"
      :name="type === 'workflow' ? 'mdi-movie-open-star-outline' : 'mdi-movie-open-play-outline'" size="36px" />
    <img v-if="files?.cover && !missingCover" :src="files.cover" alt="" width="384" height="216"
      loading="lazy" decoding="async" @error="missingCover = true">
    <video v-if="animate && files?.motion" :src="files.motion" :poster="files.cover"
      :class="{ 'aito-model-preview__playing': playing }"
      autoplay muted playsinline loop preload="none" disablepictureinpicture
      @playing="playing = true" @error="playing = false" />
    <span class="aito-model-preview__type" :class="{ 'aito-model-preview__type--image': type === 'image' }">
      <q-icon :name="type === 'image' ? 'mdi-image-outline' : 'mdi-play-box-outline'" size="15px" />
      {{ type === 'image' ? 'Imagem' : type === 'workflow' ? 'Fluxo' : 'Vídeo' }}
    </span>
  </div>
</template>

<style scoped>
.aito-model-preview { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; max-height: 150px; overflow: hidden; border-radius: 8px; color: var(--aito-ai-accent); background: radial-gradient(ellipse at center, #34404d, #171a20 76%); }
.aito-model-preview--sprite { background-color: var(--aito-ai-panel); background-image: url('/aitoia-model-posters.webp'); background-size: 200% 400%; }
.aito-model-preview :is(img, video) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.aito-model-preview video { opacity: 0; transition: opacity .18s ease; }
.aito-model-preview .aito-model-preview__playing { opacity: 1; }
.aito-model-preview__type { position: absolute; top: 8px; left: 8px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; background: #281d3aeb; color: #f7dff9; font-size: .69rem; font-weight: 700; }
.aito-model-preview__type--image { background: #082f25eb; color: #d7ffed; }
@media (prefers-reduced-motion: reduce) { .aito-model-preview video { display: none; } }
</style>
