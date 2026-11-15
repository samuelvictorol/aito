<script setup>
import { ref } from 'vue'
import { useMeta } from 'quasar'
import AitoCodexInstallDialog from 'components/AitoCodexInstallDialog.vue'
import AitoCodexInstallVideo from 'components/AitoCodexInstallVideo.vue'
import LandingVideoMonitor from 'components/landing3d/LandingVideoMonitor.vue'
import { codexOfficialUrl } from 'src/services/aitoCodexInstall'

const guide = ref(false)
const steps = [
  { icon: 'mdi-download-outline', title: 'Instale e abra pelo atalho', text: 'Baixe o Codex oficial para Windows e o plugin AitoIA. O guia copiável ajuda a criar o atalho AitoIA - Codex.' },
  { icon: 'mdi-key-outline', title: 'Conecte a sua AitoKey', text: 'Gere a chave em Meus dados. Informe-a na primeira abertura. O Windows guarda a chave para as próximas sessões.' },
  { icon: 'mdi-console', title: 'Trabalhe no seu projeto', text: 'Abra sua pasta. Peça ao Codex para entender o projeto, implementar uma mudança e rodar os testes com as permissões que você definir.' },
]
const actions = [
  { icon: 'mdi-wallet-outline', title: 'Ver saldo e consumo', prompt: '@AitoIA consulte meu saldo', text: 'Confira seus créditos em dólar, real e AitoTokens.' },
  { icon: 'mdi-tune-variant', title: 'Escolher modelo e esforço', prompt: 'Seletor de modelos do Codex', text: 'Ajuste o modelo GPT e o nível de esforço conforme as opções disponíveis no app.' },
  { icon: 'mdi-update', title: 'Atualizar o plugin', prompt: '@AitoIA abra o atualizador', text: 'Confira a nova versão e confirme o download. A AitoKey continua salva no Windows.' },
]

useMeta({
  title: 'AitoIA para Codex | Agente de código com AitoTokens',
  meta: { description: { name: 'description', content: 'Use o Codex oficial para Windows com seu saldo pré-pago de AitoTokens. Instale o plugin AitoIA, configure uma AitoKey e pague conforme o uso.' } },
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
        <h1>Do card ao código.<br /><span>Codex com AitoTokens.</span></h1>
        <p>Abra seu repositório no Codex para Windows. Peça para investigar um bug, implementar a correção e rodar os testes. Comece com sua conta gratuita do Codex e use AitoTokens pré-pagos, sem mensalidade do plugin.</p>
        <div class="codex-actions">
          <button type="button" class="codex-primary" @click="guide = true"><q-icon name="mdi-download" /> Baixar plugin e guia</button>
          <a :href="codexOfficialUrl" target="_blank" rel="noopener noreferrer">Baixar Codex oficial <q-icon name="mdi-arrow-top-right" /></a>
        </div>
      </div>
      <LandingVideoMonitor video-slot="codex-presentation" :video="{}" title="Demonstração do AitoIA para Codex"
        eyebrow="AITOIA PARA CODEX" headline="Do card à revisão" description="Veja o fluxo de trabalho no aplicativo oficial do Codex." />
    </section>
    <section id="instalacao" class="codex-setup" aria-labelledby="codex-setup-title">
      <h2 id="codex-setup-title">Da instalação à primeira tarefa</h2>
      <AitoCodexInstallVideo class="codex-setup__tutorial" />
      <ol><li v-for="step in steps" :key="step.title"><q-icon :name="step.icon" size="26px" /><strong>{{ step.title }}</strong><p>{{ step.text }}</p></li></ol>
      <h2 class="codex-actions-title">Atalhos no Codex</h2>
      <ul class="codex-command-list"><li v-for="action in actions" :key="action.title"><q-icon :name="action.icon" size="24px" /><strong>{{ action.title }}</strong><code>{{ action.prompt }}</code><p>{{ action.text }}</p></li></ul>
      <div class="codex-wallet"><img src="/aito-logo-restored.png" alt="" width="44" height="44" /><div><strong>Recarregue quando precisar</strong><p>A AitoKey usa o saldo da carteira que você escolheu no painel.</p></div><router-link to="/aitotokens">Ver recargas <q-icon name="mdi-arrow-top-right" /></router-link></div>
    </section>
    <AitoCodexInstallDialog v-model="guide" />
  </main>
</template>

<style scoped>
.codex-landing{min-height:100vh;background:radial-gradient(ellipse at 85% 15%,#143d39 0%,transparent 43%),#071313;color:#effcf8;font-family:'DM Sans',Inter,system-ui,sans-serif;padding-inline:clamp(20px,6vw,110px)}
.codex-top,.codex-hero,.codex-setup{width:min(1320px,100%);margin-inline:auto}.codex-top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-block:23px;border-bottom:1px solid #254742}.codex-top a,.codex-actions a,.codex-wallet a{color:#a9e9d8;text-decoration:none;font-weight:650}.codex-brand{display:inline-flex;align-items:center;gap:8px}.codex-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:clamp(25px,5vw,74px);padding-block:clamp(56px,9vw,138px)}
.codex-identity,.codex-actions{display:flex;align-items:center;flex-wrap:wrap;gap:14px}.codex-identity{font-size:.9rem;font-weight:700;color:#97ddcd}.codex-hero h1{font-size:clamp(2.3rem,5.2vw,5rem);line-height:1.06;letter-spacing:-.055em;font-weight:780;margin:18px 0}.codex-hero h1 span{color:#89edcf}.codex-copy p,.codex-setup p{font-size:1rem;color:#b5ceca;line-height:1.6}.codex-copy p{max-width:44ch;margin:0 0 25px}.codex-primary{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:10px 15px;border:0;border-radius:9px;background:#8debd1;color:#092823;font:inherit;font-weight:750;cursor:pointer}.codex-landing :is(a,button):focus-visible{outline:2px solid #b0ffe9;outline-offset:5px}.codex-setup{padding-bottom:60px}.codex-setup h2{font-size:clamp(1.5rem,3vw,2.5rem);line-height:1.1;letter-spacing:-.03em;font-weight:750;margin:0 0 22px}.codex-setup ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;list-style:none;margin:0;padding:0}.codex-setup li,.codex-wallet{display:grid;align-content:start;gap:10px;padding:19px;border:1px solid #2e5550;border-radius:13px;background:#102524}.codex-setup li .q-icon{color:#89edcf}.codex-setup p{margin:0;font-size:.91rem}.codex-wallet{grid-template-columns:auto 1fr auto;align-items:center;margin-top:18px}.codex-wallet a{justify-self:start}
@media(max-width:790px){.codex-hero{grid-template-columns:1fr}.codex-hero h1{max-width:17ch}.codex-setup ol{grid-template-columns:1fr}.codex-wallet{grid-template-columns:auto 1fr}.codex-wallet a{grid-column:2}}@media(prefers-reduced-motion:reduce){.codex-landing *{scroll-behavior:auto}}
.codex-actions-title{padding-top:34px}.codex-command-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;list-style:none;margin:0;padding:0}.codex-command-list li{background:#13232d;border-color:#3b5660}.codex-command-list code{overflow-wrap:anywhere;color:#a6e2ef;font-size:.85rem}@media(max-width:790px){.codex-command-list{grid-template-columns:1fr}}
.codex-setup__tutorial{width:min(32rem, 100%);margin:0 auto 1.25rem}
</style>
