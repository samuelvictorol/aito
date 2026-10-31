export const ATTENDANCE_SCOPES = [
  { value: 'all', label: 'Todas' }, { value: 'mine', label: 'Meus atendimentos' },
  { value: 'waiting', label: 'Aguardando equipe' }, { value: 'triage', label: 'Em triagem' },
  { value: 'ai', label: 'IA ativa' },
  { value: 'attending', label: 'Em atendimento' }, { value: 'closed', label: 'Concluídas' },
]
export function attendanceLabel(chat) {
  if (chat?.bot?.attendanceStatus === 'closed') return 'Concluída'
  if (chat?.bot?.ownerId) return `Com ${chat.bot.ownerNick || 'colaborador'}`
  if (chat?.bot?.paused) return 'Aguardando equipe'
  return chat?.bot?.ai?.profileKey ? 'IA ativa' : 'Em triagem'
}
export function matchesScope(chat, scope, actorId) {
  const bot = chat?.bot || {}
  if (scope === 'mine') return bot.ownerId === actorId
  if (scope === 'waiting') return bot.paused && !bot.ownerId
  if (scope === 'attending') return Boolean(bot.ownerId)
  if (scope === 'closed') return bot.attendanceStatus === 'closed'
  if (scope === 'ai') return Boolean(bot.ai?.profileKey) && !bot.paused && bot.attendanceStatus !== 'closed' && !bot.ownerId
  if (scope === 'triage') return !bot.paused && bot.attendanceStatus !== 'closed' && !bot.ownerId && !bot.ai?.profileKey
  return true
}
export function attendanceGroups(chats = []) {
  const result = new Map([
    ['ai', { key: 'ai', label: 'IA ATIVA', icon: 'auto_awesome', items: [] }],
    ['triage', { key: 'triage', label: 'EM TRIAGEM', icon: 'account_tree', items: [] }],
    ['waiting', { key: 'waiting', label: 'AGUARDANDO EQUIPE', icon: 'hourglass_empty', items: [] }],
    ['closed', { key: 'closed', label: 'CONCLUÍDOS', icon: 'task_alt', items: [] }]
  ])
  for (const chat of chats) {
    const bot = chat.bot || {}
    const key = bot.attendanceStatus === 'closed' ? 'closed' : bot.ownerId ? 'owner:' + bot.ownerId : bot.paused ? 'waiting' : bot.ai?.profileKey ? 'ai' : 'triage'
    if (!result.has(key)) result.set(key, { key, label: 'ATENDIDO POR ' + (bot.ownerNick || 'COLABORADOR').toLocaleUpperCase('pt-BR'), icon: 'support_agent', items: [] })
    result.get(key).items.push(chat)
  }
  return [...result.values()].filter(group => group.items.length).sort((a, b) => (a.key === 'closed' ? 1 : 0) - (b.key === 'closed' ? 1 : 0))
}
