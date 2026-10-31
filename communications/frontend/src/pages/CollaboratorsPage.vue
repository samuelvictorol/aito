<script setup>
import DesktopRemoteAccess from "../components/DesktopRemoteAccess.vue"
import CollaboratorAccounts from '../modules/whatsapp-web/CollaboratorAccounts.vue'
</script>
<template><q-page class="global-collaborators-page"><DesktopRemoteAccess/><CollaboratorAccounts/></q-page></template>
<style scoped>.global-collaborators-page{padding:clamp(16px,3vw,32px);max-width:1600px;margin:auto}</style>
