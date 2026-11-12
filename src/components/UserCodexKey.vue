<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseMoney } from 'src/services/purchase-history'

const $q = useQuasar()
const base = '/aito-tokens/account/codex-key'
const status = ref(null)
const walletId = ref('web')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const newKey = ref('')
const keyVisible = ref(false)
const confirmRotation = ref(false)
const abort = new AbortController()
const wallets = computed(() => (status.value?.wallets || []).map(wallet => ({ ...wallet,
  label: `${wallet.label} · ${purchaseMoney(wallet.balanceUsdCents, 'USD')}`,
})))
const selectedAvailable = computed(() => wallets.value.some(wallet => wallet.id === walletId.value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(base, { ...financeHeaders(), signal: abort.signal })
    status.value = data.data
    walletId.value = status.value.walletId
    if (!selectedAvailable.value) walletId.value = 'web'
  } catch (cause) {
    if (!abort.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível consultar sua AitoKey.'
  } finally { loading.value = false }
}

async function change(operation) {
  if (!selectedAvailable.value || saving.value) return
  saving.value = true
  error.value = ''
  confirmRotation.value = false
  try {
    const { data } = await api.post(`${base}/${operation}`, { walletId: walletId.value, revision: status.value.revision },
      { ...financeHeaders(), signal: abort.signal })
    const { key, ...metadata } = data.data
    status.value = { ...status.value, ...metadata }
    keyVisible.value = false
    newKey.value = key
  } catch (cause) {
    if (abort.signal.aborted) return
    if (cause.response?.status === 409) await load()
    error.value = cause.response?.data?.message || 'Não foi possível concluir. Atualize a chave antes de tentar novamente.'
  } finally { saving.value = false }
}

function closeKey() {
  newKey.value = ''
  keyVisible.value = false
}

async function copyKey() {
  try {
    await copyToClipboard(newKey.value)
    $q.notify({ type: 'positive', message: 'AitoKey copiada.' })
  } catch {
    $q.notify({ type: 'warning', message: 'Use Baixar chave para guardar a AitoKey.' })
  }
}

function downloadKey() {
  if (!newKey.value) return
  const url = URL.createObjectURL(new Blob([newKey.value + '\n'], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'aitokey-codex.txt'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(load)
onBeforeUnmount(() => { abort.abort(); closeKey() })
</script>

<template>
  <section class="codex-key" aria-labelledby="codex-key-title">
    <div class="codex-key__header">
      <img src="/codex-app-icon.png" alt="" width="32" height="32" />
      <div><h2 id="codex-key-title">AitoKey para Codex</h2><p>Use os AitoTokens da carteira selecionada no plugin da AitoSoftwares.</p></div>
    </div>
    <q-inner-loading :showing="loading" color="teal-3" />
    <q-banner v-if="error" rounded dense class="codex-key__banner" role="alert">{{ error }}</q-banner>
    <q-btn v-if="!status && error" flat no-caps icon="mdi-refresh" label="Tentar novamente" @click="load" />
    <template v-if="status">
      <q-banner v-if="!status.available" rounded dense class="codex-key__banner">Emissão de chaves temporariamente indisponível.</q-banner>
      <p v-if="status.issued" class="codex-key__hint">Chave emitida · termina em <code>{{ status.keyHint }}</code></p>
      <p v-if="status.issued && !wallets.some(wallet => wallet.id === status.walletId)" class="codex-key__hint">
        A carteira vinculada está indisponível. Gere outra chave usando uma carteira ativa.
      </p>
      <q-select v-model="walletId" dark dense outlined label="Carteira AitoTokens" :options="wallets" option-value="id"
        emit-value map-options :disable="saving || !status.available" />
      <div class="codex-key__actions">
        <q-btn v-if="status.issued" unelevated no-caps color="teal-7" icon="mdi-key-change" label="Regenerar AitoKey"
          :loading="saving" :disable="!selectedAvailable || !status.available" @click="confirmRotation = true" />
        <q-btn v-else unelevated no-caps color="teal-7" icon="mdi-key-plus" label="Gerar AitoKey"
          :loading="saving" :disable="!selectedAvailable || !status.available" @click="change('issue')" />
        <a href="/downloads/aitoia-codex.zip" download><q-icon name="mdi-download" /> Baixar plugin e guia</a>
      </div>
    </template>

    <q-dialog v-model="confirmRotation">
      <q-card dark class="codex-key__dialog">
        <q-card-section><h3>Regenerar AitoKey?</h3><p>A chave anterior perde o acesso imediatamente. O saldo permanece na carteira de origem.</p></q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancelar" />
          <q-btn unelevated no-caps color="teal-7" label="Regenerar chave" @click="change('rotate')" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog :model-value="Boolean(newKey)" persistent @hide="closeKey">
      <q-card dark class="codex-key__dialog">
        <q-card-section><h3>Sua nova AitoKey</h3><p>Guarde esta chave em local seguro. Ela é exibida uma única vez.</p>
          <q-input :model-value="newKey" readonly dark outlined dense label="AitoKey" :type="keyVisible ? 'text' : 'password'">
            <template #append><q-btn flat round dense :icon="keyVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              :aria-label="keyVisible ? 'Ocultar chave' : 'Mostrar chave'" @click="keyVisible = !keyVisible" /></template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Fechar" @click="closeKey" />
          <q-btn flat no-caps label="Baixar chave" icon="mdi-download" @click="downloadKey" />
          <q-btn unelevated no-caps color="teal-7" label="Copiar chave" icon="mdi-content-copy" @click="copyKey" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.codex-key { position: relative; display: grid; width: min(100%, 520px); gap: .8rem; margin-top: 1.6rem; padding: 1rem; border: 1px solid #265354; border-radius: .75rem; background: #0a1c1e; }
.codex-key__header, .codex-key__actions { display: flex; gap: .65rem; align-items: center; }
.codex-key__header img { flex-shrink: 0; }
.codex-key__actions { flex-wrap: wrap; }
.codex-key__header h2, .codex-key__dialog h3 { margin: 0; font-size: 1.08rem; line-height: 1.25; font-weight: 700; }
.codex-key__header p, .codex-key__dialog p { margin: .25rem 0 0; color: #bcd2cf; }
.codex-key__actions a { color: #9de4d9; text-underline-offset: 3px; }
.codex-key__hint { margin: 0; color: #bcd2cf; }
.codex-key__hint code { color: #e1fff8; }
.codex-key__banner { background: #542f21; color: #ffeddd; }
.codex-key__dialog { width: min(100%, 495px); background: #0a1c1e; }
.codex-key__dialog .q-field { margin-top: .75rem; }
</style>
