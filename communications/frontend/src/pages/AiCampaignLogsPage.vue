<script setup>
import PageHeader from '../components/PageHeader.vue'
import NotificationsPage from './NotificationsPage.vue'
</script>

<template>
  <q-page class="page-container">
    <PageHeader
      eyebrow="Estúdio do agente"
      title="Monitor de disparos"
      icon="monitor_heart"
      description="Filtre os lotes por canal e abra cada disparo para acompanhar suas entregas, tentativas e falhas."
    >
      <template #actions>
        <q-btn outline no-caps color="primary" icon="arrow_back" label="Voltar ao estúdio" to="/agent-ai/campaigns" />
      </template>
    </PageHeader>
    <NotificationsPage mode="logs" />
  </q-page>
</template>
