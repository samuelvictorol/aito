<template>
  <q-layout view="lHh Lpr lFf" class="admin-app">
    <q-page-container>
      <q-page class="admin-app__page">
        <div class="admin-app__shell">
          <header class="admin-app__header">
            <div class="admin-app__brand"><img src="/favicon.png" alt="" /><div><strong>AITOADMIN</strong></div></div>
            <div class="admin-app__session"><span>{{ firstName }}</span><q-btn flat round icon="mdi-logout" aria-label="Sair" @click="logout"><q-tooltip>Sair</q-tooltip></q-btn></div>
          </header>

          <section class="admin-app__hero" :class="{ 'admin-app__hero--compact': tab === 'whatsapp' }">
            <div><p class="admin-app__eyebrow">Painel admin</p></div>
            <div class="admin-app__stats"><span><strong>{{ leads.length }}</strong>Leads</span><span><strong>{{ users.length }}</strong>Usuarios</span><span><strong>{{ customers.length }}</strong>Clientes</span></div>
          </section>

          <q-tabs v-model="navigationTab" dense align="left" outside-arrows mobile-arrows class="admin-app__tabs" active-color="teal-3" indicator-color="teal-4">
            <q-tab name="projects" icon="mdi-folder-star-outline" label="Projetos" />
            <q-tab name="overview" icon="mdi-finance" label="Dashboard" />
            <q-tab name="detail" icon="mdi-view-grid-outline" label="Detalhar" />
            <q-tab name="whatsapp" icon="mdi-whatsapp" label="WhatsApp" />
            <q-tab name="botbuilder-licenses" icon="mdi-shield-key-outline" label="Licenças" />
            <q-tab name="lgpd" icon="mdi-shield-lock-outline" label="LGPD" />
          </q-tabs>

          <q-tab-panels v-model="tab" animated class="admin-app__panels">
            <q-tab-panel name="whatsapp" class="q-pa-none"><WhatsAppWorkspace /></q-tab-panel>
            <q-tab-panel name="botbuilder-licenses"><BotBuilderLicensesManager /></q-tab-panel>
            <q-tab-panel name="overview"><FinanceDashboard admin title="" /></q-tab-panel>

            <q-tab-panel name="detail">
              <section class="admin-app__section admin-detail-menu">
                <div class="admin-app__section-head"><div><p class="admin-app__eyebrow">Gestao detalhada</p></div></div>
                <div class="admin-detail-menu__grid">
                  <button v-for="item in detailOptions" :key="item.name" type="button" class="admin-detail-menu__item" @click="openDetail(item.name)"><q-icon :name="item.icon" size="26px" /><span>{{ item.label }}</span><small>{{ item.description }}</small><q-icon name="mdi-arrow-top-right" size="18px" class="admin-detail-menu__arrow" /></button>
                </div>
              </section>
            </q-tab-panel>

            <q-tab-panel name="leads">
              <section class="admin-app__section"><div class="admin-app__section-head"><div><p class="admin-app__eyebrow">01 / CAPTACAO</p></div><q-btn unelevated no-caps class="admin-app__primary" icon="mdi-plus" label="Cadastrar lead" @click="openLeadDialog()" /></div>
                <div class="admin-app__filters"><q-input v-model="leadSearch" outlined dense clearable label="Buscar por nome, email ou telefone" @keyup.enter="loadLeads"><template #prepend><q-icon name="mdi-magnify" /></template></q-input><q-select v-model="leadStatus" outlined dense clearable label="Status" :options="leadStatuses" emit-value map-options @update:model-value="loadLeads" /></div>
                <q-table flat bordered wrap-cells row-key="_id" class="admin-app__table" :rows="leads" :columns="leadColumns" :loading="loading.leads" :pagination.sync="leadPagination" no-data-label="Nenhum lead encontrado"><template #body-cell-type="props"><q-td :props="props"><span class="admin-app__tag">{{ props.row.flowType || props.row.source || 'landing' }}</span></q-td></template><template #body-cell-message="props"><q-td :props="props"><span class="admin-app__description">{{ preview(props.row.message) }}</span></q-td></template><template #body-cell-tags="props"><q-td :props="props"><span v-for="tag in props.row.tags || []" :key="tag" class="admin-app__tag">{{ tag }}</span></q-td></template><template #body-cell-actions="props"><q-td :props="props"><q-btn flat round dense icon="mdi-eye-outline" aria-label="Ver mensagem do lead" @click="openDetails(props.row)"><q-tooltip>Ver detalhes</q-tooltip></q-btn><q-btn flat round dense icon="mdi-pencil" aria-label="Editar lead" @click="openLeadDialog(props.row)" /><q-btn flat round dense color="negative" icon="mdi-delete-outline" aria-label="Excluir lead" @click="deleteLead(props.row)" /></q-td></template></q-table>
              </section>
            </q-tab-panel>

            <q-tab-panel v-for="personType in ['users', 'customers']" :key="personType" :name="personType">
              <section class="admin-app__section"><div class="admin-app__section-head"><div><p class="admin-app__eyebrow">{{ personType === 'users' ? '02 / AITOLEARN' : '03 / OPERACAO' }}</p></div><q-btn unelevated no-caps class="admin-app__primary" icon="mdi-account-plus-outline" :label="personType === 'users' ? 'Cadastrar usuario' : 'Cadastrar cliente'" @click="openPersonDialog(personType === 'customers' ? 'customer' : 'user')" /></div>
                <div class="admin-app__filters"><q-input v-model="personSearch" outlined dense clearable label="Buscar por nome, email ou telefone" @keyup.enter="loadPeople(personType === 'customers' ? 'customer' : 'user')"><template #prepend><q-icon name="mdi-magnify" /></template></q-input></div>
                <q-table flat bordered wrap-cells row-key="_id" class="admin-app__table" :rows="personType === 'users' ? users : customers" :columns="personColumns" :loading="loading[personType]" :pagination.sync="personPagination" no-data-label="Nenhum cadastro encontrado"><template #body-cell-role="props"><q-td :props="props"><span class="admin-app__tag">{{ props.row.role === 'customer' ? 'cliente' : 'usuario' }}</span></q-td></template><template #body-cell-active="props"><q-td :props="props"><q-icon :name="props.row.active ? 'mdi-check-circle' : 'mdi-close-circle'" :color="props.row.active ? 'positive' : 'negative'" /></q-td></template><template #body-cell-actions="props"><q-td :props="props"><q-btn flat round dense icon="mdi-pencil" aria-label="Editar cadastro" @click="openPersonDialog(props.row.role, props.row)" /><q-btn v-if="props.row.role === 'customer'" flat round dense icon="mdi-key-change" aria-label="Gerar nova senha" @click="generateCustomerPassword(props.row)"><q-tooltip>Gerar nova senha</q-tooltip></q-btn><q-btn flat round dense color="negative" icon="mdi-delete-outline" aria-label="Excluir cadastro" @click="deletePerson(props.row)" /></q-td></template></q-table>
              </section>
            </q-tab-panel>

            <q-tab-panel name="costs"><AdminCostManager /></q-tab-panel>
            <q-tab-panel name="tickets"><SupportTicketsPanel admin /></q-tab-panel>
            <q-tab-panel name="contracts"><ContractManager admin /></q-tab-panel>
            <q-tab-panel name="credentials"><CredentialManager admin /></q-tab-panel>
            <q-tab-panel name="projects"><ProjectManager admin /></q-tab-panel>
            <q-tab-panel name="invoices"><InvoiceManager admin /></q-tab-panel>
            <q-tab-panel name="courses"><CourseManager @open-payments="openCoursePayments" /></q-tab-panel>
            <q-tab-panel name="purchases"><CoursePurchaseManager :initial-course-id="purchaseCourseId" /></q-tab-panel>
            <q-tab-panel name="certificates"><CertificateManager /></q-tab-panel>
            <q-tab-panel name="course-comments"><CourseCommentManager /></q-tab-panel>
            <q-tab-panel name="affiliates"><AffiliateManager /></q-tab-panel>
            <q-tab-panel name="coupons"><CouponManager /></q-tab-panel>
            <q-tab-panel name="affiliate-purchases"><AffiliatePurchaseManager /></q-tab-panel>
            <q-tab-panel name="notifications"><AdminNotificationManager /></q-tab-panel>

            <q-tab-panel name="lgpd"><section class="admin-app__section"><div class="admin-app__section-head"><div><p class="admin-app__eyebrow">08 / GOVERNANCA</p></div><q-btn unelevated no-caps class="admin-app__primary" icon="mdi-content-save" label="Salvar documento" :loading="loading.policy" @click="savePolicy" /></div><div class="admin-app__policy-tabs"><button v-for="item in policies" :key="item.type" type="button" :class="{ 'is-active': policyDraft.type === item.type }" @click="selectPolicy(item)"><q-icon :name="item.type === 'privacy' ? 'mdi-shield-lock-outline' : 'mdi-file-document-outline'" /> {{ item.type === 'privacy' ? 'Politica de privacidade' : 'Termos de servico' }}</button></div><q-input v-model="policyDraft.title" outlined label="Titulo" /><q-input v-model="policyDraft.version" outlined label="Versao" class="q-mt-md" /><q-input v-model="policyDraft.content" outlined type="textarea" autogrow label="Conteudo" class="q-mt-md" /><div class="admin-app__policy-actions"><q-btn unelevated no-caps class="admin-app__primary" icon="mdi-content-save" label="Salvar" :loading="loading.policy" @click="savePolicy" /><q-btn flat no-caps color="negative" icon="mdi-delete-outline" label="Excluir documento salvo" @click="deletePolicy" /></div></section></q-tab-panel>
          </q-tab-panels>
        </div>
      </q-page>
    </q-page-container>

    <q-dialog v-model="leadDialog"><q-card class="admin-app__dialog"><q-card-section class="admin-app__dialog-head"><h3>{{ leadForm._id ? 'Editar lead' : 'Cadastrar lead' }}</h3><q-btn flat round dense icon="mdi-close" @click="leadDialog = false" /></q-card-section><q-card-section><q-form @submit.prevent="saveLead"><q-input v-model="leadForm.name" outlined label="Nome" :rules="[requiredRule]" /><q-input v-model="leadForm.email" outlined label="E-mail" class="q-mt-sm" /><q-input v-model="leadForm.phone" outlined label="Telefone" class="q-mt-sm" /><q-input v-model="leadForm.company" outlined label="Empresa" class="q-mt-sm" /><q-input v-model="leadForm.flowType" outlined label="Tipo do fluxo" class="q-mt-sm" /><q-input v-model="leadForm.message" outlined type="textarea" autogrow label="Mensagem" class="q-mt-sm" /><q-select v-model="leadForm.status" outlined label="Status" :options="leadStatuses" emit-value map-options class="q-mt-sm" /><q-btn unelevated no-caps type="submit" class="admin-app__primary full-width q-mt-md" label="Salvar lead" :loading="loading.save" /></q-form></q-card-section></q-card></q-dialog>

    <q-dialog v-model="personDialog"><q-card class="admin-app__dialog"><q-card-section class="admin-app__dialog-head"><h3>{{ personForm._id ? 'Editar cadastro' : personForm.role === 'customer' ? 'Cadastrar cliente' : 'Cadastrar usuario' }}</h3><q-btn flat round dense icon="mdi-close" @click="personDialog = false" /></q-card-section><q-card-section><q-form @submit.prevent="savePerson"><q-input v-model="personForm.name" outlined label="Nome" :rules="[requiredRule]" /><q-input v-model="personForm.email" outlined label="E-mail" type="email" class="q-mt-sm" :rules="[requiredRule]" /><q-input v-model="personForm.phone" outlined label="Telefone" class="q-mt-sm" :rules="[requiredRule]" /><q-input v-if="!personForm._id" v-model="personForm.password" outlined label="Senha inicial" type="password" class="q-mt-sm" :rules="[requiredRule]" /><q-toggle v-model="personForm.active" label="Acesso ativo" color="positive" class="q-mt-sm" /><q-btn unelevated no-caps type="submit" class="admin-app__primary full-width q-mt-md" label="Salvar cadastro" :loading="loading.save" /></q-form></q-card-section></q-card></q-dialog>
    <q-dialog v-model="detailDialog"><q-card class="admin-app__dialog"><q-card-section class="admin-app__dialog-head"><div><p class="admin-app__eyebrow">Detalhes do lead</p><h3>{{ selectedDetail.name || 'Lead' }}</h3></div><q-btn flat round dense icon="mdi-close" aria-label="Fechar" @click="detailDialog = false" /></q-card-section><q-card-section class="admin-app__detail-body"><p>{{ selectedDetail.message || 'Sem mensagem cadastrada.' }}</p><div><span>Contato</span><strong>{{ selectedDetail.email || selectedDetail.phone || '-' }}</strong></div></q-card-section></q-card></q-dialog>
    <GeneratedCredentialsDialog v-model="credentialsDialogOpen" :customer="generatedCredentials.customer" :password="generatedCredentials.password" />
  </q-layout>
</template>

<script>
import { canLeaveBotEditor } from 'src/services/bot-editor-guard'
import { api } from 'boot/axios'
import { defineAsyncComponent } from 'vue'
const WhatsAppWorkspace = defineAsyncComponent(() => import('components/whatsapp/WhatsAppWorkspace.vue'))
import FinanceDashboard from 'components/FinanceDashboard.vue'
import AdminCostManager from 'components/AdminCostManager.vue'
import SupportTicketsPanel from 'components/SupportTicketsPanel.vue'
import ContractManager from 'components/ContractManager.vue'
import CredentialManager from 'components/CredentialManager.vue'
import GeneratedCredentialsDialog from 'components/GeneratedCredentialsDialog.vue'
import ProjectManager from 'components/ProjectManager.vue'
import InvoiceManager from 'components/InvoiceManager.vue'
import CourseManager from 'components/CourseManager.vue'
import CoursePurchaseManager from 'components/CoursePurchaseManager.vue'
import CertificateManager from 'components/CertificateManager.vue'
import CourseCommentManager from 'components/CourseCommentManager.vue'
import AffiliateManager from 'components/AffiliateManager.vue'
import CouponManager from 'components/CouponManager.vue'
import AffiliatePurchaseManager from 'components/AffiliatePurchaseManager.vue'
import AdminNotificationManager from 'components/AdminNotificationManager.vue'
import BotBuilderLicensesManager from 'components/BotBuilderLicensesManager.vue'

export default {
  name: 'AdminPanelPage',
  components: { WhatsAppWorkspace, FinanceDashboard, AdminCostManager, SupportTicketsPanel, ContractManager, CredentialManager, ProjectManager, InvoiceManager, CourseManager, CoursePurchaseManager, CertificateManager, CourseCommentManager, AffiliateManager, CouponManager, AffiliatePurchaseManager, AdminNotificationManager, BotBuilderLicensesManager, GeneratedCredentialsDialog },
  data () {
    return {
      tab: 'projects', token: localStorage.getItem('aito_admin_token'), admin: {}, leads: [], users: [], customers: [], policies: [], purchaseCourseId: '', leadSearch: '', leadStatus: '', personSearch: '', leadDialog: false, personDialog: false, detailDialog: false, selectedDetail: {}, credentialsDialogOpen: false, generatedCredentials: { customer: {}, password: '' }, leadForm: this.emptyLead(), personForm: this.emptyPerson('user'), policyDraft: {},
      detailOptions: [{ name: 'courses', label: 'Cursos', description: 'Trilhas, aulas, materiais e marketplace.', icon: 'mdi-school-outline' }, { name: 'leads', label: 'Leads', description: 'Captacao e acompanhamento de oportunidades.', icon: 'mdi-account-multiple-outline' }, { name: 'users', label: 'Usuarios', description: 'Acessos, perfis e contas AitoLearn.', icon: 'mdi-account-outline' }, { name: 'customers', label: 'Clientes', description: 'Cadastros e acessos de clientes.', icon: 'mdi-briefcase-outline' }, { name: 'costs', label: 'Custos', description: 'Lancamentos financeiros e anexos.', icon: 'mdi-cash-multiple' }, { name: 'tickets', label: 'Chamados e saques', description: 'Suporte e solicitações de saque.', icon: 'mdi-lifebuoy' }, { name: 'contracts', label: 'Contratos', description: 'Documentos e acordos vinculados.', icon: 'mdi-file-document-outline' }, { name: 'credentials', label: 'Credenciais', description: 'Chaves e acessos compartilhados.', icon: 'mdi-key-chain-variant' }, { name: 'invoices', label: 'Notas fiscais', description: 'Documentos fiscais e valores emitidos.', icon: 'mdi-receipt-text-outline' }, { name: 'purchases', label: 'Compras de cursos', description: 'Pagamentos e interesse por curso.', icon: 'mdi-cart-check-outline' }, { name: 'certificates', label: 'Certificados', description: 'Certificados gerados e verificacao.', icon: 'mdi-certificate-outline' }, { name: 'course-comments', label: 'Comentarios', description: 'Moderacao das conversas nas aulas.', icon: 'mdi-comment-text-multiple-outline' }, { name: 'affiliates', label: 'Afiliados', description: 'Parceiros, perfis e acessos.', icon: 'mdi-account-star-outline' }, { name: 'coupons', label: 'Cupons', description: 'Descontos e vínculos monitorados.', icon: 'mdi-ticket-percent-outline' }, { name: 'affiliate-purchases', label: 'Vendas afiliadas', description: 'Compras com ou sem cupom.', icon: 'mdi-chart-line' }, { name: 'notifications', label: 'Notificações', description: 'Envios manuais pelo sininho.', icon: 'mdi-bell-outline' }],
      leadStatuses: [{ label: 'Novo', value: 'new' }, { label: 'Contatado', value: 'contacted' }, { label: 'Qualificado', value: 'qualified' }, { label: 'Fechado', value: 'closed' }],
      leadColumns: [{ name: 'name', label: 'Nome', field: 'name', align: 'left', sortable: true }, { name: 'email', label: 'Contato', field: row => row.email || row.phone || '-', align: 'left' }, { name: 'type', label: 'Tipo', field: 'flowType', align: 'left' }, { name: 'message', label: 'Mensagem', field: 'message', align: 'left' }, { name: 'tags', label: 'Tags', field: 'tags', align: 'left' }, { name: 'status', label: 'Status', field: 'status', align: 'left' }, { name: 'createdAt', label: 'Entrada', field: row => this.formatDate(row.createdAt), align: 'left' }, { name: 'actions', label: '', align: 'right' }],
      personColumns: [{ name: 'name', label: 'Nome', field: 'name', align: 'left', sortable: true }, { name: 'email', label: 'E-mail', field: 'email', align: 'left' }, { name: 'phone', label: 'Telefone', field: 'phone', align: 'left' }, { name: 'role', label: 'Tipo', field: 'role', align: 'left' }, { name: 'active', label: 'Ativo', field: 'active', align: 'center' }, { name: 'actions', label: '', align: 'right' }],
      leadPagination: { page: 1, rowsPerPage: 8 }, personPagination: { page: 1, rowsPerPage: 8 }, loading: { leads: false, users: false, customers: false, policy: false, save: false }
    }
  },
  computed: {
    firstName () { return String(this.admin.name || 'Admin Aito').trim().split(/\s+/)[0] },
    headers () { return { headers: { Authorization: `Bearer ${this.token}` } } },
    navigationTab: {
      get () { return ['projects', 'overview', 'detail', 'lgpd', 'whatsapp', 'botbuilder-licenses'].includes(this.tab) ? this.tab : 'detail' },
      set (value) { if (value !== this.tab && canLeaveBotEditor()) this.tab = value }
    }
  },
  mounted () {
    try { this.admin = JSON.parse(localStorage.getItem('aito_admin_user') || '{}') } catch (error) { this.admin = {} }
    this.loadAll()
  },
  methods: {
    emptyLead () { return { name: '', email: '', phone: '', company: '', message: '', flowType: '', status: 'new', tags: [] } },
    emptyPerson (role) { return { name: '', email: '', phone: '', password: '', active: true, role } },
    requiredRule (value) { return Boolean(String(value || '').trim()) || 'Preencha este campo.' },
    formatDate (value) { return value ? new Date(value).toLocaleDateString('pt-BR') : '-' },
    preview (value) { const text = String(value || '').trim(); return text.length > 48 ? `${text.slice(0, 48)}...` : text || '-' },
    async loadAll () { await Promise.all([this.loadLeads(), this.loadPeople('user'), this.loadPeople('customer'), this.loadPolicies()]) },
    async loadLeads () { this.loading.leads = true; try { const { data } = await api.get('/admin/leads', { ...this.headers, params: { q: this.leadSearch, status: this.leadStatus } }); this.leads = data.data || [] } catch (error) { this.notifyError(error) } finally { this.loading.leads = false } },
    async loadPeople (role) { const key = role === 'customer' ? 'customers' : 'users'; this.loading[key] = true; try { const { data } = await api.get(`/admin/${key}`, { ...this.headers, params: { q: this.personSearch } }); this[key] = data.data || [] } catch (error) { this.notifyError(error) } finally { this.loading[key] = false } },
    async loadPolicies () { try { const { data } = await api.get('/admin/policies', this.headers); this.policies = data.data || []; this.selectPolicy(this.policies[0]) } catch (error) { this.notifyError(error) } },
    selectPolicy (policy) { if (policy) this.policyDraft = { ...policy } },
    openDetail (name) { this.tab = name },
    openCoursePayments (course) { this.purchaseCourseId = course?._id || ''; this.tab = 'purchases' },
    openLeadDialog (lead) { this.leadForm = lead ? { ...lead } : this.emptyLead(); this.leadDialog = true },
    openDetails (lead) { this.selectedDetail = lead; this.detailDialog = true },
    async saveLead () { this.loading.save = true; try { const id = this.leadForm._id; const result = id ? await api.put(`/admin/leads/${id}`, this.leadForm, this.headers) : await api.post('/admin/leads', this.leadForm, this.headers); if (id) this.leads = this.leads.map(item => item._id === id ? result.data.data : item); else this.leads.unshift(result.data.data); this.leadDialog = false; this.$q.notify({ type: 'positive', message: 'Lead salvo.' }) } catch (error) { this.notifyError(error) } finally { this.loading.save = false } },
    deleteLead (lead) { this.$q.dialog({ title: 'Excluir lead', message: `Remover ${lead.name}?`, cancel: true, persistent: true }).onOk(async () => { try { await api.delete(`/admin/leads/${lead._id}`, this.headers); this.leads = this.leads.filter(item => item._id !== lead._id); this.$q.notify({ type: 'positive', message: 'Lead removido.' }) } catch (error) { this.notifyError(error) } }) },
    openPersonDialog (role, person) { this.personForm = person ? { ...person, password: '' } : this.emptyPerson(role); this.personDialog = true },
    async savePerson () { this.loading.save = true; const role = this.personForm.role; const resource = role === 'customer' ? 'customers' : 'users'; try { const id = this.personForm._id; const result = id ? await api.put(`/admin/${resource}/${id}`, this.personForm, this.headers) : await api.post(`/admin/${resource}`, this.personForm, this.headers); const key = role === 'customer' ? 'customers' : 'users'; if (id) this[key] = this[key].map(item => item._id === id ? result.data.data : item); else this[key].unshift(result.data.data); this.personDialog = false; this.$q.notify({ type: 'positive', message: 'Cadastro salvo.' }) } catch (error) { this.notifyError(error) } finally { this.loading.save = false } },
    generateCustomerPassword (customer) { this.$q.dialog({ title: 'Gerar nova senha', message: `A senha atual de ${customer.name} sera substituida. Continuar?`, cancel: true, persistent: true }).onOk(async () => { try { const { data } = await api.post(`/admin/customers/${customer._id}/generate-password`, {}, this.headers); this.generatedCredentials = { customer: data.data, password: data.temporaryPassword }; this.credentialsDialogOpen = true; this.$q.notify({ type: 'positive', message: 'Nova senha gerada.' }) } catch (error) { this.notifyError(error) } }) },
    deletePerson (person) { const role = person.role === 'customer' ? 'customers' : 'users'; this.$q.dialog({ title: 'Excluir cadastro', message: `Remover ${person.name}?`, cancel: true, persistent: true }).onOk(async () => { try { await api.delete(`/admin/${role}/${person._id}`, this.headers); this[role] = this[role].filter(item => item._id !== person._id); this.$q.notify({ type: 'positive', message: 'Cadastro removido.' }) } catch (error) { this.notifyError(error) } }) },
    async savePolicy () { this.loading.policy = true; try { const { data } = await api.put(`/admin/policies/${this.policyDraft.type}`, this.policyDraft, this.headers); this.policyDraft = data.data; this.policies = this.policies.map(item => item.type === data.data.type ? data.data : item); this.$q.notify({ type: 'positive', message: 'Documento atualizado.' }) } catch (error) { this.notifyError(error) } finally { this.loading.policy = false } },
    deletePolicy () { this.$q.dialog({ title: 'Excluir documento', message: 'A rota publica usara o texto padrao.', cancel: true, persistent: true }).onOk(async () => { try { await api.delete(`/admin/policies/${this.policyDraft.type}`, this.headers); await this.loadPolicies(); this.$q.notify({ type: 'positive', message: 'Documento excluido.' }) } catch (error) { this.notifyError(error) } }) },
    notifyError (error) { this.$q.notify({ type: 'negative', message: error.response?.data?.message || 'Nao foi possivel concluir a operacao.' }) },
    logout () { if (!canLeaveBotEditor()) return; localStorage.removeItem('aito_admin_token'); localStorage.removeItem('aito_admin_user'); this.$router.push('/admin/login') }
  }
}
</script>

<style scoped>
.admin-app { color: #ebfffb; background: #03090b; }
.admin-app__page { min-height: 100vh; background: radial-gradient(circle at 90% 0, rgba(19,188,157,.12), transparent 30rem), linear-gradient(rgba(19,188,157,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(19,188,157,.045) 1px, transparent 1px), #03090b; background-size: auto, 72px 72px, 72px 72px, auto; }
.admin-app__shell { width: min(1380px, calc(100% - 2rem)); margin: auto; padding: 1rem 0 3rem; }
.admin-app__header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,188,157,.2); }
.admin-app__brand, .admin-app__session { display: flex; align-items: center; gap: .7rem; }
.admin-app__brand img { width: 36px; height: 36px; }
.admin-app__brand strong { display: block; color: #effffb; font-size: .78rem; letter-spacing: .12em; }
.admin-app__brand small { display: block; margin-top: .2rem; color: rgba(229,255,250,.55); font-size: .65rem; }
.admin-app__session { color: #8fffee; font-size: .76rem; }
.admin-app__hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; padding: 7vh 0 2.5rem; }
.admin-app__hero--compact { padding: 1rem 0; align-items: center; }
.admin-app__hero--compact .admin-app__stats { display: none; }
.admin-app__hero--compact .admin-app__eyebrow { margin: 0; }
.admin-app .admin-app__hero.admin-app__hero--compact { padding: 1rem 0; align-items: center; }
.admin-app__eyebrow { margin: 0 0 .7rem; color: #8fffee; font-size: .67rem; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
.admin-app__hero h1, .admin-app__section h2 { margin: 0; color: #effffb; font-size: clamp(2rem, 4vw, 4rem); line-height: 1; }
.admin-app__hero p:last-child, .admin-app__section-head span { max-width: 32rem; color: rgba(229,255,250,.62); line-height: 1.5; font-size: .8rem; }
.admin-app__stats { display: flex; gap: .6rem; }
.admin-app__stats span { display: grid; gap: .25rem; min-width: 5rem; padding: .7rem; border: 1px solid rgba(19,188,157,.22); border-radius: .55rem; color: rgba(229,255,250,.58); font-size: .66rem; }
.admin-app__stats strong { color: #8fffee; font-size: 1.2rem; }
.admin-app__tabs { border: 1px solid rgba(19,188,157,.2); border-radius: .7rem .7rem 0 0; background: rgba(3,25,26,.7); }
.admin-app__tabs :deep(.q-tab) { min-height: 68px; padding: .55rem 1.15rem; color: rgba(239,255,251,.68); transition: color .2s ease, background .2s ease; }
.admin-app__tabs :deep(.q-tab:hover) { color: #effffb; background: rgba(19,188,157,.08); }
.admin-app__tabs :deep(.q-tab--active) { color: #8fffee; background: rgba(19,188,157,.12); }
.admin-app__tabs :deep(.q-tab__icon) { margin-bottom: .2rem; font-size: 1.35rem; }
.admin-app__tabs :deep(.q-tab__label) { font-size: .72rem; font-weight: 800; letter-spacing: .02em; }
.admin-app__panels { border: 1px solid rgba(19,188,157,.2); border-top: 0; border-radius: 0 0 .7rem .7rem; background: rgba(3,25,26,.7); }
.admin-app__section { padding: .5rem; }
.admin-app__section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.4rem; }
.admin-app__primary { color: #03110f; background: linear-gradient(135deg, #8fffee, #13bc9d); font-weight: 800; }
.admin-app__filters { display: grid; grid-template-columns: minmax(240px, 1fr) 180px; gap: .7rem; margin-bottom: 1rem; }
.admin-app__filters :deep(.q-field__control), .admin-app__dialog :deep(.q-field__control), .admin-app__section :deep(.q-field__control) { color: #effffb; background: rgba(7,40,40,.74); }
.admin-app__filters :deep(.q-field__native), .admin-app__filters :deep(.q-field__label), .admin-app__dialog :deep(.q-field__native), .admin-app__dialog :deep(.q-field__label), .admin-app__section :deep(.q-field__native), .admin-app__section :deep(.q-field__label) { color: rgba(239,255,251,.78); }
.admin-app__table { color: #effffb; border-color: rgba(19,188,157,.2); background: rgba(3,16,18,.58); }
.admin-app__table :deep(th) { color: #8fffee; font-size: .7rem; }
.admin-app__table :deep(td) { color: rgba(239,255,251,.78); font-size: .72rem; }
.admin-app__tag { display: inline-block; margin: .1rem; padding: .25rem .4rem; border: 1px solid rgba(19,188,157,.26); border-radius: 999px; color: #8fffee; background: rgba(19,188,157,.08); font-size: .6rem; }
.admin-app__description { display: inline-block; max-width: 18rem; white-space: normal; }
.admin-app__overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: .8rem; }
.admin-app__policy-tabs { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.2rem; }
.admin-app__policy-tabs button { display: inline-flex; align-items: center; gap: .4rem; padding: .65rem .8rem; border: 1px solid rgba(19,188,157,.22); border-radius: .55rem; color: rgba(239,255,251,.68); background: rgba(19,188,157,.06); cursor: pointer; font: inherit; font-size: .7rem; }
.admin-app__policy-tabs button.is-active { color: #03110f; background: linear-gradient(135deg, #8fffee, #13bc9d); font-weight: 800; }
.admin-app__policy-actions { display: flex; gap: .6rem; margin-top: 1rem; }
.admin-app__dialog { width: min(94vw, 540px); color: #effffb; background: #061819; border: 1px solid rgba(19,188,157,.3); }
.admin-app__dialog-head { display: flex; align-items: center; justify-content: space-between; }
.admin-app__dialog h3 { margin: 0; font-size: 1.1rem; }
.admin-app__detail-body { display: grid; gap: .8rem; color: rgba(239,255,251,.82); }
.admin-app__detail-body p { margin: 0; white-space: pre-wrap; line-height: 1.6; }
.admin-app__detail-body div { display: flex; justify-content: space-between; gap: 1rem; padding-top: .7rem; border-top: 1px solid rgba(143,255,238,.1); }
.admin-app__detail-body span { color: rgba(229,255,250,.58); }
.admin-detail-menu__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
.admin-detail-menu__item { position: relative; display: grid; gap: .45rem; min-height: 138px; padding: 1rem; border: 1px solid rgba(19,188,157,.22); border-radius: .7rem; color: #effffb; background: linear-gradient(145deg, rgba(9,48,47,.76), rgba(3,20,21,.72)); text-align: left; cursor: pointer; font: inherit; transition: border-color .2s ease, transform .2s ease, background .2s ease, box-shadow .2s ease; }
.admin-detail-menu__item:hover, .admin-detail-menu__item:focus-visible { border-color: rgba(143,255,238,.7); background: linear-gradient(145deg, rgba(13,75,70,.82), rgba(3,24,25,.78)); box-shadow: 0 12px 28px rgba(0,0,0,.18), 0 0 22px rgba(19,188,157,.1); transform: translateY(-2px); outline: none; }
.admin-detail-menu__item > .q-icon:first-child { color: #50dcc4; }
.admin-detail-menu__item span { color: #8fffee; font-size: .82rem; font-weight: 900; }
.admin-detail-menu__item small { max-width: 22ch; color: rgba(229,255,250,.58); font-size: .68rem; line-height: 1.45; }
.admin-detail-menu__arrow { position: absolute; right: .8rem; bottom: .8rem; color: #8fffee; }
@media (max-width: 900px) { .admin-app__hero, .admin-app__section-head { align-items: flex-start; flex-direction: column; } .admin-app__stats { width: 100%; flex-wrap: wrap; } .admin-app__stats span { flex: 1; } .admin-app__filters { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .admin-detail-menu__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .admin-app__overview { grid-template-columns: 1fr; } .admin-app__brand small { display: none; } .admin-app__hero { padding-top: 5vh; } .admin-detail-menu__grid { grid-template-columns: 1fr; } .admin-detail-menu__item { min-height: 112px; } }
.admin-app__panels:has(.builder-page),.admin-app__panels :deep(.q-panel:has(.builder-page)){overflow:visible}
</style>
