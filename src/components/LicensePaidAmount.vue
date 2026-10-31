<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
const props = defineProps({ licenses: { type: Array, default: () => [] } })
const emit = defineEmits(['changed'])
const $q = useQuasar(), selected = ref(null), open = ref(false), amount = ref(null), reason = ref(''), busy = ref(false)
const money = cents => cents == null ? 'Não informado' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const rows = computed(() => props.licenses.map(license => ({ ...license.sale, licenseId: license._id })))
function edit(row) { selected.value = row; amount.value = row.amountCents == null ? null : row.amountCents / 100; reason.value = ''; open.value = true }
async function save() {
  busy.value = true
  try { await api.put('/admin/kit-sales/' + selected.value._id, { amount: amount.value, reason: reason.value }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('aito_admin_token') } }); open.value = false; emit('changed'); $q.notify({ type: 'positive', message: 'Valor pago atualizado. Ajuste registrado no histórico.' }) }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível atualizar o valor.' }) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="paid-values"><div v-for="row in rows" :key="row.licenseId"><strong>{{ money(row.amountCents) }}</strong><q-btn v-if="row._id" flat round dense size="sm" icon="mdi-pencil-outline" aria-label="Editar valor pago" @click="edit(row)"><q-tooltip>Editar valor pago nesta licença</q-tooltip></q-btn><small v-if="row.couponCode">{{ row.couponCode }}</small></div><span v-if="!rows.length">—</span></div>
  <q-dialog v-model="open" persistent><q-card class="paid-dialog"><q-card-section class="row items-center justify-between"><strong>Valor pago pelo kit</strong><q-btn flat round dense icon="mdi-close" v-close-popup :disable="busy"/></q-card-section><q-form @submit.prevent="save"><q-card-section class="q-gutter-md"><p>O ajuste atualiza o financeiro e recalcula a comissão conforme a regra registrada na venda. O valor do pedido na operadora é preservado.</p><q-input v-model="amount" outlined type="number" min="0" max="1000000" step="0.01" prefix="R$" label="Valor efetivamente pago" :rules="[v=>v!==null&&v!==''&&Number(v)>=0||'Informe o valor; use zero para cortesia.']"/><q-input v-model.trim="reason" outlined type="textarea" autogrow maxlength="500" label="Motivo do ajuste" :rules="[v=>v.length>=3||'Descreva o motivo.']"/><q-expansion-item v-if="selected?.adjustments?.length" label="Histórico de ajustes" icon="mdi-history"><div v-for="(item,index) in selected.adjustments" :key="index" class="paid-history"><strong>{{ money(item.previousCents) }} → {{ money(item.amountCents) }}</strong><span>{{ item.reason }}</span><small>{{ item.actor }} · {{ new Date(item.at).toLocaleString('pt-BR') }}</small></div></q-expansion-item></q-card-section><q-card-actions align="right"><q-btn flat no-caps label="Cancelar" v-close-popup :disable="busy"/><q-btn unelevated no-caps type="submit" color="teal-8" label="Salvar valor" :loading="busy"/></q-card-actions></q-form></q-card></q-dialog>
</template>
<style scoped>.paid-values>div{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-height:40px}.paid-values small{width:100%;color:#5d7a70}.paid-dialog{width:min(540px,94vw);border-radius:20px;background:#f5fcf9;color:#153b30}.paid-dialog p{font-size:13px;line-height:1.7}.paid-history{display:grid;gap:6px;padding:14px;border-top:1px solid #d6e8df}.paid-history small{color:#557568}</style>
