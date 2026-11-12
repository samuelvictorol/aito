<script setup>
import { useMeta } from 'quasar'

const title = 'AitoTokens | Créditos de IA para produtos e projetos'
const description = 'Controle o consumo de IA com AitoTokens. Recarregue em reais, acompanhe o uso e conecte seu projeto com uma AitoKey.'
const url = 'https://aitosoftwares.com/aitotokens'
const contact = 'https://wa.me/5561982637685?text=Ol%C3%A1%21%20Quero%20conectar%20meu%20projeto%20ao%20AitoTokens.'

const packs = [5, 15, 50, 100]
const steps = [
  { icon: 'mdi-key-outline', title: 'Conecte seu projeto', text: 'A AitoSoftwares vincula uma AitoKey ao projeto. Sua aplicação usa essa chave no servidor para enviar solicitações de IA.' },
  { icon: 'mdi-wallet-outline', title: 'Recarregue em reais', text: 'Escolha um pacote em dólares e confira o valor convertido antes de abrir o checkout. O saldo é liberado após a confirmação do pagamento.' },
  { icon: 'mdi-chart-timeline-variant', title: 'Acompanhe o uso', text: 'O consumo é debitado do saldo conforme a quantidade de tokens e o modelo usado. Quando o saldo termina, a IA pausa até a próxima recarga.' },
]
const questions = [
  { title: 'Qual é a diferença entre AitoTokens e uma chave OpenAI?', text: 'AitoTokens são créditos de uso. A AitoKey identifica o projeto na plataforma. A AitoSoftwares opera a integração com a OpenAI e mede o consumo por projeto.' },
  { title: 'Como o uso é cobrado?', text: 'O débito em AitoTokens equivale a duas vezes o custo da OpenAI para a mesma solicitação. Uma metade cobre o provedor e a outra é a taxa de uso da AitoSoftwares.' },
  { title: 'Quantos tokens recebo em uma recarga?', text: 'A recarga adiciona um valor em dólares ao saldo. A quantidade estimada de tokens depende do modelo e da proporção entre entrada e saída, por isso varia com o uso.' },
  { title: 'O saldo é perdido se eu trocar a AitoKey?', text: 'O saldo fica vinculado ao projeto. A AitoSoftwares pode substituir a chave, preservando os créditos e o histórico de uso.' },
]

useMeta({
  title,
  meta: {
    description: { name: 'description', content: description },
    ogTitle: { property: 'og:title', content: title },
    ogDescription: { property: 'og:description', content: description },
    ogUrl: { property: 'og:url', content: url },
    ogType: { property: 'og:type', content: 'website' },
  },
  link: { canonical: { rel: 'canonical', href: url } },
})
</script>

<template>
  <main class="tokens-landing">
    <header class="tokens-landing__nav">
      <router-link to="/" class="tokens-landing__brand" aria-label="Página inicial da AitoSoftwares">
        <img src="/aito-logo-restored.png" alt="" width="34" height="34" />
        <strong>AitoSoftwares</strong>
      </router-link>
      <a href="#pacotes">Pacotes</a>
      <router-link to="/app">Área do cliente <q-icon name="mdi-arrow-top-right" /></router-link>
    </header>

    <section class="tokens-landing__hero" aria-labelledby="aitotokens-title">
      <div class="tokens-landing__intro">
        <p class="tokens-landing__tag">Créditos de IA</p>
        <h1 id="aitotokens-title">Aito<span>Tokens</span></h1>
        <p class="tokens-landing__lead">Use IA nos seus projetos com saldo pré-pago.</p>
        <p>Conecte sua aplicação com uma AitoKey, recarregue em reais e acompanhe quanto cada projeto consome.</p>
        <div class="tokens-landing__actions">
          <a class="tokens-landing__button" href="#pacotes">Ver pacotes <q-icon name="mdi-arrow-down" /></a>
          <a class="tokens-landing__link" :href="contact" target="_blank" rel="noopener noreferrer">Conectar meu projeto <q-icon name="mdi-arrow-top-right" /></a>
        </div>
      </div>
      <figure class="tokens-landing__visual">
        <img src="/aitotokens.svg" alt="Moeda dourada dos AitoTokens com a marca da AitoSoftwares" width="320" height="320" fetchpriority="high" />
        <figcaption><q-icon name="mdi-swap-horizontal" /> Saldo em dólares · recarga em reais</figcaption>
      </figure>
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

    <section id="pacotes" class="tokens-landing__section tokens-landing__packs" aria-labelledby="tokens-pack-title">
      <div>
        <h2 id="tokens-pack-title">Pacotes de recarga</h2>
        <p>Recarregue pelo aplicativo conectado. O checkout mostra o valor em reais pela cotação aplicada no momento da compra.</p>
      </div>
      <ul class="tokens-landing__pack-grid" aria-label="Valores dos pacotes em dólares">
        <li v-for="pack in packs" :key="pack"><span>US$</span> <strong>{{ pack }}</strong><small>em créditos</small></li>
      </ul>
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
      <router-link to="/">AitoSoftwares</router-link>
      <router-link to="/politica-privacidade">Privacidade</router-link>
      <router-link to="/termos-servico">Termos de serviço</router-link>
    </footer>
  </main>
</template>

<style scoped>
.tokens-landing { --gold: #ffe29b; --mint: #9cf9d9; --ink: #f4fff9; --muted: #bfd6cd; min-height: 100svh; color: var(--ink); background: #061814; }
.tokens-landing a { color: inherit; }
.tokens-landing__nav, .tokens-landing__hero, .tokens-landing__section, .tokens-landing__footer { width: min(1130px, calc(100% - 3rem)); margin-inline: auto; }
.tokens-landing__nav, .tokens-landing__footer { display: flex; align-items: center; gap: clamp(.75rem, 3vw, 2rem); font-size: .9rem; }
.tokens-landing__nav { min-height: 78px; border-bottom: 1px solid #294338; }
.tokens-landing__nav a, .tokens-landing__footer a { text-decoration: none; }
.tokens-landing__brand { display: inline-flex; align-items: center; gap: .5rem; margin-right: auto; }
.tokens-landing__brand img { object-fit: contain; }
.tokens-landing__nav a:hover, .tokens-landing__footer a:hover { color: var(--mint); }
.tokens-landing__hero { min-height: min(660px, 80svh); display: grid; grid-template-columns: 1.05fr 1fr; align-items: center; gap: 2rem; padding-block: clamp(2rem, 7vw, 6rem); }
.tokens-landing__intro { position: relative; z-index: 1; }
.tokens-landing__tag { color: var(--mint); font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
.tokens-landing h1 { margin: .25rem 0 .8rem; font-family: 'Instrument Sans', 'Inter', system-ui, sans-serif; font-size: clamp(3.3rem, 9vw, 7.5rem); font-weight: 750; line-height: .95; letter-spacing: -.09em; }
.tokens-landing h1 span { color: var(--gold); }
.tokens-landing p { color: var(--muted); line-height: 1.6; }
.tokens-landing__intro .tokens-landing__tag { color: var(--mint); }
.tokens-landing__intro .tokens-landing__lead { margin: 0 0 .5rem; color: var(--ink); font-size: clamp(1.3rem, 3vw, 2rem); font-weight: 650; line-height: 1.3; }
.tokens-landing__intro > p:not(.tokens-landing__tag) { max-width: 33rem; }
.tokens-landing__actions { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem 1.3rem; margin-top: 1.5rem; }
.tokens-landing__button, .tokens-landing__link { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-height: 46px; font-weight: 720; }
.tokens-landing__actions .tokens-landing__button { padding: .65rem 1rem; border-radius: .6rem; color: #281901; background: var(--gold); text-decoration: none; }
.tokens-landing__button:hover { background: #fff2c9; }
.tokens-landing__visual { display: grid; place-items: center; isolation: isolate; position: relative; margin: 0; padding: 1.5rem 0 0; background: radial-gradient(ellipse at 50% 45%, #664b2370 0%, #12352d70 48%, transparent 71%); }
.tokens-landing__visual::before { content: ''; position: absolute; z-index: -1; width: 85%; aspect-ratio: 1; border: 1px solid #caad6840; border-radius: 50%; box-shadow: inset 0 0 0 2rem #715e3414, 0 0 0 2rem #715e3414; }
.tokens-landing__visual img { display: block; width: min(100%, 360px); height: auto; filter: drop-shadow(0 18px 32px #1b0e00b0); }
.tokens-landing__visual figcaption { position: relative; padding: .55rem .9rem; border: 1px solid #6e5c34; border-radius: 2rem; background: #171e15; color: var(--gold); text-align: center; font-size: .85rem; }
.tokens-landing__section { padding-block: clamp(2rem, 6vw, 4rem); border-top: 1px solid #294338; }
.tokens-landing h2 { margin: 0 0 1rem; font-size: clamp(1.65rem, 4vw, 2.8rem); font-weight: 700; line-height: 1.15; letter-spacing: -.035em; }
.tokens-landing__steps, .tokens-landing__pack-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.tokens-landing__card, .tokens-landing__pack-grid li { padding: 1.2rem; border: 1px solid #365448; border-radius: .85rem; background: #0d261e; }
.tokens-landing__card h3 { margin: .7rem 0 .35rem; font-size: 1.12rem; font-weight: 730; line-height: 1.25; }
.tokens-landing__card p { margin: 0; }
.tokens-landing__icon { color: var(--mint); font-size: 1.75rem; }
.tokens-landing__pack-grid { grid-template-columns: repeat(4, 1fr); list-style: none; padding: 0; }
.tokens-landing__pack-grid li { color: var(--gold); background: linear-gradient(145deg, #2b2916, #10261c); border-color: #6c5a34; }
.tokens-landing__pack-grid strong { font-size: clamp(1.4rem, 5vw, 2.8rem); line-height: 1.05; }
.tokens-landing__pack-grid small { display: block; margin-top: .3rem; color: var(--muted); font-size: .85rem; }
.tokens-landing__faq { display: grid; grid-template-columns: 1fr 2fr; gap: 1.2rem; }
.tokens-landing details { padding: .85rem 0; border-bottom: 1px solid #365448; }
.tokens-landing summary { cursor: pointer; font-weight: 680; line-height: 1.45; }
.tokens-landing details p { margin: .5rem 0 0; }
.tokens-landing__footer { padding-block: 1.2rem; color: var(--muted); border-top: 1px solid #294338; flex-wrap: wrap; }
.tokens-landing a:focus-visible, .tokens-landing summary:focus-visible { outline: 2px solid var(--mint); outline-offset: 4px; }
@media (max-width: 720px) {
  .tokens-landing__hero { min-height: 0; grid-template-columns: 1fr; gap: 1rem; }
  .tokens-landing__visual img { width: min(66vw, 270px); }
  .tokens-landing__visual::before { width: min(65vw, 290px); }
  .tokens-landing__steps, .tokens-landing__faq { grid-template-columns: 1fr; }
  .tokens-landing__pack-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 390px) {
  .tokens-landing__nav, .tokens-landing__hero, .tokens-landing__section, .tokens-landing__footer { width: calc(100% - 1.8rem); }
  .tokens-landing__nav { gap: .55rem; font-size: .8rem; }
}
</style>
