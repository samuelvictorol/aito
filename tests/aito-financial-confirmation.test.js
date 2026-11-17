import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from '@babel/parser'

// Exercise the component's actual operations with controlled server responses.
function panel(api) {
  const source = fs.readFileSync(new URL('../src/components/AdminAitoTokensPanel.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
  const ast = parse(source, { sourceType: 'module' })
  const functions = ast.program.body.filter(node => node.type === 'FunctionDeclaration' && ['saveFinancial', 'applyConfirmation'].includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n')
  return new Function('api', 'structuredClone', `${functions}
    let pendingFinancial = null, pendingGrant = null;
    const financialConfirming = {value:false}, financialSaving={value:false}, mfaOpen={value:false}, grantChallenge={value:null};
    const notices=[],sessions=[];
    const $q={notify: value=>notices.push(value)};
    const financeHeaders=()=>({headers:{Authorization:'Bearer previous-session'}});
    const emit=(_event,session)=>sessions.push(session);
    const notify=(error,message)=>notices.push({error,message});
    const applyGrant=async()=>{};
    return { saveFinancial, applyConfirmation, notices, sessions, mfaOpen,
      cancel(){mfaOpen.value=false;pendingFinancial=null;},
      get pending(){return pendingFinancial;} };
  `)(api, structuredClone)
}

test('financial confirmation retries the reviewed snapshot once with the freshly verified session', async () => {
  const writes = []
  const codeRequired = Object.assign(Error('reauth'), { response: { data: { code: 'REAUTH_REQUIRED' } } })
  const component = panel({
    async put(path, body, config) {
      writes.push({ path, body: structuredClone(body), config })
      if (writes.length === 1) throw codeRequired
      return { data: { data: { multiplier: 1.75 } } }
    },
    async post(path) { assert.equal(path, '/auth/mfa/reauth'); return { data: { challengeId: 'fixture' } } },
  })
  let saved
  const changes = { multiplier: 1.75 }
  await component.saveFinancial('/aito-tokens/admin/billing', changes, data => { saved = data }, 'Salvo')
  assert.equal(component.mfaOpen.value, true)
  assert.equal(saved, undefined)
  changes.multiplier = 99
  await component.applyConfirmation({ token: 'fresh-session' })
  await component.applyConfirmation({ token: 'fresh-session' })
  assert.equal(writes.length, 2)
  assert.deepEqual(writes[1].body, { multiplier: 1.75 })
  assert.equal(writes[1].config.headers.Authorization, 'Bearer fresh-session')
  assert.deepEqual(saved, { multiplier: 1.75 })
  assert.equal(component.sessions.length, 1)
})

test('canceling financial confirmation and unrelated failures never perform a financial retry', async () => {
  let writes = 0
  const required = { response: { data: { code: 'REAUTH_REQUIRED' } } }
  const component = panel({
    async put() { writes++; throw required },
    async post() { return { data: { challengeId: 'fixture' } } },
  })
  await component.saveFinancial('/exchange-rate', { rate: 5 }, () => {}, 'Salvo')
  await assert.rejects(component.saveFinancial('/billing', { multiplier: 2 }, () => {}, 'Salvo'))
  component.cancel()
  await component.applyConfirmation({ token: 'fresh-session' })
  assert.equal(writes, 1)
  const failed = panel({ async put() { throw Error('network unavailable') } })
  await assert.rejects(failed.saveFinancial('/billing', {}, () => {}, 'Salvo'), /network unavailable/)
  assert.equal(failed.mfaOpen.value, false)
})

test('multipliers open a fresh confirmation even when the current session could save directly', async () => {
  const actions = []
  const component = panel({
    async put(path, body, config) { actions.push([path, body, config.headers.Authorization]); return { data: { data: body } } },
    async post(path, body) { actions.push([path, body]); return { data: { challengeId: 'fixture' } } },
  })
  await component.saveFinancial('/billing', { multiplier: 1.3 }, () => {}, 'Salvo', true)
  assert.equal(component.mfaOpen.value, true)
  assert.deepEqual(actions, [['/auth/mfa/reauth', { purpose: 'financial' }]])
  await component.applyConfirmation({ token: 'fresh' })
  assert.deepEqual(actions[1], ['/billing', { multiplier: 1.3 }, 'Bearer fresh'])
})

test('provider funding confirmation preserves the reviewed amount and does not reapply on duplicate events', async () => {
  const source = fs.readFileSync(new URL('../src/components/AdminAitoTokenUsage.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
  const ast = parse(source, { sourceType: 'module' })
  const functions = ast.program.body.filter(node => node.type === 'FunctionDeclaration' && ['saveProviderBalance', 'applyFunding'].includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n')
  const writes = []
  const api = {
    async put(path, body, config) {
      writes.push({ path, body: structuredClone(body), config })
      return {}
    },
    async post(path, body) {
      assert.equal(path, '/auth/mfa/reauth')
      assert.deepEqual(body, { purpose: 'financial' })
      return { data: { challengeId: 'fixture' } }
    },
  }
  const component = new Function('api', `${functions}
    let pendingFunding=null;
    const savingFunding={value:''},fundingMfaOpen={value:false},fundingChallenge={value:null};
    const fundingDraft={openai:12.34},pagination={value:{page:1}};
    const providerBalanceKeys={openai:'openaiBalanceUsdCents'};
    const balanceValue=row=>fundingDraft[row.provider],validBalance=Number.isFinite,usdCents=v=>Math.round(v*100);
    const financeHeaders=()=>({headers:{Authorization:'Bearer old'}}),providerName=v=>v;
    const $q={notify(){}},emit=()=>{},load=async()=>true;
    return {saveProviderBalance,applyFunding,fundingDraft,fundingMfaOpen};
  `)(api)
  await component.saveProviderBalance({ provider: 'openai' })
  assert.equal(component.fundingMfaOpen.value, true)
  assert.equal(writes.length, 0)
  component.fundingDraft.openai = 999
  await component.applyFunding({ token: 'fresh' })
  await component.applyFunding({ token: 'fresh' })
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].body, { openaiBalanceUsdCents: 1234 })
  assert.equal(writes[0].config.headers.Authorization, 'Bearer fresh')
})

test('different financial forms cannot race while the initial write or confirmation request is in flight', async () => {
  let resolveWrite
  let writes = 0
  const component = panel({
    put() { writes++; return new Promise(resolve => { resolveWrite = resolve }) },
  })
  const first = component.saveFinancial('/billing', { multiplier: 2 }, () => {}, 'Salvo')
  await assert.rejects(component.saveFinancial('/exchange-rate', { rate: 5 }, () => {}, 'Salvo'))
  assert.equal(writes, 1)
  resolveWrite({ data: { data: {} } })
  await first
})
