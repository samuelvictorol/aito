<script setup>
import { vCanAction } from '../../../services/permission-directives.js'
import { vAuthSrc, vAuthHref } from '../authenticated-media.js'
import { computed, onMounted, ref } from 'vue'
import { api, formatDate, messageOf } from '../services.js'

const items = ref([]), search = ref(''), loading = ref(false), uploading = ref(false), toast = ref(''), file = ref(null), name = ref(''), description = ref(''), editing = ref(null)
const acceptLabel = computed(() => file.value ? `${file.value.name} · ${Math.ceil(file.value.size / 1024)} KB` : 'Escolher imagem, áudio, vídeo, PDF ou documento')
function show(value) { toast.value = value; setTimeout(() => { if (toast.value === value) toast.value = '' }, 3200) }
function publicUrl(item) { return `${window.location.origin}${item.link_url || item.url}` }
function formatSize(bytes) { const value = Number(bytes || 0); return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB` }
async function load() { loading.value = true; try { items.value = (await api.get('/assets', { params: { search: search.value, limit: 100 } })).data.items } catch (cause) { show(messageOf(cause)) } finally { loading.value = false } }
function choose(event) { file.value = event.target.files?.[0] || null; if (file.value && !name.value) name.value = file.value.name }
async function upload() {
  if (!file.value) return show('Escolha um arquivo primeiro.')
  uploading.value = true
  try {
    const form = new FormData(); form.append('file', file.value); form.append('name', name.value || file.value.name); form.append('description', description.value)
    await api.post('/assets', form); file.value = null; name.value = ''; description.value = ''; await load(); show('Arquivo salvo e pronto para uso nos fluxos.')
  } catch (cause) { show(messageOf(cause)) } finally { uploading.value = false }
}
function beginEdit(item) { editing.value = { ...item } }
async function saveEdit() { try { await api.put(`/assets/${editing.value._id}`, { name: editing.value.name, description: editing.value.description }); editing.value = null; await load(); show('Dados atualizados.') } catch (cause) { show(messageOf(cause)) } }
async function remove(item) { if (!confirm(`Apagar “${item.name}” da biblioteca?`)) return; try { await api.delete(`/assets/${item._id}`); await load(); show('Arquivo removido.') } catch (cause) { show(messageOf(cause)) } }
async function copy(item) { try { await navigator.clipboard.writeText(publicUrl(item)); show('Link copiado.') } catch { show(publicUrl(item)) } }
onMounted(load)
</script>

<template>
  <section>
    <div class="page-head"><div><span class="eyebrow">Biblioteca permanente</span><h1>Arquivos do bot</h1><p>Faça upload uma vez e reutilize imagens, áudios, vídeos e documentos em qualquer ponto do fluxo.</p></div></div>
    <article v-can-action="'web_files.import'" class="card upload-card">
      <label class="drop-zone"><span>▧</span><b>{{ acceptLabel }}</b><small>Até o limite definido em Configurações</small><input type="file" @change="choose"></label>
      <div class="upload-fields"><div class="field"><label>Nome no painel</label><input v-model="name" placeholder="Ex.: Catálogo de serviços"></div><div class="field"><label>Descrição</label><input v-model="description" placeholder="Onde e quando este arquivo é usado"></div><button class="btn" :disabled="uploading || !file" @click="upload">{{ uploading ? 'Enviando…' : 'Salvar arquivo' }}</button></div>
    </article>
    <div class="asset-toolbar"><input v-model="search" class="search" placeholder="Buscar na biblioteca…" @keyup.enter="load"><button class="btn secondary" @click="load">Buscar</button><span>{{ items.length }} arquivo(s)</span></div>
    <div v-if="loading" class="card empty">Carregando arquivos…</div>
    <div v-else-if="!items.length" class="card empty"><b>A biblioteca está vazia</b><span>Envie o primeiro arquivo acima.</span></div>
    <div v-else class="asset-grid">
      <article v-for="item in items" :key="item._id" class="card asset-card">
        <div class="asset-preview"><img v-if="item.kind==='image'" v-auth-src="item.url" :alt="item.name"><video v-else-if="item.kind==='video'" v-auth-src="item.url" controls preload="metadata"></video><audio v-else-if="item.kind==='audio'" v-auth-src="item.url" controls preload="metadata"></audio><span v-else>PDF<br><small>ou documento</small></span></div>
        <div class="asset-copy"><span class="kind">{{ item.kind }}</span><h2>{{ item.name }}</h2><p>{{ item.description || item.filename }}</p><small>{{ formatSize(item.size) }} · atualizado {{ formatDate(item.updatedAt, true) }}</small></div>
        <footer><a class="btn" v-auth-href="item.url" target="_blank">Abrir</a><button class="btn secondary" @click="copy(item)">Copiar link_url</button><button v-can-action="'web_files.edit'" class="icon-button" title="Editar" @click="beginEdit(item)">✎</button><button v-can-action="'web_files.delete'" class="icon-button danger-icon" title="Remover" @click="remove(item)">×</button></footer>
      </article>
    </div>
    <div v-if="editing" class="modal-backdrop" @click.self="editing=null"><form class="card edit-modal" @submit.prevent="saveEdit"><span class="eyebrow">Editar arquivo</span><h2>{{ editing.filename }}</h2><div class="field"><label>Nome</label><input v-model="editing.name" required></div><div class="field"><label>Descrição</label><textarea v-model="editing.description"></textarea></div><div class="modal-actions"><button type="button" class="btn secondary" @click="editing=null">Cancelar</button><button v-can-action="'web_files.edit'" class="btn">Salvar</button></div></form></div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </section>
</template>

<style scoped>
.upload-card{display:grid;grid-template-columns:320px 1fr;gap:18px;padding:18px}.drop-zone{display:grid;min-height:150px;place-items:center;align-content:center;padding:18px;border:1px dashed #85c7b7;border-radius:14px;color:#3f6d62;background:#f2fcf9;text-align:center;cursor:pointer}.drop-zone>span{font-size:2rem}.drop-zone b,.drop-zone small{display:block}.drop-zone b{margin-top:7px;font-size:.74rem}.drop-zone small{margin-top:4px;color:#81918c;font-size:.62rem}.drop-zone input{display:none}.upload-fields{display:grid;grid-template-columns:1fr 1fr;align-content:center;gap:12px}.upload-fields .btn{grid-column:1/-1;justify-self:start}.asset-toolbar{display:flex;align-items:center;gap:9px;margin:20px 0 14px}.asset-toolbar .search{max-width:440px}.asset-toolbar span{margin-left:auto;color:#7a8b86;font-size:.7rem}.asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.asset-card{display:flex;min-width:0;flex-direction:column;overflow:hidden}.asset-preview{display:grid;height:185px;place-items:center;overflow:hidden;color:#416b61;background:#eaf5f2;font-weight:800;text-align:center}.asset-preview img,.asset-preview video{width:100%;height:100%;object-fit:cover}.asset-preview audio{width:88%}.asset-preview small{font-size:.6rem;font-weight:500}.asset-copy{padding:15px}.kind{color:#17816b;font-size:.58rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.asset-copy h2{margin:5px 0;font:800 1rem Inter,'Segoe UI',sans-serif}.asset-copy p{min-height:34px;margin:0;color:#6e7e79;font-size:.7rem}.asset-copy>small{display:block;margin-top:10px;color:#91a09c;font-size:.6rem}.asset-card footer{display:flex;gap:6px;margin-top:auto;padding:0 15px 15px}.asset-card footer .btn{min-height:36px;padding:0 10px;font-size:.65rem}.danger-icon{color:#c8394d}.modal-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(5,31,26,.52)}.edit-modal{display:grid;width:min(520px,100%);gap:14px;padding:22px}.edit-modal h2{margin:0;font:800 1.1rem Inter,'Segoe UI',sans-serif}.modal-actions{display:flex;justify-content:flex-end;gap:8px}@media(max-width:1050px){.asset-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.upload-card{grid-template-columns:1fr}.upload-fields{grid-template-columns:1fr}.asset-grid{grid-template-columns:1fr}.asset-toolbar{align-items:stretch;flex-wrap:wrap}.asset-toolbar .search{max-width:none;flex:1}}
</style>
