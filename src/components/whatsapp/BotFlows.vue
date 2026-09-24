<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import BotFlowEditor from './BotFlowEditor.vue'
import { botApi, messageOf, requestId, formatDate } from 'src/services/whatsapp'
const $q = useQuasar(), items = ref([]), page = ref(1), pages = ref(1), search = ref(''), loading = ref(false), selected = ref(''), createDialog = ref(false), name = ref('Novo fluxo')
function fail(error) { $q.notify({ type: 'negative', message: messageOf(error) }) }
async function load() { loading.value = true; try { const { data } = await botApi.get('/flows', { params: { page: page.value, search: search.value, limit: 12 } }); items.value = data.items || []; pages.value = data.pages || 1 } catch (error) { fail(error) } finally { loading.value = false } }
async function create() {
  try {
    const { data } = await botApi.post('/flows', { name: name.value, description: 'Triagem de clientes AitoSoftwares', active: false, channels: ['whatsapp'], settings: { collectWindowMs: 1600, resetAfterMinutes: 60, messageIntervalMs: 1000, matchFirstMessage: false, fallbackMessage: 'Não entendi sua resposta. Digite *menu* para recomeçar.' }, nodes: [
      { nodeId: 'start', type: 'start', position: { x: 40, y: 150 }, data: { label: 'Boas-vindas', messages: [{ outputId: requestId(), type: 'text', text: 'Olá, {{nome}}! Bem-vindo à AitoSoftwares.\nComo podemos ajudar?\n1. Conhecer soluções\n2. Falar com nossa equipe' }] } },
      { nodeId: 'choice', type: 'choice', position: { x: 340, y: 150 }, data: { label: 'Escolha do cliente', messages: [] } },
      { nodeId: 'solutions', type: 'message', position: { x: 640, y: 50 }, data: { label: 'Nossas soluções', messages: [{ outputId: requestId(), type: 'text', text: 'Desenvolvemos sistemas e automações sob medida. Conte o que você precisa e nossa equipe dará continuidade ao seu atendimento.' }] } },
      { nodeId: 'human', type: 'action', position: { x: 950, y: 210 }, data: { label: 'Atendimento humano', messages: [], action: { type: 'chat', chatAction: 'takeover' } } },
    ], edges: [{ edgeId: requestId(), source: 'start', target: 'choice', keywords: [] }, { edgeId: requestId(), source: 'choice', target: 'solutions', keywords: ['1', 'soluções'], label: '1 · Soluções' }, { edgeId: requestId(), source: 'choice', target: 'human', keywords: ['2', 'equipe', 'atendente'], label: '2 · Equipe' }, { edgeId: requestId(), source: 'solutions', target: 'human', keywords: [] }] })
    createDialog.value = false; selected.value = data.flow._id; load()
  } catch (error) { fail(error) }
}
function activate(flow) { $q.dialog({ title: flow.active ? 'Desativar fluxo' : 'Ativar fluxo', message: flow.active ? 'O bot deixará de iniciar novas triagens por este fluxo.' : 'Este fluxo passará a atender os clientes da sessão conectada. O fluxo anterior será desativado.', cancel: true }).onOk(async () => { try { await botApi.post(`/flows/${flow._id}/activate`, { active: !flow.active }); await load() } catch (error) { fail(error) } }) }
async function duplicate(flow) { try { const { data } = await botApi.post(`/flows/${flow._id}/duplicate`); selected.value = data.flow._id; load() } catch (error) { fail(error) } }
function remove(flow) { $q.dialog({ title: 'Excluir fluxo', message: `Excluir “${flow.name}”?`, cancel: true }).onOk(async () => { try { await botApi.delete(`/flows/${flow._id}`); load() } catch (error) { fail(error) } }) }
onMounted(load)
</script>

<template>
  <BotFlowEditor v-if="selected" :key="selected" :flow-id="selected" @back="selected = ''; load()" @saved="load" />
  <section v-else class="wa-flows">
    <header><div><span class="wa-eyebrow">AUTOMAÇÃO VISUAL</span><h2>Fluxo BotBuilder</h2><p>Crie a triagem com mensagens, decisões, arquivos e integrações. Apenas um fluxo fica ativo por vez.</p></div><q-btn color="teal-6" no-caps icon="mdi-plus" label="Novo fluxo" @click="createDialog = true" /></header>
    <q-input v-model="search" outlined dense clearable placeholder="Buscar fluxo" class="q-mb-lg" @keyup.enter="page = 1; load()"><template #append><q-btn flat dense round icon="mdi-magnify" aria-label="Buscar" @click="page = 1; load()" /></template></q-input>
    <q-linear-progress v-if="loading" indeterminate color="teal-3" />
    <div v-if="!loading && !items.length" class="wa-flows-empty"><q-icon name="mdi-sitemap-outline" size="48px" /><h3>Seu primeiro atendimento começa aqui</h3><p>Crie um fluxo e personalize o exemplo de boas-vindas e encaminhamento para a equipe.</p><q-btn color="teal-7" no-caps label="Criar fluxo" @click="createDialog = true" /></div>
    <div class="wa-flow-grid"><article v-for="flow in items" :key="flow._id"><div class="wa-flow-badges"><q-badge :color="flow.active ? 'teal-7' : 'blue-grey-8'">{{ flow.active ? 'Ativo' : 'Inativo' }}</q-badge><small>v{{ flow.version || 1 }}</small></div><h3>{{ flow.name }}</h3><p>{{ flow.description || 'Sem descrição' }}</p><div class="wa-flow-meta">{{ flow.nodes?.length || 0 }} cards · {{ flow.edges?.length || 0 }} conexões<span>{{ formatDate(flow.updatedAt) }}</span></div><footer><q-btn no-caps color="teal-7" label="Abrir editor" @click="selected = flow._id" /><q-btn no-caps outline :label="flow.active ? 'Desativar' : 'Ativar'" @click="activate(flow)" /><q-btn flat round dense icon="mdi-content-copy" aria-label="Duplicar fluxo" @click="duplicate(flow)" /><q-btn flat round dense icon="mdi-delete-outline" color="red-3" :disable="flow.active" aria-label="Excluir fluxo" @click="remove(flow)" /></footer></article></div>
    <q-pagination v-if="pages > 1" v-model="page" :max="pages" :max-pages="6" color="teal-4" class="q-mt-lg justify-center" @update:model-value="load" />
    <q-dialog v-model="createDialog"><q-card style="width:min(92vw,460px)"><q-card-section><h3 class="text-h6 q-mt-none">Novo fluxo de atendimento</h3><q-input v-model="name" outlined label="Nome do fluxo" maxlength="120" /><p class="q-mt-md">Comece com um exemplo editável de triagem. Ele será criado inativo para você revisar e simular antes de ativar.</p></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup /><q-btn color="teal-7" no-caps label="Criar fluxo" :disable="!name.trim()" @click="create" /></q-card-actions></q-card></q-dialog>
  </section>
</template>

<style scoped>
.wa-flows{padding:24px}.wa-flows header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.wa-eyebrow{font-size:10px;letter-spacing:.1em;color:#80d7bc}.wa-flows h2{font-size:23px;line-height:1.25;margin:7px 0}.wa-flows header p{font-size:12px;color:#9db9b1;margin:0;max-width:650px}.wa-flow-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.wa-flow-grid article{padding:20px;border:1px solid #27504b;border-radius:12px;background:#0c292b}.wa-flow-badges{display:flex;justify-content:space-between;align-items:center}.wa-flow-badges small{color:#7ca499}.wa-flow-grid h3{font-size:17px;line-height:1.3;margin:20px 0 8px;overflow-wrap:anywhere}.wa-flow-grid p{font-size:12px;color:#9fbfb4;min-height:38px}.wa-flow-meta{font-size:11px;color:#7fbaaa}.wa-flow-meta span{display:block;margin-top:6px}.wa-flow-grid footer{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:20px}.wa-flows-empty{padding:50px 20px;text-align:center;color:#a7cec0}.wa-flows-empty h3{font-size:20px;line-height:1.4}.wa-flows-empty p{max-width:440px;margin:0 auto 20px}@media(max-width:1100px){.wa-flow-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.wa-flow-grid{grid-template-columns:1fr}.wa-flows{padding:16px}.wa-flows header{align-items:flex-start;flex-direction:column}}
</style>
