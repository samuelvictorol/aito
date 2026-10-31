<script setup>
import { languages, currentLocale, setLocale, uiText } from '../i18n/index.js'
</script>
<template>
  <q-btn flat round dense icon="translate" :aria-label="uiText('Idioma do software')">
    <q-tooltip>{{ uiText('Idioma do software') }}</q-tooltip>
    <q-menu anchor="bottom right" self="top right"><q-list style="min-width:190px" role="listbox" :aria-label="uiText('Idioma do software')">
      <q-item v-for="language in languages" :key="language.value" clickable v-close-popup :active="currentLocale()===language.value" @click="setLocale(language.value,{reload:true})"><q-item-section>{{ language.label }}</q-item-section><q-item-section side><q-icon v-if="currentLocale()===language.value" name="check" color="primary"/><span v-else>{{language.short}}</span></q-item-section></q-item>
    </q-list></q-menu>
  </q-btn>
</template>
