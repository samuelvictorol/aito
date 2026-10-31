<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isPrototypePath } from './services/prototype-mode.js'
import { configureInstallManifest } from './services/install-app.js'
import ScreenLoading from './components/ScreenLoading.vue'
import { useRouteLoading } from './services/route-loading.js'
import WhiteLabelFooter from './components/WhiteLabelFooter.vue'
import { useWhiteLabel } from './services/whitelabel.js'
import { disableBrowserPush } from './services/browser-push.js'
import { stopAppSounds } from './services/sounds.js'

const route = useRoute()
const screenLoading = useRouteLoading()
const whiteLabel = useWhiteLabel()
const layoutOwnsFooter = computed(() => route.matched.some((record) => record.path === '/') || route.name === 'my-profile' || isPrototypePath(route.path))
onMounted(() => { if (!isPrototypePath(window.location.pathname)) whiteLabel.load() })
watch(() => route.fullPath, () => {
  const path=route.matched.length?route.path:window.location.pathname
  configureInstallManifest(path)
  if (isPrototypePath(path)) return
  if (!whiteLabel.loaded.value && !whiteLabel.loading.value) void whiteLabel.load()
  if (route.matched.length && !route.meta.requiresAuth) {
    stopAppSounds()
    void disableBrowserPush().catch(() => {})
  }
}, { immediate: true })
</script>

<template>
  <div :class="['app-root', { 'app-root--public': !layoutOwnsFooter }]">
    <div class="app-route" :aria-busy="screenLoading.active.value" :inert="screenLoading.active.value || undefined"><router-view /></div>
    <WhiteLabelFooter v-if="!layoutOwnsFooter" />
    <Transition name="spa-loading-fade"><ScreenLoading v-if="screenLoading.visible.value" :label="screenLoading.label.value" /></Transition>
  </div>
</template>

<style>
.app-root {
  min-height: 100dvh;
}

.app-root--public {
  display: grid;
  height: 100dvh;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.app-root--public > .app-route {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.app-root--public > .app-route > * {
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.app-root--public .login-page {
  min-height: 0 !important;
}

.app-root--public .login-story,
.app-root--public .login-panel,
.app-root--public .public-page,
.app-root--public .not-found {
  min-height: 100% !important;
}
@media(max-width:980px){.app-root--public .login-story,.app-root--public .login-panel{min-height:0!important}}
</style>
