<template>
  <q-layout view="lHh Lpr lFf" class="course-payment">
    <q-page-container><q-page class="course-payment__page"><div class="course-payment__card">
      <q-spinner v-if="loading" color="teal-3" size="42px" />
      <q-icon v-else-if="unlocked" name="mdi-check-decagram-outline" size="64px" />
      <q-icon v-else name="mdi-alert-circle-outline" size="64px" />
      <p class="course-payment__eyebrow">AITOLEARN / PAGAMENTO</p>
      <h1>{{ loading ? 'Confirmando seu acesso' : unlocked ? 'Curso liberado' : 'Pagamento em processamento' }}</h1>
      <p>{{ message }}</p>
      <small v-if="polling" class="course-payment__polling"><q-spinner-dots size="18px" /> Aguardando a confirmação automática...</small>
      <q-btn v-if="unlocked && courseSlug" unelevated no-caps class="course-payment__button" label="Abrir curso" icon="mdi-school-outline" @click="router.push(`/cursos/${courseSlug}/aulas`)" />
      <q-btn v-else flat no-caps color="teal-3" label="Voltar aos cursos" icon="mdi-arrow-left" @click="router.push('/aitolearn')" />
    </div></q-page></q-page-container>
  </q-layout>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { safeReceiptUrl } from 'src/services/purchase-history'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const loading = ref(true)
const unlocked = ref(false)
const polling = ref(false)
const message = ref('Aguarde enquanto confirmamos o retorno seguro da InfinitePay.')
const courseSlug = ref('')
const attempts = ref(0)
let pollTimer

function queryValue (...keys) {
  return keys.map((key) => route.query[key]).find((value) => String(value || '').trim()) || ''
}

async function loadStatus () {
  const token = localStorage.getItem('aito_user_token')
  const purchaseId = String(route.query.purchaseId || route.query.purchase_id || '').trim()
  if (!token) { message.value = 'Entre na sua conta AitoSoftwares para acompanhar a liberacao.'; loading.value = false; return false }
  if (!purchaseId) { message.value = 'Nao encontramos a identificacao desta compra. Acesse sua area de cursos para consultar o pagamento.'; loading.value = false; return false }

  try {
    const response = await api.post(`/courses/purchases/${purchaseId}/status`, {
      transactionNsu: queryValue('transaction_nsu', 'transactionNsu'),
      slug: queryValue('slug', 'invoice_slug'),
      receipt_url: safeReceiptUrl(queryValue('receipt_url', 'receiptUrl')) || undefined,
    }, { headers: { Authorization: `Bearer ${token}` } })
    const data = response.data.data || {}
    unlocked.value = Boolean(data.unlocked)
    courseSlug.value = data.purchase?.course?.slug || ''
    loading.value = false
    if (unlocked.value) {
      polling.value = false
      message.value = 'Seu acesso foi liberado e ja esta disponivel na sua area de cursos.'
      $q.notify({ type: 'positive', icon: 'mdi-school-outline', message: 'Acesso ao curso liberado!' })
      return true
    }
    message.value = 'Pagamento recebido. Aguardando a confirmacao final para liberar seu acesso.'
  } catch (error) {
    loading.value = false
    message.value = error.response?.data?.message || 'Nao foi possivel confirmar o pagamento agora.'
  }
  return false
}

onMounted(async () => {
  const ready = await loadStatus()
  if (ready || !localStorage.getItem('aito_user_token') || !queryValue('purchaseId', 'purchase_id')) return
  polling.value = true
  pollTimer = window.setInterval(async () => {
    attempts.value += 1
    const unlockedNow = await loadStatus()
    if (unlockedNow || attempts.value >= 20) {
      polling.value = false
      window.clearInterval(pollTimer)
    }
  }, 4000)
})

onBeforeUnmount(() => window.clearInterval(pollTimer))
</script>
<style scoped>.course-payment{color:#effffb;background:#03090b}.course-payment__page{display:grid;place-items:center;min-height:100vh;padding:1rem;background:radial-gradient(circle at 50% 25%,rgba(19,188,157,.16),transparent 28rem),#03090b}.course-payment__card{display:grid;justify-items:center;gap:.8rem;width:min(94vw,560px);padding:3rem 2rem;border:1px solid rgba(19,188,157,.3);border-radius:1rem;background:rgba(4,24,25,.76);text-align:center}.course-payment__card>.q-icon{color:#8fffee}.course-payment__eyebrow{margin:0;color:#8fffee;font-size:.65rem;font-weight:900;letter-spacing:.15em}.course-payment__card h1{margin:0;font-size:clamp(1.8rem,5vw,3.3rem);line-height:1}.course-payment__card>p:not(.course-payment__eyebrow){max-width:34rem;margin:0;color:rgba(229,255,250,.68);line-height:1.6}.course-payment__polling{display:inline-flex;align-items:center;gap:.35rem;color:rgba(229,255,250,.58);font-size:.72rem}.course-payment__button{color:#03110f;background:linear-gradient(135deg,#8fffee,#13bc9d);font-weight:900}</style>
