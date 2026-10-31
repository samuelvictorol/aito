<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { api, apiBaseURL } from 'boot/axios'
import { io } from 'socket.io-client'
import { useQuasar } from 'quasar'
import LoginMfaDialog from './LoginMfaDialog.vue'
import LicenseValidity from './LicenseValidity.vue'
import { licenseValidity } from 'src/services/license-validity'
const $q = useQuasar()
const reauthOpen=ref(false), reauthChallenge=ref(null), pendingRotation=ref(null)
const licenseNow=ref(Date.now())
const data = ref(null), busy = ref(false), downloading = ref(''), visible = ref({})
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('aito_user_token') || ''}` } })
const cloudPackage=computed(()=>data.value?.downloads?.cloud || (data.value?.downloads?.render?.available?data.value.downloads.render:null))
const date=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—'
const money = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
async function load() {
  busy.value = true
  try { data.value = (await api.get('/products/aitonotify', headers())).data.data }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível carregar seus produtos.' }) }
  finally { busy.value = false }
}
async function buy() {
  busy.value = true
  try {
    const order = (await api.post('/products/aitonotify/checkout', {}, headers())).data.data
    window.location.assign(order.checkoutUrl)
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível criar o checkout.' }) }
  finally { busy.value = false }
}
async function performRotate(license) { try { await api.post('/products/aitonotify/licenses/'+license._id+'/rotate',{},headers()); await load(); $q.notify({type:'positive',message:'Token anterior revogado. Atualize a instalação com o novo token.'}) } catch(error) { $q.notify({type:'negative',message:error.response?.data?.message || 'Não foi possível renovar a licença.'}) } }
async function rotate(license) {
  $q.dialog({title:'Revogar token e gerar outro',message:'O token atual deixará de funcionar nas instalações vinculadas. Para proteger sua licença, podemos solicitar uma nova validação por e-mail.',cancel:true,persistent:true}).onOk(async()=>{
    try { const token=localStorage.getItem('aito_user_token') || ''; const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); if(claims.mfa && Number(claims.mfaAt)>Date.now()/1000-300) return performRotate(license) } catch { /* The server validates the session. */ }
    try { pendingRotation.value=license; reauthChallenge.value=(await api.post('/auth/mfa/reauth',{},headers())).data; reauthOpen.value=true } catch(error) { $q.notify({type:'negative',message:error.response?.data?.message || 'Não foi possível enviar o código de confirmação.'}) }
  })
}
async function verifiedRotation(result) { localStorage.setItem('aito_user_token',result.token); localStorage.setItem('aito_user',JSON.stringify(result.user)); if(pendingRotation.value) await performRotate(pendingRotation.value); pendingRotation.value=null }
async function download(license,type='desktop') { downloading.value = license._id; try { const result=(await api.post('/products/aitonotify/download-ticket',{licenseId:license._id,package:type},headers())).data.data; window.location.assign(result.url) } catch(error) { $q.notify({type:'negative',message:error.response?.data?.message || 'Não foi possível iniciar o download. Atualize a página e tente novamente.'}) } finally { downloading.value='' } }
async function copy(token) { await navigator.clipboard.writeText(token); $q.notify({ type: 'positive', message: 'Token copiado.' }) }
let productSocket, timer, expiryTimer
onMounted(() => { expiryTimer=setInterval(()=>{licenseNow.value=Date.now()},1000); load(); const url = new URL(apiBaseURL, window.location.origin); productSocket = io(`${url.origin}/products`, { auth: { token: localStorage.getItem('aito_user_token') } }); productSocket.on('purchase.updated', load); productSocket.on('connect', load); timer = setInterval(() => { if (data.value?.orders?.some(order => order.status === 'pending')) load() }, 15000) })
onBeforeUnmount(() => { productSocket?.disconnect(); clearInterval(timer); clearInterval(expiryTimer) })
</script>
<template>
  <section class="products"><LoginMfaDialog v-model="reauthOpen" :challenge="reauthChallenge" @verified="verifiedRotation"/><div class="products__top"><div><span>SEUS PRODUTOS</span><h2>Kit AitoNotify + WhatsApp BotBuilder</h2></div><q-btn flat round icon="mdi-refresh" aria-label="Atualizar compras" :loading="busy" @click="load" /></div>
    <p>Seu instalador Desktop e a licença aparecem aqui após a confirmação do pagamento pela InfinitePay.</p>
    <div v-if="data?.licenses?.length" class="products__grid"><article v-for="license in data.licenses" :key="license._id"><q-icon name="mdi-shield-check-outline" size="32px" color="teal-3" /><h3>Sua licença</h3><LicenseValidity :license="license"/><p>Use o token no assistente Desktop ou na configuração do deploy Render.</p><small>Origem: {{license.ownerType==='whatsapp'?'Compra pelo WhatsApp':license.sourceId?.startsWith('admin-grant:')?'Acesso liberado pela equipe':'Compra pelo site'}} · {{date(license.issuedAt||license.createdAt)}}</small><q-banner v-if="!licenseValidity(license,licenseNow).effectiveActive" rounded class="products__license-notice">{{licenseValidity(license,licenseNow).status==='expired'?'O prazo desta licença terminou. Seu histórico continua disponível; solicite a renovação à equipe para voltar a usar o aplicativo.':'Esta licença está suspensa. Seu histórico continua disponível; fale com a equipe para revisar o acesso.'}}</q-banner><div class="products__token"><code>{{ visible[license._id] ? license.token : '••••••••••••••••••••••••' }}</code><q-btn flat dense :icon="visible[license._id] ? 'mdi-eye-off' : 'mdi-eye'" @click="visible[license._id] = !visible[license._id]" /><q-btn flat dense icon="mdi-content-copy" @click="copy(license.token)" /></div><small>Uma instalação autorizada por licença. Ao renovar o token, o anterior será revogado.</small><q-btn flat no-caps color="orange-3" label="Revogar e gerar novo token" icon="mdi-key-change" :disable="!licenseValidity(license,licenseNow).effectiveActive" @click="rotate(license)"/><div class="products__links"><q-btn unelevated no-caps color="teal-7" icon="mdi-microsoft-windows" :label="data.downloads?.desktop ? 'Baixar Desktop · v'+data.downloads.desktop.version : 'Desktop · disponível em breve'" :disable="!licenseValidity(license,licenseNow).effectiveActive || !data.downloads?.desktop" :loading="downloading===license._id" @click="download(license)"/><q-btn outline no-caps color="teal-3" icon="mdi-cloud-outline" :label="cloudPackage?'Baixar Cloud · v'+cloudPackage.version:'Cloud / Render · Em breve'" :disable="!licenseValidity(license,licenseNow).effectiveActive || !cloudPackage" :loading="downloading===license._id" @click="download(license,'cloud')"/><a v-if="data.product.tutorialUrl" :href="data.product.tutorialUrl" target="_blank" rel="noopener noreferrer">Passo a passo / vídeo ↗</a></div><small v-if="data.downloads?.desktop">{{data.downloads.desktop.filename}} · {{(data.downloads.desktop.size/1024/1024).toFixed(1)}} MB · Download privado, liberado pela sua licença ativa.</small><small v-if="cloudPackage">{{cloudPackage.filename}} · {{(cloudPackage.size/1024/1024).toFixed(1)}} MB</small><p v-if="cloudPackage?.notes" class="products__release-notes">{{cloudPackage.notes}}</p></article></div>
    <article v-else class="products__offer"><h3>Construa seus fluxos de WhatsApp</h3><p>Editor visual, mensagens, ações, IA e pagamentos. O código é liberado depois que a InfinitePay confirma sua compra.</p><strong v-if="data?.product?.priceCents != null"><template v-if="data.product.originalPriceCents > data.product.priceCents">De {{ money(data.product.originalPriceCents) }} por </template>{{ money(data.product.priceCents) }}</strong><q-btn unelevated no-caps color="teal-7" icon="mdi-cart-outline" label="Comprar com InfinitePay" :loading="busy" :disable="!data?.product?.available" @click="buy" /></article>
    <q-expansion-item v-if="data?.orders?.length" icon="mdi-receipt-text-clock-outline" label="Histórico de compras" default-opened class="products__history"><div v-for="order in data.orders" :key="order._id||order.orderNsu" class="products__order"><div><strong>{{money(order.amountCents)}}</strong><span>{{date(order.paidAt||order.createdAt)}}</span><code>{{order.orderNsu}}</code></div><q-badge :color="order.status==='paid'?'teal-7':'orange-9'" :label="order.status==='paid'?'Pagamento confirmado':'Aguardando pagamento'"/><a v-if="order.receiptUrl" :href="order.receiptUrl" target="_blank" rel="noopener noreferrer">Comprovante ↗</a></div></q-expansion-item>
    <p v-if="data?.orders?.some(order => order.status === 'pending')" class="products__pending">Pagamento em análise. Se concluiu o checkout, atualize esta tela em alguns instantes.</p>
  </section>
</template>
<style scoped>
.products{color:#effffb}.products__top{display:flex;align-items:center;justify-content:space-between}.products__top span{color:#8fffee;font-size:.7rem;font-weight:800;letter-spacing:.14em}.products h2{font-size:clamp(1.5rem,3vw,2.4rem);line-height:1.2;margin:.3rem 0}.products h3{font-size:clamp(23px,3vw,30px);line-height:1.25;margin:16px 0}.products p,.products small{color:rgba(239,255,251,.7)}.products__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.products article{padding:1.4rem;border:1px solid rgba(19,188,157,.3);border-radius:1rem;background:rgba(4,24,25,.82)}.products__token{display:flex;align-items:center;gap:.4rem;min-width:0;overflow:auto;padding:.5rem;border-radius:.5rem;background:#03110f}.products__token code{flex:1;overflow:hidden;text-overflow:ellipsis}.products__links{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1rem}.products a{color:#8fffee}.products__offer{display:grid;justify-items:start;gap:.7rem;max-width:600px}.products__offer strong{color:#8fffee}.products__pending{margin-top:1rem}
</style>


<style scoped>.products__license-notice{margin:15px 0;background:#4a3d255c;color:#f4dbb2;font-size:12px;line-height:1.8;border:1px solid #796239}.products__history{margin-top:25px;border:1px solid #315b4d;border-radius:15px;overflow:hidden}.products__order{display:flex;align-items:center;gap:14px;padding:18px;border-top:1px solid #23483b}.products__order>div{flex:1;min-width:0}.products__order strong,.products__order span,.products__order code{display:block;line-height:1.8}.products__order strong{font-size:15px}.products__order span,.products__order a{font-size:11px;color:#aac9b9}.products__order code{font-size:10px;overflow-wrap:anywhere;color:#8caf9b}.products__release-notes{white-space:pre-wrap;font-size:11px!important;line-height:1.8}@media(max-width:600px){.products__order{flex-wrap:wrap}.products__order>div{flex-basis:100%}.products__links{flex-direction:column}.products__links>.q-btn{width:100%}}</style>
