import { describe, it, expect } from 'vitest'
import { attendanceLabel, matchesScope } from '../src/modules/whatsapp-web/attendance-state.js'
describe('caixas de atendimento', () => {
  it('separa triagem, fila, responsável e concluídos sem misturar atribuições', () => {
    const waiting = { bot: { paused: true } }, assigned = { bot: { paused: true, ownerId: 'samuel', ownerNick: 'Samuel' } }, closed = { bot: { paused: false, attendanceStatus: 'closed' } }
    expect(matchesScope(waiting, 'waiting')).toBe(true)
    expect(matchesScope(assigned, 'waiting')).toBe(false)
    expect(matchesScope(assigned, 'mine', 'samuel')).toBe(true)
    expect(matchesScope(assigned, 'mine', 'outro')).toBe(false)
    expect(matchesScope(closed, 'triage')).toBe(false)
    expect(matchesScope(closed, 'closed')).toBe(true)
    expect(attendanceLabel(assigned)).toBe('Com Samuel')
    expect(attendanceLabel(waiting)).toBe('Aguardando equipe')
  })
})
