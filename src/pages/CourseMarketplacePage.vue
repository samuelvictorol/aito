<template>
  <q-layout view="lHh Lpr lFf" class="course-store">
    <q-page-container>
      <q-page class="course-store__page">
        <div class="course-store__shell">
          <header class="course-store__header">
            <router-link to="/" class="course-store__brand"><img src="/aito-logo-restored.png" alt=""><span>AITO<span>LEARN</span></span></router-link>
            <div class="course-store__actions"><router-link to="/app" class="course-store__link">{{ isUser ? 'Minha area' : 'Entrar' }}</router-link></div>
          </header>

          <section class="course-store__hero"><div><p class="course-store__eyebrow">AITOLEARN / CURSOS</p><h1>Cursos que levam para o proximo nivel</h1></div><q-icon name="mdi-school-outline" size="84px" /></section>

          <div class="course-store__search">
            <q-input v-model="search" outlined clearable label="Buscar cursos" @keyup.enter="load"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
            <q-btn unelevated class="course-store__button" icon="mdi-magnify" label="Buscar" :loading="loading" @click="load" />
          </div>

          <div v-if="loading && !courses.length" class="course-store__grid course-store__grid--skeleton" aria-label="Carregando cursos">
            <article v-for="index in 3" :key="index" class="course-card course-card--skeleton"><div class="course-card__skeleton-media"></div><div class="course-card__body"><div class="course-card__skeleton-line is-short"></div><div class="course-card__skeleton-line"></div><div class="course-card__skeleton-line is-muted"></div><div class="course-card__skeleton-button"></div></div></article>
          </div>
          <div v-else class="course-store__grid">
            <article v-for="(course, index) in courses" :key="course._id" class="course-card">
              <div class="course-card__media"><img v-if="course.banner" :src="course.banner.url" :alt="course.title" :loading="index < 3 ? 'eager' : 'lazy'" decoding="async" :fetchpriority="index < 2 ? 'high' : 'auto'" @error="handleImageError(course)"><div v-else class="course-card__placeholder"><q-icon name="mdi-school-outline" size="40px" /></div><span>{{ course.hours || 0 }}h</span></div>
              <div class="course-card__body"><p class="course-store__eyebrow">AITOLEARN</p><h2>{{ course.title }}</h2><p>{{ preview(course.description) }}</p><div class="course-card__meta"><strong>{{ money(course.price) }}</strong><span>{{ course.topicCount || 0 }} aulas</span></div><q-btn unelevated no-caps class="course-store__button full-width" icon="mdi-arrow-right" label="Ver curso" @click="router.push(`/cursos/${course.slug}`)" /></div>
            </article>
            <div v-if="!courses.length && !loading" class="course-store__empty"><q-icon name="mdi-book-search-outline" size="42px" /><strong>Nenhum curso encontrado</strong><span>Em breve novos cursos estarao disponiveis.</span></div>
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const courses = ref([])
const search = ref('')
const loading = ref(true)
const isUser = computed(() => Boolean(localStorage.getItem('aito_user_token')))

function money(value) { return Number(value || 0) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)) : 'Gratuito' }
function preview(value) { const text = String(value || '').trim(); return text.length > 120 ? `${text.slice(0, 120)}...` : text || 'Curso AitoLearn.' }
function preloadCourseImages(list) { list.slice(0, 3).forEach((course) => { const url = course.banner?.url || course.logo?.url; if (!url) return; const image = new Image(); image.decoding = 'async'; image.src = url }) }
function handleImageError(course) { if (course.logo?.url && course.banner?.url !== course.logo.url) course.banner = course.logo; else course.banner = null }

async function load() {
  loading.value = true
  try {
    const response = await api.get('/courses', { params: { q: search.value } })
    const nextCourses = response.data.data || []
    courses.value = nextCourses
    preloadCourseImages(nextCourses)
    if (search.value.trim()) api.post('/courses/interest', { kind: 'search', query: search.value }).catch(() => null)
  } catch (error) {
    if (!courses.value.length) courses.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.course-store{color:#effffb;background:#03090b}.course-store__page{min-height:100vh;background:radial-gradient(circle at 80% 0,rgba(19,188,157,.18),transparent 30rem),#03090b}.course-store__shell{width:min(1180px,calc(100% - 2rem));margin:auto;padding-bottom:4rem}.course-store__header{display:flex;align-items:center;justify-content:space-between;padding:1rem 0;border-bottom:1px solid rgba(19,188,157,.2)}.course-store__brand{display:inline-flex;align-items:center;gap:.6rem;color:#effffb;font-size:.8rem;font-weight:900;letter-spacing:.12em;text-decoration:none}.course-store__brand img{width:34px;height:34px}.course-store__brand span span{color:#13bc9d}.course-store__link{color:#8fffee;font-size:.75rem;text-decoration:none}.course-store__hero{display:flex;align-items:center;justify-content:space-between;gap:2rem;padding:10vh 0 5vh}.course-store__hero h1{max-width:12ch;margin:.6rem 0;font-size:clamp(2.6rem,6vw,5.8rem);line-height:.95;background:linear-gradient(135deg,#effffb,#13bc9d,#8fffee);background-clip:text;-webkit-background-clip:text;color:transparent}.course-store__hero>.q-icon{color:#50dcc4;filter:drop-shadow(0 0 26px rgba(19,188,157,.35))}.course-store__eyebrow{margin:0;color:#8fffee;font-size:.66rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.course-store__search{display:grid;grid-template-columns:1fr auto;gap:.7rem;margin-bottom:2rem}.course-store__search :deep(.q-field__control){color:#effffb;background:rgba(7,40,40,.72)}.course-store__search :deep(.q-field__native),.course-store__search :deep(.q-field__label){color:rgba(239,255,251,.8)}.course-store__button{color:#03110f;background:linear-gradient(135deg,#8fffee,#13bc9d);font-weight:900}.course-store__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9rem}.course-card{overflow:hidden;border:1px solid rgba(19,188,157,.25);border-radius:.8rem;background:rgba(4,24,25,.76)}.course-card__media{position:relative;aspect-ratio:16/9;overflow:hidden;background:linear-gradient(135deg,rgba(19,188,157,.32),rgba(3,16,18,.9))}.course-card__media img{width:100%;height:100%;object-fit:cover}.course-card__media>span{position:absolute;right:.7rem;bottom:.7rem;padding:.3rem .5rem;border:1px solid rgba(143,255,238,.35);border-radius:999px;color:#8fffee;background:rgba(3,16,18,.75);font-size:.65rem}.course-card__placeholder{display:grid;place-items:center;height:100%;color:#8fffee}.course-card__body{display:grid;gap:.6rem;padding:1rem}.course-card h2{margin:0;font-size:1.05rem}.course-card p:not(.course-store__eyebrow){min-height:3.1rem;margin:0;color:rgba(239,255,251,.65);font-size:.75rem;line-height:1.5}.course-card__meta{display:flex;align-items:center;justify-content:space-between;color:rgba(229,255,250,.6);font-size:.72rem}.course-card__meta strong{color:#8fffee;font-size:1rem}.course-store__empty{display:grid;grid-column:1/-1;justify-items:center;gap:.6rem;padding:4rem 1rem;color:rgba(239,255,251,.64);text-align:center}.course-store__empty .q-icon{color:#8fffee}.course-store__empty strong{color:#effffb}.course-card__skeleton-media,.course-card__skeleton-line,.course-card__skeleton-button{position:relative;overflow:hidden;background:rgba(24,72,70,.48)}.course-card__skeleton-media{aspect-ratio:16/9}.course-card__skeleton-line{width:92%;height:.85rem;border-radius:.3rem}.course-card__skeleton-line.is-short{width:38%;height:.55rem}.course-card__skeleton-line.is-muted{width:72%;opacity:.65}.course-card__skeleton-button{width:100%;height:2.2rem;border-radius:.4rem}.course-card__skeleton-media:after,.course-card__skeleton-line:after,.course-card__skeleton-button:after{position:absolute;inset:0;content:'';transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(143,255,238,.16),transparent);animation:course-skeleton 1.4s infinite}@keyframes course-skeleton{to{transform:translateX(100%)}}@media(max-width:800px){.course-store__hero{padding:7vh 0 4vh}.course-store__hero>.q-icon{display:none}.course-store__search{grid-template-columns:1fr}.course-store__grid{grid-template-columns:1fr}.course-card__body{padding:1.1rem}}
</style>
