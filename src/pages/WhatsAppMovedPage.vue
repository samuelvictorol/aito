<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="moved-page flex flex-center">
        <section class="moved-card" aria-labelledby="moved-title">
          <q-icon name="mdi-whatsapp" size="40px" color="teal-4" />
          <p class="moved-eyebrow">ATENDIMENTO WHATSAPP</p>
          <h1 id="moved-title">O atendimento agora está no Notify Flow</h1>
          <p>Conexão por QR Code, conversas, fluxos e monitoramento são gerenciados no Notify Flow.</p>
          <p>Entre com a conta disponibilizada nessa plataforma. Contas, senhas e sessões deste site não são transferidas automaticamente.</p>
          <div class="moved-actions">
            <q-btn unelevated no-caps color="teal-7" label="Abrir atendimento no Notify Flow" icon-right="mdi-open-in-new" href="https://notify-flow.onrender.com/whatsapp-web/atendente" target="_blank" rel="noopener noreferrer" />
            <q-btn flat no-caps label="Voltar ao site" to="/" />
            <q-btn flat no-caps label="Conhecer o BotBuilder" to="/whatsappbotbuilder" />
          </div>
          <small>A compra, os downloads e a gestão de licenças continuam na AitoSoftwares.</small>
        </section>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.moved-page{min-height:100dvh;padding:24px;background:#041b1c;color:#effffb}.moved-card{width:min(100%,660px);padding:clamp(22px,5vw,42px);border:1px solid #2b5855;border-radius:20px;background:#092324}.moved-eyebrow{margin:18px 0 8px;color:#8fffee;letter-spacing:.12em;font-size:11px;font-weight:800}.moved-card h1{margin:0 0 20px;font-size:clamp(25px,5vw,36px);line-height:1.2;font-weight:800}.moved-card p:not(.moved-eyebrow){color:#c2dcd6;font-size:15px;line-height:1.65}.moved-actions{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.moved-actions .q-btn{min-height:44px;white-space:normal}.moved-card small{display:block;color:#a0c0b7;line-height:1.6}@media(max-width:600px){.moved-page{padding:14px}.moved-actions{flex-direction:column}.moved-actions .q-btn{width:100%}}
</style>
