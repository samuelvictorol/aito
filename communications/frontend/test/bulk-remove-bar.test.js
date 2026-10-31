import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function fixture(target = 'contacts') {
  const props = { target, selected: [{ id: 'first' }, { id: 'second' }, { id: 'first' }] }
  const http = { delete: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({ results: [{ id: 'first', removed: true }, { id: 'second', removed: true }], failed: 0 }) }
  const emit = vi.fn(), notify = vi.fn(); let approve, dialog
  const source = readFileSync(new URL('../src/components/BulkRemoveBar.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
  const context = { defineProps: () => props, defineEmits: () => emit, ref: value => ({ value }), http, unwrap: value => value, errorMessage: error => error.message,
    useQuasar: () => ({ notify, dialog: options => { dialog = options; return { onOk: callback => { approve = callback } } } }) }
  vm.runInNewContext(source + '\nthis.confirmSelection = confirm', context)
  return { props, http, emit, notify, open: () => context.confirmSelection(), approve: () => approve(), dialog: () => dialog }
}

describe('confirmed bulk removal', () => {
  it('requires confirmation and keeps the original contact target and deduplicated selection', async () => {
    const state = fixture(); state.open()
    expect(state.http.post).not.toHaveBeenCalled(); expect(state.http.delete).not.toHaveBeenCalled()
    expect(state.dialog().persistent).toBe(true)
    state.props.target = 'contact-groups'; state.props.selected = []
    await state.approve()
    expect(state.http.post).toHaveBeenCalledWith('/bulk/remove', { target: 'contacts', ids: ['first', 'second'], confirmed: true }, { timeout: 120000 })
    expect(state.http.delete).not.toHaveBeenCalled()
  })
  it('removes only selected groups through the group endpoint and reports partial failures', async () => {
    const state = fixture('contact-groups'); state.http.delete.mockRejectedValueOnce(new Error('Denied'))
    state.open(); expect(state.http.delete).not.toHaveBeenCalled()
    expect(state.dialog().message).toContain('contatos')
    await state.approve()
    expect(state.http.delete.mock.calls).toEqual([['/contact-groups/first'], ['/contact-groups/second']])
    expect(state.http.post).not.toHaveBeenCalled()
    expect(state.emit).toHaveBeenCalledWith('removed', ['second'])
    expect(state.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
  })
  it('does not open a removal dialog without a selection', () => {
    const state = fixture(); state.props.selected = []; state.open()
    expect(state.dialog()).toBeUndefined(); expect(state.http.post).not.toHaveBeenCalled(); expect(state.http.delete).not.toHaveBeenCalled()
  })
})
