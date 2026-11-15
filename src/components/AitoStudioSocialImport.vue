<script setup>
import { computed, ref } from 'vue'

const open = ref(false)
const value = ref('')
const source = computed(() => {
  try {
    const url = new URL(value.value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (['instagram.com', 'www.instagram.com'].includes(url.hostname)) {
      const post = url.pathname.match(/^\/(reel|reels|p|tv)\/([\w-]+)\/?$/)
      if (post) return { name: 'Instagram', href: `https://www.instagram.com/${post[1]}/${post[2]}/` }
    }
    if (['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(url.hostname)) {
      const post = url.pathname.match(/^\/@([\w.-]+)\/video\/(\d+)\/?$/)
      if (post) return { name: 'TikTok', href: `https://www.tiktok.com/@${post[1]}/video/${post[2]}` }
      if (/^\/t\/[\w-]+\/?$/.test(url.pathname)) return { name: 'TikTok', href: url.origin + url.pathname }
    }
    if (['vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname) && /^\/[\w-]+\/?$/.test(url.pathname)) {
      return { name: 'TikTok', href: url.origin + url.pathname }
    }
  } catch { /* Wait for a full shared link. */ }
  return null
})
</script>

<template>
  <q-btn outline no-caps icon="mdi-link-variant" label="Trazer vídeo de rede social" @click="open = true" />
  <q-dialog v-model="open">
    <q-card dark class="social-import">
      <q-card-section>
        <h2>Trazer vídeo de rede social</h2>
        <p>Abra o vídeo original e use a opção de baixar do Instagram ou TikTok, quando disponível. Depois, use “Importar vídeo” na montagem.</p>
        <q-input v-model="value" dark outlined type="url" label="Link do Instagram ou TikTok" :error="!!value.trim() && !source" error-message="Cole um link HTTPS de um vídeo." />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Fechar" v-close-popup />
        <q-btn v-if="source" unelevated no-caps color="teal" text-color="white" icon="mdi-open-in-new" :label="`Abrir no ${source.name}`" :href="source.href" target="_blank" rel="noopener noreferrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.social-import { width: min(440px, 100%); border: 1px solid #476b73; border-radius: 14px; background: #102229; }
.social-import h2 { margin: 0 0 10px; font-size: 1.15rem; font-weight: 740; line-height: 1.2; }
.social-import p { color: #c3d5dc; }
</style>
