<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useWhiteLabel } from '../services/whitelabel.js'
import { errorMessage } from '../services/http.js'
import { assistantApi, assistantConfigInput, assistantTheme } from '../services/admin-assistant.js'

const visible = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['saved'])
const $q = useQuasar()
const { branding } = useWhiteLabel()
const theme = computed(() => assistantTheme(branding))
const config = reactive({ apiKey: '', keyMode: 'new', keySourceId: null, model: 'gpt-6.1-sol', temperature: .7, effort: 'medium', speed: 'standard' })
const priceInput = reactive({ enabled: false, input: '', output: '', cached: '' })
const configured = ref(false), models = ref([]), currentSource = ref(null), modelsWarning = ref(''), modelsStatus = ref('not_loaded')
const hasCustomPricing = ref(false)
const configError = ref(''), saving = ref(false), loading = ref(false)
const keySources = ref([]), sourcesLoading = ref(false), sourceError = ref('')
const keySourceOptions = computed(() => keySources.value.map(item => ({ ...item, value: item.id, disable: !item.available })))
const selectedKeySource = computed(() => keySources.value.find(item => item.id === config.keySourceId))
const modelOptions = computed(() => models.value.map(item => typeof item === 'string' ? { label: item, value: item } : { label: item.label || item.id, value: item.id }))
const usesReasoning = computed(() => /^gpt-[5-9]/.test(config.model))
const effortOptions = computed(() => [
  { value: 'low', label: 'Baixo' }, { value: 'medium', label: 'Médio' }, { value: 'high', label: 'Alto' },
  ...(/^gpt-6/.test(config.model) ? [{ value: 'xhigh', label: 'Extra alto' }, { value: 'max', label: 'Máximo' }] : []),
])

function applyConfig(value) {
  configured.value = Boolean(value.configured)
  models.value = value.models || []
  currentSource.value = value.keySource || null
  modelsStatus.value = value.modelsStatus || 'not_loaded'
  modelsWarning.value = value.modelsWarning || ''
  for (const key of ['model', 'temperature', 'effort', 'speed']) {
    if (value[key] !== undefined) config[key] = value[key]
  }
  hasCustomPricing.value = Boolean(value.customPricing)
  Object.assign(priceInput, {
    enabled: Boolean(value.customPricing),
    input: value.pricing?.inputPerMillion ?? '',
    output: value.pricing?.outputPerMillion ?? '',
    cached: value.pricing?.cachedInputPerMillion ?? '',
  })
}

async function loadSources() {
  sourcesLoading.value = true
  sourceError.value = ''
  try { keySources.value = (await assistantApi.keySources()).items || [] }
  catch (cause) { sourceError.value = errorMessage(cause, 'Não foi possível listar as chaves cadastradas.') }
  finally { sourcesLoading.value = false }
}

async function loadConfig(refresh = false) {
  loading.value = true
  configError.value = ''
  try { applyConfig(await assistantApi.config(refresh)) }
  catch (cause) { configError.value = errorMessage(cause) }
  finally { loading.value = false }
}

async function saveConfig() {
  if (saving.value || loading.value) return
  configError.value = ''
  saving.value = true
  try {
    if (!configured.value && config.keyMode === 'new' && !config.apiKey.trim()) {
      throw Error('Informe uma nova chave OpenAI ou importe uma chave cadastrada.')
    }
    const saved = await assistantApi.saveConfig(assistantConfigInput(config, priceInput, hasCustomPricing.value))
    applyConfig(saved)
    emit('saved', saved)
    visible.value = false
    $q.notify({ type: 'positive', message: 'Configuração da Aito I.A salva.' })
  } catch (cause) { configError.value = errorMessage(cause) }
  finally { saving.value = false }
}

function removeKey() {
  $q.dialog({
    title: 'Remover a chave da Aito I.A?',
    message: 'Você precisará configurar uma chave para voltar a usar o agente.',
    cancel: { label: 'Manter chave', flat: true },
    ok: { label: 'Remover chave', color: 'negative' },
  }).onOk(async () => {
    saving.value = true
    configError.value = ''
    try { applyConfig(await assistantApi.saveConfig({ apiKey: null })) }
    catch (cause) { configError.value = errorMessage(cause) }
    finally { saving.value = false }
  })
}

watch(visible, value => {
  config.apiKey = ''
  config.keyMode = 'new'
  config.keySourceId = null
  if (value) { void loadConfig(); void loadSources() }
})
watch(() => config.keyMode, () => { config.apiKey = ''; config.keySourceId = null })
watch(() => config.model, () => {
  if (!effortOptions.value.some(option => option.value === config.effort)) config.effort = 'medium'
})
</script>

<template>
  <q-dialog v-model="visible" :maximized="$q.screen.lt.sm">
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
          <q-btn v-if="configured" flat dense no-caps color="negative" icon="key_off" label="Remover chave configurada" class="aito-key-remove" :disable="saving" @click="removeKey"/>
          <q-banner v-if="modelsWarning" rounded class="aito-model-notice" role="status"><template #avatar><q-icon name="info_outline"/></template>{{modelsWarning}}</q-banner>
          <div class="aito-settings-row"><q-select v-model="config.model" outlined emit-value map-options :options="modelOptions" label="Modelo"/><q-btn flat dense no-caps icon="refresh" label="Atualizar modelos" :loading="loading" :disable="saving||!configured||!!config.apiKey.trim()||config.keyMode==='import'" @click="loadConfig(true)"/></div>
          <p v-if="configured&&modelsStatus==='not_loaded'" class="aito-source-description">Modelo salvo preservado. Use “Atualizar modelos” para consultar as opções disponíveis na sua conta OpenAI.</p>
          <q-input v-if="!usesReasoning" v-model.number="config.temperature" outlined type="number" min="0" max="2" step="0.1" label="Temperatura" hint="Menor para respostas mais consistentes; maior para mais variação."/>
          <q-select v-else v-model="config.effort" outlined emit-value map-options :options="effortOptions" label="Nível de esforço" hint="Maior esforço pode consumir mais tempo e tokens."/>
          <q-select v-model="config.speed" outlined emit-value map-options :options="[{label:'Padrão',value:'standard'},{label:'Prioridade',value:'priority'}]" label="Processamento" hint="Prioridade depende do modelo e pode ter um preço diferente na OpenAI."/>
          <q-expansion-item icon="paid" label="Estimativa de custo em dólar" caption="Opcional · preços por milhão de tokens"><div class="aito-pricing"><q-toggle v-model="priceInput.enabled" color="primary" label="Estimar com os preços informados"/><template v-if="priceInput.enabled"><q-input v-model="priceInput.input" outlined type="number" min="0" step="any" label="Entrada · US$/1M"/><q-input v-model="priceInput.cached" outlined type="number" min="0" step="any" label="Entrada em cache · US$/1M"/><q-input v-model="priceInput.output" outlined type="number" min="0" step="any" label="Saída · US$/1M"/></template><p>O consumo de tokens é informado pela API. Valores estimados podem não incluir imagens, ferramentas, transcrições e outras cobranças. Consulte a fatura da OpenAI para o total final.</p></div></q-expansion-item>
          <div class="aito-privacy-note"><q-icon name="verified_user"/><p>Sua chave, inclusive quando importada, modelo e preferências ficam salvos nesta instalação e permanecem após deploys. Limpar a conversa remove somente o contexto temporário, anexos e ações pendentes. A chave nova é criptografada antes de sair deste formulário e fica criptografada no armazenamento da instalação.</p></div>
        </q-card-section>
        <q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup/><q-btn class="aito-primary" no-caps unelevated type="submit" :label="configured?'Salvar configuração':'Salvar e continuar'" :loading="saving" :disable="loading||(config.keyMode==='import'&&!config.keySourceId)"/></q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>

.aito-settings{width:660px;max-width:94vw;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--aito-background);color:var(--aito-text)}
.aito-settings>header{display:flex;align-items:center;gap:12px;padding:20px 22px;border-bottom:1px solid var(--aito-line);background:linear-gradient(110deg,#fff,var(--aito-panel))}
.aito-settings>header>div{flex:1}
.aito-settings>header strong{display:block;font-size:18px}
.aito-settings>header span{display:block;color:var(--aito-muted);font-size:12px;margin-top:4px}
.aito-settings>form{overflow:auto;min-height:0}
.aito-settings :deep(.q-card__section){display:grid;gap:18px;padding:22px}
.aito-settings :deep(.q-card__actions){position:sticky;bottom:0;background:var(--aito-background);border-top:1px solid var(--aito-line);padding:12px 20px}
.aito-primary{color:white;background:var(--aito-accent)}
.aito-error{color:#8d3434;background:#fff0ee}
.aito-model-notice{color:#755323;background:#fff6e6}
.aito-key-remove{justify-self:start;font-size:10px}.aito-settings-row{display:flex;gap:10px;align-items:center}.aito-settings-row>.q-select{flex:1;min-width:0}.aito-settings-row>.q-btn{font-size:10px}.aito-settings :deep(.q-field__label),.aito-settings :deep(.q-field__native){font-size:13px}.aito-settings :deep(.q-field__bottom){font-size:10px;line-height:1.6}.aito-settings :deep(.q-card__actions){border-top:1px solid var(--aito-line);padding:15px 20px;position:sticky;bottom:0;background:var(--aito-background);z-index:2}.aito-pricing{display:grid;gap:14px;padding:15px 0}.aito-pricing p{font-size:11px;line-height:1.7;color:var(--aito-muted);margin:0}.aito-privacy-note{display:flex;align-items:flex-start;gap:10px;background:var(--aito-panel);padding:12px;border-radius:10px;border:1px solid var(--aito-line)}.aito-privacy-note .q-icon{color:var(--aito-accent);font-size:20px}.aito-privacy-note p{font-size:11px;line-height:1.7;margin:0;color:var(--aito-muted)}.aito-key-methods{display:grid;grid-template-columns:1fr 1fr;gap:10px}.aito-key-methods>button{text-align:left;padding:15px;border:1px solid var(--aito-line);border-radius:13px;background:white;color:var(--aito-text);cursor:pointer;min-width:0;display:grid;gap:6px}.aito-key-methods>button.is-selected{background:var(--aito-tint);border-color:var(--aito-accent);box-shadow:inset 0 0 0 1px var(--aito-accent)}.aito-key-methods .q-icon{font-size:22px;color:var(--aito-accent)}.aito-key-methods strong{font-size:12px;line-height:1.4}.aito-key-methods small{font-size:10px;color:var(--aito-muted);line-height:1.5}.aito-key-import{display:grid;gap:12px;min-width:0}.aito-source-description{font-size:11px;color:var(--aito-muted);margin:0}.aito-current-key{display:flex;gap:7px;align-items:center;font-size:11px;line-height:1.6;color:var(--aito-accent)}

@media(max-width:599px){
  .aito-settings{width:100vw;max-width:none;max-height:100dvh;min-height:100dvh;border-radius:0}
  .aito-settings-row{align-items:stretch;flex-direction:column}
}

</style>
