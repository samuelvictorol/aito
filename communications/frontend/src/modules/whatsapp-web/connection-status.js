import { connectionMemoryState } from './connection-resources.js'

export function connectionStatus(status = {}, now = Date.now()) {
  const state = status.state || 'STARTING'
  const closing = status.browserClosing === true
  const connected = status.ready === true && !closing
  const saved = status.sessionStorage?.profilePresent === true
  const memory = connectionMemoryState(status.resources)
  const requiresPairing = state === 'AUTH_REQUIRED' || state === 'AUTH_FAILURE'
  const failed = requiresPairing || ['ERROR', 'RESOURCE_LIMIT', 'STOPPED', 'DISABLED'].includes(state)
  const awaitingQr = state === 'QR_REQUIRED'
  const pending = !connected && !failed && !awaitingQr && (status.initializing === true || status.authenticated === true || ['STARTING', 'RECONNECTING', 'AUTHENTICATED', 'CONNECTED', 'OPENING', 'PAIRING', 'READY'].includes(state))
  const deadline = Date.parse(status.readyDeadlineAt || status.initializationDeadlineAt || '')
  const timedOut = pending && Number.isFinite(deadline) && now >= deadline
  const booting = pending && !closing && !timedOut
  const showQr = !connected && !closing && awaitingQr && Boolean(status.qr)
  let label, badge, message

  if (closing) {
    label = badge = 'Encerrando conexão'
    message = 'Aguarde o encerramento da conexão atual antes de tentar novamente.'
  } else if (connected) {
    label = 'Conectado'; badge = 'Recebendo agora'
    message = 'WhatsApp pronto para receber mensagens.'
  } else if (memory.blocked) {
    label = 'Aguardando memória disponível'; badge = 'Aguardando recursos'
    message = 'A conexão aguarda memória disponível. A sessão salva permanece preservada.'
  } else if (timedOut) {
    label = 'A conexão está demorando'; badge = 'Reconexão disponível'
    message = 'Use “Tentar reconectar” para retomar a sessão sem desvincular o aparelho.'
  } else if (booting && (status.authenticated === true || ['AUTHENTICATED', 'CONNECTED', 'READY'].includes(state))) {
    label = badge = 'Finalizando conexão'
    message = 'Pareamento concluído. Aguarde a conexão ficar pronta.'
  } else if (booting && saved) {
    label = badge = 'Retomando sessão salva'
    message = 'A sessão salva foi encontrada. Aguarde a retomada da conexão.'
  } else if (booting) {
    label = badge = 'Iniciando conexão'
    message = 'Aguarde a preparação da conexão. O QR Code aparecerá se um pareamento for necessário.'
  } else if (awaitingQr) {
    label = 'Leia o QR Code'; badge = 'Aguardando leitura'
    message = 'No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.'
  } else if (requiresPairing) {
    label = 'Novo pareamento necessário'; badge = 'Conectar aparelho'
    message = 'Inicie a sessão para obter um QR Code e parear o aparelho.'
  } else if (memory.awaitingManualRecovery) {
    label = 'Memória disponível para reconectar'; badge = 'Reconexão disponível'
    message = 'Use “Tentar reconectar” para retomar a sessão preservada.'
  } else {
    label = state === 'ERROR' ? 'Falha na conexão' : 'WhatsApp desconectado'
    badge = 'Reconexão disponível'
    message = saved ? 'Use “Tentar reconectar” para retomar a sessão salva.' : 'Inicie uma sessão ou tente reconectar para continuar.'
  }

  return {
    connected, closing, booting, timedOut, showQr, label, badge, message,
    actionsBlocked: closing || booting || memory.blocked,
    showStart: !connected && !closing && !booting && !showQr && (requiresPairing || (!saved && status.browserPresent !== true && status.authenticated !== true && !timedOut)),
    diskVerified: status.sessionStorage?.diskMounted === true,
  }
}
