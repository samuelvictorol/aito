<script setup>
import { computed, ref, useId, watch } from 'vue'
import { compactPaginationItems, paginationPageCount, parsePaginationPage } from '../services/compact-pagination.js'

const props = defineProps({
  modelValue: { type: Number, required: true },
  max: { type: Number, required: true },
  disable: { type: Boolean, default: false },
  ariaLabel: { type: String, default: 'Paginação' },
})
const emit = defineEmits(['update:modelValue'])
const inputId = `pagination-page-${useId()}`
const errorId = `${inputId}-error`
const pageCount = computed(() => paginationPageCount(props.max))
const items = computed(() => compactPaginationItems(pageCount.value))
const draft = ref(String(props.modelValue))
const invalid = ref(false)

watch(() => [props.modelValue, props.max], () => {
  draft.value = String(props.modelValue)
  invalid.value = false
})

function goToPage(value) {
  if (props.disable) return
  const page = parsePaginationPage(value, pageCount.value)
  invalid.value = page === null
  if (page === null) return
  draft.value = String(page)
  if (page !== props.modelValue) emit('update:modelValue', page)
}

function allowDigits(event) {
  if (event.data && /\D/.test(event.data)) event.preventDefault()
}

function updateDraft(event) {
  const value = event.target.value
  if (/^\d*$/.test(value)) {
    draft.value = value
    invalid.value = false
  } else {
    event.target.value = draft.value
  }
}
</script>

<template>
  <nav class="compact-pagination" :aria-label="ariaLabel">
    <div class="compact-pagination__pages">
      <q-btn
        flat dense round color="primary" icon="chevron_left"
        aria-label="Página anterior"
        :disable="disable || modelValue <= 1"
        @click="goToPage(modelValue - 1)"
      />
      <template v-for="item in items" :key="item">
        <span v-if="item === 'ellipsis'" class="compact-pagination__ellipsis" aria-hidden="true">...</span>
        <q-btn
          v-else
          dense rounded color="primary" class="compact-pagination__page"
          :flat="item !== modelValue"
          :unelevated="item === modelValue"
          :label="item"
          :aria-label="`Página ${item}`"
          :aria-current="item === modelValue ? 'page' : undefined"
          :disable="disable"
          @click="goToPage(item)"
        />
      </template>
      <q-btn
        flat dense round color="primary" icon="chevron_right"
        aria-label="Próxima página"
        :disable="disable || modelValue >= pageCount"
        @click="goToPage(modelValue + 1)"
      />
    </div>

    <div class="compact-pagination__jump">
      <label :for="inputId">Página</label>
      <input
        :id="inputId"
        class="compact-pagination__input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        :value="draft"
        :disabled="disable"
        :aria-label="`Ir para página de 1 a ${pageCount}`"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="invalid ? errorId : undefined"
        @beforeinput="allowDigits"
        @input="updateDraft"
        @keydown.enter.prevent="goToPage(draft)"
      >
      <span class="compact-pagination__total">de {{ pageCount }}</span>
      <q-btn flat dense color="primary" label="Ir" aria-label="Ir para a página informada" :disable="disable" @click="goToPage(draft)" />
    </div>
    <span class="sr-only" aria-live="polite">Página atual: {{ modelValue }} de {{ pageCount }}</span>
    <div v-if="invalid" :id="errorId" class="compact-pagination__error" role="alert">
      Informe uma página entre 1 e {{ pageCount }}.
    </div>
  </nav>
</template>

<style scoped>
.compact-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 20px;
  max-width: 100%;
}

.compact-pagination__pages,
.compact-pagination__jump {
  display: flex;
  align-items: center;
  gap: 4px;
}

.compact-pagination__page {
  min-width: 32px;
  padding-inline: 6px;
}

.compact-pagination__ellipsis {
  padding-inline: 4px;
  color: var(--q-primary);
}

.compact-pagination__jump {
  gap: 8px;
  font-size: 13px;
}

.compact-pagination__input {
  width: 64px;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid #94a3b8;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  text-align: center;
  font: inherit;
}

.compact-pagination__input:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.compact-pagination__input[aria-invalid='true'] {
  border-color: var(--q-negative);
}

.compact-pagination__total {
  white-space: nowrap;
}

.compact-pagination__error {
  flex-basis: 100%;
  color: var(--q-negative);
  font-size: 12px;
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
