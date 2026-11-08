<script setup>
import {computed} from 'vue'
import {useRoute} from 'vue-router'
const route=useRoute()
const src=computed(()=>{const slug=String(route.params.slug||''),section=Array.isArray(route.params.section)?route.params.section.join('/'):String(route.params.section||'meu-perfil');if(!/^[a-f0-9-]{36}$/i.test(slug)||! /^(?:invite\/[a-zA-Z0-9_-]+|notificacao\/[a-zA-Z0-9_-]+|meu-perfil|whatsapp-web\/catalogo\/[a-zA-Z0-9_-]+)\/?$/.test(section))return '';const params=new URLSearchParams(route.query);params.set('desktop',slug);return '/comunicacao/app/'+section+'?'+params.toString()+route.hash})
</script>
<template><main class="desktop-public"><iframe v-if="src" :src="src" title="Portal público da instalação" referrerpolicy="no-referrer"/><p v-else>Página pública não encontrada.</p></main></template>
<style scoped>.desktop-public{width:100%;height:100dvh;background:#f4fbf9}.desktop-public iframe{width:100%;height:100%;border:0;display:block}</style>
