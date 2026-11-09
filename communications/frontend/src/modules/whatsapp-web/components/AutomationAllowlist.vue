<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { http, unwrap } from '../../../services/http.js'
import { api, messageOf } from '../services.js'

const selected = ref([])
const options = ref([])
const savedIds = ref([])
const loading = ref(false)
const saving = ref(false)
const ready = ref(false)
const status = ref('')
const error = ref('')
const selectedIds = computed(() => selected.value.map(contact => contact.id))
const dirty = computed(() => selectedIds.value.length !== savedIds.value.length ||
  selectedIds.value.some(id => !savedIds.value.includes(id)))
let searchController

function contactLabel(contact) {
  return [contact.displayName || 'Contato sem nome', contact.phone, contact.active === false ? 'Indisponível' : '']
    .filter(Boolean).join(' · ')
}

function apply(data) {
  savedIds.value = data.contactIds
  selected.value = data.items
  ready.value = true
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    apply((await api.get('/settings/automation-allowlist')).data)
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    loading.value = false
  }
}

async function filter(value, update, abort) {
  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  try {
    const result = unwrap(await http.get('/contacts', {
      params: { search: value.trim(), active: true, limit: 20 },
      signal: controller.signal,
    }))
    if (!controller.signal.aborted) update(() => { options.value = result.items || [] })
  } catch (cause) {
    if (!controller.signal.aborted) {
      error.value = messageOf(cause)
      abort()
    }
  }
}

async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  status.value = ''
  error.value = ''
  try {
    apply((await api.put('/settings/automation-allowlist', { contactIds: selectedIds.value })).data)
    status.value = 'Lista de automações salva.'
  } catch (cause) {
    error.value = messageOf(cause)
  } finally {
    saving.value = false
  }
}

onMounted(load)
onUnmounted(() => searchController?.abort())
</script>

<template>
  <article class="card automation-allowlist">
    <div class="automation-allowlist__head">
      <q-icon name="verified_user" size="24px" />
      <div>
        <h2>Contatos permitidos nas automações</h2>
        <p>Escolha quais contatos podem acionar bot, IA e fluxos. A caixa de entrada continua recebendo mensagens de todos para atendimento manual.</p>
      </div>
    </div>
    <q-select
      v-model="selected"
      :options="options"
      :option-label="contactLabel"
      :loading="loading"
      :disable="!ready || saving"
      :max-values="500"
      label="Buscar contato por nome ou telefone"
      option-value="id"
      input-debounce="300"
      outlined
      multiple
      use-chips
      use-input
      @filter="filter"
    >
      <template #no-option>
        <q-item><q-item-section>Nenhum contato encontrado.</q-item-section></q-item>
      </template>
    </q-select>
    <p v-if="ready" class="automation-allowlist__scope">
      {{ selectedIds.length ? 'Só os contatos selecionados poderão acionar automações.' : 'Com a lista vazia, valem as regras normais de automação para todos os contatos.' }}
    </p>
    <div class="automation-allowlist__footer">
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-else-if="status" role="status">{{ status }}</p>
      <q-btn v-if="error && !ready" outline no-caps label="Tentar novamente" :loading="loading" @click="load" />
      <q-btn v-else unelevated color="primary" no-caps label="Salvar lista" :disable="!dirty || !ready" :loading="saving" @click="save" />
    </div>
  </article>
</template>

<style scoped>
.automation-allowlist{padding:22px;margin-bottom:16px;display:grid;gap:14px}
.automation-allowlist__head{display:flex;align-items:flex-start;gap:12px}
.automation-allowlist__head>.q-icon{color:var(--q-primary)}
.automation-allowlist__head h2{margin:0;font:800 1.08rem Inter,'Segoe UI',sans-serif}
.automation-allowlist p{margin:5px 0 0;font-size:.8rem;line-height:1.5}
.automation-allowlist__scope{color:#526a63}
.automation-allowlist__footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px}
.automation-allowlist__footer p{margin-right:auto}
.automation-allowlist__footer [role=alert]{color:#a02839}
</style>
