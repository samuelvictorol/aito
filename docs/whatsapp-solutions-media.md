# Capturas da landing de soluções para WhatsApp

As imagens públicas ficam em `public/whatsapp-solutions/`, com mapeamento editável em `src/data/whatsappSolutionsMedia.js`. O monitor do primeiro bloco continua reservado ao vídeo configurado na oferta.

| Anexo | Arquivo | Uso |
| --- | --- | --- |
| 1 | central-canais.webp | Visão geral da central |
| 2 | revisao-envio.webp | Revisão multicanal antes da fila |
| 3 | status-entregas.webp | Resultados por contato e canal |
| 4 | canais-mobile.webp | Portal de canais no celular |
| 5 | assistente-mobile.webp | Assistente IA no celular |
| 6 e 8 | atendimento-web.webp | Atendimento em equipe e demonstração do BotBuilder |
| 7 | whatsapp-oficial.webp | Conversas na Cloud API |
| 9 | templates-canais.webp | Biblioteca e conjuntos de templates |

Os anexos 6 e 8 são idênticos; a mesma cópia anonimizada é apresentada em dois contextos. Nenhuma captura original com dados pessoais foi copiada para a pasta pública. Conversão para WebP sem perda e sem metadados EXIF.

## Edições e prompts

Modo: ferramenta integrada imagegen, três edições separadas. Os demais anexos foram mantidos, apenas convertidos para WebP.

Instrução comum: `Use case: text-localization. Edit target: a captura de tela anexada. Prepare uma cópia anonimizada para a landing comercial. Preserve rigorosamente a interface, layout, menus, títulos, cores, ícones, mensagens de exemplo, estado das entregas e a proporção da captura. Altere SOMENTE os dados descritos, cobrindo completamente os dados antigos com áreas opacas antes de inserir os substitutos. Não crie moldura de dispositivo, não acrescente elementos, não recorte o conteúdo. Texto pequeno nítido e legível. Salve uma única imagem final.`

1. Status: `Na coluna Contato substitua TODAS as ocorrências de nomes próprios por 'Contato de exemplo' e todos os identificadores alfanuméricos longos abaixo dos nomes por 'ID oculto'. Não deixe nomes ou IDs originais legíveis.`
2. WhatsApp Web: `Substitua o e-mail da assinatura por 'contato@exemplo.com', os nomes de contatos por 'Cliente exemplo' e todos os números telefônicos por '+55 (00) 00000-0000'. Substitua as duas fotos circulares pessoais pelo mesmo avatar abstrato neutro com iniciais CE. Não deixe nenhum telefone, e-mail ou nome pessoal original legível. Preserve a marca pública AitoSoftwares.`
3. Cloud: `Substitua TODOS os telefones e números de contato por '+55 (00) 00000-0000'; Phone Number ID e WhatsApp Business Account ID por 'ID oculto'; nomes pessoais em cabeçalho e lista por 'Cliente exemplo'; iniciais pessoais por CE e fotografias pessoais circulares por avatar neutro CE. Não deixe nenhum nome pessoal, foto pessoal, telefone, número de conta ou identificador original legível. Preserve a marca pública AitoSoftwares e NotifyFlow.`

As três saídas foram inspecionadas visualmente para confirmar a anonimização antes de serem integradas. São adaptações para demonstração, não registros operacionais em tempo real.
