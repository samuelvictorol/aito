<script setup>
import LandingVideoMonitor from './landing3d/LandingVideoMonitor.vue'
import MultichannelBenefits from './MultichannelBenefits.vue'
import SolutionChatSimulator from './SolutionChatSimulator.vue'
import { desktopSolutions } from 'src/data/desktopSolutions'
import { desktopSolutionVideos } from 'src/data/landingHeroVideo'

const modules = [
  { id: 'notificacoes', tone: 'blue', name: '01 · AITONOTIFY', icon: 'mdi-bullhorn-outline', ...desktopSolutions.notifications,
    video: desktopSolutionVideos.notifications, videoTitle: 'Notificações com a API oficial', videoIntro: 'Da preparação à entrega em cada canal.' },
  { id: 'chatbots', tone: 'green', name: '02 · WHATSAPP BOTBUILDER', icon: 'mdi-sitemap-outline', ...desktopSolutions.bot,
    video: desktopSolutionVideos.botBuilder, videoTitle: 'Conheça o WhatsApp BotBuilder', videoIntro: 'Do primeiro card à conversa pronta.' },
  { id: 'agentes', tone: 'gold', name: '03 · AITO I.A.', icon: 'mdi-auto-fix', ...desktopSolutions.agent },
]

const actionPreview = [
  { icon: 'mdi-message-text-outline', text: 'Você descreve a tarefa' },
  { icon: 'mdi-playlist-check', text: 'O agente prepara as ações' },
  { icon: 'mdi-check-decagram-outline', text: 'Sua equipe revisa e autoriza' },
]
</script>

<template>
  <section v-for="item in modules" :id="item.id" :key="item.id" class="desktop-module"
    :class="`desktop-module--${item.tone}`" :aria-labelledby="`${item.id}-title`">
    <div class="desktop-module__heading">
      <span class="desktop-module__kicker"><q-icon :name="item.icon" aria-hidden="true" />{{ item.name }}</span>
      <h2 :id="`${item.id}-title`">{{ item.title }}</h2>
      <p>{{ item.summary }}</p>
      <a v-if="item.id === 'chatbots'" href="#simulador-chatbot" class="desktop-module__try-link">
        <q-icon name="mdi-gesture-tap" aria-hidden="true" /> Testar o bot no celular abaixo <q-icon name="mdi-arrow-down" aria-hidden="true" />
      </a>
    </div>

    <div class="desktop-module__grid">
      <div class="desktop-module__features" :aria-label="`Recursos de ${item.name.slice(5)}`">
        <details v-for="(feature, index) in item.features" :key="feature.title" :open="index === 0">
          <summary><q-icon :name="feature.icon" aria-hidden="true" />{{ feature.title }}<q-icon name="mdi-chevron-down" class="desktop-module__chevron" aria-hidden="true" /></summary>
          <p>{{ feature.text }}</p>
        </details>
      </div>
      <LandingVideoMonitor v-if="item.video" :video="item.video" :title="item.videoTitle" :headline="item.videoTitle"
        eyebrow="DEMONSTRAÇÃO DO MÓDULO" :description="item.videoIntro" />
      <div v-else class="desktop-module__preview" aria-label="Exemplo de fluxo de trabalho da Aito I.A.">
        <div class="desktop-module__preview-top"><img src="/ia.gif" alt="" width="48" height="48" loading="lazy" /> <strong>Aito I.A.</strong><span>EXEMPLO</span></div>
        <p class="desktop-module__prompt">“Prepare um lembrete de retorno para a equipe revisar.”</p>
        <ol><li v-for="step in actionPreview" :key="step.text"><q-icon :name="step.icon" aria-hidden="true" />{{ step.text }}</li></ol>
      </div>
    </div>

    <template v-if="item.id === 'notificacoes'">
      <MultichannelBenefits />
      <p class="desktop-module__boundary"><q-icon name="mdi-shield-check-outline" aria-hidden="true" />
        Os envios oficiais seguem as permissões, os modelos e os limites da sua conta Meta.
        <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">Políticas do WhatsApp</a>
      </p>
    </template>

    <template v-else-if="item.id === 'chatbots'">
      <div id="simulador-chatbot" class="desktop-module__simulator">
        <div>
          <span class="desktop-module__kicker"><q-icon name="mdi-gesture-tap" aria-hidden="true" /> TESTE INTERATIVO</span>
          <h3>Esse bot responde a você.</h3>
          <p>Escolha um cenário no celular e toque em uma resposta. Veja a conversa avançar até um agendamento, um pagamento ou um pedido.</p>
          <span class="desktop-module__simulator-note"><q-icon name="mdi-lock-outline" aria-hidden="true" /> Cenários fictícios, sem conectar seu WhatsApp.</span>
        </div>
        <div class="interactive-demo">
          <div class="interactive-demo__invite"><q-icon name="mdi-cellphone-play" aria-hidden="true" /><strong>Escolha um cenário para começar</strong></div>
          <SolutionChatSimulator />
        </div>
      </div>
      <p class="desktop-module__boundary"><q-icon name="mdi-qrcode" aria-hidden="true" /> O QR Code conecta uma sessão do WhatsApp Web, uma modalidade não oficial. Use a API oficial para notificações em escala.</p>
    </template>

    <p v-else class="desktop-module__boundary"><q-icon name="mdi-key-outline" aria-hidden="true" /> A IA usa a chave e os créditos da sua conta de provedor.</p>
  </section>
</template>

<style scoped>
.desktop-module {
  --module-text: #12364f;
  --module-muted: #33576d;
  --module-accent: #14669e;
  --module-line: #75b3d568;
  --module-tint: #cdeeff;
  color: var(--module-text);
  background: radial-gradient(ellipse at 90% 0%, var(--module-tint), transparent 63%), #f6fbff;
  border: 1px solid var(--module-line);
  border-radius: 26px;
  margin: 28px 0;
  padding: clamp(20px, 4.5vw, 55px);
  scroll-margin-top: 102px;
}
.desktop-module--green { --module-text: #143b30; --module-muted: #335e4f; --module-accent: #087b57; --module-line: #7bc8a571; --module-tint: #c8f6df; background-color: #f3fff8; }
.desktop-module--gold { --module-text: #48300f; --module-muted: #654d26; --module-accent: #8b5912; --module-line: #d8b17175; --module-tint: #ffe3a8; background-color: #fffdfa; }
.desktop-module__heading { max-width: 650px; margin-bottom: clamp(22px, 3.5vw, 40px); }
.desktop-module__kicker { display: inline-flex; align-items: center; gap: 8px; color: var(--module-accent); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.desktop-module__kicker .q-icon { font-size: 20px; }
.desktop-module h2 { margin: 12px 0; font-size: clamp(30px, 4vw, 53px); font-weight: 760; line-height: 1.1; letter-spacing: -.04em; }
.desktop-module p { margin: 0; color: var(--module-muted); line-height: 1.65; }
.desktop-module__grid { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: clamp(20px, 4vw, 44px); }
.desktop-module__grid > * { min-width: 0; }
.desktop-module__features { display: grid; gap: 8px; }
.desktop-module details { border: 1px solid var(--module-line); border-radius: 13px; background: #ffffffd9; }
.desktop-module summary { display: grid; grid-template-columns: 22px minmax(0, 1fr) 18px; align-items: center; gap: 11px; padding: 14px; font-size: .89rem; font-weight: 750; cursor: pointer; list-style: none; }
.desktop-module summary::-webkit-details-marker { display: none; }
.desktop-module summary:focus-visible { outline: 2px solid var(--module-accent); outline-offset: 2px; border-radius: 12px; }
.desktop-module summary .q-icon { color: var(--module-accent); font-size: 19px; }
.desktop-module details[open] .desktop-module__chevron { transform: rotate(180deg); }
.desktop-module details p { padding: 0 14px 15px 47px; font-size: .8rem; }
.desktop-module :deep(.channel-benefits) { padding: 24px 0 0; margin-top: 30px; color: #12364f; border-top-color: var(--module-line); }
.desktop-module :deep(.channel-benefits > header) { margin-bottom: 16px; }
.desktop-module :deep(.channel-benefits h2) { font-size: clamp(23px, 3vw, 32px); margin: 9px 0; }
.desktop-module :deep(.channel-benefits__eyebrow),.desktop-module :deep(.channel-benefits h2 em) { color: #14669e; }
.desktop-module :deep(.channel-benefits p),.desktop-module :deep(.channel-benefits small) { color: #33576d !important; }
.desktop-module :deep(.channel-benefits__grid > article) { padding: 17px; border-color: var(--module-line) !important; background: #fff !important; }
.desktop-module :deep(.channel-benefits__grid .q-icon) { color: #14669e !important; }
.desktop-module :deep(.channel-benefits h3) { font-size: 17px; }
.desktop-module__boundary { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 19px !important; font-size: .76rem; }
.desktop-module__boundary .q-icon { color: var(--module-accent); font-size: 19px; }
.desktop-module__boundary a { color: var(--module-accent) !important; font-weight: 750; text-decoration: underline; }
.desktop-module__try-link { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 14px; border: 1px solid #26876c69; border-radius: 10px; background: #e0fff0; color: #075d42 !important; font-size: .8rem; font-weight: 800; }
.desktop-module__simulator { display: grid; grid-template-columns: 1fr minmax(260px, 365px); align-items: center; gap: clamp(16px, 5vw, 64px); margin-top: 32px; padding: clamp(15px, 4vw, 36px); border: 1px solid var(--module-line); border-radius: 21px; background: #dff6ec; scroll-margin-top: 102px; }
.desktop-module__simulator h3 { margin: 12px 0; font-size: clamp(23px, 3.6vw, 38px); line-height: 1.15; font-weight: 750; }
.desktop-module__simulator-note { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-size: .75rem; color: var(--module-muted); }
.desktop-module__preview { padding: clamp(14px, 3vw, 25px); border: 1px solid var(--module-line); border-radius: 18px; background: #fff; box-shadow: 0 14px 30px #71501013; }
.desktop-module__preview-top { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }
.desktop-module__preview-top span { margin-left: auto; color: var(--module-accent); font-size: 9px; font-weight: 800; letter-spacing: .1em; }
.desktop-module__preview .desktop-module__prompt { padding: 12px; background: #fff3d9; border-radius: 10px; font-size: .85rem; }
.desktop-module__preview ol { list-style: none; display: grid; gap: 10px; margin: 14px 0 0; padding: 0; }
.desktop-module__preview li { display: flex; align-items: center; gap: 9px; padding: 9px 0; font-size: .84rem; color: var(--module-muted); }
.desktop-module__preview li .q-icon { color: var(--module-accent); font-size: 21px; }
@media (max-width: 760px) {
  .desktop-module__grid,.desktop-module__simulator { grid-template-columns: 1fr; }
  .desktop-module,.desktop-module__simulator { scroll-margin-top: 124px; }
  .desktop-module__simulator .interactive-demo { width: min(100%, 365px); margin: auto; }
}
</style>
