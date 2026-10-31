<script setup>
import { computed, ref, watch } from 'vue'
import { useWhiteLabel } from '../services/whitelabel.js'
import {
  MAX_NOTIFICATION_EMAILS,
  notificationEmailsPayload,
  validateNotificationEmails,
} from '../services/notification-emails.js'

const props = defineProps({
  recipients: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  emailConfigured: { type: Boolean, default: false },
})
const emit = defineEmits(['save'])
const { branding } = useWhiteLabel()
const draft = ref([])
const validationError = ref('')
let nextId = 0

watch(() => JSON.stringify(props.recipients), () => {
  draft.value = notificationEmailsPayload(props.recipients).map((recipient) => ({
    ...recipient,
    id: nextId++,
  }))
  validationError.value = ''
}, { immediate: true })

const subjectPreview = computed(() => `${branding.appName} [Nome ou telefone do cliente] Nova Mensagem WhatsApp`)
const hasEnabledRecipients = computed(() => draft.value.some((recipient) => recipient.enabled))

function addRecipient() {
  if (draft.value.length >= MAX_NOTIFICATION_EMAILS) return
  draft.value.push({ id: nextId++, email: '', enabled: false })
  validationError.value = ''
}

function removeRecipient(index) {
  draft.value.splice(index, 1)
  validationError.value = ''
}

function save() {
  validationError.value = validateNotificationEmails(draft.value)
  if (validationError.value) return
  if (hasEnabledRecipients.value && !props.emailConfigured) {
    validationError.value = 'Configure o Gmail para ativar o envio de notificações por e-mail.'
    return
  }
  emit('save', notificationEmailsPayload(draft.value))
}
</script>

<template>
  <q-form class="whatsapp-notification-emails" @submit="save">
    <div class="text-subtitle1 text-weight-bold">Notificações por e-mail</div>
    <p class="text-body2 text-grey-8 q-mt-xs q-mb-md">
      Adicione os destinatários e marque quem deve receber um e-mail quando uma nova mensagem chegar pelo WhatsApp.
      As alterações entram em vigor ao salvar.
    </p>
    <div v-if="!draft.length" class="text-body2 text-grey-7 q-mb-md">
      Nenhum destinatário cadastrado. Os avisos por e-mail do WhatsApp estão desativados.
    </div>
    <div v-for="(recipient, index) in draft" :key="recipient.id" class="notification-email-row">
      <q-input
        v-model.trim="recipient.email"
        outlined
        dense
        type="email"
        :label="`E-mail do destinatário ${index + 1}`"
        :disable="saving"
        maxlength="254"
        autocomplete="email"
        class="notification-email-row__address"
      />
      <q-checkbox
        v-model="recipient.enabled"
        label="Receber notificações"
        :aria-label="`Receber notificações em ${recipient.email || `destinatário ${index + 1}`}`"
        :disable="saving"
        dense
      />
      <q-btn
        flat
        round
        dense
        color="negative"
        icon="delete_outline"
        :aria-label="`Remover destinatário ${index + 1}`"
        :disable="saving"
        @click="removeRecipient(index)"
      >
        <q-tooltip>Remover destinatário</q-tooltip>
      </q-btn>
    </div>
    <p v-if="!emailConfigured" class="text-body2 text-grey-8 q-mt-md">
      Configure o canal Gmail para enviar estes avisos. Você pode salvar os destinatários com as caixas desmarcadas.
    </p>
    <p class="notification-email-subject text-caption q-mt-md q-mb-md">
      Assunto: {{ subjectPreview }}
    </p>
    <p v-if="validationError" class="text-negative text-body2" role="alert">{{ validationError }}</p>
    <div class="row items-center q-gutter-sm">
      <q-btn
        outline
        color="primary"
        no-caps
        icon="add"
        label="Adicionar e-mail"
        :disable="saving || draft.length >= MAX_NOTIFICATION_EMAILS"
        @click="addRecipient"
      />
      <q-btn
        unelevated
        color="primary"
        no-caps
        icon="save"
        label="Salvar notificações por e-mail"
        type="submit"
        :loading="saving"
      />
    </div>
  </q-form>
</template>

<style scoped>
.whatsapp-notification-emails {
  padding-top: 20px;
  border-top: 1px solid rgba(3, 21, 21, 0.1);
}

.notification-email-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.notification-email-row__address {
  flex: 1 1 250px;
  min-width: 0;
}

.notification-email-subject {
  overflow-wrap: anywhere;
  color: #52706b;
}

@media (max-width: 600px) {
  .notification-email-row__address {
    flex-basis: 100%;
  }
}
</style>
