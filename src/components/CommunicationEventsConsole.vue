<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
const frame=ref(null),error=ref('')
async function receive(event){
  if(event.origin!==location.origin||event.source!==frame.value?.contentWindow||event.data?.type!=='aito.communication.ready'||!/^[a-f\d-]{36}$/i.test(event.data.requestId||''))return
  try{const response=await fetch('/comunicacao/session',{method:'POST',credentials:'include',headers:{Authorization:'Bearer '+(localStorage.getItem('aito_admin_token')||''),'Content-Type':'application/json'},body:'{}'});const value=await response.json();if(!response.ok)throw Error(value.message||'Não foi possível abrir os eventos.');event.source.postMessage({type:'aito.communication.session',requestId:event.data.requestId,data:value.data||value},location.origin)}catch(cause){error.value=cause.message}
}
onMounted(()=>window.addEventListener('message',receive));onBeforeUnmount(()=>window.removeEventListener('message',receive))
</script>
<template><section class="communication-events"><p v-if="error" role="alert">{{error}}</p><iframe ref="frame" src="/comunicacao/app/system-events" title="Console de eventos do Sistema" referrerpolicy="same-origin"/></section></template>
<style scoped>.communication-events{margin-top:24px;border-radius:18px;overflow:hidden;border:1px solid #3a6655}.communication-events iframe{width:100%;height:650px;max-height:80dvh;display:block;border:0;background:#f6fcf8}.communication-events p{padding:15px;color:#f6c7b9}</style>
