<script setup>
import { computed } from 'vue'

const props = defineProps({ source: Boolean })

const desktop = {
  eyebrow: 'PREPARE SEU COMPUTADOR',
  description: 'Instale o Kit no Windows, ative sua licença e escolha onde guardar os dados da operação.',
  highlights: [
    { icon: 'mdi-microsoft-windows', label: 'SISTEMA COMPATÍVEL', value: 'Windows 10 ou 11', text: 'Instalador .exe para computadores de 64 bits (x64).' },
    { icon: 'mdi-memory', label: 'RECOMENDADO', value: '8 GB de RAM', text: 'Reserve 4 GB livres para o aplicativo, além do espaço para conversas, mídias e backups.' },
    { icon: 'mdi-wifi', label: 'CONECTIVIDADE', value: 'Internet e licença Desktop', text: 'Mantenha o computador ligado e o app em execução para receber mensagens e cumprir os agendamentos.' },
  ],
  setups: [
    { icon: 'mdi-database-check-outline', label: 'Local integrado', tag: 'Padrão', text: 'O instalador inclui banco SQLite, fila e cache locais. Docker é opcional.' },
    { icon: 'mdi-docker', label: 'Modo MongoDB', text: 'O Docker Compose é necessário se o assistente for criar o MongoDB local. Você também pode conectar um MongoDB existente ou na nuvem com TLS. A fila e o cache podem ficar locais ou usar Redis.' },
  ],
}

const whitelabel = {
  eyebrow: 'PREPARE SUA HOSPEDAGEM',
  description: 'Publique o código na sua infraestrutura, com acesso HTTPS e armazenamento persistente.',
  highlights: [
    { icon: 'mdi-docker', label: 'AMBIENTE DA IMAGEM', value: 'Linux x86-64 e Docker', text: 'A imagem inclui a API, o painel e os componentes do aplicativo. O Render faz o build do contêiner na hospedagem.' },
    { icon: 'mdi-server-outline', label: 'CONFIGURAÇÃO INICIAL NO RENDER', value: '1 CPU e 2 GB de RAM', text: 'O Blueprint inclui disco persistente de 1 GB. Ajuste a capacidade conforme o volume de dados e atendimentos.' },
    { icon: 'mdi-database-outline', label: 'BANCO E FILAS', value: 'MongoDB e Redis', text: 'Use o MongoDB no disco persistente ou uma conexão externa com TLS. O Blueprint conecta a fila ao Key Value compatível com Redis.' },
  ],
  setups: [
    { icon: 'mdi-cloud-upload-outline', label: 'Publicar no Render', tag: 'Blueprint incluso', text: 'Extraia o ZIP, publique o código em um repositório e conecte-o ao Blueprint. Após o deploy, abra /cloud/setup no endereço HTTPS da instalação.' },
    { icon: 'mdi-server-network-outline', label: 'Hospedar por conta própria', text: 'Para usar a distribuição em contêiner, prepare um host Linux x86-64 com Docker, um volume persistente, Redis e um endereço HTTPS.' },
  ],
}

const requirements = computed(() => props.source ? whitelabel : desktop)
</script>

<template>
  <section id="requisitos" class="kit-requirements" :class="{ 'kit-requirements--source': source }" aria-labelledby="kit-requirements-title">
    <header class="kit-requirements__heading">
      <span>{{ requirements.eyebrow }}</span>
      <h2 id="kit-requirements-title">Requisitos do sistema</h2>
      <p>{{ requirements.description }}</p>
    </header>
    <ul class="kit-requirements__highlights">
      <li v-for="item in requirements.highlights" :key="item.label">
        <q-icon :name="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <h3>{{ item.value }}</h3>
        <p>{{ item.text }}</p>
      </li>
    </ul>
    <div class="kit-requirements__setups">
      <article v-for="setup in requirements.setups" :key="setup.label">
        <q-icon :name="setup.icon" aria-hidden="true" />
        <div>
          <header><h3>{{ setup.label }}</h3><span v-if="setup.tag">{{ setup.tag }}</span></header>
          <p>{{ setup.text }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.kit-requirements {
  --requirements-accent: #a4f5d8;
  --requirements-text: #bad3c9;
  --requirements-border: #315950;
  --requirements-bg: #0e2825;
  --requirements-tint: #163d35;
  padding: clamp(36px, 5vw, 64px) 0;
  border-top: 1px solid var(--requirements-border);
  scroll-margin-top: 112px;
}
.kit-requirements--source {
  --requirements-accent: #ddc8ff;
  --requirements-text: #c1bcd6;
  --requirements-border: #4b4261;
  --requirements-bg: #1b1d30;
  --requirements-tint: #302647;
}
.kit-requirements__heading { max-width: 44rem; margin-bottom: 22px; }
.kit-requirements__heading > span, .kit-requirements__highlights li > span {
  color: var(--requirements-accent);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .12em;
}
.kit-requirements h2 { margin: 10px 0 12px; font-size: clamp(29px, 4vw, 45px); font-weight: 780; line-height: 1.15; letter-spacing: -.04em; }
.kit-requirements p { margin: 0; color: var(--requirements-text); font-size: .9rem; line-height: 1.65; }
.kit-requirements__highlights, .kit-requirements__setups {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
}
.kit-requirements__highlights { grid-template-columns: repeat(3, minmax(0, 1fr)); list-style: none; }
.kit-requirements__highlights li, .kit-requirements__setups article {
  min-width: 0;
  padding: clamp(16px, 2.4vw, 24px);
  border: 1px solid var(--requirements-border);
  border-radius: 16px;
  background: linear-gradient(140deg, var(--requirements-tint), var(--requirements-bg));
}
.kit-requirements .q-icon { color: var(--requirements-accent); font-size: 26px; }
.kit-requirements__highlights .q-icon { display: block; margin-bottom: 14px; }
.kit-requirements h3 { margin: 5px 0 7px; font-size: clamp(16px, 2vw, 23px); font-weight: 760; line-height: 1.25; letter-spacing: -.015em; }
.kit-requirements__setups { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px; }
.kit-requirements__setups article { display: flex; align-items: flex-start; gap: 13px; background: var(--requirements-bg); }
.kit-requirements__setups header { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 10px; margin-bottom: 6px; }
.kit-requirements__setups h3 { margin: 0; font-size: 1rem; }
.kit-requirements__setups header span { padding: 3px 8px; border: 1px solid var(--requirements-border); border-radius: 99px; color: var(--requirements-accent); font-size: .65rem; font-weight: 700; }
.kit-requirements__setups p { font-size: .83rem; }
@media (max-width: 660px) {
  .kit-requirements__highlights, .kit-requirements__setups { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .kit-requirements__highlights .q-icon { margin-bottom: 8px; }
  .kit-requirements__setups { margin-top: 10px; }
}
</style>
