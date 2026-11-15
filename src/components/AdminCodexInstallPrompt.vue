<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { codexDefaultSetupPrompt, codexSetupPromptLimit } from 'src/services/aitoCodexInstall'
import { financeHeaders } from 'src/services/purchase-history'

const $q = useQuasar()
const endpoint = '/admin/codex-install-prompt'
const controller = new AbortController()
const revision = ref(null)
const savedPrompt = ref(null)
const draft = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const requestOptions = () => ({ ...financeHeaders(true), signal: controller.signal, timeout: 12000 })
const nextPrompt = computed(() => draft.value.trim() === codexDefaultSetupPrompt ? null : draft.value.trim())
const dirty = computed(() => revision.value !== null && nextPrompt.value !== savedPrompt.value)
const valid = computed(() => nextPrompt.value === null || (nextPrompt.value.length > 0 && nextPrompt.value.length <= codexSetupPromptLimit))

function apply({ prompt, revision: nextRevision }) {
  savedPrompt.value = prompt
  draft.value = prompt ?? codexDefaultSetupPrompt
  revision.value = nextRevision
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(endpoint, requestOptions())
    apply(data.data)
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível carregar o prompt.'
  } finally { loading.value = false }
}

async function save() {
  if (loading.value || saving.value || !dirty.value || !valid.value) return
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.put(endpoint, { prompt: nextPrompt.value, revision: revision.value }, requestOptions())
    apply(data.data)
    $q.notify({ type: 'positive', message: 'Prompt de instalação atualizado.' })
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.status === 409
      ? 'O prompt foi alterado em outra sessão. Recarregue antes de salvar novamente.'
      : cause.response?.data?.message || 'Não foi possível salvar o prompt.'
  } finally { saving.value = false }
}

function reload() {
  if (!dirty.value) return load()
  $q.dialog({ title: 'Recarregar o prompt?', message: 'As alterações em edição serão descartadas.', cancel: true }).onOk(load)
}

onMounted(load)
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <section class="admin-codex-prompt" aria-labelledby="admin-codex-prompt-title">
    <header>
      <h2 id="admin-codex-prompt-title">Prompt de instalação do Codex</h2>
      <q-btn flat round icon="mdi-refresh" aria-label="Recarregar prompt" :loading="loading" :disable="saving" @click="reload" />
    </header>
    <q-banner v-if="error" rounded class="admin-codex-prompt__error" role="alert">{{ error }}</q-banner>
    <q-form v-if="revision !== null" @submit.prevent="save">
      <q-card flat bordered dark>
        <q-card-section class="admin-codex-prompt__content">
          <p>Este texto aparece na guia de instalação e fica disponível ao público. Use instruções e exemplos sem chaves, senhas ou outros dados privados.</p>
          <q-input v-model="draft" type="textarea" dark outlined rows="11" label="Prompt de configuração" counter :maxlength="codexSetupPromptLimit"
            :disable="loading || saving" />
        </q-card-section>
        <q-card-actions align="right" class="admin-codex-prompt__actions">
          <q-btn flat no-caps label="Restaurar texto padrão" :disable="loading || saving || draft === codexDefaultSetupPrompt" @click="draft = codexDefaultSetupPrompt" />
          <q-btn unelevated no-caps type="submit" color="teal-8" icon="mdi-content-save-outline" label="Salvar prompt"
            :loading="saving" :disable="loading || !dirty || !valid" />
        </q-card-actions>
      </q-card>
    </q-form>
    <q-linear-progress v-else-if="loading" indeterminate color="teal-4" aria-label="Carregando prompt" />
  </section>
</template>

<style scoped>
.admin-codex-prompt { display: grid; gap: 1rem; min-width: 0; }
.admin-codex-prompt header { display: flex; justify-content: space-between; align-items: center; gap: .75rem; }
.admin-codex-prompt h2 { margin: 0; font-size: clamp(1.35rem, 4vw, 2rem); font-weight: 700; line-height: 1.3; }
.admin-codex-prompt .q-card { border-color: #315653; border-radius: .85rem; background: #0c2325; }
.admin-codex-prompt__content { display: grid; gap: .85rem; }
.admin-codex-prompt__content p { margin: 0; color: #bfd5d0; }
.admin-codex-prompt__actions { padding: 0 16px 16px; gap: .5rem; }
.admin-codex-prompt__error { color: #ffdadd; background: #50212c; }
</style>
