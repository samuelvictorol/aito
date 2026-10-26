<script setup>
import { ref, watch } from 'vue'
const props = defineProps({ image: String })
const imageFailed = ref(false)
watch(() => props.image, () => { imageFailed.value = false })
const people = [
  { name: 'Júlia', initials: 'JU', area: 'Comercial', status: 'Atendendo Ana', icon: 'mdi-laptop' },
  { name: 'Rafael', initials: 'RA', area: 'Suporte', status: 'Atendendo Pedro', icon: 'mdi-monitor' },
  { name: 'Bianca', initials: 'BI', area: 'Relacionamento', status: 'Atendendo Luiza', icon: 'mdi-cellphone' },
]
const benefits = [
  { icon: 'mdi-account-key-outline', title: 'Um login para cada pessoa', text: 'Credenciais individuais para sua equipe. Cada acesso tem nome, identificação e controle pelo administrador.' },
  { icon: 'mdi-message-badge-outline', title: 'O cliente sabe quem está falando', text: 'Assinaturas opcionais nas respostas e identificação de quem assumiu cada atendimento.' },
  { icon: 'mdi-account-switch-outline', title: 'Passe a conversa, preserve o contexto', text: 'Assuma, transfira, envie para a triagem ou finalize. O histórico acompanha o atendimento.' },
  { icon: 'mdi-robot-outline', title: 'Bot, IA e equipe no mesmo lugar', text: 'O fluxo acolhe, a IA apoia e sua equipe assume a conversa quando a experiência pede uma pessoa.' },
]
</script>

<template>
  <section id="equipe" class="kit-team" aria-labelledby="kit-team-title">
    <div class="team-intro">
      <span class="eyebrow">VÁRIOS ACESSOS. UM WHATSAPP COMPARTILHADO.</span>
      <h2 id="kit-team-title">Um QR Code.<br/><em>Uma equipe inteira atendendo.</em></h2>
      <p>Seu WhatsApp não precisa ficar na mão de uma pessoa só. Abra o painel em vários computadores e celulares, com <strong>login próprio e identificação para cada colaborador.</strong></p>
      <p>Conecte a sessão uma vez no servidor. Depois, cada atendente acessa seu espaço pelo navegador, sem repetir o pareamento por QR Code em cada estação.</p>
      <a class="team-cta" href="#planos">Leve o kit AitoNotify + WhatsApp BotBuilder <q-icon name="mdi-arrow-right"/></a>
    </div>
    <div class="team-visual">
      <img v-if="image && !imageFailed" class="team-print" :src="image" loading="lazy" alt="Painel de atendimento compartilhado do kit AitoNotify + WhatsApp BotBuilder" @error="imageFailed = true"/>
      <div v-else class="team-demo" aria-label="Exemplo ilustrativo de uma sessão com três atendentes identificados">
        <div class="team-demo__bar"><span class="team-live"/> Uma conexão. Vários pontos de atendimento.</div>
        <div class="team-session"><div class="team-session__icon"><q-icon name="mdi-whatsapp"/></div><div><strong>WhatsApp da sua empresa</strong><span>Sessão conectada no servidor</span></div><q-icon name="mdi-shield-check-outline" color="teal-3"/></div>
        <div class="team-connector" aria-hidden="true"><span/><span/><span/></div>
        <div class="team-seats"><article v-for="person in people" :key="person.name"><q-icon :name="person.icon" class="seat-device"/><div class="seat-avatar">{{ person.initials }}</div><strong>{{ person.name }}</strong><span>{{ person.area }}</span><small>{{ person.status }}</small><div class="seat-signature">{{ person.name }}:<br/><span>Vou continuar seu atendimento.</span></div></article></div>
        <small class="team-demo__caption">Demonstração ilustrativa com pessoas e conversas fictícias.</small>
      </div>
      <div class="team-scale"><q-icon name="mdi-account-multiple-plus-outline"/><p><strong>Expanda os acessos, sem refazer a conexão.</strong><br/>Adicione colaboradores conforme sua operação cresce. Dimensione os acessos simultâneos de acordo com sua infraestrutura e plano.</p></div>
    </div>
    <div class="team-benefits"><article v-for="item in benefits" :key="item.title"><q-icon :name="item.icon"/><h3>{{ item.title }}</h3><p>{{ item.text }}</p></article></div>
  </section>
</template>

<style scoped>
.kit-team{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);align-items:center;gap:44px;padding:80px 0;border-top:1px solid #28554a;scroll-margin-top:24px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#8fe6ca}.team-intro h2{font-size:clamp(34px,4.2vw,56px);line-height:1.1;letter-spacing:-.04em;margin:20px 0 26px}.team-intro em{font-style:normal;color:#7be7c8}.team-intro p{color:#b4cec4;font-size:15px;line-height:1.85}.team-intro strong{color:#e6fff5;font-weight:600}.team-cta{display:inline-flex;align-items:center;gap:10px;color:#9af4d8;font-size:13px;text-decoration:none;font-weight:700;margin-top:16px;line-height:1.6}.team-cta:focus-visible{outline:2px solid #8fe6ca;outline-offset:5px}.team-visual{min-width:0}.team-demo{padding:22px;border:1px solid #327364;border-radius:22px;background:radial-gradient(ellipse at top,#16514480,transparent 70%),#091f24;box-shadow:0 25px 65px #0004}.team-demo__bar{display:flex;align-items:center;gap:8px;color:#a7c9bc;font-size:10px;line-height:1.5;margin-bottom:24px}.team-live{width:7px;height:7px;border-radius:50%;background:#69e8bb;box-shadow:0 0 14px #69e8bb70;flex-shrink:0}.team-session{display:flex;align-items:center;gap:12px;border:1px solid #459e82;background:#0f3c32;border-radius:14px;padding:18px;max-width:350px;margin:auto}.team-session__icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#8fffe21a;color:#8fffe2;font-size:27px;flex-shrink:0}.team-session>div:nth-child(2){flex:1;min-width:0}.team-session strong{display:block;color:#eafff7;font-size:13px;line-height:1.4}.team-session span{display:block;color:#97bcac;font-size:10px;margin-top:4px}.team-connector{display:flex;justify-content:space-around;height:30px;position:relative;margin:0 15%}.team-connector:before{content:'';position:absolute;top:14px;left:16.66%;right:16.66%;height:1px;background:#367e68}.team-connector span{width:1px;background:#367e68;height:16px;align-self:end}.team-connector span:nth-child(2){height:30px}.team-seats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.team-seats article{min-width:0;text-align:center;padding:14px 8px 9px;border:1px solid #365d55;background:#0b2728;border-radius:14px}.seat-device{font-size:22px;color:#7cbaa4;display:block;margin:0 auto 12px}.seat-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#224f44;color:#a8f4da;font-size:11px;font-weight:800;margin:0 auto 10px}.team-seats strong{display:block;font-size:13px;color:#e8fff6}.team-seats article>span{display:block;font-size:9px;color:#8fb7a6;margin:4px 0 10px}.team-seats small{display:block;padding:6px 3px;background:#57cfaa15;border-radius:6px;color:#91dfc3;font-size:8px;line-height:1.4}.seat-signature{text-align:left;margin-top:12px;padding:9px 6px;background:#152f2b;border-radius:6px;font-size:9px;color:#cdf5e4;font-weight:700;line-height:1.6}.seat-signature>span{color:#8bb8a3;font-weight:400}.team-demo__caption{display:block;margin-top:16px;font-size:9px;color:#73998c;line-height:1.6}.team-print{width:100%;display:block;border:6px solid #28463e;border-radius:20px;box-shadow:0 25px 65px #0004}.team-scale{display:flex;align-items:center;gap:14px;margin:18px 0 0;padding:16px 18px;border:1px solid #2a5148;border-radius:14px;background:#10372c50}.team-scale>.q-icon{font-size:30px;color:#79d8b6}.team-scale p{font-size:11px;line-height:1.8;color:#8fb6a5;margin:0}.team-scale strong{color:#c9eedc}.team-benefits{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.team-benefits article{padding:24px 20px;border:1px solid #274c43;border-radius:18px;background:#092225}.team-benefits .q-icon{font-size:28px;color:#81dec0}.team-benefits h3{font-size:18px;line-height:1.4;margin:18px 0 12px;color:#effff8}.team-benefits p{font-size:12px;line-height:1.8;color:#a9c9b9;margin:0}@media(max-width:1000px){.kit-team{grid-template-columns:1fr;gap:28px}.team-visual{width:min(650px,100%);margin:auto}.team-benefits{grid-template-columns:1fr 1fr}}@media(max-width:600px){.kit-team{padding:48px 0}.team-intro h2{font-size:38px}.team-intro p{font-size:14px}.team-demo{padding:16px 12px}.team-session{padding:14px 10px}.team-session strong{font-size:12px}.team-seats{gap:6px}.team-seats article{padding:12px 5px 7px}.team-seats strong{font-size:12px}.team-seats article>span{font-size:8px}.team-seats small{font-size:8px;min-height:34px;display:grid;place-items:center}.seat-signature{padding:8px 5px;font-size:8px}.team-benefits{gap:12px}.team-benefits article{padding:20px 15px}.team-benefits h3{font-size:16px}.team-benefits p{font-size:11px}.team-scale{padding:14px 12px}}
</style>
