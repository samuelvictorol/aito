<script setup>
import DOMPurify from 'dompurify'
import LinkedSitesPreview from './LinkedSitesPreview.vue'

defineProps({ items: { type: Array, required: true } })

function safeReviewHtml(value) {
  return DOMPurify.sanitize(String(value || ''), { USE_PROFILES: { html: true } })
}

function safeDocumentLink(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="review-preview-grid">
    <article v-for="item in items" :key="item.value" class="review-preview-card">
      <header>
        <span class="review-channel-icon"><q-icon :name="item.icon" /></span>
        <div>
          <strong>{{ item.label }}</strong>
          <span>{{ item.templateName }}</span>
        </div>
        <q-badge
          outline
          :color="item.enabled ? 'primary' : 'warning'"
          :label="item.enabled ? 'Selecionado' : 'Canal indisponível'"
        />
      </header>

      <q-banner v-if="!item.enabled" dense rounded class="review-channel-warning">
        <template #avatar><q-icon name="warning_amber" color="warning" /></template>
        A fila consultará este canal novamente. Se continuar indisponível, a entrega será ignorada e registrada sem interromper os demais canais.
      </q-banner>

      <LinkedSitesPreview :ids="item.siteTemplateIds || []" />
      <div v-if="item.preview.officialName" class="review-meta">
        <span>Nome oficial</span>
        <strong>{{ item.preview.officialName }}</strong>
        <q-badge color="grey-3" text-color="dark" :label="item.preview.languageCode" />
      </div>
      <div v-if="item.preview.subject" class="review-subject">
        <span>Assunto</span>
        <strong>{{ item.preview.subject }}</strong>
      </div>
      <div class="review-message">
        <span>Prévia da mensagem</span>
        <strong v-if="item.preview.header" class="review-component-text">{{ item.preview.header }}</strong>
        <div v-if="item.preview.mediaUrl" class="review-media">
          <img
            v-if="['photo', 'image'].includes(item.preview.mediaType)"
            :src="item.preview.mediaUrl"
            alt="Imagem do template"
            referrerpolicy="no-referrer"
          />
          <video v-else-if="item.preview.mediaType === 'video'" :src="item.preview.mediaUrl" controls preload="metadata" />
          <a v-else-if="safeDocumentLink(item.preview.mediaUrl)" :href="safeDocumentLink(item.preview.mediaUrl)" target="_blank" rel="noopener noreferrer">
            <q-icon name="description" /> Abrir documento
          </a>
        </div>
        <div v-if="item.preview.html" class="review-html" v-html="safeReviewHtml(item.preview.html)" />
        <p v-else>{{ item.preview.body }}</p>
        <small v-if="item.preview.footer" class="review-footer">{{ item.preview.footer }}</small>
        <div v-if="item.preview.buttons?.length" class="review-buttons">
          <span v-for="button in item.preview.buttons" :key="`${button.text}-${button.url}`">
            <q-icon name="open_in_new" /> {{ button.text }}
          </span>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.review-channel-warning {
  margin: 12px 14px 0;
  border: 1px solid rgba(242, 169, 59, 0.32);
  background: rgba(255, 244, 219, 0.72);
  color: #76551d;
  font-size: 0.76rem;
}

.review-preview-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.review-preview-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(14, 89, 78, 0.14);
  border-radius: 17px;
  background: #f9fdfc;
  box-shadow: 0 8px 24px rgba(7, 57, 50, 0.06);
}

.review-preview-card > header {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: rgba(130, 248, 230, 0.11);
}

.review-preview-card > header strong,
.review-preview-card > header span {
  display: block;
}

.review-preview-card > header span {
  overflow: hidden;
  color: #657975;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-channel-icon {
  display: grid !important;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: #dffaf5;
  color: #168f7d !important;
  font-size: 21px !important;
}

.review-meta,
.review-subject,
.review-message {
  padding: 12px 14px;
  border-top: 1px solid rgba(14, 89, 78, 0.09);
}

.review-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 8px;
}

.review-meta > span,
.review-subject > span,
.review-message > span {
  display: block;
  color: #70817e;
  font-size: 0.7rem;
}

.review-meta > strong {
  overflow-wrap: anywhere;
}

.review-meta > span {
  grid-column: 1 / -1;
}

.review-subject strong {
  display: block;
  margin-top: 3px;
}

.review-message p {
  margin: 6px 0 0;
  color: #173c36;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.review-media {
  margin-top: 8px;
}

.review-media img,
.review-media video {
  display: block;
  width: 100%;
  max-height: 260px;
  border-radius: 12px;
  background: #e7f1ef;
  object-fit: contain;
}

.review-media a {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #e7f6f2;
  color: #13745f;
  font-weight: 700;
  text-decoration: none;
}

.review-component-text {
  display: block;
  margin-top: 8px;
  color: #123f37;
  overflow-wrap: anywhere;
}

.review-footer {
  display: block;
  margin-top: 8px;
  color: #6b7f7b;
  line-height: 1.4;
}

.review-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}

.review-html {
  max-width: 100%;
  margin-top: 8px;
  overflow-wrap: anywhere;
}

.review-html :deep(img),
.review-html :deep(video) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8px auto;
  border-radius: 10px;
}

.review-html :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 650px) {
  .review-preview-grid { grid-template-columns: 1fr; }
}
</style>
