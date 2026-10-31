<script setup>
import { vCanAction } from '../../../services/permission-directives.js'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, messageOf } from '../services.js'

const router = useRouter()
const items = ref([]), page = ref(1), pages = ref(1), search = ref(''), loading = ref(false), toggling = ref(''), error = ref('')

async function load(next = page.value) {
  loading.value = true
  try { const { data } = await api.get('/flows', { params: { page: next, limit: 12, search: search.value } }); items.value = data.items; page.value = data.page; pages.value = data.pages; error.value = '' }
  catch (cause) { error.value = messageOf(cause) }
  finally { loading.value = false }
}
async function createFlow() {
  try {
    const id = crypto.randomUUID()
    const { data } = await api.post('/flows', {
      name: `Novo fluxo ${Date.now().toString().slice(-4)}`, description: 'Fluxo receptivo criado no editor visual.', active: false,
      channels: ['whatsapp'], settings: { collectWindowMs: 1600, resetAfterMinutes: 60, messageIntervalMs: 1000, fallbackMessage: 'Não entendi. Escreva *menu* para recomeçar.' },
      nodes: [{ nodeId: 'start', type: 'start', position: { x: 120, y: 180 }, data: { label: 'Boas-vindas', messages: [{ outputId: id, type: 'text', text: 'Olá, {{nome}}! Como posso ajudar?' }] } }], edges: [],
    })
    router.push(`/whatsapp-web/flows/${data.flow._id}`)
  } catch (cause) { error.value = messageOf(cause) }
}
async function duplicate(id) { try { const { data } = await api.post(`/flows/${id}/duplicate`); await load(); router.push(`/whatsapp-web/flows/${data._id}`) } catch (cause) { error.value = messageOf(cause) } }
async function toggleActive(flow) { toggling.value = flow._id; try { await api.patch(`/flows/${flow._id}/active`, { active: !flow.active }); await load() } catch (cause) { error.value = messageOf(cause) } finally { toggling.value = '' } }
async function remove(id) { if (!confirm('Excluir este fluxo? Esta ação não pode ser desfeita.')) return; try { await api.delete(`/flows/${id}`); await load() } catch (cause) { error.value = messageOf(cause) } }
onMounted(() => load())
</script>

<template>
  <section>
    <div class="page-head"><div><span class="eyebrow">Automação visual</span><h1>Fluxos do bot</h1><p>Crie jornadas receptivas para a sessão do WhatsApp Web. Apenas um fluxo fica ativo por vez.</p></div><button v-can-action="'web_flows.create'" class="btn" @click="createFlow">＋ Novo fluxo</button></div>
    <div class="toolbar card"><input v-model="search" class="search" placeholder="Buscar fluxo…" @keyup.enter="load(1)"><button class="btn secondary" @click="load(1)">Buscar</button></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="card empty">Carregando fluxos…</div>
    <div v-else-if="!items.length" class="card empty"><b>Nenhum fluxo encontrado</b><span>Crie o primeiro fluxo para começar.</span></div>
    <div v-else class="flows-grid">
      <article v-for="flow in items" :key="flow._id" class="card flow-card">
        <div><span :class="['status-chip', flow.active ? '' : 'warn']">{{ flow.active ? 'Ativo em tempo real' : 'Inativo' }}</span><span class="version">v{{ flow.version }}</span></div>
        <h2>{{ flow.name }}</h2><p>{{ flow.description || 'Sem descrição.' }}</p>
        <div class="flow-meta"><span>⌘ {{ flow.nodes.length }} cards</span><span>↗ {{ flow.edges.length }} conexões</span><span>◉ WhatsApp Web</span></div>
        <footer><button class="btn" @click="router.push(`/whatsapp-web/flows/${flow._id}`)">Abrir editor</button><button v-can-action="'web_flows.execute'" class="btn secondary state-button" :disabled="toggling === flow._id" @click="toggleActive(flow)">{{ flow.active ? 'Desativar' : 'Ativar' }}</button><button v-can-action="'web_flows.create'" class="icon-button" title="Duplicar fluxo" @click="duplicate(flow._id)">⧉</button><button v-can-action="'web_flows.delete'" class="icon-button danger-icon" title="Excluir fluxo" @click="remove(flow._id)">×</button></footer>
      </article>
    </div>
    <div v-if="pages > 1" class="pagination"><button v-for="n in pages" :key="n" :class="{ active: n === page }" @click="load(n)">{{ n }}</button></div>
  </section>
</template>

<style scoped>
.toolbar{display:flex;gap:10px;padding:12px;margin-bottom:18px}.flows-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.flow-card{padding:20px}.flow-card>div:first-child{display:flex;align-items:center;justify-content:space-between}.version{color:#84928f;font-size:.68rem}.flow-card h2{margin:18px 0 7px;font:750 1.05rem Inter,'Segoe UI',sans-serif}.flow-card p{min-height:42px;margin:0;color:#6e7e7a;font-size:.78rem}.flow-meta{display:flex;flex-wrap:wrap;gap:10px;margin:17px 0;color:#56706a;font-size:.68rem}.flow-card footer{display:flex;flex-wrap:wrap;gap:8px}.flow-card footer .btn:first-child{flex:1}.state-button{min-width:88px}.danger-icon{color:#cc4054}.error{color:#b52c40}@media(max-width:1100px){.flows-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.flows-grid{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column}}
</style>
