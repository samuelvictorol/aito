import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compactPaginationItems, parsePaginationPage } from '../src/services/compact-pagination.js'

describe('paginação compacta', () => {
  it('limita o console com 151 páginas às duas primeiras e duas últimas', () => {
    expect(compactPaginationItems(151)).toEqual([1, 2, 'ellipsis', 150, 151])
    expect(compactPaginationItems(10000)).toEqual([1, 2, 'ellipsis', 9999, 10000])
  })

  it.each([
    [0, [1]],
    [1, [1]],
    [2, [1, 2]],
    [3, [1, 2, 3]],
    [4, [1, 2, 3, 4]],
    [5, [1, 2, 'ellipsis', 4, 5]],
  ])('evita páginas repetidas quando há %i páginas', (count, expected) => {
    expect(compactPaginationItems(count)).toEqual(expected)
  })

  it('permite navegar diretamente para páginas intermediárias e limites', () => {
    expect(parsePaginationPage('1', 151)).toBe(1)
    expect(parsePaginationPage('75', 151)).toBe(75)
    expect(parsePaginationPage('151', 151)).toBe(151)
    expect(parsePaginationPage('0075', 151)).toBe(75)
  })

  it.each(['', '0', '-1', '152', '75.5', '1e2', '12abc', '+2', ' 3 ', '9007199254740993', null])(
    'impede navegação com entrada inválida %s',
    (input) => expect(parsePaginationPage(input, 151)).toBeNull(),
  )

  it('revalida o destino quando filtros reduzem a quantidade de páginas', () => {
    expect(parsePaginationPage('75', 151)).toBe(75)
    expect(parsePaginationPage('75', 3)).toBeNull()
  })

  it('não passa a página como sinalizador para reiniciar as listas', () => {
    const integrations = readFileSync(new URL('../src/pages/IntegrationsPage.vue', import.meta.url), 'utf8')
    const schedules = readFileSync(new URL('../src/pages/NotificationSchedulesPage.vue', import.meta.url), 'utf8')
    expect(integrations).toContain('@update:model-value="loadApps()"')
    expect(integrations).toContain('@update:model-value="loadActivity()"')
    expect(schedules).toContain('@update:model-value="loadSchedules()"')
  })
})
