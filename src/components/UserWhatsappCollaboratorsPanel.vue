<script setup>
import { onMounted, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const installations = ref([])
const loading = ref(false)
const error = ref('')
const saving = ref('')
const authorization = () => ({ headers: { Authorization: 'Bearer ' + localStorage.getItem('aito_user_token') } })
const linkFor = slug => window.location.origin + '/app/wpp-colab/' + slug

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/desktop-collaborators/installations', authorization())
    installations.value = data.items
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível consultar suas instalações.'
  } finally { loading.value = false }
}

async function setEnabled(item) {
  saving.value = item.slug
  error.value = ''
  try {
    const { data } = await api.patch('/desktop-collaborators/' + item.slug + '/access', { enabled: !item.enabled }, authorization())
    Object.assign(item, data)
  } catch (cause) { error.value = cause.response?.data?.message || 'Não foi possível ajustar o acesso da equipe.' }
  finally { saving.value = '' }
}

async function copy(url) {
  try {
    await copyToClipboard(url)
    $q.notify({ type: 'positive', message: 'Link copiado.' })
  } catch { $q.notify({ type: 'warning', message: 'Selecione o endereço para copiá-lo.' }) }
}
onMounted(load)
</script>

<template>
  <section class="collaborator-settings" aria-labelledby="collaborator-title">
    <div class="collaborator-settings__header">
      <q-icon name="mdi-whatsapp" size="36px" />
      <div><h2 id="collaborator-title">WhatsApp da equipe</h2><p>Compartilhe o acesso às conversas com colaboradores cadastrados no Desktop.</p></div>
      <q-btn flat round icon="mdi-refresh" aria-label="Atualizar instalações" :loading="loading" @click="load" />
    </div>
    <q-banner v-if="error" rounded class="bg-orange-1 text-deep-orange-10" role="alert">{{ error }}</q-banner>
    <p v-else-if="!loading && !installations.length">Abra o Desktop com uma licença ativa para gerar o link de acesso.</p>
    <article v-for="item in installations" :key="item.licenseId" class="collaborator-settings__installation">
      <div><strong>Desktop · {{ item.licenseId.slice(-8).toUpperCase() }}</strong><span :class="{ active: item.connected }">{{ item.connected ? 'Conectado' : 'Offline' }}</span></div>
      <label v-if="item.enabled"><span>Link da equipe</span><input readonly :value="linkFor(item.slug)" @focus="$event.target.select()" /></label>
      <p v-else>Ative o acesso para compartilhar um link com a equipe.</p>
      <div class="collaborator-settings__actions">
        <q-btn outline no-caps :icon="item.enabled ? 'mdi-lock-outline' : 'mdi-lock-open-variant-outline'" :label="item.enabled ? 'Desativar acesso' : 'Ativar acesso'" :loading="saving === item.slug" :disable="Boolean(saving)" @click="setEnabled(item)" />
        <template v-if="item.enabled">
          <q-btn outline no-caps icon="mdi-content-copy" label="Copiar link" @click="copy(linkFor(item.slug))" />
          <q-btn unelevated no-caps class="collaborator-open" icon="mdi-open-in-new" label="Abrir conversas" :href="linkFor(item.slug)" target="_blank" rel="noopener" />
        </template>
      </div>
    </article>
    <p v-if="installations.length">Mantenha o Desktop ligado e conectado ao WhatsApp. A equipe entra com o usuário, a senha e o código por e-mail, se ativado no perfil do colaborador.</p>
  </section>
</template>

<style scoped>
.collaborator-settings { display: grid; gap: 16px; color: #e6fff7; }
.collaborator-settings__header { display: flex; align-items: center; gap: 12px; }
.collaborator-settings__header > div { flex: 1; }
.collaborator-settings h2 { margin: 0; font-size: clamp(1.25rem,3vw,1.85rem); font-weight: 800; line-height: 1.2; }
.collaborator-settings p { margin: 6px 0 0; }
.collaborator-settings__header > .q-icon { color: #6defc6; }
.collaborator-settings__installation { display: grid; gap: 12px; padding: 16px; border-radius: 14px; border: 1px solid #245d52; background: #0a2322; }
.collaborator-settings__installation > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.collaborator-settings__installation > div > span { background: #493b20; color: #ffe2a5; border-radius: 999px; padding: 2px 8px; font-size: .78rem; }
.collaborator-settings__installation > div > span.active { background: #164738; color: #b8ffe7; }
.collaborator-settings__installation label { display: grid; gap: 4px; min-width: 0; }
.collaborator-settings__installation input { color: #e6fff7; background: #081b1a; border: 1px solid #38786a; border-radius: 8px; width: 100%; padding: 9px; }
.collaborator-settings__actions > .collaborator-open { background: #a2f3d9; color: #082d20; }
</style>
