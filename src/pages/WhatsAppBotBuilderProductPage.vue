<script setup>
import 'src/css/solutions-polish.css'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMeta } from 'quasar'
import { description as siteDescription } from '../../package.json'
import AuthDialog from 'components/AuthDialog.vue'
import DesktopSolutionFeatures from 'components/DesktopSolutionFeatures.vue'
import IAChatComponent from 'components/IAChatComponent.vue'
import KitProductCart from 'components/KitProductCart.vue'
import KitSystemRequirements from 'components/KitSystemRequirements.vue'
import KitTeamSection from 'components/KitTeamSection.vue'
import SolutionMediaFrame from 'components/SolutionMediaFrame.vue'
import LandingVideoMonitor from 'components/landing3d/LandingVideoMonitor.vue'
import { defaultProductCatalog, productTermLabel, useProductCart } from 'src/services/product-cart'
import { solutionsMedia, solutionDemos } from 'src/data/whatsappSolutionsMedia'
import { botBuilderHeroVideo, desktopSolutionVideos } from 'src/data/landingHeroVideo'
import { desktopSolutions, desktopSolutionsFaq, desktopSolutionsSeo } from 'src/data/desktopSolutions'

const router = useRouter()
const assistantOpen = ref(false)
const trialAuthOpen = ref(false)
const checkout = ref(null)
const catalog = ref(defaultProductCatalog())
const activeSlide = ref('cloud')
const planCart = useProductCart()
const productsPath = '/app?tab=products'
const prototypeUrl = '/whatsapp-solucoes/teste-gratis'

const offer = computed(() => catalog.value.desktop)
const cloudTerm = computed(() => productTermLabel(catalog.value.cloud))
const productVideo = computed(() => ({
  src: offer.value.media?.heroVideo || botBuilderHeroVideo.src,
  poster: offer.value.media?.heroPoster || botBuilderHeroVideo.poster,
}))
const demos = [
  ...solutionDemos,
  { key: 'flow', tab: 'Fluxos', title: 'Do desenho à conversa', copy: 'Conecte as etapas do bot e teste o caminho do cliente antes de publicar.', media: 'botFlow', image: '/whatsapp-solutions/experience/botbuilder-clinic.webp' },
]
const modules = [
  { id: 'notificacoes', tone: 'blue', icon: 'mdi-bullhorn-outline', title: 'AitoNotify', text: 'Disparos em massa em vários canais.' },
  { id: 'chatbots', tone: 'green', icon: 'mdi-qrcode', title: 'WhatsApp BotBuilder', text: 'Chatbots e atendimento em equipe.' },
  { id: 'agentes', tone: 'gold', icon: 'mdi-auto-fix', title: 'Aito I.A.', text: 'Agentes que operam o painel com você.' },
]

const seo = computed(() => desktopSolutionsSeo(offer.value))
useMeta(() => seo.value)

// Quasar manages the product description while this route is open.
let genericDescription
onMounted(() => {
  const staticMeta = document.head.querySelectorAll('[data-desktop-seo]')
  genericDescription = document.head.querySelector('meta[name="description"]:not([data-qmeta], [data-desktop-seo])')
  if (!genericDescription) {
    genericDescription = document.createElement('meta')
    genericDescription.name = 'description'
    genericDescription.content = siteDescription
  }
  genericDescription.remove()
  staticMeta.forEach(element => element.remove())
})
onBeforeUnmount(() => {
  if (genericDescription) document.head.appendChild(genericDescription)
  if (document.title === seo.value.title) document.title = 'AITOSOFTWARES'
})

function money(cents) {
  return cents == null ? 'Consulte disponibilidade' : (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buy(months) {
  if (Number.isInteger(months)) planCart.setDesktopMonths(months)
  checkout.value?.openCart('desktop')
}

function buyBoth() {
  checkout.value?.openCart('cloud')
  checkout.value?.openCart('desktop')
}

function openProducts() {
  trialAuthOpen.value = false
  return router.push(productsPath)
}

function startTrial() {
  if (localStorage.getItem('aito_user_token')) return openProducts()
  trialAuthOpen.value = true
}

function scrollToProductSection(event) {
  const anchor = event.target.closest?.('a[href^="#"]')
  const target = anchor && document.getElementById(anchor.hash.slice(1))
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(window.history.state, '', anchor.hash)
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="product solutions-product" @click="scrollToProductSection">
        <header class="solutions-navbar">
          <router-link to="/" class="brand solutions-brand" aria-label="AitoSoftwares, página inicial">
            <img src="/aito-logo-restored.png" alt="" width="34" height="34" />
            <span>AITO<span>SOFTWARES</span></span>
          </router-link>
          <nav aria-label="Navegação do produto">
            <a href="#pacote">O kit</a>
            <a href="#requisitos">Requisitos</a>
            <a href="#planos">Planos</a>
            <a href="#simulador-chatbot" class="nav-simulator">Testar o bot</a>
            <button type="button" class="customer-login" @click="checkout?.openLogin()"><q-icon name="mdi-account-outline" /> Área do cliente</button>
            <a class="nav-trial" href="#teste-desktop">7 dias grátis <q-icon name="mdi-arrow-down" /></a>
          </nav>
        </header>

        <section class="hero solutions-hero">
          <div class="hero-video">
            <LandingVideoMonitor :video="productVideo" title="Apresentação do Kit Desktop" eyebrow="CONHEÇA O KIT DESKTOP"
              headline="Da primeira mensagem ao próximo passo." description="Notificações, atendimento e automação em um só aplicativo." />
          </div>
          <div class="copy">
            <span class="kit-label">AITONOTIFY + WHATSAPP BOTBUILDER</span>
            <h1>Atenda melhor.<br /><em>Avise no canal certo.</em></h1>
            <p>{{ desktopSolutions.intro }}</p>
            <div class="hero-actions">
              <a class="trial-cta" href="#teste-desktop"><q-icon name="mdi-download-outline" /><span>Experimentar 7 dias</span></a>
              <a class="trial-cta simulator-cta" href="#simulador-chatbot" data-funnel="interest_chatbots"><q-icon name="mdi-gesture-tap" /><span>Testar um bot aqui</span></a>
            </div>
            <div class="trust"><q-icon name="mdi-microsoft-windows" /> Windows 10 e 11 · instalação guiada</div>
            <div class="highlights"><span>WhatsApp oficial e Web</span><span>Gmail e Telegram</span><span>Agentes de IA</span></div>
          </div>
        </section>

        <section id="pacote" class="solution-package">
          <div class="section-heading">
            <span class="eyebrow">TRÊS FERRAMENTAS NO MESMO APLICATIVO</span>
            <h2>Menos abas. <em>Mais trabalho resolvido.</em></h2>
          </div>
          <div class="module-links">
            <a v-for="module in modules" :key="module.id" :href="'#' + module.id" :class="'module-link--' + module.tone">
              <q-icon :name="module.icon" aria-hidden="true" />
              <span><strong>{{ module.title }}</strong><small>{{ module.text }}</small></span>
              <q-icon name="mdi-arrow-down" aria-hidden="true" />
            </a>
          </div>
        </section>

        <DesktopSolutionFeatures />
        <KitTeamSection :image="offer.media?.teamAccess || solutionsMedia.web" />

        <section id="demonstracao" class="solution-demonstration">
          <div class="section-heading">
            <span class="eyebrow">POR DENTRO DO DESKTOP</span>
            <h2>Veja como o trabalho <em>fica organizado.</em></h2>
            <p>Escolha uma tela e toque na moldura para ampliar os detalhes.</p>
          </div>
          <q-carousel v-model="activeSlide" animated swipeable arrows infinite class="solutions-carousel" control-color="teal-3">
            <q-carousel-slide v-for="(demo, index) in demos" :key="demo.key" :name="demo.key" class="solution-slide">
              <div class="slide-copy">
                <span class="eyebrow">{{ String(index + 1).padStart(2, '0') }} / POR DENTRO DO DESKTOP</span>
                <h3>{{ demo.title }}</h3><p>{{ demo.copy }}</p>
              </div>
              <SolutionMediaFrame :src="demo.key === 'review' ? solutionsMedia.review : offer.media?.[demo.media] || demo.image" :title="demo.title" />
            </q-carousel-slide>
          </q-carousel>
          <div class="demo-tabs" role="group" aria-label="Escolher captura do produto">
            <button v-for="demo in demos" :key="demo.key" type="button" :aria-pressed="activeSlide === demo.key"
              :aria-label="'Ver captura: ' + demo.title" @click="activeSlide = demo.key">{{ demo.tab }}</button>
          </div>
          <p class="demo-note">Telas de demonstração com dados fictícios ou ocultados.</p>
        </section>

        <section class="solution-mobile">
          <div>
            <span class="eyebrow">ATENDIMENTO NO NAVEGADOR</span>
            <h2>Seu time também atende <em>pelo celular.</em></h2>
            <p>O aplicativo roda no seu Windows. Com acesso remoto HTTPS configurado, os colaboradores usam o painel pelo navegador e entram com seus próprios logins.</p>
            <small>O computador precisa ficar ligado e com o aplicativo em execução.</small>
          </div>
          <div class="mobile-frames">
            <div><SolutionMediaFrame :src="offer.media?.mobilePush || solutionsMedia.mobile" phone title="Todos os canais no celular" /><p class="mobile-caption">Escolha o canal e continue o atendimento.</p></div>
            <div><SolutionMediaFrame :src="offer.media?.mobileAssistant || solutionsMedia.assistant" phone title="Assistente Aito IA" /><p class="mobile-caption">Conteúdo, fluxos e configurações com apoio da IA.</p></div>
          </div>
        </section>

        <section id="instalacao" class="guide installation">
          <div>
            <span class="eyebrow">PASSO A PASSO</span>
            <h2>Instale. Conecte. Comece.</h2>
            <ol class="quick-steps">
              <li>Baixe o instalador em Meus produtos.</li>
              <li>Ative a licença e siga a configuração guiada.</li>
              <li>Conecte seus canais e teste o primeiro fluxo ou envio.</li>
            </ol>
          </div>
          <LandingVideoMonitor :video="desktopSolutionVideos.installation" title="Guia de instalação" eyebrow="PASSO A PASSO"
            headline="Seu primeiro acesso, do começo ao fim." description="Do download à configuração dos canais." />
        </section>

        <KitSystemRequirements />

        <section id="teste-desktop" class="desktop-trial" aria-labelledby="desktop-trial-title">
          <div>
            <span class="eyebrow"><q-icon name="mdi-gift-outline" /> KIT DESKTOP COMPLETO</span>
            <h2 id="desktop-trial-title">7 dias grátis no seu Windows.</h2>
            <p>Crie sua primeira conta, confirme o cadastro e resgate o teste em Meus produtos. Baixe o instalador e use todos os módulos com a licença de teste.</p>
            <button class="trial-cta" type="button" @click="startTrial"><q-icon name="mdi-download-outline" /> Começar meu teste</button>
            <small>Sem cartão. Uma oferta por novo cliente elegível, sem licença ativa. Os 7 dias começam quando você resgata.</small>
          </div>
          <img src="/whatsapp-solutions/product-kit.webp" alt="Kit AitoNotify + WhatsApp BotBuilder" width="128" height="192" loading="lazy" />
        </section>

        <section id="planos" class="solution-plans">
          <div class="section-heading">
            <span class="eyebrow">ESCOLHA SEU PRAZO</span>
            <h2>O mesmo Kit Desktop <em>em todos os planos.</em></h2>
            <p>Já tem licença ativa? Ao renovar, o prazo comprado é somado à data de vencimento. Seus dias restantes continuam valendo.</p>
          </div>
          <div class="plans-grid">
            <article v-for="plan in (offer.desktopPlans || [])" :key="plan.months" class="plan-card plan-card--source">
              <div class="kit-plan-identity">
                <img src="/whatsapp-solutions/product-kit.webp" alt="" width="128" height="192" loading="lazy" />
                <div><span class="plan-chip">KIT DESKTOP</span><h3>{{ plan.label }}</h3><span class="kit-plan-platform"><q-icon name="mdi-microsoft-windows" /> Windows 10 e 11</span></div>
              </div>
              <div class="price"><strong>{{ money(plan.priceCents) }}</strong><span>{{ plan.months === 1 ? '1 mês' : plan.months + ' meses' }} · Uma instalação ativa</span></div>
              <ul><li>WhatsApp oficial, BotBuilder e atendimento em equipe.</li><li>Campanhas no Gmail, Telegram e WhatsApp oficial.</li><li>Agentes de IA, instalador e guia de configuração.</li></ul>
              <q-btn unelevated no-caps color="teal-6" label="Adicionar ao carrinho" icon="mdi-cart-plus"
                :disable="!offer.available || !plan.enabled" @click="buy(plan.months)" />
              <small>Pagamento pela InfinitePay. Download após a confirmação.</small>
            </article>
          </div>
          <p class="plans-footnote">Tarifas da Meta, créditos de IA e serviços externos seguem os valores de cada provedor.</p>
        </section>

        <section class="product-upsell" aria-labelledby="source-upsell">
          <div>
            <span class="eyebrow">CÓDIGO-FONTE WHITELABEL</span>
            <h2 id="source-upsell">Quer publicar <em>na sua nuvem?</em></h2>
            <p>O Whitelabel é vendido separadamente. Receba o código-fonte para editar, integrar e publicar sua própria versão.</p>
            <div class="product-upsell__facts"><span><q-icon name="mdi-code-braces" /> Código editável</span><span><q-icon name="mdi-cloud-key-outline" /> Token Cloud {{ cloudTerm }}</span></div>
          </div>
          <div class="product-upsell__actions">
            <small>Produto Código-fonte Whitelabel</small><strong>{{ money(catalog.cloud.priceCents) }}</strong>
            <q-btn unelevated no-caps color="teal-7" label="Levar Desktop + código-fonte" icon="mdi-cart-plus"
              :disable="!offer.available || !catalog.cloud.available" @click="buyBoth" />
            <router-link to="/whatsapp-solucoes-whitelabel">Conhecer a versão Whitelabel <q-icon name="mdi-arrow-right" /></router-link>
          </div>
        </section>

        <section class="guide" aria-labelledby="desktop-faq">
          <span class="eyebrow">PERGUNTAS FREQUENTES</span>
          <h2 id="desktop-faq">Antes de instalar</h2>
          <details v-for="item in desktopSolutionsFaq" :key="item.question"><summary>{{ item.question }}</summary><p>{{ item.answer }}</p></details>
        </section>

        <footer>Kit AitoNotify + WhatsApp BotBuilder · AitoSoftwares <router-link :to="productsPath">Já comprei: acessar meus produtos →</router-link></footer>
        <KitProductCart ref="checkout" product-type="desktop" @catalog="value => catalog = value" />
        <AuthDialog v-model="trialAuthOpen" initial-mode="register" audience="user" :return-path="productsPath"
          :show-project-login="false" @authenticated="openProducts" />
        <aside class="product-action-dock" aria-label="Ações do produto">
          <a class="kit-buy-float" href="#planos"><q-icon name="mdi-cart-outline" /><span>Ver planos</span></a>
          <a class="floating-prototype" :href="prototypeUrl" target="_blank" rel="noopener noreferrer"><q-icon name="mdi-play-circle" /><span>Explorar por dentro</span></a>
          <button class="product-assistant" type="button" aria-label="Tirar dúvidas com o assistente AITO" @click="assistantOpen = true"><img src="/ia.gif" alt="" width="42" height="42" /></button>
        </aside>
        <q-dialog v-model="assistantOpen"><IAChatComponent @close="assistantOpen = false" /></q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style scoped>
.solutions-product {
  --nav-clearance: 98px;
  color: #effffb;
  background: radial-gradient(ellipse at 70% 2%, #154e3f70, transparent 28%), #030f11;
  padding: 82px max(18px, calc((100vw - 1200px) / 2)) 124px;
  animation: product-load 500ms ease both;
}
@keyframes product-load { from { opacity: 0; } to { opacity: 1; } }
.solutions-product a { color: #a5f5d9; }
.solutions-product section[id], .solutions-product :deep(.kit-team) { scroll-margin-top: var(--nav-clearance); }
.solutions-product a:focus-visible, .solutions-product button:focus-visible { outline: 2px solid #a5f5d9; outline-offset: 3px; }

.solutions-navbar {
  position: fixed;
  inset: 0 0 auto;
  z-index: 200;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px max(18px, calc((100vw - 1200px) / 2));
  background: #041719f5;
  border-bottom: 1px solid #2b6556;
  box-shadow: 0 8px 30px #0004;
  backdrop-filter: blur(16px);
}
.solutions-brand, .solutions-navbar nav { display: flex; align-items: center; gap: 15px; }
.solutions-brand { gap: 8px; font-size: .86rem; color: #f1fffa !important; font-weight: 850; }
.solutions-brand > span > span { color: #65e4c6; }
.solutions-navbar a, .hero-actions a, .module-links > a, .floating-prototype { text-decoration: none; }
.solutions-navbar nav > a { font-size: .8rem; font-weight: 650; white-space: nowrap; }
.solutions-navbar nav > a:not(.nav-trial):hover { text-decoration: underline; }
.solutions-navbar .nav-trial, .trial-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #b6ffd1;
  border-radius: 12px;
  color: #092f24 !important;
  background: linear-gradient(115deg, #d9ffa5, #71e9c7);
  font: inherit;
  font-weight: 850;
  cursor: pointer;
}
.nav-trial:hover, .trial-cta:hover { filter: brightness(1.1); }

.solutions-hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(28px, 5vw, 78px); align-items: center; padding: 42px 0 clamp(45px, 7vw, 93px); }
.solutions-hero > *, .mobile-frames > *, .solution-slide > *, .installation > * { min-width: 0; }
.kit-label { display: inline-flex; padding: 7px 10px; border-radius: 8px; border: 1px solid #77d4b77d; background: #174e3d66; color: #bcf8e3; font-size: .68rem; font-weight: 800; letter-spacing: .08em; }
.solutions-hero h1 { margin: 13px 0 15px; font-size: clamp(36px, 4.1vw, 58px); font-weight: 820; line-height: 1.07; letter-spacing: -.05em; }
.solutions-hero h1 em, h2 em { color: #8df0ca; font-style: normal; }
.solutions-hero p, .section-heading p, .solution-mobile p, .product-upsell p { color: #bed8cd; line-height: 1.7; }
.solutions-hero p { max-width: 480px; font-size: clamp(14px, 1.35vw, 18px); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0 17px; }
.trial-cta { min-height: 54px; padding: 12px 15px; }
.trial-cta .q-icon { font-size: 20px; }
.simulator-cta { color: #ddfff2 !important; background: #164637; border-color: #81daba; }
.trust { color: #aed3c5; font-size: .8rem; }
.trust .q-icon { font-size: 18px; margin-right: 3px; }
.highlights { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.highlights span { padding: 6px 8px; border: 1px solid #386c5a; border-radius: 99px; font-size: .68rem; color: #d0eadf; }

.solution-package, .solution-demonstration, .solution-mobile, .solution-plans, .guide { padding: clamp(30px, 5vw, 66px) 0; }
.section-heading { max-width: 710px; margin: 0 auto 25px; text-align: center; }
.eyebrow { color: #a4f5d8; font-size: .67rem; font-weight: 820; letter-spacing: .12em; }
h2 { margin: 12px 0; font-size: clamp(29px, 3.75vw, 48px); font-weight: 780; line-height: 1.13; letter-spacing: -.04em; }
.module-links, .plans-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.module-links > a {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 17px;
  align-items: center;
  gap: 10px;
  padding: 17px;
  border: 1px solid var(--tile-line);
  border-radius: 13px;
  background: var(--tile-bg);
  color: var(--tile-color);
}
.module-links > a:hover { filter: brightness(1.16); }
.module-links strong, .module-links small { display: block; }
.module-links small { margin-top: 4px; color: #d5e7df; font-size: .74rem; }
.module-links > a > .q-icon:first-child { font-size: 25px; }
.module-link--blue { --tile-line: #426c83; --tile-bg: #0e2939; --tile-color: #b8e7ff; }
.module-link--green { --tile-line: #41735d; --tile-bg: #0d2e24; --tile-color: #b5f7d9; }
.module-link--gold { --tile-line: #78664a; --tile-bg: #302719; --tile-color: #ffe4a6; }

.solutions-carousel { height: clamp(410px, 51vw, 630px); background: transparent; }
.solution-slide { display: grid; grid-template-columns: minmax(190px, .65fr) 1.35fr; align-items: center; gap: 24px; padding: 18px 45px 32px; }
.slide-copy h3 { margin: 10px 0; font-size: clamp(24px, 2.7vw, 37px); font-weight: 750; line-height: 1.16; }
.slide-copy p { color: #bed8cd; line-height: 1.68; }
.demo-tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; margin: 12px 0; }
.demo-tabs button { padding: 8px 12px; color: #d4f2e7; background: #0c2927; border: 1px solid #3e7662; border-radius: 8px; font: inherit; font-size: .75rem; cursor: pointer; }
.demo-tabs button[aria-pressed="true"] { color: #082d20; background: #93e9c5; border-color: #b5ffe2; font-weight: 760; }
.demo-note, .mobile-caption { margin: 14px auto 0; text-align: center; font-size: .75rem !important; color: #a3cbbd; }
.solution-mobile, .installation { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 5vw, 60px); align-items: center; }
.solution-mobile small { color: #b0c9c0; }
.mobile-frames { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.guide { border-top: 1px solid #2b5d50; }
.quick-steps { padding-left: 1.2em; color: #c1d8cf; }
.quick-steps li { margin-bottom: 8px; }

.desktop-trial { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: clamp(15px, 6vw, 65px); padding: clamp(22px, 4.5vw, 54px); border: 1px solid #81dbb9; border-radius: 24px; background: radial-gradient(ellipse at 90% 10%, #256c4a, transparent 60%), #103a2f; }
.desktop-trial p, .desktop-trial small { max-width: 570px; color: #d1ede1; line-height: 1.68; }
.desktop-trial small { display: block; margin-top: 12px; }
.desktop-trial img { width: clamp(90px, 17vw, 170px); height: auto; filter: drop-shadow(0 12px 23px #0005); }
.desktop-trial .eyebrow .q-icon { font-size: 21px; margin-right: 5px; }

.solutions-product .plans-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.solutions-product .plan-card--source {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(17px, 2.3vw, 27px);
  border: 1px solid #4d967c;
  border-radius: 18px;
  background: linear-gradient(145deg, #174337, #0a201e);
}
.plan-card h3 { margin: 7px 0; font-size: clamp(20px, 2.25vw, 29px); font-weight: 770; line-height: 1.15; }
.plan-card .kit-plan-identity { gap: 13px; margin-bottom: 14px; }
.plan-card .kit-plan-identity > img { width: 74px; height: auto; }
.plan-chip { color: #a4f5d8; font-size: .64rem; font-weight: 800; letter-spacing: .11em; }
.price { display: grid; gap: 4px; }
.price strong { font-size: clamp(25px, 3vw, 39px); line-height: 1.12; }
.price span, .plan-card small { font-size: .72rem; color: #b7d6ca; line-height: 1.55; }
.plan-card small { margin-top: 9px; }
.plan-card ul { flex: 1; padding-left: 1.15em; font-size: .79rem; line-height: 1.6; color: #d3ede3; }
.plan-card li { margin-bottom: 6px; }
.plans-footnote { color: #b2cfc3; text-align: center; font-size: .78rem; }

.solutions-product footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 20px; border-top: 1px solid #2b5d50; color: #a4c6b9; font-size: .77rem; }
.product-assistant { display: grid; place-items: center; padding: 0; border: 1px solid #65e1c1; background: linear-gradient(145deg, #60e9c9, #079a80); cursor: pointer; }
.floating-prototype { display: inline-flex; align-items: center; gap: 7px; border: 1px solid; }

@media (max-width: 930px) {
  .solutions-hero { grid-template-columns: 1fr; }
  .hero-video { width: min(650px, 100%); margin: auto; }
  .solutions-product .plans-grid { grid-template-columns: minmax(0, 540px); justify-content: center; }
}
@media (max-width: 700px) {
  .solutions-product { --nav-clearance: 125px; padding-top: 109px; }
  .solutions-navbar { flex-wrap: wrap; gap: 6px; }
  .solutions-navbar nav { width: 100%; gap: 8px; }
  .solutions-product .solutions-navbar nav > a.nav-trial { display: inline-flex !important; }
  .solutions-navbar nav > a.nav-simulator { font-size: .68rem; }
  .solutions-navbar .nav-trial { padding: 8px 9px; font-size: .68rem; }
  .solutions-hero { padding-top: 21px; }
  .hero-actions > a { min-height: 48px; padding-inline: 10px; font-size: .82rem; }
  .module-links, .solution-mobile, .installation { grid-template-columns: 1fr; }
  .solutions-carousel { height: clamp(400px, 90vw, 590px); }
  .solution-slide { grid-template-columns: 1fr; align-content: center; gap: 16px; padding: 16px 28px 25px; }
  .slide-copy p { margin: 0; }
}
@media (max-width: 360px) {
  .solutions-product { --nav-clearance: 136px; padding-inline: 12px; }
  .hero-actions > a { width: 100%; }
  .desktop-trial { grid-template-columns: 1fr; }
  .desktop-trial > img { display: none; }
}
@media (prefers-reduced-motion: reduce) { .solutions-product { animation: none; } }
</style>
