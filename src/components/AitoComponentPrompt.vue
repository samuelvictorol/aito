<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { filesForComponent, componentMentionLabel, hasComponentMention } from 'src/services/aitoiaComponentReferences'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'

const props = defineProps({
  modelValue: { type: String, default: '' }, componentIds: { type: Array, default: () => [] },
  components: { type: Array, default: () => [] }, disabled: Boolean, label: String, placeholder: String,
  rows: { type: [Number, String], default: 4 }, maxlength: { type: [Number, String], default: 20000 }, inputId: String,
})
const emit = defineEmits(['update:modelValue', 'update:componentIds', 'selectComponents', 'input', 'blur', 'focus'])
const { isDark } = useAitoIATheme()
const input = ref(null)
const mirror = ref(null)
const open = ref(false)
const query = ref('')
const selected = ref([])
const known = shallowRef(new Set(props.componentIds))
const assets = shallowRef(new Map())
const hover = shallowRef(null)
const composition = ref(false)
const id = props.inputId || `aito-component-prompt-${crypto.randomUUID()}`
let cursor = { start: props.modelValue.length, end: props.modelValue.length }
let hoverTimer
let frame
let resizeObserver

const limit = computed(() => Number(props.maxlength) || 20000)
const candidateIds = computed(() => new Set([...props.componentIds, ...known.value]))
const mentioned = computed(() => props.components.filter(component => candidateIds.value.has(component.id)))
const cleanQuery = computed(() => query.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'))
const choices = computed(() => props.components.filter(component => !cleanQuery.value ||
  `${component.title || ''} ${component.type || ''} ${component.prompt || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(cleanQuery.value)))
const byId = computed(() => new Map(props.components.map(component => [component.id, component])))
const parts = computed(() => {
  const candidates = mentioned.value.map(component => ({ id: component.id, label: componentMentionLabel(component) }))
    .sort((a, b) => b.label.length - a.label.length)
  const text = props.modelValue || ''
  if (!candidates.length) return [{ text }]
  const result = []
  let plainStart = 0, offset = 0
  while (offset < text.length) {
    const match = text[offset] === '@' && candidates.find(item => text.startsWith(item.label, offset) &&
      !/[\p{L}\p{N}_]/u.test(text[offset + item.label.length] || ''))
    if (!match) { offset++; continue }
    if (offset > plainStart) result.push({ text: text.slice(plainStart, offset) })
    result.push({ text: match.label, id: match.id })
    offset += match.label.length; plainStart = offset
  }
  if (plainStart < text.length) result.push({ text: text.slice(plainStart) })
  return result
})

function rememberCursor() {
  if (input.value) cursor = { start: input.value.selectionStart, end: input.value.selectionEnd }
}
function syncScroll() {
  if (!input.value || !mirror.value) return
  mirror.value.style.width = input.value.clientWidth + 'px'
  mirror.value.style.height = input.value.clientHeight + 'px'
  mirror.value.scrollTop = input.value.scrollTop
  mirror.value.scrollLeft = input.value.scrollLeft
}
function inputChanged(event) {
  const value = event.target.value
  emit('update:modelValue', value)
  const ids = mentioned.value.filter(component => hasComponentMention(value, component) ||
    (props.componentIds.includes(component.id) && !hasComponentMention(props.modelValue, component))).map(component => component.id)
  if (ids.length !== props.componentIds.length || ids.some((item, index) => item !== props.componentIds[index])) emit('update:componentIds', ids)
  emit('input', event)
  rememberCursor(); nextTick(syncScroll)
}
function showChoices() {
  if (props.disabled) return
  rememberCursor(); query.value = ''; selected.value = [...props.componentIds]; open.value = true
}
function toggle(id) { selected.value = selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id] }
async function addSelected() {
  const components = selected.value.map(id => byId.value.get(id)).filter(Boolean)
  if (!components.length || props.disabled) return
  const before = props.modelValue.slice(0, cursor.start), after = props.modelValue.slice(cursor.end)
  const insertion = `${before && !/\s$/.test(before) ? ' ' : ''}${components.map(componentMentionLabel).join(' ')}${after && /^\s/.test(after) ? '' : ' '}`
  if (props.modelValue.length - (cursor.end - cursor.start) + insertion.length > limit.value) return
  known.value = new Set([...known.value, ...components.map(component => component.id)])
  open.value = false
  await nextTick()
  input.value?.focus()
  input.value?.setSelectionRange(cursor.start, cursor.end)
  let native = false
  try { native = document.execCommand('insertText', false, insertion) } catch { /* Native text editing fallback below. */ }
  if (!native && input.value) {
    input.value.setRangeText(insertion, cursor.start, cursor.end, 'end')
    inputChanged({ target: input.value })
  }
  const current = input.value?.value ?? before + insertion + after
  emit('update:modelValue', current)
  const ids = [...new Set([...props.componentIds, ...components.map(component => component.id)])]
    .filter(id => { const component = byId.value.get(id); return component && (hasComponentMention(current, component) ||
      (props.componentIds.includes(id) && !hasComponentMention(props.modelValue, component))) })
  emit('update:componentIds', ids)
  emit('selectComponents', ids)
  rememberCursor(); await nextTick(); syncScroll()
}
function clearHover() { clearTimeout(hoverTimer); hover.value = null }
function hoverAt(event) {
  if (composition.value || !mirror.value) return
  const { clientX: x, clientY: y } = event
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const token = [...mirror.value.querySelectorAll('[data-component-id]')].find(element => [...element.getClientRects()]
      .some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom))
    const component = token && byId.value.get(token.dataset.componentId)
    if (!component) return clearHover()
    clearTimeout(hoverTimer)
    const rect = token.getBoundingClientRect()
    hoverTimer = setTimeout(() => { hover.value = { component, left: Math.max(12, Math.min(rect.left, window.innerWidth - 338)),
      top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 268)) } }, 130)
  })
}
function previewAssets(component) { return assets.value.get(component.id) || [] }
watch(() => props.componentIds, ids => { known.value = new Set([...known.value, ...ids]) }, { deep: true })
watch(() => props.components.map(component => ({ id: component.id, files: filesForComponent(component) })), components => {
  const previous = assets.value, next = new Map()
  components.forEach(({ id, files }) => next.set(id, files.map(file => {
    const cached = previous.get(id)?.find(asset => asset.file === file)
    return cached || { file, url: URL.createObjectURL(file), type: file.type || '' }
  })))
  previous.forEach((list, id) => list.forEach(asset => { if (!next.get(id)?.includes(asset)) URL.revokeObjectURL(asset.url) }))
  assets.value = next
}, { immediate: true })
watch(open, value => { if (!value) nextTick(() => { input.value?.focus(); input.value?.setSelectionRange(cursor.start, cursor.end) }) })
watch(() => props.modelValue, () => nextTick(syncScroll))
onMounted(() => { syncScroll(); if (typeof ResizeObserver !== 'undefined' && input.value) { resizeObserver = new ResizeObserver(syncScroll); resizeObserver.observe(input.value) } })
onBeforeUnmount(() => { clearHover(); cancelAnimationFrame(frame); resizeObserver?.disconnect(); assets.value.forEach(list => list.forEach(asset => URL.revokeObjectURL(asset.url))) })
defineExpose({ focus: () => input.value?.focus(), textarea: input })
</script>

<template>
  <div class="component-prompt">
    <header><label v-if="label" :for="id">{{ label }}</label><q-space /><q-btn flat dense no-caps size="sm" class="component-prompt__mention" icon="mdi-at" label="Mencionar componente" :disable="disabled || !components.length" @click="showChoices" /></header>
    <div class="component-prompt__field" :class="{ 'is-disabled': disabled }">
      <div ref="mirror" class="component-prompt__mirror" aria-hidden="true"><template v-for="(part, index) in parts" :key="index"><strong v-if="part.id" :data-component-id="part.id">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>{{ '\n' }}</div>
      <textarea :id="id" ref="input" :value="modelValue" :rows="Number(rows)" :maxlength="limit" :placeholder="placeholder" :disabled="disabled" :aria-label="label || 'Prompt'"
        @input="inputChanged" @scroll="syncScroll" @click="rememberCursor" @keyup="rememberCursor" @select="rememberCursor" @focus="emit('focus', $event)" @blur="rememberCursor(); clearHover(); emit('blur', $event)"
        @compositionstart="composition = true" @compositionend="composition = false" @mousemove="hoverAt" @mouseleave="clearHover" />
    </div>
    <q-dialog v-model="open">
      <q-card class="component-prompt__dialog aito-ai-theme">
        <header><div><h2>Mencionar componentes</h2><p>Escolha os objetos e suas referências para este prompt.</p></div><q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar componentes" /></header>
        <q-input v-model="query" :dark="isDark" outlined dense clearable label="Buscar objeto ou tipo de componente"><template #prepend><q-icon name="mdi-magnify" /></template></q-input>
        <div class="component-prompt__choices">
          <button v-for="component in choices" :key="component.id" type="button" class="component-prompt__choice" :aria-pressed="selected.includes(component.id)" @click="toggle(component.id)">
            <span class="component-prompt__choice-media"><template v-for="(asset, index) in previewAssets(component).slice(0, 3)" :key="index"><img v-if="asset.type.startsWith('image/')" :src="asset.url" alt="" /><video v-else-if="asset.type.startsWith('video/')" :src="asset.url" muted playsinline preload="metadata" /><q-icon v-else name="mdi-file-music-outline" size="28px" /></template><q-icon v-if="!previewAssets(component).length" name="mdi-shape-outline" size="30px" /></span>
            <span class="component-prompt__choice-text"><small>{{ component.type }}</small><strong>{{ component.title || 'Componente' }}</strong><span>{{ previewAssets(component).length }} referência{{ previewAssets(component).length === 1 ? '' : 's' }}</span></span>
            <q-icon :name="selected.includes(component.id) ? 'mdi-checkbox-marked-circle' : 'mdi-checkbox-blank-circle-outline'" size="23px" />
          </button>
          <p v-if="!choices.length" class="component-prompt__empty">Nenhum componente encontrado.</p>
        </div>
        <footer><span>{{ selected.length }} selecionado{{ selected.length === 1 ? '' : 's' }}</span><q-btn v-close-popup flat no-caps label="Cancelar" /><q-btn unelevated no-caps class="component-prompt__add" icon="mdi-plus" label="Adicionar" :disable="!selected.length || disabled" @click="addSelected" /></footer>
      </q-card>
    </q-dialog>
    <Teleport to="body"><aside v-if="hover" class="component-prompt__quick aito-ai-theme" role="tooltip" :style="{ left: `${hover.left}px`, top: `${hover.top}px` }"><header><small>{{ hover.component.type }}</small><strong>{{ hover.component.title }}</strong></header><div v-if="previewAssets(hover.component).length" class="component-prompt__quick-media"><template v-for="(asset, index) in previewAssets(hover.component).slice(0, 4)" :key="index"><img v-if="asset.type.startsWith('image/')" :src="asset.url" alt="" /><video v-else-if="asset.type.startsWith('video/')" :src="asset.url" muted playsinline preload="metadata" /><span v-else><q-icon name="mdi-file-music-outline" size="30px" />{{ asset.file.name }}</span></template></div><p v-if="hover.component.prompt">{{ hover.component.prompt }}</p></aside></Teleport>
  </div>
</template>

<style scoped>
.component-prompt { display: grid; gap: 6px; min-width: 0; }
.component-prompt > header { display: flex; align-items: center; gap: 8px; min-width: 0; }
.component-prompt > header > label { margin: 0; color: var(--aito-ai-muted); font-size: .84rem; font-weight: 620; }
.component-prompt__mention { color: var(--aito-ai-accent); border-radius: 7px; }
.component-prompt__field { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--aito-ai-line); border-radius: 10px; background: var(--aito-ai-bg); }
.component-prompt__field:focus-within { outline: 2px solid var(--aito-ai-accent-strong); outline-offset: 2px; }
.component-prompt__mirror,.component-prompt__field textarea { box-sizing: border-box; width: 100%; margin: 0; padding: 11px 12px; font: 400 13px/1.6 'Geist Mono', 'SFMono-Regular', Consolas, monospace !important; letter-spacing: 0; tab-size: 4; white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; }
.component-prompt__mirror { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; color: var(--aito-ai-text); }
.component-prompt__mirror strong { font-weight: 750; border-radius: 3px; color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); box-shadow: inset 0 -1px 0 var(--aito-ai-accent-strong); }
.component-prompt__field textarea { position: relative; z-index: 1; display: block; min-height: 84px; border: 0 !important; outline: none !important; resize: vertical; background: transparent !important; color: transparent !important; caret-color: var(--aito-ai-text); -webkit-text-fill-color: transparent; }
.component-prompt__field textarea::placeholder { color: var(--aito-ai-muted); -webkit-text-fill-color: var(--aito-ai-muted); opacity: .7; }
.component-prompt__field textarea::selection { color: transparent; background: #4892dd4a; }
.component-prompt__field.is-disabled { opacity: .6; }
.component-prompt__dialog { width: min(750px, calc(100vw - 28px)); max-width: 95vw !important; max-height: 92dvh; display: flex; flex-direction: column; gap: 15px; padding: 21px; border: 1px solid var(--aito-ai-line); border-radius: 19px; color: var(--aito-ai-text); background: var(--aito-ai-surface); }
.component-prompt__dialog > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.component-prompt__dialog h2 { margin: 0 0 7px; font-size: 1.2rem; font-weight: 750; line-height: 1.2; }
.component-prompt__dialog p { margin: 0; color: var(--aito-ai-muted); font-size: .8rem; line-height: 1.5; }
.component-prompt__choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); min-height: 100px; overflow: auto; gap: 9px; padding: 2px; }
.component-prompt__choice { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 11px; border: 1px solid var(--aito-ai-line); border-radius: 12px; color: var(--aito-ai-text); background: var(--aito-ai-panel); text-align: left; cursor: pointer; }
.component-prompt__choice[aria-pressed=true] { border-color: var(--aito-ai-accent-strong); background: var(--aito-ai-accent-soft); }
.component-prompt__choice > .q-icon { flex: none; color: var(--aito-ai-accent); }
.component-prompt__choice-media { flex: 0 0 63px; display: flex; align-items: center; justify-content: center; height: 61px; overflow: hidden; border-radius: 8px; background: var(--aito-ai-media-bg); color: var(--aito-ai-muted); }
.component-prompt__choice-media > img,.component-prompt__choice-media > video { min-width: 0; width: 100%; height: 100%; object-fit: cover; flex: 1; }
.component-prompt__choice-text { display: grid; flex: 1; gap: 4px; min-width: 0; }
.component-prompt__choice-text strong { font-size: .83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.component-prompt__choice-text small,.component-prompt__choice-text > span { color: var(--aito-ai-muted); font-size: .68rem; }
.component-prompt__dialog > footer { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--aito-ai-line); padding-top: 13px; }
.component-prompt__dialog > footer > span { flex: 1; color: var(--aito-ai-muted); font-size: .77rem; }
.component-prompt__add { color: var(--aito-ai-on-accent); background: var(--aito-ai-gradient); }
.component-prompt__quick { position: fixed; z-index: 9500; width: min(320px, calc(100vw - 24px)); max-height: 250px; overflow: hidden; padding: 13px; pointer-events: none; border: 1px solid var(--aito-ai-line); border-radius: 12px; color: var(--aito-ai-text); background: var(--aito-ai-surface); box-shadow: 0 12px 38px var(--aito-ai-shadow); }
.component-prompt__quick > header { display: grid; gap: 3px; margin-bottom: 10px; }
.component-prompt__quick small { color: var(--aito-ai-muted); font-size: .65rem; }
.component-prompt__quick strong { font-size: .85rem; }
.component-prompt__quick-media { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.component-prompt__quick-media > img,.component-prompt__quick-media > video { width: 100%; max-height: 115px; height: auto; object-fit: contain; background: var(--aito-ai-bg); border-radius: 5px; }
.component-prompt__quick-media > span { display: grid; place-items: center; gap: 5px; color: var(--aito-ai-muted); font-size: .6rem; overflow-wrap: anywhere; }
.component-prompt__quick p { margin: 9px 0 0; font-size: .72rem; line-height: 1.5; max-height: 48px; overflow: hidden; }
@media(max-width:560px) { .component-prompt > header { flex-wrap: wrap; gap: 3px; }.component-prompt__choices { grid-template-columns: minmax(0,1fr); }.component-prompt__dialog { padding: 16px; }.component-prompt__choice-media { flex-basis: 75px; }.component-prompt__dialog > footer { gap: 4px; }.component-prompt__dialog > footer > span { font-size: .66rem; } }
</style>
