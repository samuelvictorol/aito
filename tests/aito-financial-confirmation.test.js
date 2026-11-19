import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from '@babel/parser'
import { adminConfirmationHeaders } from '../src/services/adminConfirmation.js'

function operations(file, names) {
  const source = fs.readFileSync(new URL(`../src/components/${file}.vue`, import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
  const ast = parse(source, { sourceType: 'module' })
  return ast.program.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n')
}

function panel(api) {
  return new Function('api', 'adminConfirmationHeaders', `${operations('AdminAitoTokensPanel', ['saveFinancial', 'applyConfirmation'])}
    let pendingFinancial = null, pendingGrant = null;
    const financialConfirming = {value:false}, financialSaving={value:false}, passwordOpen={value:false};
    const notices=[];
    const $q={notify: value=>notices.push(value)};
    const notify=(error,message)=>notices.push({error,message});
    const applyGrant=async()=>{};
    return {saveFinancial,applyConfirmation,notices,passwordOpen,
      cancel(){passwordOpen.value=false;pendingFinancial=null;},
      get pending(){return pendingFinancial;}};
  `)(api, confirmation => ({ headers: { Authorization: 'Bearer original-session', 'X-Aito-Admin-Confirmation': confirmation.confirmationToken } }))
}

test('financial changes wait for password confirmation and apply the reviewed snapshot exactly once', async () => {
  const writes = []
  const component = panel({
    async put(path, body, config) {
      writes.push({ path, body: structuredClone(body), config })
      return { data: { data: { multiplier: 1.75 } } }
    },
    async post() { throw Error('Financial actions must not request a login code') },
  })
  let saved
  const changes = { multiplier: 1.75 }
  await component.saveFinancial('/aito-tokens/admin/billing', changes, data => { saved = data }, 'Salvo')
  assert.equal(component.passwordOpen.value, true)
  assert.equal(writes.length, 0)
  changes.multiplier = 99
  await component.applyConfirmation({ confirmationToken: 'password-proof' })
  await component.applyConfirmation({ confirmationToken: 'password-proof' })
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].body, { multiplier: 1.75 })
  assert.deepEqual(writes[0].config.headers, { Authorization: 'Bearer original-session', 'X-Aito-Admin-Confirmation': 'password-proof' })
  assert.deepEqual(saved, { multiplier: 1.75 })
})

test('canceling or failing a financial confirmation never retries a mutation automatically', async () => {
  let writes = 0
  const component = panel({ async put() { writes++; throw Error('network unavailable') } })
  await component.saveFinancial('/exchange-rate', { rate: 5 }, () => {}, 'Salvo')
  await assert.rejects(component.saveFinancial('/billing', { multiplier: 2 }, () => {}, 'Salvo'))
  component.cancel()
  await component.applyConfirmation({ confirmationToken: 'password-proof' })
  assert.equal(writes, 0)
  await component.saveFinancial('/billing', { multiplier: 2 }, () => {}, 'Salvo')
  await component.applyConfirmation({ confirmationToken: 'password-proof' })
  await component.applyConfirmation({ confirmationToken: 'password-proof' })
  assert.equal(writes, 1)
  assert.equal(component.notices[0].error.message, 'network unavailable')
})

test('provider funding keeps the reviewed amount and does not reapply duplicate verification events', async () => {
  const writes = []
  const component = new Function('api', 'adminConfirmationHeaders', `${operations('AdminAitoTokenUsage', ['saveProviderBalance', 'applyFunding'])}
    let pendingFunding=null;
    const savingFunding={value:''},fundingPasswordOpen={value:false};
    const fundingDraft={openai:12.34},pagination={value:{page:1}};
    const providerBalanceKeys={openai:'openaiBalanceUsdCents'};
    const balanceValue=row=>fundingDraft[row.provider],validBalance=Number.isFinite,usdCents=v=>Math.round(v*100);
    const providerName=v=>v,$q={notify(){}},load=async()=>true;
    return {saveProviderBalance,applyFunding,fundingDraft,fundingPasswordOpen};
  `)({ async put(path, body, config) { writes.push({ path, body: structuredClone(body), config }) } },
  confirmation => ({ headers: { Authorization: 'Bearer original', 'X-Aito-Admin-Confirmation': confirmation.confirmationToken } }))
  await component.saveProviderBalance({ provider: 'openai' })
  assert.equal(component.fundingPasswordOpen.value, true)
  assert.equal(writes.length, 0)
  component.fundingDraft.openai = 999
  await component.applyFunding({ confirmationToken: 'password-proof' })
  await component.applyFunding({ confirmationToken: 'password-proof' })
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].body, { openaiBalanceUsdCents: 1234 })
  assert.equal(writes[0].config.headers['X-Aito-Admin-Confirmation'], 'password-proof')
})

test('different financial forms cannot race while a verified mutation is in flight', async () => {
  let resolveWrite
  let writes = 0
  const component = panel({ put() { writes++; return new Promise(resolve => { resolveWrite = resolve }) } })
  await component.saveFinancial('/billing', { multiplier: 2 }, () => {}, 'Salvo')
  const first = component.applyConfirmation({ confirmationToken: 'password-proof' })
  await assert.rejects(component.saveFinancial('/exchange-rate', { rate: 5 }, () => {}, 'Salvo'))
  assert.equal(writes, 1)
  resolveWrite({ data: { data: {} } })
  await first
})

test('password confirmation keeps the administrator bearer and does not persist the proof', () => {
  const previous = globalThis.localStorage
  const reads = []
  globalThis.localStorage = { getItem(key) { reads.push(key); return 'current-admin-session' } }
  try {
    assert.deepEqual(adminConfirmationHeaders({ confirmationToken: 'password-proof' }), {
      headers: { Authorization: 'Bearer current-admin-session', 'X-Aito-Admin-Confirmation': 'password-proof' },
    })
    assert.deepEqual(reads, ['aito_admin_token'])
  } finally { globalThis.localStorage = previous }
})

test('the reusable dialog submits only the admin password and clears it before waiting', async () => {
  let finish
  let fail
  const calls = []
  const emissions = []
  const component = new Function('api', 'AbortController', 'emissions', `${operations('AdminPasswordDialog', ['confirm', 'reset'])}
    const password={value:'fixture-password'},busy={value:false},error={value:''},open={value:true};
    let pending;
    const emit=(name,data)=>emissions.push([name,data]);
    const financeHeaders=()=>({headers:{Authorization:'Bearer current-admin-session'}});
    return {confirm,reset,password,busy,error,open};
  `)({ post(path, body, config) { calls.push({ path, body, config }); return new Promise((resolve, reject) => { finish = resolve; fail = reject }) } }, AbortController, emissions)
  const first = component.confirm()
  await component.confirm()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/auth/password/reauth')
  assert.deepEqual(calls[0].body, { password: 'fixture-password' })
  assert.equal(component.password.value, '')
  finish({ data: { confirmationToken: 'password-proof' } })
  await first
  assert.deepEqual(emissions, [['verified', { confirmationToken: 'password-proof' }]])
  assert.equal(component.open.value, false)
  component.open.value = true
  component.password.value = 'incorrect-fixture'
  const rejected = component.confirm()
  fail({ response: { data: { message: 'Senha incorreta.' } } })
  await rejected
  assert.equal(component.error.value, 'Senha incorreta.')
  assert.equal(emissions.length, 1)
  component.password.value = 'fixture-password'
  const canceled = component.confirm()
  component.reset()
  finish({ data: { confirmationToken: 'discarded-proof' } })
  await canceled
  assert.equal(calls.at(-1).config.signal.aborted, true)
  assert.equal(component.password.value, '')
  assert.equal(emissions.length, 1)
})
