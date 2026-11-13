<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { api } from 'boot/axios'
import AitoIAModeSwitch from 'components/AitoIAModeSwitch.vue'
import AitoStudioProjectPicker from 'components/AitoStudioProjectPicker.vue'
import { aitoTokens, usd, useAitoIA } from 'src/composables/useAitoIA'
import { useAitoStudioProjects } from 'src/composables/useAitoStudioProjects'
import { useAitoWorkGuard } from 'src/composables/useAitoWorkGuard'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { accessMarketingKit, exportMarketingImage, loadMarketingReferenceUrl, marketingFormats, prepareMarketingReference, readMarketingImage } from 'src/services/aitoiaMarketingLocal'
import { exportMarketingProject, readStudioProject } from 'src/services/aitoiaStudioArchive'
import 'src/css/aitoia-theme.css'

const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const AitoIAWallet = defineAsyncComponent(() => import('components/AitoIAWallet.vue'))
const path = '/aitoia-marketing-studio'
const $q = useQuasar()
const drawerBreakpoint = 900
const drawerOpen = ref(false)
const drawerButton = ref(null)
const drawerCloseButton = ref(null)
const mobileDrawer = computed(() => $q.screen.width > 0 && $q.screen.width <= drawerBreakpoint)
const drawerWidth = computed(() => mobileDrawer.value ? Math.min(320, Math.round($q.screen.width * .9)) : 304)
const wallet = useAitoIA({ chatHistory: false })
const { accountId, signedIn, status, walletId } = wallet
const catalog = ref(null)
const catalogLoading = ref(false)
const catalogError = ref(false)
const formatId = ref('feed')
const prompt = ref('')
const references = shallowRef([])
const kit = shallowRef([])
const projectKit = shallowRef([])
const selectedKit = ref([])
const kitLoading = ref(false)
const componentDialog = ref(false)
const componentLabel = ref('')
const componentText = ref('')
const componentFile = shallowRef(null)
const componentUrl = ref('')
const componentOrigin = ref('upload')
const componentPreview = shallowRef(null)
const componentPreviewBusy = ref(false)
const componentImageError = ref('')
const kitBusy = ref(false)
const uploading = ref(false)
const busy = ref(false)
const blockedExit = ref(false)
const error = ref('')
const kitError = ref('')
const quote = ref(null)
const images = shallowRef([])
const imageId = ref('')
const projectTitle = ref('')
const palette = ref([])
const paletteDialog = ref(false)
const paletteColor = ref('')
const paletteIndex = ref(-1)
const defaultPaletteColor = '#13BC9D'
const isPaletteColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const authOpen = ref(false)
const authMode = ref('login')
const walletOpen = ref(false)
let operation
let previewRequest
let kitEpoch = 0

const formats = computed(() => {
  if (!catalog.value?.formats?.length) return marketingFormats
  return catalog.value.formats.map(item => ({ ...item, icon: marketingFormats.find(entry => entry.id === item.id)?.icon || 'mdi-image-outline' }))
})
const format = computed(() => formats.value.find(item => item.id === formatId.value) || formats.value[0])
const maxReferences = computed(() => catalog.value?.maxReferences || 6)
const maxReferenceBytes = computed(() => catalog.value?.maxReferenceBytes || 786432)
const maxComponents = computed(() => catalog.value?.maxComponents || 6)
const maxPaletteColors = computed(() => catalog.value?.maxPaletteColors || 10)
const availableKit = computed(() => [...kit.value, ...projectKit.value])
const activeKit = computed(() => availableKit.value.filter(item => selectedKit.value.includes(item.id)))
const referenceCount = computed(() => references.value.length + activeKit.value.filter(item => item.blob).length)
const locked = computed(() => busy.value || uploading.value || !!quote.value)
const output = computed(() => images.value.find(image => image.id === imageId.value) || null)

useMeta({ title: 'AitoIA | Estúdio de Marketing' })
useAitoWorkGuard(busy, () => { blockedExit.value = true })
watch(busy, active => { if (!active) blockedExit.value = false })

function localAsset(item) { return { ...item, url: item.blob ? URL.createObjectURL(item.blob) : '' } }
function disposeAsset(item) { if (item?.url) URL.revokeObjectURL(item.url) }
function resetComponentPreview() {
  previewRequest?.abort()
  previewRequest = null
  componentPreviewBusy.value = false
  componentImageError.value = ''
  disposeAsset(componentPreview.value)
  componentPreview.value = null
}
watch([componentFile, componentOrigin, componentUrl], resetComponentPreview, { flush: 'sync' })
watch(componentDialog, open => { if (!open) resetComponentPreview() })
onBeforeUnmount(resetComponentPreview)

async function previewComponent() {
  resetComponentPreview()
  const owner = accountId.value
  const controller = new AbortController()
  previewRequest = controller
  componentPreviewBusy.value = true
  try {
    const blob = componentOrigin.value === 'url'
      ? await loadMarketingReferenceUrl(componentUrl.value.trim(), maxReferenceBytes.value, controller.signal)
      : await prepareMarketingReference(componentFile.value, maxReferenceBytes.value)
    if (controller.signal.aborted || owner !== accountId.value) return
    componentPreview.value = localAsset({ blob })
  } catch (cause) {
    if (!controller.signal.aborted) componentImageError.value = cause.message || 'Não foi possível abrir a imagem.'
  } finally { if (previewRequest === controller) componentPreviewBusy.value = false }
}
function clearProjectMedia() { [...images.value, ...references.value, ...projectKit.value].forEach(disposeAsset) }
function resetKit() { kit.value.forEach(disposeAsset); kit.value = [] }
function token() { return localStorage.getItem('aito_user_token') || '' }
const config = (access, signal, headers = {}) => ({ signal, headers: { Authorization: `Bearer ${access}`, ...headers } })

watch(accountId, async (id, previous) => {
  const epoch = ++kitEpoch
  kitLoading.value = Boolean(id)
  resetKit()
  kitError.value = ''
  if (previous) {
    operation?.abort()
    quote.value = null
    componentDialog.value = false
  }
  if (!id) return
  try {
    const saved = await accessMarketingKit(id, 'read')
    if (epoch === kitEpoch) kit.value = (saved || []).map(localAsset)
  } catch {
    if (epoch === kitEpoch) kitError.value = 'Não foi possível abrir os componentes salvos neste navegador.'
  } finally { if (epoch === kitEpoch) kitLoading.value = false }
})

const stripUrl = ({ url: _url, ...asset }) => asset
const project = useAitoStudioProjects({
  studio: 'marketing', accountId, busy: locked, defaultName: 'Projeto de marketing',
  watch: [projectTitle, formatId, prompt, references, selectedKit, projectKit, palette, images, imageId],
  snapshot: () => ({ title: projectTitle.value, formatId: formatId.value, prompt: prompt.value,
    references: references.value.map(stripUrl), selectedKit: [...selectedKit.value], projectKit: projectKit.value.map(stripUrl), palette: [...palette.value],
    images: images.value.map(stripUrl), imageId: imageId.value }),
  restore(saved) {
    clearProjectMedia()
    projectTitle.value = saved?.title || ''
    formatId.value = saved?.formatId || 'feed'
    prompt.value = saved?.prompt || ''
    references.value = (saved?.references || []).map(localAsset)
    selectedKit.value = saved?.selectedKit || []
    projectKit.value = (saved?.projectKit || []).map(localAsset)
    paletteDialog.value = false
    palette.value = Array.isArray(saved?.palette) ? saved.palette.filter(isPaletteColor).slice(0, maxPaletteColors.value) : []
    images.value = (saved?.images || []).map(localAsset)
    imageId.value = saved?.imageId || images.value[0]?.id || ''
    error.value = ''
  },
})
const { projects, activeId: projectId, loading: projectLoading, storageError, cloudState, createProject, openProject,
  deleteProject, renewProject, importProject, resolveProject, saveProject } = project

function importArchive(file) {
  return importProject(options => readStudioProject(file, 'marketing', options))
}

async function archiveProject() {
  if (locked.value || projectLoading.value) return
  const owner = accountId.value
  busy.value = true
  try {
    await saveProject()
    const record = await resolveProject(projectId.value)
    if (!record) throw new Error('O projeto expirou.')
    const zip = await exportMarketingProject(record, availableKit.value.filter(item =>
      record.selectedKit?.includes(item.id) || projectKit.value.includes(item)).map(stripUrl))
    if (owner === accountId.value) downloadAitoIAFile(zip, 'aitoia-projeto-marketing.zip')
  } catch (cause) {
    if (owner === accountId.value) error.value = cause.message || 'Não foi possível baixar o projeto.'
  } finally { busy.value = false }
}

const paletteLocked = computed(() => locked.value || projectLoading.value)
function editPaletteColor(index = -1) {
  paletteIndex.value = index
  paletteColor.value = palette.value[index] || defaultPaletteColor
  paletteDialog.value = true
}

function savePaletteColor() {
  if (paletteLocked.value || !isPaletteColor(paletteColor.value)) return
  const color = paletteColor.value.toUpperCase()
  if (paletteIndex.value >= 0) {
    palette.value = palette.value.map((current, index) => index === paletteIndex.value ? color : current)
  } else {
    if (palette.value.length >= maxPaletteColors.value) return
    palette.value = [...palette.value, color]
  }
  paletteDialog.value = false
}

function showWorkspace() {
  if (drawerOpen.value) { closeWorkspace(); return }
  drawerOpen.value = true
  nextTick(() => drawerCloseButton.value?.$el?.focus())
}

function closeWorkspace() {
  drawerOpen.value = false
  nextTick(() => drawerButton.value?.$el?.focus())
}

function selectProject(id) {
  openProject(id)
  if (mobileDrawer.value) closeWorkspace()
}

function removeImage(image) {
  disposeAsset(image)
  images.value = images.value.filter(item => item.id !== image.id)
  if (imageId.value === image.id) imageId.value = images.value[0]?.id || ''
  void saveProject()
}

async function loadCatalog() {
  catalogLoading.value = true
  catalogError.value = false
  try { catalog.value = (await api.get('/aitoia/marketing/catalog')).data.data }
  catch { catalogError.value = true }
  finally { catalogLoading.value = false }
}

function showAuth(mode = 'login') { authMode.value = mode; authOpen.value = true }
function showWallet() { walletOpen.value = true; wallet.refreshStatus(); wallet.loadHistory() }

async function addReferences(files) {
  if (locked.value || !files.length) return
  uploading.value = true
  error.value = ''
  const epoch = kitEpoch
  try {
    const room = Math.max(0, maxReferences.value - referenceCount.value)
    if (files.length > room) error.value = 'O limite é de seis referências, incluindo as imagens da marca selecionadas.'
    for (const file of files.slice(0, room)) {
      try {
        const blob = await prepareMarketingReference(file, maxReferenceBytes.value)
        if (epoch !== kitEpoch) return
        references.value = [...references.value, localAsset({ id: crypto.randomUUID(), label: file.name || 'Imagem', blob })]
      } catch (cause) { error.value = cause.message || 'Não foi possível abrir a referência.' }
    }
  } finally { uploading.value = false }
}

function pickReferences(event) {
  addReferences(Array.from(event.target.files))
  event.target.value = ''
}

function pasteReferences(event) {
  const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
  if (!files.length) return
  event.preventDefault()
  addReferences(files)
}

function removeReference(item) {
  disposeAsset(item)
  references.value = references.value.filter(reference => reference.id !== item.id)
}

function toggleKit(item) {
  const selected = selectedKit.value.includes(item.id)
  if (!selected && activeKit.value.length >= maxComponents.value) {
    error.value = 'Desmarque um componente antes de selecionar outro.'
    return
  }
  if (!selected && item.blob && referenceCount.value >= maxReferences.value) {
    error.value = 'Remova uma referência antes de adicionar esta imagem da marca.'
    return
  }
  error.value = ''
  selectedKit.value = selected ? selectedKit.value.filter(id => id !== item.id) : [...selectedKit.value, item.id]
}

async function saveKit(next) {
  const id = accountId.value
  if (!id) return false
  kitBusy.value = true
  kitError.value = ''
  try {
    await accessMarketingKit(id, 'write', next.map(({ url: _url, ...item }) => item))
    if (accountId.value !== id) return false
    kit.value = next
    return true
  } catch {
    if (accountId.value === id) kitError.value = 'O navegador não conseguiu salvar seus componentes. Verifique o espaço e as permissões locais.'
    return false
  } finally { kitBusy.value = false }
}

function openComponent() {
  componentLabel.value = ''
  componentText.value = ''
  componentFile.value = null
  componentOrigin.value = 'upload'
  componentUrl.value = ''
  componentDialog.value = true
}

async function addComponent() {
  const hasSource = componentOrigin.value === 'url' ? componentUrl.value.trim() : componentFile.value
  if (!componentLabel.value.trim() || (hasSource && !componentPreview.value) ||
    (!componentText.value.trim() && !componentPreview.value) || kit.value.length >= maxComponents.value) return
  kitBusy.value = true
  kitError.value = ''
  const id = accountId.value
  try {
    const blob = componentPreview.value?.blob || null
    if (id !== accountId.value) return
    const item = localAsset({ id: crypto.randomUUID(), label: componentLabel.value.trim(), text: componentText.value.trim(), blob })
    if (await saveKit([...kit.value, item])) componentDialog.value = false
    else disposeAsset(item)
  } catch (cause) { kitError.value = cause.message || 'Não foi possível preparar o componente.' }
  finally { kitBusy.value = false }
}

async function removeComponent(item) {
  if (projectKit.value.includes(item)) projectKit.value = projectKit.value.filter(entry => entry.id !== item.id)
  else if (!await saveKit(kit.value.filter(entry => entry.id !== item.id))) return
  selectedKit.value = selectedKit.value.filter(id => id !== item.id)
  disposeAsset(item)
}

async function quoteGeneration() {
  if (!signedIn.value) { showAuth(); return }
  if (locked.value || projectLoading.value || !prompt.value.trim() || !catalog.value?.available || !accountId.value) return
  busy.value = true
  error.value = ''
  const access = token()
  const controller = new AbortController()
  operation = controller
  const input = { walletId: walletId.value, format: format.value.id, referenceCount: referenceCount.value }
  try {
    const { data } = await api.post('/aitoia/marketing/quote', input, config(access, controller.signal))
    if (access === token() && !controller.signal.aborted) quote.value = { ...input, ...data.data }
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível calcular o valor da geração.'
  } finally { busy.value = false; operation = null }
}

async function generate() {
  const confirmed = quote.value
  if (!confirmed || busy.value) return
  const access = token()
  const imageFormat = format.value
  const selectedReferences = [...references.value, ...activeKit.value.filter(item => item.blob)]
  const components = activeKit.value.map(item => item.text).filter(Boolean)
  const controller = new AbortController()
  operation = controller
  quote.value = null
  busy.value = true
  error.value = ''
  try {
    const encoded = await Promise.all(selectedReferences.map(item => readMarketingImage(item.blob)))
    const { data } = await api.post('/aitoia/marketing/generations', {
      walletId: confirmed.walletId, format: confirmed.format, maxBilledUsdCents: confirmed.maxBilledUsdCents,
      prompt: prompt.value.trim(), references: encoded, components, palette: palette.value,
    }, config(access, controller.signal, { 'X-Aito-Request-Id': crypto.randomUUID() }))
    const blob = await exportMarketingImage(data.data.image, imageFormat)
    if (access !== token() || controller.signal.aborted) return
    const id = crypto.randomUUID()
    const label = prompt.value.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (!projectTitle.value || projectTitle.value === 'Projeto de marketing') projectTitle.value = label
    images.value = [localAsset({ id, blob, label, format: { ...imageFormat }, billed: data.data.billedUsdCents }), ...images.value]
    imageId.value = id
    await saveProject()
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause.response?.data?.message || 'Não foi possível concluir a imagem. Confira seu saldo antes de tentar novamente.'
  } finally {
    busy.value = false
    operation = null
    if (!controller.signal.aborted) wallet.refreshStatus({ silent: true })
  }
}

onMounted(loadCatalog)
onBeforeUnmount(() => {
  kitEpoch++
  operation?.abort()
  clearProjectMedia()
  resetKit()
})
</script>

<template>
  <q-layout view="hHh Lpr fFf" class="aito-ai-theme marketing">
    <q-header class="marketing__header" :inert="mobileDrawer && drawerOpen">
      <div class="marketing__bar">
        <div class="marketing__navigation">
          <q-btn ref="drawerButton" flat round icon="mdi-menu" aria-controls="marketing-workspace" :aria-expanded="drawerOpen"
            :aria-label="drawerOpen ? 'Recolher projetos e componentes' : 'Abrir projetos e componentes'"
            @click="showWorkspace"><q-tooltip>Projetos e componentes</q-tooltip></q-btn>
          <router-link to="/" class="marketing__brand" aria-label="Site AitoSoftwares"><img src="/ia.gif" width="37" height="37" alt="" /><strong>AitoIA</strong></router-link>
        </div>
        <div class="marketing__mode"><AitoIAModeSwitch mode="marketing" :busy="busy" /></div>
        <div class="marketing__account">
          <button v-if="signedIn" type="button" class="marketing__balance" :disabled="locked" @click="showWallet"><img src="/aitotokens.svg" width="24" height="24" alt="" /><span>{{ status ? `${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }}</span><q-icon name="mdi-plus" /></button>
          <button v-else type="button" class="marketing__secondary" @click="showAuth()">Entrar</button>
        </div>
      </div>
    </q-header>

    <q-drawer v-model="drawerOpen" show-if-above bordered dark no-swipe-open :breakpoint="drawerBreakpoint" :width="drawerWidth" class="marketing__drawer">
      <aside id="marketing-workspace" class="marketing__drawer-content" aria-labelledby="marketing-workspace-title" :inert="!drawerOpen" @keydown.esc.stop="closeWorkspace">
        <div class="marketing__section-title marketing__drawer-title">
          <h2 id="marketing-workspace-title">Projetos e componentes</h2>
          <q-btn ref="drawerCloseButton" flat round dense icon="mdi-close" aria-label="Fechar projetos e componentes" @click="closeWorkspace" />
        </div>
        <section class="marketing__drawer-section" aria-label="Projetos do Estúdio de Marketing">
          <AitoStudioProjectPicker drawer can-export :projects="projects" :active-id="projectId" :loading="projectLoading" :storage-error="storageError" :cloud-state="cloudState"
            :disabled="!accountId || locked" @create="createProject" @open="selectProject" @remove="deleteProject"
            @renew="renewProject" @import="importArchive" @export="archiveProject" />
          <q-input v-if="projectId" v-model="projectTitle" dark outlined label="Nome do projeto" maxlength="65" :disable="locked || projectLoading" />
        </section>
        <section class="marketing__drawer-section" aria-labelledby="marketing-palette">
          <div class="marketing__section-title"><h2 id="marketing-palette">Paleta de Cores</h2><span>{{ palette.length }}/{{ maxPaletteColors }}</span></div>
          <p v-if="!palette.length">Use as cores da sua marca nas imagens deste projeto.</p>
          <ul v-if="palette.length" class="marketing__palette">
            <li v-for="(color, index) in palette" :key="index">
              <q-btn flat no-caps align="left" class="marketing__palette-color" :aria-label="`Editar cor ${color}`" :disable="paletteLocked" @click="editPaletteColor(index)">
                <span class="marketing__swatch" :style="{ backgroundColor: color }" aria-hidden="true" /><span>{{ color }}</span><q-icon name="mdi-pencil-outline" size="16px" />
              </q-btn>
              <q-btn flat round icon="mdi-delete-outline" :aria-label="`Remover cor ${color}`" :disable="paletteLocked" @click="palette = palette.filter((_, position) => position !== index)" />
            </li>
          </ul>
          <q-btn outline no-caps class="marketing__add-component" icon="mdi-plus" label="Adicionar cor"
            :disable="paletteLocked || palette.length >= maxPaletteColors" @click="editPaletteColor()" />
        </section>
        <section class="marketing__drawer-section" aria-labelledby="marketing-kit">
          <div class="marketing__section-title"><h2 id="marketing-kit">Kit de marca</h2><span v-if="availableKit.length">{{ activeKit.length }}/{{ availableKit.length }} em uso</span></div>
          <q-btn outline no-caps class="marketing__add-component" icon="mdi-plus" label="Adicionar componente"
            :disable="locked || kitBusy || kitLoading || (signedIn && !accountId) || kit.length >= maxComponents"
            @click="signedIn ? openComponent() : showAuth()" />
          <p v-if="kitError" role="status">{{ kitError }}</p>
          <p v-else-if="kitLoading" role="status">Carregando componentes…</p>
          <p v-else-if="!availableKit.length">Adicione seu logo ou um texto que você reutiliza nas peças.</p>
          <ul v-if="availableKit.length" class="marketing__kit">
            <li v-for="item in availableKit" :key="item.id">
              <button type="button" :aria-pressed="selectedKit.includes(item.id)" :disabled="locked || kitBusy" @click="toggleKit(item)">
                <img v-if="item.url" :src="item.url" alt="" /><q-icon v-else name="mdi-text-box-outline" size="24px" /><span :title="item.label">{{ item.label }}</span><q-icon v-if="selectedKit.includes(item.id)" name="mdi-check-circle" size="17px" />
              </button>
              <button type="button" :disabled="locked || kitBusy" :aria-label="`Excluir componente ${item.label}`" @click="removeComponent(item)"><q-icon name="mdi-delete-outline" size="19px" /></button>
            </li>
          </ul>
        </section>
        <footer class="marketing__drawer-footer">
          <q-btn v-if="signedIn" flat no-caps class="full-width" icon="mdi-account-circle-outline" label="Meu perfil" :to="{ path: '/app', query: { tab: 'profile' } }" :disable="busy" />
          <q-btn v-else flat no-caps class="full-width" icon="mdi-account-circle-outline" label="Entrar para acessar o perfil" @click="showAuth()" />
        </footer>
      </aside>
    </q-drawer>

    <q-page-container :inert="mobileDrawer && drawerOpen">
      <q-page tag="main" class="marketing__main" @paste="pasteReferences">
        <div class="marketing__intro">
          <h1>Estúdio de Marketing</h1>
          <p>Crie imagens no formato de cada canal e reutilize os componentes da sua marca.</p>
        </div>
        <p v-if="blockedExit" class="marketing__notice" role="status">Aguarde a conclusão antes de sair do estúdio.</p>
        <p v-if="catalogError" class="marketing__notice" role="status">Não foi possível carregar os formatos. <button type="button" @click="loadCatalog">Tentar novamente</button></p>
        <p v-else-if="catalog && !catalog.available" class="marketing__notice" role="status">A geração de imagens está temporariamente indisponível.</p>
        <p v-if="error" class="marketing__notice marketing__notice--error" role="alert">{{ error }}</p>

        <div class="marketing__grid">
          <q-form class="marketing__panel marketing__form" @submit.prevent="quoteGeneration">
            <fieldset :disabled="locked">
              <legend>Formato</legend>
              <div class="marketing__formats">
                <label v-for="item in formats" :key="item.id">
                  <input v-model="formatId" type="radio" name="format" :value="item.id" />
                  <q-icon :name="item.icon" size="20px" />
                  <strong>{{ item.label }}</strong><small>{{ item.width }} × {{ item.height }}</small>
                </label>
              </div>
            </fieldset>
            <q-input v-model="prompt" dark outlined autogrow type="textarea" label="Descreva a imagem" placeholder="Ex. anúncio de lançamento com fundo claro, destaque para o produto e espaço para o título." :maxlength="catalog?.maxPromptCharacters || 3000" :disable="locked" />

            <section aria-labelledby="marketing-references">
              <div class="marketing__section-title"><h2 id="marketing-references">Referências</h2><span>{{ referenceCount }}/{{ maxReferences }}</span></div>
              <label class="marketing__drop" @dragover.prevent @drop.prevent="addReferences(Array.from($event.dataTransfer.files))">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" :disabled="locked || referenceCount >= maxReferences" @change="pickReferences" />
                <q-icon name="mdi-image-plus-outline" size="24px" /><span>Adicione, arraste ou cole imagens</span>
              </label>
              <ul v-if="references.length" class="marketing__references">
                <li v-for="item in references" :key="item.id"><img :src="item.url" alt="" /><span>{{ item.label }}</span><button type="button" :disabled="locked" :aria-label="`Remover ${item.label}`" @click="removeReference(item)"><q-icon name="mdi-close" /></button></li>
              </ul>
            </section>

            <q-btn v-if="!drawerOpen" flat no-caps icon="mdi-palette-outline" class="marketing__brand-link" label="Paleta e kit de marca" @click="showWorkspace" />
            <q-btn unelevated no-caps class="marketing__primary" type="submit" icon="mdi-auto-fix" label="Gerar imagem" :loading="busy" :disable="locked || projectLoading || catalogLoading || (signedIn && (!catalog?.available || !prompt.trim()))" />
          </q-form>

          <section class="marketing__panel marketing__preview" aria-labelledby="marketing-preview" :aria-busy="busy">
            <div class="marketing__section-title"><h2 id="marketing-preview">Prévia</h2><span>{{ (output?.format || format).width }} × {{ (output?.format || format).height }}</span></div>
            <div v-if="output" class="marketing__result"><img :src="output.url" :alt="`Imagem gerada em formato ${output.format.label}`" /></div>
            <div v-else class="marketing__canvas"><div :style="{ aspectRatio: format.width / format.height }"><q-spinner v-if="busy" size="34px" /><q-icon v-else name="mdi-image-outline" size="36px" /><span>{{ busy ? 'Preparando sua imagem' : format.label }}</span></div></div>
            <button v-if="output" type="button" class="marketing__secondary" @click="downloadAitoIAFile(output.blob, `aitoia-${output.format.id}.png`)"><q-icon name="mdi-download" /> Baixar PNG</button>
            <section v-if="images.length" aria-label="Imagens do projeto">
              <div class="marketing__section-title"><h2>Imagens do projeto</h2><span>{{ images.length }}</span></div>
              <ul class="marketing__references marketing__gallery">
                <li v-for="image in images" :key="image.id">
                  <button type="button" :aria-pressed="imageId === image.id" :title="image.label" :disabled="locked" @click="imageId = image.id"><img :src="image.url" :alt="image.label" /></button>
                  <button type="button" :disabled="locked" :aria-label="`Excluir imagem ${image.label}`" @click="removeImage(image)"><q-icon name="mdi-delete-outline" /></button>
                </li>
              </ul>
            </section>
          </section>
        </div>
      </q-page>
    </q-page-container>

    <q-dialog :model-value="!!quote" @update:model-value="value => { if (!value) quote = null }">
      <q-card v-if="quote" dark class="aito-ai-theme marketing__dialog">
        <h2>Confirmar geração</h2>
        <p>{{ format.label }} · {{ format.width }} × {{ format.height }}</p>
        <p>Limite de débito <strong>{{ usd(quote.maxBilledUsdCents) }}</strong> do saldo AitoTokens.</p>
        <p>A descrição, as referências e as cores escolhidas são enviadas à OpenAI para gerar a imagem.</p>
        <div class="marketing__actions"><q-btn v-close-popup flat no-caps label="Voltar" /><q-btn unelevated no-caps class="marketing__primary" label="Gerar imagem" @click="generate" /></div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="paletteDialog" aria-labelledby="marketing-palette-editor">
      <q-card dark class="aito-ai-theme marketing__dialog marketing__palette-dialog">
        <h2 id="marketing-palette-editor">{{ paletteIndex < 0 ? 'Adicionar cor' : 'Editar cor' }}</h2>
        <q-color v-model="paletteColor" dark flat bordered format-model="hex" class="full-width" />
        <div class="marketing__actions"><q-btn v-close-popup flat no-caps label="Cancelar" /><q-btn unelevated no-caps class="marketing__primary" label="Salvar cor" :disable="paletteLocked || !isPaletteColor(paletteColor)" @click="savePaletteColor" /></div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="componentDialog" :persistent="kitBusy">
      <q-card dark class="aito-ai-theme marketing__dialog">
        <h2>Novo componente de marca</h2>
        <q-form class="marketing__form" @submit.prevent="addComponent">
          <q-input v-model="componentLabel" dark outlined label="Nome" placeholder="Ex. logo principal" maxlength="60" :disable="kitBusy" />
          <q-input v-model="componentText" dark outlined type="textarea" autogrow label="Texto reutilizável" :maxlength="catalog?.maxComponentCharacters || 500" :disable="kitBusy" />
          <q-btn-toggle v-model="componentOrigin" no-caps unelevated spread color="grey-9" toggle-color="teal-8" :options="[{ label: 'Upload', value: 'upload' }, { label: 'Link da imagem', value: 'url' }]" />
          <q-file v-if="componentOrigin === 'upload'" v-model="componentFile" dark outlined clearable label="Imagem da marca" accept="image/jpeg,image/png,image/webp" :disable="kitBusy" />
          <q-input v-else v-model.trim="componentUrl" dark outlined clearable label="Endereço HTTPS da imagem" :disable="kitBusy" />
          <q-btn v-if="componentOrigin === 'url' ? componentUrl : componentFile" flat no-caps icon="mdi-image-search-outline" label="Conferir imagem" :loading="componentPreviewBusy" :disable="kitBusy" @click="previewComponent" />
          <img v-if="componentPreview" :src="componentPreview.url" class="marketing__component-preview" alt="Prévia do componente" />
          <p v-if="componentImageError" role="alert">{{ componentImageError }}</p>
          <p v-if="kitError" role="alert">{{ kitError }}</p>
          <div class="marketing__actions"><q-btn v-close-popup flat no-caps label="Voltar" :disable="kitBusy" /><q-btn unelevated no-caps class="marketing__primary" type="submit" label="Salvar no navegador" :loading="kitBusy" :disable="!componentLabel.trim() || (!(componentText.trim() || componentPreview)) || Boolean((componentOrigin === 'url' ? componentUrl : componentFile) && !componentPreview)" /></div>
        </q-form>
      </q-card>
    </q-dialog>
    <AuthDialog v-if="authOpen" v-model="authOpen" :initial-mode="authMode" :return-path="path" :show-project-login="false" @authenticated="wallet.syncSession()" />
    <AitoIAWallet v-if="walletOpen" v-model="walletOpen" :state="wallet" />
  </q-layout>
</template>

<style scoped>
.marketing { min-height: 100svh; color: var(--aito-ai-text); background: var(--aito-ai-glow), var(--aito-ai-bg); font-family: var(--aito-ai-font); }
.marketing__header { color: var(--aito-ai-text); background: var(--aito-ai-surface); border-bottom: 1px solid var(--aito-ai-line); }
.marketing__bar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 10px; padding: calc(8px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left)); }
.marketing__brand, .marketing__account, .marketing__balance, .marketing__navigation { display: flex; align-items: center; gap: 7px; min-width: 0; }
.marketing__navigation .q-btn { color: var(--aito-ai-accent); flex: none; }
.marketing__brand { width: fit-content; color: var(--aito-ai-text); text-decoration: none; font-size: 1.1rem; }
.marketing__brand img, .marketing__balance img { object-fit: contain; }
.marketing__account { justify-self: end; }
.marketing__balance, .marketing__secondary { display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-height: 44px; padding: 5px 10px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font: inherit; font-size: .84rem; cursor: pointer; }
.marketing__balance { color: var(--aito-ai-gold); border-color: var(--aito-ai-gold-line); background: var(--aito-ai-gold-soft); }
.marketing__balance span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marketing__balance .q-icon, .marketing__balance img { flex: none; }
.marketing__main { width: min(1400px, 100%); margin-inline: auto; padding: clamp(22px, 3.5vw, 42px) clamp(12px, 2.6vw, 36px) max(28px, env(safe-area-inset-bottom)); }
.marketing__intro { margin-bottom: 20px; }
.marketing__intro h1 { margin: 0 0 6px; font-size: clamp(1.9rem, 4.6vw, 3rem); font-weight: 780; line-height: 1.1; letter-spacing: -.045em; }
.marketing p, .marketing small, .marketing__section-title span { color: var(--aito-ai-muted); }
.marketing__grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; gap: 14px; }
.marketing__panel, .marketing__dialog { padding: clamp(14px, 2.3vw, 22px); border: 1px solid var(--aito-ai-line); border-radius: 14px; background: var(--aito-ai-surface); }
.marketing :deep(.marketing__drawer) { color: var(--aito-ai-text); background: var(--aito-ai-surface); border-color: var(--aito-ai-line); }
.marketing__drawer-content { display: flex; min-height: 100%; flex-direction: column; gap: 18px; padding: 18px 16px max(16px, env(safe-area-inset-bottom)); }
.marketing__drawer-title { margin: 0; padding-bottom: 12px; border-bottom: 1px solid var(--aito-ai-line); }
.marketing__drawer-section { display: grid; gap: 12px; min-width: 0; padding-bottom: 16px; border-bottom: 1px solid var(--aito-ai-line); }
.marketing__drawer-section .marketing__section-title, .marketing__drawer-section p { margin: 0; }
.marketing__drawer-section p, .marketing__section-title span { font-size: .79rem; }
.marketing__drawer-footer { margin-top: auto; padding-top: 5px; }
.marketing__drawer-footer .q-btn { min-height: 44px; background: var(--aito-ai-panel); }
.marketing__add-component { min-height: 44px; color: var(--aito-ai-accent); }
.marketing__brand-link { justify-self: start; min-height: 44px; color: var(--aito-ai-accent); }
.marketing__component-preview { width: 100%; max-height: 160px; object-fit: contain; border-radius: 8px; background: var(--aito-ai-bg); }
.marketing__form, .marketing__preview { display: grid; gap: 14px; }
.marketing fieldset { min-width: 0; padding: 0; margin: 0; border: 0; }
.marketing h2, .marketing legend, .marketing__dialog h2 { margin: 0; color: var(--aito-ai-text); font-size: 1rem; font-weight: 730; line-height: 1.4; }
.marketing__dialog { width: min(430px, 100%); }
.marketing__dialog h2 { margin-bottom: 12px; font-size: 1.25rem; }
.marketing legend { margin-bottom: 8px; }
.marketing__formats { display: grid; grid-template-columns: repeat(auto-fit, minmax(85px, 1fr)); gap: 6px; }
.marketing__formats label { position: relative; display: grid; place-items: center; gap: 4px; padding: 10px 4px; border: 1px solid var(--aito-ai-line); border-radius: 9px; background: var(--aito-ai-panel); text-align: center; cursor: pointer; }
.marketing__formats label:has(:checked) { color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); border-color: var(--aito-ai-accent-strong); }
.marketing__formats :is(strong, small) { font-size: .73rem; line-height: 1.2; }
.marketing__formats input, .marketing__drop input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.marketing__formats label:focus-within, .marketing__drop:focus-within { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
.marketing__section-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.marketing__drop { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 64px; padding: 8px; border: 1px dashed var(--aito-ai-line); border-radius: 9px; color: var(--aito-ai-accent); background: var(--aito-ai-panel); text-align: center; cursor: pointer; }
.marketing__drop:has(:disabled), .marketing button:disabled { opacity: .55; cursor: default; }
.marketing__references, .marketing__kit { display: flex; flex-wrap: wrap; gap: 7px; list-style: none; margin: 8px 0 0; padding: 0; }
.marketing__kit { display: grid; margin: 0; }
.marketing__references li, .marketing__kit li { display: flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px; border: 1px solid var(--aito-ai-line); border-radius: 7px; background: var(--aito-ai-panel); }
.marketing__references img, .marketing__kit img { width: 29px; height: 29px; border-radius: 4px; object-fit: cover; }
.marketing__references span, .marketing__kit span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; }
.marketing__references button, .marketing__kit button { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 4px; border: 0; border-radius: 4px; color: var(--aito-ai-text); background: transparent; cursor: pointer; }
.marketing__kit button { min-height: 44px; padding-inline: 7px; }
.marketing__kit button:first-child { min-width: 0; flex: 1; justify-content: start; gap: 8px; text-align: left; }
.marketing__kit button :is(img, .q-icon) { flex: none; }
.marketing__palette { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.marketing__palette li { display: flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--aito-ai-line); border-radius: 7px; background: var(--aito-ai-panel); }
.marketing__palette-color { flex: 1; min-width: 0; min-height: 44px; }
.marketing__palette-color :deep(.q-btn__content) { flex-wrap: nowrap; gap: 8px; }
.marketing__palette-color .q-icon { margin-inline-start: auto; }
.marketing__swatch { flex: none; width: 22px; height: 22px; border: 1px solid var(--aito-ai-line); border-radius: 50%; }
.marketing__palette-dialog { max-width: 350px; }
.marketing__palette-dialog .marketing__actions { margin-top: 12px; }
.marketing__gallery img { width: 49px; height: 49px; }
.marketing__gallery button[aria-pressed=true], .marketing__kit button[aria-pressed=true] { color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); }
.marketing__primary { min-height: 42px; color: var(--aito-ai-ink); background: var(--aito-ai-gradient); font-weight: 750; }
.marketing__canvas, .marketing__result { display: grid; place-items: center; min-height: 250px; padding: 12px; border-radius: 8px; background: var(--aito-ai-bg); }
.marketing__canvas > div { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; width: auto; height: min(300px, 53vw); max-width: 100%; padding: 12px; border: 1px dashed var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-muted); background: var(--aito-ai-panel); text-align: center; }
.marketing__result img { display: block; max-width: 100%; max-height: 525px; object-fit: contain; }
.marketing__notice { padding: 9px 12px; border: 1px solid var(--aito-ai-line); border-radius: 8px; background: var(--aito-ai-panel); }
.marketing__notice--error { background: var(--aito-ai-error-soft); border-color: var(--aito-ai-error-line); }
.marketing__notice button { color: var(--aito-ai-accent); background: none; border: 0; text-decoration: underline; cursor: pointer; }
.marketing__actions { display: flex; justify-content: end; gap: 8px; }
@media (max-width: 900px) {
  .marketing__drawer-content { padding-top: calc(16px + env(safe-area-inset-top)); }
}
@media (max-width: 760px) {
  .marketing__grid { grid-template-columns: minmax(0, 1fr); }
  .marketing__preview { grid-row: 1; }
  .marketing__canvas, .marketing__result { min-height: 0; }
  .marketing__canvas > div { height: clamp(126px, 47vw, 220px); }
  .marketing__formats { grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); }
}
@media (max-width: 670px) {
  .marketing__bar { grid-template-columns: minmax(0, 1fr) minmax(0, auto); gap: 5px; padding-inline: max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-right)); }
  .marketing__mode { grid-row: 2; grid-column: 1 / -1; justify-self: center; }
  .marketing__navigation, .marketing__brand { gap: 3px; }
  .marketing__brand img { width: 30px; height: 30px; }
  .marketing__balance { font-size: .74rem; }
}
</style>
