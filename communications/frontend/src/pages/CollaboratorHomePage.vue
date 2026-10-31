<script setup>
import { AREAS, CHANNELS, canArea, canChannel, routeAllowed } from '../services/access.js'
import { useAuthStore } from '../stores/auth.js'
const auth = useAuthStore()
const paths = { whatsapp_web: '/app-mobile/web', whatsapp_cloud: '/app-mobile/cloud', telegram: '/telegram', email: '/email' }
</script>
<template><q-page class="q-pa-lg"><h1 class="text-h4">Olá, {{ auth.user?.name || 'colaborador' }}</h1><p>Estas são as áreas liberadas para seu perfil. Seu administrador pode ajustar os acessos.</p><div class="row q-gutter-md"><q-btn v-for="item in CHANNELS.filter(item=>canChannel(auth.user,item.key)&&routeAllowed(paths[item.key],auth.user))" :key="item.key" color="primary" no-caps :label="item.label" :to="paths[item.key]"/><q-btn v-for="item in AREAS.filter(item=>item.path&&routeAllowed(item.path,auth.user))" :key="item.key" outline color="primary" no-caps :icon="item.icon" :label="item.label" :to="item.path"/></div></q-page></template>
