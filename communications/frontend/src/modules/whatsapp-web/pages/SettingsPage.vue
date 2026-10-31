<script setup>
import { vCanAction } from '../../../services/permission-directives.js'
import { canArea, canAction, isCollaborator } from '../../../services/access.js'
import { getStoredUser } from '../../../services/tokens.js'
import ConversationSignature from '../ConversationSignature.vue'
import { computed, onMounted, ref } from 'vue'
import { api, messageOf, currentUser } from '../services.js'

const actor = () => currentUser.value || getStoredUser()
const may = (action) => canAction(actor(), 'web_settings', action)
const form = ref({ branding: {}, runtime: {}, messages: {adminNick:'Admin'} }), credentials = ref([]), secretForm = ref({ id: '', name: '', description: '', value: '' }), loading = ref(false), secretLoading = ref(false), toast = ref('')
const collectSeconds = computed({ get: () => Number(form.value.runtime?.collectWindowMs || 3000) / 1000, set: value => { form.value.runtime.collectWindowMs = Math.round(Number(value) * 1000) } })
function show(value) { toast.value = value; setTimeout(() => { if (toast.value === value) toast.value = '' }, 3400) }
async function load() {
  try {
    const [settingsResult, credentialsResult] = await Promise.all([api.get('/settings'), canArea(actor(), 'web_settings') ? api.get('/settings/credentials') : Promise.resolve({ data: {items: []} })])
    form.value = {...settingsResult.data,messages:settingsResult.data.messages||{adminNick:'Admin'}}; credentials.value = credentialsResult.data.items
  } catch (cause) { show(messageOf(cause)) }
}
async function save() {
  if (!may('configure')) return
  const payload = JSON.parse(JSON.stringify(form.value))
  if (isCollaborator(actor())) delete payload.runtime?.allowPrivateEndpoints
  loading.value = true
  try { form.value = (await api.put('/settings', payload)).data; currentUser.value=(await api.get('/auth/me')).data.user; show('Configurações aplicadas sem reiniciar o serviço.') }
  catch (cause) { show(messageOf(cause)) } finally { loading.value = false }
}
function editSecret(item) { secretForm.value = { id: item._id, name: item.name, description: item.description, value: '' } }
function resetSecret() { secretForm.value = { id: '', name: '', description: '', value: '' } }
async function saveSecret() {
  if (!may('credentials')) return
  secretLoading.value = true
  try {
    if (secretForm.value.id) await api.put(`/settings/credentials/${secretForm.value.id}`, secretForm.value)
    else await api.post('/settings/credentials', secretForm.value)
    resetSecret(); credentials.value = (await api.get('/settings/credentials')).data.items; show('Credencial criptografada e salva.')
  } catch (cause) { show(messageOf(cause)) } finally { secretLoading.value = false }
}
async function removeSecret(item) { if (!confirm(`Apagar a credencial ${item.name}? Ações que dependem dela deixarão de funcionar.`)) return; try { await api.delete(`/settings/credentials/${item._id}`); await load(); show('Credencial removida.') } catch (cause) { show(messageOf(cause)) } }
onMounted(load)
</script>

<template>
  <section>
    <ConversationSignature class="q-mb-md"/>
    <div class="page-head"><div><span class="eyebrow">Tudo pelo painel</span><h1>Configurações</h1><p>Personalize o whitelabel, os limites operacionais e os segredos usados pelas ações sem editar arquivos do projeto.</p></div><button v-can-action="'web_settings.configure'" class="btn" :disabled="loading" @click="save">{{ loading ? 'Aplicando…' : 'Salvar configurações' }}</button></div>
    <fieldset class="permission-fields" :disabled="!may('configure')"><article class="card settings-card"><h2>Assinaturas opcionais</h2><div class="fields two"><div><label class="toggle"><input v-model="form.messages.botSignatureEnabled" type="checkbox">Assinar mensagens do bot e da IA</label><div class="field"><label for="bot-signature">Nome do assistente</label><input id="bot-signature" v-model="form.messages.botSignature" maxlength="60" placeholder="AitoSoftwares"></div><p>Exemplo: <strong>AitoSoftwares:</strong> Bem-vindo(a), sou seu assistente virtual.</p></div><div><label class="toggle"><input v-model="form.messages.panelSignatureEnabled" type="checkbox">Assinar respostas pelo painel</label><p>As respostas usam a assinatura de conversa escolhida acima. O administrador pode entrar como ele mesmo ou selecionar um colaborador.</p></div></div><p>O nome é enviado entre asteriscos para aparecer em negrito no WhatsApp. Cada colaborador usa sua própria assinatura, configurada no acesso da equipe.</p></article><div class="settings-grid">
      <article class="card settings-card">
        <div class="section-head"><span class="settings-icon">W</span><div><h2>Identidade do painel</h2><p>Nome, subtítulo e cor principal do whitelabel.</p></div></div>
        <div class="fields two"><div class="field"><label>Nome do produto</label><input v-model="form.branding.name" maxlength="80"></div><div class="field"><label>Subtítulo</label><input v-model="form.branding.subtitle" maxlength="120"></div><div class="field"><label>Cor principal</label><div class="color-field"><input v-model="form.branding.accent" pattern="#[0-9a-fA-F]{6}"><input v-model="form.branding.accent" type="color"></div></div></div>
      </article>
      <article class="card settings-card">
        <div class="section-head"><span class="settings-icon">⌁</span><div><h2>Uso de recursos</h2><p>Limites de armazenamento, arquivos e sincronização. A conexão também depende da memória disponível na instância.</p></div></div>
        <div class="fields two"><div class="field"><label>Retenção de mensagens (dias)</label><input v-model.number="form.runtime.retentionDays" type="number" min="1" max="3650"></div><div class="field"><label>Retenção de avisos e erros (mínimo 14 dias)</label><small>Logs informativos e eventos processados expiram em 7 dias.</small><input v-model.number="form.runtime.logRetentionDays" type="number" min="14" max="90"></div><div class="field"><label>Máximo por arquivo (MB)</label><input v-model.number="form.runtime.mediaMaxMb" type="number" min="1" max="20"></div><div class="field"><label>Timeout padrão de API (ms)</label><input v-model.number="form.runtime.actionTimeoutMs" type="number" min="500" max="30000"></div><div class="field"><label>Conversas ao sincronizar</label><input v-model.number="form.runtime.syncChatLimit" type="number" min="0" max="100"></div><div class="field"><label>Mensagens por conversa</label><input v-model.number="form.runtime.syncMessagesPerChat" type="number" min="0" max="100"></div></div>
        <label class="toggle security-toggle"><input v-model="form.runtime.importHistoryOnConnect" type="checkbox">Importar mensagens de backup ao conectar</label>
        <p class="history-help">Somente para o histórico; mensagens anteriores à conexão não acionam fluxos ou comandos. Desative para ignorar mensagens antigas e de cache.</p>
        <label v-if="!isCollaborator(actor())" class="toggle security-toggle"><input v-model="form.runtime.allowPrivateEndpoints" type="checkbox"> Permitir que ações acessem endpoints de rede privada ou localhost</label>
        <p v-if="!isCollaborator(actor())" class="warning">Mantenha a opção de rede privada desligada em produção. Ela protege o servidor contra chamadas acidentais a serviços internos.</p>
      </article>
    </div>

    </fieldset><article class="card credentials-card">
      <div class="section-head"><span class="settings-icon">◆</span><div><h2>Credenciais para ações</h2><p>Use no fluxo como <code v-pre>{{secret.CRM_API_KEY}}</code>. O valor nunca volta para o navegador.</p></div><span class="security-chip">HTTPS + AES-256-GCM</span></div>
      <div class="credentials-layout">
        <form v-can-action="'web_settings.credentials'" class="secret-form" @submit.prevent="saveSecret"><div class="field"><label>Nome da credencial</label><input v-model.trim="secretForm.name" placeholder="CRM_API_KEY" required pattern="[A-Za-z][A-Za-z0-9_]{1,79}"></div><div class="field"><label>Descrição</label><input v-model="secretForm.description" placeholder="Token do CRM de produção"></div><div class="field"><label>{{ secretForm.id ? 'Novo valor (opcional)' : 'Valor secreto' }}</label><input v-model="secretForm.value" type="password" :required="!secretForm.id" autocomplete="new-password" :placeholder="secretForm.id?'Deixe vazio para manter o atual':'Cole o segredo aqui'"></div><div class="secret-actions"><button v-if="secretForm.id" type="button" class="btn secondary" @click="resetSecret">Cancelar</button><button class="btn" :disabled="secretLoading">{{ secretLoading ? 'Protegendo…' : secretForm.id ? 'Atualizar' : 'Adicionar credencial' }}</button></div></form>
        <div class="secret-list"><div v-if="!credentials.length" class="empty compact"><b>Nenhuma credencial</b><span>Adicione somente quando uma ação precisar autenticar em outra API.</span></div><article v-for="item in credentials" v-else :key="item._id"><span>◆</span><div><b>{{ item.name }}</b><small>{{ item.description || 'Sem descrição' }}</small><em>{{ item.preview }}</em></div><button v-can-action="'web_settings.credentials'" class="icon-button" title="Editar" @click="editSecret(item)">✎</button><button v-can-action="'web_settings.credentials'" class="icon-button danger-icon" title="Apagar" @click="removeSecret(item)">×</button></article></div>
      </div>
      <p class="encryption-note">O navegador envia pelo HTTPS do ambiente, o servidor cifra com uma chave exclusiva do volume persistente e só descriptografa em memória no instante da chamada. Logs ocultam tokens, cookies e cabeçalhos sensíveis.</p>
    </article>

    <article class="card credentials-card"><div class="section-head"><span class="settings-icon">◷</span><div><h2>Agrupar mensagens antes de responder</h2><p>Debounce do bot e da IA, sem reiniciar a sessão.</p></div></div><div class="fields"><div class="field"><label for="collect-seconds">Esperar após a última mensagem (segundos)</label><input id="collect-seconds" v-model.number="collectSeconds" type="number" min="0.2" max="15" step="0.1" required></div><p>Por exemplo, com 5 segundos, “boa noite”, “tudo bem?” e “tem furadeira?” são processados juntos após 5 segundos sem novos balões. Cada mensagem reinicia a espera. Vale também para áudio e mídia, respeitando o atendimento humano.</p></div></article>

    <article class="card persistence-card"><span class="eyebrow">Infraestrutura mínima</span><h2>O que fica fora do painel?</h2><div><span><b>MongoDB</b><small>Endereço de infraestrutura para fluxos, conversas e arquivos.</small></span><span><b>Redis</b><small>Endereço de infraestrutura da fila BullMQ, com política noeviction.</small></span><span><b>Diretório persistente</b><small>Sessão QR e chave criptográfica; no Render usa o disco montado em /var/data.</small></span><span><b>Chromium</b><small>Binário instalado pela imagem Docker.</small></span></div></article>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped>
.permission-fields{border:0;padding:0;margin:0;min-width:0}.permission-fields:disabled{opacity:.85}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.settings-card,.credentials-card,.persistence-card{padding:22px}.section-head{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line)}.settings-icon{display:grid;flex:0 0 44px;width:44px;height:44px;place-items:center;border-radius:13px;color:#0b5e4f;background:#dff7f1;font-weight:800}.section-head h2,.persistence-card h2{margin:0;font:800 1.08rem Inter,'Segoe UI',sans-serif}.section-head p{margin:3px 0 0;color:#71837e;font-size:.7rem}.fields{display:grid;gap:14px;padding-top:17px}.fields.two{grid-template-columns:1fr 1fr}.color-field{display:grid;grid-template-columns:1fr 48px;gap:6px}.color-field input[type=color]{height:40px;padding:3px}.security-toggle{margin-top:17px;font-size:.72rem}.warning{padding:10px;border-radius:9px;color:#75591a;background:#fff6dc;font-size:.67rem;line-height:1.45}.credentials-card{margin-top:16px}.security-chip{margin-left:auto;padding:6px 9px;border-radius:9px;color:#176c5b;background:#e1f7f1;font-size:.6rem;font-weight:800}.credentials-layout{display:grid;grid-template-columns:340px 1fr;gap:22px;padding-top:18px}.secret-form{display:grid;gap:12px;padding:15px;border-radius:13px;background:#f5faf8}.secret-actions{display:flex;justify-content:flex-end;gap:7px}.secret-list{display:grid;align-content:start}.secret-list article{display:flex;align-items:center;gap:10px;padding:11px;border-bottom:1px solid var(--line)}.secret-list article>span{color:#18846e}.secret-list article>div{min-width:0;flex:1}.secret-list b,.secret-list small,.secret-list em{display:block}.secret-list b{font-size:.75rem}.secret-list small{margin-top:2px;color:#748681;font-size:.65rem}.secret-list em{margin-top:3px;color:#96a39f;font:normal .6rem ui-monospace,monospace}.empty.compact{min-height:140px}.danger-icon{color:#c6384e}.encryption-note{margin:18px 0 0;padding:11px;border:1px solid #cde7e0;border-radius:10px;color:#4e6962;background:#f2fbf8;font-size:.68rem;line-height:1.5}.persistence-card{margin-top:16px}.persistence-card>div{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.persistence-card>div>span{padding:13px;border-radius:11px;background:#f5faf8}.persistence-card b,.persistence-card small{display:block}.persistence-card b{font-size:.72rem}.persistence-card small{margin-top:4px;color:#73847f;font-size:.64rem;line-height:1.4}@media(max-width:1000px){.settings-grid{grid-template-columns:1fr}.credentials-layout{grid-template-columns:1fr}.persistence-card>div{grid-template-columns:1fr 1fr}}@media(max-width:600px){.fields.two,.persistence-card>div{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-wrap:wrap}.security-chip{margin-left:0}}
</style>
