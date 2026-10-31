<script setup>
import { computed, ref } from 'vue'
import MediaPreview from './MediaPreview.vue'

const props = defineProps({ modelValue: { type: Array, default: () => [] }, assets: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const search = ref(''), previewLimit = ref(6), previewsOpen = ref(false)
const selected = computed({ get: () => props.modelValue, set: value => { const ids = [...new Set(value || [])]; if (ids.length <= 100 || ids.length < props.modelValue.length) emit('update:modelValue', ids) } })
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const allAssets = computed(() => {
  const known = new Set(props.assets.map(asset => asset._id))
  return [...props.assets, ...selected.value.filter(id => !known.has(id)).map(_id => ({ _id, name: 'Arquivo indisponível · ' + _id, unavailable: true }))]
})
const options = computed(() => allAssets.value.filter(asset => normalize(asset.name || asset.filename).includes(normalize(search.value))).map(asset => ({ ...asset, disable: selected.value.length >= 100 && !selected.value.includes(asset._id) })))
const selectedAssets = computed(() => selected.value.map(id => allAssets.value.find(asset => asset._id === id)).filter(Boolean))
function filter(value, update) { update(() => { search.value = value }) }
function remove(id) { selected.value = selected.value.filter(value => value !== id) }
</script>

<template>
  <section class="library-references">
    <q-select v-model="selected" :options="options" multiple outlined use-input emit-value map-options option-value="_id" option-label="name" :input-debounce="150" label="Arquivos de referência da biblioteca" popup-content-class="library-reference-options" :virtual-scroll-item-size="48" @filter="filter">
      <template #selected><span class="library-reference-summary">{{ selected.length ? `${selected.length} arquivo(s) selecionado(s)` : 'Busque e selecione arquivos' }}</span></template>
      <template #option="scope"><q-item v-bind="scope.itemProps"><q-item-section side><q-checkbox :model-value="scope.selected" tabindex="-1" aria-hidden="true" class="no-pointer-events" /></q-item-section><q-item-section><q-item-label class="library-reference-option-name">{{ scope.opt.name || scope.opt.filename }}</q-item-label></q-item-section></q-item></template>
      <template #no-option><q-item><q-item-section>Nenhum arquivo encontrado.</q-item-section></q-item></template>
    </q-select>
    <small>Até 100 arquivos, sem Ctrl+clique. O conteúdo enviado à IA deve somar até 20 MB. Abra a lista abaixo para conferir as referências.</small>
    <q-expansion-item v-if="selected.length" v-model="previewsOpen" icon="folder_open" :label="`Conferir ${selected.length} referência(s)`" class="library-reference-details" @hide="previewLimit = 6">
      <div v-if="previewsOpen" class="library-reference-grid">
        <article v-for="asset in selectedAssets.slice(0, previewLimit)" :key="asset._id">
          <div class="library-reference-card-head"><strong>{{ asset.name || asset.filename }}</strong><q-btn flat round dense size="sm" icon="close" :aria-label="`Remover referência ${asset.name || asset.filename}`" @click="remove(asset._id)" /></div>
          <MediaPreview :asset="asset.unavailable ? undefined : asset" />
        </article>
      </div>
      <q-btn v-if="previewsOpen && selectedAssets.length > previewLimit" flat no-caps icon="expand_more" :label="`Mostrar mais (${selectedAssets.length - previewLimit})`" class="library-reference-more" @click="previewLimit += 6" />
    </q-expansion-item>
  </section>
</template>

<style scoped>
.library-references{min-width:0;max-width:100%;display:grid;gap:8px}.library-reference-summary{font-size:13px;overflow-wrap:anywhere}.library-references>small{font-size:11px;line-height:1.6;color:var(--muted)}.library-reference-details{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:color-mix(in srgb,var(--brand,#35bca4) 5%,white)}.library-reference-details :deep(.q-item){min-height:48px}.library-reference-details :deep(.q-item__section){min-width:0}.library-reference-details :deep(.q-item__label){overflow-wrap:anywhere}.library-reference-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px;max-height:360px;overflow:auto;overscroll-behavior:contain}.library-reference-grid>article{min-width:0;background:white;border:1px solid var(--line);border-radius:10px;padding:8px}.library-reference-card-head{display:flex;align-items:center;gap:6px;margin-bottom:6px}.library-reference-card-head strong{flex:1;min-width:0;font-size:11px;overflow-wrap:anywhere}.library-reference-more{display:block;margin:4px auto 10px;color:var(--brand-dark,#137d6c)}
:global(.library-reference-options){max-width:calc(100vw - 32px)}:global(.library-reference-option-name){white-space:normal;overflow-wrap:anywhere;font-size:13px}
.library-references :deep(.q-field__input){border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;min-height:0!important;box-shadow:none!important}
@media(max-width:599px){.library-reference-grid{grid-template-columns:minmax(0,1fr);max-height:300px}.library-references :deep(.q-field__native){min-width:0}.library-reference-summary{font-size:12px}}
</style>
