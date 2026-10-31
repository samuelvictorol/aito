<script setup>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
const props=defineProps({modelValue:{type:String,default:''},dark:Boolean})
const emit=defineEmits(['update:modelValue']),code=ref(props.modelValue),quote=ref(null),error=ref(''),busy=ref(false)
const money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
function edited(){quote.value=null;sessionStorage.removeItem('aito.kit.coupon');emit('update:modelValue','')}
async function apply(){busy.value=true;error.value='';quote.value=null;try{const r=(await api.post('/products/aitonotify/coupon',{couponCode:code.value})).data.data;quote.value=r;code.value=r.couponCode;emit('update:modelValue',r.couponCode);sessionStorage.setItem('aito.kit.coupon',r.couponCode)}catch(e){emit('update:modelValue','');sessionStorage.removeItem('aito.kit.coupon');error.value=e.response?.data?.message||'Cupom indisponível.'}finally{busy.value=false}}
onMounted(()=>{code.value=new URLSearchParams(window.location.search).get('cupom')||props.modelValue||sessionStorage.getItem('aito.kit.coupon')||'';if(code.value)apply()})
</script>
<template><div class="kit-coupon" :class="{'kit-coupon--dark':dark}"><div class="kit-coupon-field"><q-input v-model.trim="code" outlined dense :dark="dark" maxlength="30" label="Tem um cupom?" :disable="busy" @update:model-value="edited" @keyup.enter.prevent="apply"/><q-btn outline no-caps :color="dark?'teal-3':'teal-8'" label="Aplicar" :loading="busy" @click="apply"/></div><p v-if="quote?.couponCode" role="status"><q-icon name="mdi-check-circle"/> {{quote.couponCode}} · Economize {{money(quote.discountCents)}}<strong>Total: {{money(quote.amountCents)}}</strong></p><p v-if="error" class="text-negative" role="alert">{{error}}</p><small v-if="quote?.couponCode">O preço e a disponibilidade são conferidos novamente ao criar o checkout.</small></div></template>
<style scoped>.kit-coupon{margin:17px 0;color:#286b4b}.kit-coupon-field{display:flex;gap:10px}.kit-coupon-field>.q-field{flex:1;min-width:0}.kit-coupon p{font-size:12px!important;line-height:1.8!important;margin:10px 0!important;color:inherit!important}.kit-coupon strong{display:block}.kit-coupon small{font-size:10px;opacity:.7}.kit-coupon--dark{color:#a2e9cd}.kit-coupon--dark :deep(.q-field__native){color:#e6fff3}.kit-coupon--dark :deep(.q-field__control){background:#153e32}</style>
