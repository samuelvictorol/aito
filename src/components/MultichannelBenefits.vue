<script setup>
defineProps({ source: Boolean })
const channels = [
  { icon: 'mdi-whatsapp', name: 'WhatsApp oficial', label: 'AVISOS COM AGILIDADE', text: 'Atualizações de pedidos, confirmações e lembretes com modelos aprovados pela Meta.', tone: 'whatsapp' },
  { icon: 'mdi-gmail', name: 'Gmail / e-mail', label: 'CONTEÚDO COM ESPAÇO', text: 'Envie comunicados completos, campanhas em HTML e acompanhamentos por e-mail.', tone: 'email' },
  { logo: '/brands/telegram.svg', name: 'Telegram', label: 'MAIS UM CANAL DE RELAÇÃO', text: 'Compartilhe novidades e avisos com os contatos e grupos autorizados da sua operação.', tone: 'telegram' },
]
</script>

<template>
  <section class="channel-benefits" aria-label="WhatsApp, Gmail e Telegram no mesmo produto">
    <header><span class="channel-benefits__eyebrow">ALÉM DO WHATSAPP</span><h2>Seu público também está<br/><em>no e-mail e no Telegram.</em></h2><p>{{source ? 'A base de código já reúne os três canais. Personalize templates e integre os avisos aos sistemas da sua operação.' : 'Uma compra, mais caminhos para se comunicar. Prepare a campanha e escolha o conteúdo adequado para cada canal.'}}</p></header>
    <div class="channel-benefits__grid"><article v-for="channel in channels" :key="channel.tone" :class="'channel-benefits__card--'+channel.tone"><img v-if="channel.logo" :src="channel.logo" alt="" width="31" height="31" loading="lazy" class="channel-benefits__logo"/><q-icon v-else :name="channel.icon" aria-hidden="true"/><small>{{channel.label}}</small><h3>{{channel.name}}</h3><p>{{channel.text}}</p></article></div>
    <small class="channel-benefits__note">Configure suas contas no painel e comunique-se com contatos autorizados. Contas, limites de envio, tarifas dos provedores e créditos de IA seguem as condições de cada serviço.</small>
  </section>
</template>

<style scoped>
.channel-benefits{padding:52px 0 60px;border-top:1px solid #4c756540;color:#e8fff5}.channel-benefits>header{max-width:730px;margin-bottom:28px}.channel-benefits__eyebrow{font-size:10px;font-weight:800;letter-spacing:.13em;color:#9de5ce}.channel-benefits h2{font-size:clamp(29px,4vw,44px);line-height:1.16;letter-spacing:-.035em;margin:16px 0 19px}.channel-benefits h2 em{color:#8ae8cc;font-style:normal}.channel-benefits p{font-size:14px!important;line-height:1.85!important;color:#bfd4ca!important;margin:0}.channel-benefits__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.channel-benefits__grid>article{display:flex;flex-direction:column;align-items:flex-start;border:1px solid #436e5b;border-radius:20px;padding:25px;background:linear-gradient(140deg,#173f333d,#0b171b)}.channel-benefits__grid .q-icon{font-size:31px;color:#97f0c8;margin-bottom:19px}.channel-benefits__grid small{font-size:9px;font-weight:700;letter-spacing:.09em;color:#b2c9bf}.channel-benefits h3{font-size:23px;line-height:1.25;margin:12px 0 15px}.channel-benefits__grid p{font-size:12px!important}.channel-benefits__grid .channel-benefits__card--email{border-color:#8b5f6559;background:linear-gradient(140deg,#75303b25,#13181e)}.channel-benefits__card--email .q-icon{color:#ffbbc4}.channel-benefits__grid .channel-benefits__card--telegram{border-color:#5384ac65;background:linear-gradient(140deg,#1f649d25,#0b171f)}.channel-benefits__card--telegram .q-icon{color:#9bdcff}.channel-benefits__note{display:block;font-size:10px;line-height:1.85;color:#92b0a2;margin-top:20px;max-width:850px}@media(max-width:650px){.channel-benefits{padding:38px 0 44px}.channel-benefits__grid{grid-template-columns:1fr;gap:12px}.channel-benefits__grid>article{padding:23px}.channel-benefits__grid .q-icon{margin-bottom:14px}.channel-benefits h2{font-size:31px}}
.channel-benefits__logo { margin-bottom: 19px; }
@media (max-width: 650px) { .channel-benefits__logo { margin-bottom: 14px; } }
</style>
