export const codexPluginVersion = '0.2.8'
export const codexPluginFilename = `PluginCodex-${codexPluginVersion}.zip`
export const codexPluginZipPath = '/downloads/aitoia-codex.zip'
export const codexPluginZipUrl = `${codexPluginZipPath}?v=${codexPluginVersion}`
export const codexOfficialUrl = 'https://openai.com/codex/'
export const codexProductPath = '/aitoia-codex'
export const codexSetupPromptLimit = 6000
export const codexDefaultSetupPrompt = `Ajude-me a configurar o AitoIA no Codex para Windows com o ZIP oficial já extraído. Leia LEIA-ME.txt e CONFIGURAR-COM-CODEX.txt na pasta do pacote.

1. Confira se o Codex gráfico e o Node.js 20 ou superior estão instalados. Se faltar algo, indique o download oficial. Se este chat não conseguir abrir janelas do Windows, mostre onde encontro o executável no Explorador.
2. Oriente-me a salvar o trabalho e escolher Sair ou Exit no ícone do Codex perto do relógio. Depois, abra Iniciar AitoIA.exe na pasta extraída. Preserve minhas configurações e deixe comigo a decisão se aparecer uma confirmação de troca de provedor.
3. Na primeira abertura, vou inserir a AitoKey apenas no campo protegido do Configurar AitoCodex Key. Se eu regenerar a chave no painel, quero usar o atalho com a chave verde ou pedir “@AitoIA Abra Configurar AitoCodex Key”.
4. Confirme se os dois atalhos foram criados e se uma conversa nova mostra AitoTokens como provedor. Peça minha autorização antes de um teste pago.`

export const codexOfferInterval = 10 * 60 * 1000
export const codexOfferStorageKey = 'aito.codex-offer.last-shown.v1'

const promotedRoutes = new Set([
  'landing-3d', 'aito-tokens-product', 'aito-codex-product', 'user-app', 'aito-ia',
  'aito-ia-video-studio', 'aito-ia-marketing-studio',
  'whatsapp-solutions-product', 'whatsapp-solutions-source', 'bio-links',
])

export function offersCodex(route, adminSession) {
  return !adminSession && !route.query?.auth &&
    (route.name !== 'user-app' || route.query?.tab !== 'profile') && promotedRoutes.has(route.name)
}

export function codexOfferDelay(now, lastShown) {
  const recordedAt = Number(lastShown)
  return recordedAt > 0 && recordedAt <= now ? Math.max(0, codexOfferInterval - (now - recordedAt)) : 0
}
