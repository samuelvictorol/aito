<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { io } from 'socket.io-client'
import { api, apiBaseURL } from 'boot/axios'
import AuthDialog from './AuthDialog.vue'
import KitCouponInput from './KitCouponInput.vue'
import { attribution, trackJourney } from 'src/services/lead-attribution'
import { defaultProductCatalog, normalizeProductCatalog, productSubtotal, productTermLabel, useProductCart } from 'src/services/product-cart'

const props = defineProps({ productType: { type: String, default: 'desktop' }, catalog: { type: Object, default: null } })
const emit = defineEmits(['catalog', 'purchased'])
const route = useRoute(), router = useRouter(), $q = useQuasar(), cart = useProductCart()
const loadingCatalog = ref(true)
const catalog = ref(defaultProductCatalog()), open = ref(false), loginOpen = ref(false), loginOnly = ref(false)
const couponQuote = ref(null)
const accepted = ref(false), termsOpen = ref(false), termsProduct = ref('desktop')
const busy = ref(false), confirming = ref(false), error = ref(''), order = ref(null), paid = ref(false), couponCode = ref(typeof route.query.cupom === 'string' ? route.query.cupom : sessionStorage.getItem('aito.kit.coupon') || '')
const entries = computed(() => cart.selected.value.map(type => ({ ...catalog.value[type], productType: type })))
const termsReady = computed(() => entries.value.length > 0 && entries.value.every(item => typeof item.kitTerms?.version === 'string' && item.kitTerms.version.trim() && typeof item.kitTerms?.content === 'string' && item.kitTerms.content.trim()))
const currentTerms = computed(() => catalog.value[termsProduct.value]?.kitTerms)
const acceptanceContext = computed(() => JSON.stringify(cart.selected.value.map(type => ({ type, priceCents: catalog.value[type]?.priceCents, terms: catalog.value[type]?.kitTerms }))))
const subtotal = computed(() => productSubtotal(cart.selected.value, catalog.value))
const cartTotal = computed(() => couponQuote.value?.amountCents ?? subtotal.value)
const total = computed(() => order.value?.amountCents ?? cartTotal.value)
const checkoutReturn = computed(() => typeof route.query.order_nsu === 'string' && typeof route.query.transaction_nsu === 'string' && typeof (route.query.slug || route.query.invoice_slug) === 'string')
const returnPath = computed(() => loginOnly.value ? '/app' : checkoutReturn.value ? route.fullPath : route.path + '?comprar=1' + (couponCode.value ? '&cupom=' + encodeURIComponent(couponCode.value) : ''))
const money = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const headers = () => ({ headers: { Authorization: 'Bearer ' + (localStorage.getItem('aito_user_token') || '') } })
let socket, timer
function connect() {
  if (socket || !localStorage.getItem('aito_user_token')) return
  const url = new URL(apiBaseURL, window.location.origin)
  socket = io(url.origin + '/products', { auth: { token: localStorage.getItem('aito_user_token') } })
  socket.on('purchase.updated', event => { if (!order.value || event.orderNsu === order.value.orderNsu) refresh() })
  socket.on('connect', () => { if (open.value) refresh() })
}
async function refresh() {
  if (!order.value || !localStorage.getItem('aito_user_token')) return
  try {
    const data = (await api.get('/products/aitonotify', headers())).data.data
    order.value = data.orders?.find(item => item.orderNsu === order.value.orderNsu) || order.value
    if (order.value.status === 'paid') { paid.value = true; cart.clear(); clearInterval(timer); emit('purchased') }
  } catch { /* A later event or manual refresh reconciles the order. */ }
}
function changed() { order.value = null; paid.value = false; error.value = ''; couponQuote.value = null; accepted.value = false }
function showTerms(type) { termsProduct.value = type; termsOpen.value = true }
function toggle(type, enabled) { enabled ? cart.add(type) : cart.remove(type); changed() }
function openCart(type = props.productType) { cart.add(type); changed(); open.value = true }
function openLogin() { if (localStorage.getItem('aito_user_token')) return router.push('/app'); loginOnly.value = true; loginOpen.value = true }
async function checkout() {
  if (busy.value || !cart.selected.value.length) return
  if (entries.value.some(item => !item.available)) { error.value = 'Esta oferta ainda não está disponível. Atualize a página antes de comprar.'; return }
  if (!accepted.value || !termsReady.value) { error.value = 'Confira e aceite os termos dos produtos selecionados antes de continuar.'; return }
  if (!localStorage.getItem('aito_user_token')) { loginOnly.value = false; loginOpen.value = true; return }
  busy.value = true; error.value = ''; trackJourney(route.path, 'checkout_start'); connect()
  try {
    const acceptedTerms = Object.fromEntries(cart.selected.value.map(type => [type, catalog.value[type].kitTerms.version]))
    order.value = (await api.post('/products/aitonotify/checkout', { productTypes: [...cart.selected.value], acceptedTerms, couponCode: couponCode.value, attribution: attribution() }, headers())).data.data
    paid.value = order.value.status === 'paid'; if (paid.value) { cart.clear(); emit('purchased') }
    clearInterval(timer); timer = setInterval(() => { if (open.value) refresh() }, 15000)
  } catch (cause) { error.value = cause.response?.data?.message || 'Não foi possível preparar a compra. Tente novamente.' }
  finally { busy.value = false }
}
async function confirm() {
  if (!checkoutReturn.value || confirming.value) return
  open.value = true
  if (!localStorage.getItem('aito_user_token')) { loginOnly.value = false; loginOpen.value = true; return }
  confirming.value = true; error.value = ''; connect()
  try {
    await api.post('/products/aitonotify/confirm', { order_nsu: route.query.order_nsu, transaction_nsu: route.query.transaction_nsu, slug: route.query.slug || route.query.invoice_slug }, headers())
    order.value = { orderNsu: route.query.order_nsu, status: 'paid' }; paid.value = true; cart.clear(); emit('purchased')
    $q.notify({ type: 'positive', message: 'Compra confirmada. Seus produtos e tokens estão em Meus produtos.' })
  } catch (cause) { error.value = cause.response?.data?.message || 'Aguardando a confirmação da InfinitePay. Consulte novamente em instantes.' }
  finally { confirming.value = false }
}
function authenticated() { if (loginOnly.value) { loginOnly.value = false; router.push('/app') } else if (checkoutReturn.value) confirm(); else checkout() }
onMounted(async () => {
  try {
    const response = props.catalog || (await api.get('/products/aitonotify/public', { params: { productType: props.productType } })).data.data
    catalog.value = normalizeProductCatalog(response); emit('catalog', catalog.value)
  } catch { error.value = 'Não foi possível consultar a oferta. Atualize a página antes de comprar.' }
  finally { loadingCatalog.value = false }
  connect()
  if (checkoutReturn.value) confirm()
  else if (route.query.comprar === '1') { openCart(); }
})
watch(() => props.catalog, value => { if (value) catalog.value = normalizeProductCatalog(value) }, { deep: true })
watch(acceptanceContext, () => { accepted.value = false })
onBeforeUnmount(() => { socket?.disconnect(); clearInterval(timer) })
defineExpose({ openCart, openLogin })
</script>
<template>
  <AuthDialog v-model="loginOpen" audience="user" :show-project-login="false" :return-path="returnPath" @authenticated="authenticated"/>
  <q-dialog v-model="open"><q-card class="kit-cart">
    <q-card-section class="kit-cart__head"><div><small>ESCOLHA O QUE FAZ SENTIDO PARA VOCÊ</small><h2>{{ paid ? 'Seus produtos estão liberados' : 'Seu carrinho' }}</h2><p v-if="!paid">Compras independentes. Você pode levar um produto ou os dois.</p></div><q-btn flat round icon="mdi-close" aria-label="Fechar carrinho" v-close-popup/></q-card-section>
    <q-card-section v-if="paid" class="kit-cart__success"><q-icon name="mdi-check-decagram" size="54px"/><h3>Pronto para começar.</h3><p>O acesso e o token de cada produto comprado ficam separados em Meus produtos e licenças.</p><q-btn unelevated color="teal-7" no-caps label="Abrir meus produtos" to="/app?tab=products"/></q-card-section>
    <q-card-section v-else class="kit-cart__body">
      <p v-if="loadingCatalog" class="kit-cart__note"><q-spinner/> Consultando os produtos disponíveis…</p>
      <template v-else-if="!order">
        <label v-for="type in ['desktop','cloud']" :key="type" class="kit-cart__item" :class="{'is-selected':cart.selected.value.includes(type)}">
          <q-checkbox :model-value="cart.selected.value.includes(type)" :disable="busy || (!catalog[type].available && !cart.selected.value.includes(type))" color="teal-4" @update:model-value="value=>toggle(type,value)"/>
          <q-icon :name="type==='desktop'?'mdi-microsoft-windows':'mdi-code-braces'" size="30px"/>
          <span><strong>{{type==='desktop'?'Aplicativo Desktop':'Código-fonte Whitelabel'}}</strong><small>{{type==='desktop'?'Instalador Windows':'Código editável + Cloud'}} · token {{productTermLabel(catalog[type])}}</small><em>{{type==='desktop'?'Para operar com o aplicativo pronto. Não inclui código-fonte nem licença Cloud.':'Para desenvolver e hospedar sua versão. Não inclui a licença do executável Desktop.'}}</em><small v-if="!catalog[type].available">Oferta indisponível no momento.</small></span>
          <b>{{money(catalog[type].priceCents)}}</b>
        </label>
        <KitCouponInput v-model="couponCode" dark :product-types="cart.selected.value" @quote="value=>couponQuote=value"/>
        <div class="kit-cart__summary"><span>{{entries.length}} produto(s)<small>Tokens e prazos separados por produto.</small><small v-if="couponQuote?.discountCents">Desconto: {{money(couponQuote.discountCents)}}</small></span><strong>{{money(cartTotal)}}</strong></div>
      </template>
      <template v-else><div class="kit-cart__provider"><q-icon name="mdi-lock-check-outline" size="34px"/><div><h3>Checkout InfinitePay</h3><p>{{money(total)}} · {{order.items?.length || entries.length}} produto(s). Revise os itens no provedor antes de pagar.</p></div></div><q-btn v-if="order.checkoutUrl" class="full-width" unelevated color="teal-7" no-caps size="lg" label="Abrir pagamento seguro" :href="order.checkoutUrl" target="_blank" rel="noopener noreferrer"/><p class="kit-cart__note">A liberação acontece após a confirmação do pagamento. Não é necessário pagar novamente ao voltar para esta tela.</p><q-btn flat no-caps label="Consultar pagamento" :loading="confirming" @click="checkoutReturn?confirm():refresh()"/><q-btn flat no-caps label="Voltar ao carrinho" @click="changed"/></template>
      <p v-if="error" class="kit-cart__error" role="alert">{{error}}</p>
      <p v-if="confirming" class="kit-cart__note"><q-spinner/> Confirmando seu pagamento…</p>
    </q-card-section>
    <q-card-actions v-if="!paid && !order" class="kit-cart__actions"><div class="kit-cart__acceptance"><div class="kit-cart__terms-links"><button v-for="item in entries" :key="item.productType" type="button" :disabled="!item.kitTerms" @click="showTerms(item.productType)"><q-icon name="mdi-file-document-outline"/> {{item.productType==='desktop'?'Termos do Desktop':'Termos do código-fonte'}}</button></div><q-checkbox v-model="accepted" :disable="busy || !termsReady" color="teal-4" label="Li e aceito os termos de uso dos produtos selecionados."/><small v-if="!loadingCatalog && entries.length && !termsReady">Os termos não estão disponíveis. Atualize a página antes de comprar.</small></div><q-btn flat no-caps label="Continuar escolhendo" v-close-popup/><q-btn unelevated color="teal-7" no-caps label="Continuar para o pagamento" icon="mdi-lock-outline" :disable="!accepted || !termsReady || !entries.length || entries.some(item=>!item.available)" :loading="busy" @click="checkout"/></q-card-actions>
  </q-card></q-dialog>
  <q-dialog v-model="termsOpen"><q-card class="cart-terms"><q-card-section class="cart-terms__head"><div><small>{{termsProduct==='desktop'?'APLICATIVO DESKTOP':'CÓDIGO-FONTE WHITELABEL'}} · versão {{currentTerms?.version}}</small><h2>{{currentTerms?.title || 'Termos de uso do produto'}}</h2></div><q-btn flat round icon="mdi-close" aria-label="Fechar termos de uso" v-close-popup/></q-card-section><q-card-section class="cart-terms__text">{{currentTerms?.content}}</q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Voltar ao carrinho" v-close-popup/></q-card-actions></q-card></q-dialog>
</template>
<style scoped>
.kit-cart{width:850px;max-width:calc(100vw - 24px);max-height:92dvh;display:flex;flex-direction:column;background:#071f22;color:#f1fffa;border:1px solid #448773;border-radius:22px}.kit-cart__head{flex:none;display:flex;align-items:flex-start;gap:16px;padding:26px 28px;border-bottom:1px solid #284d43}.kit-cart__head>div{flex:1}.kit-cart__head small{font-size:10px;letter-spacing:.13em;color:#98d5be}.kit-cart h2{font-size:30px;line-height:1.2;margin:9px 0}.kit-cart p{color:#accabd;line-height:1.8;font-size:13px;margin:8px 0}.kit-cart__body{min-height:0;overflow-y:auto;padding:24px 28px}.kit-cart__item{display:flex;align-items:center;gap:14px;border:1px solid #31584b;border-radius:16px;padding:18px 14px;margin-bottom:14px;cursor:pointer;background:#0b2928}.kit-cart__item.is-selected{border-color:#79d6b3;background:#123e34}.kit-cart__item>.q-icon{color:#92e9ca;flex:none}.kit-cart__item>span{flex:1;min-width:0}.kit-cart__item strong,.kit-cart__item small,.kit-cart__item em{display:block}.kit-cart__item strong{font-size:16px}.kit-cart__item small{font-size:11px;color:#aad3c1;margin-top:5px}.kit-cart__item em{font-style:normal;font-size:10px;line-height:1.7;color:#91b4a4;margin-top:8px}.kit-cart__item>b{font-size:19px;color:#c9ffe9;white-space:nowrap}.kit-cart__summary{display:flex;align-items:center;gap:20px;padding:18px 0;border-top:1px solid #31594b}.kit-cart__summary>span{flex:1;font-size:14px}.kit-cart__summary small{display:block;font-size:10px;color:#9fcab8;margin-top:7px}.kit-cart__summary>strong{font-size:30px;color:#b8ffe2}.kit-cart__actions{padding:16px 24px;border-top:1px solid #31594b;background:#0c2927;gap:8px;justify-content:space-between;flex:none}.kit-cart__success{text-align:center;padding:45px 28px}.kit-cart__success>.q-icon{color:#85dfb9}.kit-cart__success h3{font-size:25px;margin:20px 0 10px}.kit-cart__success p{max-width:470px;margin:0 auto 25px}.kit-cart__error{color:#ffb4b4!important;background:#4b2626;border:1px solid #8b4b4b;padding:13px;border-radius:12px}.kit-cart__provider{display:flex;align-items:center;gap:14px;margin-bottom:22px}.kit-cart__provider>.q-icon{color:#94e7c7}.kit-cart__provider h3{font-size:21px;margin:0}.kit-cart__note{font-size:11px!important}@media(max-width:600px){.kit-cart__head,.kit-cart__body{padding:20px 16px}.kit-cart h2{font-size:26px}.kit-cart__item{gap:9px;flex-wrap:wrap;padding:14px 10px}.kit-cart__item>.q-icon{display:none}.kit-cart__item>span{flex-basis:calc(100% - 55px)}.kit-cart__item>b{margin-left:48px;font-size:22px}.kit-cart__actions{padding:14px;justify-content:center}.kit-cart__actions>.q-btn{width:100%;min-height:42px}.kit-cart__summary>strong{font-size:25px}}
.kit-cart__acceptance{flex-basis:100%;width:100%;padding-bottom:9px;border-bottom:1px solid #31594b;margin-bottom:8px}.kit-cart__terms-links{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.kit-cart__terms-links>button{display:flex;align-items:center;gap:5px;color:#a6e7d2;background:transparent;border:0;border-bottom:1px solid #72b49e;padding:4px 0;font:inherit;font-size:11px;cursor:pointer}.kit-cart__terms-links>button:disabled{opacity:.5;cursor:default}.kit-cart__acceptance .q-checkbox{font-size:12px;line-height:1.6}.kit-cart__acceptance>small{display:block;font-size:10px;line-height:1.7;color:#f2c295;margin:4px 0}.cart-terms{width:760px;max-width:calc(100vw - 24px);max-height:90dvh;display:flex;flex-direction:column;background:#0b2024;color:#e8fff5;border:1px solid #4a7f70;border-radius:20px}.cart-terms__head{display:flex;align-items:flex-start;gap:18px;flex:none;border-bottom:1px solid #31594b}.cart-terms__head>div{flex:1;min-width:0}.cart-terms__head small{font-size:10px;color:#9ad2bf;letter-spacing:.06em}.cart-terms h2{font-size:23px;line-height:1.4;margin:9px 0 0;overflow-wrap:anywhere}.cart-terms__text{min-height:0;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.9;color:#c6ded1}.cart-terms .q-card__actions{flex:none;border-top:1px solid #31594b}@media(max-width:600px){.kit-cart__actions .kit-cart__acceptance{padding-bottom:6px;margin-bottom:2px}.kit-cart__acceptance .q-checkbox{font-size:11px}.kit-cart__terms-links{gap:12px}.kit-cart__terms-links>button{font-size:10px}.cart-terms h2{font-size:19px}}
</style>
