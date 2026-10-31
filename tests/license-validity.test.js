import test from 'node:test'
import assert from 'node:assert/strict'
import { licenseValidity,validityCountdown } from '../src/services/license-validity.js'
test('license counter distinguishes expired server projection from manual revocation and handles legacy perpetual licenses',()=>{
 const now=Date.parse('2026-10-31T12:00:00Z')
 assert.equal(licenseValidity({active:true},now).permanent,true)
 assert.equal(licenseValidity({active:false,status:'expired',expiresAt:'2026-10-30T12:00:00Z'},now).status,'expired')
 assert.equal(licenseValidity({active:false,enabled:false,expiresAt:'2026-11-30T12:00:00Z'},now).status,'revoked')
 assert.equal(licenseValidity({active:true,expiresAt:'2026-10-31T12:00:02Z'},now).remainingSeconds,2)
 assert.equal(licenseValidity({active:true,expiresAt:'2026-10-31T12:00:00Z'},now).effectiveActive,false)
 assert.equal(licenseValidity({permanent:false},now).effectiveActive,false)
 assert.equal(validityCountdown(90061),'1d 01:01:01')
})
