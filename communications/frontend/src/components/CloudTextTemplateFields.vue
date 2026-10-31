<script setup>
import { computed } from 'vue'
import { cloudTextEditorValue, cloudTextTokens, updateCloudText } from '../services/cloud-template-text.js'

const props = defineProps({ component: { type: Object, required: true } })
const isHeader = computed(() => props.component.type === 'header')
const text = computed(() => cloudTextEditorValue(props.component))
const parsed = computed(() => cloudTextTokens(text.value, props.component.type))
const format = computed(() => parsed.value.positional ? 'number' : parsed.value.tokens.length ? 'name' : 'number')
const valueMode = (parameter) => parameter.contentMode || (parameter.fixedValue ? 'fixed' : 'dynamic')
const markerLabel = (parameter, index) => `{{${parameter.parameterName || index + 1}}}`

function setMode(parameter, mode) {
  if (mode === 'fixed') parameter.fixedValue = parameter.fixedValue || parameter.example || ''
  else {
    parameter.example = parameter.fixedValue || parameter.example || ''
    parameter.fixedValue = ''
  }
  parameter.contentMode = mode
}

function addVariable() {
  const index = parsed.value.tokens.length + 1
  let token = String(index)
  if (format.value === 'name') {
    let suffix = index
    while (parsed.value.tokens.includes(`campo_${suffix}`)) suffix += 1
    token = `campo_${suffix}`
  }
  updateCloudText(props.component, `${text.value}${text.value && !/\s$/.test(text.value) ? ' ' : ''}{{${token}}}`)
}
</script>

<template>
  <div class="cloud-text-fields">
    <q-input
      :model-value="text"
      outlined stack-label autogrow counter
      :type="isHeader ? 'text' : 'textarea'"
      :maxlength="isHeader ? 60 : 1024"
      :label="isHeader ? 'Texto do cabeçalho aprovado na Meta' : 'Texto do corpo aprovado na Meta'"
      hint="Cole o texto da Meta com os marcadores {{1}}, {{2}} ou {{nome}}. Os campos são criados automaticamente."
      :error="Boolean(parsed.error)" :error-message="parsed.error || ''"
      @update:model-value="updateCloudText(component, $event)"
    />
    <div class="variable-toolbar">
      <span>{{ parsed.tokens.length }} {{ parsed.tokens.length === 1 ? 'variável' : 'variáveis' }}{{ parsed.tokens.length ? format === 'number' ? ' por número' : ' por nome' : '' }}</span>
      <q-btn
        outline no-caps color="primary" icon="add" label="Adicionar variável"
        :disable="Boolean(parsed.error) || parsed.tokens.length >= (isHeader ? 1 : 20)"
        @click="addVariable"
      />
    </div>
    <div v-for="(parameter, index) in component.parameters" :key="parameter.id || parameter.key" class="variable-card">
      <strong>{{ isHeader ? 'Cabeçalho' : 'Corpo' }} · <code>{{ markerLabel(parameter, index) }}</code></strong>
      <q-input v-model.trim="parameter.label" outlined stack-label label="Nome do campo no disparo" />
      <q-select
        :model-value="valueMode(parameter)" outlined stack-label emit-value map-options
        label="Quando preencher este valor?"
        :options="[{ label: 'Definir em cada disparo', value: 'dynamic' }, { label: 'Sempre este valor', value: 'fixed' }]"
        @update:model-value="setMode(parameter, $event)"
      />
      <q-input v-if="valueMode(parameter) === 'fixed'" v-model="parameter.fixedValue" outlined stack-label :type="isHeader ? 'text' : 'textarea'" :autogrow="!isHeader" :maxlength="isHeader ? 60 : 10000" counter label="Valor usado em todos os disparos" :hint="isHeader ? undefined : 'Enter insere uma quebra de linha no texto. Use a estrutura do modelo aprovado na Meta.'" />
      <q-input v-else v-model="parameter.example" outlined stack-label :type="isHeader ? 'text' : 'textarea'" :autogrow="!isHeader" :maxlength="isHeader ? 60 : 10000" counter label="Exemplo para a prévia" hint="Apenas uma amostra. O valor real será preenchido no disparo." />
    </div>
  </div>
</template>

<style scoped>
.cloud-text-fields { display: grid; gap: 18px; }
.variable-toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; color: #607872; font-size: 13px; }
.variable-card { display: grid; gap: 14px; border: 1px solid rgba(18, 104, 89, 0.16); border-radius: 14px; padding: 18px; background: #fff; }
.variable-card strong { color: #183c35; }
.variable-card code { background: #ddf7f0; padding: 3px 6px; border-radius: 5px; }
</style>
