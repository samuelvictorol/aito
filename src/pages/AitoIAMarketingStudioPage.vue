<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMeta } from 'quasar'
import { api } from 'boot/axios'
import AitoIAModeSwitch from 'components/AitoIAModeSwitch.vue'
import AitoStudioProjectPicker from 'components/AitoStudioProjectPicker.vue'
import { aitoTokens, usd, useAitoIA } from 'src/composables/useAitoIA'
import { useAitoStudioProjects } from 'src/composables/useAitoStudioProjects'
import { useAitoWorkGuard } from 'src/composables/useAitoWorkGuard'
import { downloadAitoIAFile } from 'src/services/aitoiaArchive'
import { accessMarketingKit, exportMarketingImage, marketingFormats, prepareMarketingReference, readMarketingImage } from 'src/services/aitoiaMarketingLocal'
import 'src/css/aitoia-theme.css'

const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const AitoIAWallet = defineAsyncComponent(() => import('components/AitoIAWallet.vue'))
const path = '/aitoia-marketing-studio'
const wallet = useAitoIA({ chatHistory: false })
const { accountId, signedIn, status, walletId } = wallet
const catalog = ref(null)
const catalogLoading = ref(false)
const catalogError = ref(false)
const formatId = ref('feed')
const prompt = ref('')
const references = shallowRef([])
const kit = shallowRef([])
const selectedKit = ref([])
const kitLoading = ref(false)
const componentDialog = ref(false)
const componentLabel = ref('')
const componentText = ref('')
const componentFile = shallowRef(null)
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
const authOpen = ref(false)
const authMode = ref('login')
const walletOpen = ref(false)
let operation
let kitEpoch = 0

const formats = computed(() => {
  if (!catalog.value?.formats?.length) return marketingFormats
  return catalog.value.formats.map(item => ({ ...item, icon: marketingFormats.find(entry => entry.id === item.id)?.icon || 'mdi-image-outline' }))
})
const format = computed(() => formats.value.find(item => item.id === formatId.value) || formats.value[0])
const maxReferences = computed(() => catalog.value?.maxReferences || 6)
const maxReferenceBytes = computed(() => catalog.value?.maxReferenceBytes || 786432)
const maxComponents = computed(() => catalog.value?.maxComponents || 6)
const activeKit = computed(() => kit.value.filter(item => selectedKit.value.includes(item.id)))
const referenceCount = computed(() => references.value.length + activeKit.value.filter(item => item.blob).length)
const locked = computed(() => busy.value || uploading.value || !!quote.value)
const output = computed(() => images.value.find(image => image.id === imageId.value) || null)

useMeta({ title: 'AitoIA | Estúdio de Marketing' })
useAitoWorkGuard(busy, () => { blockedExit.value = true })
watch(busy, active => { if (!active) blockedExit.value = false })

function localAsset(item) { return { ...item, url: item.blob ? URL.createObjectURL(item.blob) : '' } }
function disposeAsset(item) { if (item?.url) URL.revokeObjectURL(item.url) }
function clearProjectMedia() { [...images.value, ...references.value].forEach(disposeAsset) }
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
  watch: [projectTitle, formatId, prompt, references, selectedKit, images, imageId],
  snapshot: () => ({ title: projectTitle.value, formatId: formatId.value, prompt: prompt.value,
    references: references.value.map(stripUrl), selectedKit: [...selectedKit.value], images: images.value.map(stripUrl), imageId: imageId.value }),
  restore(saved) {
    clearProjectMedia()
    projectTitle.value = saved?.title || ''
    formatId.value = saved?.formatId || 'feed'
    prompt.value = saved?.prompt || ''
    references.value = (saved?.references || []).map(localAsset)
    selectedKit.value = saved?.selectedKit || []
    images.value = (saved?.images || []).map(localAsset)
    imageId.value = saved?.imageId || images.value[0]?.id || ''
    error.value = ''
  },
})
const { projects, activeId: projectId, loading: projectLoading, storageError, createProject, openProject, deleteProject, saveProject } = project

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
  componentDialog.value = true
}

async function addComponent() {
  if (!componentLabel.value.trim() || (!componentText.value.trim() && !componentFile.value) || kit.value.length >= maxComponents.value) return
  kitBusy.value = true
  kitError.value = ''
  const id = accountId.value
  try {
    const blob = componentFile.value ? await prepareMarketingReference(componentFile.value, maxReferenceBytes.value) : null
    if (id !== accountId.value) return
    const item = localAsset({ id: crypto.randomUUID(), label: componentLabel.value.trim(), text: componentText.value.trim(), blob })
    if (await saveKit([...kit.value, item])) componentDialog.value = false
    else disposeAsset(item)
  } catch (cause) { kitError.value = cause.message || 'Não foi possível preparar o componente.' }
  finally { kitBusy.value = false }
}

async function removeComponent(item) {
  if (!await saveKit(kit.value.filter(entry => entry.id !== item.id))) return
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
      prompt: prompt.value.trim(), references: encoded, components,
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
  <div class="aito-ai-theme marketing">
    <header class="marketing__bar">
      <router-link to="/" class="marketing__brand" aria-label="Site AitoSoftwares"><img src="/ia.gif" width="37" height="37" alt="" /><strong>AitoIA</strong></router-link>
      <div class="marketing__mode"><AitoIAModeSwitch mode="marketing" :busy="busy" /></div>
      <div class="marketing__account">
        <button v-if="signedIn" type="button" class="marketing__balance" :disabled="locked" @click="showWallet"><img src="/aitotokens.svg" width="24" height="24" alt="" />{{ status ? `${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }} <q-icon name="mdi-plus" /></button>
        <button v-else type="button" class="marketing__secondary" @click="showAuth()">Entrar</button>
      </div>
    </header>

    <main class="marketing__main" @paste="pasteReferences">
      <div class="marketing__intro">
        <h1>Estúdio de Marketing</h1>
        <p>Crie imagens no formato de cada canal e reutilize os componentes da sua marca.</p>
      </div>
      <div class="marketing__panel marketing__projects">
        <AitoStudioProjectPicker :projects="projects" :active-id="projectId" :loading="projectLoading" :storage-error="storageError"
          :disabled="!accountId || locked" @create="createProject" @open="openProject" @remove="deleteProject" />
        <q-input v-if="projectId" v-model="projectTitle" dark outlined dense label="Nome do projeto" maxlength="65" :disable="locked || projectLoading" />
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

          <section aria-labelledby="marketing-kit">
            <div class="marketing__section-title"><h2 id="marketing-kit">Kit de marca</h2><button type="button" class="marketing__secondary" :disabled="locked || kitBusy || kitLoading || (signedIn && !accountId) || kit.length >= maxComponents" @click="signedIn ? openComponent() : showAuth()"><q-icon name="mdi-plus" /> Componente</button></div>
            <p v-if="kitError" role="status">{{ kitError }}</p>
            <p v-else-if="kitLoading" role="status">Carregando componentes deste navegador…</p>
            <p v-else-if="!kit.length">Guarde logos, endereços e textos neste navegador para usar em outras peças.</p>
            <ul v-if="kit.length" class="marketing__kit">
              <li v-for="item in kit" :key="item.id">
                <button type="button" :aria-pressed="selectedKit.includes(item.id)" :disabled="locked || kitBusy" @click="toggleKit(item)"><img v-if="item.url" :src="item.url" alt="" /><q-icon v-else name="mdi-text-box-outline" /><span>{{ item.label }}</span><q-icon v-if="selectedKit.includes(item.id)" name="mdi-check-circle" /></button>
                <button type="button" :disabled="locked || kitBusy" :aria-label="`Excluir componente ${item.label}`" @click="removeComponent(item)"><q-icon name="mdi-close" /></button>
              </li>
            </ul>
          </section>
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
    </main>

    <q-dialog :model-value="!!quote" @update:model-value="value => { if (!value) quote = null }">
      <q-card v-if="quote" dark class="aito-ai-theme marketing__dialog">
        <h2>Confirmar geração</h2>
        <p>{{ format.label }} · {{ format.width }} × {{ format.height }}</p>
        <p>Limite de débito <strong>{{ usd(quote.maxBilledUsdCents) }}</strong> do saldo AitoTokens.</p>
        <p>A descrição e as referências selecionadas são enviadas à OpenAI para gerar a imagem.</p>
        <div class="marketing__actions"><q-btn v-close-popup flat no-caps label="Voltar" /><q-btn unelevated no-caps class="marketing__primary" label="Gerar imagem" @click="generate" /></div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="componentDialog" :persistent="kitBusy">
      <q-card dark class="aito-ai-theme marketing__dialog">
        <h2>Novo componente de marca</h2>
        <q-form class="marketing__form" @submit.prevent="addComponent">
          <q-input v-model="componentLabel" dark outlined label="Nome" placeholder="Ex. logo principal" maxlength="60" :disable="kitBusy" />
          <q-input v-model="componentText" dark outlined type="textarea" autogrow label="Texto reutilizável" :maxlength="catalog?.maxComponentCharacters || 500" :disable="kitBusy" />
          <q-file v-model="componentFile" dark outlined clearable label="Imagem da marca" accept="image/jpeg,image/png,image/webp" :disable="kitBusy" />
          <p v-if="kitError" role="alert">{{ kitError }}</p>
          <div class="marketing__actions"><q-btn v-close-popup flat no-caps label="Voltar" :disable="kitBusy" /><q-btn unelevated no-caps class="marketing__primary" type="submit" label="Salvar no navegador" :loading="kitBusy" :disable="!componentLabel.trim() || (!componentText.trim() && !componentFile)" /></div>
        </q-form>
      </q-card>
    </q-dialog>
    <AuthDialog v-if="authOpen" v-model="authOpen" :initial-mode="authMode" :return-path="path" :show-project-login="false" @authenticated="wallet.syncSession()" />
    <AitoIAWallet v-if="walletOpen" v-model="walletOpen" :state="wallet" />
  </div>
</template>

<style scoped>
.marketing { min-height: 100svh; color: var(--aito-ai-text); background: var(--aito-ai-glow), var(--aito-ai-bg); font-family: var(--aito-ai-font); }
.marketing__bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 9px 22px; background: var(--aito-ai-surface); border-bottom: 1px solid var(--aito-ai-line); }
.marketing__brand, .marketing__account, .marketing__balance { display: flex; align-items: center; gap: 7px; }
.marketing__brand { width: fit-content; color: var(--aito-ai-text); text-decoration: none; font-size: 1.1rem; }
.marketing__brand img, .marketing__balance img { object-fit: contain; }
.marketing__account { justify-self: end; }
.marketing__balance, .marketing__secondary { display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-height: 38px; padding: 5px 10px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); font: inherit; font-size: .84rem; cursor: pointer; }
.marketing__balance { color: var(--aito-ai-gold); border-color: var(--aito-ai-gold-line); background: var(--aito-ai-gold-soft); }
.marketing__main { width: min(1150px, calc(100% - 32px)); margin-inline: auto; padding: clamp(25px, 4vw, 48px) 0; }
.marketing__intro { margin-bottom: 20px; }
.marketing__intro h1 { margin: 0 0 6px; font-size: clamp(1.9rem, 4.6vw, 3rem); font-weight: 780; line-height: 1.1; letter-spacing: -.045em; }
.marketing p, .marketing small, .marketing__section-title span { color: var(--aito-ai-muted); }
.marketing__grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; gap: 14px; }
.marketing__panel, .marketing__dialog { padding: clamp(14px, 2.3vw, 22px); border: 1px solid var(--aito-ai-line); border-radius: 14px; background: var(--aito-ai-surface); }
.marketing__projects { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
.marketing__projects .q-field { width: min(260px, 100%); }
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
.marketing__references li, .marketing__kit li { display: flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px; border: 1px solid var(--aito-ai-line); border-radius: 7px; background: var(--aito-ai-panel); }
.marketing__references img, .marketing__kit img { width: 29px; height: 29px; border-radius: 4px; object-fit: cover; }
.marketing__references span, .marketing__kit span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; }
.marketing__references button, .marketing__kit button { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 4px; border: 0; border-radius: 4px; color: var(--aito-ai-text); background: transparent; cursor: pointer; }
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
@media (max-width: 760px) { .marketing__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 670px) { .marketing__bar { grid-template-columns: 1fr auto; padding-inline: 10px; } .marketing__mode { grid-row: 2; grid-column: 1 / -1; justify-self: center; } }
</style>
