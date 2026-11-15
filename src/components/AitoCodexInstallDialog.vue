<script setup>
import { onBeforeUnmount, ref, useId } from 'vue'
import { api } from 'boot/axios'
import { copyToClipboard } from 'quasar'
import { codexDefaultSetupPrompt, codexPluginFilename, codexPluginZipUrl, codexSetupPromptLimit } from 'src/services/aitoCodexInstall'
import AitoCodexInstallVideo from './AitoCodexInstallVideo.vue'

const props = defineProps({ autoDownload: { type: Boolean, default: true } })
const open = defineModel({ type: Boolean, default: false })
const titleId = useId()
const promptField = ref(null)
const feedback = ref('')
const downloadRequested = ref(false)
const setupPrompt = ref(codexDefaultSetupPrompt)
const promptLoading = ref(false)
let promptRequest

function startDownload() {
  const link = document.createElement('a')
  link.href = codexPluginZipUrl
  link.download = codexPluginFilename
  link.hidden = true
  document.body.append(link)
  try {
    link.click()
    downloadRequested.value = true
  } finally {
    link.remove()
  }
}

function cancelPromptLoad() {
  promptRequest?.abort()
  promptRequest = undefined
}
onBeforeUnmount(cancelPromptLoad)

async function prepareGuide() {
  feedback.value = ''
  downloadRequested.value = false
  if (props.autoDownload) startDownload()

  cancelPromptLoad()
  const request = new AbortController()
  promptRequest = request
  setupPrompt.value = codexDefaultSetupPrompt
  promptLoading.value = true
  try {
    const { data } = await api.get('/public/codex-install-prompt', { signal: request.signal, timeout: 8000 })
    const prompt = data?.data?.prompt
    if (promptRequest === request && typeof prompt === 'string' && prompt.trim() && prompt.length <= codexSetupPromptLimit) {
      setupPrompt.value = prompt
    }
  } catch {
    // The local installation guide remains available if public settings cannot be loaded.
  } finally {
    if (promptRequest === request) {
      promptLoading.value = false
      promptRequest = undefined
    }
  }
}

async function copyPrompt() {
  if (promptLoading.value) return
  try {
    await copyToClipboard(setupPrompt.value)
    feedback.value = 'Prompt copiado.'
  } catch {
    promptField.value?.focus()
    promptField.value?.select()
    feedback.value = 'Use o comando Copiar do seu dispositivo para copiar o texto selecionado.'
  }
}
</script>

<template>
  <q-dialog v-model="open" :aria-labelledby="titleId" @before-show="prepareGuide" @before-hide="cancelPromptLoad">
    <q-card dark class="codex-install">
      <header class="codex-install__header">
        <img src="/codex-app-icon.png" alt="" width="32" height="32" />
        <h2 :id="titleId">Configurar AitoIA no Codex</h2>
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar guia de instalação" />
      </header>
      <div class="codex-install__content">
        <div class="codex-install__visuals">
          <AitoCodexInstallVideo />
          <figure class="codex-install__exit">
            <div class="codex-install__tray" aria-hidden="true">
              <div class="codex-install__tray-menu">
                <span>New Chat</span>
                <strong><q-icon name="mdi-exit-to-app" /> Exit</strong>
              </div>
              <div class="codex-install__tray-bar">
                <q-icon name="mdi-chevron-up" size="15px" />
                <img src="/chatgpt-mark.svg" alt="" width="17" height="17" />
              </div>
            </div>
            <figcaption>Antes de abrir o atalho, salve o trabalho. Clique com o botão direito no ícone do Codex junto ao relógio e escolha <strong>Exit (Sair)</strong>.</figcaption>
          </figure>
        </div>
        <div class="codex-install__guide">
          <p>Extraia o ZIP e abra <strong>Iniciar AitoIA.exe</strong>. Se quiser ajuda do Codex com a configuração, copie o prompt abaixo.</p>
          <textarea ref="promptField" :value="promptLoading ? '' : setupPrompt" placeholder="Carregando prompt…"
            :aria-busy="promptLoading" readonly rows="7" aria-label="Prompt de instalação" />
        </div>
      </div>
      <div class="codex-install__actions">
        <q-btn unelevated no-caps icon="mdi-content-copy" label="Copiar prompt" class="codex-install__copy" :disable="promptLoading" @click="copyPrompt" />
        <a :href="codexPluginZipUrl" :download="codexPluginFilename"><q-icon name="mdi-download" /> {{ downloadRequested ? 'Baixar novamente' : 'Baixar ZIP do plugin' }}</a>
      </div>
      <span v-if="downloadRequested" class="codex-install__feedback" role="status">Download do ZIP solicitado. Se necessário, use Baixar novamente.</span>
      <span v-if="feedback" class="codex-install__feedback" role="status">{{ feedback }}</span>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.codex-install { display: grid; gap: 14px; width: min(880px, 100%); max-width: calc(100vw - 32px); padding: clamp(16px, 4vw, 25px); border: 1px solid #396460; border-radius: 16px; background: #0a1c1e; color: #f2fcf7; }
.codex-install__header { display: flex; gap: 10px; align-items: center; }
.codex-install__header img { flex-shrink: 0; }
.codex-install__header h2 { flex: 1; margin: 0; font-size: clamp(1.08rem, 4vw, 1.5rem); font-weight: 720; line-height: 1.25; }
.codex-install p { margin: 0; color: #bdd3cb; }
.codex-install__content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 18px; }
.codex-install__visuals { display: grid; gap: 12px; }
.codex-install__exit { display: grid; grid-template-columns: 6rem minmax(0, 1fr); align-items: center; gap: .6rem; margin: 0; padding: .55rem; border: 1px solid #345853; border-radius: .6rem; background: #0c2426; }
.codex-install__exit figcaption { color: #bdd3cb; font-size: .77rem; line-height: 1.38; }
.codex-install__exit figcaption strong { color: #a8f1de; }
.codex-install__tray { padding: .3rem; border: 1px solid #496060; border-radius: .4rem; background: #101719; }
.codex-install__tray-menu { display: grid; gap: .2rem; padding: .22rem; border: 1px solid #3b4949; border-radius: .25rem; background: #1b2425; font-size: .62rem; }
.codex-install__tray-menu span { padding-inline: .2rem; color: #d0d9d7; }
.codex-install__tray-menu strong { display: flex; align-items: center; gap: .19rem; padding: .15rem .22rem; border: 1px solid #61b5a3; border-radius: .2rem; background: #22534c; color: #e1fff6; }
.codex-install__tray-bar { display: flex; justify-content: flex-end; align-items: center; gap: .15rem; margin-top: .2rem; color: #c3d5d0; }
.codex-install__guide { display: grid; min-width: 0; gap: 10px; }
.codex-install textarea { width: 100%; min-height: 110px; max-height: 38vh; padding: 12px; resize: vertical; border: 1px solid #436560; border-radius: 8px; background: #081518; color: #f2fcf7; font: inherit; line-height: 1.55; }
.codex-install textarea:focus-visible { outline: 2px solid #8ce2ce; outline-offset: 2px; }
.codex-install__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.codex-install__actions a { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 6px; padding: 6px 12px; border: 1px solid #436560; border-radius: 7px; color: #adede0; font-weight: 650; text-decoration: none; }
.codex-install__copy { min-height: 40px; background: #9ee8d8; color: #082521; font-weight: 700; }
.codex-install__feedback { color: #b4eadf; font-size: .875rem; }
@media (max-width: 680px) {
  .codex-install__content { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .codex-install__content > :first-child { max-width: 380px; justify-self: center; }
}
@media (max-width: 420px) { .codex-install__actions > * { flex: 1 1 100%; } }
</style>
