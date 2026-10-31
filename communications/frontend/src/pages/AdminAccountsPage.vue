<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth.js'
import { useWhiteLabel } from '../services/whitelabel.js'
import { errorMessage } from '../services/http.js'
import { adminAccountsApi } from '../services/admin-accounts.js'

const $q = useQuasar(), auth = useAuthStore(), { branding } = useWhiteLabel()
const rows = ref([]), loading = ref(false), saving = ref(false), dialog = ref(false), error = ref(''), formError = ref('')
const passwordVisible = ref(false), currentPasswordVisible = ref(false)
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })
const form = reactive({ email: '', conversationNick: '', password: '', passwordConfirm: '', currentPassword: '' })
const columns = [{ name: 'email', label: 'Administrador', field: 'email', align: 'left' }, { name: 'security', label: 'Validação por e-mail', field: 'emailMfaEnabled', align: 'left' }, { name: 'status', label: 'Situação', field: 'active', align: 'left' }, { name: 'lastLoginAt', label: 'Último acesso', field: 'lastLoginAt', align: 'left' }]
const required = value => Boolean(String(value || '').trim()) || 'Preencha este campo.'
const emailRule = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) || 'Informe um e-mail válido.'
const passwordRule = value => (value.length >= 12 && new TextEncoder().encode(value).length <= 72) || 'Use de 12 caracteres a 72 bytes.'
function date(value) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Ainda não acessou' }
async function load(next = pagination.value) {
  loading.value = true; error.value = ''
  try { const result = await adminAccountsApi.list({ page: next.page, limit: next.rowsPerPage }); rows.value = result.items || []; pagination.value = { ...next, rowsNumber: result.total || 0 } }
  catch (cause) { error.value = errorMessage(cause) } finally { loading.value = false }
}
function openCreate() {
  if (auth.isCollaborator) return
  Object.assign(form, { email: '', conversationNick: 'Administrador', password: '', passwordConfirm: '', currentPassword: '' })
  formError.value = ''; passwordVisible.value = false; currentPasswordVisible.value = false; dialog.value = true
}
function clearSecrets() { form.password = ''; form.passwordConfirm = ''; form.currentPassword = '' }
async function create() {
  saving.value = true; formError.value = ''
  try {
    await adminAccountsApi.create({ email: form.email.trim(), conversationNick: form.conversationNick.trim(), password: form.password, currentPassword: form.currentPassword })
    dialog.value = false; clearSecrets(); $q.notify({ type: 'positive', message: 'Novo acesso administrativo criado. Compartilhe a senha inicial por um canal seguro.' }); await load({ ...pagination.value, page: 1 })
  } catch (cause) { formError.value = errorMessage(cause); form.currentPassword = '' } finally { saving.value = false }
}
onMounted(() => load())
</script>

<template>
  <q-page class="admin-accounts-page">
    <header class="admin-accounts-heading"><div><span class="eyebrow">GOVERNANÇA</span><h1>Administradores</h1><p>Logins individuais para gerenciar o {{ branding.appName }}.</p></div><q-btn v-if="!auth.isCollaborator" no-caps unelevated color="primary" icon="person_add" label="Novo administrador" @click="openCreate" /></header>
    <q-banner rounded class="admin-accounts-notice"><template #avatar><q-icon name="admin_panel_settings" /></template><strong>Este acesso tem controle completo do sistema.</strong><div>Para acesso limitado por canal ou funcionalidade, cadastre um colaborador. A validação por e-mail é configurada por cada administrador em Início → Configurações.</div></q-banner>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ error }}<template #action><q-btn no-caps flat label="Tentar novamente" @click="load()" /></template></q-banner>
    <q-table flat wrap-cells class="admin-accounts-table" :rows="rows" :columns="columns" row-key="id" :loading="loading" v-model:pagination="pagination" :rows-per-page-options="[10,20,50]" @request="load($event.pagination)" no-data-label="Nenhum administrador encontrado" rows-per-page-label="Acessos por página">
      <template #body-cell-email="props"><q-td :props="props"><div class="account-identity"><q-avatar size="38px" icon="person" /><div><strong>{{ props.row.email }}</strong><small>{{ props.row.conversationNick }} <q-badge v-if="props.row.id === auth.user?.id" outline color="primary" label="Você" /></small><small v-if="props.row.envManaged" class="account-origin">Gerenciado pela configuração do servidor</small></div></div></q-td></template>
      <template #body-cell-security="props"><q-td :props="props"><q-chip dense :color="props.row.emailMfaEnabled ? 'green-1' : 'orange-1'" :text-color="props.row.emailMfaEnabled ? 'green-9' : 'orange-10'" :icon="props.row.emailMfaEnabled ? 'verified_user' : 'shield'">{{ props.row.emailMfaEnabled ? 'Ativada' : 'Não ativada' }}</q-chip></q-td></template>
      <template #body-cell-status="props"><q-td :props="props"><q-badge :color="props.row.active ? 'positive' : 'grey-6'" :label="props.row.active ? 'Ativo' : 'Inativo'" /></q-td></template>
      <template #body-cell-lastLoginAt="props"><q-td :props="props">{{ date(props.row.lastLoginAt) }}</q-td></template>
    </q-table>
    <q-dialog v-model="dialog" :persistent="saving" @hide="clearSecrets">
      <q-card class="admin-account-dialog">
        <header><q-avatar icon="person_add" /><div><h2>Novo administrador</h2><p>Um login próprio, com acesso completo ao {{ branding.appName }}.</p></div><q-btn flat round dense icon="close" aria-label="Fechar cadastro" :disable="saving" v-close-popup /></header>
        <q-form @submit="create" class="admin-account-form">
          <q-card-section class="admin-account-fields"><q-banner v-if="formError" rounded class="bg-red-1 text-negative" role="alert">{{ formError }}</q-banner>
            <q-input v-model="form.email" outlined type="email" label="E-mail do novo administrador" autocomplete="off" maxlength="254" :rules="[required,emailRule]" :disable="saving" />
            <q-input v-model="form.conversationNick" outlined label="Nome de assinatura nas conversas" maxlength="60" :rules="[required]" :disable="saving" />
            <q-input v-model="form.password" outlined :type="passwordVisible ? 'text' : 'password'" label="Senha inicial" autocomplete="new-password" :rules="[passwordRule]" :disable="saving"><template #append><q-btn flat round dense :icon="passwordVisible ? 'visibility_off' : 'visibility'" aria-label="Mostrar ou ocultar senha inicial" @click="passwordVisible = !passwordVisible" /></template></q-input>
            <q-input v-model="form.passwordConfirm" outlined type="password" label="Repita a senha inicial" autocomplete="new-password" :rules="[value => value === form.password || 'As senhas precisam ser iguais.']" :disable="saving" />
            <div class="admin-account-confirm"><q-icon name="lock" /><p>Confirme <strong>a sua senha atual</strong> para autorizar este novo acesso.</p></div>
            <q-input v-model="form.currentPassword" outlined :type="currentPasswordVisible ? 'text' : 'password'" label="Sua senha atual" autocomplete="current-password" :rules="[required]" :disable="saving"><template #append><q-btn flat round dense :icon="currentPasswordVisible ? 'visibility_off' : 'visibility'" aria-label="Mostrar ou ocultar sua senha atual" @click="currentPasswordVisible = !currentPasswordVisible" /></template></q-input>
            <p class="admin-account-note">As senhas não ficam visíveis após salvar. O novo administrador poderá entrar em /login e configurar sua própria validação por e-mail.</p>
          </q-card-section>
          <q-card-actions align="right"><q-btn no-caps flat label="Cancelar" :disable="saving" v-close-popup /><q-btn no-caps unelevated color="primary" type="submit" label="Criar acesso" :loading="saving" /></q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.admin-accounts-page{padding:clamp(16px,3vw,36px);max-width:1450px;margin:auto}.admin-accounts-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--brand-dark)}h1{font-size:30px;line-height:1.25;font-weight:750;margin:8px 0}.admin-accounts-heading p{margin:0;color:var(--muted);font-size:14px}.admin-accounts-notice{background:color-mix(in srgb,var(--brand) 9%,white);border:1px solid color-mix(in srgb,var(--brand) 20%,white);color:var(--ink);margin-bottom:24px;font-size:13px;line-height:1.7}.admin-accounts-notice .q-icon{color:var(--brand-dark)}.admin-accounts-notice strong{font-weight:700}.admin-accounts-table{border:1px solid var(--line);border-radius:18px;background:#fff;overflow:hidden}.account-identity{display:flex;align-items:center;gap:10px}.account-identity .q-avatar{background:color-mix(in srgb,var(--brand) 12%,white);color:var(--brand-dark);flex:none}.account-identity strong{font-size:13px;overflow-wrap:anywhere}.account-identity small{display:block;font-size:11px;color:var(--muted);margin-top:4px}.account-origin{font-style:italic}.admin-account-dialog{width:600px;max-width:calc(100vw - 24px);max-height:94dvh;border-radius:20px;border:1px solid color-mix(in srgb,var(--brand) 20%,white);background:linear-gradient(150deg,color-mix(in srgb,var(--brand) 6%,white),#fff 45%);color:var(--ink);display:flex;flex-direction:column;overflow:hidden}.admin-account-dialog>header{display:flex;align-items:center;gap:12px;padding:22px;border-bottom:1px solid var(--line)}.admin-account-dialog>header>.q-avatar{background:color-mix(in srgb,var(--brand) 15%,white);color:var(--brand-dark);flex:none}.admin-account-dialog>header>div{flex:1;min-width:0}.admin-account-dialog h2{font-size:20px;font-weight:750;line-height:1.3;margin:0 0 5px}.admin-account-dialog header p{font-size:12px;color:var(--muted);line-height:1.6;margin:0}.admin-account-form{overflow:auto;min-height:0}.admin-account-fields{display:grid;gap:5px;padding:22px}.admin-account-confirm{display:flex;align-items:center;gap:9px;font-size:12px;line-height:1.5;color:var(--brand-dark);padding:12px 0 5px}.admin-account-confirm p{margin:0}.admin-account-note{font-size:11px;color:var(--muted);line-height:1.7;margin:0}.admin-account-dialog .q-card__actions{padding:16px 20px;border-top:1px solid var(--line);position:sticky;bottom:0;background:color-mix(in srgb,var(--brand) 4%,white);z-index:1}@media(max-width:599px){.admin-accounts-heading{align-items:flex-start;flex-direction:column;gap:14px}.admin-accounts-heading>.q-btn{width:100%}h1{font-size:25px}.admin-accounts-table :deep(.q-table th),.admin-accounts-table :deep(.q-table td){padding:10px}.admin-account-dialog>header,.admin-account-fields{padding:18px}.admin-account-dialog h2{font-size:18px}}
</style>
