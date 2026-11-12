<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({ attachment: { type: Object, required: true }, removable: Boolean, preview: Boolean })
defineEmits(['remove'])
let url = ''
const image = computed(() => /^image\/(png|jpeg|webp|gif)$/.test(props.attachment.type))
const type = computed(() => image.value ? 'mdi-image-outline' : props.attachment.type === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-document-outline')
const size = computed(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(props.attachment.blob.size / 1024) + ' KB')
function refresh() {
  if (url) URL.revokeObjectURL(url)
  url = URL.createObjectURL(props.attachment.blob)
  return url
}
const href = computed(() => { props.attachment.blob; return url })
watch(() => props.attachment.blob, refresh, { immediate: true })
onBeforeUnmount(() => { if (url) URL.revokeObjectURL(url) })
</script>

<template>
  <div class="aito-attachment" :class="{ 'aito-attachment--preview': image && preview }">
    <a class="aito-attachment__link" :href="href" :download="attachment.name" :aria-label="'Baixar ' + attachment.name">
      <img v-if="image" :src="href" alt="" loading="lazy" />
      <q-icon v-else :name="type" size="21px" />
      <span><strong>{{ attachment.name }}</strong><small>{{ preview ? 'Baixar · ' : '' }}{{ size }}</small></span>
    </a>
    <button v-if="removable" type="button" class="aito-attachment__remove" :aria-label="'Remover ' + attachment.name" @click="$emit('remove')"><q-icon name="mdi-close" size="17px" /></button>
  </div>
</template>

<style scoped>
.aito-attachment { display: inline-flex; min-width: 0; max-width: min(220px, 100%); align-items: center; padding: 4px; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-panel); }
.aito-attachment__link { min-width: 0; display: flex; align-items: center; gap: .55rem; padding: .2rem .35rem; color: var(--aito-ai-text); text-decoration: none; }
.aito-attachment__link > .q-icon, .aito-attachment__link img { display: block; flex: 0 0 auto; width: 32px; height: 32px; border-radius: 6px; color: var(--aito-ai-accent); object-fit: cover; }
.aito-attachment__link > span { min-width: 0; }
.aito-attachment__link strong, .aito-attachment__link small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .7rem; font-weight: 600; }
.aito-attachment__link small { color: var(--aito-ai-muted); font-weight: 400; }
.aito-attachment__remove { display: grid; min-width: 28px; height: 28px; place-items: center; margin-left: .1rem; border: 0; border-radius: 7px; color: var(--aito-ai-muted); background: transparent; cursor: pointer; }
.aito-attachment__remove:hover, .aito-attachment__link:hover { color: var(--aito-ai-text); background: #ffffff0a; }
.aito-attachment--preview { width: min(430px, 100%); max-width: 100%; }
.aito-attachment--preview .aito-attachment__link { display: grid; width: 100%; }
.aito-attachment--preview .aito-attachment__link img { width: 100%; height: auto; max-height: 440px; object-fit: contain; }
</style>
