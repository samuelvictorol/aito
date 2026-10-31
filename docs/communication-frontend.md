# Central de comunicação incorporada

O snapshot do frontend NotifyFlow foi copiado para `communications/frontend`.
Ele é compilado separadamente e exibido em um iframe da mesma origem, preservando
as telas e isolando as versões e os estilos do Quasar das páginas comerciais.
Nenhum `.env`, credencial, `node_modules` ou artefato de build do projeto original
faz parte dessa cópia.

## Rotas

- `/admin/comunicacao`: central administrativa, protegida pelo login Aito.
- `/admin/comunicacao/sistema`: configuração protegida do serviço e revisão de `.env`.
- `/whatsapp-solucoes/teste-gratis`: demonstração pública, com dados fictícios.
- `/comunicacao/app/*`: SPA completa, incluindo colaboradores, convites, catálogo,
  perfil de contato, sites de notificações e app de atendimento.
- As rotas públicas antigas no novo domínio redirecionam para a SPA incorporada.
- `/comunicacao/api/*` e os dois caminhos de socket são repassados pelo Nginx à API.

## Sessão

O iframe avisa o host por `postMessage`. O host valida origem e janela e solicita
uma sessão em `POST /comunicacao/session`, usando o token administrativo já validado
por MFA. Somente o token da central é entregue ao iframe, nunca o token do host.
Não há tokens em parâmetros de URL. A troca usa o proxy da mesma origem para que
o cookie de renovação tenha o domínio correto. O backend faz a autorização efetiva.

O navegador mantém os dados da central no namespace `aito.communication.*`.
O service worker e os manifests têm escopo `/comunicacao/app/`, sem controlar
ou armazenar as páginas comerciais. A demonstração mantém o bloqueio de requests
reais. Uma instalação em validação mostra que os envios estão pausados.

Permissões de notificações e atalhos do domínio antigo não são transferidos pelo
navegador. Após validar a migração, cada administrador precisa ativar os alertas
novamente no novo domínio e instalar seu atalho pelo app de atendimento novo.
Assinaturas de push antigas são mantidas no histórico, mas não recebem mensagens
da nova instalação.

## Build

Instale as dependências da raiz e de `communications/frontend`. `npm run build`
compila as duas SPAs e reúne o resultado em `dist/spa`, com a central em
`dist/spa/comunicacao/app`. O prebuild instala o pacote independente automaticamente; o Dockerfile e o Netlify utilizam o mesmo comando.
Não publique apenas o build Quasar da raiz: utilize o script completo.

Links de mídia e URLs conhecidos do serviço anterior são adaptados para o novo
mount sem modificar assinaturas, IDs nem o conteúdo persistido. Os links públicos
gerados no backend também devem usar o `PUBLIC_APP_URL` novo antes do corte.
O domínio `notify-flow.onrender.com` continua pertencendo ao serviço antigo:
desativá-lo exige atualizar clientes externos e webhooks, não apenas o frontend.

## Sistema e ativação

O formulário preserva campos vazios e exige revisão para importação. Tokens e
conexões não são devolvidos pela API de metadados. Configurações dos canais já
salvas no banco têm prioridade; os formulários de cada canal continuam disponíveis.

As etapas finais ficam recolhidas: confirmar o destino depois da cópia dos dados,
verificar a chave do cofre contra as credenciais importadas e ativar somente com
os processadores antigos pausados. Cada ação valida a revisão atual. Ativar exige
marcar a pausa do original e digitar a confirmação literal; não acontece ao importar
ou salvar. O estado real do serviço distingue configuração pendente, inicialização,
memória insuficiente e serviço disponível. O reinício fica bloqueado antes dos
requisitos mínimos da migração.

## Netlify e sockets

O site comercial utiliza Netlify. `netlify.toml` fixa `npm run build` e o diretório
`dist/spa`, incluindo a montagem da SPA incorporada. `public/_redirects` mantém os proxies HTTP
forçados antes dos fallbacks de cada SPA; `/comunicacao/app/*` usa o index próprio.
Cookies de sessão permanecem no domínio comercial, sem transportar tokens na URL.
Os dois sockets usam a API pública diretamente, com autenticação no handshake,
porque o proxy de páginas do Netlify não transporta upgrades WebSocket. Sessões
de colaboradores obtêm pelo proxy um token efêmero exclusivo para o socket; ele
fica somente em memória e não substitui a autorização do cookie das APIs.

A migração de produção utiliza um Redis gerenciado de 256 MB. A criação de outro
Redis gratuito encontrou o limite de uma instância gratuita da conta. A conexão
fica protegida no Sistema e pode ser substituída pelo administrador.

O Redis também pode ser configurado como processo local sem um serviço Render
adicional. A ação exige confirmação literal e gera a senha no servidor. O modo
local usa persistência AOF no volume da instalação, com sincronização a cada
segundo; o banco MongoDB permanece separado e permanente.
