<script setup>
import { ref, watch } from 'vue'
import { vAuthSrc } from '../authenticated-media.js'

const props = defineProps({ url: { type: String, required: true }, sticker: Boolean })
const failed = ref(false)
watch(() => props.url, () => { failed.value = false })
</script>

<template>
  <img v-if="!failed" v-auth-src="url" :alt="sticker ? 'Figurinha do WhatsApp' : 'Foto do WhatsApp'" class="chat-image" :class="{ 'chat-sticker': sticker }" @error="failed = true">
  <div v-else class="image-error">
    <span>{{ sticker ? 'Figurinha indisponível' : 'Foto indisponível' }}</span>
    <button type="button" @click="failed = false">Tentar novamente</button>
  </div>
</template>

<style scoped>
.chat-image { display: block; max-width: 100%; max-height: 430px; border-radius: 8px; }
.image-error { display: grid; gap: 4px; color: #36564f; font-size: .875rem; }
.image-error button { justify-self: start; padding: 0; border: 0; background: transparent; color: #166446; font: inherit; text-decoration: underline; cursor: pointer; }
@media (max-width: 600px) { .chat-image { max-height: 340px; } }
.chat-sticker { max-width: min(160px, 100%); max-height: 160px; object-fit: contain; background: transparent; }
</style>
