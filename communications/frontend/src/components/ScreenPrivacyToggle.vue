<script setup>
import { personalDataVisible, setPersonalDataVisible } from '../services/screen-privacy.js'
</script>
<template>
  <q-btn data-privacy-public flat round :icon="personalDataVisible ? 'visibility' : 'visibility_off'" :aria-pressed="!personalDataVisible" :aria-label="personalDataVisible ? 'Ocultar dados pessoais' : 'Mostrar dados pessoais'" @click="setPersonalDataVisible(!personalDataVisible)">
    <q-tooltip data-privacy-public>{{ personalDataVisible ? 'Ocultar dados pessoais nesta tela' : 'Mostrar dados pessoais' }}</q-tooltip>
  </q-btn>
</template>
