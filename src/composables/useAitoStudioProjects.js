import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { AITOIA_RETENTION_MS, createAitoIALocalStore } from 'src/services/aitoiaLocal'

export function useAitoStudioProjects({ studio, accountId, busy, defaultName, snapshot, restore, watch: fields }) {
  const activeId = ref('')
  const loading = ref(false)
  const storageError = ref('')
  const records = shallowRef([])
  const projects = computed(() => records.value.map(({ id, title, expiresAt }) => ({ id, title, expiresAt })))
  let store
  let operation
  let timer
  let writes = Promise.resolve()
  let dirty = false
  let expiredActive = false

  function remember(project) {
    records.value = [project, ...records.value.filter(item => item.id !== project.id)]
  }

  function flush() {
    clearTimeout(timer)
    if (!dirty || !store || !activeId.value || loading.value || expiredActive) return writes
    dirty = false
    const target = store
    const id = activeId.value
    const previous = records.value.find(item => item.id === id)
    if (!previous || previous.expiresAt <= Date.now()) return writes
    const data = snapshot()
    const project = { ...data, id, createdAt: previous.createdAt, updatedAt: Date.now(), expiresAt: previous.expiresAt,
      title: data.title?.trim() || defaultName }
    remember(project)
    writes = writes.then(() => target.save(project)).then(() => {
      if (store === target) storageError.value = ''
    }, () => {
      if (store === target) storageError.value = 'O navegador não conseguiu salvar este projeto. Baixe as mídias que quiser guardar.'
    })
    return writes
  }

  watch(fields, () => {
    if (loading.value || !activeId.value || expiredActive) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, 250)
  }, { flush: 'sync' })

  async function loadProject(project, { reset = true } = {}) {
    operation?.abort()
    const controller = new AbortController()
    operation = controller
    loading.value = true
    expiredActive = false
    activeId.value = project?.id || ''
    try {
      if (reset) await restore(project, controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted) storageError.value = cause.message || 'Não foi possível abrir este projeto.'
    } finally {
      if (operation === controller) { loading.value = false; operation = null }
    }
  }

  async function create({ reset = true } = {}) {
    const createdAt = Date.now()
    const project = { id: crypto.randomUUID(), title: defaultName, createdAt, expiresAt: createdAt + AITOIA_RETENTION_MS }
    remember(project)
    await loadProject(project, { reset })
    if (project.id !== activeId.value) return
    dirty = true
    flush()
  }

  function createProject() {
    if (!store || busy.value || loading.value) return
    flush()
    return create()
  }

  function openProject(id) {
    if (id === activeId.value || busy.value || loading.value) return
    const project = records.value.find(item => item.id === id && item.expiresAt > Date.now())
    if (!project) return
    flush()
    return loadProject(project)
  }

  async function deleteProject(id) {
    if (!store || busy.value || loading.value) return
    flush()
    const target = store
    loading.value = true
    try {
      await writes
      await target.remove(id)
      if (store !== target) return
      records.value = records.value.filter(item => item.id !== id)
      if (activeId.value === id) {
        if (records.value.length) await loadProject(records.value[0])
        else await create()
      }
    } catch {
      if (store === target) storageError.value = 'O navegador não conseguiu excluir este projeto.'
    } finally { if (store === target) loading.value = false }
  }

  function replaceExpiredProject() {
    if (!expiredActive || busy.value || loading.value || !store) return
    if (records.value.length) void loadProject(records.value[0])
    else void create()
  }
  watch(busy, replaceExpiredProject)

  watch(accountId, async (id, previous) => {
    flush()
    operation?.abort()
    operation = null
    const oldStore = store
    store = null
    activeId.value = ''
    records.value = []
    storageError.value = ''
    expiredActive = false
    void writes.then(() => oldStore?.dispose())
    if (!id) {
      if (previous) await loadProject(null)
      return
    }
    loading.value = true
    const target = createAitoIALocalStore(`studio:${studio}:${id}`, { onExpire: () => {
      if (store !== target) return
      records.value = records.value.filter(item => item.expiresAt > Date.now())
      expiredActive = !records.value.some(item => item.id === activeId.value)
      replaceExpiredProject()
    } })
    store = target
    try {
      const saved = await target.list()
      if (store !== target) return
      records.value = saved
      if (saved.length) await loadProject(saved[0])
      else await create({ reset: Boolean(previous) })
    } catch {
      if (store === target) {
        storageError.value = 'O navegador não conseguiu abrir os projetos salvos.'
        await loadProject(null, { reset: Boolean(previous) })
      }
    }
  }, { immediate: true })

  onMounted(() => window.addEventListener('pagehide', flush))
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flush)
    flush()
    operation?.abort()
    const oldStore = store
    store = null
    void writes.then(() => oldStore?.dispose())
  })

  return { projects, activeId, loading, storageError, createProject, openProject, deleteProject, saveProject: flush }
}
