<script setup>
import { useMeta } from 'quasar'
import 'src/css/aitoia-theme.css'

useMeta({
  title: 'AitoSoftwares | Links',
  meta: { description: { name: 'description', content: 'Encontre a Aito IA, os estúdios de criação, as soluções para WhatsApp e o Lembr.it.' } },
  link: { canonical: { rel: 'canonical', href: 'https://aitosoftwares.com/links' } },
})
</script>

<template>
  <main class="aito-ai-theme bio-links">
    <header class="bio-links__brand">
      <img src="/aito-logo-restored.png" alt="" width="66" height="66">
      <h1>AitoSoftwares</h1>
    </header>
    <nav class="bio-links__nav" aria-label="Links da AitoSoftwares">
      <router-link class="bio-links__item bio-links__item--offer" :to="{ name: 'aito-ia-video-studio', query: { auth: 'register' } }">
        <img src="/aitotokens.svg" alt="" width="38" height="38">
        <span><strong>50.000 AitoTokens Grátis</strong><small>No primeiro cadastro</small></span>
        <q-icon name="mdi-arrow-right" size="21px" />
      </router-link>
      <router-link class="bio-links__item" :to="{ name: 'aito-ia' }">
        <img src="/ia.gif" alt="" width="38" height="38">
        <span><strong>Aito IA</strong><small>Modelos GPT 6+ e Higgsfield Seedance + Genjutsu</small></span>
        <q-icon name="mdi-arrow-right" size="21px" />
      </router-link>
      <router-link class="bio-links__item" :to="{ name: 'whatsapp-solutions-product' }">
        <q-icon name="mdi-whatsapp" size="28px" />
        <strong>Soluções para WhatsApp</strong>
        <q-icon name="mdi-arrow-right" size="21px" />
      </router-link>
      <a class="bio-links__item" href="https://lembr.it/" target="_blank" rel="noopener noreferrer">
        <q-icon name="mdi-calendar-check-outline" size="28px" />
        <span><strong>Lembr.it</strong><small>Seu link na bio agendando e lembrando por você</small></span>
        <q-icon name="mdi-open-in-new" size="19px" />
      </a>
      <router-link class="bio-links__item" :to="{ name: 'landing-3d' }">
        <img src="/aito-logo-restored.png" alt="" width="34" height="34">
        <strong>Quem Somos</strong>
        <q-icon name="mdi-arrow-right" size="21px" />
      </router-link>
    </nav>
  </main>
</template>

<style scoped>
.bio-links { min-height: 100dvh; padding: clamp(32px, 9vh, 90px) 16px max(38px, env(safe-area-inset-bottom)); color: var(--aito-ai-text); background: radial-gradient(ellipse at 50% 0%, #17463d 0%, transparent 55%), #050f13; font-family: var(--aito-ai-font); }
.bio-links__brand { display: grid; place-items: center; gap: 6px; margin-bottom: 24px; text-align: center; }
.bio-links__brand img, .bio-links__item img { object-fit: contain; }
.bio-links__brand h1 { margin: 0; font-size: clamp(1.65rem, 7vw, 2.25rem); font-weight: 760; line-height: 1.15; }
.bio-links__nav { display: grid; gap: 10px; max-width: 475px; margin: 0 auto; }
.bio-links__item { display: grid; grid-template-columns: 38px minmax(0, 1fr) 22px; align-items: center; gap: 12px; min-height: 63px; padding: 10px 14px; border: 1px solid #315954; border-radius: 14px; color: #effffb; background: #0d2426; text-decoration: none; transition: background 160ms, border-color 160ms; }
.bio-links__item > .q-icon { justify-self: center; color: #8ff5df; }
.bio-links__item strong { display: block; font-size: .99rem; font-weight: 740; }
.bio-links__item small { display: block; margin-top: 2px; color: #bed4d1; font-size: .81rem; line-height: 1.3; }
.bio-links__item:hover { border-color: #73d5c1; background: #133435; }
.bio-links__item:focus-visible { outline: 3px solid #b7ffe9; outline-offset: 3px; }
.bio-links__item--offer { border-color: #ffdc7e; background: linear-gradient(110deg, #ffe6a0, #f2c366); color: #2a1b05; animation: bio-offer-glow 2s ease-in-out 2; }
.bio-links__item--offer small, .bio-links__item--offer > .q-icon { color: #50351c; }
.bio-links__item--offer:hover { background: #ffe29a; }
@keyframes bio-offer-glow { 50% { box-shadow: 0 0 23px #ecc36a82; } }
@media (prefers-reduced-motion: reduce) { .bio-links__item { animation: none; transition: none; } }
</style>
