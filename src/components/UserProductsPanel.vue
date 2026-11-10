<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { api, apiBaseURL } from 'boot/axios'
import { io } from 'socket.io-client'
import { useQuasar } from 'quasar'
import KitProductCart from './KitProductCart.vue'
import LoginMfaDialog from './LoginMfaDialog.vue'
import LicenseValidity from './LicenseValidity.vue'
import DesktopTrialOffer from './DesktopTrialOffer.vue'
import { licenseValidity } from 'src/services/license-validity'
import { defaultProductCatalog, productTermLabel, useProductCart } from 'src/services/product-cart'
import { PRODUCT_TYPES, licenseProductType, licensePackages, productLabel, normalizeCatalog } from 'src/services/product-catalog'
const $q=useQuasar(),data=ref(null),catalog=ref({}),cart=ref(null),busy=ref(false),downloading=ref(''),visible=ref({}),now=ref(Date.now())
const reauthOpen=ref(false),reauthChallenge=ref(null),pendingRotation=ref(null),termsOpen=ref(false),selectedTerms=ref(null)
const headers=()=>({headers:{Authorization:'Bearer '+(localStorage.getItem('aito_user_token')||'')}})
const date=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—'
const money=cents=>(Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const definitions={desktop:{icon:'mdi-microsoft-windows',title:'Desktop · executável',tag:'PRONTO PARA USAR',description:'Instalador para Windows 10 e 11 de 64 bits, sem código-fonte.',link:'/whatsapp-solucoes'},cloud:{icon:'mdi-source-repository',title:'Whitelabel · código-fonte / Cloud',tag:'PRONTO PARA PERSONALIZAR',description:'Código-fonte editável e pacote para Cloud. Produto independente do executável Desktop.',link:'/whatsapp-solucoes-whitelabel'}}
const licenses=computed(()=>data.value?.licenses||[])
const hasActiveLicense = computed(() => licenses.value.some(license => licenseValidity(license, now.value).effectiveActive))
const renewing = ref('')
const hasProduct=type=>licenses.value.some(license=>licensePackages(license).includes(type))
function packageFor(type){return data.value?.downloads?.[type]||null}
function offerFor(type){return catalog.value?.[type]||defaultProductCatalog()[type]}
function applyCatalog(value){catalog.value=normalizeCatalog(value||{})}
const { desktopMonths, setDesktopMonths } = useProductCart()
const desktopPlans = computed(() => (offerFor('desktop').desktopPlans || []).filter(plan => plan.enabled))
const desktopPlan = computed(() => desktopPlans.value.find(plan => plan.months === desktopMonths.value) || desktopPlans.value[0])
const desktopPlanOptions = computed(() => desktopPlans.value.map(plan => ({
  value: plan.months,
  label: plan.label + ' · ' + plan.months + (plan.months === 1 ? ' mês' : ' meses'),
})))
watch(desktopPlan, plan => {
  if (plan && plan.months !== desktopMonths.value) setDesktopMonths(plan.months)
}, { immediate: true })

function displayedOffer(type) {
  const offer = offerFor(type)
  if (type !== 'desktop') return offer
  const plan = desktopPlan.value
  return {
    ...offer,
    available: offer.available !== false && Boolean(plan),
    priceCents: plan?.priceCents,
    originalPriceCents: plan?.priceCents,
    durationMonths: plan?.months,
  }
}

let loadSequence = 0
async function load({ silent = false } = {}) {
  const sequence = ++loadSequence
  busy.value = true
  try {
    const result = (await api.get('/products/aitonotify', headers())).data.data
    if (sequence !== loadSequence) return
    data.value = result
    if (result.products) applyCatalog(result.products)
  } catch (error) {
    if (!silent && sequence === loadSequence) $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível carregar seus produtos.' })
  } finally {
    if (sequence === loadSequence) busy.value = false
  }
}
function openTerms(type,license){selectedTerms.value=license?.termsSnapshot||license?.terms|| (type==='legacy'?data.value?.legacyTerms||data.value?.product?.kitTerms:offerFor(type).kitTerms);if(selectedTerms.value?.content)termsOpen.value=true;else $q.notify({type:'info',message:'Os termos estão disponíveis na página de venda deste produto.'})}
async function copy(value){try{await navigator.clipboard.writeText(value);$q.notify({type:'positive',message:'Token copiado.'})}catch{$q.notify({type:'warning',message:'Exiba a chave para copiá-la manualmente.'})}}
async function download(license,type){downloading.value=license._id+type;try{const result=(await api.post('/products/aitonotify/download-ticket',{licenseId:license._id,package:type},headers())).data.data;window.location.assign(result.url)}catch(e){$q.notify({type:'negative',message:e.response?.data?.message||'Não foi possível iniciar o download.'})}finally{downloading.value=''}}
function canRenew(license) {
  return license.expiresAt && licensePackages(license).includes('desktop') && ['active', 'expired'].includes(licenseValidity(license, now.value).status)
}
async function renew(license) {
  if (renewing.value) return
  renewing.value = license._id
  try {
    const { data } = await api.post(`/products/aitonotify/licenses/${encodeURIComponent(license._id)}/renewal-access`, {}, headers())
    const url = new URL(data.data.url)
    if (url.origin !== 'https://aitosoftwares.com' || url.pathname !== '/produto/renovar' || url.search || !/^#grant=[\w-]{43}$/.test(url.hash)) throw new Error('Endereço de renovação inválido')
    window.location.assign(url.pathname + url.hash)
  } catch (cause) {
    $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível abrir a renovação.' })
  } finally { renewing.value = '' }
}
async function performRotate(license){try{await api.post('/products/aitonotify/licenses/'+license._id+'/rotate',{},headers());await load();$q.notify({type:'positive',message:'Token anterior revogado. Atualize a instalação deste produto.'})}catch(e){$q.notify({type:'negative',message:e.response?.data?.message||'Não foi possível substituir a chave.'})}}
function rotate(license) {
  $q.dialog({ title: 'Substituir chave deste produto?', message: 'A chave anterior será revogada. Os tokens dos outros produtos são independentes.', cancel: true, persistent: true }).onOk(async () => {
    let claims
    try {
      const [, body] = (localStorage.getItem('aito_user_token') || '').split('.')
      claims = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    } catch { /* The API validates the current session. */ }
    const cutoff = Date.now() / 1000 - 300
    if (claims?.amr === 'google') {
      if (Number(claims.authAt) > cutoff) return performRotate(license)
      $q.dialog({ title: 'Confirme seu acesso pelo Google', message: 'Depois de entrar, volte a esta licença para substituir a chave.', ok: 'Continuar com Google', cancel: true }).onOk(async () => {
        const { beginGoogleLogin } = await import('src/services/google-login')
        beginGoogleLogin('/app?tab=products')
      })
      return
    }
    if (claims?.mfa && Number(claims.mfaAt) > cutoff) return performRotate(license)
    try {
      pendingRotation.value = license
      reauthChallenge.value = (await api.post('/auth/mfa/reauth', {}, headers())).data
      reauthOpen.value = true
    } catch (error) {
      $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível solicitar a confirmação por e-mail.' })
    }
  })
}
async function verifiedRotation(result){localStorage.setItem('aito_user_token',result.token);localStorage.setItem('aito_user',JSON.stringify(result.user));if(pendingRotation.value)await performRotate(pendingRotation.value);pendingRotation.value=null}
let socket, timer, clock
const refresh = () => void load({ silent: true })
onMounted(() => {
  load()
  clock = setInterval(() => { now.value = Date.now() }, 1000)
  const origin = new URL(apiBaseURL, window.location.origin).origin
  socket = io(origin + '/products', { auth: { token: localStorage.getItem('aito_user_token') } })
  socket.on('purchase.updated', refresh)
  socket.on('license.updated', refresh)
  socket.on('connect', refresh)
  window.addEventListener('focus', refresh)
  timer = setInterval(() => {
    if (!socket.connected || data.value?.orders?.some(order => order.status === 'pending')) refresh()
  }, 15000)
})
onBeforeUnmount(() => {
  loadSequence++
  socket?.disconnect()
  clearInterval(timer)
  clearInterval(clock)
  window.removeEventListener('focus', refresh)
})
</script>
<template>
<section class="products">
  <LoginMfaDialog v-model="reauthOpen" :challenge="reauthChallenge" @verified="verifiedRotation"/>
  <KitProductCart ref="cart" @catalog="applyCatalog" @purchased="load"/>
  <header class="products__top"><img class="products__box" src="/whatsapp-solutions/product-kit.webp" alt="Kit AitoNotify + WhatsApp BotBuilder" width="62" height="90"/><div><span>MINHA BIBLIOTECA</span><h1>Meus produtos e licenças</h1><p>Desktop e Whitelabel são produtos separados, cada um com seu próprio token.</p></div><q-btn flat round icon="mdi-refresh" aria-label="Atualizar produtos" :loading="busy" @click="load"/></header>
  <DesktopTrialOffer v-if="data && !hasActiveLicense" @claimed="load" />
  <div class="products__catalog">
    <article v-for="type in PRODUCT_TYPES" :key="type" :class="['product-card','product-card--'+type]">
      <q-icon :name="definitions[type].icon" size="34px"/><q-badge :color="hasProduct(type)?'teal-7':'grey-8'" :label="hasProduct(type)?'Na sua biblioteca':'Compra separada'"/>
      <small>{{definitions[type].tag}}</small><h2>{{definitions[type].title}}</h2><p>{{definitions[type].description}} <template v-if="displayedOffer(type).priceCents != null"> Token {{ productTermLabel(displayedOffer(type)) }}.</template></p>
      <q-select
        v-if="type === 'desktop' && desktopPlanOptions.length"
        class="product-card__plan" dark dense outlined emit-value map-options
        :model-value="desktopPlan?.months" :options="desktopPlanOptions"
        label="Período do plano Desktop" @update:model-value="setDesktopMonths"
      />
      <div v-if="displayedOffer(type).priceCents != null" class="product-card__price" aria-live="polite">
        <s v-if="displayedOffer(type).originalPriceCents > displayedOffer(type).priceCents">{{ money(displayedOffer(type).originalPriceCents) }}</s>
        <strong>{{ money(displayedOffer(type).priceCents) }}</strong>
      </div>
      <div class="product-card__actions"><q-btn v-if="!hasProduct(type)" unelevated color="teal-7" no-caps icon="mdi-cart-outline" label="Adicionar ao carrinho" :disable="displayedOffer(type).available === false" @click="cart?.openCart(type)"/><q-btn flat no-caps icon="mdi-file-document-check-outline" label="Termos" @click="openTerms(type)"/><a :href="definitions[type].link">Conhecer o produto ↗</a></div>
    </article>
  </div>
  <div class="products__privacy"><q-icon name="mdi-shield-lock-outline"/> Seus downloads são privados. Ative cada produto com o token correspondente. <a href="/politica-privacidade" target="_blank" rel="noopener">Privacidade ↗</a></div>
  <q-skeleton v-if="busy&&!data" dark height="220px"/>
  <div v-if="licenses.length" class="products__licenses">
    <article v-for="license in licenses" :key="license._id" class="license-card">
      <header><q-icon :name="definitions[licenseProductType(license)]?.icon||'mdi-license'" size="30px"/><div><small>KIT AITONOTIFY + WHATSAPP BOTBUILDER</small><h2>{{productLabel(licenseProductType(license))}}</h2></div><LicenseValidity :license="license"/></header>
      <div v-if="canRenew(license)" class="license-card__renewal">
        <q-badge v-if="license.sourceId?.startsWith('desktop-trial:') && !license.renewedAt" color="amber-4" text-color="dark" label="Teste de 7 dias" />
        <p>Ao renovar antes do vencimento, o novo prazo é somado à validade atual. Se já venceu, ele começa na confirmação do pagamento.</p>
        <q-btn unelevated no-caps color="teal-7" icon="mdi-calendar-plus" label="Renovar Desktop" :loading="renewing === license._id" @click="renew(license)" />
      </div>
      <q-banner v-if="!licenseValidity(license,now).effectiveActive" rounded class="license-card__notice">{{licenseValidity(license,now).status==='expired'?'O prazo desta licença terminou. Solicite a renovação para continuar utilizando este produto.':'O acesso desta licença está suspenso. Abra um chamado para revisar sua situação.'}}</q-banner>
      <p v-if="licenseProductType(license)==='legacy'" class="license-card__legacy">Condições da compra anterior preservadas. Confira os arquivos autorizados e a validade desta licença.</p>
      <div class="license-card__body">
        <section><h3><q-icon name="mdi-key-outline"/> Sua chave de ativação</h3><p>{{licenseProductType(license)==='desktop'?'Use esta chave somente no aplicativo Desktop.':licenseProductType(license)==='cloud'?'Use esta chave na sua instalação do produto Whitelabel / Cloud.':'Use conforme as condições da sua compra anterior.'}}</p><div class="license-token"><code>{{visible[license._id]?license.token:'••••••••••••••••••••••••'}}</code><q-btn flat round dense :icon="visible[license._id]?'mdi-eye-off-outline':'mdi-eye-outline'" :aria-label="visible[license._id]?'Ocultar token':'Mostrar token'" @click="visible[license._id]=!visible[license._id]"/><q-btn flat round dense icon="mdi-content-copy" aria-label="Copiar token" @click="copy(license.token)"/></div><small>Uma instalação ativa por token. Mantenha a chave em segurança.</small><q-btn flat dense no-caps color="orange-3" icon="mdi-key-change" label="Substituir chave em caso de vazamento" :disable="!licenseValidity(license,now).effectiveActive" @click="rotate(license)"/></section>
        <section><h3><q-icon name="mdi-download-outline"/> Arquivos autorizados</h3><div v-for="type in licensePackages(license)" :key="type" class="download-card"><q-icon :name="definitions[type].icon" size="29px"/><div><strong>{{type==='desktop'?'Instalador Desktop Windows':'Código-fonte Whitelabel / Cloud'}}</strong><small v-if="packageFor(type)">v{{packageFor(type).version}} · {{(packageFor(type).size/1024/1024).toFixed(1)}} MB</small><small v-else>Pacote em preparação</small></div><q-btn no-caps color="teal-7" unelevated icon="mdi-download" :label="packageFor(type)?'Baixar':'Em breve'" :disable="!packageFor(type)||!licenseValidity(license,now).effectiveActive" :loading="downloading===license._id+type" @click="download(license,type)"/></div><small v-if="licenseProductType(license)==='desktop'">Este produto inclui apenas o executável. Código-fonte e Cloud exigem a compra do Whitelabel.</small><q-btn flat no-caps dense icon="mdi-file-document-outline" label="Termos desta licença" @click="openTerms(licenseProductType(license),license)"/></section>
      </div>
      <q-expansion-item dense icon="mdi-information-outline" label="Detalhes da licença e versões" class="license-card__details"><div><p>Emissão: {{date(license.issuedAt||license.createdAt)}} · {{license.ownerType==='whatsapp'?'Compra pelo WhatsApp':'Portal AitoSoftwares'}}</p><p v-for="type in licensePackages(license)" :key="type">{{definitions[type].title}}: {{packageFor(type)?.notes||'Consulte o arquivo help-me incluído no pacote.'}}</p></div></q-expansion-item>
    </article>
  </div>
  <q-banner v-else-if="data" rounded class="products__empty">Seus produtos aparecem aqui após resgatar um teste ou confirmar uma compra.</q-banner>
  <q-expansion-item v-if="data?.orders?.length" icon="mdi-receipt-text-clock-outline" label="Histórico de compras" class="products__orders"><div v-for="order in data.orders" :key="order._id||order.orderNsu" class="order"><div><strong>{{money(order.amountCents)}}</strong><small>{{date(order.paidAt||order.createdAt)}}</small><small>{{order.items?.map(item=>productLabel(item.productType)).join(' + ')||order.product}}</small></div><q-badge :color="order.status==='paid'?'teal-7':'orange-9'" :label="order.status==='paid'?'Confirmado':'Em análise'"/><a v-if="order.receiptUrl" :href="order.receiptUrl" target="_blank" rel="noopener noreferrer">Comprovante ↗</a></div></q-expansion-item>
  <q-dialog v-model="termsOpen"><q-card class="products-terms"><q-card-section class="row items-start"><div class="col"><small>VERSÃO {{selectedTerms?.version}}</small><h2>{{selectedTerms?.title}}</h2></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar termos" v-close-popup/></q-card-section><q-separator dark/><q-card-section class="products-terms__body">{{selectedTerms?.content}}</q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Fechar" v-close-popup/></q-card-actions></q-card></q-dialog>
</section>
</template>
<style scoped>
.products{color:#edfff8}.products a{color:#a2ffe0}.products__top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.products__top>div{flex:1;min-width:0}.products__box{object-fit:contain;align-self:flex-start}.products__top span{font-size:10px;letter-spacing:.14em;color:#a8ffdf}.products__top h1{font-size:clamp(27px,4vw,40px);line-height:1.25;margin:10px 0!important;max-width:none!important;background:none!important;-webkit-text-fill-color:#effff7!important}.products__top p{font-size:13px;line-height:1.8;color:#c2ddd2;max-width:none!important}.products__catalog{display:grid;grid-template-columns:1fr 1fr;gap:20px}.product-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:13px;padding:26px;border:1px solid #397c68;border-radius:21px;background:radial-gradient(ellipse at 0 0,#17694a55,transparent 75%),#082423}.product-card--cloud{border-color:#73639b;background:radial-gradient(ellipse at 0 0,#514c8955,transparent 75%),#141d2b}.product-card>.q-badge{position:absolute;right:18px;top:22px}.product-card>small{font-size:9px;letter-spacing:.12em;color:#b2e1cd}.product-card h2{font-size:23px;line-height:1.35;margin:0;color:white}.product-card p{font-size:13px;line-height:1.9;color:#d0e8dd!important;margin:0;max-width:none!important}.product-card__price{display:flex;gap:13px;align-items:center}.product-card__price s{font-size:13px;color:#b9cfc5}.product-card__price strong{font-size:26px;color:#bcffe6}.product-card__actions{display:flex;gap:8px 12px;flex-wrap:wrap;align-items:center;margin-top:auto}.product-card__actions>a{font-size:11px}.product-card__actions>.q-btn{font-size:12px}.products__privacy{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:24px 0;font-size:11px;line-height:1.8;color:#b5d5c7}.products__licenses{display:grid;gap:25px}.license-card{border:1px solid #346756;border-radius:20px;background:#061e20;overflow:hidden}.license-card>header{display:flex;gap:15px;align-items:center;padding:24px;background:#10382e;border-bottom:1px solid #39634e;flex-wrap:wrap}.license-card>header>div:nth-child(2){flex:1}.license-card small{display:block;font-size:10px;line-height:1.8;color:#b7d8c9}.license-card h2{font-size:23px;line-height:1.4;margin:4px 0;color:white}.license-card__body{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:25px}.license-card__body section{min-width:0}.license-card h3{font-size:15px;line-height:1.5;margin:0 0 14px;display:flex;gap:8px;align-items:center;color:#ecfff6}.license-card__body p,.license-card__legacy{font-size:12px;line-height:1.8;color:#c5e0d3!important;max-width:none!important}.license-token{display:flex;align-items:center;gap:3px;background:#020f10;border:1px solid #4f7d69;border-radius:10px;padding:9px;margin:12px 0}.license-token code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#b9ffe4;font-size:12px}.license-token .q-btn{color:#c0ffe7}.license-card__body>section>.q-btn{margin-top:14px;font-size:11px}.download-card{display:flex;align-items:center;gap:12px;padding:15px 12px;background:#10342d;border:1px solid #507365;border-radius:12px;margin-bottom:12px}.download-card>div{flex:1;min-width:0}.download-card strong{font-size:13px;line-height:1.7}.download-card .q-btn{font-size:11px;min-height:38px}.license-card__details{border-top:1px solid #31554a;font-size:12px;color:#c3dfd0}.license-card__details :deep(.q-expansion-item__content)>div{padding:8px 24px;font-size:12px;line-height:1.9}.license-card__notice{background:#433f21;color:#fff0bb;margin:18px 24px;font-size:12px;line-height:1.8}.license-card__legacy{margin:16px 24px}.products__empty{background:#14372d;color:#e0f8eb;font-size:13px;line-height:1.9}.products__orders{margin-top:25px;border:1px solid #4e7364;border-radius:14px;color:#ddf7e9;overflow:hidden}.order{display:flex;align-items:center;gap:18px;padding:20px;border-top:1px solid #365749;flex-wrap:wrap}.order>div{flex:1;min-width:0}.order small{display:block;color:#c4dbcd;font-size:11px;line-height:1.9}.order a{font-size:12px}.products-terms{display:flex;flex-direction:column;width:790px;max-width:calc(100vw - 24px);max-height:90dvh;border:1px solid #528673;border-radius:19px;background:#08282a;color:#f1fff8}.products-terms h2{font-size:23px;line-height:1.4;overflow-wrap:anywhere;margin:9px 0 0}.products-terms small{font-size:10px;color:#c0ebda}.products-terms__body{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:14px;color:#dfefe4}@media(max-width:850px){.products__catalog,.license-card__body{grid-template-columns:1fr}.license-card__body>section+section{padding-top:22px;border-top:1px solid #355749}}@media(max-width:500px){.product-card{padding:22px 18px}.product-card h2{font-size:21px}.license-card>header{padding:20px}.license-card>header :deep(.license-validity){width:100%}.license-card__body{padding:20px}.download-card{flex-wrap:wrap}.download-card>.q-btn{width:100%}.product-card__actions>.q-btn:first-child{width:100%}}
.product-card__plan{width:min(100%,260px)}
.license-card__renewal{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 24px;border-bottom:1px solid #31554a}.license-card__renewal p{flex:1 1 230px;max-width:none!important;margin:0;font-size:.75rem;line-height:1.6;color:#d6eee4}
</style>
