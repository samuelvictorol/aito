<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'verified'])
const open = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const password = ref('')
const busy = ref(false)
const error = ref('')
let pending

function reset() {
  pending?.abort()
  pending = null
  password.value = ''
  error.value = ''
  busy.value = false
}

async function confirm() {
  if (!password.value || busy.value) return
  const controller = new AbortController()
  pending = controller
  busy.value = true
  error.value = ''
  const value = password.value
  password.value = ''
  try {
    const { data } = await api.post('/auth/password/reauth', { password: value }, {
      ...financeHeaders(true), signal: controller.signal,
    })
    if (controller.signal.aborted) return
    if (typeof data?.confirmationToken !== 'string' || !data.confirmationToken) throw Error('invalid_confirmation')
    emit('verified', { confirmationToken: data.confirmationToken })
    open.value = false
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível confirmar sua senha. Tente novamente.'
  } finally {
    if (pending === controller) {
      pending = null
      busy.value = false
    }
  }
}

watch(() => props.modelValue, reset)
onBeforeUnmount(reset)
</script>

<template>
  <q-dialog v-model="open" :persistent="busy">
    <q-card class="admin-password-dialog">
      <q-form @submit.prevent="confirm">
        <q-card-section>
          <h2>Confirmar alteração</h2>
          <q-input v-model="password" outlined autofocus type="password" autocomplete="current-password"
            label="Senha do administrador" :disable="busy" :error="Boolean(error)" :error-message="error" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" :disable="busy" @click="open = false" />
          <q-btn unelevated no-caps color="teal-7" label="Confirmar" type="submit" :loading="busy" :disable="!password" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.admin-password-dialog { width: min(420px, calc(100vw - 28px)); border: 1px solid #a4dfcf; border-radius: 18px; background: #f7fffc; color: #143c32; }
.admin-password-dialog h2 { margin: 0 0 18px; font-size: 21px; font-weight: 700; }
.admin-password-dialog .q-card-actions { padding: 0 16px 16px; gap: 8px; }
</style>
