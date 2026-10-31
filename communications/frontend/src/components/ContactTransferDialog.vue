<script setup>
import { canAction } from '../services/access.js'
import { getStoredUser } from '../services/tokens.js'
import { vCanAction } from '../services/permission-directives.js'
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { errorMessage, http, unwrap } from '../services/http.js'

const props = defineProps({ modelValue: Boolean, groups: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'imported'])
const $q = useQuasar()
const tab = ref('import')
const file = ref(null)
const sheet = ref(null)
const sheets = ref([])
const busy = ref(false)
const groupMode = ref('new')
const groupId = ref(null)
const groupName = ref('')
const report = ref(null)
const feedback = ref('')
const onlyIssues = ref(false)
const authorizeChannels = ref(true)
const exportMode = ref('all')
const exportGroups = ref([])
const groupOptions = computed(() => props.groups.map((group) => ({ label: group.name, value: group.id || group._id })))
const importGroups = computed(() => props.groups.filter((group) => group.source === 'manual' && group.active && !group.sourceInviteId && !group.sourceInvite).map((group) => ({ label: group.name, value: group.id || group._id })))
const readyCount = computed(() => ['created', 'updated', 'unchanged'].reduce((total, key) => total + (report.value?.summary?.[key] || 0), 0))
const groupValid = computed(() => groupMode.value === 'none' || (groupMode.value === 'existing' ? Boolean(groupId.value) : Boolean(groupName.value.trim()) && groupName.value.trim().length <= 200))
const visibleRows = computed(() => onlyIssues.value ? (report.value?.rows || []).filter((row) => ['invalid', 'conflict'].includes(row.status)) : report.value?.rows || [])
const labels = { created: 'Novo', updated: 'Atualizar', unchanged: 'Já cadastrado', duplicate: 'Repetido no arquivo', invalid: 'Revisar dados', conflict: 'Conflito de cadastro' }
const columns = [
  { name: 'row', label: 'Linha', field: 'row', align: 'left', sortable: true },
  { name: 'displayName', label: 'Nome', field: 'displayName', align: 'left' },
  { name: 'phone', label: 'Telefone normalizado', field: 'phone', align: 'left' },
  { name: 'email', label: 'E-mail', field: 'email', align: 'left' },
  { name: 'status', label: 'Resultado', field: (row) => labels[row.status], align: 'left' },
  { name: 'message', label: 'Observação', field: 'message', align: 'left' },
]

watch(() => props.modelValue, (opened) => {
  if (!opened) return
  tab.value=canAction(getStoredUser(),'contacts','import')?'import':'export'
  file.value = null
  sheet.value = null
  sheets.value = []
  report.value = null
  feedback.value = ''
  groupMode.value = 'new'
  groupName.value = ''
  groupId.value = null
  onlyIssues.value = false
  authorizeChannels.value = canAction(getStoredUser(),'contacts','permissions')
})
watch(file, (value) => {
  report.value = null
  feedback.value = ''
  sheet.value = null
  sheets.value = []
  if (value) groupName.value = value.name.replace(/\.xlsx$/i, '').slice(0, 200)
})

function changeSheet(value) {
  sheet.value = value
  report.value = null
}

async function runImport(commit = false) {
  if (!canAction(getStoredUser(),'contacts','import') || !file.value || (commit && (!groupValid.value || !readyCount.value))) return
  busy.value = true
  feedback.value = ''
  try {
    const data = new FormData()
    data.append('file', file.value)
    data.append('commit', String(commit))
    data.append('authorizeChannels', String(authorizeChannels.value))
    if (sheet.value) data.append('sheet', sheet.value)
    if (commit && groupMode.value === 'existing') data.append('groupId', groupId.value)
    if (commit && groupMode.value === 'new') data.append('groupName', groupName.value.trim())
    report.value = unwrap(await http.post('/contacts/import', data, { timeout: 300000 }))
    sheets.value = report.value.sheets
    sheet.value = report.value.sheet
    if (commit) {
      emit('imported')
      $q.notify({ type: 'positive', message: 'Importação concluída. Confira o resumo e as linhas que precisam de revisão.' })
    }
  } catch (error) { feedback.value = errorMessage(error, 'Não foi possível importar a planilha.') }
  finally { busy.value = false }
}

async function download() {
  if(!canAction(getStoredUser(),'contacts','export'))return
  busy.value = true
  feedback.value = ''
  try {
    const response = await http.get('/contacts/export', {
      responseType: 'blob', timeout: 120000,
      params: exportMode.value === 'groups' ? { groupIds: exportGroups.value.join(',') } : {},
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'aitonotify-contatos.xlsx'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    $q.notify({ type: 'positive', message: 'Planilha de contatos preparada para download.' })
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()) } catch { /* Keep the original download error. */ }
    }
    feedback.value = errorMessage(error, 'Não foi possível exportar os contatos.')
  } finally { busy.value = false }
}
</script>

<template>
  <q-dialog :model-value="modelValue" :persistent="busy" :maximized="$q.screen.lt.sm" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="contact-transfer">
      <q-card-section class="transfer-heading">
        <div><div class="text-h6 text-weight-bold">Contatos por planilha</div><p>Importe sua lista ou baixe os contatos organizados por grupo.</p></div>
        <q-btn flat round icon="close" aria-label="Fechar importação e exportação" :disable="busy" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-tabs v-model="tab" no-caps align="left" active-color="primary" :disable="busy" class="q-px-md">
        <q-tab v-if="canAction(getStoredUser(),'contacts','import')" name="import" label="Importar contatos" icon="upload_file" :disable="busy" />
        <q-tab v-if="canAction(getStoredUser(),'contacts','export')" name="export" label="Exportar contatos" icon="download" :disable="busy" />
      </q-tabs>
      <q-separator />
      <q-card-section class="transfer-content">
        <q-banner v-if="feedback" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ feedback }}</q-banner>
        <div v-if="tab === 'import'" class="transfer-stack">
          <div class="transfer-note">
            <strong>1. Escolha uma planilha .xlsx</strong>
            <p>A primeira linha deve conter Nome (ou Nome completo), Telefone e E-mail. Cada pessoa precisa de nome e pelo menos telefone ou e-mail. Até 5 MB e 5.000 linhas por arquivo.</p>
            <p>Telefones brasileiros recebem o DDI 55. Pontuação e prefixo 0 são normalizados; números incompletos ficam para revisão.</p>
          </div>
          <q-file v-model="file" outlined clearable accept=".xlsx" :max-file-size="5242880" :disable="busy" label="Arquivo de contatos" @rejected="feedback = 'Escolha um arquivo .xlsx de até 5 MB.'">
            <template #prepend><q-icon name="table_view" color="primary" /></template>
          </q-file>
          <q-select v-if="sheets.length > 1" :model-value="sheet" :options="sheets" outlined label="Aba da planilha" :disable="busy" @update:model-value="changeSheet" />
          <q-btn v-if="!report" unelevated color="primary" no-caps icon="fact_check" label="Conferir planilha" :loading="busy" :disable="!file" v-can-action="'contacts.import'" @click="runImport(false)" />
          <template v-if="report">
            <div class="summary-grid" aria-live="polite">
              <div><strong>{{ report.summary.created }}</strong><span>{{ report.preview ? 'Novos contatos' : 'Cadastrados' }}</span></div>
              <div><strong>{{ report.summary.updated }}</strong><span>{{ report.preview ? 'Atualizações' : 'Atualizados' }}</span></div>
              <div><strong>{{ report.summary.unchanged }}</strong><span>Já cadastrados</span></div>
              <div><strong>{{ report.summary.duplicate }}</strong><span>Repetidos no arquivo</span></div>
              <div :class="{ 'summary-issues': report.summary.invalid + report.summary.conflict }"><strong>{{ report.summary.invalid + report.summary.conflict }}</strong><span>Para revisão</span></div>
            </div>
            <div v-if="report.preview" class="transfer-stack transfer-note">
              <strong>2. Organize os contatos importados</strong>
              <q-option-group v-model="groupMode" inline color="primary" :disable="busy" :options="[{ label: 'Criar grupo', value: 'new' }, { label: 'Vincular a grupo', value: 'existing' }, { label: 'Sem grupo', value: 'none' }]" />
              <q-input v-if="groupMode === 'new'" v-model="groupName" outlined maxlength="200" counter label="Nome do grupo" :disable="busy" hint="Se já existir um grupo manual ativo com esse nome, ele será reutilizado." />
              <q-select v-if="groupMode === 'existing'" v-model="groupId" :options="importGroups" emit-value map-options outlined label="Grupo para vincular" :disable="busy" />
              <p>Os nomes serão atualizados e os dados ausentes, preenchidos. Telefones e e-mails conflitantes ficam para revisão. Grupos anteriores e pedidos de descadastro são preservados.</p>
              <q-toggle v-model="authorizeChannels" label="Habilitar WhatsApp, e-mail e Telegram disponível" color="primary" :disable="busy||!canAction(getStoredUser(),'contacts','permissions')" @update:model-value="runImport(false)" />
              <p>A habilitação fica registrada em seu nome como decisão administrativa. O Telegram exige um vínculo já identificado pelo bot. Permissões revogadas ou negadas não são reativadas pela planilha.</p>
              <q-btn color="primary" unelevated no-caps icon="people_alt" :label="`Importar ${readyCount} contatos válidos`" :loading="busy" :disable="!readyCount || !groupValid" v-can-action="'contacts.import'" @click="runImport(true)" />
              <p v-if="report.summary.invalid + report.summary.conflict">As linhas com pendências não serão importadas. Corrija os dados e envie a planilha novamente depois.</p>
            </div>
            <q-banner v-else rounded class="bg-green-1 text-positive" role="status">
              Importação concluída. {{ report.linked }} contatos vinculados{{ report.group ? ` ao grupo ${report.group.name}` : '' }}.
            </q-banner>
            <q-toggle v-model="onlyIssues" label="Mostrar apenas linhas para revisão" color="primary" />
            <q-table flat bordered wrap-cells :rows="visibleRows" :columns="columns" row-key="row" :grid="$q.screen.lt.sm" :rows-per-page-options="[10, 25, 50]" rows-per-page-label="Linhas por página:" :pagination-label="(start, end, total) => `${start}–${end} de ${total}`" class="import-preview">
              <template #body-cell-status="scope"><q-td :props="scope"><q-badge :color="['invalid', 'conflict'].includes(scope.row.status) ? 'negative' : scope.row.status === 'created' ? 'positive' : 'primary'">{{ labels[scope.row.status] }}</q-badge></q-td></template>
              <template #no-data><div class="q-pa-md text-grey-7">Nenhuma linha neste filtro.</div></template>
            </q-table>
          </template>
        </div>
        <div v-else class="transfer-stack">
          <div class="transfer-note"><strong>Baixe a sua base de contatos</strong><p>A planilha terá Nome, Telefone, E-mail e Grupos. Os telefones são exportados como texto, preservando todos os dígitos.</p></div>
          <q-option-group v-model="exportMode" color="primary" :disable="busy" :options="[{ label: 'Todos os contatos', value: 'all' }, { label: 'Selecionar grupos', value: 'groups' }]" />
          <q-select v-if="exportMode === 'groups'" v-model="exportGroups" multiple use-chips emit-value map-options outlined :options="groupOptions" label="Grupos para exportar" :disable="busy" />
          <p class="text-grey-7">Uma pessoa vinculada a vários grupos aparece uma vez. A quarta coluna lista todos os grupos vinculados a ela.</p>
          <q-btn color="primary" unelevated no-caps icon="download" label="Baixar contatos em Excel" :loading="busy" :disable="exportMode === 'groups' && !exportGroups.length" v-can-action="'contacts.export'" @click="download" />
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-pa-md"><q-btn flat no-caps label="Fechar" :disable="busy" @click="emit('update:modelValue', false)" /></q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.contact-transfer { width: 1080px; max-width: 96vw; max-height: 92vh; display: flex; flex-direction: column; border-radius: 20px; }
.transfer-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.transfer-heading p { margin: 4px 0 0; color: #526777; }
.transfer-content { overflow: auto; min-height: 0; }
.transfer-stack { display: grid; gap: 18px; }
.transfer-note { border: 1px solid rgba(53, 188, 164, .2); background: #f3fcf9; border-radius: 14px; padding: 16px; color: #244b44; }
.transfer-note p { margin: 7px 0 0; line-height: 1.55; }
.summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.summary-grid > div { display: grid; gap: 3px; border: 1px solid #dce7ec; border-radius: 12px; padding: 14px; }
.summary-grid strong { font-size: 1.6rem; color: var(--q-primary); }
.summary-grid span { color: #526777; font-size: .8rem; }
.summary-issues { background: #fff6ec; }
.import-preview :deep(td) { max-width: 250px; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .contact-transfer { width: 100vw; max-width: 100vw; max-height: 100dvh; border-radius: 0; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-grid > div:last-child { grid-column: 1 / -1; }
  .transfer-heading { padding: 16px; }
}
</style>
