<script setup>
import { computed } from 'vue'
import { useProductLicense } from '../services/product-license.js'
import { inPrototype } from '../services/prototype-runtime.js'
const demo = inPrototype()
const { state, remaining } = useProductLicense()
const countdown = computed(() => { const seconds=Math.ceil(remaining.value||0),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}min ${String(seconds%60).padStart(2,'0')}s` })
</script>
<template><q-card flat bordered class="q-mb-md"><q-card-section class="row items-center q-gutter-md"><q-icon :name="demo?'science':state.permanent?'verified':'hourglass_bottom'" color="primary" size="30px"/><div class="col"><strong>Licença desta instalação</strong><div>{{demo?'Licença fictícia · nenhuma chave real é validada nesta vitrine':state.loading?'Verificando…':state.permanent?'Permanente · sem data de expiração':countdown}}</div><small v-if="!demo&&!state.permanent&&state.expiresAt">Expira em {{new Date(state.expiresAt).toLocaleString('pt-BR')}}</small></div><q-badge :color="demo?'primary':state.active?'positive':'negative'">{{demo?'Demonstração':state.active?'Ativa':'Aguardando validação'}}</q-badge></q-card-section></q-card></template>
