<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMeta } from 'quasar'
import AitoCodexInstallDialog from 'components/AitoCodexInstallDialog.vue'
import AitoCodexInstallVideo from 'components/AitoCodexInstallVideo.vue'
import AitoCodexThemeShortcut from 'components/AitoCodexThemeShortcut.vue'
import LandingVideoMonitor from 'components/landing3d/LandingVideoMonitor.vue'
import { api } from 'boot/axios'
import { codexOfficialUrl } from 'src/services/aitoCodexInstall'

const guide = ref(false)
const entryPrice = ref('')
const offersRequest = new AbortController()
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const registration = { name: 'aito-ia', query: { auth: 'register' } }
onMounted(async () => {
  try {
    const { data } = await api.get('/aitoia/packages', { signal: offersRequest.signal })
    const plan = data?.data?.plans?.find(item => item.usdCents === 500)
    if (data?.data?.checkoutConfigured && Number.isFinite(plan?.brlCents) && plan.brlCents > 0) {
      entryPrice.value = reais.format(plan.brlCents / 100)
    }
  } catch { /* The USD package is still the price reference. */ }
})
onBeforeUnmount(() => offersRequest.abort())
const steps = [
  { icon: 'mdi-download-outline', title: 'Abra o instalador no Windows', text: 'Instale o Codex oficial, extraia o ZIP e abra Iniciar AitoIA.exe. Ele cria os atalhos AitoIA - Codex e Configurar AitoCodex Key.' },
  { icon: 'mdi-key-outline', title: 'Conecte a sua AitoKey', text: 'Gere a chave em Meus dados e informe-a na janela que abre automaticamente na primeira vez. O Windows guarda a chave para as próximas sessões.' },
  { icon: 'mdi-console', title: 'Trabalhe no seu projeto', text: 'Abra sua pasta. Peça ao Codex para entender o projeto, implementar uma mudança e rodar os testes com as permissões que você definir.' },
]
const actions = [
  { icon: 'mdi-wallet-outline', title: 'Ver saldo e consumo', prompt: '@AitoIA consulte meu saldo', text: 'Confira seus créditos em dólar, real e AitoTokens.' },
  { icon: 'mdi-key-variant', title: 'Trocar a AitoKey', prompt: '@AitoIA Abra Configurar AitoCodex Key', text: 'Se regenerar a chave no painel, atualize-a na janela protegida. Você também pode usar o atalho com a chave verde na Área de Trabalho.' },
  { icon: 'mdi-tune-variant', title: 'Escolher modelo e esforço', prompt: 'Seletor de modelos do Codex', text: 'Ajuste o modelo GPT e o nível de esforço conforme as opções disponíveis no app.' },
  { icon: 'mdi-update', title: 'Atualizar o plugin', prompt: '@AitoIA abra o atualizador', text: 'Confira a nova versão e confirme o download. A AitoKey continua salva no Windows.' },
]

useMeta({
  title: 'AitoIA para Codex | GPT-6.1 e Higgsfield com AitoTokens',
  meta: { description: { name: 'description', content: 'Use GPT-6.1 no Codex oficial para Windows e crie vídeos com Higgsfield no AitoIA usando a mesma carteira. Ganhe 50.000 AitoTokens no primeiro cadastro.' } },
  link: { canonical: { rel: 'canonical', href: 'https://aitosoftwares.com/aitoia-codex' } },
})
</script>

<template>
  <main class="codex-landing">
    <header class="codex-top">
      <router-link to="/sobre" class="codex-brand"><img src="/aito-logo-restored.png" alt="" width="34" height="34" /> AitoSoftwares</router-link>
      <router-link to="/app?tab=profile">Minha conta <q-icon name="mdi-arrow-top-right" /></router-link>
    </header>
    <section id="demonstracao" class="codex-hero">
      <div class="codex-copy">
        <div class="codex-identity"><img src="/codex-app-icon.png" alt="" width="25" height="25" /> AitoIA para Codex</div>
        <h1>Do código ao vídeo.<br /><span>Um saldo só.</span></h1>
        <p>Abra seu repositório no Codex oficial para Windows e use GPT‑6.1 para investigar bugs, editar e testar. No site do AitoIA, converse com GPT‑6 e gere vídeos com Higgsfield usando a mesma carteira.</p>
        <div class="codex-actions">
          <button type="button" class="codex-primary" @click="guide = true"><q-icon name="mdi-download" /> Baixar plugin e guia</button>
          <a :href="codexOfficialUrl" target="_blank" rel="noopener noreferrer">Codex oficial para Windows <q-icon name="mdi-arrow-top-right" /></a>
        </div>
        <router-link :to="registration" class="codex-bonus">
          <img src="/aitotokens.svg" alt="" width="37" height="37" />
          <span><strong>Ganhe 50.000 AitoTokens</strong><small>Grátis no primeiro cadastro</small></span>
          <q-icon name="mdi-arrow-right" size="20px" />
        </router-link>
        <p class="codex-price">Recarga a partir de <strong>{{ entryPrice || 'US$ 5,00' }}</strong><template v-if="entryPrice"> · US$ 5,00 na cotação atual</template>. Pague conforme o uso.</p>
      </div>
      <LandingVideoMonitor video-slot="codex-presentation" :video="{}" title="Demonstração do AitoIA para Codex"
        eyebrow="AITOIA PARA CODEX" headline="Do card à revisão" description="Veja o fluxo de trabalho no aplicativo oficial do Codex." />
    </section>
    <nav class="codex-products" aria-label="Use sua carteira AitoTokens">
      <a :href="codexOfficialUrl" target="_blank" rel="noopener noreferrer"><q-icon name="mdi-code-braces" /><span><strong>Codex para Windows</strong><small>GPT‑6.1 Sol com sua AitoKey</small></span><q-icon name="mdi-arrow-top-right" /></a>
      <router-link to="/"><q-icon name="mdi-message-text-outline" /><span><strong>Chat AitoIA</strong><small>Família GPT‑6 no navegador</small></span><q-icon name="mdi-arrow-right" /></router-link>
      <router-link to="/aitoia-video-studio"><q-icon name="mdi-movie-open-play-outline" /><span><strong>Estúdio de vídeo</strong><small>Gere e edite com Higgsfield</small></span><q-icon name="mdi-arrow-right" /></router-link>
    </nav>
    <section id="instalacao" class="codex-setup" aria-labelledby="codex-setup-title">
      <h2 id="codex-setup-title">Da instalação à primeira tarefa</h2>
      <AitoCodexInstallVideo class="codex-setup__tutorial" />
      <ol><li v-for="step in steps" :key="step.title"><q-icon :name="step.icon" size="26px" /><strong>{{ step.title }}</strong><p>{{ step.text }}</p></li></ol>
      <h2 class="codex-actions-title">Atalhos no Codex</h2>
      <ul class="codex-command-list"><li v-for="action in actions" :key="action.title"><q-icon :name="action.icon" size="24px" /><strong>{{ action.title }}</strong><code>{{ action.prompt }}</code><p>{{ action.text }}</p></li></ul>
      <p class="codex-plan-note">A AitoKey habilita uso da API no Codex. Benefícios da assinatura ChatGPT Pro seguem o plano da sua conta OpenAI.</p>
      <div class="codex-wallet"><img src="/aito-logo-restored.png" alt="" width="44" height="44" /><div><strong>Recarregue quando precisar</strong><p>A AitoKey usa o saldo da carteira que você escolheu no painel.</p></div><router-link to="/aitotokens">Ver recargas <q-icon name="mdi-arrow-top-right" /></router-link></div>
    </section>
    <AitoCodexInstallDialog v-model="guide" />
    <AitoCodexThemeShortcut />
  </main>
</template>

<style scoped>
.codex-landing{min-height:100vh;background:radial-gradient(ellipse at 85% 15%,#143d39 0%,transparent 43%),#071313;color:#effcf8;font-family:'DM Sans',Inter,system-ui,sans-serif;padding-inline:clamp(20px,6vw,110px)}
.codex-top,.codex-hero,.codex-setup{width:min(1320px,100%);margin-inline:auto}.codex-top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-block:23px;border-bottom:1px solid #254742}.codex-top a,.codex-actions a,.codex-wallet a{color:#a9e9d8;text-decoration:none;font-weight:650}.codex-brand{display:inline-flex;align-items:center;gap:8px}.codex-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:clamp(25px,5vw,74px);padding-block:clamp(56px,9vw,138px)}
.codex-identity,.codex-actions{display:flex;align-items:center;flex-wrap:wrap;gap:14px}.codex-identity{font-size:.9rem;font-weight:700;color:#97ddcd}.codex-hero h1{font-size:clamp(2.3rem,5.2vw,5rem);line-height:1.06;letter-spacing:-.055em;font-weight:780;margin:18px 0}.codex-hero h1 span{color:#89edcf}.codex-copy p,.codex-setup p{font-size:1rem;color:#b5ceca;line-height:1.6}.codex-copy p{max-width:44ch;margin:0 0 25px}.codex-primary{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:10px 15px;border:0;border-radius:9px;background:#8debd1;color:#092823;font:inherit;font-weight:750;cursor:pointer}.codex-landing :is(a,button):focus-visible{outline:2px solid #b0ffe9;outline-offset:5px}.codex-setup{padding-bottom:calc(5rem + env(safe-area-inset-bottom))}.codex-setup h2{font-size:clamp(1.5rem,3vw,2.5rem);line-height:1.1;letter-spacing:-.03em;font-weight:750;margin:0 0 22px}.codex-setup ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;list-style:none;margin:0;padding:0}.codex-setup li,.codex-wallet{display:grid;align-content:start;gap:10px;padding:19px;border:1px solid #2e5550;border-radius:13px;background:#102524}.codex-setup li .q-icon{color:#89edcf}.codex-setup p{margin:0;font-size:.91rem}.codex-wallet{grid-template-columns:auto 1fr auto;align-items:center;margin-top:18px}.codex-wallet a{justify-self:start}
@media(max-width:790px){.codex-hero{grid-template-columns:1fr}.codex-hero h1{max-width:17ch}.codex-setup ol{grid-template-columns:1fr}.codex-wallet{grid-template-columns:auto 1fr}.codex-wallet a{grid-column:2}}@media(prefers-reduced-motion:reduce){.codex-landing *{scroll-behavior:auto}}
.codex-actions-title{padding-top:34px}.codex-command-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px;list-style:none;margin:0;padding:0}.codex-command-list li{background:#13232d;border-color:#3b5660}.codex-command-list code{overflow-wrap:anywhere;color:#a6e2ef;font-size:.85rem}
.codex-setup__tutorial{width:min(32rem, 100%);margin:0 auto 1.25rem}
.codex-hero{padding-bottom:clamp(30px,5vw,70px)}
.codex-bonus{display:flex;align-items:center;gap:12px;width:max-content;max-width:100%;margin-top:21px;padding:9px 13px;border:1px solid #dbb867;border-radius:12px;background:linear-gradient(110deg,#fce8a9,#e9b967);color:#30210d;text-decoration:none}
.codex-bonus span,.codex-products span{display:grid;gap:2px;flex:1}.codex-bonus small,.codex-products small{font-size:.81rem}
.codex-copy .codex-price{margin:9px 0 0;font-size:.85rem}.codex-price strong{color:#d5faed}
.codex-products{width:min(1320px,100%);margin:0 auto clamp(30px,6vw,68px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.codex-products a{display:flex;align-items:center;gap:11px;padding:13px 16px;border:1px solid #31534e;border-radius:12px;background:#102524;color:#effcf8;text-decoration:none}.codex-products a:hover{background:#16332f}.codex-products small{color:#a9c8c1}.codex-products .q-icon{font-size:1.22rem;color:#89edcf}
.codex-setup .codex-plan-note{margin-top:15px}
@media(max-width:680px){.codex-products{grid-template-columns:1fr}}
</style>
