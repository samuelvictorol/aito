<template>
  <q-select
    :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
    :label="label" :rules="rules" :disable="disable" :options="options" :loading="loading"
    dark outlined dense clearable use-input input-debounce="250" option-value="id" option-label="name"
    @filter="findCustomers" @filter-abort="cancel"
  >
    <template #prepend><q-icon name="mdi-account-search-outline" /></template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps" dark>
        <q-item-section><q-item-label>{{ scope.opt.name }}</q-item-label><q-item-label caption>{{ scope.opt.email }}</q-item-label></q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item dark><q-item-section class="text-grey-4">{{ feedback }}</q-item-section></q-item>
    </template>
  </q-select>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders } from 'src/services/purchase-history'

defineProps({
  modelValue: { type: Object, default: null },
  label: { type: String, default: 'Buscar cliente por nome ou e-mail' },
  rules: { type: Array, default: () => [] },
  disable: Boolean,
})
defineEmits(['update:modelValue'])

const loading = ref(false)
const options = ref([])
const feedback = ref('Digite pelo menos dois caracteres.')
let request

function cancel() {
  request?.abort()
  loading.value = false
}

async function findCustomers(text, update) {
  cancel()
  const query = text.trim()
  if (query.length < 2) {
    update(() => {
      options.value = []
      feedback.value = 'Digite pelo menos dois caracteres.'
    })
    return
  }
  const current = new AbortController()
  request = current
  loading.value = true
  try {
    const { data } = await api.get('/admin/finance/customers', {
      ...financeHeaders(true), params: { q: query }, signal: current.signal,
    })
    if (!current.signal.aborted) update(() => {
      options.value = data.data
      feedback.value = 'Nenhum cliente encontrado.'
    })
  } catch {
    if (!current.signal.aborted) update(() => {
      options.value = []
      feedback.value = 'Não foi possível buscar os clientes. Tente novamente.'
    })
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

onBeforeUnmount(cancel)
</script>
