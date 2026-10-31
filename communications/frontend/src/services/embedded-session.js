import { isPrototypePath } from './prototype-mode.js'
import { setAccessToken, setStoredUser } from './tokens.js'

const PUBLIC = /^\/(?:prototype|colaboradores|whatsapp-web\/(?:atendente|catalogo)|invite|notificacao|meu-perfil)(?:\/|$)/
export function isEmbeddedPublicPath(path) {
  const value = String(path || '').replace(/^\/comunicacao\/app(?=\/|$)/, '')
  return isPrototypePath(path) || PUBLIC.test(value)
}
// Tokens never travel in an address or referrer. The parent is our own admin
// shell, and the backend has independently checked the administrator's MFA.
export async function initializeEmbeddedSession() {
  if (window.parent === window || isEmbeddedPublicPath(location.pathname)) return
  const requestId = crypto.randomUUID()
  await new Promise(resolve => {
    const finish = () => { clearTimeout(timer); window.removeEventListener('message', receive); resolve() }
    const receive = event => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'aito.communication.session' || event.data.requestId !== requestId) return
      const result = event.data.data
      if (result?.accessToken && (result.user || result.admin)?.role === 'admin') {
        setAccessToken(result.accessToken)
        setStoredUser(result.user || result.admin)
        sessionStorage.setItem('aito.communication.deliveryMode', result.mode === 'active' ? 'active' : 'staged')
      }
      finish()
    }
    const timer = setTimeout(finish, 15000)
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'aito.communication.ready', requestId }, location.origin)
  })
}
