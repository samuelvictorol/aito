<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import AuthDialog from 'components/AuthDialog.vue'
import AitoIAWallet from 'components/AitoIAWallet.vue'
import LandingVideoMonitor from 'components/landing3d/LandingVideoMonitor.vue'
import { aitoTokens, brl, usd, useAitoIA } from 'src/composables/useAitoIA'
import { aitoTokenPackagePresentation } from 'src/services/aitoTokenPackagePresentation'
import 'src/css/aitoia-theme.css'

const contact = 'https://wa.me/5561982637685?text=Ol%C3%A1%21%20Quero%20conectar%20meu%20projeto%20ao%20AitoTokens.'

const route = useRoute()
const wallet = useAitoIA({ chatHistory: false })
const offers = ref(null)
const offerError = ref(false)
const authOpen = ref(false)
const walletOpen = ref(false)
const requestedPackage = ref(null)
const packAmounts = [500, 1000, 1500, 2500, 5000, 10000]
const packs = computed(() => (offers.value?.plans || packAmounts.map(usdCents => ({ usdCents })))
  .map(pack => ({ ...pack, ...aitoTokenPackagePresentation(pack) })))
const returnPath = computed(() => `/aitotokens${requestedPackage.value ? `?pacote=${requestedPackage.value}` : ''}`)

async function loadOffers() {
  offerError.value = false
  try { offers.value = (await api.get('/aitoia/packages')).data.data }
  catch { offerError.value = true }
}

function openWallet() {
  walletOpen.value = true
  wallet.refreshStatus()
  wallet.loadHistory()
}

function buy(pack) {
  requestedPackage.value = pack.usdCents
  if (wallet.signedIn.value) openWallet()
  else authOpen.value = true
}

async function authenticated() {
  await wallet.syncSession()
  if (wallet.signedIn.value) openWallet()
}

onMounted(() => {
  loadOffers()
  const selected = Number(route.query.pacote)
  if (!packAmounts.includes(selected)) return
  requestedPackage.value = selected
  let opened = false
  watch(wallet.accountId, id => {
    if (!id || opened) return
    opened = true
    openWallet()
  }, { immediate: true })
})
const steps = [
  { icon: 'mdi-key-outline', title: 'Conecte seu projeto', text: 'A AitoSoftwares vincula uma AitoKey ao projeto. Sua aplicação usa essa chave no servidor para enviar solicitações de IA.' },
  { icon: 'mdi-wallet-outline', title: 'Recarregue em reais', text: 'Escolha um pacote em dólares e confira o valor convertido antes de abrir o checkout. O saldo é liberado após a confirmação do pagamento.' },
  { icon: 'mdi-chart-timeline-variant', title: 'Acompanhe o uso', text: 'O consumo é debitado do saldo conforme a quantidade de tokens e o modelo usado. Quando o saldo termina, a IA pausa até a próxima recarga.' },
]
const questions = [
  { title: 'Qual é a diferença entre AitoTokens e uma chave OpenAI?', text: 'AitoTokens são créditos de uso. A AitoKey identifica o projeto na plataforma. A AitoSoftwares opera a integração com a OpenAI e mede o consumo por projeto.' },
  { title: 'Como o uso é cobrado?', text: 'O uso de IA é debitado do seu saldo AitoTokens e fica disponível no histórico de consumo.' },
  { title: 'Quantos AitoTokens recebo em uma recarga?', text: 'O total indicado em cada pacote é o saldo creditado após a confirmação do pagamento. A parcela de bônus já está incluída nesse total.' },
  { title: 'O saldo é perdido se eu trocar a AitoKey?', text: 'O saldo fica vinculado ao projeto. A AitoSoftwares pode substituir a chave, preservando os créditos e o histórico de uso.' },
]

</script>

<template>
  <main class="tokens-landing">
    <header class="tokens-landing__nav">
      <router-link to="/sobre" class="tokens-landing__brand" aria-label="Página inicial da AitoSoftwares">
        <img src="/aito-logo-restored.png" alt="" width="34" height="34" />
        <strong>AitoSoftwares</strong>
      </router-link>
      <a href="#pacotes">Pacotes</a>
      <router-link to="/app">Área do cliente <q-icon name="mdi-arrow-top-right" /></router-link>
    </header>

    <section id="apresentacao" class="tokens-landing__hero" aria-labelledby="aitotokens-title">
      <div class="tokens-landing__intro">
        <p class="tokens-landing__tag">Créditos de IA</p>
        <h1 id="aitotokens-title">Aito<span>Tokens</span></h1>
        <p class="tokens-landing__lead">Converse, crie vídeos e conecte seus projetos com saldo pré-pago.</p>
        <p>Recarregue em reais e use o mesmo saldo no chat, no Estúdio de vídeo e no Estúdio de Marketing. Pague pelo uso de IA, sem assinatura.</p>
        <div class="tokens-landing__actions">
          <a class="tokens-landing__button" href="#pacotes">Ver pacotes <q-icon name="mdi-arrow-down" /></a>
          <router-link class="tokens-landing__link" to="/aitoia">Abrir AitoIA <q-icon name="mdi-message-text-outline" /></router-link>
          <router-link class="tokens-landing__link" to="/aitoia-video-studio">Estúdio de vídeo <q-icon name="mdi-movie-open-play-outline" /></router-link>
          <router-link class="tokens-landing__link" to="/aitoia-marketing-studio">Estúdio de Marketing <q-icon name="mdi-image-multiple-outline" /></router-link>
          <a class="tokens-landing__link" :href="contact" target="_blank" rel="noopener noreferrer">Conectar meu projeto <q-icon name="mdi-arrow-top-right" /></a>
        </div>
      </div>
      <figure class="tokens-landing__visual">
        <LandingVideoMonitor :video="null" video-slot="aitotokens-presentation" title="Apresentação dos AitoTokens" eyebrow="AITOTOKENS" headline="Um saldo para criar com IA." description="Converse, crie imagens e produza vídeos." />
        <figcaption><q-icon name="mdi-swap-horizontal" /> Saldo em dólares · recarga em reais</figcaption>
      </figure>
    </section>

    <section id="pacotes" class="tokens-landing__section tokens-landing__packs" aria-labelledby="tokens-pack-title">
      <div>
        <h2 id="tokens-pack-title">Pacotes de recarga</h2>
        <p>Escolha um pacote e entre na sua conta para pagar em reais pela InfinitePay.</p>
        <p v-if="offerError" role="status">Não foi possível consultar a cotação. <button class="tokens-landing__retry" type="button" @click="loadOffers">Tentar novamente</button></p>
        <p v-else-if="offers?.checkoutConfigured === false" role="status">O checkout de recargas está temporariamente indisponível.</p>
      </div>
      <ul class="tokens-landing__pack-grid" aria-describedby="tokens-pack-title">
        <li v-for="pack in packs" :key="pack.usdCents" :class="`tokens-landing__pack--${pack.tone}`">
          <span class="tokens-landing__usage">{{ pack.usage }}</span>
          <template v-if="pack.totalTokens">
            <p class="tokens-landing__amount"><strong>{{ aitoTokens(pack.baseTokens) }}</strong> AitoTokens</p>
            <span v-if="pack.bonusTokens" class="tokens-landing__bonus"><q-icon name="mdi-gift-outline" aria-hidden="true" /> {{ aitoTokens(pack.bonusTokens) }} AitoTokens de bônus</span>
            <p class="tokens-landing__total">{{ aitoTokens(pack.totalTokens) }} AitoTokens no total</p>
          </template>
          <p v-else class="tokens-landing__total">Saldo disponível na cotação</p>
          <p v-if="Number.isFinite(pack.brlCents)" class="tokens-landing__price">{{ brl(pack.brlCents) }}</p>
          <small class="tokens-landing__dollar">{{ usd(pack.usdCents) }} de recarga</small>
          <button type="button" class="tokens-landing__buy" @click="buy(pack)">Recarregar <q-icon name="mdi-arrow-top-right" /></button>
        </li>
      </ul>
    </section>

    <section class="tokens-landing__section" aria-labelledby="tokens-flow-title">
      <h2 id="tokens-flow-title">Como funciona</h2>
      <div class="tokens-landing__steps">
        <article v-for="step in steps" :key="step.title" class="tokens-landing__card">
          <q-icon :name="step.icon" class="tokens-landing__icon" aria-hidden="true" />
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </article>
      </div>
    </section>

    <section class="tokens-landing__section tokens-landing__faq" aria-labelledby="tokens-faq-title">
      <h2 id="tokens-faq-title">Dúvidas frequentes</h2>
      <div>
        <details v-for="question in questions" :key="question.title">
          <summary>{{ question.title }}</summary>
          <p>{{ question.text }}</p>
        </details>
      </div>
    </section>
    <footer class="tokens-landing__footer">
      <router-link to="/sobre">AitoSoftwares</router-link>
      <router-link to="/politica-privacidade">Privacidade</router-link>
      <router-link to="/termos-servico">Termos de serviço</router-link>
    </footer>
    <AuthDialog v-if="authOpen" v-model="authOpen" initial-mode="login" :return-path="returnPath" :show-project-login="false" @authenticated="authenticated" />
    <AitoIAWallet v-if="walletOpen" v-model="walletOpen" :state="wallet" :initial-package="requestedPackage" />
  </main>
</template>

<style scoped>
.tokens-landing {
  --gold: #795015;
  --ink: #262117;
  --muted: #615546;
  --line: #e8d9bf;
  --button: linear-gradient(120deg, #ffe7a9, #eabd69);
  min-height: 100svh;
  color: var(--ink);
  background: radial-gradient(ellipse at 88% 3%, #f9e3b4 0%, transparent 27rem), linear-gradient(180deg, #fffdf7, #fff 42%, #fffaf0);
  color-scheme: light;
}
.tokens-landing a { color: inherit; }
.tokens-landing__nav, .tokens-landing__hero, .tokens-landing__section, .tokens-landing__footer { width: min(1130px, calc(100% - 3rem)); margin-inline: auto; }
.tokens-landing__nav, .tokens-landing__footer { display: flex; align-items: center; gap: clamp(.75rem, 3vw, 2rem); font-size: .9rem; }
.tokens-landing__nav { min-height: 70px; border-bottom: 1px solid var(--line); }
.tokens-landing__nav a, .tokens-landing__footer a { text-decoration: none; }
.tokens-landing__brand { display: inline-flex; align-items: center; gap: .5rem; margin-right: auto; }
.tokens-landing__brand img { object-fit: contain; }
.tokens-landing__nav a:hover, .tokens-landing__footer a:hover { color: var(--gold); text-decoration: underline; }
.tokens-landing__hero { display: grid; grid-template-columns: 1.05fr 1fr; align-items: center; gap: clamp(1.5rem, 5vw, 4rem); padding-block: clamp(2rem, 6vw, 5rem); }
.tokens-landing__intro { position: relative; z-index: 1; }
.tokens-landing__intro .tokens-landing__tag { color: var(--gold); font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
.tokens-landing h1 { margin: .25rem 0 .8rem; font-family: 'Instrument Sans', 'Inter', system-ui, sans-serif; font-size: clamp(3.3rem, 9vw, 7.5rem); font-weight: 750; line-height: .95; letter-spacing: -.09em; }
.tokens-landing h1 span { color: var(--gold); }
.tokens-landing p { color: var(--muted); line-height: 1.6; }
.tokens-landing__intro .tokens-landing__lead { margin: 0 0 .5rem; color: var(--ink); font-size: clamp(1.3rem, 3vw, 2rem); font-weight: 650; line-height: 1.3; }
.tokens-landing__intro > p:not(.tokens-landing__tag) { max-width: 33rem; }
.tokens-landing__actions { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem 1.3rem; margin-top: 1.5rem; }
.tokens-landing__button, .tokens-landing__link { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-height: 46px; font-weight: 720; }
.tokens-landing__actions .tokens-landing__button { padding: .65rem 1rem; border: 1px solid #d6a14f; border-radius: .6rem; color: #281901; background: var(--button); text-decoration: none; }
.tokens-landing__actions .tokens-landing__button:hover { background: #f6d591; }
.tokens-landing__visual { display: grid; gap: 1.1rem; place-items: center; margin: 0; padding: 1rem 0 0; background: radial-gradient(ellipse at 50% 45%, #efd298aa, transparent 72%); }
.tokens-landing__visual :deep(.video-monitor) { filter: drop-shadow(0 20px 25px #67471926); }
.tokens-landing__visual figcaption { position: relative; padding: .55rem .9rem; border: 1px solid var(--line); border-radius: 2rem; background: #fffaf0; color: var(--gold); text-align: center; font-size: .85rem; }
.tokens-landing__section { padding-block: clamp(2rem, 6vw, 4rem); border-top: 1px solid var(--line); }
.tokens-landing h2 { margin: 0 0 1rem; font-size: clamp(1.65rem, 4vw, 2.8rem); font-weight: 700; line-height: 1.15; letter-spacing: -.035em; }
.tokens-landing__steps, .tokens-landing__pack-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.tokens-landing__card, .tokens-landing__pack-grid li { padding: clamp(1rem, 2.1vw, 1.5rem); border: 1px solid var(--line); border-radius: 1rem; background: #fff; }
.tokens-landing__card h3 { margin: .7rem 0 .35rem; font-size: 1.12rem; font-weight: 730; line-height: 1.25; }
.tokens-landing__card p { margin: 0; }
.tokens-landing__icon { color: var(--gold); font-size: 1.75rem; }
.tokens-landing__pack-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); list-style: none; margin: 1.4rem 0 0; padding: 0; }
.tokens-landing__pack-grid li {
  --pack-tint: #fcf0d7;
  --pack-stroke: #dfc99c;
  --pack-ink: #644417;
  display: grid;
  align-content: start;
  justify-items: start;
  grid-template-rows: min-content min-content min-content 1fr min-content min-content min-content;
  border-color: var(--pack-stroke);
  background: linear-gradient(145deg, var(--pack-tint), #fff 68%);
  box-shadow: 0 10px 24px #6b4b1910;
}
.tokens-landing__pack-grid .tokens-landing__pack--jade { --pack-tint: #e6f4e9; --pack-stroke: #b7d4bf; --pack-ink: #285338; }
.tokens-landing__pack-grid .tokens-landing__pack--lavender { --pack-tint: #f0eafd; --pack-stroke: #d3c5e8; --pack-ink: #4c396d; }
.tokens-landing__pack-grid .tokens-landing__pack--azure { --pack-tint: #e8f2fa; --pack-stroke: #b8cfe0; --pack-ink: #2d506e; }
.tokens-landing__pack-grid .tokens-landing__pack--rose { --pack-tint: #fbeceb; --pack-stroke: #e7c6c1; --pack-ink: #733d37; }
.tokens-landing__pack-grid .tokens-landing__pack--amber { --pack-tint: #f9e5bd; --pack-stroke: #d7ae64; --pack-ink: #69440e; }
.tokens-landing__usage, .tokens-landing__bonus { display: inline-flex; align-items: center; gap: .35rem; width: fit-content; padding: .28rem .63rem; border-radius: 1rem; font-weight: 700; font-size: .79rem; line-height: 1.35; }
.tokens-landing__usage { margin-bottom: .75rem; border: 1px solid var(--pack-stroke); color: var(--pack-ink); background: var(--pack-tint); }
.tokens-landing__bonus { color: #154432; background: linear-gradient(120deg, #e5f6df, #c6ebd6); }
.tokens-landing__pack-grid .tokens-landing__amount { margin: 0 0 .6rem; font-size: 1rem; font-weight: 650; line-height: 1.25; color: var(--pack-ink); }
.tokens-landing__amount strong { display: block; color: var(--ink); font-size: clamp(1.95rem, 4vw, 3.2rem); font-weight: 800; line-height: 1.04; letter-spacing: -.06em; font-variant-numeric: tabular-nums; }
.tokens-landing__pack-grid .tokens-landing__total { margin: .42rem 0 .75rem; font-size: .86rem; }
.tokens-landing__pack-grid .tokens-landing__price { margin: .15rem 0 0; color: var(--ink); font-size: clamp(1.2rem, 2.5vw, 1.6rem); font-weight: 750; line-height: 1.25; }
.tokens-landing__dollar { margin-top: .2rem; color: var(--muted); font-size: .8rem; }
.tokens-landing__buy { display: flex; align-items: center; justify-content: space-between; gap: .3rem; width: 100%; min-height: 44px; margin-top: .8rem; padding: .55rem .75rem; border: 1px solid var(--pack-stroke); border-radius: .65rem; color: var(--pack-ink); background: var(--pack-tint); font: inherit; font-size: .86rem; font-weight: 750; cursor: pointer; }
.tokens-landing__buy:hover { border-color: var(--pack-ink); }
.tokens-landing__retry { color: var(--gold); background: transparent; border: 0; font: inherit; text-decoration: underline; cursor: pointer; }
.tokens-landing__faq { display: grid; grid-template-columns: 1fr 2fr; gap: 1.2rem; }
.tokens-landing details { padding: .85rem 0; border-bottom: 1px solid var(--line); }
.tokens-landing summary { cursor: pointer; font-weight: 680; line-height: 1.45; }
.tokens-landing details p { margin: .5rem 0 0; }
.tokens-landing__footer { padding-block: 1.2rem; color: var(--muted); border-top: 1px solid var(--line); flex-wrap: wrap; }
.tokens-landing :is(a, button, summary):focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }
@media (max-width: 720px) {
  .tokens-landing__hero { min-height: 0; grid-template-columns: 1fr; gap: 1rem; }
  .tokens-landing__steps, .tokens-landing__faq { grid-template-columns: 1fr; }
  .tokens-landing__pack-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .tokens-landing__pack-grid { grid-template-columns: minmax(0, 1fr); }
  .tokens-landing__nav, .tokens-landing__hero, .tokens-landing__section, .tokens-landing__footer { width: calc(100% - 1.8rem); }
  .tokens-landing__nav { gap: .55rem; font-size: .8rem; }
}
</style>
