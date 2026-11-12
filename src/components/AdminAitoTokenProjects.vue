<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseDate, purchaseMoney } from 'src/services/purchase-history'
import AitoTokenHistory from './AitoTokenHistory.vue'
import LoginMfaDialog from './LoginMfaDialog.vue'

const emit = defineEmits(['reauthenticated', 'open-projects'])
const $q = useQuasar()
const root = '/aito-tokens/admin'
const projects = ref([])
const search = ref('')
const loading = ref(false)
const error = ref('')
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })
const action = ref(null)
const credit = ref('')
const busy = ref(false)
const challenge = ref(null)
const mfaOpen = ref(false)
const revealed = ref(null)
const historyProject = ref(null)
let request

const columns = [
  { name: 'project', label: 'Projeto', field: 'title', align: 'left' },
  { name: 'status', label: 'AitoKey', field: 'active', align: 'left' },
  { name: 'balance', label: 'Saldo', field: row => purchaseMoney(row.balanceUsdCents, 'USD') },
  { name: 'updatedAt', label: 'Alterada em', field: row => purchaseDate(row.updatedAt), align: 'left' },
  { name: 'actions', label: 'Ações', field: 'projectId' },
]
const titles = { issue: 'Emitir AitoKey', rotate: 'Substituir AitoKey', revoke: 'Revogar AitoKey', grant: 'Adicionar créditos' }
const explanations = {
  issue: 'A carteira ficará vinculada ao projeto. Você pode adicionar créditos ao emitir a chave.',
  rotate: 'A chave anterior perde o acesso assim que a nova for emitida. O saldo e o histórico do projeto permanecem.',
  revoke: 'A chave deixa de autorizar chamadas. O saldo e o histórico permanecem no projeto.',
  grant: 'Informe o valor a creditar na carteira do projeto.',
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
  action.value = { operation, project }
}

async function confirm() {
  if (!action.value || busy.value) return
  if (action.value.operation === 'grant' || action.value.operation === 'issue') {
    const usdCents = Math.round(Number(credit.value) * 100)
    if (!Number.isSafeInteger(usdCents) || usdCents < (action.value.operation === 'grant' ? 1 : 0) || usdCents > 100000) return
    if (action.value.usdCents !== usdCents) {
      action.value = { ...action.value, usdCents, ...(action.value.operation === 'grant' && { requestId: crypto.randomUUID() }) }
    }
  }
  busy.value = true
  try {
    const { data } = await api.post('/auth/mfa/reauth', {}, financeHeaders(true))
    challenge.value = data
    mfaOpen.value = true
  } catch (cause) {
    $q.notify({ type: 'negative', message: cause.response?.data?.message || 'Não foi possível enviar o código.' })
  } finally {
    busy.value = false
  }
}

async function apply(session) {
  if (!session?.token || !action.value || busy.value) return
  emit('reauthenticated', session)
  const { operation, project, usdCents, requestId } = action.value
  const headers = { headers: { Authorization: 'Bearer ' + session.token } }
  busy.value = true
  try {
    if (operation === 'grant') {
      await api.post(root + '/grants', { projectId: project.projectId, usdCents, requestId }, headers)
    } else {
      const body = operation === 'issue' ? { initialUsdCents: usdCents } : {}
      const { data } = await api.post(root + '/project-keys/' + encodeURIComponent(project.projectId) + '/' + operation, body, headers)
      if (data.data?.key) revealed.value = { key: data.data.key, title: project.title }
    }
    if (!revealed.value) $q.notify({ type: 'positive', message: operation === 'grant' ? 'Créditos adicionados.' : 'AitoKey revogada.' })
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
            <q-btn v-if="props.row.issued" flat dense round icon="mdi-history" color="teal-3" aria-label="Histórico de recargas" @click="historyProject = props.row"><q-tooltip>Histórico de recargas</q-tooltip></q-btn>
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
            <q-input v-if="['grant', 'issue'].includes(action?.operation)" v-model="credit" dark outlined
              :label="action.operation === 'issue' ? 'Crédito inicial' : 'Créditos em dólares'" prefix="US$"
              type="number" :min="action.operation === 'issue' ? '0' : '0.01'" max="1000" step="0.01" required :disable="busy || mfaOpen"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="busy || mfaOpen" v-close-popup />
            <q-btn unelevated no-caps label="Confirmar por e-mail" color="teal-7" type="submit" :loading="busy" :disable="mfaOpen" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="Boolean(historyProject)" @update:model-value="historyProject = null">
      <q-card dark class="token-projects__dialog token-projects__dialog--wide">
        <q-card-section class="row items-center justify-between">
          <div><h3>Histórico de recargas</h3><p>{{ historyProject?.title }}</p></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar histórico" v-close-popup />
        </q-card-section>
        <q-card-section><AitoTokenHistory v-if="historyProject" :admin-project-id="historyProject.projectId" /></q-card-section>
      </q-card>
    </q-dialog>
    <LoginMfaDialog v-model="mfaOpen" :challenge="challenge" @verified="apply" />
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
