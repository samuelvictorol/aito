<script setup>
import { computed, ref, watch } from 'vue'
import { vAuthSrc } from '../authenticated-media.js'
const props = defineProps({ contact: { type: Object, required: true } })
const failed = ref(false)
watch(() => props.contact.avatarUrl, () => { failed.value = false })
const initials = computed(() => String(props.contact.displayNameOverride || props.contact.displayName || props.contact.phone || '?').trim().split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase())
</script>
<template><span class="avatar" data-sensitive><img v-if="contact.avatarUrl && !failed" v-auth-src="contact.avatarUrl" alt="" referrerpolicy="no-referrer" @error="failed = true"><b v-else>{{ initials }}</b></span></template>
<style scoped>.avatar{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--primary,#35bca4) 16%,white);color:var(--primary-dark,#137d6c)}.avatar img{display:block;width:100%;height:100%;object-fit:cover}</style>
