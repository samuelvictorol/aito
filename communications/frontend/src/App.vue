<script setup>
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isPrototypePath } from './services/prototype-mode.js'
import { configureInstallManifest } from './services/install-app.js'
import ScreenLoading from './components/ScreenLoading.vue'
import { useRouteLoading } from './services/route-loading.js'
import ProductLicenseGate from './components/ProductLicenseGate.vue'
import { startLicenseMonitor, stopLicenseMonitor, useProductLicense } from './services/product-license.js'
import { connectSocket } from './services/socket.js'
import WhiteLabelFooter from './components/WhiteLabelFooter.vue'
import { useWhiteLabel } from './services/whitelabel.js'
import { disableBrowserPush } from './services/browser-push.js'
import { stopAppSounds } from './services/sounds.js'

const route = useRoute()
const screenLoading = useRouteLoading()
const whiteLabel = useWhiteLabel()
const productLicense = useProductLicense()
const licenseProtected = computed(() => Boolean(route.meta.requiresAuth) && !isPrototypePath(route.path))
const licenseBlocked = computed(() => licenseProtected.value && !productLicense.allowed.value)
watch(licenseProtected, value => value ? startLicenseMonitor() : stopLicenseMonitor(), { immediate: true })
watch(productLicense.allowed, value => { if (value && licenseProtected.value) connectSocket() })
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
    <div class="app-route" :aria-busy="screenLoading.active.value" :inert="screenLoading.active.value || licenseBlocked || undefined"><router-view /></div>
    <LanguageSwitcher v-if="!route.meta.requiresAuth" class="public-language-switcher"/><ProductLicenseGate v-if="licenseBlocked" />
    <WhiteLabelFooter v-if="!layoutOwnsFooter" />
    <Transition name="spa-loading-fade"><ScreenLoading v-if="screenLoading.visible.value" :label="screenLoading.label.value" /></Transition>
  </div>
</template>

<style>
.public-language-switcher{position:fixed;right:16px;top:16px;z-index:5000;background:#f5fffc!important;color:#164c40!important;box-shadow:0 3px 16px #123c3520}
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
