export function licenseValidity(license = {}, now = Date.now()) {
  const expiry = license.expiresAt ? new Date(license.expiresAt).getTime() : null
  const permanent = license.permanent !== false && expiry === null
  const remainingSeconds = permanent ? null : Math.max(0, Math.floor(((Number.isFinite(expiry) ? expiry : 0) - now) / 1000))
  const revoked = license.enabled === false || Boolean(license.revokedAt) || license.status === 'revoked' || license.active === false && license.status !== 'expired' && license.expired !== true
  const status = revoked ? 'revoked' : !permanent && remainingSeconds === 0 || license.status === 'expired' ? 'expired' : 'active'
  return { status, label: { active: 'Ativa', expired: 'Expirada', revoked: 'Suspensa' }[status], permanent, effectiveActive: status === 'active', remainingSeconds, expiry }
}
export function validityCountdown(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(value / 86400)
  const hours = String(Math.floor(value % 86400 / 3600)).padStart(2, '0')
  const minutes = String(Math.floor(value % 3600 / 60)).padStart(2, '0')
  const rest = String(value % 60).padStart(2, '0')
  return `${days ? `${days}d ` : ''}${hours}:${minutes}:${rest}`
}
