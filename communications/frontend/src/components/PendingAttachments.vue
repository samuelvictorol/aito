<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
const props=defineProps({files:{type:Array,default:()=>[]},disabled:Boolean})
const emit=defineEmits(['remove'])
const urls=ref(new Map()),selected=ref(null),text=ref('')
watch(()=>props.files,files=>{
 const next=new Map()
 for(const file of files)next.set(file,urls.value.get(file)||URL.createObjectURL(file))
 for(const [file,url] of urls.value)if(!next.has(file))URL.revokeObjectURL(url)
 urls.value=next
 if(selected.value&&!files.includes(selected.value))selected.value=null
},{immediate:true})
watch(selected,async file=>{text.value='';if(file&&/^(text\/|application\/(json|xml))/.test(file.type)&&file.size<2*1024*1024){const value=await file.text();if(selected.value===file)text.value=value}})
onBeforeUnmount(()=>{for(const url of urls.value.values())URL.revokeObjectURL(url)})
const kind=file=>file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':file.type==='application/pdf'?'pdf':'document'
</script>
<template>
 <div class="pending-attachments" aria-label="Anexos para revisar">
  <article v-for="(file,index) in files" :key="urls.get(file)">
   <button class="attachment-preview" type="button" :aria-label="`Conferir ${file.name}`" @click="selected=file">
    <img v-if="kind(file)==='image'" :src="urls.get(file)" alt="Miniatura do anexo">
    <video v-else-if="kind(file)==='video'" :src="urls.get(file)" preload="metadata" muted/>
    <iframe v-else-if="kind(file)==='pdf'" :src="urls.get(file)+'#toolbar=0&navpanes=0'" title="Miniatura do PDF" tabindex="-1"/>
    <span v-else class="material-icons">{{kind(file)==='audio'?'audiotrack':'description'}}</span>
    <strong>{{file.name}}</strong><small>{{Math.ceil(file.size/1024)}} KB · Ampliar</small>
   </button>
   <button type="button" class="attachment-remove" :disabled="disabled" :aria-label="`Remover ${file.name}`" @click="emit('remove',index)">×</button>
  </article>
 </div>
 <q-dialog :model-value="!!selected" @update:model-value="selected=null">
  <q-card v-if="selected" class="attachment-viewer">
   <q-card-section class="row items-center"><strong class="col">{{selected.name}}</strong><q-btn flat round icon="close" aria-label="Fechar prévia" @click="selected=null"/></q-card-section>
   <q-card-section class="attachment-content">
    <img v-if="kind(selected)==='image'" :src="urls.get(selected)" :alt="selected.name">
    <video v-else-if="kind(selected)==='video'" :src="urls.get(selected)" controls/>
    <audio v-else-if="kind(selected)==='audio'" :src="urls.get(selected)" controls/>
    <iframe v-else-if="kind(selected)==='pdf'" :src="urls.get(selected)" :title="selected.name"/>
    <pre v-else-if="text">{{text}}</pre>
    <p v-else>Prévia indisponível neste navegador. <a :href="urls.get(selected)" :download="selected.name">Salvar arquivo para conferir</a></p>
   </q-card-section>
  </q-card>
 </q-dialog>
</template>
<style scoped>
.pending-attachments{grid-column:1/-1;min-width:0;box-sizing:border-box;display:flex;gap:10px;overflow-x:auto;width:100%;padding:8px;flex-basis:100%}.pending-attachments article{position:relative;flex:0 0 142px;border:1px solid #c8e1dc;border-radius:12px;background:#f3faf8;overflow:hidden}.attachment-preview{display:flex;flex-direction:column;width:100%;border:0;background:none;padding:8px;cursor:zoom-in;text-align:left;gap:5px}.attachment-preview img,.attachment-preview video,.attachment-preview iframe{height:90px;width:100%;object-fit:contain;border:0;pointer-events:none}.attachment-preview>.material-icons{height:90px;display:grid;place-items:center;font-size:40px;color:#157568}.attachment-preview strong{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.attachment-preview small{font-size:10px}.attachment-remove{position:absolute;right:4px;top:4px;background:white;border:1px solid #ddd;border-radius:50%;width:26px;height:26px;cursor:pointer}.attachment-viewer{width:900px;max-width:94vw;max-height:90vh}.attachment-content{overflow:auto;max-height:75vh}.attachment-content img,.attachment-content video{max-width:100%;max-height:65vh;display:block;margin:auto}.attachment-content iframe{border:0;width:100%;height:65vh}.attachment-content pre{white-space:pre-wrap}
</style>
