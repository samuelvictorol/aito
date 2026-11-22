import assert from 'node:assert/strict'
import test from 'node:test'
import { GUEST_RECHARGE_DELAY, shouldOfferGuestRecharge } from '../src/services/aitoGuestRecharge.js'

test('the guest recharge is offered after three seconds only on the public AI workspaces', () => {
  assert.equal(GUEST_RECHARGE_DELAY, 3000)
  for (const route of ['aito-ia', 'aito-ia-video-studio', 'aito-ia-marketing-studio']) {
    assert.equal(shouldOfferGuestRecharge(route), true)
    assert.equal(shouldOfferGuestRecharge(route, { userToken: 'user-session' }), false)
    assert.equal(shouldOfferGuestRecharge(route, { adminToken: 'admin-session' }), false)
  }
  for (const route of ['aito-help', 'user-app', 'video-studio-tester', 'admin-dashboard', 'bio-links', '', undefined]) {
    assert.equal(shouldOfferGuestRecharge(route), false)
  }
})
