<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { licenseValidity, validityCountdown } from 'src/services/license-validity'
const props=defineProps({license:{type:Object,required:true},compact:Boolean})
const now=ref(Date.now()), state=computed(()=>licenseValidity(props.license,now.value))
let timer
onMounted(()=>{timer=setInterval(()=>{now.value=Date.now()},1000)})
onBeforeUnmount(()=>clearInterval(timer))
const date=computed(()=>Number.isFinite(state.value.expiry)&&state.value.expiry!==null?new Date(state.value.expiry).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'')
</script>
<template><div class="license-validity" :class="{'license-validity--compact':compact}"><q-badge :color="state.status==='active'?'teal-7':state.status==='expired'?'orange-9':'red-8'" :label="state.label"/><div><strong>{{state.permanent?'Licença permanente':state.status==='expired'?'Prazo encerrado':'Licença por prazo'}}</strong><small v-if="!state.permanent">{{state.status==='expired'?'Expirou em':'Válida até'}} {{date || 'data não definida'}}</small><code v-if="!state.permanent&&state.status==='active'">{{validityCountdown(state.remainingSeconds)}} restantes</code></div></div></template>
<style scoped>.license-validity{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #427565;border-radius:11px;background:#183f346b;color:#d7f7e9}.license-validity>.q-badge{margin-top:3px;flex:none}.license-validity strong{display:block;font-size:12px;line-height:1.5}.license-validity small{display:block;font-size:10px;line-height:1.7;color:#b8d9ca}.license-validity code{display:block;font-size:12px;line-height:1.8;color:#a4f4d7;font-variant-numeric:tabular-nums}.license-validity--compact{padding:8px;gap:7px}.license-validity--compact strong{font-size:10px}.license-validity--compact small{font-size:9px}.license-validity--compact code{font-size:10px}</style>
