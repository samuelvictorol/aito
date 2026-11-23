<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate } from 'src/services/purchase-history'
import { adminConfirmationHeaders } from 'src/services/adminConfirmation'
import AdminProjectWallet from './AdminProjectWallet.vue'
import AdminPasswordDialog from './AdminPasswordDialog.vue'

const emit = defineEmits(['open-projects'])
const $q = useQuasar()
const root = '/aito-tokens/admin'
const projects = ref([])
const search = ref('')
const loading = ref(false)
const error = ref('')
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })
const action = ref(null)
const credit = ref('')
const reclaimAll = ref(false)
const busy = ref(false)
const passwordOpen = ref(false)
const revealed = ref(null)
const selectedProject = ref(null)
const numbers = new Intl.NumberFormat('pt-BR')
let request

const columns = [
  { name: 'project', label: 'Projeto', field: 'title', align: 'left' },
  { name: 'status', label: 'AitoKey', field: 'active', align: 'left' },
  { name: 'balance', label: 'Saldo disponível', field: row => Number.isFinite(row.balanceAitoTokens) ? numbers.format(row.balanceAitoTokens) + ' AitoTokens' : '—' },
  { name: 'updatedAt', label: 'Alterada em', field: row => purchaseDate(row.updatedAt), align: 'left' },
  { name: 'actions', label: 'Ações', field: 'projectId' },
]
const titles = { issue: 'Emitir AitoKey', rotate: 'Substituir AitoKey', revoke: 'Revogar AitoKey', grant: 'Adicionar créditos', reclaim: 'Devolver saldo' }
const explanations = {
  issue: 'A carteira ficará vinculada ao projeto. Você pode adicionar créditos ao emitir a chave.',
  rotate: 'A chave anterior perde o acesso assim que a nova for emitida. O saldo e o histórico do projeto permanecem.',
  revoke: 'A chave deixa de autorizar chamadas. O saldo e o histórico permanecem no projeto.',
  grant: 'Informe o valor a creditar na carteira do projeto.',
  reclaim: 'Escolha quanto do saldo disponível volta para a plataforma.',
}
const statusOf = row => row.active ? (projectActive(row) ? 'Ativa' : 'Projeto inativo') : row.issued ? 'Revogada' : 'Sem chave'
const projectActive = row => !['paused', 'completed', 'archived'].includes(row.projectStatus)

async function load(page = pagination.value.page) {
  request?.abort()
  const current = new AbortController()
  request = current
  loading.value = true
  error.value = ''
  try {
    const { rowsPerPage } = pagination.value
    const { data } = await api.get(root + '/project-keys', {
      ...financeHeaders(true), signal: current.signal, params: {
        q: search.value || undefined, offset: (page - 1) * rowsPerPage,
      },
    })
    if (current.signal.aborted) return
    const result = data.data
    projects.value = result.keys
    pagination.value = { page, rowsPerPage: result.limit, rowsNumber: result.total }
  } catch (cause) {
    if (!current.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar os projetos.'
  } finally {
    if (request === current) loading.value = false
  }
}

function selectAction(operation, project) {
  credit.value = operation === 'issue' ? '0' : ''
  reclaimAll.value = false
  action.value = { operation, project }
}

async function confirm() {
  if (!action.value || busy.value) return
  const tokens = /^\d+$/.test(String(credit.value).trim()) ? Number(credit.value) : NaN
  if (action.value.operation === 'reclaim') {
    if (!reclaimAll.value && (!Number.isSafeInteger(tokens) || tokens <= 0 || tokens > action.value.project.approximateTokens)) {
      $q.notify({ type: 'negative', message: 'Informe um valor dentro do saldo disponível.' })
      return
    }
    const amount = reclaimAll.value ? { all: true } : { aitoTokens: tokens }
    const signature = JSON.stringify(amount)
    if (action.value.reclaimSignature !== signature) action.value = {
      ...action.value, reclaimSignature: signature, reclaimBody: { ...amount, requestId: crypto.randomUUID() },
    }
  }
  if (action.value.operation === 'grant' || action.value.operation === 'issue') {
    if (!Number.isSafeInteger(tokens) || tokens < (action.value.operation === 'grant' ? 1 : 0)) {
      $q.notify({ type: 'negative', message: 'Informe uma quantidade inteira de AitoTokens.' })
      return
    }
    if (action.value.aitoTokens !== tokens) {
      action.value = { ...action.value, aitoTokens: tokens, ...(action.value.operation === 'grant' && { requestId: crypto.randomUUID() }) }
    }
  }
  passwordOpen.value = true
}

async function apply(confirmation) {
  if (!confirmation?.confirmationToken || !action.value || busy.value) return
  const { operation, project, aitoTokens, requestId, reclaimBody } = action.value
  const headers = adminConfirmationHeaders(confirmation)
  busy.value = true
  try {
    if (operation === 'grant') {
      await api.post(root + '/grants', { projectId: project.projectId, aitoTokens, requestId }, headers)
    } else if (operation === 'reclaim') {
      await api.post(root + '/reclaims', { projectId: project.projectId, ...reclaimBody }, headers)
    } else {
      const body = operation === 'issue' ? { initialAitoTokens: aitoTokens } : {}
      const { data } = await api.post(root + '/project-keys/' + encodeURIComponent(project.projectId) + '/' + operation, body, headers)
      if (data.data?.key) revealed.value = { key: data.data.key, title: project.title }
    }
    if (!revealed.value) $q.notify({ type: 'positive', message: { grant: 'Créditos adicionados.', reclaim: 'Saldo devolvido à plataforma.' }[operation] || 'AitoKey revogada.' })
    action.value = null
    await load()
  } catch (cause) {
    $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível concluir a alteração.' })
  } finally {
    busy.value = false
  }
}

async function copyKey() {
  if (!revealed.value) return
  try {
    await navigator.clipboard.writeText(revealed.value.key)
    $q.notify({ type: 'positive', message: 'AitoKey copiada.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Selecione e copie a chave diretamente do campo.' })
  }
}

onMounted(() => load())
onBeforeUnmount(() => {
  request?.abort()
  revealed.value = null
})
</script>

<template>
  <section class="token-projects" aria-labelledby="token-projects-title">
    <header class="token-projects__header">
      <div>
        <h3 id="token-projects-title">AitoKeys por projeto</h3>
        <p>Emita chaves para projetos cadastrados e acompanhe o saldo de cada integração.</p>
      </div>
      <q-btn outline no-caps color="teal-3" icon="mdi-folder-plus-outline" label="Cadastrar projeto" @click="emit('open-projects')" />
    </header>
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <q-table v-model:pagination="pagination" flat bordered dark wrap-cells row-key="projectId" :rows="projects" :columns="columns"
      :rows-per-page-options="[pagination.rowsPerPage]" :loading="loading" no-data-label="Nenhum projeto encontrado."
      class="token-projects__table" @request="load($event.pagination.page)"
    >
      <template #top-right>
        <q-input v-model.trim="search" dark dense outlined clearable debounce="300" label="Buscar projeto" @update:model-value="load(1)" />
        <q-btn flat dense round icon="mdi-refresh" aria-label="Atualizar saldos dos projetos" :loading="loading" @click="load()" />
      </template>
      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge outline :color="props.row.active && projectActive(props.row) ? 'teal-3' : 'grey-4'">{{ statusOf(props.row) }}</q-badge>
          <code v-if="props.row.keyHint" class="token-projects__hint">…{{ props.row.keyHint }}</code>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <div class="token-projects__actions">
            <q-btn v-if="projectActive(props.row)" flat dense no-caps color="teal-3" :icon="props.row.issued ? 'mdi-key-change' : 'mdi-key-plus'"
              :label="props.row.issued ? 'Nova chave' : 'Emitir chave'" @click="selectAction(props.row.issued ? 'rotate' : 'issue', props.row)"
            />
            <q-btn v-if="props.row.active" flat dense round icon="mdi-key-remove" color="orange-4" aria-label="Revogar chave" @click="selectAction('revoke', props.row)"><q-tooltip>Revogar chave</q-tooltip></q-btn>
            <q-btn v-if="props.row.active && projectActive(props.row)" flat dense round icon="mdi-wallet-plus-outline" color="teal-3" aria-label="Adicionar créditos" @click="selectAction('grant', props.row)"><q-tooltip>Adicionar créditos</q-tooltip></q-btn>
            <q-btn v-if="props.row.balanceUsdCents > 0" flat dense round icon="mdi-cash-refund" color="amber-4" aria-label="Devolver saldo" @click="selectAction('reclaim', props.row)"><q-tooltip>Devolver saldo</q-tooltip></q-btn>
            <q-btn v-if="props.row.issued" flat dense no-caps icon="mdi-wallet-outline" color="teal-3" label="Carteira e recarga" @click="selectedProject = props.row" />
          </div>
        </q-td>
      </template>
    </q-table>
    <q-dialog :model-value="Boolean(action)" persistent @update:model-value="action = null">
      <q-card dark class="token-projects__dialog">
        <q-form @submit.prevent="confirm">
          <q-card-section>
            <h3>{{ titles[action?.operation] }}</h3>
            <p><strong>{{ action?.project?.title }}</strong></p>
            <p>{{ explanations[action?.operation] }}</p>
            <template v-if="action?.operation === 'reclaim'">
              <q-toggle v-model="reclaimAll" dark color="amber-6" label="Devolver todo o saldo disponível" :disable="busy || passwordOpen" />
              <q-input v-if="!reclaimAll" v-model="credit" dark outlined label="AitoTokens a devolver" inputmode="numeric" type="number" min="1" step="1" required :disable="busy || passwordOpen" />
            </template>
            <q-input v-if="['grant', 'issue'].includes(action?.operation)" v-model="credit" dark outlined
              :label="action.operation === 'issue' ? 'AitoTokens iniciais' : 'AitoTokens a adicionar'"
              type="number" :min="action.operation === 'issue' ? 0 : 1" step="1" required :disable="busy || passwordOpen"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="busy || passwordOpen" v-close-popup />
            <q-btn unelevated no-caps label="Continuar" color="teal-7" type="submit" :loading="busy" :disable="passwordOpen" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="Boolean(selectedProject)" @update:model-value="selectedProject = null">
      <q-card dark class="token-projects__dialog token-projects__dialog--wide">
        <q-card-section class="row items-center justify-between">
          <div><h3>Carteira do projeto</h3><p>{{ selectedProject?.title }}</p></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar carteira" v-close-popup />
        </q-card-section>
        <q-card-section><AdminProjectWallet v-if="selectedProject" :project="selectedProject" /></q-card-section>
      </q-card>
    </q-dialog>
    <AdminPasswordDialog v-model="passwordOpen" @verified="apply" />
    <q-dialog :model-value="Boolean(revealed)" persistent @update:model-value="revealed = null">
      <q-card dark class="token-projects__dialog">
        <q-card-section>
          <h3>AitoKey de {{ revealed?.title }}</h3>
          <p>Copie para o servidor da integração. A chave completa aparece uma vez.</p>
          <q-input :model-value="revealed?.key" dark outlined readonly autocomplete="off" label="AitoKey" aria-label="Nova AitoKey" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Fechar" v-close-popup />
          <q-btn unelevated no-caps label="Copiar chave" icon="mdi-content-copy" color="teal-7" @click="copyKey" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.token-projects { display: grid; gap: 1rem; }
.token-projects__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .8rem; }
.token-projects__header h3, .token-projects__dialog h3 { margin: 0; color: #edfff8; font-size: 1.25rem; font-weight: 700; line-height: 1.3; }
.token-projects__header p, .token-projects__dialog p { margin: .45rem 0; color: #c2d9d3; }
.token-projects__table, .token-projects__dialog { border: 1px solid #345857; background: #0c2022; }
.token-projects__hint { padding-left: .5rem; color: #c2d9d3; }
.token-projects__actions { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: .25rem; }
.token-projects__dialog { width: min(94vw, 550px); }
.token-projects__dialog--wide { width: min(94vw, 900px); max-width: 94vw; }
</style>
