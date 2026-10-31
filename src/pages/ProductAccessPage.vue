<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
const router = useRouter(), $q = useQuasar()
const busy = ref(false), downloading = ref(false), product = ref(null), message = ref('Conferindo seu acesso de compra…'), visible = ref(false), upgrade = ref(false), email = ref(''), challenge = ref(null), code = ref(''), remember = ref(true)
const accessToken = () => sessionStorage.getItem('aito.productClaim') || ''
const grant = () => sessionStorage.getItem('aito.purchaseGrant') || ''
async function load() {
  busy.value = true
  try {
    if (!grant()) { const response = await api.post('/products/aitonotify/access/consume', { accessToken: accessToken() }); sessionStorage.setItem('aito.purchaseGrant', response.data.data.productGrant) }
    product.value = (await api.post('/products/aitonotify/access/view', { productGrant: grant() })).data.data
    message.value = 'Seu acesso temporário está pronto. Baixe o Desktop e use sua licença no assistente de instalação.'
  } catch (error) { message.value = error.response?.data?.message || 'Não foi possível abrir a compra. Use o link enviado pelo WhatsApp ou entre na sua conta.' }
  finally { busy.value = false }
}
async function download() {
  downloading.value = true
  try { const data = (await api.post('/products/aitonotify/access/download-ticket', { productGrant: grant() })).data.data; window.location.assign(data.url) }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível iniciar o download.' }) }
  finally { downloading.value = false }
}
async function copy() { try { await navigator.clipboard.writeText(product.value.license.token); $q.notify({ type: 'positive', message: 'Token copiado.' }) } catch { $q.notify({ type: 'warning', message: 'Selecione o token e copie manualmente.' }) } }
async function beginUpgrade() {
  busy.value = true
  try { challenge.value = (await api.post('/auth/product-access', { accessToken: accessToken(), email: email.value.trim() }, { withCredentials: true })).data; $q.notify({ type: 'positive', message: challenge.value.message || 'Código enviado. Confira também o spam e o lixo eletrônico.' }) }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível enviar o código.' }) }
  finally { busy.value = false }
}
async function verify() {
  busy.value = true
  try {
    const data = (await api.post('/auth/mfa/verify', { challengeId: challenge.value.challengeId, code: code.value, rememberDevice: remember.value }, { withCredentials: true })).data
    localStorage.setItem('aito_user_token', data.token); localStorage.setItem('aito_user', JSON.stringify(data.user)); sessionStorage.removeItem('aito.productClaim'); sessionStorage.removeItem('aito.purchaseGrant'); router.replace('/app')
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível verificar o código.' }) }
  finally { busy.value = false }
}
async function bindCurrent() {
  busy.value = true
  try { await api.post('/products/aitonotify/claim', { accessToken: accessToken() }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('aito_user_token') } }); sessionStorage.removeItem('aito.productClaim'); sessionStorage.removeItem('aito.purchaseGrant'); router.replace('/app') }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível vincular à conta atual.' }) }
  finally { busy.value = false }
}
const hasSession = Boolean(localStorage.getItem('aito_user_token'))
onMounted(() => {
  const token = new URLSearchParams(location.hash.slice(1)).get('token')
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) { if (token !== accessToken()) sessionStorage.removeItem('aito.purchaseGrant'); sessionStorage.setItem('aito.productClaim', token); history.replaceState(null, '', '/produto/acesso') }
  load()
})
</script>
<template>
  <q-layout><q-page-container><q-page class="purchase-portal"><div class="purchase-shell">
    <header><router-link to="/whatsapp-solucoes"><img src="/aito-logo-restored.png" alt="" width="36" height="36"/><strong>AitoSoftwares</strong></router-link><span><q-icon name="mdi-lock-check-outline"/> Acesso privado à compra</span></header>
    <main><div class="purchase-intro"><span class="eyebrow">KIT AITONOTIFY + WHATSAPP BOTBUILDER</span><h1>Sua operação começa aqui.</h1><p>{{message}}</p><q-linear-progress v-if="busy && !product" indeterminate color="teal"/><q-btn v-if="!product && !busy" flat no-caps color="teal" icon="mdi-refresh" label="Tentar novamente" @click="load"/></div>
      <div v-if="product" class="purchase-grid"><article class="purchase-card"><q-icon name="mdi-microsoft-windows" size="39px" color="teal"/><span class="card-label">DESKTOP · WINDOWS</span><h2>{{product.desktop ? 'Tudo pronto para instalar.' : 'Pacote em preparação.'}}</h2><p v-if="product.desktop">Versão {{product.desktop.version}} · {{(product.desktop.size/1024/1024).toFixed(1)}} MB<br/>{{product.desktop.filename}}</p><p>Instalador com serviços locais. Configure sua licença e seu administrador no primeiro acesso.</p><q-btn unelevated color="teal-8" no-caps icon="mdi-download" label="Baixar Desktop" :disable="!product.desktop" :loading="downloading" @click="download"/><q-btn outline no-caps color="grey-7" icon="mdi-cloud-outline" label="Cloud / Render API · Em breve" disable/><small>O download é privado e o link gerado funciona uma única vez. Este painel temporário expira em 15 minutos.</small></article><article class="purchase-card license-card"><q-icon name="mdi-shield-key-outline" size="39px" color="teal"/><span class="card-label">SUA LICENÇA</span><h2>{{product.license.ownerName || 'Sua compra confirmada'}}</h2><p>Guarde o token para ativar o aplicativo. Uma instalação autorizada por licença.</p><div class="license-token"><code>{{visible ? product.license.token : '••••••••••••••••••••••••••••'}}</code><q-btn flat round dense :icon="visible ? 'mdi-eye-off' : 'mdi-eye'" aria-label="Mostrar ou ocultar token" @click="visible=!visible"/><q-btn flat round dense icon="mdi-content-copy" aria-label="Copiar token da licença" @click="copy"/></div><p>Quer encontrar sua licença e novos downloads depois? Vincule a compra ao seu e-mail, sem precisar criar uma senha agora.</p><q-btn unelevated color="teal-8" no-caps icon="mdi-email-check-outline" label="Vincular à minha conta" @click="upgrade=true"/><q-btn v-if="hasSession" flat no-caps label="Vincular à conta já conectada" :loading="busy" @click="bindCurrent"/></article></div>
      <q-card v-if="upgrade || !product" flat bordered class="upgrade-card"><q-card-section><h2>Seu acesso permanente, com proteção.</h2><template v-if="!challenge"><p>Informe seu e-mail para confirmar a identidade. Para compras já vinculadas, use o e-mail da conta original.</p><q-form @submit.prevent="beginUpgrade"><q-input v-model.trim="email" outlined type="email" label="Seu e-mail" autocomplete="email" :rules="[value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||'Informe um e-mail válido']"/><q-btn type="submit" unelevated no-caps color="teal-8" label="Receber código por e-mail" :loading="busy"/></q-form></template><template v-else><p>{{challenge.message || 'Enviamos seu código por e-mail. Confira também o spam e o lixo eletrônico.'}} <strong>{{challenge.emailMasked}}</strong></p><q-form @submit.prevent="verify"><q-input v-model="code" outlined label="Código de seis dígitos" inputmode="numeric" autocomplete="one-time-code" maxlength="6"/><q-checkbox v-model="remember" label="Manter acesso neste dispositivo por 120 dias" color="teal"/><q-btn type="submit" unelevated no-caps color="teal-8" label="Confirmar e abrir meu painel" :loading="busy" :disable="!/^\d{6}$/.test(code)"/></q-form></template></q-card-section></q-card>
      <div class="purchase-footer"><q-icon name="mdi-shield-check-outline"/> Somente a compra indicada neste link fica disponível. Configurações administrativas exigem autenticação própria.<router-link to="/whatsapp-solucoes">Conhecer o kit →</router-link></div>
    </main></div></q-page></q-page-container></q-layout>
</template>
<style scoped>
.purchase-portal{background:radial-gradient(ellipse at top right,#c8f6e1,transparent 60%),#f2f9f6;color:#133c31;padding:0 20px 45px}.purchase-shell{max-width:1120px;margin:auto}.purchase-shell>header{display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid #cfdfd7;padding:22px 0}.purchase-shell>header>a{display:flex;align-items:center;gap:9px;text-decoration:none;color:#133c31;font-size:18px}.purchase-shell>header>span{font-size:11px;color:#568372;display:flex;align-items:center;gap:6px}.purchase-intro{padding:55px 0 32px;max-width:760px}.eyebrow{font-size:10px;letter-spacing:.12em;font-weight:800;color:#227b60}h1{font-size:clamp(32px,5vw,57px);line-height:1.12;letter-spacing:-.04em;margin:16px 0 21px}p{line-height:1.85;font-size:14px;color:#587467}.purchase-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.purchase-card{display:flex;flex-direction:column;align-items:flex-start;padding:30px;border:1px solid #c5e0d2;border-radius:22px;background:#ffffffd9;min-width:0;gap:12px}.purchase-card h2{font-size:26px;line-height:1.3;margin:0;color:#143d2e}.purchase-card p{font-size:13px;overflow-wrap:anywhere;margin:0}.purchase-card>.q-btn{width:100%;min-height:46px}.purchase-card small{font-size:10px;line-height:1.8;color:#6f8b7d}.card-label{font-size:9px;font-weight:800;letter-spacing:.12em;color:#408169}.license-token{display:flex;gap:5px;align-items:center;width:100%;padding:13px 8px;background:#e8f5ed;border:1px solid #c4dfd0;border-radius:12px}.license-token code{flex:1;min-width:0;overflow-wrap:anywhere;font-size:11px;color:#1b6045}.upgrade-card{margin-top:25px;border-color:#b9d9c8;border-radius:20px;background:#fff;padding:15px}.upgrade-card h2{font-size:25px;line-height:1.4;margin:0}.upgrade-card form{display:grid;gap:15px;max-width:620px}.purchase-footer{display:flex;align-items:center;gap:8px;margin:25px 0;font-size:10px;line-height:1.8;color:#5e7d6e}.purchase-footer a{margin-left:auto;white-space:nowrap;color:#156544}@media(max-width:650px){.purchase-portal{padding:0 15px 25px}.purchase-shell>header>span{max-width:120px;font-size:9px}.purchase-shell>header>a{font-size:15px}.purchase-intro{padding:35px 0 20px}.purchase-grid{grid-template-columns:1fr}.purchase-card{padding:24px}.purchase-card h2{font-size:23px}.purchase-footer{flex-wrap:wrap}.purchase-footer a{margin-left:0}.upgrade-card{padding:6px}.upgrade-card h2{font-size:21px}}
</style>
