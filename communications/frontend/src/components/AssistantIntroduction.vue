<script setup>
defineProps({ appName: { type: String, required: true }, error: String, canConfigure: { type: Boolean, default: true }, sharedAccount: Boolean })
defineEmits(['configure', 'retry', 'close'])
const abilities = [
  { icon: 'school', title: 'Entende o seu sistema', text: 'Explica canais, campos, regras e configurações do seu painel.' },
  { icon: 'account_tree', title: 'Cria com você', text: 'Prepara fluxogramas, modelos da Meta, sites, campanhas e e-mails.' },
  { icon: 'auto_fix_high', title: 'Executa ações · skills', text: 'Consulta e organiza dados, configura integrações e prepara envios para sua revisão.' },
  { icon: 'attach_file', title: 'Recebe mais que texto', text: 'Analisa prints e arquivos, transcreve áudio e gera materiais para baixar.' },
]
</script>

<template>
  <q-card class="assistant-introduction">
    <q-btn class="assistant-introduction__close" flat round dense icon="close" aria-label="Fechar apresentação" @click="$emit('close')"/>
    <section class="assistant-introduction__hero">
      <div class="assistant-introduction__robot"><img src="/comunicacao/app/ia.gif" alt="Robô Aito I.A"/></div>
      <span class="assistant-introduction__eyebrow">UM ASSISTENTE DENTRO DO SEU PAINEL</span>
      <h2>Conheça a Aito I.A</h2>
      <p>Seu agente para entender, criar e agir no <strong>{{ appName }}</strong>. Conte o que você precisa em uma conversa simples.</p>
    </section>
    <section class="assistant-introduction__abilities" aria-label="O que o agente pode fazer">
      <article v-for="ability in abilities" :key="ability.title"><q-icon :name="ability.icon"/><div><h3>{{ability.title}}</h3><p>{{ability.text}}</p></div></article>
    </section>
    <div class="assistant-introduction__review"><q-icon name="fact_check"/><p><strong>Você acompanha e decide.</strong> Antes de alterar dados ou enviar mensagens, o agente apresenta a ação para sua confirmação. Remoções exigem uma frase de segurança.</p></div>
    <q-banner v-if="error" rounded class="assistant-introduction__error" role="alert">{{error}}<template #action><q-btn flat no-caps dense label="Tentar novamente" @click="$emit('retry')"/></template></q-banner>
    <footer>
      <div class="assistant-introduction__account"><q-icon name="key"/><p>{{canConfigure?'Para começar, conecte uma chave OpenAI sua ou importe uma já cadastrada neste sistema. O uso é cobrado pela OpenAI na conta da chave escolhida.':'A administração precisa configurar a chave OpenAI da instalação antes do seu acesso. O consumo usa a conta da chave configurada; seus dados e ações continuam limitados às permissões do seu perfil.'}}</p></div>
      <q-btn v-if="canConfigure" unelevated no-caps icon="arrow_forward" label="Configurar meu agente" class="assistant-introduction__start" @click="$emit('configure')"/>
      <q-btn v-else unelevated no-caps label="Entendi" class="assistant-introduction__start" @click="$emit('close')"/><small>A conversa só é liberada depois da configuração. Chaves protegidas no servidor; contexto temporário.</small>
    </footer>
  </q-card>
</template>

<style scoped>
.assistant-introduction{position:relative;width:720px;max-width:94vw;max-height:92dvh;overflow:auto;background:var(--aito-background,#fbfffe);color:var(--aito-text,#19352f);border:1px solid var(--aito-line,#d7eae5);border-radius:26px;box-shadow:0 30px 100px #102a2533;font-family:Inter,"Segoe UI",sans-serif}.assistant-introduction__close{position:absolute;right:15px;top:15px;z-index:1;color:var(--aito-muted)}.assistant-introduction__hero{text-align:center;padding:32px 35px 22px;background:radial-gradient(ellipse at 50% 0,var(--aito-tint),transparent 85%)}.assistant-introduction__robot{display:grid;place-items:center;width:84px;height:84px;border-radius:24px;background:linear-gradient(135deg,#13bc9d,#12ad89);margin:0 auto 22px;box-shadow:0 12px 30px #13bc9d22}.assistant-introduction__robot img{width:65px;height:65px;object-fit:contain}.assistant-introduction__eyebrow{font-size:9px;letter-spacing:2px;font-weight:800;color:var(--aito-accent);display:block}.assistant-introduction h2{font-size:30px;line-height:1.25;letter-spacing:-1px;margin:12px 0;font-weight:750}.assistant-introduction__hero p{max-width:520px;margin:0 auto;color:var(--aito-muted);font-size:14px;line-height:1.7}.assistant-introduction__abilities{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 30px 20px}.assistant-introduction__abilities article{padding:16px;display:flex;gap:12px;min-width:0;background:white;border:1px solid var(--aito-line);border-radius:15px}.assistant-introduction__abilities .q-icon{font-size:23px;color:var(--aito-accent);margin-top:2px}.assistant-introduction h3{font-size:13px;font-weight:750;line-height:1.4;margin:0 0 7px}.assistant-introduction__abilities p{font-size:12px;line-height:1.6;color:var(--aito-muted);margin:0}.assistant-introduction__review{margin:0 30px 20px;padding:14px 16px;border-radius:13px;display:flex;gap:12px;background:var(--aito-tint);color:var(--aito-text)}.assistant-introduction__review>.q-icon{font-size:24px;color:var(--aito-accent)}.assistant-introduction__review p{margin:0;font-size:12px;line-height:1.7}.assistant-introduction__review strong{display:block}.assistant-introduction__error{margin:0 30px 15px;background:#fff0ee;color:#8c302a;font-size:12px}.assistant-introduction footer{padding:20px 30px 25px;border-top:1px solid var(--aito-line);display:grid;gap:15px;background:white}.assistant-introduction__account{display:flex;gap:10px;align-items:flex-start}.assistant-introduction__account .q-icon{font-size:21px;color:var(--aito-accent)}.assistant-introduction__account p{font-size:12px;line-height:1.6;color:var(--aito-muted);margin:0}.assistant-introduction__start{background:var(--aito-accent)!important;color:white;padding:12px;font-size:13px;border-radius:12px}.assistant-introduction footer small{font-size:10px;color:var(--aito-muted);line-height:1.6;text-align:center}@media(max-width:599px){.assistant-introduction{max-width:100vw;width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0}.assistant-introduction__hero{padding:28px 22px 20px}.assistant-introduction__robot{width:72px;height:72px;border-radius:21px;margin-bottom:18px}.assistant-introduction__robot img{width:56px;height:56px}.assistant-introduction h2{font-size:27px}.assistant-introduction__hero p{font-size:12px}.assistant-introduction__abilities{padding:0 17px 16px;gap:9px}.assistant-introduction__abilities article{padding:12px;gap:8px;flex-direction:column}.assistant-introduction h3{font-size:12px}.assistant-introduction__abilities p{font-size:11px}.assistant-introduction__review{margin:0 17px 18px;font-size:11px}.assistant-introduction footer{padding:18px 20px calc(22px + env(safe-area-inset-bottom,0px))}.assistant-introduction__eyebrow{font-size:8px;letter-spacing:1.5px}}
</style>
