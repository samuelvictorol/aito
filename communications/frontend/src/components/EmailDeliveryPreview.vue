<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import DOMPurify from 'dompurify'
import { http, unwrap, errorMessage } from '../services/http.js'

const dialog = ref(false), content = ref(null), loading = ref(false), error = ref(''), mode = ref('html')
let controller, version = 0
const html = computed(() => {
  if (!content.value?.html) return ''
  const clean = DOMPurify.sanitize(content.value.html, { FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base'], FORBID_ATTR: ['srcset'] })
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0;padding:16px;font:15px/1.6 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}img,table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${clean}</body></html>`
})
async function open(path) {
  controller?.abort(); controller = new AbortController(); const current = ++version
  dialog.value = true; content.value = null; loading.value = true; error.value = ''; mode.value = 'html'
  try { const value = unwrap(await http.get(path, { signal: controller.signal })); if (current === version) { content.value = value; if (!value.html) mode.value = 'text' } }
  catch (cause) { if (current === version && cause.code !== 'ERR_CANCELED') error.value = errorMessage(cause, 'O conteúdo deste e-mail não está disponível no histórico.') }
  finally { if (current === version) loading.value = false }
}
function close() { controller?.abort(); version++; content.value = null }
onBeforeUnmount(close)
defineExpose({ openLog: id => open('/email/logs/' + encodeURIComponent(id) + '/content'), openDelivery: (notification, delivery) => open('/notifications/' + encodeURIComponent(notification) + '/deliveries/' + encodeURIComponent(delivery) + '/content') })
</script>

<template>
  <q-dialog v-model="dialog" :maximized="$q.screen.lt.md" @hide="close">
    <q-card class="email-delivery-preview">
      <q-card-section class="email-delivery-preview-header">
        <div><div class="text-overline text-primary">Histórico do e-mail</div><h2>{{content?.subject || 'Conteúdo da entrega'}}</h2><small v-if="content?.sentAt">{{new Date(content.sentAt).toLocaleString('pt-BR')}}</small></div>
        <q-btn flat round icon="close" v-close-popup aria-label="Fechar prévia do e-mail"/>
      </q-card-section>
      <q-separator/>
      <q-card-section v-if="loading" class="text-center q-pa-xl"><q-spinner color="primary" size="32px"/><p>Carregando o conteúdo registrado…</p></q-card-section>
      <q-banner v-else-if="error" class="bg-orange-1 q-ma-md">{{error}}</q-banner>
      <template v-else-if="content">
        <div class="email-delivery-preview-tools"><q-badge :color="content.exactSentContent?'positive':'grey-7'">{{content.exactSentContent?'Conteúdo enviado':'Registro histórico em texto'}}</q-badge><q-btn-toggle v-if="content.html" v-model="mode" flat dense no-caps :options="[{label:'Visual',icon:'visibility',value:'html'},{label:'Texto',icon:'notes',value:'text'}]"/></div>
        <p v-if="mode==='html'" class="email-delivery-preview-note">Scripts e recursos externos são bloqueados nesta prévia. O conteúdo é o registrado no envio, independente de alterações posteriores no template.</p>
        <iframe v-if="mode==='html' && html" :srcdoc="html" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Prévia do e-mail enviado"/>
        <pre v-else class="email-delivery-preview-text">{{content.text || 'Este e-mail foi enviado apenas em HTML. Use a opção Visual.'}}</pre>
      </template>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.email-delivery-preview{width:1050px;max-width:96vw;border-radius:20px;max-height:94dvh;overflow:auto}.email-delivery-preview-header{display:flex;justify-content:space-between;align-items:start;gap:12px}.email-delivery-preview-header h2{font-size:22px;line-height:1.4;margin:4px 0;overflow-wrap:anywhere}.email-delivery-preview-header small{color:#75867f}.email-delivery-preview-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px}.email-delivery-preview-note{font-size:11px;color:#6e8279;margin:0;padding:0 20px 12px}.email-delivery-preview iframe{width:100%;min-height:65dvh;border:0;display:block;background:#fff}.email-delivery-preview-text{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.7 Arial,sans-serif;padding:20px;margin:0}@media(max-width:600px){.email-delivery-preview{border-radius:0;max-width:100vw}.email-delivery-preview-header h2{font-size:18px}.email-delivery-preview-tools{flex-wrap:wrap}.email-delivery-preview iframe{min-height:75dvh}}
</style>
