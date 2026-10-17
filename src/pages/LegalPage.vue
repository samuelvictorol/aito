<template>
  <q-layout view="lHh Lpr lFf" class="legal-page">
    <q-page-container><q-page class="legal-page__page"><main class="legal-page__shell">
      <header class="legal-page__header"><router-link to="/" class="legal-page__brand"><img src="/aito-logo-restored.png" alt="" /> AITO<span>SOFTWARES</span></router-link><router-link to="/" class="legal-page__back"><q-icon name="mdi-arrow-left" /> Voltar</router-link></header>
      <article class="legal-page__article"><p class="legal-page__eyebrow">AitoSoftwares / {{ type === 'privacy' ? 'LGPD' : 'Termos' }}</p><h1>{{ policy.title }}</h1><p class="legal-page__updated">Versao {{ policy.version || '1.0' }}</p><div class="legal-page__content">{{ policy.content }}</div><p class="legal-page__contact">Para solicitar acesso, correcao ou exclusao de dados, fale com a AitoSoftwares pelo canal oficial de atendimento.</p></article>
    </main></q-page></q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ type: { type: String, default: 'privacy' } })
const fallbackContent = props.type === 'privacy'
  ? 'A AitoSoftwares respeita a privacidade e trata dados pessoais com transparencia, finalidade, necessidade e seguranca, em conformidade com a LGPD. Podemos utilizar nome, e-mail, telefone, dados de acesso, informacoes de projetos, chamados, contratos, preferencias e interacoes para autenticar contas, prestar servicos, acompanhar projetos, disponibilizar cursos, responder solicitacoes, enviar comunicacoes autorizadas, prevenir abusos e cumprir obrigacoes legais. Nao vendemos dados pessoais. O compartilhamento ocorre apenas quando necessario para operar a plataforma, cumprir a lei ou proteger direitos. Voce pode solicitar confirmacao, acesso, correcao, atualizacao, portabilidade, informacoes sobre compartilhamentos, oposicao ou eliminacao, respeitados os limites legais. Fale com a AitoSoftwares pelo canal oficial de atendimento usando o e-mail da sua conta.'
  : 'A AitoSoftwares oferece software sob medida, automacoes, experiencias digitais, ambientes de acompanhamento e cursos de desenvolvimento. Ao utilizar nossos canais e produtos, voce concorda em fornecer informacoes verdadeiras, proteger suas credenciais e usar o aplicativo de forma licita, respeitosa e segura. Projetos, cursos, materiais e acessos sao disponibilizados conforme o escopo ou a oferta contratada e nao devem ser redistribuidos sem autorizacao. Trabalhamos para manter os servicos disponiveis, seguros e em evolucao continua, mas podem ocorrer manutencoes, atualizacoes e indisponibilidades pontuais. Marcas, interfaces, textos, modelos e codigo pertencem a AitoSoftwares ou aos respectivos licenciadores, salvo disposicao contratual diferente. O tratamento de dados segue nossa Politica de Privacidade. Podemos suspender acessos em caso de risco, fraude, violacao dos termos ou exigencia legal. A versao vigente estara disponivel nesta pagina e podera ser atualizada para acompanhar a evolucao do servico.'
const policy = reactive({ title: props.type === 'privacy' ? 'Politica de Privacidade AitoSoftwares' : 'Termos de Servico AitoSoftwares', content: fallbackContent, version: '2.0' })

onMounted(async () => {
  try { Object.assign(policy, (await api.get(`/legal/${props.type}`)).data.data) } catch (error) { policy.content = fallbackContent }
})
</script>

<style scoped>
.legal-page { color:#effffb; background:#03090b; }.legal-page__page { min-height:100vh; background:radial-gradient(circle at 50% 10%,rgba(19,188,157,.14),transparent 30rem),#03090b; }.legal-page__shell { width:min(900px,calc(100% - 2rem)); margin:auto; }.legal-page__header { display:flex; justify-content:space-between; align-items:center; padding:1rem 0; border-bottom:1px solid rgba(19,188,157,.2); }.legal-page__brand,.legal-page__back { display:inline-flex; align-items:center; gap:.5rem; color:#effffb; font-size:.76rem; font-weight:800; text-decoration:none; }.legal-page__brand img { width:32px; height:32px; }.legal-page__brand span { color:#13bc9d; }.legal-page__article { padding:14vh 0; }.legal-page__eyebrow { color:#8fffee; font-size:.7rem; font-weight:900; letter-spacing:.15em; text-transform:uppercase; }.legal-page h1 { max-width:16ch; margin:.8rem 0; font-size:clamp(2.2rem,6vw,4.8rem); line-height:1; background:linear-gradient(135deg,#effffb,#8fffee,#13bc9d); background-clip:text; -webkit-background-clip:text; color:transparent; }.legal-page__updated,.legal-page__contact { color:rgba(229,255,250,.58); font-size:.78rem; }.legal-page__content { margin-top:2rem; padding:1.4rem; border-left:2px solid #13bc9d; color:rgba(239,255,251,.82); line-height:1.8; white-space:pre-line; background:rgba(3,25,26,.52); }.legal-page__contact { margin-top:1.5rem; }
</style>
