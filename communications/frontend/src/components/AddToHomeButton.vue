<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useInstallApp, installTarget } from '../services/install-app.js'
const route=useRoute(), install=useInstallApp(), dialog=ref(false)
const target=computed(()=>installTarget(route.path))
const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
async function add(){if(install.installed.value||!await install.request())dialog.value=true}
</script>
<template>
  <q-btn flat round dense icon="add_to_home_screen" aria-label="Adicionar atendimento à tela de início" @click="add"><q-tooltip>Adicionar à tela de início</q-tooltip></q-btn>
  <q-dialog v-model="dialog"><q-card class="install-guide"><q-card-section class="row items-center"><q-icon name="add_to_home_screen" color="primary" size="28px"/><h2>Seu atendimento a um toque</h2><q-space/><q-btn flat round dense icon="close" aria-label="Fechar instruções de instalação" v-close-popup/></q-card-section><q-card-section>
    <p v-if="install.installed.value">Você já está usando o aplicativo pela tela de início.</p>
    <template v-else><p>O atalho abre diretamente seu app de atendimento.</p><ol v-if="ios"><li>Abra esta página no Safari.</li><li>Toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme o nome e toque em <strong>Adicionar</strong>.</li></ol><ol v-else><li>No menu do navegador, escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li><li>Confirme a instalação e abra pelo novo ícone.</li></ol><p>Para receber avisos no app real, entre em sua conta e ative os alertas de novas mensagens. No protótipo, notificações são apenas ilustrativas.</p></template>
    <a :href="target" target="_top" @click="dialog=false">Abrir a página do atalho <q-icon name="arrow_forward"/></a>
  </q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Entendi" v-close-popup/></q-card-actions></q-card></q-dialog>
</template>
<style scoped>.install-guide{width:520px;max-width:94vw;border-radius:22px;background:var(--surface-strong,#fff);color:var(--ink,#19352f)}h2{font-size:18px;margin:0 12px;max-width:65%}p,li{font-size:13px;line-height:1.8}ol{padding-left:22px}li{padding:7px 0}a{font-size:13px;font-weight:700}</style>
