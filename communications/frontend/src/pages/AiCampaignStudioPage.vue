<script setup>
import { computed, nextTick, ref } from 'vue'
import { useQuasar } from 'quasar'
import AdminAssistant from '../components/AdminAssistant.vue'
import NotificationsPage from './NotificationsPage.vue'
import NotificationSchedulesPage from './NotificationSchedulesPage.vue'
import TemplatesPage from './TemplatesPage.vue'
import { createAssistantSessionApi } from '../services/admin-assistant.js'

const $q = useQuasar()
const assistant = createAssistantSessionApi('campaign')
const section = ref('compose')
const visited = ref(new Set(['compose']))
const composer = ref(null)
const library = ref(null)
const schedules = ref(null)
const conversation = ref(null)
const reference = ref(null)
const proposal = ref(null)
const generatedImages = ref([])
const channels = [
  { key: 'email', label: 'E-mail', icon: 'mail_outline', tone: 'blue' },
  { key: 'telegram', label: 'Telegram', icon: 'send_to_mobile', tone: 'indigo' },
  { key: 'whatsapp_cloud', label: 'WhatsApp API oficial', icon: 'cloud_done', tone: 'teal' },
]
const proposalTitle = computed(() => {
  if (proposal.value?.kind === 'quick') return 'Mensagem para ' + (channels.find(item => item.key === proposal.value.channel)?.label || 'o canal selecionado')
  if (proposal.value?.kind === 'global') return 'Proposta de disparo multicanal'
  return 'Proposta de envio com template'
})
const contextText = computed(() => [
  'Estúdio de disparos em massa. Canais do estúdio: e-mail, Telegram e WhatsApp API oficial.',
  'Use prepare_campaign_draft para propor alterações na prévia do compositor. Para criar ou clonar templates, mantenha a revisão de ações. Se o operador pedir uma imagem e a ferramenta estiver disponível, gere a imagem e indique como escolher o arquivo no campo de imagem de um template compatível.',
  'Compositor atual: ' + (composer.value?.studioContext || '{}'),
  reference.value ? 'Template selecionado como referência: ' + JSON.stringify(reference.value) : '',
].filter(Boolean).join('\n'))

function showSection(value) {
  visited.value.add(value)
  section.value = value
}

function goToConversation() {
  conversation.value?.scrollIntoView({ block: 'start' })
}

function selectReference(template) {
  reference.value = template
  goToConversation()
}

function receiveProposal(value) {
  proposal.value = value || null
}

function receiveFiles(files = []) {
  generatedImages.value = files.filter(file => ['image/png', 'image/jpeg'].includes(file.mimeType))
}

async function useProposal() {
  if (!proposal.value) return
  showSection('compose')
  await nextTick()
  if (!composer.value || !proposal.value) return
  const message = composer.value.applyCampaignDraft(proposal.value)
  if (message) {
    $q.notify({ type: 'warning', message })
    return
  }
  proposal.value = null
  $q.notify({ type: 'positive', message: 'Prévia atualizada. Revise os destinos e o conteúdo antes de enviar.' })
}

function refreshAfterAction() {
  composer.value?.refresh()
  library.value?.refresh()
  schedules.value?.refresh()
}
</script>

<template>
  <q-page class="page-container campaign-studio">
    <header class="studio-hero">
      <div class="studio-heading">
        <div class="studio-eyebrow"><q-icon name="auto_awesome" /> Estúdio do agente</div>
        <h1>Disparo em Massa</h1>
        <p>Monte o conteúdo de cada canal, revise a campanha e acompanhe as entregas em um só lugar.</p>
        <div class="studio-channels">
          <q-badge v-for="channel in channels" :key="channel.key" :color="channel.tone + '-9'">
            <q-icon :name="channel.icon" />{{ channel.label }}
          </q-badge>
        </div>
      </div>
      <div class="studio-actions">
        <q-btn outline no-caps icon="monitor_heart" label="Monitor de disparos" to="/agent-ai/campaigns/logs" />
        <q-btn flat no-caps icon="arrow_back" label="Agente de IA" to="/agent-ai" />
      </div>
    </header>

    <div class="studio-grid">
      <section class="studio-workspace" aria-label="Área de criação da campanha">
        <q-tabs
          :model-value="section"
          align="left" inline-label no-caps
          class="studio-tabs" active-color="primary" indicator-color="primary"
          @update:model-value="showSection"
        >
          <q-tab name="compose" icon="draw" label="Montar disparo" />
          <q-tab name="library" icon="dashboard_customize" label="Templates" />
          <q-tab name="schedule" icon="schedule_send" label="Campanhas programadas" />
        </q-tabs>

        <q-banner v-if="proposal" rounded class="draft-proposal q-my-md" aria-live="polite">
          <template #avatar><q-icon name="auto_awesome" color="teal-8" /></template>
          <strong>{{ proposalTitle }}</strong>
          <p v-if="proposal.subject">{{ proposal.subject }}</p>
          <p v-if="proposal.message" class="proposal-message">{{ proposal.message }}</p>
          <p v-else>Veja os canais e templates sugeridos na prévia.</p>
          <template #action>
            <q-btn flat no-caps label="Dispensar" @click="proposal = null" />
            <q-btn unelevated color="primary" no-caps label="Aplicar à prévia" @click="useProposal" />
          </template>
        </q-banner>

        <div class="studio-panel">
          <NotificationsPage
            v-show="section === 'compose'" ref="composer" mode="campaign"
            :generated-images="generatedImages" :download-generated="assistant.download"
          />
          <TemplatesPage
            v-if="visited.has('library')" v-show="section === 'library'" ref="library" embedded
            @assistant-reference="selectReference" @library-change="composer?.refresh()"
          />
          <NotificationSchedulesPage
            v-if="visited.has('schedule')" v-show="section === 'schedule'" ref="schedules" embedded
          />
        </div>
      </section>

      <aside ref="conversation" class="studio-conversation" aria-label="Conversar com o agente">
        <header>
          <div class="assistant-emblem"><q-icon name="auto_awesome" size="22px" /></div>
          <div>
            <h2>Copiloto da campanha</h2>
            <p>Descreva seu objetivo, adapte um template ou peça uma imagem.</p>
          </div>
        </header>
        <q-chip v-if="reference" removable icon="description" color="teal-1" text-color="teal-10" @remove="reference = null">
          {{ reference.name || 'Template selecionado' }}
        </q-chip>
        <AdminAssistant
          embedded scope="campaign" :workspace-context="contextText"
          @action-applied="refreshAfterAction" @draft-updated="receiveProposal" @files-updated="receiveFiles"
        />
      </aside>
    </div>
  </q-page>
</template>

<style scoped>
.studio-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: clamp(20px, 4vw, 42px);
  border-radius: 26px;
  color: #f3fffb;
  background: radial-gradient(ellipse at top right, #336867, transparent 60%), linear-gradient(135deg, #112c34, #134e49);
  box-shadow: 0 16px 34px #103e3324;
}
.studio-heading { min-width: 0; }
.studio-eyebrow { color: #b2fce4; text-transform: uppercase; letter-spacing: .14em; font-size: .74rem; font-weight: 800; }
.studio-eyebrow .q-icon { margin-right: 5px; font-size: 1.15rem; }
.studio-hero h1 { font-size: clamp(1.85rem, 5vw, 3rem); line-height: 1.1; margin: 10px 0; letter-spacing: -.045em; font-weight: 850; }
.studio-hero p { margin: 0 0 15px; max-width: 560px; color: #e1f4f1; }
.studio-channels, .studio-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.studio-channels .q-badge { border: 1px solid #ffffff35; padding: 6px 10px; gap: 6px; }
.studio-actions { justify-content: flex-end; flex: 0 0 auto; }
.studio-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 18px; margin-top: 20px; align-items: start; }
.studio-workspace, .studio-panel, .studio-conversation { min-width: 0; }
.studio-tabs { background: #e5f3ee; border: 1px solid #cde3dd; border-radius: 16px; color: #28534d; }
.studio-panel { padding-top: 14px; }
.studio-conversation { position: sticky; top: 12px; border: 1px solid #cde4dd; border-radius: 20px; background: #f4fbf8; padding: 12px; scroll-margin-top: 12px; }
.studio-conversation > header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.assistant-emblem { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; color: #fff; background: linear-gradient(145deg, #16786b, #284a55); }
.studio-conversation h2 { font-size: 1rem; line-height: 1.2; margin: 0; font-weight: 800; color: #183d37; }
.studio-conversation p { margin: 4px 0 0; color: #4c6761; font-size: .84rem; }
.studio-conversation > .q-chip { max-width: 100%; }
.studio-conversation > .q-chip :deep(.q-chip__content) { overflow: hidden; text-overflow: ellipsis; }
.draft-proposal { background: #dff8ef; border: 1px solid #b6ddcd; color: #1e4d41; }
.draft-proposal p { margin: 4px 0 0; }
.proposal-message { white-space: pre-wrap; max-height: 180px; overflow: auto; overflow-wrap: anywhere; }
@media (max-width: 1120px) {
  .studio-hero { flex-wrap: wrap; }
  .studio-actions { justify-content: flex-start; }
}
@media (max-width: 880px) {
  .studio-grid { grid-template-columns: minmax(0, 1fr); }
  .studio-conversation { position: relative; top: 0; }
}
@media (max-width: 520px) {
  .studio-hero { border-radius: 18px; }
  .studio-actions { flex: 1 1 100%; }
}
</style>
