<script setup>
import { useMeta } from 'quasar'

useMeta({
  title: 'AitoCodex Theme',
  meta: { description: { name: 'description', content: 'Baixe o tema AitoCodex com a paleta AitoSoftwares e o mascote AitoIA.' } },
  link: { canonical: { rel: 'canonical', href: 'https://aitosoftwares.com/aitocodex-theme' } },
})
</script>

<template>
  <main class="codex-theme">
    <div class="codex-theme__landscape" aria-hidden="true"></div>
    <div class="codex-theme__bubbles" aria-hidden="true"><span></span><span></span><span></span></div>

    <section class="codex-theme__panel" aria-labelledby="codex-theme-title">
      <div class="codex-theme__mascot" aria-hidden="true">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcset="/downloads/aitocodex-theme/AitoIA.png" />
          <img src="/downloads/aitocodex-theme/AitoIA.gif" alt="" width="192" height="192" />
        </picture>
      </div>
      <h1 id="codex-theme-title">AitoCodex Theme</h1>
      <p>Aplique as cores da AitoSoftwares e instale o mascote animado AitoIA no app do Codex.</p>
      <a class="codex-theme__download" href="/downloads/AitoCodex-Theme.zip" download="AitoCodex-Theme.zip">
        <q-icon name="mdi-download" size="21px" aria-hidden="true" /> Baixar tema
      </a>
      <section class="codex-theme__guide" aria-labelledby="codex-theme-guide">
        <h2 id="codex-theme-guide">Como instalar no Windows</h2>
        <ol>
          <li>Baixe e extraia o ZIP. Abra o app do Codex e pressione <kbd>Ctrl</kbd> + <kbd>,</kbd> para abrir as configurações.</li>
          <li>
            Em <strong>Aparência</strong>, selecione o modo escuro e aplique as cores:
            <ul class="codex-theme__palette">
              <li><span style="--swatch: #0070FA"></span> Destaque <code>#0070FA</code></li>
              <li><span style="--swatch: #062C29"></span> Fundo <code>#062C29</code></li>
              <li><span style="--swatch: #FFFFFF"></span> Primeiro plano <code>#FFFFFF</code></li>
            </ul>
          </li>
          <li>Copie <code>pet.json</code> e <code>spritesheet.webp</code> da pasta <code>pet</code> do ZIP para <code>%USERPROFILE%\.codex\pets\aitoia</code>. Crie a pasta se ela ainda não existir. Se você configurou um <code>CODEX_HOME</code> personalizado, use a pasta <code>pets\aitoia</code> desse local.</li>
          <li>Em <strong>Configurações → Pets</strong>, atualize a lista e selecione <strong>AitoIA</strong>. Use <code>/pet</code> para mostrar o mascote.</li>
        </ol>
        <a href="https://learn.chatgpt.com/docs/reference/settings" target="_blank" rel="noopener noreferrer">Guia oficial de configurações</a>
      </section>
    </section>
  </main>
</template>

<style scoped>
.codex-theme {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  place-items: center;
  overflow: hidden;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  background:
    radial-gradient(ellipse 48% 55% at 82% 8%, #f5ffff 0%, #cbfbff80 42%, transparent 80%),
    radial-gradient(ellipse 65% 32% at 18% 60%, #ecfff0 0%, #bcfaff55 47%, transparent 80%),
    linear-gradient(154deg, #40aaf1 1%, #8cdef6 35%, #e8fdfa 62%, #aaed71 100%);
  color: #0b453d;
  text-align: center;
}

.codex-theme__landscape,
.codex-theme__bubbles {
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
}

.codex-theme__landscape::before,
.codex-theme__landscape::after {
  position: absolute;
  content: '';
  width: 130%;
  height: 47%;
  border-radius: 50% 50% 0 0;
}

.codex-theme__landscape::before {
  right: 19%;
  bottom: -21%;
  transform: rotate(9deg);
  background: linear-gradient(150deg, #e1fb89 8%, #8fd65c 32%, #41a45f 74%);
  box-shadow: 0 -2px 1.6rem #f3ffd2a8;
}

.codex-theme__landscape::after {
  bottom: -23%;
  left: 23%;
  transform: rotate(-9deg);
  background: linear-gradient(155deg, #c5f88c 6%, #84db6e 36%, #2d9b63 72%);
  box-shadow: inset 0 2px 0 #f4ffc9b5, 0 -.3rem 2.5rem #d0f9a380;
}

.codex-theme__bubbles span {
  position: absolute;
  width: clamp(34px, 6vw, 88px);
  aspect-ratio: 1;
  border: 1px solid #f2fffeae;
  border-radius: 50%;
  background: radial-gradient(ellipse 42% 30% at 33% 25%, #fff, #e1fff4ae 37%, transparent 80%),
    radial-gradient(circle at 45% 43%, #b9f6ff22 49%, #58c2d459 73%, #e4ffdb 95%);
  box-shadow: inset 0 0 .5rem #f7ffffb0, 0 0 1.5rem #f6ffff5b;
}

.codex-theme__bubbles span:nth-child(1) { top: 18%; left: 15%; transform: scale(.72); }
.codex-theme__bubbles span:nth-child(2) { top: 28%; right: 10%; }
.codex-theme__bubbles span:nth-child(3) { bottom: 20%; left: 12%; transform: scale(1.28); }

.codex-theme__panel {
  display: grid;
  width: min(100%, 680px);
  justify-items: center;
  gap: .85rem;
  padding: clamp(1.7rem, 5vw, 3.4rem) clamp(1rem, 5vw, 3.3rem);
  border: 1px solid #ffffffed;
  border-radius: clamp(1.6rem, 4vw, 2.6rem);
  background: linear-gradient(168deg, #fafff5ed, #edfff4d9 55%, #d7f7ffcf);
  box-shadow: inset 0 2px 1px #fff, inset 0 -1px 0 #bbf4e0, 0 1.7rem 4rem #11776035;
  backdrop-filter: blur(14px);
}

.codex-theme__mascot {
  display: grid;
  width: clamp(124px, 24vw, 192px);
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  margin-bottom: .5rem;
  border: 1px solid #fafff8;
  border-radius: 50%;
  background: radial-gradient(ellipse at 31% 16%, #fff 0%, #e0fff1 29%, #abebf7 73%, #74cabb 100%);
  box-shadow: inset 0 0 .9rem #efffffde, 0 .8rem 1.7rem #257f7440;
}

.codex-theme__mascot picture { display: block; width: 86%; aspect-ratio: 1; }
.codex-theme__mascot img { display: block; width: 100%; height: 100%; object-fit: contain; }
.codex-theme h1 { margin: 0; font-size: clamp(1.8rem, 5.8vw, 3.8rem); font-weight: 780; letter-spacing: -.07em; line-height: 1.07; }
.codex-theme p { margin: 0; color: #285957; font-size: clamp(.92rem, 2.7vw, 1.15rem); font-weight: 560; line-height: 1.5; }

.codex-theme__download {
  display: inline-flex;
  min-height: 3.1rem;
  align-items: center;
  justify-content: center;
  gap: .55rem;
  padding-inline: 1.35rem;
  margin-top: .6rem;
  border: 1px solid #32765f;
  border-radius: 999px;
  background: linear-gradient(#fffed5, #caf28f 48%, #8ddb99 50%, #b0e9c1);
  box-shadow: inset 0 1px 0 #fff, 0 .5rem 1.25rem #2e82643d;
  color: #153f2a;
  font-weight: 780;
  text-decoration: none;
}

.codex-theme__download:hover { background: linear-gradient(#fffedf, #dcf9a8 48%, #9de8a5 50%, #bceec9); }
.codex-theme__download:focus-visible { outline: 2px solid #005e8e; outline-offset: 4px; }
.codex-theme__guide {
  width: 100%;
  margin-top: .7rem;
  padding: clamp(.85rem, 4vw, 1.35rem);
  border: 1px solid #a9d5cb;
  border-radius: 1.15rem;
  background: #f8fffcdd;
  text-align: start;
}
.codex-theme__guide h2 { margin: 0 0 .7rem; font-size: 1.12rem; line-height: 1.3; }
.codex-theme__guide ol { display: grid; gap: .6rem; margin: 0 0 .8rem; padding-inline-start: 1.2rem; line-height: 1.5; }
.codex-theme__guide code { overflow-wrap: anywhere; color: #064b44; }
.codex-theme__guide a { color: #035f66; font-weight: 700; }
.codex-theme__palette { display: flex; flex-wrap: wrap; gap: .35rem .7rem; margin: .35rem 0 0; padding: 0; list-style: none; }
.codex-theme__palette li { display: inline-flex; align-items: center; gap: .25rem; }
.codex-theme__palette span { width: .8rem; height: .8rem; border: 1px solid #4a776d; border-radius: .22rem; background: var(--swatch); }
</style>
