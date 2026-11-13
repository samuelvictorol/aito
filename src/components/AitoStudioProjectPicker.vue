<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AITOIA_STUDIO_LIMIT, canRenewStudio } from 'src/services/aitoiaLocal'

const props = defineProps({
  projects: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  loading: Boolean,
  disabled: Boolean,
  storageError: { type: String, default: '' },
  cloudState: { type: String, default: 'local' },
  drawer: Boolean,
  canExport: Boolean,
})
const emit = defineEmits(['create', 'open', 'remove', 'renew', 'import', 'export'])
const deleting = ref(false)
const input = ref(null)
const now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 10000) })
onUnmounted(() => clearInterval(timer))
const activeProject = computed(() => props.projects.find(project => project.id === props.activeId))
const atLimit = computed(() => props.projects.length >= AITOIA_STUDIO_LIMIT)
const canRenew = computed(() => canRenewStudio(activeProject.value?.expiresAt, now.value))
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
function selectFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) emit('import', file)
}
</script>

<template>
  <div class="aito-projects" :class="{ 'aito-projects--drawer': drawer }">
    <div class="aito-projects__controls">
      <label>
        <span><q-icon name="mdi-folder-multiple-outline" size="18px" /> Projetos · {{ projects.length }}/{{ AITOIA_STUDIO_LIMIT }}</span>
        <select :value="activeId" :disabled="disabled || loading || !projects.length" @change="emit('open', $event.target.value)">
          <option v-if="!projects.length" value="">{{ loading ? 'Carregando projetos…' : 'Nenhum projeto salvo' }}</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
        </select>
      </label>
      <button type="button" :disabled="disabled || loading || atLimit" @click="emit('create')"><q-icon name="mdi-plus" size="19px" /> Novo projeto</button>
      <button v-if="activeProject" type="button" aria-label="Excluir projeto" :disabled="disabled || loading" @click="deleting = true"><q-icon name="mdi-delete-outline" size="20px" /></button>
    </div>
    <div class="aito-projects__actions">
      <input ref="input" type="file" accept=".zip,application/zip" hidden @change="selectFile" />
      <q-btn outline no-caps icon="mdi-folder-upload-outline" label="Importar projeto ZIP" :disable="disabled || loading || atLimit" @click="input?.click()" />
      <q-btn v-if="canExport && activeProject" outline no-caps icon="mdi-folder-zip-outline" label="Baixar projeto ZIP" :disable="disabled || loading" @click="emit('export')" />
    </div>
    <small v-if="atLimit">Exclua um projeto para criar ou importar outro.</small>
    <small v-if="activeProject" role="status">
      {{ cloudState === 'saved' ? 'Projeto salvo' : cloudState === 'saving' ? 'Sincronizando' : 'Cópia local' }} · expira em {{ date.format(activeProject.expiresAt) }}
    </small>
    <q-btn v-if="canRenew" outline no-caps color="teal-3" icon="mdi-calendar-plus" label="Prorrogar por 7 dias" :disable="disabled || loading" @click="emit('renew', activeId)" />
    <small v-if="storageError" class="aito-projects__error" role="status">{{ storageError }}</small>
    <q-dialog v-model="deleting">
      <q-card class="aito-ai-theme aito-projects__dialog">
        <q-card-section><h2>Excluir projeto?</h2><p>A montagem e as referências de {{ activeProject?.title }} serão removidas. Cenas reutilizadas em outros projetos continuam lá até a data de expiração.</p></q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancelar" />
          <q-btn v-close-popup unelevated no-caps color="red-9" label="Excluir" :disable="disabled || loading || !activeId" @click="emit('remove', activeId)" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.aito-projects { display: grid; gap: 5px; min-width: 0; }
.aito-projects__controls { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.aito-projects__controls label { display: flex; align-items: center; gap: 9px; min-width: 0; }
.aito-projects__controls label span { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; }
.aito-projects__controls select, .aito-projects__controls button { min-height: 37px; border: 1px solid var(--aito-ai-line); border-radius: 8px; background: var(--aito-ai-panel); color: var(--aito-ai-text); padding: 5px 8px; font: inherit; }
.aito-projects__controls select { min-width: 0; width: min(200px, 100%); text-overflow: ellipsis; }
.aito-projects__controls button { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.aito-projects__controls button:disabled { opacity: .54; cursor: not-allowed; }
.aito-projects__controls button:focus-visible, .aito-projects__controls select:focus-visible { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
.aito-projects--drawer { gap: 9px; }
.aito-projects--drawer .aito-projects__controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; }
.aito-projects--drawer .aito-projects__controls label { display: grid; grid-column: 1 / -1; gap: 8px; }
.aito-projects--drawer .aito-projects__controls label span { font-size: .9rem; }
.aito-projects--drawer .aito-projects__controls select { width: 100%; padding-inline: 11px; }
.aito-projects--drawer .aito-projects__controls button { justify-content: center; padding-inline: 10px; }
.aito-projects--drawer .aito-projects__controls :is(select, button) { min-height: 44px; }
.aito-projects--drawer small { line-height: 1.4; }
.aito-projects__actions { display: grid; gap: 8px; }
.aito-projects__actions .q-btn { min-height: 42px; color: var(--aito-ai-accent); }
.aito-projects small { color: var(--aito-ai-muted); }
.aito-projects__error { color: var(--aito-ai-error) !important; }
.aito-projects__dialog { width: min(420px, 95vw); background: var(--aito-ai-surface); color: var(--aito-ai-text); }
.aito-projects__dialog h2 { margin: 0 0 8px; font-size: 1.15rem; }
.aito-projects__dialog p { margin: 0; }
</style>
