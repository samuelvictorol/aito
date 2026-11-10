<template>
  <div class="invoice-actions">
    <q-btn flat dense no-caps icon="mdi-eye-outline" label="Abrir nota fiscal" :loading="opening" @click="openInvoice" />
    <q-btn flat dense round icon="mdi-download-outline" aria-label="Baixar nota fiscal" :loading="downloading" @click="downloadInvoice">
      <q-tooltip>Baixar {{ invoice.filename }}</q-tooltip>
    </q-btn>
    <q-dialog v-model="previewOpen" @hide="clearPreview">
      <q-card class="invoice-preview">
        <q-card-section class="row items-center no-wrap q-gutter-sm">
          <q-icon name="mdi-file-document-outline" size="26px" />
          <div class="col">
            <strong>Nota fiscal</strong>
            <div class="text-caption invoice-preview__filename">{{ invoice.filename }}</div>
          </div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar nota fiscal" v-close-popup />
        </q-card-section>
        <q-separator />
        <iframe v-if="previewUrl" :src="previewUrl" title="Prévia da nota fiscal em PDF" />
        <pre v-else>{{ previewText }}</pre>
        <q-card-actions align="right">
          <q-btn v-if="previewUrl" flat no-caps icon="mdi-open-in-new" label="Abrir PDF em outra aba" :href="previewUrl" target="_blank" rel="noopener noreferrer" />
          <q-btn unelevated no-caps color="teal-8" icon="mdi-download" label="Baixar nota fiscal" :loading="downloading" @click="downloadInvoice" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'

const props = defineProps({
  purchaseId: { type: String, required: true },
  invoice: { type: Object, required: true },
  admin: Boolean,
})
const $q = useQuasar()
const opening = ref(false)
const downloading = ref(false)
const previewOpen = ref(false)
const previewUrl = ref('')
const previewText = ref('')
let mounted = true

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewText.value = ''
}

async function fetchInvoice(download) {
  const base = props.admin ? '/admin/finance/purchases' : '/finance/purchases'
  const { data } = await api.get(`${base}/${encodeURIComponent(props.purchaseId)}/invoice`, {
    ...financeHeaders(props.admin), responseType: 'blob', params: download ? { download: 1 } : undefined,
  })
  const mime = String(data.type || '').split(';')[0].toLowerCase()
  const xmlPreview = !download && mime === 'text/plain' && /\.xml$/i.test(props.invoice.filename || '')
  if (!xmlPreview && !['application/pdf', 'application/xml', 'text/xml'].includes(mime)) throw Error('Formato inválido')
  return { data, mime }
}

async function openInvoice() {
  if (opening.value) return
  opening.value = true
  clearPreview()
  try {
    const { data, mime } = await fetchInvoice(false)
    if (!mounted) return
    if (mime === 'application/pdf') previewUrl.value = URL.createObjectURL(data)
    else {
      const content = await data.text()
      if (!mounted) return
      previewText.value = content
    }
    previewOpen.value = true
  } catch {
    if (mounted) $q.notify({ type: 'negative', message: 'Não foi possível abrir esta nota fiscal.' })
  } finally {
    opening.value = false
  }
}

async function downloadInvoice() {
  if (downloading.value) return
  downloading.value = true
  try {
    const { data } = await fetchInvoice(true)
    if (!mounted) return
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = props.invoice.filename || 'nota-fiscal'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    if (mounted) $q.notify({ type: 'negative', message: 'Não foi possível baixar esta nota fiscal.' })
  } finally {
    downloading.value = false
  }
}

onBeforeUnmount(() => { mounted = false; clearPreview() })
</script>

<style scoped>
.invoice-actions { display: inline-flex; flex-wrap: wrap; align-items: center; gap: .2rem; }
.invoice-preview { width: min(94vw, 820px); max-width: 94vw; }
.invoice-preview__filename { overflow-wrap: anywhere; }
.invoice-preview iframe { display: block; width: 100%; height: min(64vh, 700px); border: 0; }
.invoice-preview pre { max-height: 60vh; overflow: auto; margin: 0; padding: 1rem; background: #f0f5f4; color: #162d27; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
