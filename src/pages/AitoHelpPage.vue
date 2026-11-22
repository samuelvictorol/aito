<script setup>
import { computed, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { helpFaq, helpModelFamilies, helpTopics } from 'src/data/aitoHelp'
import { videoCatalog, videoModelPreview } from 'src/data/aitoiaVideoCatalog'

const $q = useQuasar()
const active = ref('video')
const step = ref(0)
const search = ref('')
const modelSearch = ref('')
const imageOpen = ref(false)
const exampleGoal = ref('Apresentar um produto')
const exampleProduct = ref('meu produto')
const topic = computed(() => helpTopics.find(item => item.id === active.value))
const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const sections = computed(() => topic.value.sections.filter(item => normalized([item.title, item.text, ...item.tips].join(' ')).includes(normalized(search.value))))
const models = computed(() => videoCatalog.filter(item => item.type !== 'image' && normalized(`${item.name} ${item.maker} ${item.summary}`).includes(normalized(modelSearch.value))))
const example = computed(() => {
  const product = exampleProduct.value.trim() || 'meu produto'
  if (active.value === 'chat') return `Ajude a ${exampleGoal.value.toLocaleLowerCase('pt-BR')} sobre ${product}. Público: pequenos negócios. Tom: claro e profissional. Primeiro organize as ideias; depois entregue um texto curto com uma chamada para ação. Se faltar uma informação essencial, pergunte antes.`
  if (active.value === 'marketing') return `Crie uma peça para ${exampleGoal.value.toLocaleLowerCase('pt-BR')}: ${product}. Use fundo claro, cores da marca e destaque visual para o produto. Público: pequenos negócios. Uma mensagem principal, hierarquia legível e espaço seguro nas bordas. Use as referências anexadas e preserve a identidade do produto. Não acrescente dados ou preços que não informei.`
  return `Objetivo: ${exampleGoal.value}. Produto: ${product}. Vídeo vertical, visual consistente e profissional. Cena: o produto em destaque num ambiente claro, câmera se aproxima suavemente, luz difusa, movimento natural. Preserve o produto e a identidade das referências. Sem legendas nem textos inventados. Gere primeiro uma cena curta para validar o estilo.`
})

function selectTopic(id) { active.value = id; step.value = 0; search.value = '' }
async function copyExample() {
  try { await copyToClipboard(example.value); $q.notify({ type: 'positive', position: 'top', message: 'Exemplo copiado. Cole na ferramenta e personalize.' }) }
  catch { $q.notify({ type: 'warning', position: 'top', message: 'Selecione o exemplo e copie o texto.' }) }
}
</script>

<template>
  <div class="aito-help">
    <header class="aito-help__nav"><router-link to="/" class="aito-help__brand"><img src="/aito-logo-restored.png" alt="" width="33" height="33" /><strong>Aito IA <span>/ Ajuda</span></strong></router-link><router-link :to="topic.route" class="aito-help__back"><q-icon :name="topic.icon" /> Abrir {{ topic.label }}<q-icon name="mdi-arrow-top-right" /></router-link></header>
    <main class="aito-help__content">
      <section class="aito-help__hero">
        <span class="aito-help__eyebrow"><q-icon name="mdi-compass-outline" /> Seu próximo projeto começa aqui</span>
        <h1>Do primeiro clique<br />ao resultado <em>pronto.</em></h1>
        <p>Aprenda no seu ritmo. Conheça as ferramentas, escolha o modelo e siga um caminho simples para criar.</p>
        <nav class="aito-help__topics" aria-label="Guias por ferramenta"><button v-for="item in helpTopics" :key="item.id" type="button" :aria-pressed="active === item.id" @click="selectTopic(item.id)"><q-icon :name="item.icon" />{{ item.label }}</button></nav>
      </section>

      <section class="aito-help__walkthrough" aria-labelledby="help-walkthrough">
        <div class="aito-help__section-head"><div><span class="aito-help__eyebrow">01 / Conheça a tela</span><h2 id="help-walkthrough">{{ topic.label }}, passo a passo</h2><p>{{ topic.intro }}</p></div><span class="aito-help__quiet-badge">Sem gerar ou gastar créditos</span></div>
        <div class="aito-help__tour">
          <div class="aito-help__screen">
            <div class="aito-help__browser-bar"><i /><i /><i /><span>aitosoftwares.com{{ topic.route === '/' ? '' : topic.route }}</span><button type="button" @click="imageOpen = true" aria-label="Ampliar print da tela"><q-icon name="mdi-arrow-expand-all" /></button></div>
            <button type="button" class="aito-help__screenshot" @click="imageOpen = true" aria-label="Abrir print da tela em tamanho maior"><img :src="topic.screenshot" :alt="topic.alt" width="1280" height="900" loading="lazy" /><span class="aito-help__spotlight" :class="`aito-help__spotlight--${topic.steps[step].area}`">{{ step + 1 }}</span></button>
            <small>Print da interface. Os exemplos são ilustrativos; os modelos e controles podem evoluir.</small>
          </div>
          <div class="aito-help__tour-steps"><button v-for="(item, index) in topic.steps" :key="item.title" type="button" :aria-pressed="step === index" @click="step = index"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ item.title }}</strong><p>{{ item.text }}</p></div><q-icon v-if="step === index" name="mdi-arrow-left" /></button><router-link :to="topic.route">Experimentar na ferramenta <q-icon name="mdi-arrow-right" /></router-link></div>
        </div>
      </section>

      <section class="aito-help__guides" aria-labelledby="help-guides">
        <div class="aito-help__section-head"><div><span class="aito-help__eyebrow">02 / Entenda cada recurso</span><h2 id="help-guides">Encontre o que você quer fazer</h2></div><label class="aito-help__search"><q-icon name="mdi-magnify" /><input v-model="search" type="search" placeholder="Buscar neste guia" aria-label="Buscar neste guia" /></label></div>
        <div class="aito-help__accordion"><details v-for="(item, index) in sections" :key="`${active}:${item.title}`" :open="Boolean(search) || index === 0"><summary><q-icon :name="item.icon" /><span>{{ item.title }}</span><q-icon name="mdi-chevron-down" /></summary><div><p>{{ item.text }}</p><ul><li v-for="tip in item.tips" :key="tip">{{ tip }}</li></ul></div></details><p v-if="!sections.length" class="aito-help__empty">Nenhum tópico encontrado. Tente “cena”, “arquivo”, “formato” ou uma palavra mais simples.</p></div>
      </section>

      <section class="aito-help__models" aria-labelledby="help-models">
        <div class="aito-help__section-head"><div><span class="aito-help__eyebrow">03 / Escolha com intenção</span><h2 id="help-models">Qual modelo combina com sua tarefa?</h2><p>Use a especialidade como ponto de partida. As opções, os formatos e a disponibilidade reais aparecem na ferramenta.</p></div></div>
        <template v-if="active === 'video'">
          <label class="aito-help__search aito-help__model-search"><q-icon name="mdi-magnify" /><input v-model="modelSearch" type="search" placeholder="Busque modelo, marca ou especialidade" aria-label="Buscar modelos de vídeo" /></label>
          <div class="aito-help__model-grid"><article v-for="model in models" :key="model.id"><img v-if="videoModelPreview(model)" :src="videoModelPreview(model).cover" alt="" width="400" height="224" loading="lazy" /><div><small>{{ model.maker }}</small><h3>{{ model.name }}</h3><p>{{ model.summary }}</p></div></article></div>
          <p v-if="!models.length" class="aito-help__empty">Nenhum modelo corresponde à busca.</p>
        </template>
        <template v-else-if="active === 'chat'"><div class="aito-help__family-grid"><article v-for="family in helpModelFamilies" :key="family.name"><q-icon name="mdi-creation-outline" /><h3>{{ family.name }}</h3><strong>{{ family.task }}</strong><p>{{ family.tip }}</p></article></div><p class="aito-help__model-note">A família é uma orientação inicial, não um limite de uso. Confira o nome completo, os recursos e o esforço disponíveis no seletor do Chat.</p></template>
        <article v-else class="aito-help__marketing-model"><q-icon name="mdi-image-edit-outline" /><div><h3>Geração e edição de imagens OpenAI</h3><p>Use para anúncios, peças de redes sociais, imagens com referências e variações visuais. No marketing, comece pelo formato e pela identidade da marca; para animação e clipes, abra o Estúdio de Vídeo.</p><p>Revise textos, detalhes do produto e elementos de marca na prévia antes de publicar.</p></div></article>
      </section>

      <section class="aito-help__example" aria-labelledby="help-example"><div><span class="aito-help__eyebrow">04 / Saia da página em branco</span><h2 id="help-example">Monte seu primeiro pedido</h2><p>Personalize o exemplo e copie para {{ topic.label }}. Esta prévia não faz uma geração.</p><label>Quero<select v-model="exampleGoal"><option>Apresentar um produto</option><option>Divulgar um serviço</option><option>Explicar uma ideia</option><option>Convidar para um lançamento</option></select></label><label>Sobre<input v-model="exampleProduct" maxlength="140" placeholder="Nome ou descrição do produto" /></label></div><div class="aito-help__example-output"><p>{{ example }}</p><button type="button" @click="copyExample"><q-icon name="mdi-content-copy" /> Copiar exemplo</button></div></section>

      <section class="aito-help__faq" aria-labelledby="help-faq"><span class="aito-help__eyebrow">05 / Quando surgir uma dúvida</span><h2 id="help-faq">Respostas rápidas</h2><div class="aito-help__accordion"><details v-for="item in helpFaq" :key="item.question"><summary><span>{{ item.question }}</span><q-icon name="mdi-plus" /></summary><div><p>{{ item.answer }}</p></div></details></div></section>
      <footer class="aito-help__footer"><div><img src="/aito-logo-restored.png" alt="" width="28" height="28" /><span>Pronto para colocar a ideia em prática?</span></div><router-link :to="topic.route">Abrir {{ topic.label }} <q-icon name="mdi-arrow-right" /></router-link><a href="https://wa.me/5561982637685" target="_blank" rel="noopener noreferrer">Falar com a Aito <q-icon name="mdi-whatsapp" /></a></footer>
    </main>
    <q-dialog v-model="imageOpen"><q-card class="aito-help__image-dialog"><header><strong>{{ topic.label }}</strong><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar print" /></header><img :src="topic.screenshot" :alt="topic.alt" /></q-card></q-dialog>
  </div>
</template>

<style scoped>
.aito-help { min-height: 100dvh; color: #102d28; background: radial-gradient(ellipse at 88% 1%, #c9f5e5 0, transparent 28%), #f7fbf9; font-family: 'Montserrat', sans-serif; }
.aito-help__nav { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 17px max(20px, calc((100vw - 1240px) / 2)); border-bottom: 1px solid #d7e7df; background: #fffffff2; }
.aito-help a { color: inherit; text-decoration: none; }
.aito-help__brand, .aito-help__back { display: flex; align-items: center; gap: 9px; }
.aito-help__brand strong { font-size: 1rem; white-space: nowrap; }
.aito-help__brand strong span { color: #788c84; font-weight: 450; }
.aito-help__back { padding: 9px 12px; border: 1px solid #bed8cc; border-radius: 9px; font-size: .78rem; font-weight: 700; }
.aito-help__content { max-width: 1240px; padding: 0 24px; margin: auto; }
.aito-help__hero { padding: 69px 0 54px; text-align: center; }
.aito-help__eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #157760; font-size: .67rem; font-weight: 750; text-transform: uppercase; letter-spacing: .13em; }
.aito-help__hero h1 { margin: 22px 0 18px; font-size: clamp(2.15rem, 5.3vw, 4.35rem); letter-spacing: -.055em; line-height: 1.09; font-weight: 780; }
.aito-help__hero em { font-style: normal; color: #128365; }
.aito-help__hero > p { max-width: 590px; margin: 0 auto 27px; color: #64796d; font-size: 1rem; line-height: 1.75; }
.aito-help__topics { display: flex; justify-content: center; flex-wrap: wrap; gap: 9px; }
.aito-help button, .aito-help input, .aito-help select { font: inherit; }
.aito-help__topics button { display: flex; align-items: center; gap: 7px; min-height: 45px; padding: 10px 16px; border: 1px solid #cddfd5; border-radius: 12px; color: #426454; background: #fff; font-size: .83rem; cursor: pointer; }
.aito-help__topics button[aria-pressed=true] { border-color: #168568; background: #0e745b; color: white; box-shadow: 0 7px 17px #108b5c1a; }
.aito-help__section-head { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 17px; margin-bottom: 25px; }
.aito-help h2 { margin: 10px 0 9px; font-size: clamp(1.25rem, 3vw, 1.85rem); line-height: 1.3; font-weight: 750; letter-spacing: -.03em; }
.aito-help__section-head p, .aito-help__example > div > p { margin: 0; max-width: 720px; color: #637b6c; font-size: .86rem; line-height: 1.65; }
.aito-help__quiet-badge { padding: 7px 10px; border-radius: 7px; background: #e6f3ec; color: #35785d; font-size: .64rem; white-space: nowrap; }
.aito-help__walkthrough, .aito-help__guides, .aito-help__models, .aito-help__faq { padding-bottom: 63px; scroll-margin-top: 20px; }
.aito-help__tour { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(275px, 1fr); gap: 24px; align-items: start; }
.aito-help__screen { overflow: hidden; border: 1px solid #ccded4; border-radius: 15px; background: white; box-shadow: 0 12px 35px #133d2b0a; }
.aito-help__browser-bar { display: flex; align-items: center; gap: 5px; height: 35px; padding: 0 11px; border-bottom: 1px solid #dae8e0; background: #eff5f1; }
.aito-help__browser-bar i { width: 6px; height: 6px; border-radius: 50%; background: #c3d7c9; }
.aito-help__browser-bar i:first-child { background: #c88a7d; }
.aito-help__browser-bar span { flex: 1; text-align: center; font-size: .55rem; color: #799082; }
.aito-help__browser-bar button { border: 0; background: none; color: #4e7460; cursor: pointer; }
.aito-help__screenshot { position: relative; display: block; width: 100%; border: 0; padding: 0; background: #f6fbf8; cursor: zoom-in; }
.aito-help__screenshot img { display: block; width: 100%; height: auto; }
.aito-help__spotlight { position: absolute; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; color: #fff; background: #087f60; font-size: .9rem; font-weight: 800; box-shadow: 0 0 0 7px #7ef3c853, 0 0 0 13px #7ef3c81f; transition: top .25s, left .25s; }
.aito-help__spotlight--top { top: 15%; left: 47%; }.aito-help__spotlight--bottom { top: 78%; left: 53%; }.aito-help__spotlight--center { top: 44%; left: 51%; }.aito-help__spotlight--left { top: 44%; left: 12%; }
.aito-help__screen > small { display: block; padding: 9px 12px; border-top: 1px solid #e1ece5; color: #7a8a80; font-size: .58rem; line-height: 1.6; }
.aito-help__tour-steps { display: grid; gap: 10px; }
.aito-help__tour-steps button { display: flex; align-items: start; gap: 12px; padding: 17px 15px; border: 1px solid #d8e4dc; border-radius: 12px; background: transparent; color: #406452; text-align: left; cursor: pointer; }
.aito-help__tour-steps button > span { flex: 0 0 28px; display: grid; place-items: center; height: 28px; border: 1px solid #c8dbce; border-radius: 8px; color: #408169; font-size: .72rem; font-weight: 700; }
.aito-help__tour-steps button[aria-pressed=true] { color: #144833; background: #e6f5ed; border-color: #8dc6ab; }
.aito-help__tour-steps button[aria-pressed=true] > span { background: #127f60; color: #fff; border-color: #127f60; }
.aito-help__tour-steps strong { font-size: .86rem; }.aito-help__tour-steps p { margin: 7px 0 0; color: #688071; font-size: .75rem; line-height: 1.7; }.aito-help__tour-steps button > .q-icon { color: #1f9674; }
.aito-help__tour-steps > a { display: inline-flex; align-items: center; gap: 9px; padding: 10px 4px; color: #167858; font-size: .8rem; font-weight: 700; }
.aito-help__search { display: flex; align-items: center; gap: 8px; min-width: 245px; padding: 11px 13px; border: 1px solid #cddfd4; border-radius: 11px; background: #fff; color: #638370; }
.aito-help__search input { width: 100%; border: 0; outline: none; min-width: 0; color: #234f3a; background: transparent; font-size: .8rem; }
.aito-help__accordion { overflow: hidden; border: 1px solid #d6e4db; border-radius: 15px; background: white; }
.aito-help__accordion details + details { border-top: 1px solid #e2ece6; }
.aito-help__accordion summary { display: flex; align-items: center; gap: 12px; padding: 21px 22px; list-style: none; cursor: pointer; color: #254c39; font-size: .89rem; font-weight: 700; }
.aito-help__accordion summary::-webkit-details-marker { display: none; }.aito-help__accordion summary > span { flex: 1; }.aito-help__accordion summary > .q-icon:first-child { color: #279473; font-size: 22px; }.aito-help__accordion summary > .q-icon:last-child { color: #75a28b; }
.aito-help__accordion details[open] { background: #fbfefb; }.aito-help__accordion details[open] summary { padding-bottom: 10px; }.aito-help__accordion details[open] summary > .q-icon:last-child { transform: rotate(180deg); }
.aito-help__accordion details > div { padding: 0 24px 23px 56px; color: #617466; font-size: .83rem; line-height: 1.9; }.aito-help__accordion p { margin: 0; }.aito-help__accordion ul { padding-left: 18px; margin: 13px 0 0; }.aito-help__accordion li + li { margin-top: 5px; }
.aito-help__model-search { max-width: 410px; margin-bottom: 18px; }.aito-help__model-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.aito-help__model-grid article { min-width: 0; overflow: hidden; border: 1px solid #d2e2d7; border-radius: 13px; background: white; }.aito-help__model-grid img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }.aito-help__model-grid article > div { padding: 15px; }.aito-help__model-grid small { font-size: .62rem; color: #649077; }.aito-help__model-grid h3 { margin: 5px 0 7px; font-size: .84rem; line-height: 1.4; font-weight: 750; }.aito-help__model-grid p { margin: 0; color: #708073; font-size: .72rem; line-height: 1.7; }
.aito-help__family-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; }.aito-help__family-grid article { padding: 24px; border: 1px solid #d3e4d7; border-radius: 15px; background: #fff; }.aito-help__family-grid article > .q-icon { color: #369f77; font-size: 25px; }.aito-help__family-grid h3 { margin: 14px 0 9px; font-size: 1.05rem; font-weight: 750; }.aito-help__family-grid strong { font-size: .78rem; line-height: 1.7; display: block; font-weight: 600; }.aito-help__family-grid p { margin: 13px 0 0; color: #6c7e70; font-size: .74rem; line-height: 1.75; }
.aito-help__model-note { margin-top: 18px; color: #738375; font-size: .76rem; line-height: 1.7; }.aito-help__marketing-model { display: flex; gap: 18px; border: 1px solid #d4e4d8; border-radius: 15px; padding: 28px; background: #fff; }.aito-help__marketing-model > .q-icon { color: #1b9a70; font-size: 40px; }.aito-help__marketing-model h3 { margin: 0 0 10px; font-size: 1rem; font-weight: 750; }.aito-help__marketing-model p { color: #687e6d; line-height: 1.85; font-size: .83rem; }
.aito-help__example { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 35px; padding: 32px; margin-bottom: 63px; border-radius: 21px; border: 1px solid #c7e3d1; background: linear-gradient(120deg, #e2f5e9, #f8fff9); }.aito-help__example label { display: grid; gap: 7px; margin-top: 15px; color: #42694e; font-size: .72rem; }.aito-help__example input, .aito-help__example select { width: 100%; min-width: 0; padding: 10px; border: 1px solid #bcd8c3; border-radius: 8px; color: #315c3d; background: #fff; font-size: .79rem; }.aito-help__example-output { display: flex; flex-direction: column; gap: 16px; padding: 23px; border: 1px solid #d6e6d8; border-radius: 13px; background: #fff; }.aito-help__example-output p { flex: 1; font-size: .85rem; line-height: 1.9; color: #45634b; white-space: pre-wrap; }.aito-help__example-output button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 43px; padding: 10px; border: 0; border-radius: 9px; background: #147854; color: white; cursor: pointer; font-size: .8rem; font-weight: 700; }
.aito-help__empty { padding: 20px; color: #6c8371; font-size: .85rem; }.aito-help__faq h2 { margin-bottom: 23px; }
.aito-help__footer { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; padding: 28px 0 38px; border-top: 1px solid #d4e4d9; color: #53735e; font-size: .76rem; }.aito-help__footer > div { display: flex; align-items: center; gap: 10px; flex: 1 1 320px; }.aito-help__footer > a { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #187552; }
.aito-help__image-dialog { width: min(1400px, 95vw); max-width: 95vw !important; max-height: 95dvh; overflow: auto; color: #214f37; background: #fff; }.aito-help__image-dialog header { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; position: sticky; top: 0; background: white; }.aito-help__image-dialog > img { width: 100%; height: auto; display: block; }
.aito-help button:focus-visible, .aito-help a:focus-visible, .aito-help summary:focus-visible, .aito-help label:focus-within { outline: 3px solid #159574; outline-offset: 3px; }
@media (max-width: 960px) { .aito-help__model-grid, .aito-help__family-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.aito-help__tour { grid-template-columns: 1fr; }.aito-help__tour-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.aito-help__tour-steps button { flex-direction: column; }.aito-help__tour-steps button > .q-icon { display: none; }.aito-help__tour-steps button > span { flex-basis: auto; width: 28px; }.aito-help__tour-steps > a { grid-column: 1/-1; } }
@media (max-width: 640px) { .aito-help__nav { padding: 13px 16px; }.aito-help__brand strong { font-size: .83rem; }.aito-help__back { font-size: 0; padding: 10px; }.aito-help__back .q-icon { font-size: 18px; }.aito-help__back > .q-icon:last-child { display: none; }.aito-help__content { padding: 0 17px; }.aito-help__hero { padding: 47px 0 42px; }.aito-help__hero > p { font-size: .85rem; }.aito-help__topics { gap: 7px; }.aito-help__topics button { padding: 9px 11px; font-size: .7rem; }.aito-help__tour-steps { grid-template-columns: 1fr; }.aito-help__tour-steps button { flex-direction: row; }.aito-help__tour-steps button > span { flex: 0 0 28px; }.aito-help__walkthrough, .aito-help__guides, .aito-help__models, .aito-help__faq { padding-bottom: 43px; }.aito-help__section-head { gap: 13px; }.aito-help__search { width: 100%; min-width: 0; }.aito-help__model-grid, .aito-help__family-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }.aito-help__model-grid article > div { padding: 11px; }.aito-help__model-grid h3 { font-size: .77rem; }.aito-help__family-grid article { padding: 17px; }.aito-help__accordion summary { padding: 18px 14px; font-size: .8rem; gap: 9px; }.aito-help__accordion details > div { padding: 0 17px 20px; font-size: .78rem; }.aito-help__example { grid-template-columns: 1fr; gap: 20px; padding: 21px; margin-bottom: 43px; }.aito-help__example-output { padding: 16px; }.aito-help__marketing-model { gap: 12px; padding: 20px; }.aito-help__marketing-model > .q-icon { font-size: 25px; }.aito-help__spotlight { width: 25px; height: 25px; font-size: .72rem; }.aito-help__footer { gap: 17px; } }
@media (prefers-reduced-motion: reduce) { .aito-help__spotlight { transition: none; } }
</style>
