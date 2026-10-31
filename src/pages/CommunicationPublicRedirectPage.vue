<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
const route=useRoute()
onMounted(()=>{ window.location.replace('/comunicacao/app' + route.fullPath) })
</script>
<template><main class="public-communication-redirect"><q-spinner color="teal" size="36px"/><span>Abrindo a página de comunicação…</span></main></template>
<style scoped>.public-communication-redirect{min-height:100dvh;display:flex;align-items:center;justify-content:center;gap:15px;background:#effaf5;color:#175440;font-size:13px}</style>
