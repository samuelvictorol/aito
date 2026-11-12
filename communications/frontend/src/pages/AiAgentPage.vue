<script setup>
import { fabMeta } from '@quasar/extras/fontawesome-v6'
import { onMounted, ref } from 'vue'
import AssistantSettingsDialog from '../components/AssistantSettingsDialog.vue'
import { assistantApi } from '../services/admin-assistant.js'

const settings = ref(false)
const canConfigure = ref(false)
const managed = ref(false)

onMounted(async () => {
  const value = await assistantApi.config().catch(() => null)
  canConfigure.value = Boolean(value?.canConfigure)
  managed.value = Boolean(value?.managed)
})
const workspaces = [
  {
    name: 'ai-campaigns', icon: fabMeta, marker: '01 · Campanhas',
    title: 'Disparo em Massa',
    description: 'Planeje com o agente, refine os templates e confira a prévia de cada canal antes de enfileirar.',
    badges: ['E-mail', 'Telegram', 'WhatsApp API oficial'],
    steps: ['Definir o público e o conteúdo', 'Revisar por canal', 'Acompanhar as entregas'],
  },
  {
    name: 'ai-chatbot', icon: 'qr_code_2', marker: '02 · Atendimento',
    title: 'Criar ChatBot',
    description: 'Desenhe o atendimento com o agente, revise as conexões no mapa e teste a conversa no simulador.',
    badges: ['WhatsApp QR Code', 'IA'],
    steps: ['Abrir ou criar um fluxo', 'Ajustar nós e condições', 'Simular a conversa'],
  },
]
</script>

<template>
  <q-page padding class="agent-home">
    <section class="agent-intro">
      <div class="agent-intro__label"><q-icon name="auto_awesome" /> Aito I.A</div>
      <h1>Agente de IA</h1>
      <p>Escolha um agente para montar campanhas ou criar o atendimento pelo WhatsApp.</p>
      <q-btn v-if="canConfigure" outline no-caps icon="tune" label="Configurar OpenAI" @click="settings = true" />
      <q-btn v-else-if="managed" outline no-caps icon="auto_awesome" label="AitoTokens" to="/aitotokens" />
      <div class="agent-intro__graphic" aria-hidden="true"><q-icon name="auto_awesome" /></div>
    </section>
    <div class="agent-workspaces">
      <article v-for="item in workspaces" :key="item.name" class="agent-workspace">
        <span class="agent-workspace__icon"><q-icon :name="item.icon" /></span>
        <span class="agent-workspace__marker">{{ item.marker }}</span>
        <h2>{{ item.title }}</h2>
        <div class="agent-workspace__badges"><q-badge v-for="badge in item.badges" :key="badge" :label="badge" /></div>
        <p>{{ item.description }}</p>
        <ul><li v-for="step in item.steps" :key="step"><q-icon name="check" />{{ step }}</li></ul>
        <q-btn unelevated no-caps :label="item.title" icon-right="arrow_forward" :to="{ name: item.name }" />
      </article>
    </div>
    <AssistantSettingsDialog v-if="canConfigure" v-model="settings" />
  </q-page>
</template>

<style scoped>
.agent-home{max-width:1280px;margin:auto;padding:clamp(14px,3vw,34px);color:#17372f}
.agent-intro{position:relative;isolation:isolate;overflow:hidden;padding:clamp(24px,5vw,54px);border-radius:24px;color:#f3fffa;background:radial-gradient(ellipse at right top,#1c856a,transparent 72%),#0a352f}
.agent-intro__label,.agent-workspace__marker{font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:.72rem}
.agent-intro__label{display:flex;align-items:center;gap:8px;color:#b7f4dc}
.agent-intro h1{font-size:clamp(2.1rem,5vw,4.4rem);line-height:1.04;letter-spacing:-.055em;margin:14px 0;font-weight:800}
.agent-intro p{max-width:560px;font-size:clamp(.95rem,1.6vw,1.12rem);line-height:1.6;color:#d3efe5;margin:0 0 22px}
.agent-intro__graphic{z-index:-1;position:absolute;inset:auto 4% -26% auto;font-size:clamp(130px,32vw,340px);color:#b4ffe729;line-height:1;transform:rotate(-10deg)}
.agent-workspaces{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px}
.agent-workspace{--agent-accent:#145b9c;--agent-tint:#d9eeff;--agent-border:#c1def3;padding:clamp(20px,3vw,32px);border:1px solid var(--agent-border);border-radius:22px;background:linear-gradient(145deg,#faffff,var(--agent-tint));box-shadow:0 12px 30px #1f54440c;display:flex;align-items:flex-start;flex-direction:column}
.agent-workspace:nth-child(2){--agent-accent:#14664e;--agent-tint:#d9f5e7;--agent-border:#bae6d1}
.agent-workspace__icon{display:grid;place-items:center;width:50px;height:50px;font-size:25px;background:#ffffffaa;color:var(--agent-accent);border-radius:15px;margin-bottom:18px}
.agent-workspace__marker{color:#526d65}
.agent-workspace h2{font-size:clamp(1.35rem,3vw,2.1rem);line-height:1.15;font-weight:750;margin:8px 0 12px}
.agent-workspace__badges{display:flex;flex-wrap:wrap;gap:7px}
.agent-workspace__badges .q-badge{color:var(--agent-accent);background:#fff;border:1px solid var(--agent-border);font-weight:650}
.agent-workspace p{color:#526d65;line-height:1.6;margin:16px 0}
.agent-workspace ul{list-style:none;padding:0;margin:0 0 22px;display:grid;gap:8px;color:#38574d}
.agent-workspace li{display:flex;gap:8px;align-items:center}
.agent-workspace li .q-icon{color:var(--agent-accent)}
.agent-workspace>.q-btn{margin-top:auto;background:var(--agent-accent);color:#fff}
@media(max-width:680px){.agent-workspaces{grid-template-columns:1fr}.agent-intro,.agent-workspace{border-radius:17px}}
</style>
