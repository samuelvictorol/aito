<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth.js'
import { useWhiteLabel } from '../services/whitelabel.js'
import { errorMessage } from '../services/http.js'
import { ASSISTANT_NAME, ASSISTANT_SHORTCUTS, assistantApi, assistantAttachmentError, assistantCapabilities, assistantConfigInput, assistantTheme, formatAssistantCost, formatAssistantTokens } from '../services/admin-assistant.js'
import { assistantClipboardFiles, createAssistantAttachmentQueue } from '../services/assistant-attachments.js'
import AssistantMessage from './AssistantMessage.vue'
import AssistantActionReview from './AssistantActionReview.vue'
import AssistantFile from './AssistantFile.vue'
import AssistantIntroduction from './AssistantIntroduction.vue'

defineProps({ chatMode: Boolean })
const $q = useQuasar(), auth = useAuthStore(), { branding } = useWhiteLabel()
const canConfigure = ref(!auth.isCollaborator), canExecute = ref(!auth.isCollaborator), sharedAccount = ref(auth.isCollaborator)
const dialog = ref(false), introDialog = ref(false), settingsDialog = ref(false), logsDialog = ref(false), loadErrorDialog = ref(false), shortcutsVisible = ref(true), opening = ref(false)
const thread = ref(null), input = ref(null), fileInput = ref(null), draft = ref('')
const attachmentQueue = createAssistantAttachmentQueue({ upload: assistantApi.upload, validate: assistantAttachmentError })
const { files: attachments, uploading, error: attachmentError, progress: attachmentProgress } = attachmentQueue
const loading = ref(false), saving = ref(false), sending = ref(false), transcribing = ref(false), confirming = ref(false), error = ref(''), configError = ref(''), dragging = ref(false)
const configured = ref(false), models = ref([]), hasCustomPricing = ref(false), keySources = ref([]), sourcesLoading = ref(false), sourceError = ref(''), currentSource = ref(null)
const modelsStatus = ref('not_loaded'), modelsWarning = ref('')
const config = reactive({ apiKey: '', keyMode: 'new', keySourceId: null, model: 'gpt-6.1-sol', temperature: .7, effort: 'medium', speed: 'standard', pricing: null })
const theme = computed(() => assistantTheme(branding))
const keySourceOptions = computed(() => keySources.value.map(item => ({ ...item, value: item.id, disable: !item.available })))
const selectedKeySource = computed(() => keySources.value.find(item => item.id === config.keySourceId))
const session = reactive({ messages: [], events: [], usage: {}, pendingActions: [], files: [], running: false, progress: 0 })
const priceInput = reactive({ enabled: false, input: '', output: '', cached: '' })
const recording = ref(false), recordSeconds = ref(0)
const recordingSupported = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
const allEfforts = [{value:'low',label:'Baixo'},{value:'medium',label:'Médio'},{value:'high',label:'Alto'},{value:'xhigh',label:'Extra alto'},{value:'max',label:'Máximo'}]
const effortOptions = computed(() => /^gpt-6/.test(config.model) ? allEfforts : allEfforts.slice(0,3))
const modelOptions = computed(() => models.value.map(item => typeof item === 'string' ? {label:item,value:item} : {label:item.label||item.id,value:item.id}))
const effortIndex = computed({get:()=>Math.max(0,effortOptions.value.findIndex(item=>item.value===config.effort)),set:value=>{config.effort=effortOptions.value[value].value}})
const busy = computed(() => sending.value || uploading.value || transcribing.value || confirming.value || session.running)
const pending = computed(() => session.pendingActions.filter(action=>['pending','executing','failed'].includes(action.status)))
const lastEvent = computed(() => session.events.at(-1))
const progress = computed(() => Math.max(0,Math.min(100,Number(session.progress || lastEvent.value?.progress || 0))))
const generatedFiles = computed(() => session.files.filter(file=>!session.messages.some(message=>message.attachments?.some(item=>item.id===file.id))))
const selectedModel = computed(() => modelOptions.value.find(item=>item.value===config.model)?.label || config.model)
const usesReasoning = computed(() => /^gpt-[5-9]/.test(config.model))
const currentEffort = computed(() => effortOptions.value.find(item=>item.value===config.effort)?.label || 'Médio')
const estimatedUsd = computed(() => formatAssistantCost(session.usage.estimatedUsd))
let timer, pollVersion = 0, destroyed = false, recorder, recorderStream, recordingTimer, recorderCancelled = false

function applyConfig(value) {
  configured.value=Boolean(value.configured);models.value=value.models||[]
  const grants=assistantCapabilities(value,auth.user?.role);sharedAccount.value=grants.sharedAccount;canConfigure.value=grants.canConfigure;canExecute.value=grants.canExecute
  modelsStatus.value=value.modelsStatus||'not_loaded';modelsWarning.value=value.modelsWarning||''
  for(const key of ['model','temperature','effort','speed','pricing'])if(value[key]!==undefined)config[key]=value[key]
  config.apiKey='';config.keyMode='new';config.keySourceId=null;currentSource.value=value.keySource||null;hasCustomPricing.value=Boolean(value.customPricing);priceInput.enabled=hasCustomPricing.value;priceInput.input=value.pricing?.inputPerMillion??'';priceInput.output=value.pricing?.outputPerMillion??'';priceInput.cached=value.pricing?.cachedInputPerMillion??''
  if(!configured.value){dialog.value=false;logsDialog.value=false;clearTimeout(timer);pollVersion++;cancelRecording()}
}
async function scrollBottom(force=false) {
  await nextTick();const el=thread.value;if(el&&(force||el.scrollHeight-el.clientHeight-el.scrollTop<180))el.scrollTo({top:el.scrollHeight,behavior:'smooth'})
}
async function loadConfig(refresh=false) {
  configError.value=''
  try { applyConfig(await assistantApi.config(refresh));return true } catch(cause){configError.value=errorMessage(cause);return false}
}
async function loadSources() {
  sourcesLoading.value=true;sourceError.value=''
  try{keySources.value=(await assistantApi.keySources()).items||[]}catch(cause){sourceError.value=errorMessage(cause,'Não foi possível listar as chaves cadastradas.')}finally{sourcesLoading.value=false}
}
function openSettings(){if(!canConfigure.value)return;introDialog.value=false;settingsDialog.value=true;loadSources()}
async function enterChat(){
  if(!configured.value)return
  introDialog.value=false;dialog.value=true;loading.value=true
  await loadState();loading.value=false;await scrollBottom(true);poll()
}
async function loadState() {
  if(!configured.value)return
  const version=++pollVersion
  try {
    const value=await assistantApi.state();if(destroyed||version!==pollVersion)return
    Object.assign(session,{messages:[],events:[],usage:{},pendingActions:[],files:[],running:false,progress:0},value)
    error.value=value.error||'';scrollBottom()
  } catch(cause) { if(version===pollVersion)error.value=errorMessage(cause,'Não foi possível atualizar a conversa.') }
}
async function poll() {
  clearTimeout(timer);if(!configured.value||(!dialog.value&&!session.running)||destroyed)return
  if(!document.hidden)await loadState()
  if((dialog.value||session.running)&&!destroyed)timer=setTimeout(poll,dialog.value?(session.running?1000:3000):5000)
}
async function open() {
  if(opening.value)return
  opening.value=true;error.value=''
  const loaded=await loadConfig()
  if(!loaded)loadErrorDialog.value=true
  else if(configured.value)await enterChat()
  else introDialog.value=true
  opening.value=false
}
async function retryOpen(){loadErrorDialog.value=false;await open()}
async function saveConfig() {
  if(!canConfigure.value)return
  saving.value=true;configError.value=''
  try {
    if(!configured.value&&config.keyMode==='new'&&!config.apiKey.trim())throw Error('Informe uma nova chave OpenAI ou importe uma chave cadastrada.')
    const payload=assistantConfigInput(config,priceInput,hasCustomPricing.value)
    applyConfig(await assistantApi.saveConfig(payload));if(!configured.value)throw Error('Configure uma chave OpenAI para liberar o agente.')
    settingsDialog.value=false;if(!dialog.value)await enterChat()
    $q.notify({type:'positive',message:'Configuração da Aito I.A salva.',position:'bottom',timeout:1500})
  } catch(cause) {configError.value=errorMessage(cause)} finally{saving.value=false}
}
async function savePreference() {
  if(!configured.value||!canConfigure.value)return
  try{await assistantApi.saveConfig({model:config.model,effort:config.effort,speed:config.speed})}catch(cause){error.value=errorMessage(cause)}
}
async function refreshModels() {if(!canConfigure.value)return;saving.value=true;await loadConfig(true);saving.value=false}
function removeKey() {
  if(!canConfigure.value)return
  $q.dialog({title:'Remover a chave da Aito I.A?',message:'O agente ficará sem acesso à OpenAI até uma nova chave ser configurada. As configurações dos canais serão mantidas.',cancel:{label:'Manter chave',flat:true},ok:{label:'Remover chave',color:'negative'}}).onOk(async()=>{
    saving.value=true;configError.value=''
    try{applyConfig(await assistantApi.saveConfig({apiKey:null}))}catch(cause){configError.value=errorMessage(cause)}finally{saving.value=false}
  })
}
function chooseShortcut(item) {if(!configured.value||!dialog.value)return;draft.value=item.prompt;nextTick(()=>input.value?.focus());scrollBottom(true)}
async function send() {
  if(busy.value||(!draft.value.trim()&&!attachments.value.length))return
  if(!configured.value||!dialog.value)return
  sending.value=true;error.value=''
  try {
    await assistantApi.message({text:draft.value.trim(),attachmentIds:attachments.value.map(file=>file.id)})
    draft.value='';attachmentQueue.clear();session.running=true;if($q.screen.lt.md)shortcutsVisible.value=false;await loadState();await scrollBottom(true)
  }catch(cause){error.value=errorMessage(cause)}finally{sending.value=false;poll()}
}
function keyDown(event) {if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&$q.screen.gt.sm){event.preventDefault();send()}}
async function attachFiles(files) {
  dragging.value=false
  if(!configured.value||!dialog.value)return
  if(sending.value||transcribing.value||confirming.value||session.running||recording.value){attachmentError.value='Aguarde a solicitação atual terminar antes de anexar arquivos.';return}
  try{await attachmentQueue.enqueue(files)}finally{if(fileInput.value)fileInput.value.value=''}
}
function pasteFiles(event) {
  const files=assistantClipboardFiles(event.clipboardData)
  if(!files.length)return
  // Keep the browser's normal text insertion when a clipboard contains both text and files.
  if(!event.clipboardData?.getData('text/plain'))event.preventDefault()
  void attachFiles(files)
}
function dragOver(event) {if(Array.from(event.dataTransfer?.types||[]).includes('Files')){event.preventDefault();dragging.value=true}}
function drop(event) {const files=event.dataTransfer?.files;if(!files?.length)return;event.preventDefault();void attachFiles(files)}
function fileSize(size) {return Number(size)>=1048576?`${(size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.ceil(Number(size||0)/1024))} KB`}
async function confirmAction(value) {
  if(!canExecute.value)return
  if(!configured.value||!dialog.value)return
  confirming.value=true;error.value=''
  try{await assistantApi.confirm(value);session.running=true;await loadState();await scrollBottom(true)}catch(cause){error.value=errorMessage(cause)}finally{confirming.value=false;poll()}
}
async function cancelAction(action) {
  if(!configured.value||!dialog.value)return
  confirming.value=true;error.value=''
  try{await assistantApi.reject(action.id);await loadState()}catch(cause){error.value=errorMessage(cause)}finally{confirming.value=false}
}
async function reviseAction(action) {await cancelAction(action);if(!error.value){draft.value='Quero ajustar a ação “'+action.title+'”: ';await nextTick();input.value?.focus()}}
function clearContext() {
  if(!configured.value||!dialog.value)return
  $q.dialog({title:'Limpar a conversa com Aito I.A?',message:'O contexto, os arquivos e as ações pendentes desta conversa serão descartados. Sua chave, modelo e preferências continuam salvos. As ações já executadas no sistema não serão desfeitas.',cancel:{label:'Manter conversa',flat:true},ok:{label:'Limpar contexto',color:'negative'}}).onOk(async()=>{
    loading.value=true;try{await assistantApi.clear();draft.value='';attachmentQueue.clear();await loadState()}catch(cause){error.value=errorMessage(cause)}finally{loading.value=false}
  })
}
async function transcribe(file) {
  if(!configured.value||!dialog.value)return
  transcribing.value=true;error.value=''
  try{const result=await assistantApi.transcribe(file);draft.value=[draft.value.trim(),result.text].filter(Boolean).join('\n');await nextTick();input.value?.focus();await loadState()}catch(cause){error.value=errorMessage(cause)}finally{transcribing.value=false}
}
function releaseRecorder() {clearInterval(recordingTimer);recorderStream?.getTracks().forEach(track=>track.stop());recorderStream=null;recording.value=false}
async function toggleRecording() {
  if(recording.value){recorder?.stop();return}
  if(!configured.value||!dialog.value||busy.value)return
  try{
    recorderCancelled=false;recorderStream=await navigator.mediaDevices.getUserMedia({audio:true})
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type))
    recorder=new MediaRecorder(recorderStream,mime?{mimeType:mime}:undefined);const chunks=[]
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)}
    recorder.onstop=()=>{const type=recorder.mimeType||'audio/webm';releaseRecorder();if(!destroyed&&!recorderCancelled&&chunks.length){const extension=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';transcribe(new File(chunks,'gravacao.'+extension,{type}))}}
    recorder.onerror=()=>{recorderCancelled=true;releaseRecorder();error.value='Não foi possível gravar. Tente novamente.'}
    recording.value=true;recordSeconds.value=0;recorder.start(1000);recordingTimer=setInterval(()=>{recordSeconds.value++;if(recordSeconds.value>=120)recorder.stop()},1000)
  }catch(cause){releaseRecorder();error.value=cause.name==='NotAllowedError'?'Permita o microfone neste navegador para ditar uma mensagem.':errorMessage(cause,'Não foi possível acessar o microfone.')}
}
function cancelRecording(){recorderCancelled=true;if(recorder?.state==='recording')recorder.stop();releaseRecorder()}
watch(() => config.model, () => { if (!effortOptions.value.some(item => item.value === config.effort)) config.effort = 'medium' })
watch(dialog,value=>{if(!value){clearTimeout(timer);pollVersion++;cancelRecording();if(session.running)timer=setTimeout(poll,5000)}})
watch(()=>config.keyMode,()=>{config.apiKey='';config.keySourceId=null})
watch(settingsDialog,value=>{if(!value)config.apiKey=''})
onBeforeUnmount(()=>{destroyed=true;clearTimeout(timer);pollVersion++;cancelRecording();attachmentQueue.dispose()})
</script>

<template>
  <button v-if="!dialog&&!introDialog&&!settingsDialog" class="aito-assistant-float" :class="{'aito-assistant-float--chat':chatMode}" type="button" aria-label="Abrir Aito I.A" :disabled="opening" @click="open"><q-spinner v-if="opening" color="white"/><img v-else src="/comunicacao/app/ia.gif" alt=""/><i v-if="session.running"/><q-tooltip>Aito I.A · seu agente do {{branding.appName}}</q-tooltip></button>
  <q-dialog v-model="introDialog" :maximized="$q.screen.lt.sm"><AssistantIntroduction :app-name="branding.appName" :can-configure="canConfigure" :shared-account="sharedAccount" :style="theme" :error="configError" @configure="openSettings" @retry="loadConfig" @close="introDialog=false"/></q-dialog>
  <q-dialog v-model="loadErrorDialog"><q-card class="aito-config-unavailable aito-assistant-shell" :style="theme"><q-card-section><q-icon name="cloud_off" size="36px"/><h2>Não foi possível consultar o agente</h2><p>Isso não significa que sua configuração foi apagada. Tente novamente para carregar a chave e as preferências já salvas.</p><q-banner rounded class="aito-error" role="alert">{{configError}}</q-banner></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Fechar" v-close-popup/><q-btn class="aito-primary" unelevated no-caps icon="refresh" label="Tentar novamente" :loading="opening" @click="retryOpen"/></q-card-actions></q-card></q-dialog>
  <q-dialog v-if="configured" v-model="dialog" persistent no-shake :maximized="$q.screen.lt.md" transition-show="slide-up" transition-hide="slide-down">
    <q-card class="aito-assistant-shell" :style="theme" @paste="pasteFiles" @dragover="dragOver" @dragleave.self="dragging=false" @drop="drop">
      <header class="aito-assistant-header"><img src="/comunicacao/app/ia.gif" alt=""/><div><strong>{{ASSISTANT_NAME}}</strong><span>Seu agente do {{branding.appName}}</span></div><nav><q-btn flat round dense aria-label="Nova conversa e limpar contexto" :disable="busy" @click="clearContext"><svg class="aito-new-conversation-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 10a9 9 0 1 1 2.6 8.4"/><path d="M3 4v6h6"/></svg><q-tooltip>Nova conversa · limpar contexto</q-tooltip></q-btn><q-btn flat round dense aria-label="Logs e consumo" @click="logsDialog=true"><svg class="aito-header-action-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 3v17h17"/><path d="M8 16v-5m5 5V6m5 10v-8"/></svg><q-tooltip>Logs e consumo</q-tooltip></q-btn><q-btn v-if="canConfigure" flat round dense icon="tune" aria-label="Configurar Aito I.A" @click="openSettings"><q-tooltip>Configurações</q-tooltip></q-btn><q-btn flat round dense icon="close" aria-label="Minimizar Aito I.A" v-close-popup/></nav></header>
      <div v-if="loading" class="aito-initial-loading"><q-spinner color="primary"/> Preparando seu espaço…</div>
      <div v-else ref="thread" class="aito-assistant-thread"><q-banner v-if="sharedAccount" dense rounded class="aito-shared-account" role="status"><template #avatar><q-icon name="policy"/></template>Você usa a conta OpenAI configurada pela administração. {{canExecute?'Ações seguem suas permissões e exigem revisão.':'Seu acesso permite conversar e consultar dados autorizados, sem executar alterações.'}}</q-banner>
        <section v-if="!session.messages.length" class="aito-assistant-welcome"><span class="aito-welcome-mark"><q-icon name="auto_awesome"/></span><div class="aito-eyebrow">PENSE. CRIE. RESOLVA.</div><h2>O que vamos fazer<br/>no {{branding.appName}}?</h2><p>Transforme ideias, prints e instruções em configurações, fluxos e notificações. Eu preparo o trabalho; você revisa as ações antes de executar.</p></section>
        <AssistantMessage v-for="message in session.messages" :key="message.id" :message="message"/>
        <section v-if="generatedFiles.length" class="aito-generated"><h3><q-icon name="folder_open"/> Arquivos desta conversa</h3><div><AssistantFile v-for="file in generatedFiles" :key="file.id" :file="file"/></div></section>
        <AssistantActionReview v-for="action in pending" :key="action.id" :action="action" :busy="busy" :execute-allowed="canExecute" @confirm="confirmAction" @cancel="cancelAction" @revise="reviseAction"/>
        <div v-if="session.running" class="aito-running" role="status"><div><q-spinner-dots size="24px" color="primary"/><span>{{lastEvent?.message||'Analisando a solicitação…'}}</span><button type="button" @click="logsDialog=true">Acompanhar</button></div><q-linear-progress :value="progress/100" :indeterminate="!progress" color="primary" track-color="grey-2" rounded/></div>
        <q-banner v-if="error" rounded class="aito-error" role="alert"><template #avatar><q-icon name="info_outline"/></template>{{error}}<template #action><q-btn flat dense no-caps label="Atualizar" @click="loadState"/></template></q-banner>
      </div>
      <section class="aito-composer-area">
        <button class="aito-shortcuts-toggle" type="button" @click="shortcutsVisible=!shortcutsVisible"><q-icon name="bolt"/> Atalhos para começar <q-icon :name="shortcutsVisible?'expand_less':'expand_more'"/></button>
        <div v-if="shortcutsVisible" class="aito-shortcuts"><button v-for="item in ASSISTANT_SHORTCUTS" :key="item.id" type="button" :disabled="busy" @click="chooseShortcut(item)"><q-icon :name="item.icon"/><span>{{item.label}}</span><q-tooltip>{{item.description}}</q-tooltip></button></div>
        <div class="aito-composer" :class="{'aito-composer--drag':dragging}">
          <div v-if="attachments.length" class="aito-attachment-heading"><span>{{attachments.length}} / 8 anexos</span><small>Enviados juntos com sua próxima mensagem</small></div>
          <div v-if="attachments.length" class="aito-draft-files"><article v-for="file in attachments" :key="file.id" class="aito-draft-file"><img v-if="file.previewUrl" :src="file.previewUrl" :alt="file.name"/><q-icon v-else :name="file.kind==='image'?'image':'description'" size="26px"/><div><strong :title="file.name">{{file.name}}</strong><small>{{fileSize(file.size)}}</small></div><q-btn flat round dense icon="close" :disable="busy" :aria-label="'Remover anexo '+file.name" @click="attachmentQueue.remove(file.id)"/></article></div>
          <div v-if="uploading" class="aito-upload-progress" role="status"><q-spinner size="14px"/><span>Anexando {{Math.min(attachmentProgress.completed+1,attachmentProgress.total)}} de {{attachmentProgress.total}} arquivo(s)…</span></div>
          <p v-if="attachmentError" class="aito-attachment-error" role="alert">{{attachmentError}}</p>
          <div v-if="recording" class="aito-recording"><span/><strong>Gravando {{Math.floor(recordSeconds/60)}}:{{String(recordSeconds%60).padStart(2,'0')}}</strong><q-btn flat dense no-caps label="Descartar" @click="cancelRecording"/><q-btn unelevated dense no-caps class="aito-primary" icon="stop" label="Transcrever" @click="toggleRecording"/></div>
          <q-input v-else ref="input" v-model="draft" type="textarea" autogrow borderless :disable="sending||transcribing" :placeholder="configured?'Peça algo, cole prints ou anexe vários arquivos…':'Conecte sua chave OpenAI para começar…'" maxlength="30000" aria-label="Mensagem para Aito I.A" @keydown="keyDown"/>
          <div class="aito-composer-controls"><input ref="fileInput" type="file" hidden multiple accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.json,.docx,.xlsx,.pptx,.html,.css" @change="attachFiles($event.target.files)"/><q-btn flat round dense icon="add" :loading="uploading" :disable="busy||recording" aria-label="Anexar arquivos ou prints" @click="fileInput?.click()"><q-tooltip>Selecionar vários arquivos · até 8 por mensagem, 20 MB cada e 40 MB por conversa</q-tooltip></q-btn><q-btn v-if="recordingSupported" flat round dense :icon="recording?'stop':'mic_none'" :loading="transcribing" :disable="busy" aria-label="Ditar mensagem" @click="toggleRecording"><q-tooltip>Ditar e revisar antes de enviar</q-tooltip></q-btn><q-space/><q-btn v-if="!configured" flat no-caps dense icon="key" label="Conectar chave" @click="openSettings"/><template v-else-if="canConfigure"><q-btn flat dense no-caps icon="bolt" :label="currentEffort" v-if="usesReasoning" class="aito-effort-button" :disable="busy"><q-popup-proxy class="aito-effort-popup" :style="theme"><section><strong>{{currentEffort}}</strong><small>{{selectedModel}}</small><q-slider v-model="effortIndex" :min="0" :max="effortOptions.length-1" :step="1" markers color="primary" @change="savePreference"/><div><span>Mais rápido</span><span>Mais profundo</span></div></section></q-popup-proxy></q-btn><q-btn flat dense round icon="expand_more" aria-label="Escolher modelo" @click="openSettings"/></template><span v-else class="aito-assigned-model">{{selectedModel}}</span><q-btn round unelevated class="aito-primary" icon="arrow_upward" :disable="busy||recording||(!draft.trim()&&!attachments.length)" :loading="sending" aria-label="Enviar para Aito I.A" @click="send"/></div>
          <p v-if="!recording" class="aito-attachment-hint">Cole imagens (Ctrl+V), arraste ou selecione até 8 arquivos. Até 20 MB por arquivo e 40 MB por conversa.</p>
        </div>
        <footer><span>{{transcribing?'Transcrevendo áudio para você revisar…':recording?'Até 2 minutos de áudio por gravação.':'Contexto temporário no Redis. Ações reais exigem sua revisão.'}}</span><span v-if="session.usage.totalTokens" class="aito-composer-cost" @click="logsDialog=true">{{formatAssistantTokens(session.usage.totalTokens)}} tokens</span></footer>
      </section>
      <div v-if="dragging" class="aito-drop-overlay" @dragover.prevent @dragleave.prevent="dragging=false" @drop.stop="drop"><q-icon name="cloud_upload" size="60px"/><strong>Solte seus arquivos aqui</strong><span>Até 8 prints e documentos na mesma mensagem</span></div>
    </q-card>
  </q-dialog>

  <q-dialog v-if="canConfigure" v-model="settingsDialog" :maximized="$q.screen.lt.sm">
    <q-card class="aito-settings aito-assistant-shell" :style="theme">
      <header><div><strong>Configurar Aito I.A</strong><span>Escolha como conectar a inteligência ao seu {{branding.appName}}.</span></div><q-btn flat round dense icon="close" aria-label="Fechar configurações" v-close-popup/></header>
      <q-form @submit="saveConfig">
        <q-card-section>
          <q-banner v-if="configError" rounded class="aito-error" role="alert">{{configError}}</q-banner>
          <div class="aito-key-methods" aria-label="Origem da chave OpenAI">
            <button type="button" :class="{'is-selected':config.keyMode==='new'}" @click="config.keyMode='new'"><q-icon name="add_circle_outline"/><strong>{{configured?'Manter ou trocar chave':'Adicionar nova chave'}}</strong><small>Usar um token da sua conta OpenAI</small></button>
            <button type="button" :class="{'is-selected':config.keyMode==='import'}" @click="config.keyMode='import'"><q-icon name="key"/><strong>Importar chave cadastrada</strong><small>Reutilizar uma integração deste sistema</small></button>
          </div>
          <template v-if="config.keyMode==='new'">
            <q-input v-model="config.apiKey" outlined type="password" autocomplete="new-password" label="OpenAI API token" :placeholder="configured?'Deixe vazio para manter a chave atual':'sk-…'" :hint="configured?'Uma chave já está configurada. Preencha somente para substituir.':'Use uma chave da sua conta OpenAI com saldo e acesso aos modelos desejados.'"/>
            <div v-if="configured" class="aito-current-key"><q-icon name="verified_user"/><span>{{currentSource?'Chave importada de '+currentSource.label:'Chave própria configurada'}} · protegida</span></div>
          </template>
          <section v-else class="aito-key-import">
            <q-select v-model="config.keySourceId" outlined emit-value map-options :options="keySourceOptions" :loading="sourcesLoading" label="Chave OpenAI já cadastrada" :disable="sourcesLoading" clearable>
              <template #option="scope"><q-item v-bind="scope.itemProps"><q-item-section avatar><q-icon name="key"/></q-item-section><q-item-section><q-item-label>{{scope.opt.label}}</q-item-label><q-item-label caption>{{scope.opt.description}}</q-item-label></q-item-section><q-item-section side><q-icon :name="scope.opt.available?'lock':'key_off'"/></q-item-section></q-item></template>
              <template #no-option><q-item><q-item-section>Nenhuma chave disponível. Cadastre uma no WhatsApp Web → Integrações → OpenAI ou adicione uma nova chave aqui.</q-item-section></q-item></template>
            </q-select>
            <q-banner v-if="sourceError" rounded class="aito-error" role="alert">{{sourceError}}<template #action><q-btn flat no-caps dense label="Tentar novamente" @click="loadSources"/></template></q-banner>
            <p v-if="selectedKeySource" class="aito-source-description">{{selectedKeySource.description}}</p>
            <div class="aito-privacy-note"><q-icon name="lock"/><p>A chave é copiada e criptografada no servidor. Seu valor não é exibido no navegador nem no chat. A integração original continua funcionando de forma independente.</p></div>
          </section>
          <q-btn v-if="configured" flat dense no-caps color="negative" icon="key_off" label="Remover chave configurada" class="aito-key-remove" :disable="saving||busy" @click="removeKey"/>
          <q-banner v-if="modelsWarning" rounded class="aito-model-notice" role="status"><template #avatar><q-icon name="info_outline"/></template>{{modelsWarning}}</q-banner>
          <div class="aito-settings-row"><q-select v-model="config.model" outlined emit-value map-options :options="modelOptions" label="Modelo"/><q-btn flat dense no-caps icon="refresh" label="Atualizar modelos" :loading="saving" :disable="!configured||!!config.apiKey.trim()||config.keyMode==='import'" @click="refreshModels"/></div>
          <p v-if="configured&&modelsStatus==='not_loaded'" class="aito-source-description">Modelo salvo preservado. Use “Atualizar modelos” para consultar as opções disponíveis na sua conta OpenAI.</p>
          <q-input v-if="!usesReasoning" v-model.number="config.temperature" outlined type="number" min="0" max="2" step="0.1" label="Temperatura" hint="Menor para respostas mais consistentes; maior para mais variação."/>
          <q-select v-else v-model="config.effort" outlined emit-value map-options :options="effortOptions" label="Nível de esforço" hint="Maior esforço pode consumir mais tempo e tokens."/>
          <q-select v-model="config.speed" outlined emit-value map-options :options="[{label:'Padrão',value:'standard'},{label:'Prioridade',value:'priority'}]" label="Processamento" hint="Prioridade depende do modelo e pode ter um preço diferente na OpenAI."/>
          <q-expansion-item icon="paid" label="Estimativa de custo em dólar" caption="Opcional · preços por milhão de tokens"><div class="aito-pricing"><q-toggle v-model="priceInput.enabled" color="primary" label="Estimar com os preços informados"/><template v-if="priceInput.enabled"><q-input v-model="priceInput.input" outlined type="number" min="0" step="any" label="Entrada · US$/1M"/><q-input v-model="priceInput.cached" outlined type="number" min="0" step="any" label="Entrada em cache · US$/1M"/><q-input v-model="priceInput.output" outlined type="number" min="0" step="any" label="Saída · US$/1M"/></template><p>O consumo de tokens é informado pela API. Valores estimados podem não incluir imagens, ferramentas, transcrições e outras cobranças. Consulte a fatura da OpenAI para o total final.</p></div></q-expansion-item>
          <div class="aito-privacy-note"><q-icon name="verified_user"/><p>Sua chave, inclusive quando importada, modelo e preferências ficam salvos nesta instalação e permanecem após deploys. Limpar a conversa remove somente o contexto temporário, anexos e ações pendentes. As chaves ficam criptografadas no servidor e trafegam por conexão segura.</p></div>
        </q-card-section>
        <q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup/><q-btn class="aito-primary" no-caps unelevated type="submit" :label="configured?'Salvar configuração':'Salvar e abrir agente'" :loading="saving" :disable="config.keyMode==='import'&&!config.keySourceId"/></q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>

  <q-dialog v-if="configured" v-model="logsDialog" :maximized="$q.screen.lt.md"><q-card class="aito-logs aito-assistant-shell" :style="theme"><header><div><strong>Atividade e consumo</strong><span>Aito I.A · atividade da conversa e consumo deste usuário</span></div><q-btn flat round dense icon="refresh" aria-label="Atualizar atividade" @click="loadState"/><q-btn flat round dense icon="close" aria-label="Fechar atividade" v-close-popup/></header><div class="aito-usage"><article><small>Total de tokens</small><strong>{{formatAssistantTokens(session.usage.totalTokens)}}</strong><span>{{formatAssistantTokens(session.usage.cachedTokens)}} em cache</span></article><article><small>Entrada / saída</small><strong>{{formatAssistantTokens(session.usage.inputTokens)}} / {{formatAssistantTokens(session.usage.outputTokens)}}</strong><span>Consumo retornado pela API</span></article><article><small>Estimativa em US$</small><strong>{{estimatedUsd}}</strong><span>{{session.usage.unpricedCalls?session.usage.unpricedCalls+' chamada(s) sem estimativa':'Estimativa de texto; confira os detalhes'}}</span></article></div><section class="aito-logs-progress"><div><span>{{session.running?'Trabalhando…':'Aguardando sua próxima solicitação'}}</span><b>{{progress}}%</b></div><q-linear-progress :value="progress/100" :indeterminate="session.running&&!progress" color="primary" rounded/></section><div class="aito-event-list"><article v-for="event in session.events.slice().reverse()" :key="event.id" :class="'aito-event--'+event.level"><q-icon :name="event.level==='error'?'error_outline':event.level==='success'?'check_circle':event.level==='warning'?'warning_amber':'fiber_manual_record'"/><div><span>{{event.message}}</span><time>{{new Date(event.at).toLocaleString('pt-BR')}}</time></div></article><p v-if="!session.events.length">As etapas das solicitações aparecerão aqui.</p></div><footer class="aito-log-note">O consumo fica registrado para este usuário mesmo ao limpar o contexto. A auditoria das ações executadas segue a retenção do sistema. Tokens e estimativas não representam a fatura da OpenAI.</footer></q-card></q-dialog>
</template>

<style scoped>
.aito-new-conversation-icon,.aito-header-action-icon{display:block;width:22px;height:22px;flex:none;overflow:visible}

.aito-shared-account{background:var(--aito-tint);color:var(--aito-text);font-size:11px;line-height:1.7;margin-bottom:16px}.aito-shared-account .q-icon{color:var(--aito-accent)}.aito-assigned-model{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--aito-muted)}

.aito-config-unavailable{width:520px;height:auto;max-height:90dvh}.aito-config-unavailable h2{font-size:21px;font-weight:700;line-height:1.4;margin:16px 0 10px}.aito-config-unavailable p{font-size:13px;line-height:1.7;color:var(--aito-muted)}.aito-config-unavailable>.q-card__section{padding:24px}.aito-config-unavailable>.q-card__actions{padding:16px 24px;border-top:1px solid var(--aito-line)}.aito-config-unavailable>.q-card__section>.q-icon{color:var(--aito-accent)}.aito-model-notice{background:#fff6e6;color:#755323;border:1px solid #e6d6b6;font-size:12px;line-height:1.7}
.aito-assistant-float{position:fixed;right:20px;bottom:calc(42px + env(safe-area-inset-bottom,0px));z-index:1800;display:grid;width:4.15rem;height:4.15rem;padding:0;border:1px solid #13bc9d8c;border-radius:1.15rem;place-items:center;background:linear-gradient(135deg,#13bc9d,#12ad89);box-shadow:0 15px 40px #13bc9d57;cursor:pointer;transition:transform .2s,box-shadow .2s}.aito-assistant-float>img{width:3rem;height:3rem;object-fit:contain}.aito-assistant-float>i{position:absolute;right:5px;top:5px;width:10px;height:10px;background:#42cca4;border-radius:50%;box-shadow:0 0 0 4px #42cca425;animation:aito-pulse 1.5s infinite}.aito-assistant-float:focus-visible{outline:3px solid var(--brand);border-radius:18px}
.aito-assistant-float.aito-assistant-float--chat{bottom:calc(140px + env(safe-area-inset-bottom,0px))}
.aito-assistant-shell{background:var(--aito-background);color:var(--aito-text);border:1px solid var(--aito-line);border-radius:22px;box-shadow:0 30px 100px #101b2355;display:flex;flex-direction:column;width:1040px;max-width:96vw;height:min(88dvh,1000px);max-height:94dvh;overflow:hidden;font-family:Inter,"Segoe UI",sans-serif}.aito-assistant-header{display:flex;gap:12px;align-items:center;padding:15px 22px;border-bottom:1px solid var(--aito-line);flex:none}.aito-assistant-header>img{width:48px;height:48px;object-fit:contain}.aito-assistant-header>div{flex:1;min-width:0}.aito-assistant-header strong{display:block;font-size:18px;letter-spacing:-.5px}.aito-assistant-header>div>span{display:block;color:var(--aito-muted);font-size:11px;margin-top:4px}.aito-assistant-header nav{display:flex;gap:4px;flex-shrink:0}.aito-assistant-header .q-btn{color:var(--aito-muted);min-width:40px;min-height:40px}.aito-assistant-thread{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:15px clamp(20px,5vw,75px) 30px;scrollbar-width:thin;scrollbar-color:var(--aito-line) transparent}.aito-assistant-welcome{text-align:center;max-width:570px;margin:40px auto 30px}.aito-welcome-mark{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 22px;border-radius:18px;background:linear-gradient(145deg,#6ce7c626,#94b4ff1c);border:1px solid #74d8bf30;color:var(--aito-accent);font-size:28px}.aito-eyebrow{font-size:9px;letter-spacing:3px;color:var(--aito-accent);font-weight:800}.aito-assistant-welcome h2{font-size:clamp(24px,4vw,36px);line-height:1.3;font-weight:600;letter-spacing:-1.3px;margin:15px 0}.aito-assistant-welcome p{font-size:13px;color:var(--aito-muted);line-height:1.8;margin:0}.aito-initial-loading{flex:1;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;color:var(--aito-muted)}
.aito-composer-area{flex:none;padding:8px clamp(16px,4vw,42px) 12px;background:var(--aito-background)}.aito-shortcuts-toggle{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:var(--aito-muted);font-size:10px;cursor:pointer;padding:0 0 10px}.aito-shortcuts-toggle>.q-icon:first-child{color:var(--aito-accent)}.aito-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 12px}.aito-shortcuts>button{display:flex;align-items:center;gap:7px;min-width:0;border:1px solid var(--aito-line);border-radius:9px;background:transparent;color:var(--aito-muted);padding:9px 10px;font-size:11px;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}.aito-shortcuts>button:hover{background:var(--aito-tint);border-color:var(--aito-accent)}.aito-shortcuts>button:disabled{opacity:.4;cursor:default}.aito-shortcuts .q-icon{font-size:16px;color:var(--aito-accent)}.aito-shortcuts span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aito-composer{padding:8px 12px 10px;border:1px solid var(--aito-line);background:var(--aito-panel);border-radius:20px;box-shadow:0 2px 16px #00000015}.aito-composer:focus-within{border-color:var(--aito-accent)}.aito-composer :deep(.q-field__control){min-height:58px;padding:4px 7px}.aito-composer :deep(textarea){font-size:14px!important;line-height:1.65!important;max-height:180px!important;color:var(--aito-text)}.aito-composer-controls{display:flex;align-items:center;gap:5px;margin-top:4px}.aito-composer-controls .q-btn{color:var(--aito-muted)}.aito-primary{background:var(--aito-accent)!important;color:white!important}.aito-effort-button{font-size:11px}.aito-composer-area>footer{display:flex;justify-content:space-between;gap:10px;margin-top:8px;color:var(--aito-muted);font-size:9px;text-align:center}.aito-composer-cost{cursor:pointer;white-space:nowrap;color:var(--aito-accent)}.aito-draft-files{display:flex;flex-wrap:wrap;gap:4px;padding:4px}.aito-draft-files .q-chip{background:var(--aito-tint);color:var(--aito-text);max-width:100%;font-size:10px}.aito-draft-files :deep(.q-chip__content){display:block;overflow:hidden;text-overflow:ellipsis}.aito-running{margin:18px 0}.aito-running>div:first-child{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--aito-muted);margin-bottom:10px}.aito-running span{flex:1}.aito-running button{border:0;background:none;color:var(--aito-accent);font-size:11px;cursor:pointer}.aito-error{background:#fff0ee;color:#8c302a;font-size:12px;margin-top:12px;border:1px solid #efc7c2}.aito-error :deep(.q-banner__avatar){min-width:30px}.aito-generated{margin:20px 0}.aito-generated h3{font-size:13px;font-weight:600}.aito-generated h3 .q-icon{margin-right:6px;color:var(--aito-accent)}.aito-generated>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.aito-drop-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:15px;background:#f1fffbef;backdrop-filter:blur(8px);border:2px dashed var(--aito-accent);color:var(--aito-text);border-radius:20px}.aito-drop-overlay strong{font-size:24px}.aito-drop-overlay span{font-size:13px}.aito-recording{display:flex;align-items:center;gap:10px;padding:14px 7px;font-size:12px}.aito-recording>span{width:9px;height:9px;background:#b23939;border-radius:50%;animation:aito-pulse 1s infinite}.aito-recording strong{flex:1}.aito-recording .q-btn{font-size:10px}
.aito-effort-popup{background:var(--aito-background)!important;color:var(--aito-text)!important;border:1px solid var(--aito-line)!important;border-radius:14px!important;min-width:290px}.aito-effort-popup section{padding:18px 22px}.aito-effort-popup strong,.aito-effort-popup small{display:block;text-align:center}.aito-effort-popup strong{color:var(--aito-accent);font-size:16px}.aito-effort-popup small{font-size:12px;color:var(--aito-muted);margin-top:5px}.aito-effort-popup section>div{display:flex;justify-content:space-between;color:var(--aito-muted);font-size:9px}
.aito-settings,.aito-logs{width:660px;height:auto;max-height:90dvh;border-radius:20px}.aito-settings>header,.aito-logs>header{display:flex;gap:10px;align-items:center;padding:20px 22px;border-bottom:1px solid var(--aito-line);flex:none}.aito-settings>header>div,.aito-logs>header>div{flex:1;min-width:0}.aito-settings>header strong,.aito-logs>header strong{display:block;font-size:18px;line-height:1.4}.aito-settings>header span,.aito-logs>header span{display:block;color:var(--aito-muted);font-size:11px;margin-top:4px;line-height:1.6}.aito-settings>form{min-height:0;overflow:auto}.aito-settings :deep(.q-card__section){display:grid;gap:18px;padding:22px}.aito-key-remove{justify-self:start;font-size:10px}.aito-settings-row{display:flex;gap:10px;align-items:center}.aito-settings-row>.q-select{flex:1;min-width:0}.aito-settings-row>.q-btn{font-size:10px}.aito-settings :deep(.q-field__label),.aito-settings :deep(.q-field__native){font-size:13px}.aito-settings :deep(.q-field__bottom){font-size:10px;line-height:1.6}.aito-settings :deep(.q-card__actions){border-top:1px solid var(--aito-line);padding:15px 20px;position:sticky;bottom:0;background:var(--aito-background);z-index:2}.aito-pricing{display:grid;gap:14px;padding:15px 0}.aito-pricing p{font-size:11px;line-height:1.7;color:var(--aito-muted);margin:0}.aito-privacy-note{display:flex;align-items:flex-start;gap:10px;background:var(--aito-panel);padding:12px;border-radius:10px;border:1px solid var(--aito-line)}.aito-privacy-note .q-icon{color:var(--aito-accent);font-size:20px}.aito-privacy-note p{font-size:11px;line-height:1.7;margin:0;color:var(--aito-muted)}.aito-usage{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:20px 22px}.aito-usage article{padding:14px;background:var(--aito-panel);border:1px solid var(--aito-line);border-radius:12px;min-width:0}.aito-usage small{font-size:10px;display:block;color:var(--aito-muted)}.aito-usage strong{display:block;font-size:20px;font-weight:600;margin:10px 0;line-height:1.4;overflow-wrap:anywhere}.aito-usage span{display:block;font-size:9px;color:var(--aito-muted);line-height:1.6}.aito-logs-progress{padding:0 22px 15px}.aito-logs-progress>div:first-child{display:flex;justify-content:space-between;font-size:11px;color:var(--aito-muted);margin-bottom:10px}.aito-event-list{overflow:auto;max-height:50dvh;padding:0 22px}.aito-event-list>article{display:flex;gap:10px;padding:13px 0;border-bottom:1px solid var(--aito-line);font-size:12px;line-height:1.6}.aito-event-list>article>.q-icon{font-size:17px;margin-top:2px;color:var(--aito-accent)}.aito-event-list .aito-event--success>.q-icon{color:#217956}.aito-event-list .aito-event--error>.q-icon{color:#b23939}.aito-event-list .aito-event--warning>.q-icon{color:#946112}.aito-event-list time{display:block;font-size:9px;color:var(--aito-muted);margin-top:4px}.aito-event-list>p{font-size:12px;color:var(--aito-muted);padding:30px;text-align:center}.aito-log-note{padding:18px 22px;color:var(--aito-muted);font-size:10px;line-height:1.7;border-top:1px solid var(--aito-line)}
@keyframes aito-pulse{50%{opacity:.4}}
.aito-assistant-float:hover{transform:translateY(-2px)}.aito-assistant-float:focus-visible{outline-offset:4px}.aito-assistant-header,.aito-settings>header,.aito-logs>header{background:linear-gradient(110deg,#fff,var(--aito-panel))}.aito-settings :deep(.q-field__control){background:white;border-radius:12px}.aito-settings :deep(.q-field__control:before){border-color:var(--aito-line)}.aito-settings :deep(.q-field__native),.aito-settings :deep(.q-field__label){color:var(--aito-text)}.aito-settings :deep(.q-field__bottom){color:var(--aito-muted)}.aito-composer{background:white}.aito-shortcuts>button{background:white}.aito-usage article{background:white}
.aito-key-methods{display:grid;grid-template-columns:1fr 1fr;gap:10px}.aito-key-methods>button{text-align:left;padding:15px;border:1px solid var(--aito-line);border-radius:13px;background:white;color:var(--aito-text);cursor:pointer;min-width:0;display:grid;gap:6px}.aito-key-methods>button.is-selected{background:var(--aito-tint);border-color:var(--aito-accent);box-shadow:inset 0 0 0 1px var(--aito-accent)}.aito-key-methods .q-icon{font-size:22px;color:var(--aito-accent)}.aito-key-methods strong{font-size:12px;line-height:1.4}.aito-key-methods small{font-size:10px;color:var(--aito-muted);line-height:1.5}.aito-key-import{display:grid;gap:12px;min-width:0}.aito-source-description{font-size:11px;color:var(--aito-muted);margin:0}.aito-current-key{display:flex;gap:7px;align-items:center;font-size:11px;line-height:1.6;color:var(--aito-accent)}
@media(max-width:1023px){.aito-assistant-shell{max-width:100vw;width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border:0}.aito-assistant-header{padding:9px 13px;gap:7px}.aito-assistant-header>img{width:38px;height:38px}.aito-assistant-header strong{font-size:16px}.aito-assistant-header>div>span{font-size:9px}.aito-assistant-header nav{gap:4px}.aito-assistant-header .q-btn{font-size:12px}.aito-assistant-thread{padding:8px 18px 20px}.aito-assistant-welcome{margin:25px auto}.aito-composer-area{padding:7px 12px calc(8px + env(safe-area-inset-bottom,0px))}.aito-composer-area>footer{font-size:8px;line-height:1.5}.aito-shortcuts{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.aito-shortcuts>button{padding:8px 5px;flex-direction:column;gap:6px;text-align:center;font-size:9px}.aito-shortcuts .q-icon{font-size:17px}.aito-composer{border-radius:17px;padding:6px 8px}.aito-composer :deep(textarea){font-size:13px!important;max-height:120px!important}.aito-settings,.aito-logs{height:auto;max-height:94dvh;max-width:94vw;border-radius:18px}.aito-assistant-float{right:12px;bottom:calc(38px + env(safe-area-inset-bottom,0px));width:3.75rem;height:3.75rem}.aito-assistant-float>img{width:3rem;height:3rem;object-fit:contain}.aito-usage{padding:16px;gap:6px}.aito-usage article{padding:10px}.aito-usage strong{font-size:17px}.aito-usage small{font-size:9px}.aito-settings>header,.aito-logs>header{padding:16px}}
@media(max-width:599px){.aito-settings,.aito-logs{height:100dvh;max-height:100dvh;max-width:100vw;border-radius:0}.aito-settings>form{flex:1}.aito-settings-row{align-items:stretch;flex-direction:column;gap:4px}.aito-settings-row>.q-btn{align-self:flex-end}.aito-usage{grid-template-columns:1fr 1fr}.aito-usage article:last-child{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;align-items:center}.aito-usage article:last-child strong{grid-column:2;grid-row:1/3;text-align:right;margin:0}.aito-logs .aito-event-list{flex:1;max-height:none}.aito-composer-controls{gap:1px}.aito-effort-button{font-size:10px}.aito-composer :deep(.q-field__control){min-height:50px}.aito-drop-overlay{border-radius:0}}
@media(prefers-reduced-motion:reduce){.aito-assistant-float>i,.aito-recording>span{animation:none}}
.aito-attachment-heading{display:flex;gap:8px;justify-content:space-between;align-items:center;font-size:10px;color:var(--aito-muted);padding:4px 5px 8px}.aito-attachment-heading small{font-size:9px}.aito-draft-files{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;max-height:150px;overflow:auto;padding:2px 3px 6px}.aito-draft-file{display:flex;align-items:center;gap:8px;min-width:0;padding:7px;background:var(--aito-tint);border:1px solid var(--aito-line);border-radius:12px}.aito-draft-file>img{width:42px;height:46px;object-fit:cover;border-radius:6px;background:white;flex:none}.aito-draft-file>.q-icon{color:var(--aito-accent);flex:none}.aito-draft-file>div{min-width:0;flex:1}.aito-draft-file strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.aito-draft-file small{display:block;margin-top:4px;font-size:9px;color:var(--aito-muted)}.aito-draft-file .q-btn{min-width:25px;min-height:25px;font-size:10px;color:var(--aito-muted)}.aito-upload-progress{display:flex;align-items:center;gap:8px;padding:7px;font-size:11px;color:var(--aito-accent)}.aito-attachment-error{white-space:pre-line;max-height:85px;overflow:auto;margin:4px;padding:8px;border-radius:8px;background:#fff0ed;color:#9b3636;font-size:11px;line-height:1.6}.aito-attachment-hint{font-size:9px;line-height:1.5;color:var(--aito-muted);margin:3px 6px 2px}@media(max-width:600px){.aito-draft-files{grid-template-columns:repeat(2,minmax(0,1fr));max-height:140px}.aito-draft-file{gap:5px;padding:5px}.aito-draft-file>img{width:30px;height:37px}.aito-draft-file strong{font-size:9px}.aito-attachment-heading{align-items:start;gap:5px}.aito-attachment-heading small{font-size:8px;max-width:62%;text-align:right}.aito-attachment-hint{font-size:8px}}
</style>
