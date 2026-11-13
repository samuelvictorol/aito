import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { AITOIA_RETENTION_MS, AITOIA_STUDIO_LIMIT, canRenewStudio, createAitoIALocalStore, renewStudioMedia } from 'src/services/aitoiaLocal'
import { createStudioCloud } from 'src/services/aitoiaStudioCloud'

export function useAitoStudioProjects({ studio, accountId, busy, defaultName, snapshot, restore, watch: fields }) {
  const activeId = ref('')
  const loading = ref(false)
  const storageError = ref('')
  const records = shallowRef([])
  const cloudState = ref('loading')
  const projects = computed(() => records.value.map(({ id, title, expiresAt }) => ({ id, title, expiresAt })))
  const atLimit = computed(() => projects.value.length >= AITOIA_STUDIO_LIMIT)
  let store
  let cloud
  let operation
  let timer
  let writes = Promise.resolve()
  let cloudWrites = Promise.resolve()
  let dirty = false
  let expiredActive = false
  const cloudProjects = new Set()

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
      title: data.title?.trim() || defaultName, cloudSaved: previous.cloudSaved }
    remember(project)
    const remote = cloud
    writes = writes.then(async () => {
      try {
        await target.save(project)
        if (store === target) storageError.value = ''
      } catch {
        if (store === target) storageError.value = 'O navegador não conseguiu salvar este projeto. Baixe as mídias que quiser guardar.'
      }
    })
    if (remote) cloudWrites = cloudWrites.then(async () => {
      if (cloud !== remote || records.value.find(item => item.id === project.id)?.updatedAt > project.updatedAt) return
      if (activeId.value === project.id) cloudState.value = 'saving'
      try {
        const saved = await remote.save(project)
        if (cloud !== remote) return
        cloudProjects.add(project.id)
        if (activeId.value === project.id) cloudState.value = 'saved'
        records.value = records.value.map(item => item.id === project.id ? { ...item, cloudSaved: true,
          expiresAt: saved.expiresAt } : item)
      } catch {
        if (cloud === remote && activeId.value === project.id) cloudState.value = 'local'
      }
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
      const resolved = project?.cloudOnly ? await cloud.expand(project, controller.signal) : project
      controller.signal.throwIfAborted()
      if (reset) await restore(resolved, controller.signal)
      if (project?.cloudOnly && resolved) {
        remember(resolved)
        await store?.save(resolved).catch(cause => {
          if (cause.code !== 'AITOIA_RECORD_LIMIT') throw cause
        })
      }
      if (resolved && cloudState.value !== 'saving') cloudState.value = cloudProjects.has(resolved.id) ? 'saved' : 'local'
    } catch (cause) {
      if (!controller.signal.aborted) storageError.value = cause.message || 'Não foi possível abrir este projeto.'
    } finally {
      if (operation === controller) { loading.value = false; operation = null }
    }
  }

  async function create({ reset = true, readImport } = {}) {
    const target = store
    const remote = cloud
    if (!target || atLimit.value) return
    const previousId = activeId.value
    loading.value = true
    storageError.value = ''
    const controller = new AbortController()
    operation = controller
    const createdAt = Date.now()
    const id = crypto.randomUUID()
    const expiresAt = createdAt + AITOIA_RETENTION_MS
    try {
      const imported = readImport ? await readImport({ expiresAt, signal: controller.signal }) : null
      controller.signal.throwIfAborted()
      await writes
      controller.signal.throwIfAborted()
      const project = await target.save({ ...imported, id, title: imported?.title || defaultName, createdAt, expiresAt })
      if (store !== target) return
      if (remote) {
        try {
          await cloudWrites
          controller.signal.throwIfAborted()
          const saved = await remote.save(project)
          if (store !== target) return
          project.cloudSaved = true
          project.expiresAt = saved.expiresAt
          cloudProjects.add(id)
        } catch (cause) {
          if (cause.response?.data?.code === 'AITO_STUDIO_LIMIT' || [409, 429].includes(cause.response?.status)) {
            await target.remove(id)
            throw new Error(cause.response?.data?.message || 'Não foi possível criar o projeto agora. Tente novamente.')
          }
        }
      }
      controller.signal.throwIfAborted()
      remember(project)
      await loadProject(project, { reset })
      if (project.id !== activeId.value) return
      if (!imported) {
        dirty = true
        flush()
      }
    } catch (cause) {
      if (store === target && !controller.signal.aborted) {
        activeId.value = previousId
        storageError.value = cause.message || 'Não foi possível salvar o novo projeto.'
      }
    } finally {
      if (operation === controller) { operation = null; loading.value = false }
    }
  }

  function createProject() {
    if (!store || busy.value || loading.value) return
    flush()
    return create()
  }

  function importProject(readImport) {
    if (!store || busy.value || loading.value || atLimit.value) return
    flush()
    return create({ readImport })
  }

  function openProject(id) {
    if (id === activeId.value || busy.value || loading.value) return
    const project = records.value.find(item => item.id === id && item.expiresAt > Date.now())
    if (!project) return
    flush()
    return loadProject(project)
  }

  async function resolveProject(id) {
    const record = records.value.find(item => item.id === id && item.expiresAt > Date.now())
    if (!record) return null
    return record.cloudOnly ? cloud?.expand(record) : record
  }

  async function deleteProject(id) {
    if (!store || busy.value || loading.value) return
    flush()
    const target = store
    const remote = cloud
    loading.value = true
    try {
      await Promise.all([writes, cloudWrites])
      if (remote && (cloudProjects.has(id) || records.value.find(item => item.id === id)?.cloudSaved)) await remote.remove(id)
      await target.remove(id)
      if (store !== target) return
      cloudProjects.delete(id)
      records.value = records.value.filter(item => item.id !== id)
      if (activeId.value === id) {
        if (records.value.length) await loadProject(records.value[0])
        else await create()
      }
    } catch {
      if (store === target) storageError.value = 'O navegador não conseguiu excluir este projeto.'
    } finally { if (store === target) loading.value = false }
  }

  async function renewProject(id) {
    const target = store
    const remote = cloud
    if (!target || busy.value || loading.value) return
    flush()
    const previous = records.value.find(item => item.id === id)
    if (!previous || !canRenewStudio(previous.expiresAt)) return
    loading.value = true
    storageError.value = ''
    try {
      await Promise.all([writes, cloudWrites])
      if (store !== target) return
      const current = records.value.find(item => item.id === id)
      if (!current) return
      let renewed
      if (remote && (cloudProjects.has(id) || current.cloudSaved)) {
        const saved = await remote.renew(id, current.expiresAt)
        if (store !== target) return
        if (current.cloudOnly) renewed = saved
        else {
          renewed = renewStudioMedia(current, saved.expiresAt)
          await target.save(renewed).catch(cause => {
            if (cause.code !== 'AITOIA_RECORD_LIMIT') throw cause
          })
        }
      } else renewed = await target.renew(id, current.expiresAt)
      if (store !== target) return
      remember(renewed)
      if (activeId.value === id) await loadProject(renewed)
      else replaceExpiredProject()
    } catch (cause) {
      if (store === target) storageError.value = cause.response?.data?.message || cause.message || 'Não foi possível prorrogar o projeto.'
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
    const oldCloud = cloud
    store = null
    cloud = null
    oldCloud?.dispose()
    cloudWrites = Promise.resolve()
    activeId.value = ''
    records.value = []
    cloudProjects.clear()
    storageError.value = ''
    expiredActive = false
    cloudState.value = 'loading'
    void writes.then(() => oldStore?.dispose())
    if (!id) {
      if (previous) await loadProject(null)
      return
    }
    loading.value = true
    const target = createAitoIALocalStore(`studio:${studio}:${id}`, { studio: true, maxRecords: AITOIA_STUDIO_LIMIT, onExpire: () => {
      if (store !== target) return
      records.value = records.value.filter(item => item.expiresAt > Date.now())
      expiredActive = !records.value.some(item => item.id === activeId.value)
      replaceExpiredProject()
    } })
    store = target
    const remote = createStudioCloud(studio)
    cloud = remote
    try {
      const [local, uploaded] = await Promise.all([target.list(), remote.list().catch(() => null)])
      if (store !== target) return
      const deleted = new Set(uploaded?.deletedIds)
      await Promise.all(local.filter(item => deleted.has(item.id)).map(item => target.remove(item.id))).catch(() => {})
      if (store !== target) return
      const savedById = new Map(local.filter(item => !deleted.has(item.id)).map(item => [item.id, item]))
      for (const item of uploaded?.items || []) {
        cloudProjects.add(item.id)
        const duplicate = savedById.get(item.id)
        if (!duplicate || item.updatedAt > duplicate.updatedAt + 2000) savedById.set(item.id, item)
        else savedById.set(item.id, { ...renewStudioMedia(duplicate, item.expiresAt), cloudSaved: true })
      }
      const saved = [...savedById.values()].filter(item => item.expiresAt > Date.now()).sort((a, b) => b.updatedAt - a.updatedAt)
      cloudState.value = uploaded === null ? 'local' : 'saved'
      records.value = saved
      if (saved.length) {
        await loadProject(saved[0])
        if (uploaded && uploaded.items.length < AITOIA_STUDIO_LIMIT && !saved[0].cloudSaved && store === target && activeId.value === saved[0].id) {
          dirty = true
          flush()
        }
      }
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
    const oldCloud = cloud
    void cloudWrites.then(() => oldCloud?.dispose())
  })

  return { projects, records, activeId, loading, storageError, cloudState, atLimit,
    createProject, importProject, openProject, resolveProject, deleteProject, renewProject, saveProject: flush }
}
