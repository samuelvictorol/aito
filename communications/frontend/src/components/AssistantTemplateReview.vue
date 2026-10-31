<script setup>
import { computed } from 'vue'
const props = defineProps({ preview: { type: Object, required: true } })
const template = computed(() => props.preview.template)
const parameters = computed(() => (props.preview.data?.payload?.builder?.components || []).flatMap(component => (component.parameters || []).map(parameter => ({ ...parameter, section: component.type === 'header' ? 'Cabeçalho' : component.type === 'button' ? 'Botão' : 'Corpo' }))))
</script>
<template>
  <div class="assistant-template-review">
    <p v-if="preview.cloneSource" class="template-clone-note"><q-icon name="content_copy"/><span>Cópia de <strong>{{preview.cloneSource.name}}</strong> · o original será preservado.</span></p>
    <div v-if="template" class="template-preview">
      <header><q-icon name="verified"/><div><strong>{{preview.data?.name || template.name}}</strong><small>{{template.name}} · {{template.languageCode}}<template v-if="preview.data?.category"> · {{preview.data.category}}</template></small></div></header>
      <div class="template-preview__message">
        <strong v-if="template.header?.text" class="template-preview__header">{{template.header.text}}</strong>
        <div v-else-if="template.header" class="template-preview__media"><q-icon name="perm_media"/> {{template.header.type}}</div>
        <div v-if="template.body?.text" class="template-preview__body">{{template.body.text}}</div>
        <small v-if="template.footer?.text" class="template-preview__footer">{{template.footer.text}}</small>
        <div v-for="(button,index) in template.buttons || []" :key="index" class="template-preview__button"><span><q-icon name="open_in_new"/> {{button.text || 'Botão'}}</span><small v-if="button.url">{{button.url}}</small></div>
      </div>
      <p class="template-preview__caption">Prévia com amostras. Os campos dinâmicos serão definidos em cada envio.</p>
      <div v-if="parameters.length" class="template-parameters"><span v-for="parameter in parameters" :key="parameter.key"><q-icon :name="parameter.contentMode==='fixed'?'lock':'data_object'"/>{{parameter.section}} · {{parameter.label || parameter.key}}<small>{{parameter.contentMode==='fixed'?'Valor fixo':'Dinâmico'}}</small></span></div>
    </div>
    <div v-if="preview.warnings?.length" class="template-review-notes" role="note"><p v-for="(warning,index) in preview.warnings" :key="index"><q-icon name="info_outline"/><span>{{warning}}</span></p></div>
  </div>
</template>
<style scoped>
.assistant-template-review{margin:14px 0}.template-clone-note{display:flex;gap:8px;align-items:start;font-size:12px;color:var(--aito-text);line-height:1.6}.template-clone-note>.q-icon{color:var(--aito-accent);font-size:19px;flex:none}.template-preview{border:1px solid var(--aito-line);border-radius:14px;overflow:hidden;background:var(--aito-tint)}.template-preview>header{display:flex;align-items:center;gap:9px;padding:12px 14px;background:var(--aito-panel)}.template-preview>header>.q-icon{color:var(--aito-accent);font-size:21px}.template-preview>header>div{min-width:0}.template-preview>header strong{display:block;font-size:13px;overflow-wrap:anywhere}.template-preview>header small{display:block;font-size:10px;color:var(--aito-muted);margin-top:4px;overflow-wrap:anywhere}.template-preview__message{margin:15px;padding:14px;border:1px solid var(--aito-line);border-radius:12px;background:white;color:#19352f;box-shadow:0 2px 5px #19352f09;font-size:13px;line-height:1.65}.template-preview__header{display:block;margin-bottom:10px;white-space:pre-wrap}.template-preview__body{white-space:pre-wrap;overflow-wrap:anywhere}.template-preview__footer{display:block;margin-top:13px;font-size:11px;color:#647b76;white-space:pre-wrap}.template-preview__button{border-top:1px solid #19352f17;text-align:center;margin-top:12px;padding-top:10px;color:var(--aito-accent)}.template-preview__button>span{display:block;font-size:12px;font-weight:600}.template-preview__button>small{display:block;color:#647b76;font-size:10px;overflow-wrap:anywhere;margin-top:4px}.template-preview__caption{font-size:10px;color:var(--aito-muted);line-height:1.5;padding:0 15px;margin:0 0 12px}.template-parameters{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px}.template-parameters>span{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:10px;background:var(--aito-panel);border:1px solid var(--aito-line);border-radius:8px;padding:6px;color:var(--aito-text);overflow-wrap:anywhere;max-width:100%}.template-parameters small{color:var(--aito-muted);font-size:9px}.template-review-notes{display:grid;gap:6px;margin-top:12px}.template-review-notes p{display:flex;align-items:start;gap:7px;margin:0;padding:10px;border-radius:9px;background:#fff8e7;color:#725522;font-size:11px;line-height:1.6}.template-review-notes .q-icon{flex:none;font-size:16px;margin-top:2px}.template-preview__media{display:flex;align-items:center;gap:6px;padding:18px;background:var(--aito-tint);margin-bottom:10px}
</style>
