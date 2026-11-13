<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseMoney } from 'src/services/purchase-history'
import AitoTokenHistory from './AitoTokenHistory.vue'
import AdminAitoProviderKeys from './AdminAitoProviderKeys.vue'
import AdminAitoTokenProjects from './AdminAitoTokenProjects.vue'
import AdminAitoTokenUsage from './AdminAitoTokenUsage.vue'
import LoginMfaDialog from './LoginMfaDialog.vue'

const emit = defineEmits(['reauthenticated', 'open-projects'])
const $q = useQuasar()
const root = '/aito-tokens/admin'
const tab = ref('usage')
const wallets = ref([])
const search = ref('')
const pagination = ref({ page: 1, rowsPerPage: 100, rowsNumber: 0 })
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const modelsLoading = ref(false)
const modelsError = ref('')
const modelCatalog = ref([])
const modelQuery = ref('')
const editing = reactive({ exchangeRate: false, config: false, billing: false, alerts: false, grant: false })
const exchange = reactive({ rate: null, autoRefresh: true })
const config = reactive({ model: 'gpt-6.1-sol', effort: 'medium', speed: 'standard' })
const multipliers = reactive({ multiplier: null, higgsfieldMultiplier: null })
const alerts = reactive({ alertsEnabled: false, alertEmail: '', alertPhone: '', openaiLimit: null, higgsfieldLimit: null })
const providerSettings = [
  { name: 'OpenAI', feature: 'Chat e outras ferramentas OpenAI', icon: 'mdi-message-text-outline', multiplier: 'multiplier', limit: 'openaiLimit' },
  { name: 'Higgsfield', feature: 'Estúdio de vídeo e vídeo no chat', icon: 'mdi-movie-open-play-outline', multiplier: 'higgsfieldMultiplier', limit: 'higgsfieldLimit' },
]
const billingLoaded = ref(false)
const billingLoading = ref(false)
const billingError = ref('')
const historyWallet = ref(null)
const grantWallet = ref(null)
const grantAmount = ref(null)
const grantChallenge = ref(null)
const mfaOpen = ref(false)
let pendingGrant = null
let currentLoad
let modelLoad
let billingLoad

const numbers = new Intl.NumberFormat('pt-BR')
const effortNames = { none: 'Direto', minimal: 'Mínimo', low: 'Baixo', medium: 'Médio', high: 'Alto', xhigh: 'Muito alto', max: 'Ultra' }
const speedNames = { standard: 'Padrão', priority: 'Rápido' }
function parseMultiplier(value) {
  const raw = String(value ?? '').trim()
  return /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN
}
function validMultiplier(value) {
  const factor = parseMultiplier(value)
  return factor >= 1 && factor <= 100
}
function validAlertLimit(value) {
  const amount = parseMultiplier(value)
  return amount >= 0 && amount <= 1000000
}
const validAlertEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
const validAlertPhone = value => typeof value === 'string' && /^\+?[\d\s()-]+$/.test(value) && /^[1-9]\d{9,14}$/.test(value.replace(/\D/g, ''))
const selectedModel = computed(() => modelCatalog.value.find(item => item.id === config.model))
const modelOptions = computed(() => modelCatalog.value
  .filter(item => `${item.label || ''} ${item.id}`.toLowerCase().includes(modelQuery.value))
  .map(item => ({ value: item.id, label: item.label || item.id, disable: !item.usable, reason: item.reason })))
const efforts = computed(() => (selectedModel.value?.efforts || [config.effort]).map(value => ({ value, label: effortNames[value] || value })))
const speeds = computed(() => (selectedModel.value?.speeds || [config.speed]).map(value => ({ value, label: speedNames[value] || value })))
const columns = [
  { name: 'ownerName', label: 'Cliente', field: 'ownerName', align: 'left' },
  { name: 'ownerEmail', label: 'E-mail', field: 'ownerEmail', align: 'left' },
  { name: 'licenseId', label: 'Licença', field: 'licenseId', align: 'left' },
  { name: 'balance', label: 'Saldo', field: row => purchaseMoney(row.balanceUsdCents, 'USD') },
  { name: 'inputTokens', label: 'Tokens de entrada', field: row => numbers.format(row.inputTokens || 0) },
  { name: 'outputTokens', label: 'Tokens de saída', field: row => numbers.format(row.outputTokens || 0) },
  { name: 'spentUsd', label: 'Consumo em USD', field: row => purchaseMoney(row.spentUsdCents, 'USD') },
  { name: 'spentBrl', label: 'Consumo em BRL', field: row => purchaseMoney(row.spentBrlCents) },
  { name: 'actions', label: 'Ações', field: 'licenseId' },
]

function notify(error, fallback) {
  $q.notify({ type: 'negative', message: error.response?.data?.message || fallback })
}

async function load({ page = pagination.value.page, refreshSettings = false } = {}) {
  currentLoad?.abort()
  const request = new AbortController()
  currentLoad = request
  loading.value = true
  loadError.value = ''
  try {
    const { rowsPerPage } = pagination.value
    const { data } = await api.get(root, {
      ...financeHeaders(true),
      signal: request.signal,
      params: { offset: (page - 1) * rowsPerPage, q: search.value || undefined },
    })
    if (request.signal.aborted) return
    const result = data.data || {}
    wallets.value = result.wallets || []
    pagination.value = { page, rowsPerPage: result.limit || rowsPerPage, rowsNumber: result.total ?? wallets.value.length }
    if (!loaded.value || refreshSettings) {
      Object.assign(exchange, result.exchangeRate)
      Object.assign(config, result.config)
    }
    loaded.value = true
  } catch (error) {
    if (!request.signal.aborted) loadError.value = error.response?.data?.message || 'Não foi possível carregar o painel de AitoTokens.'
  } finally {
    if (currentLoad === request) loading.value = false
  }
}

async function saveExchangeRate() {
  const rate = Number(exchange.rate)
  if (!Number.isFinite(rate) || rate <= 0) return
  editing.exchangeRate = true
  try {
    const { data } = await api.put(`${root}/exchange-rate`, { rate, autoRefresh: exchange.autoRefresh }, financeHeaders(true))
    Object.assign(exchange, data.data?.exchangeRate || data.data)
    $q.notify({ type: 'positive', message: 'Cotação USD/BRL atualizada.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar a cotação.')
  } finally {
    editing.exchangeRate = false
  }
}

async function saveConfig() {
  const { model, effort, speed } = config
  if (!selectedModel.value?.usable || editing.config) return
  editing.config = true
  try {
    const { data } = await api.put(`${root}/config`, { model, effort, speed }, financeHeaders(true))
    Object.assign(config, data.data?.config || data.data)
    $q.notify({ type: 'positive', message: 'Configuração central da Aito IA atualizada.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar a configuração.')
  } finally {
    editing.config = false
  }
}

async function loadBilling() {
  if (editing.billing || editing.alerts) return
  billingLoad?.abort()
  const request = new AbortController()
  billingLoad = request
  billingLoading.value = true
  billingError.value = ''
  try {
    const { data } = await api.get(`${root}/billing`, { ...financeHeaders(true), signal: request.signal })
    if (!request.signal.aborted) {
      setMultipliers(data.data)
      setAlerts(data.data)
      billingLoaded.value = true
    }
  } catch (error) {
    if (!request.signal.aborted) billingError.value = error.response?.data?.message || 'Não foi possível consultar a configuração de cobrança e alertas.'
  } finally {
    if (billingLoad === request) billingLoading.value = false
  }
}

function setMultipliers(data) {
  multipliers.multiplier = data.multiplier
  multipliers.higgsfieldMultiplier = data.higgsfieldMultiplier
}

function setAlerts(data) {
  alerts.alertsEnabled = data.alertsEnabled
  alerts.alertEmail = data.alertEmail
  alerts.alertPhone = data.alertPhone
  alerts.openaiLimit = Number.isFinite(data.openaiAlertUsdCents) ? data.openaiAlertUsdCents / 100 : null
  alerts.higgsfieldLimit = Number.isFinite(data.higgsfieldAlertUsdCents) ? data.higgsfieldAlertUsdCents / 100 : null
}

async function saveMultiplier() {
  if (!billingLoaded.value || billingLoading.value || editing.billing || !Object.values(multipliers).every(validMultiplier)) return
  editing.billing = true
  billingError.value = ''
  try {
    const changes = Object.fromEntries(Object.entries(multipliers).map(([key, value]) => [key, parseMultiplier(value)]))
    const { data } = await api.put(`${root}/billing`, changes, financeHeaders(true))
    setMultipliers(data.data)
    $q.notify({ type: 'positive', message: 'Multiplicadores de cobrança atualizados.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar os multiplicadores.')
  } finally {
    editing.billing = false
  }
}

async function saveAlerts() {
  const { alertsEnabled, alertEmail, alertPhone, openaiLimit, higgsfieldLimit } = alerts
  if (!billingLoaded.value || billingLoading.value || editing.alerts ||
    !validAlertEmail(alertEmail) || !validAlertPhone(alertPhone) || ![openaiLimit, higgsfieldLimit].every(validAlertLimit)) return
  editing.alerts = true
  try {
    const { data } = await api.put(`${root}/billing`, {
      alertsEnabled, alertEmail, alertPhone,
      openaiAlertUsdCents: Math.round(parseMultiplier(openaiLimit) * 100),
      higgsfieldAlertUsdCents: Math.round(parseMultiplier(higgsfieldLimit) * 100),
    }, financeHeaders(true))
    setAlerts(data.data)
    $q.notify({ type: 'positive', message: 'Alertas de saldo atualizados.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar os alertas de saldo.')
  } finally {
    editing.alerts = false
  }
}

function selectModel(model) {
  const selected = modelCatalog.value.find(item => item.id === model && item.usable)
  if (!selected) return
  config.model = model
  if (!selected.efforts?.includes(config.effort)) config.effort = selected.efforts?.includes('medium') ? 'medium' : selected.efforts?.[0] || 'medium'
  if (!selected.speeds?.includes(config.speed)) config.speed = selected.speeds?.[0] || 'standard'
}

function filterModels(value, update) {
  update(() => { modelQuery.value = value.trim().toLowerCase() })
}

async function loadModels(refresh = false) {
  modelLoad?.abort()
  const request = new AbortController()
  modelLoad = request
  modelsLoading.value = true
  modelsError.value = ''
  try {
    const { data } = await api.get(`${root}/models`, { ...financeHeaders(true),
      ...(refresh && { params: { refresh: 1 } }), signal: request.signal })
    if (!request.signal.aborted) modelCatalog.value = data.data?.models || []
  } catch (error) {
    if (!request.signal.aborted) modelsError.value = error.response?.data?.message || 'Não foi possível consultar os modelos OpenAI.'
  } finally {
    if (modelLoad === request) modelsLoading.value = false
  }
}

function refreshLicenseSettings() {
  return Promise.all([load({ refreshSettings: true }), loadModels(true), loadBilling()])
}

function openGrant(wallet) {
  grantWallet.value = wallet
  grantAmount.value = null
  pendingGrant = null
}

async function requestGrantMfa() {
  const licenseId = grantWallet.value?.licenseId
  const usdCents = Math.round(Number(grantAmount.value) * 100)
  if (!licenseId || !Number.isSafeInteger(usdCents) || usdCents < 1 || editing.grant) return
  if (pendingGrant?.licenseId !== licenseId || pendingGrant.usdCents !== usdCents) {
    pendingGrant = { licenseId, usdCents, requestId: crypto.randomUUID() }
  }
  editing.grant = true
  try {
    const { data } = await api.post('/auth/mfa/reauth', {}, financeHeaders(true))
    grantChallenge.value = data
    mfaOpen.value = true
  } catch (error) {
    notify(error, 'Não foi possível enviar o código de confirmação.')
  } finally {
    editing.grant = false
  }
}

async function applyGrant(session) {
  if (!session?.token || !pendingGrant || editing.grant) return
  emit('reauthenticated', session)
  editing.grant = true
  try {
    await api.post(`${root}/grants`, pendingGrant, financeHeaders(true))
    $q.notify({ type: 'positive', message: 'Créditos adicionados à licença.' })
    grantWallet.value = null
    pendingGrant = null
    await load()
  } catch (error) {
    notify(error, 'Não foi possível adicionar os créditos.')
  } finally {
    editing.grant = false
  }
}

function changeTab(value) {
  if (value !== 'licenses') return
  if (!loaded.value) load()
  if (!modelCatalog.value.length && !modelsLoading.value) loadModels()
  if (!billingLoading.value) loadBilling()
}

onMounted(() => changeTab(tab.value))
onBeforeUnmount(() => { currentLoad?.abort(); modelLoad?.abort(); billingLoad?.abort() })
</script>

<template>
  <section class="token-admin" aria-labelledby="token-admin-title">
    <header class="token-admin__head">
      <img src="/aitotokens.svg" alt="" width="56" height="56" />
      <div><h2 id="token-admin-title">AitoTokens</h2><p>Consumo, chaves de projetos e recargas.</p></div>
      <q-btn v-if="tab === 'licenses'" flat round icon="mdi-refresh" aria-label="Atualizar AitoTokens" :loading="loading" @click="refreshLicenseSettings" />
    </header>
    <q-tabs v-model="tab" dense align="left" no-caps active-color="teal-3" indicator-color="teal-3" class="token-admin__tabs" @update:model-value="changeTab">
      <q-tab name="usage" label="Uso e custos" />
      <q-tab name="projects" label="AitoKeys de projetos" />
      <q-tab name="licenses" label="Licenças e configurações" />
    </q-tabs>
    <AdminAitoTokenUsage v-if="tab === 'usage'" @reauthenticated="emit('reauthenticated', $event)" />
    <AdminAitoTokenProjects v-else-if="tab === 'projects'" @reauthenticated="emit('reauthenticated', $event)" @open-projects="emit('open-projects')" />
    <template v-else>
    <q-banner v-if="loadError" rounded class="bg-red-10 text-white" role="alert">{{ loadError }}</q-banner>
    <div v-if="loaded" class="token-admin__forms">
      <q-form class="token-admin__box" @submit.prevent="saveExchangeRate">
        <h3>Cotação USD/BRL</h3>
        <q-input v-model="exchange.rate" dark outlined label="Valor de US$ 1 em reais" prefix="R$" type="number" min="0.0001" max="1000" step="any" required />
        <q-toggle v-model="exchange.autoRefresh" dark color="teal-4" label="Redefinir diariamente" />
        <p>{{ exchange.autoRefresh ? 'A busca diária substitui a cotação manual.' : 'A cotação informada permanece até o próximo ajuste manual.' }}</p>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar cotação" :loading="editing.exchangeRate" />
      </q-form>
      <q-form class="token-admin__box" @submit.prevent="saveConfig">
        <div class="token-admin__model-heading">
          <h3>Configurar Aito IA</h3>
          <q-btn flat dense no-caps color="teal-3" icon="mdi-refresh" label="Atualizar modelos" :loading="modelsLoading" @click="loadModels(true)" />
        </div>
        <div class="token-admin__status">
          <q-badge v-if="typeof config.configured === 'boolean'" outline :color="config.configured ? 'green-4' : 'orange-4'" :label="config.configured ? 'Provedor de IA configurado' : 'Chave da IA pendente'" />
          <q-badge v-if="typeof config.checkoutConfigured === 'boolean'" outline :color="config.checkoutConfigured ? 'green-4' : 'orange-4'" :label="config.checkoutConfigured ? 'Checkout InfinitePay configurado' : 'Checkout InfinitePay pendente'" />
        </div>
        <p v-if="modelsError" role="alert" class="token-admin__warning">{{ modelsError }}</p>
        <q-select :model-value="config.model" :display-value="selectedModel?.label || config.model" dark outlined emit-value map-options use-input
          input-debounce="0" :options="modelOptions" :loading="modelsLoading" label="Modelo" @filter="filterModels" @update:model-value="selectModel">
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label v-if="scope.opt.disable" caption>{{ scope.opt.reason || 'Modelo sem suporte à cobrança AitoTokens' }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option><q-item><q-item-section>Nenhum modelo encontrado.</q-item-section></q-item></template>
        </q-select>
        <q-select v-model="config.effort" dark outlined emit-value map-options :options="efforts" :disable="!selectedModel?.usable || efforts.length < 2" label="Nível de esforço" />
        <q-select v-model="config.speed" dark outlined emit-value map-options :options="speeds" :disable="!selectedModel?.usable || speeds.length < 2" label="Processamento" />
        <p v-if="config.speed === 'priority'">O multiplicador AitoTokens incide sobre a tarifa do processamento rápido.</p>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar configuração" :loading="editing.config" :disable="!selectedModel?.usable || modelsLoading" />
      </q-form>
      <q-form class="token-admin__box" @submit.prevent="saveMultiplier">
        <h3>Cobrança AitoTokens</h3>
        <div v-for="provider in providerSettings" :key="provider.name" class="token-admin__provider-field">
          <header>
            <span class="token-admin__provider-icon"><q-icon :name="provider.icon" size="20px" /></span>
            <div><strong>{{ provider.name }}</strong><small>{{ provider.feature }}</small></div>
          </header>
          <q-input v-model="multipliers[provider.multiplier]" dark outlined dense :label="`Multiplicador ${provider.name}`" suffix="×"
            type="number" inputmode="decimal" min="1" max="100" step="0.01" required :loading="billingLoading"
            :disable="!billingLoaded || billingLoading || editing.billing"
            :rules="[value => validMultiplier(value) || 'Informe um número de 1 a 100, com até duas casas decimais.']" hide-bottom-space />
          <small v-if="validMultiplier(multipliers[provider.multiplier])">US$ 1,00 de custo equivale a
            <strong>{{ purchaseMoney(100 * parseMultiplier(multipliers[provider.multiplier]), 'USD') }}</strong> em AitoTokens.</small>
        </div>
        <p>Os dois provedores usam a mesma carteira AitoTokens. A taxa de cada cobrança fica registrada.</p>
        <p v-if="billingError" role="alert" class="token-admin__warning">{{ billingError }}</p>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar multiplicadores" :loading="editing.billing" :disable="!billingLoaded || billingLoading" />
      </q-form>
      <q-form class="token-admin__box" @submit.prevent="saveAlerts">
        <h3><q-icon name="mdi-bell-ring-outline" color="teal-3" /> Alertas de saldo</h3>
        <p>Avise por WhatsApp Web e e-mail quando o saldo estimado de um provedor atingir o limite configurado.</p>
        <q-toggle v-model="alerts.alertsEnabled" dark color="teal-4" label="Ativar alertas de saldo"
          :disable="!billingLoaded || billingLoading || editing.alerts" />
        <div class="token-admin__alert-limits">
          <q-input v-for="provider in providerSettings" :key="provider.name" v-model="alerts[provider.limit]" dark outlined dense
            :label="`Limite ${provider.name}`" prefix="US$" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" required
            :disable="!billingLoaded || billingLoading || editing.alerts"
            :rules="[value => validAlertLimit(value) || 'Informe um valor válido em dólares.']" hide-bottom-space />
        </div>
        <q-input v-model.trim="alerts.alertPhone" dark outlined dense label="WhatsApp de destino" type="tel" maxlength="24" autocomplete="off" required
          :disable="!billingLoaded || billingLoading || editing.alerts" :rules="[value => validAlertPhone(value) || 'Informe um telefone válido com DDD.']" hide-bottom-space>
          <template #prepend><q-icon name="mdi-whatsapp" /></template>
        </q-input>
        <q-input v-model.trim="alerts.alertEmail" dark outlined dense label="E-mail de destino" type="email" maxlength="254" autocomplete="off" required
          :disable="!billingLoaded || billingLoading || editing.alerts" :rules="[value => validAlertEmail(value) || 'Informe um e-mail válido.']" hide-bottom-space>
          <template #prepend><q-icon name="mdi-email-outline" /></template>
        </q-input>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar alertas" :loading="editing.alerts" :disable="!billingLoaded || billingLoading" />
      </q-form>
    </div>
    <AdminAitoProviderKeys :checkout-state="config.checkoutState" @updated="refreshLicenseSettings" @reauthenticated="emit('reauthenticated', $event)" />
    <q-table
      v-if="loaded" v-model:pagination="pagination" flat bordered dark wrap-cells row-key="licenseId" :rows="wallets" :columns="columns"
      :rows-per-page-options="[pagination.rowsPerPage]" no-data-label="Nenhuma licença encontrada."
      class="token-admin__table" title="Consumo por licença" :loading="loading" @request="load({ page: $event.pagination.page })"
    >
      <template #top-right><q-input v-model.trim="search" dark dense outlined clearable debounce="300" label="Buscar cliente ou licença" @update:model-value="load({ page: 1 })" /></template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="mdi-history" aria-label="Histórico de recargas" @click="historyWallet = props.row"><q-tooltip>Histórico de recargas</q-tooltip></q-btn>
          <q-btn flat round dense icon="mdi-plus-circle-outline" aria-label="Adicionar créditos" @click="openGrant(props.row)"><q-tooltip>Adicionar créditos</q-tooltip></q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog :model-value="Boolean(historyWallet)" @update:model-value="historyWallet = null">
      <q-card dark class="token-admin__dialog token-admin__dialog--wide">
        <q-card-section class="row items-center justify-between">
          <div><h3>Histórico de recargas</h3><p>{{ historyWallet?.ownerName }} · {{ historyWallet?.licenseId }}</p></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar" v-close-popup />
        </q-card-section>
        <q-card-section><AitoTokenHistory v-if="historyWallet" :key="historyWallet.licenseId" :license-id="historyWallet.licenseId" :rows="historyWallet.history" admin /></q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="Boolean(grantWallet)" persistent @update:model-value="grantWallet = null">
      <q-card dark class="token-admin__dialog">
        <q-form @submit.prevent="requestGrantMfa">
          <q-card-section>
            <h3>Adicionar créditos</h3>
            <p>{{ grantWallet?.ownerName }} · {{ grantWallet?.ownerEmail }}</p>
            <p>Licença {{ grantWallet?.licenseId }}</p>
            <q-input v-model="grantAmount" dark outlined label="Créditos em dólares" prefix="US$" type="number" min="0.01" step="0.01" required />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="editing.grant || mfaOpen" v-close-popup />
            <q-btn unelevated no-caps label="Confirmar por e-mail" color="teal-7" type="submit" :loading="editing.grant" :disable="mfaOpen" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <LoginMfaDialog v-model="mfaOpen" :challenge="grantChallenge" @verified="applyGrant" />
    </template>
  </section>
</template>

<style scoped>
.token-admin { display: grid; gap: 1rem; color: #edfff8; }
.token-admin__head { display: flex; align-items: center; gap: .9rem; }
.token-admin__head > div { flex: 1; }
.token-admin__head h2 { margin: 0; font-size: clamp(1.65rem, 4vw, 2.5rem); line-height: 1.2; }
.token-admin__tabs { border-bottom: 1px solid #345857; }
.token-admin p, .token-admin__dialog p { margin: .35rem 0; color: #c2d9d3; }
.token-admin__forms { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1rem; }
.token-admin__box { display: grid; align-content: start; gap: .8rem; padding: 1rem; border: 1px solid #345857; border-radius: .8rem; background: #0c2022; }
.token-admin__box .q-btn { justify-self: start; }
.token-admin__status { display: flex; flex-wrap: wrap; gap: .45rem; }
.token-admin__status:empty { display: none; }
.token-admin__model-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .4rem; }
.token-admin__provider-field { display: grid; gap: .6rem; padding: .65rem; border: 1px solid #345857; border-radius: .65rem; }
.token-admin__provider-field header { display: flex; align-items: center; gap: .65rem; }
.token-admin__provider-field small { display: block; color: #c2d9d3; }
.token-admin__provider-icon { display: grid; place-items: center; flex: 0 0 35px; height: 35px; border-radius: 10px; background: #18403c; color: #91f4d6; }
.token-admin__alert-limits { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap: .5rem; }
.token-admin p.token-admin__warning { color: #ffd190; }
.token-admin h3, .token-admin__dialog h3 { margin: 0; font-size: 1.2rem; font-weight: 700; line-height: 1.4; }
.token-admin__table { background: #0c2022; border-color: #345857; }
.token-admin__dialog { width: min(94vw, 480px); border: 1px solid #345857; background: #0c2022; }
.token-admin__dialog--wide { width: min(94vw, 900px); max-width: 94vw; }
</style>
