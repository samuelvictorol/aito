<script setup>
import { computed } from 'vue'
import { useProductLicense } from '../services/product-license.js'
const { state, remaining } = useProductLicense()
const countdown = computed(() => { const seconds=Math.ceil(remaining.value||0),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}min ${String(seconds%60).padStart(2,'0')}s` })
</script>
<template><q-card flat bordered class="q-mb-md"><q-card-section class="row items-center q-gutter-md"><q-icon :name="state.permanent?'verified':'hourglass_bottom'" color="primary" size="30px"/><div class="col"><strong>Licença desta instalação</strong><div>{{state.loading?'Verificando…':state.permanent?'Permanente · sem data de expiração':countdown}}</div><small v-if="!state.permanent&&state.expiresAt">Expira em {{new Date(state.expiresAt).toLocaleString('pt-BR')}}</small></div><q-badge :color="state.active?'positive':'negative'">{{state.active?'Ativa':'Aguardando validação'}}</q-badge></q-card-section></q-card></template>
