<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'
import { sealAitoProviderCredential } from 'src/services/aitoProviderCredentials'
import LoginMfaDialog from './LoginMfaDialog.vue'

const props = defineProps({ checkoutState: String })
const emit = defineEmits(['updated', 'reauthenticated'])
const $q = useQuasar()
const root = '/aito-tokens/admin/provider-credentials'
const providers = [
  { id: 'openai', label: 'OpenAI', icon: 'mdi-creation-outline', description: 'Chat, roteiros e locução.' },
  { id: 'higgsfield', label: 'Higgsfield', icon: 'mdi-movie-open-outline', description: 'Geração de vídeo no chat e no estúdio.' },
  { id: 'infinitepay', label: 'InfinitePay', icon: 'mdi-wallet-plus-outline', description: 'Configuração de pagamentos do servidor.', readOnly: true },
]
const sourceLabels = { vault: 'No cofre', environment: 'No ambiente', missing: 'Pendente', unreadable: 'Chave inacessível' }
const checkoutMessages = {
  missing_key: 'O checkout de recargas aguarda INFINITEPAY_API_KEY no ambiente da API.',
  missing_merchant: 'O checkout aguarda uma INFINITEPAY_HANDLE válida no ambiente da API.',
  invalid_endpoints: 'Confira INFINITEPAY_API_URL e INFINITEPAY_WEBHOOK_URL no ambiente da API.',
}
const status = shallowRef(null)
const selected = ref(null)
const credential = ref('')
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const saveError = ref('')
const challenge = shallowRef(null)
const mfaOpen = ref(false)
const lengthValid = computed(() => credential.value.trim().length >= 12 && credential.value.trim().length <= 512)
const checkoutMessage = computed(() => checkoutMessages[props.checkoutState])
const operations = new AbortController()
let pending = null

function statusOf(provider) {
  return status.value?.providers?.[provider] || {}
}

async function load() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get(root, { ...financeHeaders(true), signal: operations.signal })
    status.value = data.data
  } catch {
    if (!operations.signal.aborted) loadError.value = 'Não foi possível consultar o estado das chaves.'
  } finally {
    loading.value = false
  }
}

function startEdit(provider) {
  if (provider.readOnly) return
  credential.value = ''
  saveError.value = ''
  pending = null
  selected.value = provider
}

function closeEdit() {
  if (submitting.value || mfaOpen.value) return
  pending = null
  credential.value = ''
  selected.value = null
}

async function requestMfa() {
  if (!selected.value || !lengthValid.value || submitting.value || mfaOpen.value) return
  const { id } = selected.value
  submitting.value = true
  saveError.value = ''
  try {
    const sealing = sealAitoProviderCredential(status.value?.encryption, id, statusOf(id).revision, credential.value.trim())
    credential.value = ''
    pending = { id, envelope: await sealing }
    operations.signal.throwIfAborted()
    const { data } = await api.post('/auth/mfa/reauth', {}, { ...financeHeaders(true), signal: operations.signal })
    challenge.value = data
    mfaOpen.value = true
  } catch (error) {
    pending = null
    if (!operations.signal.aborted) {
      saveError.value = error.response ? 'Não foi possível solicitar o código de acesso. Confira as configurações de autenticação.' :
        error.message || 'Não foi possível proteger a chave neste navegador.'
    }
  } finally {
    submitting.value = false
  }
}

async function applyCredential(session) {
  if (!session?.token || !pending || submitting.value) return
  const { id, envelope } = pending
  pending = null
  emit('reauthenticated', session)
  submitting.value = true
  try {
    await api.put(`${root}/${id}`, envelope, { headers: { Authorization: `Bearer ${session.token}` }, signal: operations.signal })
    selected.value = null
    $q.notify({ type: 'positive', message: 'Chave protegida e salva.' })
    emit('updated')
    await load()
  } catch (error) {
    if (!operations.signal.aborted) {
      saveError.value = error.response?.status === 409 ? 'A configuração mudou durante a confirmação. Cole a nova chave e tente novamente.' :
        'Não foi possível salvar a chave. Confira o formato e tente novamente.'
      await load()
    }
  } finally {
    submitting.value = false
  }
}

watch(mfaOpen, open => {
  if (!open) {
    pending = null
    challenge.value = null
  }
})
onMounted(load)
onBeforeUnmount(() => {
  operations.abort()
  credential.value = ''
  pending = null
})
</script>

<template>
  <section class="provider-keys" aria-labelledby="aito-provider-keys-title">
    <header class="provider-keys__heading">
      <div>
        <h3 id="aito-provider-keys-title">Chaves mestras</h3>
        <p>As chaves de IA são criptografadas no navegador antes do envio e armazenadas criptografadas.</p>
      </div>
      <q-btn flat round icon="mdi-refresh" aria-label="Atualizar estado das chaves" :loading="loading" @click="load" />
    </header>
    <p v-if="loadError" role="alert" class="provider-keys__warning">{{ loadError }}</p>
    <p v-else-if="status && !status.encryption" class="provider-keys__warning">O cofre ainda precisa da chave de proteção do servidor.</p>
    <div class="provider-keys__list">
      <article v-for="provider in providers" :key="provider.id" class="provider-keys__entry">
        <q-icon :name="provider.icon" size="23px" color="teal-3" />
        <div>
          <div class="provider-keys__name">
            <strong>{{ provider.label }}</strong>
            <q-badge v-if="status" outline :color="statusOf(provider.id).configured ? 'green-4' : 'orange-4'"
              :label="sourceLabels[statusOf(provider.id).source] || 'Pendente'" />
            <q-badge v-if="provider.readOnly" outline color="blue-grey-3" label="Somente leitura" />
          </div>
          <p>{{ provider.description }}</p>
          <dl v-if="provider.readOnly && status" class="provider-keys__config">
            <div><dt>InfiniteTag</dt><dd>{{ statusOf(provider.id).handle || 'Pendente' }}</dd></div>
            <div><dt>URL da API</dt><dd>{{ statusOf(provider.id).apiUrl || 'Pendente' }}</dd></div>
            <div><dt>Webhook</dt><dd>{{ statusOf(provider.id).webhookUrl || 'Pendente' }}</dd></div>
          </dl>
        </div>
        <q-btn v-if="!provider.readOnly" flat dense no-caps color="teal-3" :label="statusOf(provider.id).configured ? 'Trocar chave' : 'Cadastrar chave'"
          :aria-label="`${statusOf(provider.id).configured ? 'Trocar' : 'Cadastrar'} chave ${provider.label}`"
          :disable="!status?.encryption || loading || submitting" @click="startEdit(provider)" />
      </article>
    </div>
    <p v-if="checkoutMessage" class="provider-keys__warning">{{ checkoutMessage }}</p>

    <q-dialog :model-value="Boolean(selected)" :persistent="submitting || mfaOpen" @update:model-value="value => { if (!value) closeEdit() }">
      <q-card dark class="provider-keys__dialog">
        <q-form @submit.prevent="requestMfa">
          <q-card-section class="provider-keys__form">
            <h3>Chave {{ selected?.label }}</h3>
            <q-input v-model="credential" type="password" dark outlined autofocus autocomplete="new-password"
              spellcheck="false" autocapitalize="off" label="Nova chave" maxlength="512" :disable="submitting || mfaOpen" />
            <p>Confirme com um código de acesso para gravar a nova chave no cofre.</p>
            <p v-if="saveError" role="alert" class="provider-keys__warning">{{ saveError }}</p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="submitting || mfaOpen" @click="closeEdit" />
            <q-btn unelevated no-caps color="teal-7" type="submit" label="Solicitar código" :loading="submitting" :disable="!lengthValid || mfaOpen" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <LoginMfaDialog v-model="mfaOpen" :challenge="challenge" @verified="applyCredential" />
  </section>
</template>

<style scoped>
.provider-keys { display: grid; gap: .8rem; padding: 1rem; border: 1px solid #345857; border-radius: .8rem; background: #0c2022; }
.provider-keys__heading { display: flex; align-items: flex-start; gap: .5rem; justify-content: space-between; }
.provider-keys h3, .provider-keys__dialog h3 { margin: 0; font-size: 1.2rem; font-weight: 700; line-height: 1.4; }
.provider-keys p, .provider-keys__dialog p { margin: .25rem 0 0; color: #c2d9d3; }
.provider-keys__list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 245px), 1fr)); gap: .65rem; }
.provider-keys__entry { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .4rem .6rem; align-items: start; padding: .7rem; border: 1px solid #345857; border-radius: .7rem; }
.provider-keys__entry .q-btn { grid-column: 2; justify-self: start; }
.provider-keys__name { display: flex; align-items: center; flex-wrap: wrap; gap: .35rem; }
.provider-keys__config { display: grid; gap: .35rem; margin: .5rem 0 0; color: #c2d9d3; font-size: .78rem; }
.provider-keys__config dt { font-weight: 700; }
.provider-keys__config dd { margin: 0; overflow-wrap: anywhere; }
.provider-keys .provider-keys__warning, .provider-keys__dialog .provider-keys__warning { color: #ffd190; }
.provider-keys__dialog { width: min(94vw, 470px); border: 1px solid #345857; background: #0c2022; }
.provider-keys__form { display: grid; gap: .6rem; }
</style>
