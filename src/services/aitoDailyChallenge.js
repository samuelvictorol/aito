const timeZone = 'America/Sao_Paulo'
const seenPrefix = 'aito:daily-challenge:seen:'

export function challengeCalendarDay(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(timestamp))
  const value = type => parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function dailyChallengeSession(storage) {
  try {
    if (storage.getItem('aito_admin_token')) return null
    const token = storage.getItem('aito_user_token')
    const user = JSON.parse(storage.getItem('aito_user') || '{}')
    const accountId = user.id || user._id
    return token && typeof accountId === 'string' && /^[a-f\d]{24}$/i.test(accountId) &&
      ['user', 'customer'].includes(user.role) ? { accountId, token } : null
  } catch { return null }
}

function challengeOf(value) {
  if (!value || typeof value.eligible !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(value.today || '')) return null
  const streak = Number.isSafeInteger(value.streak) ? Math.max(0, Math.min(3, value.streak)) : 0
  return { ...value, streak, requiredDays: 3, rewardAitoTokens: 25000, welcomeAitoTokens: 25000, timeZone }
}

// The server alone records visits and awards credits. Local state only prevents
// repeated presentation; neither stored dates nor a device clock claim a prize.
export function createDailyChallengeTracker({ getSession, request, storage, visible, onChange, onReward = () => {}, now = Date.now }) {
  let account = null
  let lastVisitDay = null
  let pending = null
  let latestChallenge = null
  let disposed = false
  const seen = new Map()

  function readSeen(accountId) {
    if (seen.has(accountId)) return seen.get(accountId)
    try { return JSON.parse(storage?.getItem(seenPrefix + accountId) || 'null') }
    catch { return null }
  }

  function remember(accountId, challenge) {
    const value = { day: challenge.today, completed: challenge.completed === true }
    seen.set(accountId, value)
    try { storage?.setItem(seenPrefix + accountId, JSON.stringify(value)) }
    catch { /* A blocked store must not prevent use or repeat the modal in this tab. */ }
  }

  function matches(session) {
    const current = getSession()
    return !disposed && current?.accountId === session.accountId && current?.token === session.token
  }

  function present(challenge, session) {
    const previous = readSeen(session.accountId)
    if (!visible() || !challenge.eligible || previous?.completed || previous?.day === challenge.today) return
    remember(session.accountId, challenge)
    onChange({ challenge, open: true })
  }

  async function enter() {
    if (disposed || !visible()) return
    const session = getSession()
    if (!session) {
      account = null
      lastVisitDay = null
      latestChallenge = null
      onChange({ challenge: null, open: false })
      return
    }
    if (account !== session.accountId) {
      account = session.accountId
      lastVisitDay = null
      latestChallenge = null
      onChange({ challenge: null, open: false })
    }
    const day = challengeCalendarDay(now())
    if (lastVisitDay === day) {
      if (latestChallenge) present(latestChallenge, session)
      return
    }
    if (pending) return pending
    const attempt = Promise.resolve().then(() => request(session.token)).then(response => {
      if (!matches(session)) return
      const challenge = challengeOf(response)
      if (!challenge) return
      lastVisitDay = day
      latestChallenge = challenge
      onChange({ challenge })
      present(challenge, session)
      if (challenge.rewardGranted === true) onReward(challenge)
    }).catch(() => {
      // Optional promotion UI must never block authentication or creative work.
      // A later foreground entry can retry a transient API error.
    }).finally(() => {
      if (pending === attempt) pending = null
      // A different account may have entered while the previous request ran.
      const current = getSession()
      if (!disposed && visible() && current && (current.accountId !== session.accountId || current.token !== session.token)) void enter()
    })
    pending = attempt
    return attempt
  }

  return {
    enter,
    dismiss: () => onChange({ open: false }),
    storageChanged(event) {
      const session = getSession()
      if (session && event.key === seenPrefix + session.accountId) {
        seen.delete(session.accountId)
        onChange({ open: false })
      }
    },
    dispose() { disposed = true },
  }
}
