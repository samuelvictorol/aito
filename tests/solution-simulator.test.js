import test from 'node:test'
import assert from 'node:assert/strict'
import { getSimulatorFlow, simulatorFlows, simulatorReply } from '../src/data/solutionSimulator.js'

test('all three demos start with a bot prompt and all offered paths lead to existing nodes', () => {
  assert.equal(simulatorFlows.length, 3)
  for (const flow of simulatorFlows) {
    assert.ok(flow.nodes.start.text)
    assert.ok(flow.nodes.start.options.length)
    for (const [id, node] of Object.entries(flow.nodes)) {
      assert.ok(node.end || node.options?.length, `${flow.id}:${id} must let the visitor continue`)
      for (const [label, target] of node.options || []) {
        assert.ok(flow.nodes[target])
        assert.equal(simulatorReply(flow.id, id, label).nodeId, target)
      }
    }
  }
})

test('dentist, checkout approval, refusal and catalog can be completed using numbered replies', () => {
  const walk = (flow, choices) => choices.reduce((result, choice) => simulatorReply(flow, result.nodeId, choice), { nodeId: 'start' })
  assert.equal(walk('dentist', ['1', '2']).node.end, true)
  assert.equal(walk('payment', ['2', '1', '1']).nodeId, 'feedback')
  assert.equal(walk('payment', ['2', '2', '1']).nodeId, 'checkout')
  assert.equal(walk('catalog', ['1', '1', '1']).node.end, true)
})

test('menu resets any scenario; invalid replies preserve its current options', () => {
  assert.equal(getSimulatorFlow('unknown').id, 'dentist')
  const invalid = simulatorReply('catalog', 'pots', '<script>example</script>')
  assert.equal(invalid.nodeId, 'pots')
  assert.deepEqual(invalid.node.options, getSimulatorFlow('catalog').nodes.pots.options)
  assert.match(invalid.node.text, /Não informe dados pessoais/)
  assert.equal(simulatorReply('payment', 'paid', 'menu').nodeId, 'start')
})
