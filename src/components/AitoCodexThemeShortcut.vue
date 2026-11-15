<template>
  <router-link :to="{ name: 'aito-codex-theme' }" class="codex-theme-shortcut">
    <q-icon name="mdi-format-paint" size="20px" aria-hidden="true" />
    AitoCodex Thema
  </router-link>
</template>

<style scoped>
.codex-theme-shortcut {
  position: fixed;
  z-index: 20;
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  bottom: calc(max(1rem, env(safe-area-inset-bottom)) + var(--aito-theme-shortcut-offset, 0rem));
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  min-height: 2.75rem;
  padding: .5rem .9rem;
  border: 1px solid #ceffda;
  border-radius: 999px;
  background: linear-gradient(160deg, #efffb5 0%, #b8f1c2 45%, #93e2fa 100%);
  box-shadow: inset 0 1px 0 #fff, 0 .35rem 1rem #0006;
  color: #0a4035;
  font-size: .83rem;
  font-weight: 760;
  text-decoration: none;
}

.codex-theme-shortcut:hover { background: linear-gradient(155deg, #fffed4, #baf7e2 56%, #9defff); }
.codex-theme-shortcut:focus-visible { outline: 2px solid #82fff0; outline-offset: 3px; }
</style>
