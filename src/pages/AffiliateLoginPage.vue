<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthDialog from 'components/AuthDialog.vue'
const open=ref(true),router=useRouter()
</script>
<template><main class="affiliate-login"><img src="/aito-logo-restored.png" alt="AitoSoftwares"/><span>PROGRAMA DE AFILIADOS</span><h1>Seu resultado.<br/>Seu próximo passo.</h1><p>Acompanhe vendas do kit AitoNotify + WhatsApp BotBuilder, cupons e comissões.</p><q-btn unelevated color="teal-8" no-caps icon="mdi-email-lock-outline" label="Entrar com e-mail" @click="open=true"/><router-link to="/whatsapp-solucoes">Conheça o kit</router-link><AuthDialog v-model="open" audience="affiliate" @authenticated="router.push('/affiliate')"/></main></template>
<style scoped>.affiliate-login{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;padding:30px;background:radial-gradient(ellipse at top,#d9f8eb,#f6fcf8);color:#164632}.affiliate-login>img{width:70px;height:70px;object-fit:contain}.affiliate-login h1{font-size:clamp(34px,7vw,60px);font-weight:800;line-height:1.1;margin:8px 0}.affiliate-login>span{font-size:10px;letter-spacing:.15em;color:#2f8b67}.affiliate-login>p{max-width:400px;color:#658978;line-height:1.8}.affiliate-login>a{color:#22795a;font-size:12px}</style>
