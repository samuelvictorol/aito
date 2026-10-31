import { describe, expect, it } from 'vitest'
import { connectionMemoryState } from '../src/modules/whatsapp-web/connection-resources.js'

describe('retomada manual da sessão por memória', () => {
  it('libera reconexão quando a pressão termina mesmo que a sessão continue pausada', () => {
    const pressure = { canStart: false, paused: true, usagePercent: 89 }
    expect(connectionMemoryState(pressure)).toEqual({ blocked: true, awaitingManualRecovery: false })
    const recovered = { ...pressure, canStart: true, usagePercent: 65 }
    expect(connectionMemoryState(recovered)).toEqual({ blocked: false, awaitingManualRecovery: true })
  })

  it('mantém conexão normal disponível e bloqueia orçamento insuficiente antes de pausar', () => {
    expect(connectionMemoryState({ canStart: true, paused: false }).blocked).toBe(false)
    expect(connectionMemoryState({ canStart: false, paused: false }).blocked).toBe(true)
    expect(connectionMemoryState(undefined)).toEqual({ blocked: false, awaitingManualRecovery: false })
  })
})
