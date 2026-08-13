<template>
  <main class="learn-launch" :style="{ minHeight: `${navSections.length * 100}vh` }">
    <AuthDialog
      v-model="authDialogOpen"
      :return-path="route.fullPath"
      :show-project-login="false"
      audience="user"
      @authenticated="handleAuthenticated"
    />
    <AitoThreeScene
      course-stage
      :section-count="navSections.length"
      :scroll-progress="scrollProgress"
      :reduced-motion="prefersReducedMotion"
      @ready="handleSceneReady"
    />

    <div class="learn-launch__veil" aria-hidden="true"></div>

    <header class="learn-launch__header">
      <router-link class="learn-launch__brand" to="/" aria-label="Voltar para AitoSoftwares">
        <img src="/favicon.png" alt="" width="34" height="34" />
        <span>AITO<span>LEARN</span></span>
      </router-link>
      <div class="learn-launch__header-actions">
        <router-link class="learn-launch__legal-link" to="/politica-privacidade">Privacidade</router-link>
        <button v-if="!isUser && !isAffiliate" class="learn-launch__login" type="button" @click="openUserLogin">
          <q-icon name="mdi-login" aria-hidden="true" /> Entrar/Cadastrar
        </button>
        <button v-if="isUser" class="learn-launch__login" type="button" @click="router.push('/app')">
          <q-icon name="mdi-school-outline" aria-hidden="true" /> Area do estudante
        </button>
        <button v-if="isAffiliate" class="learn-launch__login" type="button" @click="router.push('/affiliate')">
          <q-icon name="mdi-account-star-outline" aria-hidden="true" /> Area do afiliado
        </button>
        <button class="learn-launch__back" type="button" @click="router.push('/')">
          <q-icon name="mdi-arrow-left" aria-hidden="true" />
          Voltar para Aito
        </button>
      </div>
    </header>

    <nav class="learn-launch__progress" aria-label="Navegacao do curso">
      <button
        v-for="(section, index) in navSections"
        :key="section.id"
        type="button"
        :class="{ 'is-active': activeSection === index }"
        :aria-label="`Ir para ${section.label}`"
        @click="scrollToSection(section.id)"
      ></button>
    </nav>

    <div class="learn-launch__content">
      <section id="catalogo" data-landing-3d-section class="learn-launch__section learn-launch__section--catalog">
        <div class="learn-launch__catalog">
          <div class="learn-launch__catalog-head">
            <div><p class="learn-launch__eyebrow">AITOLEARN / CATALOGO</p><h1>Aprenda e construa.</h1></div>
            <q-icon name="mdi-school-outline" size="76px" aria-hidden="true" />
          </div>
          <div class="learn-launch__catalog-search"><q-input v-model="catalogSearch" outlined clearable label="Buscar cursos" @keyup.enter="loadCatalog"><template #prepend><q-icon name="mdi-magnify" /></template></q-input><q-btn unelevated no-caps class="learn-launch__button learn-launch__button--primary" icon="mdi-magnify" label="Buscar" :loading="catalogLoading" @click="loadCatalog" /></div>
          <div v-if="catalogLoading && !catalogCourses.length" class="learn-launch__catalog-loading"><q-spinner color="teal-3" size="32px" /> Carregando trilhas...</div>
          <template v-else>
            <div class="learn-launch__catalog-row">
              <div class="learn-launch__catalog-row-head"><p class="learn-launch__eyebrow">TRILHAS GRATUITAS</p></div>
              <div class="learn-launch__course-carousel" role="list" aria-label="Trilhas gratuitas">
                <button v-for="course in freeCourses" :key="`free-${course._id}`" type="button" class="learn-launch__course-card" role="listitem" @click="openCourse(course)">
                  <div class="learn-launch__course-image"><img v-if="course.banner" :src="course.banner.url" :alt="course.title" loading="lazy" decoding="async" fetchpriority="low"><div v-else><q-icon name="mdi-school-outline" size="32px" /></div><span>Gratis</span></div>
                  <div><strong>{{ course.title }}</strong><small>{{ course.topicCount || 0 }} aulas · {{ course.hours || 0 }}h</small><b>Gratis</b></div>
                </button>
                <div v-if="!freeCourses.length" class="learn-launch__catalog-empty">Novas trilhas gratuitas em breve.</div>
              </div>
            </div>
            <div v-for="group in tagCarousels" :key="group.key" class="learn-launch__catalog-row">
              <div class="learn-launch__catalog-row-head"><p class="learn-launch__eyebrow">{{ group.label }}</p></div>
              <div class="learn-launch__course-carousel" role="list" :aria-label="`Trilhas ${group.label}`">
                <button v-for="course in group.courses" :key="`${group.key}-${course._id}`" type="button" class="learn-launch__course-card" role="listitem" @click="openCourse(course)">
                  <div class="learn-launch__course-image"><img v-if="course.banner" :src="course.banner.url" :alt="course.title" loading="lazy" decoding="async" fetchpriority="low"><div v-else><q-icon name="mdi-school-outline" size="32px" /></div><span v-if="isPromotion(course)">Promo</span><span v-else-if="currentPrice(course) <= 0">Gratis</span></div>
                  <div><strong>{{ course.title }}</strong><small>{{ course.topicCount || 0 }} aulas · {{ course.hours || 0 }}h</small><b v-if="isPromotion(course)"><s>{{ money(course.price) }}</s> {{ money(currentPrice(course)) }}</b><b v-else>{{ money(currentPrice(course)) }}</b></div>
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>
      <section
        v-for="(section, index) in sections"
        :id="section.id"
        :key="section.id"
        data-landing-3d-section
        class="learn-launch__section"
        :class="`learn-launch__section--${section.kind}`"
      >
        <div class="learn-launch__section-inner">
          <div class="learn-launch__copy">
            <p class="learn-launch__eyebrow">{{ section.eyebrow }}</p>
            <h1 v-if="index === 0">{{ section.title }}</h1>
            <h2 v-else>{{ section.title }}</h2>
            <p class="learn-launch__description">{{ section.description }}</p>

            <div v-if="section.kind === 'hero'" class="learn-launch__actions">
              <button type="button" class="learn-launch__button learn-launch__button--ghost" @click="scrollToSection('frontend')">
                Conhecer a trilha
                <q-icon name="mdi-play-circle-outline" aria-hidden="true" />
              </button>
            </div>

            <div v-if="section.kind === 'hero'" class="learn-launch__proof">
              <span><q-icon name="mdi-shield-check-outline" /> Initializers seguros</span>
              <span><q-icon name="mdi-cloud-outline" /> Stack real na nuvem</span>
              <span><q-icon name="mdi-rocket-launch-outline" /> Projeto vendavel</span>
            </div>

            <div v-if="section.kind === 'method'" class="learn-launch__pillars">
              <span v-for="item in section.items" :key="item"><q-icon name="mdi-check-circle-outline" /> {{ item }}</span>
            </div>
          </div>

          <div class="learn-launch__media-column">
            <div v-if="section.media === 'video'" class="learn-launch__media-card learn-launch__media-card--video">
              <div class="learn-launch__media-tag"><q-icon name="mdi-play" /> Aula demonstrativa</div>
              <div class="learn-launch__video-wrap">
                <iframe
                  :src="videoUrl"
                  title="AitoLearn - aula demonstrativa"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                ></iframe>
              </div>
              <!-- <span class="learn-launch__media-caption">Veja a mentalidade por tras de um projeto high ticket.</span> -->
            </div>

            <div v-else-if="section.image" class="learn-launch__media-card">
              <div class="learn-launch__media-tag"><q-icon :name="section.icon" /> {{ section.mediaLabel }}</div>
              <img :src="section.image" :alt="section.mediaAlt" loading="lazy" />
              <span class="learn-launch__media-caption">{{ section.mediaCaption }}</span>
            </div>

            <div v-if="section.kind === 'method'" class="learn-launch__stack-strip">
              <span v-for="stack in section.stack" :key="stack">{{ stack }}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="inscricao" data-landing-3d-section class="learn-launch__section learn-launch__section--form">
        <div class="learn-launch__section-inner">
          <div class="learn-launch__copy">
            <p class="learn-launch__eyebrow">05 / SUA PROXIMA FASE</p>
            <h2>Construa sistemas que clientes high ticket querem comprar.</h2>
            <p class="learn-launch__description">Conheca as trilhas AitoLearn e receba novidades sobre novos cursos, projetos reais, certificados e os proximos passos para evoluir.</p>
            <!-- <div class="learn-launch__mini-note"><q-icon name="mdi-lock-outline" /> Seus dados ficam protegidos e sao usados apenas .</div> -->
          </div>

          <q-form class="learn-launch__lead-form" @submit.prevent="submitLead">
            <div class="learn-launch__form-title"><q-icon name="mdi-school-outline" /> AitoLearn / Plataforma de cursos</div>
            <div class="learn-launch__form-grid">
              <q-input v-model="lead.name" outlined label="Seu nome" autocomplete="name" :rules="[requiredRule]" />
              <q-select v-model="lead.profileType" outlined label="Meu perfil" :options="profileOptions" emit-value map-options :rules="[requiredRule]" />
              <q-input v-model="lead.email" outlined label="E-mail" type="email" autocomplete="email" />
              <q-input v-model="lead.phone" outlined label="WhatsApp" autocomplete="tel" />
              <q-input v-model="lead.question" outlined type="textarea" autogrow class="learn-launch__form-full" label="Qual seu objetivo? (opcional)" />
            </div>
            <p class="learn-launch__form-help">Informe e-mail ou WhatsApp para receber o convite.</p>
            <q-btn unelevated no-caps type="submit" class="learn-launch__submit" icon="mdi-arrow-right" label="Quero conhecer a AitoLearn" :loading="saving" />
          </q-form>
        </div>
      </section>

      <section id="sobre-aitolearn" data-landing-3d-section class="learn-launch__section learn-launch__section--about">
        <div class="learn-launch__about-panel">
          <p class="learn-launch__eyebrow">AITOLEARN</p>
          <h2>Uma plataforma para sair da teoria e chegar ao produto.</h2>
          <p>Aprenda com projetos reais, do primeiro arquivo ao deploy: frontend, backend, dados, pagamentos, IA e boas decisoes de engenharia.</p>
          <div class="learn-launch__about-grid">
            <span><q-icon name="mdi-certificate-outline" /> Certificados verificaveis</span>
            <span><q-icon name="mdi-source-branch-check" /> Projetos reais do zero ao deploy</span>
            <span><q-icon name="mdi-message-text-outline" /> IA aplicada com criterio</span>
          </div>
          <button type="button" class="learn-launch__button learn-launch__button--primary" @click="scrollToSection('inscricao')">Entrar na lista <q-icon name="mdi-arrow-up" /></button>
        </div>
      </section>
    </div>

    <Transition name="learn-loader">
      <div v-if="!sceneReady" class="learn-launch__loader" role="status" aria-live="polite">
        <div class="learn-launch__loader-orb"><span></span></div>
        <strong>Preparando sua sala de aula</strong>
        <small>Carregando a experiencia AitoLearn...</small>
      </div>
    </Transition>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { api } from 'boot/axios'
import AitoThreeScene from 'components/landing3d/AitoThreeScene.vue'
import AuthDialog from 'components/AuthDialog.vue'
import { useLandingScroll } from 'src/composables/useLandingScroll'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const sections = Object.freeze([
  {
    id: 'metodo', label: 'A plataforma', kind: 'hero', eyebrow: 'AITOLEARN / CURSOS DE SOFTWARE',
    title: 'Aprenda a construir software do zero ao deploy.',
    description: 'Uma plataforma de cursos para transformar conhecimento em produto: trilhas praticas, projetos reais, certificados verificaveis e engenharia aplicada para entregar sistemas de verdade.', media: 'video'
  },
  {
    id: 'frontend', label: 'Frontend e experiencia', kind: 'stack', eyebrow: '01 / FRONTEND, UI/UX E 3D',
    title: 'Interface é o primeiro contato com o cliente. Aprenda a encantar e converter.',
    description: '', image: '/aprenda-front.png', icon: 'mdi-monitor-cellphone-star', mediaLabel: 'Experiencia que vende', mediaAlt: 'Experiencia visual AitoSoftwares', mediaCaption: 'Design, movimento e clareza sem sacrificar usabilidade.'
  },
  {
    id: 'backend', label: 'Backend e dados', kind: 'stack', eyebrow: '02 / BACKEND, APIS E IA',
    title: 'Da ideia ao deploy, construa sistemas confiáveis e escaláveis.',
    description: '', image: '/construa-app.png', icon: 'mdi-api', mediaLabel: 'Operacao conectada', mediaAlt: 'Atendimento digital conectado', mediaCaption: 'Backend que sustenta experiencia, receita e crescimento.'
  },
  {
    id: 'engenharia', label: 'Metodo de engenharia', kind: 'method', eyebrow: '03 / CODEx, CLAUDE E INITIALIZERS',
    title: 'Automatize processos sem abrir mao da engenharia.',
    description: 'Use Codex e Claude para acelerar raciocinio, testes e implementacao com arquitetura, limites, revisao e seguranca antes do deploy.', items: ['Initializers seguros', 'Integracao de pagamento', 'Testes e observabilidade', 'Javascript e Python','Bonus de prompt engineering'], stack: ['Vue', 'Three.js', 'Node', 'MongoDB', 'Cloud', 'IA']
  }
])
const navSections = Object.freeze([{ id: 'catalogo', label: 'Cursos' }, ...sections, { id: 'inscricao', label: 'Inscricao' }, { id: 'sobre-aitolearn', label: 'AitoLearn' }])
const { activeSection, prefersReducedMotion, scrollProgress, scrollToSection } = useLandingScroll(navSections.length)
const sceneReady = ref(false)
const saving = ref(false)
const authDialogOpen = ref(false)
const catalogLoading = ref(false)
const catalogCourses = ref([])
const catalogSearch = ref('')
let loaderWatchdog
const videoUrl = import.meta.env.VITE_AITOLEARN_VIDEO_URL || 'https://www.youtube.com/embed/ekZtwCJvH1g?playsinline=1&rel=0'
const profileOptions = [
  { label: 'Iniciante', value: 'iniciante' },
  { label: 'Empresario', value: 'empresario' },
  { label: 'Desenvolvedor', value: 'desenvolvedor' },
  { label: 'Estudante', value: 'estudante' },
  { label: 'Gestor ou lider tecnico', value: 'gestor' },
  { label: 'Freelancer ou agencia', value: 'freelancer' },
  { label: 'Outro perfil', value: 'outro' }
]
const lead = reactive({ name: '', email: '', phone: '', profileType: '', question: '' })
const requiredRule = (value) => Boolean(String(value || '').trim()) || 'Preencha este campo.'
const isUser = computed(() => {
  if (!localStorage.getItem('aito_user_token')) return false
  try { return JSON.parse(localStorage.getItem('aito_user') || '{}').role === 'user' } catch (error) { return false }
})
const isAffiliate = computed(() => {
  if (localStorage.getItem('aito_user_token') || !localStorage.getItem('aito_affiliate_token')) return false
  try { return JSON.parse(localStorage.getItem('aito_affiliate_user') || '{}').role === 'affiliate' } catch (error) { return false }
})
const filteredCatalogCourses = computed(() => {
  const query = catalogSearch.value.trim().toLowerCase()
  if (!query) return catalogCourses.value
  return catalogCourses.value.filter((course) => `${course.title || ''} ${course.description || ''} ${(course.tags || []).join(' ')}`.toLowerCase().includes(query))
})
const freeCourses = computed(() => filteredCatalogCourses.value.filter((course) => currentPrice(course) <= 0).slice(0, 20))
const tagCarousels = computed(() => {
  const groups = new Map()
  filteredCatalogCourses.value.forEach((course) => {
    ;(course.tags || []).forEach((tag) => {
      const label = String(tag || '').trim()
      const key = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')
      if (!key) return
      if (!groups.has(key)) groups.set(key, { key, label, courses: [] })
      const group = groups.get(key)
      if (!group.courses.some((item) => item._id === course._id)) group.courses.push(course)
    })
  })
  return [...groups.values()]
    .sort((a, b) => b.courses.length - a.courses.length || a.label.localeCompare(b.label))
    .slice(0, freeCourses.value.length ? 3 : 4)
    .map((group) => ({ ...group, courses: group.courses.slice(0, 20) }))
})

function handleSceneReady() {
  sceneReady.value = true
  window.clearTimeout(loaderWatchdog)
}
function currentPrice(course) {
  const price = Number(course?.price || 0)
  const promotion = Number(course?.promoPrice || course?.precoPromocao || 0)
  return promotion > 0 && promotion < price ? promotion : price
}
function isPromotion(course) { return currentPrice(course) < Number(course?.price || 0) }
function money(value) { return Number(value || 0) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)) : 'Gratis' }
function openCourse(course) { if (course?.slug) router.push(`/cursos/${course.slug}`) }
function openUserLogin() { if (isUser.value) return router.push('/app'); if (isAffiliate.value) return router.push('/affiliate'); authDialogOpen.value = true }
function handleAuthenticated(data) { if (data?.user?.role === 'user') router.push('/app') }
async function loadCatalog() {
  catalogLoading.value = true
  try {
    const response = await api.get('/courses', { params: { q: catalogSearch.value.trim() } })
    catalogCourses.value = response.data.data || []
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel carregar os cursos.' })
  } finally { catalogLoading.value = false }
}

async function submitLead() {
  if (!lead.email.trim() && !lead.phone.trim()) {
    $q.notify({ type: 'warning', message: 'Informe um e-mail ou WhatsApp para receber o convite.' })
    return
  }

  saving.value = true
  try {
    await api.post('/leads', {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      message: lead.question,
      profileType: lead.profileType,
      source: 'aitolearn-plataforma',
      flowType: 'interesse-em-aprender',
      tags: ['AitoLearn', 'plataforma de cursos', 'projetos reais']
    })
    $q.notify({ type: 'positive', message: 'Perfeito. Sua vaga de interesse foi registrada.' })
    lead.question = ''
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel registrar seu interesse.' })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loaderWatchdog = window.setTimeout(() => { sceneReady.value = true }, 10000)
  loadCatalog()
})

onBeforeUnmount(() => window.clearTimeout(loaderWatchdog))
</script>

<style scoped>
.learn-launch {
  --teal: #13bc9d;
  --aqua: #8fffee;
  position: relative;
  min-height: 600vh;
  overflow: clip;
  color: #effffb;
  background: #03090b;
  isolation: isolate;
}
.learn-launch__veil { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(circle at 50% 40%, rgba(19,188,157,.08), transparent 35rem), linear-gradient(90deg, rgba(3,9,11,.88), rgba(3,9,11,.25) 58%, rgba(3,9,11,.64)); }
.learn-launch__header { position: fixed; z-index: 5; inset: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 1rem clamp(1rem, 4vw, 4rem); border-bottom: 1px solid rgba(19,188,157,.16); background: rgba(3,9,11,.64); backdrop-filter: blur(12px); }
.learn-launch__brand { display: inline-flex; align-items: center; gap: .6rem; color: #effffb; font-size: .78rem; font-weight: 900; letter-spacing: .14em; text-decoration: none; }
.learn-launch__brand img { width: 34px; height: 34px; object-fit: contain; }
.learn-launch__brand span span { color: var(--teal); }
.learn-launch__header-actions { display: flex; align-items: center; gap: 1rem; }
.learn-launch__legal-link { color: rgba(239,255,251,.7); font-size: .72rem; text-decoration: none; }
.learn-launch__login { display: inline-flex; align-items: center; gap: .35rem; padding: .58rem .8rem; border: 1px solid rgba(143,255,238,.42); border-radius: .65rem; color: #03110f; background: linear-gradient(135deg, #8fffee, var(--teal)); cursor: pointer; font: inherit; font-size: .72rem; font-weight: 900; }
.learn-launch__back, .learn-launch__button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border: 1px solid rgba(19,188,157,.4); color: #effffb; background: rgba(3,25,26,.72); border-radius: .65rem; cursor: pointer; font: inherit; font-size: .76rem; font-weight: 800; }
.learn-launch__back { padding: .6rem .8rem; }
.learn-launch__progress { position: fixed; z-index: 6; top: 50%; right: 1.25rem; display: grid; gap: .55rem; transform: translateY(-50%); }
.learn-launch__progress button { width: .5rem; height: .5rem; padding: 0; border: 1px solid rgba(143,255,238,.55); border-radius: 50%; background: transparent; cursor: pointer; transition: transform .25s ease, background .25s ease; }
.learn-launch__progress button.is-active { background: var(--teal); box-shadow: 0 0 12px rgba(19,188,157,.7); transform: scale(1.6); }
.learn-launch__content { position: relative; z-index: 2; }
.learn-launch__section--catalog { align-items: center; padding-top: clamp(6.5rem, 11vh, 8rem); }
.learn-launch__catalog { width: min(1240px, 100%); min-width: 0; max-width: 100%; margin: 0 auto; }
.learn-launch__catalog-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; }
.learn-launch__catalog-head h1 { max-width: 16ch; }
.learn-launch__catalog-head > div > p:not(.learn-launch__eyebrow) { display: none; }
.learn-launch__catalog-head > .q-icon { flex: 0 0 auto; color: var(--teal); filter: drop-shadow(0 0 20px rgba(19,188,157,.4)); }
.learn-launch__catalog-search { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; gap: .7rem; margin-top: 1.5rem; }
.learn-launch__catalog-search > * { min-width: 0; max-width: 100%; box-sizing: border-box; }
.learn-launch__catalog-search :deep(.q-field__control) { min-height: 46px; color: #effffb; background: rgba(7,40,40,.76); }
.learn-launch__catalog-search :deep(.q-field__label), .learn-launch__catalog-search :deep(.q-field__native), .learn-launch__catalog-search :deep(.q-field__input) { color: rgba(239,255,251,.88); }
.learn-launch__catalog-row { margin-top: 1.35rem; }
.learn-launch__catalog-row-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.learn-launch__catalog-row-head h2 { max-width: none; margin: .25rem 0 0; font-size: 1rem; }
.learn-launch__catalog-row-head > span { color: rgba(229,255,250,.55); font-size: .66rem; }
.learn-launch__catalog-row-head h2, .learn-launch__catalog-row-head > span { display: none; }
.learn-launch__course-carousel { display: flex; min-width: 0; gap: .65rem; margin-top: .65rem; padding: .1rem .1rem .8rem; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.learn-launch__course-carousel::-webkit-scrollbar { height: 5px; }
.learn-launch__course-carousel::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(143,255,238,.35); }
.learn-launch__course-tabs { min-width: 0; min-height: 172px; margin-top: .65rem; overflow: hidden; border-bottom: 1px solid rgba(19,188,157,.14); }
.learn-launch__course-tabs :deep(.q-tabs__content) { justify-content: flex-start; gap: .65rem; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }
.learn-launch__course-tabs :deep(.q-tab) { flex: 0 0 auto; min-width: 240px; min-height: 165px; padding: 0; align-items: stretch; text-transform: none; }
.learn-launch__course-card { display: grid; width: 240px; height: 160px; grid-template-rows: 88px 1fr; overflow: hidden; border: 1px solid rgba(143,255,238,.26); border-radius: .7rem; text-align: left; background: rgba(3,25,26,.76); box-shadow: 0 14px 34px rgba(0,0,0,.2); transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease; }
.learn-launch__course-carousel .learn-launch__course-card { flex: 0 0 240px; padding: 0; color: inherit; font: inherit; cursor: pointer; appearance: none; }
.learn-launch__course-card:hover { border-color: rgba(143,255,238,.72); box-shadow: 0 18px 44px rgba(19,188,157,.16); transform: translateY(-3px); }
.learn-launch__course-image { position: relative; overflow: hidden; background: linear-gradient(135deg, rgba(19,188,157,.22), rgba(3,16,18,.9)); }
.learn-launch__course-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
.learn-launch__course-image > div { display: grid; height: 100%; place-items: center; color: var(--aqua); }
.learn-launch__course-image > span { position: absolute; top: .4rem; right: .4rem; padding: .2rem .4rem; border: 1px solid rgba(143,255,238,.55); border-radius: 999px; color: #03110f; background: #8fffee; font-size: .58rem; font-weight: 900; }
.learn-launch__course-card > div:last-child { display: grid; align-content: center; gap: .25rem; padding: .55rem .65rem; }
.learn-launch__course-card strong { display: -webkit-box; overflow: hidden; color: #effffb; font-size: .75rem; line-height: 1.2; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.learn-launch__course-card small { color: rgba(229,255,250,.56); font-size: .62rem; }
.learn-launch__course-card b { color: #8fffee; font-size: .75rem; }
.learn-launch__course-card s { margin-right: .25rem; color: rgba(229,255,250,.46); font-size: .6rem; }
.learn-launch__catalog-empty, .learn-launch__catalog-loading { display: flex; min-height: 160px; align-items: center; justify-content: center; gap: .6rem; color: rgba(229,255,250,.58); font-size: .75rem; }
.learn-launch__pagination { margin-top: .55rem; }
.learn-launch__section { display: grid; min-width: 0; min-height: 100vh; padding: clamp(7.5rem, 14vh, 10rem) clamp(1rem, 6vw, 7rem) 4rem; align-items: start; }
.learn-launch__section-inner { display: grid; width: min(1200px, 100%); margin: 0 auto; grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr); align-items: center; gap: clamp(2rem, 7vw, 7rem); }
.learn-launch__copy { max-width: 38rem; }
.learn-launch__eyebrow { margin: 0 0 1rem; color: var(--aqua); font-size: .7rem; font-weight: 900; letter-spacing: .16em; }
.learn-launch h1, .learn-launch h2 { max-width: 13ch; margin: 0; font-size: clamp(2.35rem, 5.1vw, 5.6rem); line-height: .94; letter-spacing: 0; background: linear-gradient(135deg, #f4fffd 12%, var(--aqua) 48%, var(--teal) 88%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.learn-launch h2 { font-size: clamp(2rem, 4.3vw, 4.6rem); }
.learn-launch__description { max-width: 35rem; margin: 1.35rem 0 0; color: rgba(229,255,250,.78); font-size: clamp(.9rem, 1.25vw, 1.08rem); line-height: 1.65; }
.learn-launch__actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.8rem; }
.learn-launch__button { padding: .85rem 1rem; }
.learn-launch__button--primary { border-color: transparent; color: #03110f; background: linear-gradient(135deg, #8fffee, var(--teal)); box-shadow: 0 12px 28px rgba(19,188,157,.22); }
.learn-launch__button--ghost { background: rgba(3,25,26,.42); }
.learn-launch__proof, .learn-launch__pillars { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1.6rem; }
.learn-launch__proof span, .learn-launch__pillars span, .learn-launch__about-grid span { display: inline-flex; align-items: center; gap: .35rem; color: rgba(229,255,250,.68); font-size: .7rem; }
.learn-launch__proof .q-icon, .learn-launch__pillars .q-icon, .learn-launch__about-grid .q-icon { color: var(--teal); }
.learn-launch__media-column { display: grid; gap: .75rem; min-width: 0; }
.learn-launch__media-card { width: min(100%, 680px); justify-self: center; padding: .7rem; border: 1px solid rgba(143,255,238,.32); border-radius: 1rem; background: rgba(3,25,26,.28); box-shadow: 0 26px 80px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.12); backdrop-filter: blur(5px); transform: perspective(900px) rotateY(-5deg) rotateX(2deg); }
.learn-launch__media-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: .65rem; }
.learn-launch__media-tag { display: flex; align-items: center; gap: .4rem; padding: .35rem .2rem .6rem; color: var(--aqua); font-size: .72rem; font-weight: 800; }
.learn-launch__video-wrap { position: relative; overflow: hidden; aspect-ratio: 16 / 9; border-radius: .65rem; background: #061617; }
.learn-launch__video-wrap iframe { width: 100%; height: 100%; border: 0; }
.learn-launch__media-caption { display: block; padding: .65rem .25rem .2rem; color: rgba(229,255,250,.62); font-size: .68rem; }
.learn-launch__stack-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: .5rem; }
.learn-launch__stack-strip span { padding: .5rem .7rem; border: 1px solid rgba(19,188,157,.28); border-radius: 999px; color: rgba(229,255,250,.76); background: rgba(3,25,26,.42); font-size: .68rem; }
.learn-launch__section--method .learn-launch__section-inner, .learn-launch__section--form .learn-launch__section-inner { grid-template-columns: 1fr 1fr; }
.learn-launch__section--form { min-height: 100vh; }
.learn-launch__lead-form { width: min(100%, 570px); justify-self: end; padding: clamp(1rem, 3vw, 2rem); border: 1px solid rgba(143,255,238,.3); border-radius: 1rem; background: rgba(3,25,26,.76); box-shadow: 0 22px 70px rgba(0,0,0,.35); }
.learn-launch__form-title { display: flex; align-items: center; gap: .55rem; margin-bottom: 1rem; color: var(--aqua); font-size: .85rem; font-weight: 900; }
.learn-launch__form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
.learn-launch__form-full { grid-column: 1 / -1; }
.learn-launch__lead-form :deep(.q-field__control) { min-height: 46px; color: #effffb; background: rgba(7,40,40,.74); }
.learn-launch__lead-form :deep(.q-field__label), .learn-launch__lead-form :deep(.q-field__native), .learn-launch__lead-form :deep(.q-field__input) { color: rgba(239,255,251,.86); }
.learn-launch__lead-form :deep(.q-field__label) { color: rgba(143,255,238,.72); }
.learn-launch__form-help, .learn-launch__mini-note { color: rgba(229,255,250,.58); font-size: .7rem; line-height: 1.5; }
.learn-launch__submit { width: 100%; margin-top: .6rem; color: #03110f; background: linear-gradient(135deg, #8fffee, var(--teal)); font-weight: 900; }
.learn-launch__about { min-height: 100vh; }
.learn-launch__about-panel { width: min(920px, 100%); margin: 0 auto; padding: clamp(1.5rem, 5vw, 4rem); border: 1px solid rgba(143,255,238,.28); border-radius: 1rem; background: rgba(3,25,26,.54); backdrop-filter: blur(5px); text-align: center; }
.learn-launch__about-panel h2 { max-width: 15ch; margin-inline: auto; }
.learn-launch__about-panel > p:not(.learn-launch__eyebrow) { max-width: 42rem; margin: 1.2rem auto 0; color: rgba(229,255,250,.75); line-height: 1.65; }
.learn-launch__about-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin: 1.8rem 0; }
.learn-launch__loader { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; align-content: center; gap: .65rem; color: #effffb; background: rgba(3,9,11,.94); backdrop-filter: blur(14px); }
.learn-launch__loader strong { font-size: .95rem; }
.learn-launch__loader small { color: rgba(229,255,250,.6); }
.learn-launch__loader-orb { display: grid; width: 4rem; height: 4rem; place-items: center; border: 1px solid rgba(143,255,238,.6); border-radius: 50%; box-shadow: 0 0 34px rgba(19,188,157,.45); animation: learn-pulse 1.8s ease-in-out infinite; }
.learn-launch__loader-orb span { width: 1.35rem; height: 1.35rem; border-radius: 50%; background: linear-gradient(135deg, #8fffee, var(--teal)); }
.learn-loader-enter-active, .learn-loader-leave-active { transition: opacity .55s ease, filter .55s ease; }
.learn-loader-enter-from, .learn-loader-leave-to { opacity: 0; filter: blur(12px); }
@keyframes learn-pulse { 50% { transform: scale(1.08); opacity: .72; } }
@media (max-width: 760px) {
  .learn-launch__header { padding: .75rem 1rem; }
  .learn-launch__legal-link { display: none; }
  .learn-launch__login { padding: .55rem; font-size: 0; }
  .learn-launch__login .q-icon { font-size: 1.15rem; }
  .learn-launch__back { padding: .55rem; font-size: 0; }
  .learn-launch__back .q-icon { font-size: 1.2rem; }
  .learn-launch__progress { right: .7rem; }
  .learn-launch__section { min-height: 100svh; padding: 6.5rem 1rem 3rem; }
  .learn-launch__section-inner, .learn-launch__section--method .learn-launch__section-inner, .learn-launch__section--form .learn-launch__section-inner { grid-template-columns: 1fr; gap: 1.5rem; }
  .learn-launch h1, .learn-launch h2 { max-width: 15ch; font-size: clamp(2rem, 10.5vw, 3.4rem); }
  .learn-launch__description { font-size: .88rem; }
  .learn-launch__media-card { transform: none; }
  .learn-launch__media-column { order: 2; }
  .learn-launch__lead-form { justify-self: stretch; }
  .learn-launch__form-grid { grid-template-columns: 1fr; }
  .learn-launch__form-full { grid-column: auto; }
  .learn-launch__catalog-head > .q-icon { display: none; }
  .learn-launch__catalog-search { width: 100%; grid-template-columns: minmax(0, 1fr); }
  .learn-launch__catalog-search .q-btn { width: 100%; min-width: 0 !important; max-width: 100%; box-sizing: border-box; }
  .learn-launch__catalog-row-head { align-items: flex-start; flex-direction: column; gap: .25rem; }
   .learn-launch__course-carousel { width: 100%; max-width: 100%; gap: .7rem; padding-bottom: .7rem; touch-action: pan-x pan-y; scrollbar-width: none; }
   .learn-launch__course-carousel::-webkit-scrollbar { display: none; }
   .learn-launch__course-carousel .learn-launch__course-card { flex-basis: min(78vw, 300px); width: min(78vw, 300px); }
  .learn-launch__veil { background: linear-gradient(180deg, rgba(3,9,11,.58), rgba(3,9,11,.78)); }
}
@media (prefers-reduced-motion: reduce) { .learn-launch__loader-orb { animation: none; } }
</style>
