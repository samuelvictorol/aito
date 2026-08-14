<template>
  <main
    class="landing-3d"
    :class="{
      'landing-3d--intro-loading': !introRevealing,
      'landing-3d--intro-complete': introRevealing,
      'landing-3d--intro-object-only': introRevealing && !introTextVisible
    }"
    :style="landingPageStyle"
  >
    <AitoThreeScene
      :scroll-progress="scrollProgress"
      :reduced-motion="prefersReducedMotion"
      :section-count="landing3dSections.length"
      :intro-phase="introPhase"
      @ready="handleSceneReady"
    />

    <AitoLoadingGate
      v-if="!introComplete"
      :ready="sceneReady"
      :reduced-motion="prefersReducedMotion"
      @reveal="handleIntroReveal"
      @complete="handleIntroComplete"
    />

    <div class="landing-3d__atmosphere" aria-hidden="true"></div>
    <div class="landing-3d__noise" aria-hidden="true"></div>

    <header class="landing-3d__header">
      <button class="landing-3d__brand" type="button" aria-label="Voltar ao inicio" @click="scrollTo('inicio')">
        <img src="/favicon.png" alt="" width="34" height="34" />
        <span>AITO<span>SOFTWARES</span></span>
      </button>

      <div class="landing-3d__header-actions">
        <button class="landing-3d__account-link" type="button" aria-label="Abrir acesso" @click="openAccessChooser">
          <q-icon name="mdi-account-outline" aria-hidden="true" />
          <span class="landing-3d__account-label">{{ accountLabel }}</span>
        </button>
        <a
          class="landing-3d__instagram-link"
          href="https://www.instagram.com/aitosoftwares/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram da AitoSoftwares"
          title="Instagram da AitoSoftwares"
        >
          <q-icon name="mdi-instagram" aria-hidden="true" />
        </a>
      </div>
    </header>

    <nav class="landing-3d__progress" aria-label="Navegacao entre secoes">
      <button
        v-for="(section, index) in landing3dSections"
        :key="section.id"
        type="button"
        :class="{ 'is-active': activeSection === index }"
        :aria-label="`Ir para a secao ${index + 1}: ${section.title}`"
        :aria-current="activeSection === index ? 'step' : undefined"
        @click="scrollTo(section.id)"
      >
        <span></span>
      </button>
    </nav>

    <div class="landing-3d__content">
      <section
        v-for="(section, index) in landing3dSections"
        :id="section.id"
        :key="section.id"
        class="landing-3d__section"
        :class="[
          `landing-3d__section--${section.align}`,
          `landing-3d__section--${section.id}`
        ]"
        data-landing-3d-section
        :aria-labelledby="`${section.id}-title`"
      >
        <div class="landing-3d__section-inner">
          <div class="landing-3d__copy" :style="sectionCopyStyle(index)">
            <p class="landing-3d__eyebrow">{{ section.eyebrow }}</p>
            <h1 v-if="index === 0" :id="`${section.id}-title`" class="landing-3d__title">{{ section.title }}</h1>
            <h2 v-else :id="`${section.id}-title`" class="landing-3d__title">{{ section.title }}</h2>
            <!-- <p v-if="section.description && !isMobile" class="landing-3d__description">{{ section.description }}</p> -->

            <div v-if="section.id === 'inicio'" class="landing-3d__hero-actions">
              <a class="landing-3d__cta landing-3d__cta--primary" :href="section.cta.href" target="_blank" rel="noopener noreferrer">
                <span>{{ section.cta.label }}</span>
                <q-icon name="mdi-arrow-top-right" aria-hidden="true" />
              </a>
              <button class="landing-3d__cta landing-3d__cta--secondary" type="button" @click="handleAboutCtaClick">
                <span>{{ section.secondaryCta.label }}</span>
                <q-icon name="mdi-lightbulb-on-outline" aria-hidden="true" />
              </button>
            </div>

            <div v-if="section.id === 'inicio'" class="landing-3d__proof-row">
              <span><strong>50+</strong> operações atendidas</span>
              <span><strong>200+</strong> entregas</span>
              <span><strong>98%</strong> satisfação</span>
            </div>

            <div v-if="section.id === 'contato'" class="landing-3d__contact-copy">
              <button type="button" class="landing-3d__text-link" @click="openAuth('register', 'user')">
                <q-icon name="mdi-account-plus-outline" aria-hidden="true" />
                Criar acesso para acompanhar o projeto
              </button>
            </div>
          </div>

          <div class="landing-3d__visual">
            <template v-if="section.id === 'marcas'">
              <AitoBrandCarousel :brands="institutionalBrands" @select="handleBrandSelect" />
            </template>

            <template v-else-if="section.id === 'solucoes'">
              <div class="landing-3d__service-grid">
                <article v-for="service in institutionalServices" :key="service.title" class="landing-3d__service-card">
                  <span class="landing-3d__icon-bubble"><q-icon :name="service.icon" size="21px" aria-hidden="true" /></span>
                  <h3>{{ service.title }}</h3>
                  <p>{{ service.text }}</p>
                  <ul>
                    <li v-for="item in service.items" :key="item">{{ item }}</li>
                  </ul>
                </article>
              </div>
            </template>

            <template v-else-if="section.id === 'cases'">
              <div class="landing-3d__case-grid">
                <article v-for="item in institutionalCases" :key="item.title" class="landing-3d__case-card">
                  <div class="landing-3d__case-icon"><q-icon :name="item.icon" size="21px" aria-hidden="true" /></div>
                  <p class="landing-3d__case-kicker">{{ item.subtitle }}</p>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.text }}</p>
                  <div class="landing-3d__tag-row">
                    <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
                  </div>
                  <a :href="item.href" target="_blank" rel="noopener noreferrer" class="landing-3d__case-link">
                    Conhecer projeto <q-icon name="mdi-arrow-top-right" aria-hidden="true" />
                  </a>
                </article>
              </div>
            </template>

            <template v-else-if="section.id === 'satisfacao'">
              <div class="landing-3d__satisfaction-grid">
                <div class="landing-3d__satisfaction-meter">
                  <q-icon name="mdi-heart" size="31px" aria-hidden="true" />
                  <strong>98%</strong>
                  <span>de satisfação</span>
                  <small>Relações que continuam depois do go-live.</small>
                </div>
                <article v-for="item in institutionalTestimonials" :key="item.name" class="landing-3d__testimonial">
                  <div class="landing-3d__testimonial-head">
                    <img v-if="item.img" :src="item.img" :alt="item.name" />
                    <span v-else class="landing-3d__avatar-placeholder">+</span>
                    <div><strong>{{ item.name }}</strong><small>{{ item.role }}</small></div>
                  </div>
                  <p>&ldquo;{{ item.quote }}&rdquo;</p>
                </article>
              </div>
            </template>

            <template v-else-if="section.id === 'founder-samuel' || section.id === 'founder-dion'">
              <article
                class="landing-3d__founder-card"
                :class="{ 'is-focused': founderFocused === section.id }"
                tabindex="0"
                @mouseenter="founderFocused = section.id"
                @mouseleave="founderFocused = null"
                @focusin="founderFocused = section.id"
                @focusout="founderFocused = null"
                @click="founderFocused = founderFocused === section.id ? null : section.id"
              >
                <img :src="founderForSection(section.id).image" :alt="founderForSection(section.id).name" class="landing-3d__founder-image" />
                <div>
                  <span class="landing-3d__founder-role">{{ founderForSection(section.id).role }}</span>
                  <p>{{ founderForSection(section.id).summary }}</p>
                </div>
                <div class="landing-3d__founder-socials">
                  <a :href="founderForSection(section.id).instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <q-icon name="mdi-instagram" size="18px" aria-hidden="true" />
                  </a>
                  <a :href="founderForSection(section.id).portfolio" target="_blank" rel="noopener noreferrer" aria-label="Portfolio">
                    <q-icon name="mdi-web" size="18px" aria-hidden="true" />
                  </a>
                </div>
              </article>
            </template>

            <template v-else-if="section.id === 'contato'">
              <q-form class="landing-3d__lead-form" @submit.prevent="sendLead">
                <div class="landing-3d__form-heading">
                  <q-icon name="mdi-rocket-launch-outline" size="19px" aria-hidden="true" />
                  <span>Falar com a Aito</span>
                </div>
                <div class="landing-3d__form-grid">
                  <q-input v-model="lead.name" outlined dense lazy-rules label="Seu nome" :rules="[requiredRule]" />
                  <q-input v-model="lead.phone" outlined dense lazy-rules label="WhatsApp" :rules="[requiredRule]" />
                  <q-input v-model="lead.email" outlined dense label="E-mail" type="email" />
                  <q-input v-model="lead.company" outlined dense label="Empresa ou projeto" />
                  <q-input v-model="lead.message" class="landing-3d__form-full" outlined dense type="textarea" autogrow label="Qual o seu foco principal hoje?" />
                </div>
                <div class="landing-3d__form-actions">
                  <q-btn unelevated no-caps type="submit" class="landing-3d__form-submit text-black" icon="mdi-whatsapp" label="Enviar e abrir WhatsApp" />
                  <button type="button" class="landing-3d__referral-button" @click="referralDialogOpen = true">
                    <q-icon name="mdi-gift-outline" size="18px" aria-hidden="true" />
                    Indique e ganhe
                  </button>
                </div>
              </q-form>
            </template>

            <!-- <div v-else class="landing-3d__ambient-panel">
              <q-icon name="mdi-infinity" size="40px" aria-hidden="true" />
              <strong>Diagnostico, produto e evolucao.</strong>
              <span>Uma conversa boa ja organiza o proximo passo.</span>
            </div> -->
          </div>
        </div>

        <div v-if="index === 0" class="landing-3d__scroll-cue" aria-hidden="true">
          <span>Explore</span><i></i>
        </div>
      </section>
    </div>

    <p class="landing-3d__counter" aria-live="polite">
      <span>{{ String(activeSection + 1).padStart(2, '0') }}</span><i></i><span>{{ String(landing3dSections.length).padStart(2, '0') }}</span>
    </p>

    <button class="landing-3d__ai-float" type="button" aria-label="Abrir IA da Aito" @click="iaChat = true">
      <img src="/ia.gif" alt="" />
    </button>
    <button class="landing-3d__surprise-float" type="button" aria-label="Abrir Surpreenda-me" @click="router.push('/surpresa')">
      <q-icon name="mdi-gift-outline" aria-hidden="true" />
      <q-tooltip>Surpreenda-me</q-tooltip>
    </button>

    <q-dialog v-model="brandDialogOpen">
      <q-card class="landing-3d__dialog-card">
        <q-card-section class="landing-3d__dialog-head">
          <div><span class="landing-3d__dialog-kicker">Case</span><h3>{{ selectedBrand?.name }}</h3></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="brandDialogOpen = false" />
        </q-card-section>
        <q-card-section class="landing-3d__dialog-body">
          <p>{{ selectedBrand?.summary }}</p>
          <a v-if="selectedBrand?.href" :href="selectedBrand.href" target="_blank" rel="noopener noreferrer" class="landing-3d__dialog-link">Visitar projeto <q-icon name="mdi-arrow-top-right" aria-hidden="true" /></a>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="accessDialogOpen">
      <q-card class="landing-3d__dialog-card landing-3d__access-dialog">
        <q-card-section class="landing-3d__dialog-head"><div><span class="landing-3d__dialog-kicker">Acesso AitoSoftwares</span><h3>Escolha seu espaço</h3></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="accessDialogOpen = false" /></q-card-section>
        <q-card-section class="landing-3d__dialog-body landing-3d__access-options">
          <button type="button" @click="openAuth('login', 'user')"><q-icon name="mdi-school-outline" /><span><strong>Área de estudo</strong><small>Entrar na AitoLearn</small></span><q-icon name="mdi-chevron-right" /></button>
          <button type="button" @click="router.push('/customer/login'); accessDialogOpen = false"><q-icon name="mdi-briefcase-outline" /><span><strong>Acompanhar meu projeto</strong><small>Portal privado do cliente</small></span><q-icon name="mdi-chevron-right" /></button>
          <button type="button" @click="openAuth('login', 'affiliate')"><q-icon name="mdi-account-star-outline" /><span><strong>Área do afiliado</strong><small>Cupons e vendas atribuídas</small></span><q-icon name="mdi-chevron-right" /></button>
        </q-card-section>
      </q-card>
    </q-dialog>

    <AuthDialog v-model="authDialogOpen" :initial-mode="authMode" :audience="authAudience" @authenticated="handleAuthSuccess" />

    <q-dialog v-model="coursePromptOpen">
      <q-card class="landing-3d__dialog-card landing-3d__course-prompt">
        <q-card-section class="landing-3d__dialog-head">
          <div><span class="landing-3d__dialog-kicker">AitoLearn / Fullstack Developer</span><h3>Seu proximo nivel pode virar um produto.</h3></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="coursePromptOpen = false" />
        </q-card-section>
        <q-card-section class="landing-3d__dialog-body">
          <p>Aprenda a construir e vender sistemas high ticket com frontend, backend, pagamentos, cloud, IA e 3D.</p>
          <q-btn unelevated no-caps class="landing-3d__auth-submit q-mt-md full-width" icon="mdi-lightbulb-on-outline" label="Conhecer a AitoLearn" @click="router.push('/aitolearn'); coursePromptOpen = false" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="referralDialogOpen">
      <q-card class="landing-3d__dialog-card">
        <q-card-section class="landing-3d__dialog-head"><div><span class="landing-3d__dialog-kicker">Indique e ganhe</span><h3>Uma boa conexao merece retorno.</h3></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="referralDialogOpen = false" /></q-card-section>
        <q-card-section class="landing-3d__dialog-body">
          <q-form @submit.prevent="sendReferral">
            <q-input v-model="referral.name" outlined dense lazy-rules label="Seu nome" :rules="[requiredRule]" />
            <q-input v-model="referral.phone" outlined dense lazy-rules label="Seu WhatsApp" class="q-mt-sm" :rules="[requiredRule]" />
            <q-input v-model="referral.leadName" outlined dense label="Nome do indicado" class="q-mt-sm" />
            <q-input v-model="referral.notes" outlined dense type="textarea" autogrow label="O que ele precisa?" class="q-mt-sm" />
            <q-btn unelevated no-caps class="landing-3d__auth-submit full-width q-mt-md" type="submit" icon="mdi-whatsapp" label="Enviar indicacao" />
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="iaChat" persistent>
      <IAChatComponent class="landing-3d__ai-dialog" @close="iaChat = false" />
    </q-dialog>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { api } from 'boot/axios'
import AitoLoadingGate from 'components/landing3d/AitoLoadingGate.vue'
import AitoThreeScene from 'components/landing3d/AitoThreeScene.vue'
import AitoBrandCarousel from 'components/landing3d/AitoBrandCarousel.vue'
import IAChatComponent from 'components/IAChatComponent.vue'
import AuthDialog from 'components/AuthDialog.vue'
import { useLandingScroll } from 'src/composables/useLandingScroll'
import { landing3dSections } from 'src/data/landing3dSections'
import {
  institutionalBrands,
  institutionalCases,
  institutionalFounders,
  institutionalServices,
  institutionalTestimonials
} from 'src/data/landingInstitutional'
const isMobile = computed(() => window.innerWidth < 768)
const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const USER_TOKEN_KEY = 'aito_user_token'
const LANDING_SCENE_WATCHDOG_MS = 9000
const LANDING_INTRO_CACHE_KEY = 'aito_landing_intro_seen_v1'

function hasCachedIntro() {
  try {
    return window.sessionStorage.getItem(LANDING_INTRO_CACHE_KEY) === '1'
  } catch (error) {
    return false
  }
}

const cachedIntro = hasCachedIntro()

const { activeSection, prefersReducedMotion, scrollProgress, scrollToSection: scrollTo, sectionPosition } = useLandingScroll(landing3dSections.length)

const sceneReady = ref(cachedIntro)
const introRevealing = ref(cachedIntro)
const introComplete = ref(cachedIntro)
const introTextVisible = ref(cachedIntro)
const introPhase = ref(cachedIntro ? 'complete' : 'loading')
const brandDialogOpen = ref(false)
const selectedBrand = ref(null)
const authDialogOpen = ref(false)
const authMode = ref('login')
const authAudience = ref('user')
const accessDialogOpen = ref(false)
const referralDialogOpen = ref(false)
const iaChat = ref(false)
const coursePromptOpen = ref(false)
const founderFocused = ref(null)
const sessionVersion = ref(0)
let introTextTimer
let sceneReadyWatchdog
let coursePromptTimer
let coursePromptInterval

const lead = reactive({ name: '', phone: '', email: '', company: '', message: '' })
const referral = reactive({ name: '', phone: '', leadName: '', notes: '' })

const landingPageStyle = computed(() => ({ minHeight: `${landing3dSections.length * 100}vh` }))
const requiredRule = (value) => Boolean(String(value || '').trim()) || 'Preencha este campo.'

const accountLabel = computed(() => {
  sessionVersion.value
  const session = getStoredSession()
  return session?.name ? String(session.name).trim().split(/\s+/)[0] : 'Entrar'
})

function founderForSection(sectionId) {
  return institutionalFounders.find((founder) => sectionId.endsWith(founder.id)) || institutionalFounders[0]
}

function sectionCopyStyle(index) {
  if (window.innerWidth < 768) return { opacity: 1, transform: 'none' }
  if (prefersReducedMotion.value) return { opacity: activeSection.value === index ? 1 : 0.58, transform: 'none' }
  const distance = Math.abs(sectionPosition.value - index)
  return {
    opacity: Math.max(0.46, 1 - distance * 0.35),
    transform: `translate3d(0, ${Math.min(distance * 18, 18)}px, 0)`
  }
}

function handleSceneReady() {
  sceneReady.value = true
  if (sceneReadyWatchdog) window.clearTimeout(sceneReadyWatchdog)
}
function handleIntroReveal() {
  introPhase.value = 'handoff'
  introRevealing.value = true
  window.clearTimeout(introTextTimer)
  introTextTimer = window.setTimeout(() => {
    introTextVisible.value = true
  }, prefersReducedMotion.value ? 220 : 1450)
}
function handleIntroComplete() {
  introPhase.value = 'complete'
  introComplete.value = true
  try {
    window.sessionStorage.setItem(LANDING_INTRO_CACHE_KEY, '1')
  } catch (error) {
    // Cache is optional when browser storage is blocked.
  }
  scheduleCoursePrompt()
}

function handleAboutCtaClick() {
  router.push('/aitolearn')
}

function handleBrandSelect(brand) {
  selectedBrand.value = brand
  brandDialogOpen.value = true
}

function openAuth(mode = 'login', audience = 'user') {
  const session = getStoredSession()
  if (session?.role === 'admin') return router.push('/admin')
  if (session?.role === 'customer') return router.push('/customer')
  if (session?.role === 'user') return router.push('/app')
  if (session?.role === 'affiliate') return router.push('/affiliate')
  accessDialogOpen.value = false
  authMode.value = mode
  authAudience.value = audience
  authDialogOpen.value = true
}

function openAccessChooser() {
  const session = getStoredSession()
  if (session?.role === 'admin') return router.push('/admin')
  if (session?.role === 'customer') return router.push('/customer')
  if (session?.role === 'affiliate') return router.push('/affiliate')
  if (session?.role === 'user') return router.push('/app')
  accessDialogOpen.value = true
}

function openAuthFromQuery() {
  if (route.query.auth !== 'login') return
  authMode.value = 'login'
  authAudience.value = 'user'
  authDialogOpen.value = true
  const query = { ...route.query }
  delete query.auth
  router.replace({ query })
}

function handleAuthSuccess(data) {
  sessionVersion.value += 1
  router.push(data.user?.role === 'admin' ? '/admin' : data.user?.role === 'affiliate' ? '/affiliate' : '/app')
}

function buildWhatsappUrl(message) {
  return `https://wa.me/556182529083?text=${encodeURIComponent(message)}`
}

async function sendLead() {
  const message = `Ola! Quero falar com a AitoSoftwares.\n\nNome: ${lead.name}\nWhatsApp: ${lead.phone}\nE-mail: ${lead.email}\nEmpresa: ${lead.company}\nContexto: ${lead.message}`
  try {
    await api.post('/leads', { ...lead, source: 'landing-3d' })
  } catch (error) {
    console.warn('[Landing 3D] Nao foi possivel registrar o lead na API.', error)
  }
  window.open(buildWhatsappUrl(message), '_blank', 'noopener,noreferrer')
  if (!localStorage.getItem(USER_TOKEN_KEY)) openAuth('register')
}

function sendReferral() {
  const message = `Ola! Quero indicar uma oportunidade para a AitoSoftwares.\n\nIndicador: ${referral.name}\nWhatsApp: ${referral.phone}\nIndicado: ${referral.leadName}\nContexto: ${referral.notes}`
  api.post('/leads', {
    name: referral.leadName || referral.name,
    phone: referral.phone,
    message: referral.notes,
    source: 'indicacao',
    flowType: 'indicacao',
    tags: ['indicacao']
  }).catch((error) => console.warn('[Landing 3D] Indicacao nao registrada.', error))
  window.open(buildWhatsappUrl(message), '_blank', 'noopener,noreferrer')
  referralDialogOpen.value = false
}

function getStoredSession() {
  const sessions = [
    { tokenKey: 'aito_admin_token', userKey: 'aito_admin_user', fallbackRole: 'admin' },
    { tokenKey: 'aito_user_token', userKey: 'aito_user', fallbackRole: 'user' },
    { tokenKey: 'aito_affiliate_token', userKey: 'aito_affiliate_user', fallbackRole: 'affiliate' },
  ]

  for (const session of sessions) {
    if (!localStorage.getItem(session.tokenKey)) continue
    try {
      const data = JSON.parse(localStorage.getItem(session.userKey) || '{}')
      return { ...data, role: data.role || session.fallbackRole }
    } catch (error) {
      return { role: session.fallbackRole }
    }
  }

  return null
}

function hasAnySession() {
  return Boolean(getStoredSession())
}

function scheduleCoursePrompt() {
  window.clearTimeout(coursePromptTimer)
  window.clearInterval(coursePromptInterval)
  coursePromptTimer = window.setTimeout(() => {
    if (!hasAnySession()) coursePromptOpen.value = true
    coursePromptInterval = window.setInterval(() => {
      if (hasAnySession()) {
        window.clearInterval(coursePromptInterval)
        coursePromptOpen.value = false
        return
      }
      coursePromptOpen.value = true
    }, 5 * 60 * 1000)
  }, 90 * 1000)
}

onMounted(() => {
  openAuthFromQuery()
  if (cachedIntro) scheduleCoursePrompt()
  sceneReadyWatchdog = window.setTimeout(() => {
    if (!sceneReady.value) sceneReady.value = true
  }, LANDING_SCENE_WATCHDOG_MS)
})

watch(() => route.query.auth, openAuthFromQuery)

onBeforeUnmount(() => {
  window.clearTimeout(introTextTimer)
  window.clearTimeout(coursePromptTimer)
  window.clearInterval(coursePromptInterval)
  if (sceneReadyWatchdog) window.clearTimeout(sceneReadyWatchdog)
})
</script>

<style scoped>
.landing-3d {
  --aito-teal: #13bc9d;
  --aito-teal-dark: #12ad89;
  --aito-aqua: #8fffee;
  --aito-ink: #03090b;
  --aito-panel: rgba(4, 24, 25, 0.72);
  position: relative;
  min-height: 800vh;
  overflow: clip;
  color: #effffb;
  background: #03090b;
  isolation: isolate;
}

.landing-3d__header,
.landing-3d__content,
.landing-3d__progress,
.landing-3d__counter,
.landing-3d__ai-float,
.landing-3d__surprise-float,
.landing-3d__instagram-link {
  transition: opacity 850ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 850ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 850ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.landing-3d--intro-loading .landing-3d__header,
.landing-3d--intro-loading .landing-3d__content,
.landing-3d--intro-loading .landing-3d__progress,
.landing-3d--intro-loading .landing-3d__counter,
.landing-3d--intro-loading .landing-3d__ai-float,
.landing-3d--intro-loading .landing-3d__surprise-float,
.landing-3d--intro-loading .landing-3d__instagram-link {
  opacity: 0;
  filter: blur(10px);
  pointer-events: none;
  transform: translateY(14px);
}

.landing-3d--intro-object-only .landing-3d__header,
.landing-3d--intro-object-only .landing-3d__content,
.landing-3d--intro-object-only .landing-3d__progress,
.landing-3d--intro-object-only .landing-3d__counter,
.landing-3d--intro-object-only .landing-3d__ai-float,
.landing-3d--intro-object-only .landing-3d__surprise-float,
.landing-3d--intro-object-only .landing-3d__instagram-link {
  opacity: 0;
  filter: blur(10px);
  pointer-events: none;
  transform: translateY(10px);
}

.landing-3d--intro-object-only .landing-3d__section--inicio .landing-3d__copy {
  transform: translateX(-2.4rem) !important;
}

.landing-3d__atmosphere,
.landing-3d__noise {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transition: opacity 1200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.landing-3d--intro-loading .landing-3d__atmosphere,
.landing-3d--intro-loading .landing-3d__noise {
  opacity: 0;
}

.landing-3d__atmosphere {
  background: radial-gradient(circle at 52% 28%, rgba(19, 188, 157, 0.11), transparent 32rem), linear-gradient(90deg, rgba(3, 9, 11, 0.24), transparent 46%, rgba(3, 9, 11, 0.32));
}

.landing-3d__noise {
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
}

.landing-3d__header {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 8;
  display: flex;
  width: 100%;
  padding: 1.35rem clamp(1rem, 5vw, 5rem);
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.landing-3d__brand,
.landing-3d__account-link {
  border: 0;
  cursor: pointer;
  pointer-events: auto;
}

.landing-3d__brand {
  display: inline-flex;
  padding: 0;
  align-items: center;
  gap: 0.65rem;
  color: #f5fffd;
  background: transparent;
  font: 800 0.78rem/1 system-ui, sans-serif;
  letter-spacing: 0.12em;
}

.landing-3d__brand img { filter: drop-shadow(0 0 16px rgba(19, 188, 157, 0.34)); }
.landing-3d__brand > span > span { color: var(--aito-teal); }

.landing-3d__header-actions { display: flex; align-items: center; gap: 0.65rem; }

.landing-3d__account-link {
  display: inline-flex;
  min-height: 2.55rem;
  padding: 0.22rem 0.28rem 0.22rem 0.9rem;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgba(19, 188, 157, 0.36);
  border-radius: 999px;
  color: #effffb;
  background: rgba(3, 20, 21, 0.72);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.24);
  font: 800 0.68rem/1 system-ui, sans-serif;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  backdrop-filter: blur(14px);
}

.landing-3d__account-link { padding: 0.2rem 0.82rem; color: var(--aito-aqua); }
.landing-3d__account-link .q-icon { font-size: 1.08rem; }
.landing-3d__account-link:hover,
.landing-3d__account-link:focus-visible { border-color: var(--aito-teal); outline: none; box-shadow: 0 18px 52px rgba(19, 188, 157, 0.24); }

.landing-3d__content { position: relative; z-index: 2; }

.landing-3d__section {
  position: relative;
  display: flex;
  width: min(100%, 1480px);
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  padding: 6.7rem clamp(1rem, 5vw, 5rem) 4.8rem;
  align-items: center;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.landing-3d__section-inner { display: grid; width: 100%; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); align-items: center; gap: clamp(2rem, 6vw, 6rem); }
.landing-3d__section--inicio .landing-3d__section-inner { grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); }
.landing-3d__section--right .landing-3d__copy { order: 2; }
.landing-3d__section--right .landing-3d__visual { order: 1; }
.landing-3d__section--center .landing-3d__section-inner { grid-template-columns: 1fr; }
.landing-3d__section--center .landing-3d__copy { max-width: 52rem; margin: 0 auto; text-align: center; }
.landing-3d__section--center .landing-3d__eyebrow { justify-content: center; }

.landing-3d__copy { position: relative; z-index: 2; transition: opacity 180ms linear, transform 180ms linear; }
.landing-3d__copy::before { position: absolute; z-index: -1; inset: -4.5rem -4rem; content: ''; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(3, 9, 11, 0.92), rgba(3, 9, 11, 0.45) 48%, transparent 75%); pointer-events: none; }
.landing-3d__eyebrow { display: flex; margin: 0 0 1rem; align-items: center; gap: 0.65rem; color: var(--aito-aqua); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
.landing-3d__eyebrow::before { width: 2rem; height: 1px; content: ''; background: linear-gradient(90deg, var(--aito-teal), transparent); }
.landing-3d__title { max-width: 13ch; margin: 0; color: #f1fffc; font-family: 'Tomorrow', 'Trebuchet MS', system-ui, sans-serif; font-size: 4.6rem; font-weight: 800; letter-spacing: 0; line-height: 0.98; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.62); background: linear-gradient(135deg, #f3fffd 8%, var(--aito-teal) 68%, var(--aito-aqua)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.landing-3d__section--inicio .landing-3d__title { max-width: 16ch; font-size: 3.8rem; }
.landing-3d__section--center .landing-3d__title { max-width: 16ch; margin-inline: auto; }
.landing-3d__description { max-width: 34rem; margin: 1.35rem 0 0; color: rgba(232, 255, 250, 0.82); font-size: 1.02rem; line-height: 1.62; text-shadow: 0 2px 18px rgba(0, 0, 0, 0.75); }
.landing-3d__section--center .landing-3d__description { margin-inline: auto; }

.landing-3d__visual { position: relative; z-index: 2; min-width: 0; }
.landing-3d__hero-actions { display: flex; margin-top: 2rem; gap: 0.7rem; flex-wrap: wrap; }
.landing-3d__cta { display: inline-flex; min-height: 3.25rem; padding: 0.28rem 0.32rem 0.28rem 1.1rem; align-items: center; gap: 0.85rem; border: 1px solid rgba(19, 188, 157, 0.45); border-radius: 999px; color: #effffb; background: rgba(4, 24, 25, 0.68); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24); font: 700 0.76rem/1.2 'Montserrat', system-ui, sans-serif; letter-spacing: 0.01em; text-decoration: none; cursor: pointer; backdrop-filter: blur(12px); transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease; }
.landing-3d__cta:hover, .landing-3d__cta:focus-visible { border-color: var(--aito-aqua); outline: none; transform: translateY(-2px); box-shadow: 0 18px 58px rgba(19, 188, 157, 0.25); }
.landing-3d__cta .q-icon { display: grid; width: 2.55rem; height: 2.55rem; border-radius: 50%; place-items: center; color: #02100e; background: linear-gradient(135deg, var(--aito-teal), var(--aito-aqua)); font-size: 1.02rem; }
.landing-3d__cta--secondary { background: rgba(3, 16, 18, 0.42); }
.landing-3d__cta--secondary .q-icon { color: var(--aito-aqua); background: rgba(19, 188, 157, 0.12); }
.landing-3d__cta--surprise { color: #031411; background: linear-gradient(135deg, var(--aito-teal), var(--aito-dark, #12ad89) 54%, var(--aito-aqua)); border-color: rgba(143, 255, 238, 0.74); }
.landing-3d__cta--surprise .q-icon { color: #dffff8; background: rgba(2, 18, 17, 0.76); }
.landing-3d__proof-row { display: flex; margin-top: 2rem; gap: 1rem; flex-wrap: wrap; color: rgba(220, 250, 244, 0.66); font-size: 0.68rem; }
.landing-3d__proof-row span { display: grid; padding-left: 0.8rem; border-left: 1px solid rgba(19, 188, 157, 0.35); gap: 0.18rem; }
.landing-3d__proof-row strong { color: var(--aito-teal); font-size: 1.12rem; }

.landing-3d__service-grid, .landing-3d__case-grid, .landing-3d__satisfaction-grid { display: grid; gap: 0.8rem; }
.landing-3d__service-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.landing-3d__service-card, .landing-3d__case-card, .landing-3d__testimonial, .landing-3d__satisfaction-meter, .landing-3d__founder-card, .landing-3d__lead-form { border: 1px solid rgba(19, 188, 157, 0.26); border-radius: 0.8rem; background: linear-gradient(145deg, rgba(7, 35, 35, 0.72), rgba(2, 15, 17, 0.64)); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08); backdrop-filter: blur(14px); }
.landing-3d__service-card { padding: 1.1rem; }
.landing-3d__icon-bubble, .landing-3d__case-icon { display: grid; width: 2.35rem; height: 2.35rem; border-radius: 0.7rem; place-items: center; color: #02110e; background: linear-gradient(135deg, var(--aito-teal), var(--aito-aqua)); }
.landing-3d__service-card h3, .landing-3d__case-card h3 { margin: 0.8rem 0 0.35rem; color: #f4fffd; font-size: 1rem; }
.landing-3d__service-card p, .landing-3d__case-card p { margin: 0; color: rgba(225, 255, 249, 0.75); font-size: 0.78rem; line-height: 1.5; }
.landing-3d__service-card ul { display: grid; margin: 0.85rem 0 0; padding: 0; gap: 0.3rem; color: rgba(191, 245, 235, 0.7); font-size: 0.68rem; list-style: none; }
.landing-3d__service-card li::before { margin-right: 0.35rem; content: '·'; color: var(--aito-teal); font-weight: 900; }
.landing-3d__case-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.landing-3d__case-card { display: flex; min-height: 17rem; padding: 1.1rem; flex-direction: column; }
.landing-3d__case-kicker { margin-top: 1rem !important; color: var(--aito-aqua) !important; font-size: 0.68rem !important; font-weight: 800; }
.landing-3d__case-card h3 { font-size: 1.15rem; }
.landing-3d__tag-row { display: flex; margin-top: auto; gap: 0.35rem; flex-wrap: wrap; }
.landing-3d__tag-row span { padding: 0.26rem 0.42rem; border: 1px solid rgba(19, 188, 157, 0.25); border-radius: 999px; color: var(--aito-aqua); font-size: 0.58rem; }
.landing-3d__case-link, .landing-3d__dialog-link { display: inline-flex; margin-top: 0.9rem; align-items: center; gap: 0.3rem; color: var(--aito-aqua); font-size: 0.68rem; font-weight: 800; text-decoration: none; }
.landing-3d__case-link .q-icon, .landing-3d__dialog-link .q-icon { font-size: 0.95rem; }

.landing-3d__satisfaction-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.landing-3d__satisfaction-meter { display: flex; min-height: 11rem; padding: 1.2rem; flex-direction: column; align-items: flex-start; justify-content: center; }
.landing-3d__satisfaction-meter .q-icon { color: #ff7eaa; font-size: 2rem; }
.landing-3d__satisfaction-meter strong { margin-top: 0.45rem; color: var(--aito-aqua); font-size: 3rem; line-height: 1; }
.landing-3d__satisfaction-meter span { color: rgba(238, 255, 251, 0.82); font-size: 0.8rem; }
.landing-3d__satisfaction-meter small { margin-top: 0.75rem; color: rgba(225, 255, 249, 0.62); font-size: 0.68rem; }
.landing-3d__testimonial { padding: 1rem; }
.landing-3d__testimonial-head { display: flex; align-items: center; gap: 0.65rem; }
.landing-3d__testimonial-head img, .landing-3d__avatar-placeholder { display: grid; width: 2.2rem; height: 2.2rem; border-radius: 50%; object-fit: cover; place-items: center; color: var(--aito-aqua); background: rgba(19, 188, 157, 0.16); }
.landing-3d__testimonial-head div { display: grid; gap: 0.12rem; }
.landing-3d__testimonial-head strong { color: #effffb; font-size: 0.76rem; }
.landing-3d__testimonial-head small { color: rgba(225, 255, 249, 0.55); font-size: 0.62rem; }
.landing-3d__testimonial p { margin: 1rem 0 0; color: rgba(233, 255, 250, 0.78); font-size: 0.8rem; line-height: 1.55; }

.landing-3d__founder-card { display: grid; padding: 1rem; grid-template-columns: auto 1fr auto; align-items: center; gap: 1rem; opacity: .24; cursor: pointer; outline: none; transition: opacity 280ms ease, transform 280ms ease, filter 280ms ease; filter: saturate(.58); }
.landing-3d__founder-card:hover, .landing-3d__founder-card:focus-visible, .landing-3d__founder-card.is-focused { opacity: 1; filter: saturate(1); transform: translateY(-3px); }
.landing-3d__founder-image { width: 5.2rem; height: 5.2rem; border: 1px solid rgba(143, 255, 238, 0.5); border-radius: 50%; object-fit: cover; box-shadow: 0 0 28px rgba(19, 188, 157, 0.2); }
.landing-3d__founder-role { display: block; color: var(--aito-aqua); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0; transform: translateY(5px); transition: opacity 250ms ease, transform 250ms ease; }
.landing-3d__founder-card p { margin: 0.55rem 0 0; color: rgba(230, 255, 250, 0.78); font-size: 0.84rem; line-height: 1.5; opacity: 0; transform: translateY(5px); transition: opacity 250ms ease, transform 250ms ease; }
.landing-3d__founder-card:hover .landing-3d__founder-role, .landing-3d__founder-card:hover p, .landing-3d__founder-card:focus-visible .landing-3d__founder-role, .landing-3d__founder-card:focus-visible p, .landing-3d__founder-card.is-focused .landing-3d__founder-role, .landing-3d__founder-card.is-focused p { opacity: 1; transform: none; }
.landing-3d__founder-socials { display: flex; gap: 0.45rem; }
.landing-3d__founder-socials a { display: grid; width: 2.25rem; height: 2.25rem; border: 1px solid rgba(19, 188, 157, 0.34); border-radius: 50%; place-items: center; color: var(--aito-aqua); background: rgba(19, 188, 157, 0.1); }

.landing-3d__contact-copy { display: grid; margin-top: 1.5rem; gap: 0.7rem; }
.landing-3d__text-link { display: inline-flex; width: fit-content; padding: 0; align-items: center; gap: 0.45rem; border: 0; color: var(--aito-aqua); background: transparent; font-size: 0.72rem; cursor: pointer; }
.landing-3d__text-link .q-icon { font-size: 1.05rem; }
.landing-3d__lead-form { padding: 1.25rem; }
.landing-3d__lead-form :deep(.q-field__control) { min-height: 2.85rem; color: #f0fffc; background: rgba(5, 33, 34, 0.86); }
.landing-3d__lead-form :deep(.q-field__native), .landing-3d__lead-form :deep(.q-field__input) { color: #f0fffc !important; caret-color: var(--aito-aqua); }
.landing-3d__lead-form :deep(.q-field__label) { color: rgba(208, 250, 242, 0.72); }
.landing-3d__lead-form :deep(.q-field--focused .q-field__label), .landing-3d__lead-form :deep(.q-field--float .q-field__label) { color: var(--aito-aqua); }
.landing-3d__lead-form :deep(.q-field--outlined .q-field__control:before) { border-color: rgba(80, 212, 190, 0.42); }
.landing-3d__lead-form :deep(.q-field--outlined:hover .q-field__control:before), .landing-3d__lead-form :deep(.q-field--focused .q-field__control:after) { border-color: var(--aito-aqua); }
.landing-3d__lead-form :deep(.q-field__marginal) { color: var(--aito-aqua); }
.landing-3d__form-heading { display: flex; align-items: center; gap: 0.5rem; color: var(--aito-aqua); font-size: 0.82rem; font-weight: 800; }
.landing-3d__form-grid { display: grid; margin-top: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
.landing-3d__form-full { grid-column: 1 / -1; }
.landing-3d__form-actions { display: flex; margin-top: 0.85rem; gap: 0.55rem; flex-wrap: wrap; }
.landing-3d__form-submit, .landing-3d__auth-submit { border-radius: 999px; color: #00bb96; background: linear-gradient(135deg, var(--aito-teal), var(--aito-aqua)); font-weight: 800; }
.landing-3d__referral-button { display: inline-flex; min-height: 2.7rem; padding: 0.55rem 0.8rem; align-items: center; gap: 0.4rem; border: 1px solid rgba(143, 255, 238, 0.36); border-radius: 999px; color: var(--aito-aqua); background: rgba(19, 188, 157, 0.08); font-size: 0.7rem; cursor: pointer; }

.landing-3d__ambient-panel { display: grid; min-height: 13rem; padding: 2rem; border: 1px solid rgba(19, 188, 157, 0.24); border-radius: 1rem; place-items: center; text-align: center; background: rgba(3, 24, 25, 0.5); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24); backdrop-filter: blur(14px); }
.landing-3d__ambient-panel .q-icon { color: var(--aito-teal); font-size: 2.5rem; }
.landing-3d__ambient-panel strong { color: #f1fffc; font-size: 1.25rem; }
.landing-3d__ambient-panel span:last-child { color: rgba(225, 255, 249, 0.65); font-size: 0.8rem; }

.landing-3d__scroll-cue { position: absolute; bottom: 1.6rem; left: clamp(1rem, 5vw, 5rem); display: flex; align-items: center; gap: 0.7rem; color: rgba(220, 250, 244, 0.5); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; }
.landing-3d__scroll-cue i { display: block; width: 3.4rem; height: 1px; background: linear-gradient(90deg, transparent, var(--aito-teal), transparent); }
.landing-3d__progress { position: fixed; top: 50%; right: 1.5rem; z-index: 7; display: flex; flex-direction: column; gap: 0.45rem; transform: translateY(-50%); }
.landing-3d__progress button { display: grid; width: 1.3rem; height: 1.3rem; padding: 0; border: 0; place-items: center; background: transparent; cursor: pointer; }
.landing-3d__progress button span { display: block; width: 3px; height: 3px; border-radius: 999px; background: rgba(220, 250, 244, 0.3); transition: height 200ms ease, background 200ms ease; }
.landing-3d__progress button.is-active span { height: 1.25rem; background: linear-gradient(var(--aito-aqua), var(--aito-teal)); }
.landing-3d__counter { position: fixed; right: 3.8rem; bottom: 1.65rem; z-index: 7; display: flex; margin: 0; align-items: center; gap: 0.6rem; color: rgba(220, 250, 244, 0.44); font: 0.62rem/1 system-ui, sans-serif; letter-spacing: 0.12em; }
.landing-3d__counter span:first-child { color: var(--aito-aqua); }
.landing-3d__counter i { width: 1.45rem; height: 1px; background: rgba(220, 250, 244, 0.22); }
.landing-3d__ai-float { position: fixed; right: 1.3rem; bottom: 4.5rem; z-index: 8; display: grid; width: 4.15rem; height: 4.15rem; padding: 0; border: 1px solid rgba(19, 188, 157, 0.55); border-radius: 1.15rem; place-items: center; background: linear-gradient(135deg, var(--aito-teal), var(--aito-teal-dark)); box-shadow: 0 15px 40px rgba(19, 188, 157, 0.34); cursor: pointer; }
.landing-3d__ai-float img { width: 3rem; height: 3rem; object-fit: contain; }
.landing-3d__surprise-float { position: fixed; right: 1.85rem; bottom: 9.35rem; z-index: 8; display: grid; width: 3rem; height: 3rem; padding: 0; border: 1px solid rgba(143,255,238,.62); border-radius: 50%; place-items: center; color: #03120f; background: linear-gradient(135deg, var(--aito-aqua), var(--aito-teal)); box-shadow: 0 14px 36px rgba(19,188,157,.3); cursor: pointer; transition: transform 200ms ease, filter 200ms ease, box-shadow 200ms ease; }
.landing-3d__surprise-float:hover, .landing-3d__surprise-float:focus-visible { outline: none; filter: saturate(1.14) brightness(1.06); box-shadow: 0 16px 42px rgba(19,188,157,.38); transform: translateY(-2px); }
.landing-3d__instagram-link { display: grid; width: 2.55rem; height: 2.55rem; border: 1px solid rgba(143, 255, 238, 0.46); border-radius: 50%; place-items: center; color: #03120f; background: linear-gradient(135deg, var(--aito-aqua), var(--aito-teal)); box-shadow: 0 14px 36px rgba(19, 188, 157, 0.28); font-size: 1.3rem; text-decoration: none; pointer-events: auto; transition: transform 200ms ease, filter 200ms ease, box-shadow 200ms ease; }
.landing-3d__instagram-link:hover, .landing-3d__instagram-link:focus-visible { outline: none; filter: saturate(1.14) brightness(1.06); box-shadow: 0 16px 42px rgba(19, 188, 157, 0.36); transform: translateY(-2px); }

.landing-3d__dialog-card { width: min(92vw, 30rem); border: 1px solid rgba(19, 188, 157, 0.42); border-radius: 0.95rem; color: #effffb; background: radial-gradient(circle at 10% 0%, rgba(19, 188, 157, 0.2), transparent 14rem), linear-gradient(145deg, rgba(3, 23, 24, 0.98), rgba(1, 10, 12, 0.98)); box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55); }
.landing-3d__dialog-card :deep(.q-field__control) { min-height: 2.85rem; color: #f0fffc; background: rgba(5, 33, 34, 0.86); }
.landing-3d__dialog-card :deep(.q-field__native), .landing-3d__dialog-card :deep(.q-field__input) { color: #f0fffc !important; caret-color: var(--aito-aqua); }
.landing-3d__dialog-card :deep(.q-field__label) { color: rgba(208, 250, 242, 0.72); }
.landing-3d__dialog-card :deep(.q-field--focused .q-field__label), .landing-3d__dialog-card :deep(.q-field--float .q-field__label) { color: var(--aito-aqua); }
.landing-3d__dialog-card :deep(.q-field--outlined .q-field__control:before) { border-color: rgba(80, 212, 190, 0.42); }
.landing-3d__dialog-card :deep(.q-field--outlined:hover .q-field__control:before), .landing-3d__dialog-card :deep(.q-field--focused .q-field__control:after) { border-color: var(--aito-aqua); }
.landing-3d__dialog-card :deep(.q-field__bottom) { padding-top: 0.25rem; color: rgba(208, 250, 242, 0.72); }
.landing-3d__dialog-card :deep(.q-field__messages) { color: #ff9eaf; }
.landing-3d__dialog-card :deep(.q-field--error .q-field__label), .landing-3d__dialog-card :deep(.q-field--error .q-field__native) { color: #ff9eaf !important; }
.landing-3d__dialog-card :deep(.q-field__marginal) { color: var(--aito-aqua); }
.landing-3d__dialog-card :deep(.q-btn--flat) { color: #dffff8; }
.landing-3d__dialog-head { display: flex; padding: 1rem 1.1rem 0.45rem; align-items: flex-start; justify-content: space-between; }
.landing-3d__dialog-head h3 { margin: 0.25rem 0 0; color: #f2fffc; font-size: 1.2rem; }
.landing-3d__dialog-kicker { color: var(--aito-aqua); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.landing-3d__dialog-body { padding: 0.5rem 1.1rem 1.25rem; }
.landing-3d__dialog-body p { margin: 0; color: rgba(230, 255, 250, 0.76); line-height: 1.6; }
.landing-3d__auth-tabs { display: flex; padding: 0.5rem 1.1rem; gap: 0.45rem; border-top: 1px solid rgba(19, 188, 157, 0.16); border-bottom: 1px solid rgba(19, 188, 157, 0.16); }
.landing-3d__auth-tabs button { padding: 0.42rem 0.65rem; border: 0; border-radius: 999px; color: rgba(225, 255, 249, 0.62); background: transparent; font-size: 0.68rem; cursor: pointer; }
.landing-3d__auth-tabs button.is-active { color: #03120f; background: var(--aito-teal); font-weight: 800; }
.landing-3d__course-prompt { width: min(92vw, 34rem); }
.landing-3d__auth-separator { display: flex; margin: 1rem 0; align-items: center; gap: 0.65rem; color: rgba(225, 255, 249, 0.4); font-size: 0.68rem; }
.landing-3d__auth-separator::before, .landing-3d__auth-separator::after { flex: 1; height: 1px; content: ''; background: rgba(19, 188, 157, 0.2); }
.landing-3d__forgot-password { color: #8fffee; font-size: .7rem; }
.landing-3d__google-button { display: flex; width: 100%; min-height: 2.7rem; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid rgba(19, 188, 157, 0.3); border-radius: 999px; color: #effffb; background: rgba(19, 188, 157, 0.08); font-size: 0.74rem; cursor: pointer; }
.landing-3d__google-button .q-icon { color: var(--aito-aqua); }
.landing-3d__project-login { min-height: 2.7rem; border-color: rgba(143, 255, 238, 0.42); border-radius: 999px; color: #8fffee; background: rgba(19, 188, 157, 0.04); font-size: 0.74rem; }
.landing-3d__auth-note { display: block; margin-top: 0.9rem; color: rgba(225, 255, 249, 0.42); font-size: 0.62rem; line-height: 1.45; }
.landing-3d__access-dialog { width: min(92vw, 34rem); }
.landing-3d__access-options { display: grid; gap: .65rem; }
.landing-3d__access-options button { display: grid; grid-template-columns: 2rem 1fr auto; align-items: center; gap: .7rem; width: 100%; padding: .85rem; border: 1px solid rgba(19,188,157,.28); border-radius: .7rem; color: #effffb; background: rgba(19,188,157,.06); text-align: left; cursor: pointer; transition: border-color 180ms ease, transform 180ms ease, background 180ms ease; }
.landing-3d__access-options button:hover, .landing-3d__access-options button:focus-visible { border-color: #8fffee; background: rgba(19,188,157,.14); outline: none; transform: translateY(-2px); }
.landing-3d__access-options button > .q-icon:first-child { color: #8fffee; font-size: 1.55rem; }
.landing-3d__access-options button > .q-icon:last-child { color: rgba(239,255,251,.5); }
.landing-3d__access-options span { display: grid; gap: .2rem; }
.landing-3d__access-options strong { font-size: .8rem; }
.landing-3d__access-options small { color: rgba(239,255,251,.58); font-size: .68rem; }

@media (max-width: 1100px) {
  .landing-3d__title { font-size: 3.7rem; }
  .landing-3d__section--inicio .landing-3d__title { font-size: 3.25rem; }
  .landing-3d__section-inner { gap: 2rem; }
  .landing-3d__case-grid { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .landing-3d__header { padding: 1rem 0.9rem; }
  .landing-3d__account-label { display: inline; max-width: 7ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .landing-3d__account-link { padding: 0.25rem 0.62rem; }
  .landing-3d__progress { display: none; }
  .landing-3d__section { padding: 5.7rem 0.9rem 4.6rem; align-items: flex-start; }
  .landing-3d__section-inner, .landing-3d__section--right .landing-3d__section-inner { display: flex; flex-direction: column; gap: 1rem; }
  .landing-3d__section--right .landing-3d__copy, .landing-3d__section--right .landing-3d__visual { order: initial; }
  .landing-3d__copy, .landing-3d__visual { width: 100%; }
  .landing-3d__copy::before { inset: -2rem -1rem; background: radial-gradient(ellipse at center, rgba(3, 9, 11, 0.9), rgba(3, 9, 11, 0.38) 58%, transparent 78%); }
  .landing-3d__title { max-width: 13ch; font-size: 2.55rem; line-height: 1.02; }
  .landing-3d__section--inicio .landing-3d__title { font-size: 2.55rem; }
  .landing-3d__description { margin-top: 0.9rem; font-size: 0.88rem; line-height: 1.54; }
  .landing-3d__hero-actions { margin-top: 1.2rem; flex-direction: column; align-items: stretch; }
  .landing-3d__cta { width: 100%; justify-content: space-between; }
  .landing-3d__cta--surprise { justify-content: center; }
  .landing-3d__proof-row { margin-top: 1.3rem; gap: 0.75rem; }
  .landing-3d__proof-row span { font-size: 0.58rem; }
  .landing-3d__proof-row strong { font-size: 0.95rem; }
  .landing-3d__service-grid, .landing-3d__satisfaction-grid { grid-template-columns: 1fr; }
  .landing-3d__service-card { padding: 0.85rem; }
  .landing-3d__founder-card { grid-template-columns: auto 1fr; }
  .landing-3d__founder-socials { grid-column: 1 / -1; justify-content: flex-end; }
  .landing-3d__form-grid { grid-template-columns: 1fr; }
  .landing-3d__form-full { grid-column: auto; }
  .landing-3d__form-actions { flex-direction: column; }
  .landing-3d__form-submit, .landing-3d__referral-button { width: 100%; justify-content: center; }
  .landing-3d__scroll-cue { bottom: 1.25rem; left: 0.9rem; }
  .landing-3d__counter { right: 0.9rem; bottom: 1.25rem; }
  .landing-3d__ai-float { right: 0.75rem; bottom: 4.4rem; width: 3.75rem; height: 3.75rem; }
  .landing-3d__ai-float img { width: 2.75rem; height: 2.75rem; }
  .landing-3d__surprise-float { right: 1.15rem; bottom: 8.75rem; width: 2.8rem; height: 2.8rem; }
  .landing-3d__instagram-link { width: 2.35rem; height: 2.35rem; font-size: 1.18rem; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-3d__copy, .landing-3d__header, .landing-3d__content { transition: none; }
}
</style>
