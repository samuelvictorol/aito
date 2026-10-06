<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import AuthDialog from 'components/AuthDialog.vue'
const router = useRouter(), route = useRoute(), $q = useQuasar(), loginOpen = ref(false), confirming = ref(false), paymentMessage = ref('')
const checkoutReturn = computed(() => typeof route.query.order_nsu === 'string' && typeof route.query.transaction_nsu === 'string' && typeof (route.query.slug || route.query.invoice_slug) === 'string')
const authReturnPath = computed(() => checkoutReturn.value ? route.fullPath : '/app?tab=products')
function buy() { if (localStorage.getItem('aito_user_token')) router.push({ path: '/app', query: { tab: 'products' } }); else loginOpen.value = true }
async function confirmCheckout() {
  if (!checkoutReturn.value || confirming.value) return
  if (!localStorage.getItem('aito_user_token')) { loginOpen.value = true; paymentMessage.value = 'Entre com a conta de estudante usada na compra para confirmar o pagamento.'; return }
  confirming.value = true; paymentMessage.value = ''
  try {
    await api.post('/products/whatsappbotbuilder/confirm', {
      order_nsu: route.query.order_nsu,
      transaction_nsu: route.query.transaction_nsu,
      slug: route.query.slug || route.query.invoice_slug,
    }, { headers: { Authorization: `Bearer ${localStorage.getItem('aito_user_token')}` } })
    $q.notify({ type: 'positive', message: 'Pagamento confirmado. Sua licença está em Meus produtos.' })
    await router.replace({ path: '/app', query: { tab: 'products' } })
  } catch (error) {
    paymentMessage.value = error.response?.data?.message || 'Ainda não foi possível confirmar o pagamento. Tente novamente em alguns instantes.'
  } finally { confirming.value = false }
}
function onAuthenticated() { if (checkoutReturn.value) confirmCheckout(); else buy() }
onMounted(confirmCheckout)
</script>
<template>
  <q-layout view="hHh lpR fFf"><q-page-container><q-page class="product"><header><router-link to="/" class="product__brand">AITO<span>SOFTWARES</span></router-link><q-btn flat no-caps label="Minha conta" icon="mdi-account-outline" @click="buy" /></header><main><div class="product__copy"><span class="product__eyebrow">CÓDIGO FONTE + LICENÇA</span><h1>Seu WhatsApp BotBuilder, com controle total.</h1><p>Desenhe atendimentos com cards, decisões, IA, mensagens e pagamentos. Teste o fluxo antes de aplicar e acompanhe os chats no mesmo painel.</p><q-banner v-if="checkoutReturn" class="product__payment-banner"><div v-if="confirming">Confirmando seu pagamento com a InfinitePay…</div><div v-else>{{ paymentMessage || 'Conclua a confirmação da sua compra para liberar o token.' }}</div><q-btn v-if="!confirming && paymentMessage && localStorage.getItem('aito_user_token')" flat no-caps color="teal-2" label="Tentar confirmar novamente" @click="confirmCheckout" /></q-banner><ul><li>Editor visual e simulador de conversas</li><li>Integrações com OpenAI e InfinitePay</li><li>Código fonte para sua instalação</li><li>Licença individual com ativação pelo painel Aito</li></ul><div class="product__actions"><q-btn unelevated no-caps color="teal-6" size="lg" icon="mdi-cart-outline" label="Comprar com InfinitePay" @click="buy" /><router-link to="/app">Já comprei: Meus produtos →</router-link></div><small>Crie ou entre na sua conta de estudante para receber o token após a confirmação do pagamento.</small></div><div class="product__visual"><div class="product__visual-bar"><i></i><i></i><i></i><span>BotBuilder</span></div><div class="product__node">◉ Início <small>Mensagem de boas-vindas</small></div><div class="product__line"></div><div class="product__node">◇ Decisão <small>Escolha o caminho</small></div><div class="product__line"></div><div class="product__node">⚡ Integração <small>IA · InfinitePay · API</small></div></div></main><section id="instalacao" class="product__guide"><span class="product__eyebrow">PASSO A PASSO</span><h2>Instale o BotBuilder</h2><ol><li>Após a confirmação da compra, abra <strong>Meus produtos</strong> e baixe o ZIP do código fonte. Compras pelo WhatsApp recebem o link na conversa.</li><li>Extraia o ZIP, copie <code>.env.example</code> para <code>.env</code> e preencha <code>AITO_LICENSE_TOKEN</code> com o token individual recebido.</li><li>Instale Docker Desktop e execute <code>docker compose up -d --build</code> na pasta do projeto.</li><li>Abra <code>http://localhost:8088</code>, conecte o WhatsApp pelo QR Code e configure integrações e fluxo no painel.</li></ol><p>Para transferir a licença a outro servidor, peça a emissão de um novo token à equipe.</p></section><AuthDialog v-model="loginOpen" audience="user" :return-path="authReturnPath" @authenticated="onAuthenticated" /></q-page></q-page-container></q-layout>
</template>
<style scoped>
.product{min-height:100vh;color:#effffb;background:radial-gradient(circle at 72% 24%,rgba(19,188,157,.2),transparent 34rem),#03090b;padding:0 max(1.5rem,calc((100vw - 1180px)/2))}.product header{display:flex;justify-content:space-between;align-items:center;padding:1.4rem 0;border-bottom:1px solid rgba(19,188,157,.25)}.product__brand{text-decoration:none;color:#effffb;font-weight:900;letter-spacing:.12em}.product__brand span{color:#13bc9d}.product main{display:grid;grid-template-columns:1.1fr .9fr;gap:4rem;align-items:center;min-height:78vh}.product__eyebrow{color:#8fffee;letter-spacing:.14em;font-size:.75rem;font-weight:800}.product h1{font-size:clamp(2.7rem,5vw,5.6rem);line-height:1.05;margin:1.2rem 0}.product p,.product small,.product li{color:rgba(239,255,251,.72);line-height:1.65}.product ul{padding-left:1.2rem}.product__actions{display:flex;align-items:center;flex-wrap:wrap;gap:1rem;margin:2rem 0 1rem}.product a{color:#8fffee}.product__visual{border:1px solid rgba(19,188,157,.32);border-radius:1rem;padding:1.5rem;background:#071c1d;box-shadow:0 30px 80px #0008}.product__visual-bar{display:flex;gap:.4rem;padding-bottom:1rem;border-bottom:1px solid #266}.product__visual-bar i{width:.5rem;height:.5rem;border-radius:50%;background:#13bc9d}.product__visual-bar span{margin-left:auto}.product__node{display:grid;gap:.2rem;margin:auto;width:75%;padding:1rem;border:1px solid #2a8;border-radius:.6rem;background:#092b2c}.product__node small{font-size:.7rem}.product__line{height:2rem;width:1px;background:#2a8;margin:auto}@media(max-width:800px){.product main{grid-template-columns:1fr;padding:3rem 0}.product__visual{display:none}}
.product__guide{padding:3rem 0 5rem;border-top:1px solid rgba(19,188,157,.25)}.product__guide h2{font-size:2rem}.product__guide ol{display:grid;gap:1rem;max-width:760px;padding-left:1.4rem}.product__guide li{line-height:1.6}.product__guide code{color:#8fffee;background:#092b2c;padding:.15rem .35rem;border-radius:.25rem}
.product__payment-banner{margin:1.5rem 0;padding:1rem;border:1px solid #3b9a83;border-radius:.7rem;color:#ecfff8;background:#103a35}
</style>
