<script setup>
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])
function change(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
</script>
<template><div class="general-fields">
<div class="field"><label>Reiniciar fluxo sem IA após inatividade (min)</label><input :value="modelValue.resetAfterMinutes" type="number" min="1" max="43200" @input="change('resetAfterMinutes', Number($event.target.value))"></div>
<div class="field"><label>Retornar do atendimento humano ao bot após inatividade (min)</label><input :value="modelValue.humanIdleMinutes || 0" type="number" min="0" max="43200" @input="change('humanIdleMinutes', Number($event.target.value))"><small>0 mantém o atendimento humano até a equipe devolver ao bot.</small></div>
<div class="field"><label>Mensagem opcional ao retornar ao bot</label><textarea :value="modelValue.humanReturnMessage" maxlength="3000" @input="change('humanReturnMessage', $event.target.value)"></textarea></div>
<div class="field"><label>Intervalo entre balões do bot (ms)</label><input :value="modelValue.messageIntervalMs || 1000" type="number" min="250" max="10000" step="250" @input="change('messageIntervalMs', Number($event.target.value))"></div>
<div class="field"><label>Resposta quando nenhuma condição combinar</label><textarea :value="modelValue.fallbackMessage" maxlength="3000" @input="change('fallbackMessage', $event.target.value)"></textarea></div>
<label class="toggle"><input :checked="modelValue.matchFirstMessage" type="checkbox" @change="change('matchFirstMessage', $event.target.checked)">Interpretar a primeira mensagem</label>
<p>A memória da IA é configurada em Integrações. O agrupamento de mensagens é configurado em Monitoramento e vale também para o simulador.</p>
</div></template>
<style scoped>.general-fields{display:grid;gap:16px;margin:18px 0}.general-fields p{font-size:12px;line-height:1.5;color:var(--muted)}</style>
