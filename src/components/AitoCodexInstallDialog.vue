<script setup>
import { ref, useId } from 'vue'
import { copyToClipboard } from 'quasar'
import { codexPluginFilename, codexPluginZipUrl } from 'src/services/aitoCodexInstall'

const open = defineModel({ type: Boolean, default: false })
const titleId = useId()
const promptField = ref(null)
const feedback = ref('')

const setupPrompt = String.raw`Configure o plugin AitoIA da AitoSoftwares no aplicativo gráfico do Codex no Windows. Quero continuar com minha conta gratuita do Codex e usar o saldo da minha carteira AitoTokens. Estou com o ZIP oficial extraído em uma pasta que vou manter. Trabalhe a partir dessa pasta e siga CONFIGURAR-COM-CODEX.txt e LEIA-ME.txt.

1. Confira se o aplicativo gráfico do Codex está instalado e se a versão é compatível com o pacote. Verifique o Node.js do Windows se o instalador precisar dele. Se alguma dependência estiver faltando ou desatualizada, explique o que precisa ser instalado e me peça confirmação antes de baixar ou instalar pelo canal oficial.
2. No PowerShell, execute & '.\Iniciar AitoIA.bat' -SetupOnly -CreateShortcut na pasta extraída. Isso prepara o atalho “AitoIA - Codex” com a logo incluída. Preserve minhas configurações existentes. Se já houver outro provedor e for necessário substituí-lo, pare e me peça para escolher.
3. Abra o atalho para iniciar o aplicativo gráfico com AitoTokens. Na primeira configuração, deixe que eu informe a AitoKey no diálogo seguro do iniciador. O Gerenciador de Credenciais do Windows deve reutilizá-la nas próximas aberturas. Nunca peça a chave no chat nem a grave em texto simples, argumentos de comandos ou logs.
4. Mostre onde aplicar a paleta opcional em Configurações → Aparência. Se houver personalização de cores, use base escura, destaque #5EEAD4, fundo #092523 e texto #DCF9F4. Use gradiente apenas se houver uma opção oficial.
5. Confira se o app gráfico abriu com o provedor AitoTokens. Avise antes de fazer qualquer teste que consuma meu saldo e me diga o que ficou configurado.`

async function copyPrompt() {
  try {
    await copyToClipboard(setupPrompt)
    feedback.value = 'Prompt copiado.'
  } catch {
    promptField.value?.focus()
    promptField.value?.select()
    feedback.value = 'Use o comando Copiar do seu dispositivo para copiar o texto selecionado.'
  }
}
</script>

<template>
  <q-dialog v-model="open" :aria-labelledby="titleId" @before-show="feedback = ''">
    <q-card dark class="codex-install">
      <header class="codex-install__header">
        <img src="/codex-app-icon.png" alt="" width="32" height="32" />
        <h2 :id="titleId">Configurar AitoIA no Codex</h2>
        <q-btn v-close-popup flat round dense icon="mdi-close" aria-label="Fechar guia de instalação" />
      </header>
      <p>Baixe e extraia o ZIP em uma pasta que você possa manter. Abra essa pasta no Codex para Windows e cole o prompt na conversa.</p>
      <textarea ref="promptField" :value="setupPrompt" readonly rows="9" aria-label="Prompt de instalação" />
      <div class="codex-install__actions">
        <q-btn unelevated no-caps icon="mdi-content-copy" label="Copiar prompt" class="codex-install__copy" @click="copyPrompt" />
        <a :href="codexPluginZipUrl" :download="codexPluginFilename"><q-icon name="mdi-download" /> Baixar ZIP do plugin</a>
      </div>
      <span v-if="feedback" class="codex-install__feedback" role="status">{{ feedback }}</span>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.codex-install { display: grid; gap: 14px; width: min(620px, 100%); padding: clamp(16px, 4vw, 25px); border: 1px solid #396460; border-radius: 16px; background: #0a1c1e; color: #f2fcf7; }
.codex-install__header { display: flex; gap: 10px; align-items: center; }
.codex-install__header img { flex-shrink: 0; }
.codex-install__header h2 { flex: 1; margin: 0; font-size: clamp(1.08rem, 4vw, 1.5rem); font-weight: 720; line-height: 1.25; }
.codex-install p { margin: 0; color: #bdd3cb; }
.codex-install textarea { width: 100%; min-height: 110px; max-height: 38vh; padding: 12px; resize: vertical; border: 1px solid #436560; border-radius: 8px; background: #081518; color: #f2fcf7; font: inherit; line-height: 1.55; }
.codex-install textarea:focus-visible { outline: 2px solid #8ce2ce; outline-offset: 2px; }
.codex-install__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.codex-install__actions a { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 6px; padding: 6px 12px; border: 1px solid #436560; border-radius: 7px; color: #adede0; font-weight: 650; text-decoration: none; }
.codex-install__copy { min-height: 40px; background: #9ee8d8; color: #082521; font-weight: 700; }
.codex-install__feedback { color: #b4eadf; font-size: .875rem; }
@media (max-width: 420px) { .codex-install__actions > * { flex: 1 1 100%; } }
</style>
