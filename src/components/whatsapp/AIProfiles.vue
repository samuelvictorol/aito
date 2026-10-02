<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { botApi, waApi, messageOf } from 'src/services/whatsapp'
import FlowMediaPreview from './FlowMediaPreview.vue'
const $q = useQuasar(), items = ref([]), models = ref([]), assets = ref([]), editing = ref(null), busy = ref(false), loaded = ref(false), existing = ref(false)
const modelDetails = ref([])
const imageModelDetails = ref([])
const selectedModel = computed(() => modelDetails.value.find(model => model.id === editing.value?.model))
const modelChoices = computed(() => modelDetails.value.length ? modelDetails.value.map(model => ({ label: model.label, value: model.id })) : models.value.map(id => ({ label: id, value: id })))
const imageModelChoices = computed(() => imageModelDetails.value.map(model => ({ label: model.label, value: model.id })))
function changeModel() { if (selectedModel.value?.generateImages === false) editing.value.generateImages = false }
const fail = error => $q.notify({ type: 'negative', message: messageOf(error) })
async function load() {
  try { const [profiles, library] = await Promise.all([botApi.get('/ai-profiles'), waApi.get('/assets')]); items.value = profiles.data.items; models.value = profiles.data.models; modelDetails.value = profiles.data.modelOptions || []; imageModelDetails.value = profiles.data.imageModelOptions || []; assets.value = library.data.items; loaded.value = true } catch (error) { fail(error) }
}
function edit(profile) {
  existing.value = Boolean(profile)
  editing.value = profile ? { ...JSON.parse(JSON.stringify(profile)), visionModel: profile.visionModel || profile.model, imageModel: profile.imageModel || 'gpt-image-2.5-sunburst', apiKey: '' } : { key: '', title: '', model: models.value.includes('gpt-6.1-sol') ? 'gpt-6.1-sol' : models.value[0], visionModel: models.value.includes('gpt-6.1-sol') ? 'gpt-6.1-sol' : models.value[0], imageModel: 'gpt-image-2.5-sunburst', temperature: 0.7, resetCommand: 'chatgptresetchatcontext', timeoutMinutes: 30, generateImages: true, generateDocuments: true, context: [], apiKey: '' }
}
async function save() {
  busy.value = true
  try { await (existing.value ? botApi.put(`/ai-profiles/${editing.value.key}`, editing.value) : botApi.post('/ai-profiles', editing.value)); editing.value = null; await load(); $q.notify({ type: 'positive', message: 'Configuração de IA salva.' }) } catch (error) { fail(error) } finally { busy.value = false }
}
async function remove(profile) {
  if (!confirm(`Excluir a configuração “${profile.title}”?`)) return
  try { await botApi.delete(`/ai-profiles/${profile.key}`); await load() } catch (error) { fail(error) }
}
async function upload(event, item) {
  const file = event.target.files?.[0]; if (!file) return
  busy.value = true
  try { const data = new FormData(); data.append('file', file); data.append('permanent', 'true'); const response = await waApi.post('/assets', data); assets.value.unshift(response.data); item.assetId = response.data._id } catch (error) { fail(error) } finally { busy.value = false; event.target.value = '' }
}
onMounted(load)
</script>
<template>
  <section class="ai-profiles">
    <header><div><h3>Funções com I.A.</h3><p>Assistentes com instruções, arquivos e memória independente para cada conversa.</p></div><q-btn no-caps color="teal-7" label="Nova configuração de IA" :disable="!loaded" @click="edit()" /></header>
    <button v-if="!loaded" @click="load">Tentar carregar configurações</button>
    <div class="ai-list"><article v-for="profile in items" :key="profile.key"><div><strong>{{ profile.title }}</strong><small>{{ profile.model }} · {{ profile.timeoutMinutes }} min de inatividade</small><small>Visão: {{ profile.visionModel || profile.model }} · Imagem: {{ profile.imageModel || 'gpt-image-2.5-sunburst' }}</small><small>{{ profile.key }}</small></div><q-btn flat round icon="mdi-pencil" aria-label="Editar configuração de IA" @click="edit(profile)" /><q-btn flat round icon="mdi-delete-outline" aria-label="Excluir configuração de IA" @click="remove(profile)" /></article></div>
    <q-dialog :model-value="!!editing" persistent @update:model-value="value => { if (!value) editing = null }">
      <q-card v-if="editing" class="ai-dialog">
        <q-card-section class="ai-heading"><h3>Configuração de IA</h3><q-btn flat round icon="mdi-close" aria-label="Fechar configuração" :disable="busy" @click="editing = null" /></q-card-section>
        <q-card-section class="ai-fields">
          <q-input v-model="editing.title" outlined label="Título" maxlength="120" />
          <q-input v-model="editing.key" outlined label="Identificador" hint="Letras minúsculas, números e hífens. Usado pelo fluxograma." :disable="existing" />
          <q-input v-model="editing.apiKey" type="password" autocomplete="new-password" outlined label="Chave da API OpenAI" :hint="editing.hasKey ? 'Chave salva. Deixe vazio para manter.' : 'A chave será protegida no servidor.'" />
          <div class="ai-two"><q-select v-model="editing.model" :options="modelChoices" emit-value map-options outlined label="Modelo de conversa e documentos" @update:model-value="changeModel" /><q-input v-model.number="editing.temperature" outlined type="number" min="0" max="2" step="0.1" label="Temperatura" :disable="selectedModel?.temperature === false" :hint="selectedModel?.temperature === false ? 'Este modelo usa raciocínio; a temperatura não é enviada.' : undefined" /></div>
          <div class="ai-two"><q-select v-model="editing.visionModel" :options="modelChoices" emit-value map-options outlined label="Modelo para interpretar imagens" hint="Analisa imagens recebidas e orienta a edição." /><q-select v-model="editing.imageModel" :options="imageModelChoices" emit-value map-options outlined label="Modelo para criar e editar imagens" hint="Sunburst prioriza fidelidade; Flare é mais rápido." /></div>
          <div class="ai-two"><q-input v-model="editing.resetCommand" outlined label="Comando para limpar contexto" /><q-input v-model.number="editing.timeoutMinutes" outlined type="number" min="1" max="1440" label="Desligar após inatividade (min)" /></div>
          <div><q-toggle v-model="editing.generateImages" label="Gerar imagens" color="teal" :disable="selectedModel?.generateImages === false" /><q-toggle v-model="editing.generateDocuments" label="Gerar documentos e planilhas" color="teal" /></div>
          <p>O acesso ao modelo depende da sua conta OpenAI. O uso do modelo e das ferramentas é cobrado pela OpenAI na conta da chave configurada.</p>
          <h4>Contexto do assistente</h4>
          <article v-for="(item, index) in editing.context" :key="index" class="ai-context">
            <div class="ai-heading"><strong>{{ item.type === 'text' ? 'Instruções / texto' : 'Arquivo de referência' }} {{ index + 1 }}</strong><q-btn flat round icon="mdi-close" aria-label="Remover contexto" @click="editing.context.splice(index, 1)" /></div>
            <q-input v-if="item.type === 'text'" v-model="item.text" outlined type="textarea" label="Conteúdo" maxlength="20000" />
            <template v-else><q-select v-model="item.assetId" :options="assets" option-label="name" option-value="_id" emit-value map-options outlined label="Arquivo da biblioteca" /><label class="ai-upload">Enviar novo arquivo<input type="file" :disabled="busy" @change="upload($event, item)"></label><FlowMediaPreview v-if="item.assetId" :asset-id="item.assetId" /></template>
          </article>
          <div><q-btn outline no-caps label="Adicionar texto" :disable="editing.context.length >= 20" @click="editing.context.push({ type: 'text', text: '' })" /><q-btn outline no-caps label="Adicionar arquivo" class="q-ml-sm" :disable="editing.context.length >= 20" @click="editing.context.push({ type: 'asset', assetId: '' })" /></div>
          <p>Imagens, áudio, PDF, documentos, planilhas e texto. Para vídeos, use uma transcrição.</p>
        </q-card-section>
        <q-card-actions align="right" class="ai-footer"><q-btn flat no-caps label="Cancelar" :disable="busy" @click="editing = null" /><q-btn no-caps color="teal-7" label="Salvar configuração" :loading="busy" @click="save" /></q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>
<style scoped>
.ai-profiles{margin:0 0 24px;padding:22px;border:1px solid #527e72;border-radius:13px}.ai-profiles header,.ai-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.ai-profiles h3,.ai-heading h3{margin:0;font-size:19px}.ai-profiles p,.ai-fields p{font-size:12px}.ai-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:18px}.ai-list article{display:flex;align-items:center;border:1px solid #527e72;border-radius:10px;padding:12px}.ai-list article>div{flex:1;min-width:0;overflow-wrap:anywhere}.ai-list small{display:block;font-size:11px;margin-top:5px}.ai-dialog{width:720px;max-width:96vw;max-height:94dvh;display:flex;flex-direction:column}.ai-fields{overflow:auto;display:grid;gap:18px}.ai-fields h4{margin:0;font-size:16px}.ai-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ai-context{padding:12px;border:1px solid #8cb1a5;border-radius:10px}.ai-upload{display:block;font-size:12px;margin:12px 0}.ai-upload input{display:block;max-width:100%;margin-top:8px}.ai-footer{flex-shrink:0;border-top:1px solid #8cb1a5}@media(max-width:600px){.ai-two{grid-template-columns:1fr}.ai-profiles header{align-items:start;flex-direction:column}.ai-profiles{padding:14px}}
</style>
