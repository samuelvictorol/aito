<template>
  <div class="aito-about-links">
    <router-link to="/links" class="aito-about-link">
      <img src="/aito-logo-restored.png" alt="" width="22" height="22" />
      <span>Sobre a Aito</span>
      <q-icon name="mdi-arrow-top-right" size="15px" />
    </router-link>
    <router-link to="/ajuda" class="aito-about-link">
      <q-icon name="mdi-help-circle-outline" size="22px" />
      <span>Ajuda</span>
      <q-icon name="mdi-arrow-top-right" size="15px" />
    </router-link>
  </div>
</template>

<style scoped>
.aito-about-links { display: grid; gap: 4px; width: 100%; min-width: 0; }
.aito-about-link {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px;
  padding: 4px 8px; border-radius: 8px; color: var(--aito-ai-text); text-decoration: none;
}
.aito-about-link img { object-fit: contain; }
.aito-about-link span { flex: 1; }
.aito-about-link .q-icon { color: var(--aito-ai-muted); }
.aito-about-link:hover, .aito-about-link:focus-visible { background: var(--aito-ai-raised); }
</style>
