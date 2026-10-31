<script setup>
import { useProductLicense } from '../services/product-license.js'
const { state, refresh } = useProductLicense()
</script>
<template>
  <div class="product-license-gate" role="alertdialog" aria-modal="true" aria-labelledby="license-title">
    <section><q-icon :name="state.loading?'verified_user':'lock_clock'" size="44px" color="primary"/><h1 id="license-title">{{state.loading?'Validando seu acesso':state.reason==='expired'?'Sua licença expirou':'Acesso temporariamente bloqueado'}}</h1><p>{{state.message || 'Regularize sua licença com o administrador ou na AitoSoftwares para continuar.'}}</p><p class="license-recovery">Seus dados e a sessão são preservados. O painel será liberado automaticamente assim que a chave estiver válida.</p><q-linear-progress v-if="state.loading" indeterminate color="primary"/><div v-else><q-btn color="primary" no-caps unelevated label="Verificar novamente" @click="refresh()"/><q-btn flat color="primary" no-caps label="Gerenciar minha licença" href="https://aitosoftwares.com/app" target="_blank" rel="noopener noreferrer"/></div></section>
  </div>
</template>
<style scoped>
.product-license-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,var(--q-primary,#137d6c) 10%,#f7faf9);backdrop-filter:blur(14px)}.product-license-gate section{width:min(100%,560px);padding:32px;border:1px solid #d3e8e0;border-radius:24px;background:#fff;box-shadow:0 20px 80px #06362e18;text-align:center}.product-license-gate h1{font-size:1.6rem;line-height:1.3;font-weight:750}.product-license-gate p{color:#39594f;line-height:1.7}.license-recovery{font-size:.85rem}.product-license-gate section>div{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
</style>
