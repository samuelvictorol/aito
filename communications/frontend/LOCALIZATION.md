# Idiomas do produto

Português (`pt-BR`, padrão), inglês (`en-US`) e espanhol (`es`). O seletor usa o ícone de tradução no cabeçalho, nos atendimentos móveis e nas páginas públicas. A preferência fica em `notify.locale`; trocar o idioma recarrega a interface sem alterar o conteúdo salvo pelo cliente.

Os catálogos `src/i18n/en.json` e `es.json` são locais e carregados apenas quando o idioma é utilizado. Vue I18n mantém o idioma reativo e os pacotes do Quasar traduzem os controles. Datas e números seguem o idioma; a moeda de uma transação permanece a definida pelo pagamento.

O plugin de compilação em `build/localization-plugin.mjs` aplica os catálogos à cópia estática dos componentes e serviços. Preserva rotas, IDs, canais, modelos, permissões, valores de campos, regras de comparação, comandos e frases de confirmação. Não aplica tradução a contatos, mensagens ou fluxos armazenados. Novos textos devem ter entrada nos dois catálogos, mantendo exatamente marcadores como `{{nome}}`, `{command}` e `{0}`.

O primeiro passo dos assistentes Desktop e Cloud escolhe a língua. A instalação salva `locale` no cofre e o processo recebe `APP_LOCALE`; o idioma inicial também está disponível em `/api/health/locale`, sem retornar credenciais. Novos exemplos e mensagens padrão usam essa preferência. O catálogo do instalador é um subconjunto dos textos do produto, distribuído localmente.

O agente recebe o idioma escolhido pelo cabeçalho `Accept-Language`. Ele deve responder e gerar novos exemplos nesse idioma sem traduzir caminhos de operações, variáveis ou confirmações de segurança.

Validação: testes de paridade dos catálogos, preservação de variáveis, persistência, compilação segura e exemplos de backend; navegação e onboarding em desktop e mobile nos três idiomas. A tradução não muda moedas, limites dos provedores ou regras de autorização.
