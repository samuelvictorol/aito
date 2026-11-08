<script setup>
import { computed, ref, watch } from 'vue'
import { http, unwrap, asList, errorMessage } from '../services/http.js'
import { contactStartPhone, startSavedConversation } from '../services/conversation-starts.js'

const props = defineProps({ modelValue: Boolean, channel: String, contact: Object })
const emit = defineEmits(['update:modelValue', 'started'])
const contact = ref(null), channel = ref('whatsapp_web'), options = ref([]), loading = ref(false), saving = ref(false), error = ref('')
let searchRequest = 0
const channels = [{ label: 'WhatsApp Web', value: 'whatsapp_web' }, { label: 'WhatsApp Cloud · API oficial', value: 'whatsapp_cloud' }]
const valid = computed(() => contact.value?.active !== false && !!contactStartPhone(contact.value, channel.value))
const label = item => [item?.displayName || item?.name || 'Contato', contactStartPhone(item, channel.value) || 'Sem telefone válido'].join(' · ')
async function search(text = '') {
  const request = ++searchRequest
  loading.value = true
  try {
    const list = asList(unwrap(await http.get('/contacts', { params: { search: text, page: 1, limit: 30 } })))
    if (request === searchRequest) options.value = list.filter(item => item.active !== false)
  } catch (cause) { if (request === searchRequest) error.value = errorMessage(cause) }
  finally { if (request === searchRequest) loading.value = false }
}
function filter(text, update) { update(() => {}); void search(text) }
watch(() => props.modelValue, open => {
  if (!open) { searchRequest++; return }
  contact.value = props.contact || null
  channel.value = props.channel || 'whatsapp_web'
  options.value = props.contact ? [props.contact] : []
  error.value = ''
  void search()
})
async function submit() {
  if (saving.value || !valid.value) return
  saving.value = true; error.value = ''
  try {
    const result = await startSavedConversation(contact.value, channel.value)
    emit('started', result)
    emit('update:modelValue', false)
  } catch (cause) { error.value = errorMessage(cause, cause.message || 'Não foi possível abrir a conversa.') }
  finally { saving.value = false }
}
</script>

<template>
  <q-dialog :model-value="modelValue" :persistent="saving" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="start-conversation-dialog">
      <q-card-section class="row items-center"><div class="text-h6">Nova conversa</div><q-space/><q-btn flat round dense icon="close" aria-label="Fechar nova conversa" :disable="saving" @click="emit('update:modelValue', false)"/></q-card-section>
      <q-card-section class="q-pt-none">
        <p>Escolha um contato salvo. Você pode abrir a conversa mesmo que ele nunca tenha enviado uma mensagem.</p>
        <q-select v-model="contact" :options="options" :option-label="label" outlined use-input clearable input-debounce="300" label="Buscar contato por nome ou telefone" :loading="loading" :disable="saving" @filter="filter"><template #no-option><q-item><q-item-section>Nenhum contato encontrado. Confira a busca ou cadastre a pessoa em Contatos.</q-item-section></q-item></template></q-select>
        <q-select v-model="channel" :options="channels" emit-value map-options outlined label="Canal" :disable="!!props.channel || saving" class="q-mt-md"/>
        <q-banner rounded class="bg-teal-1 text-teal-10 q-mt-md">{{ channel === 'whatsapp_cloud' ? 'A conversa será aberta sem alterar permissões. Sem uma mensagem recebida nas últimas 24 horas, inicie com um template oficial aprovado.' : 'A sessão do WhatsApp Web precisa estar conectada. Abrir a conversa não envia uma mensagem nem autoriza notificações em massa.' }}</q-banner>
        <p v-if="contact && !valid" role="alert" class="text-negative q-mt-md">Este contato precisa de um telefone válido com DDI e DDD. Atualize o cadastro em Contatos.</p>
        <p v-if="error" role="alert" class="text-negative q-mt-md">{{ error }}</p>
      </q-card-section>
      <q-card-actions align="right"><q-btn flat no-caps label="Cancelar" :disable="saving" @click="emit('update:modelValue', false)"/><q-btn unelevated no-caps color="primary" icon="chat" label="Abrir conversa" :loading="saving" :disable="!valid" @click="submit"/></q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>.start-conversation-dialog{width:560px;max-width:94vw}.start-conversation-dialog p{font-size:14px;line-height:1.6}</style>
