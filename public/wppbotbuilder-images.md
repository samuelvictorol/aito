# Imagens da página WhatsApp BotBuilder

As demonstrações da landing ficam em `public/product-demo/`:

- `flow-{840,1440}`: editor visual de fluxos.
- `order-{420,720}`: pedido de hamburgueria pelo celular.
- `chats-{840,1440}`: conversas com pessoas fictícias no painel.
- `phone-{420,720}`: painel e atendimento no celular.
- `adapt-{840,1440}`: exemplo de adaptação a outro sistema.
- `ai-emblem`: emblema de IA com transparência.

Cada nome está disponível em **WebP e PNG**. Os PNG são fallbacks reais,
reencodados com compressão sem perdas, e têm os mesmos pixels e dimensões do
WebP correspondente. O canal alfa do emblema foi preservado. Não houve redesenho,
recorte, alteração de textos ou nova geração de conteúdo nesta validação.

As imagens ilustrativas foram geradas com a ferramenta integrada image_gen.
Os prompts estão em `product-demo/prompts.json`. As pessoas e conversas são
fictícias. Para trocar por capturas reais, mantenha nomes, proporções e resoluções
ou ajuste as referências e os textos alternativos do componente.

## Integridade verificada em 17/10/2026

Dez WebP tinham o tamanho RIFF zerado no cabeçalho e o valor correto anexado como
quatro bytes finais, fora do chunk VP8. Esses arquivos falhavam na decodificação
estrita. O reparo reposicionou o tamanho nos bytes 4–7 e retirou os quatro bytes
finais, preservando integralmente o payload VP8 e sem recompressão. O
`ai-emblem.webp` já estava íntegro e permaneceu inalterado.

A validação utilizou sharp 0.35.5, libvips 8.18.7 e
libwebp 1.6.0: assinatura e limites de todos os chunks RIFF,
decodificação completa para pixels com `failOn: warning`, assinatura PNG e CRC
de todos os chunks, seguida de igualdade dos pixels entre PNG e WebP. Todos os
11 pares passaram. O relatório `product-demo/integrity.json` contém SHA-256 dos
arquivos, hash dos pixels decodificados e detalhes do reparo. O defeito foi
identificado nos bytes dos arquivos; esta verificação não determina em qual etapa
da produção ele foi introduzido.

Tamanhos dos arquivos finais, em bytes:

| Nome-base | Dimensões | WebP | PNG |
| --- | --- | ---: | ---: |
| adapt-1440 | 1440 × 900 | 111.278 | 612.690 |
| adapt-840 | 840 × 526 | 49.152 | 277.136 |
| ai-emblem | 480 × 480 | 21.924 | 145.312 |
| chats-1440 | 1440 × 900 | 80.914 | 520.989 |
| chats-840 | 840 × 526 | 37.962 | 242.314 |
| flow-1440 | 1440 × 900 | 91.648 | 535.279 |
| flow-840 | 840 × 526 | 40.612 | 239.517 |
| order-420 | 420 × 792 | 45.784 | 250.708 |
| order-720 | 720 × 1358 | 97.210 | 591.232 |
| phone-420 | 420 × 786 | 42.164 | 244.775 |
| phone-720 | 720 × 1346 | 85.452 | 530.814 |

## PNG de referência recebidos

Os cinco PNG temporários também passaram pela leitura integral, assinatura e CRC
de todos os chunks. Cópias PNG temporárias foram reencodadas para visualização
segura e comparadas pixel a pixel aos originais. Os originais foram preservados.

| Arquivo | Dimensões | Bytes | Resultado |
| --- | --- | ---: | --- |
| `codex-clipboard-3ea0f2e2-b6d3-4446-8b4f-49fda7475df1.png` | 913 × 1722 | 1.577.517 | íntegro |
| `codex-clipboard-0b595f77-fd82-4a47-8a95-e3bf0bfd821b.png` | 1586 × 992 | 1.439.371 | íntegro |
| `codex-clipboard-7998967e-b280-42f7-a361-257b614b55c4.png` | 917 × 1715 | 1.569.393 | íntegro |
| `codex-clipboard-a6e1a97e-1c99-4c71-bd99-5bf9a530f255.png` | 1586 × 992 | 1.429.663 | íntegro |
| `codex-clipboard-75ba56c6-81af-4d99-a961-f23f9e19f107.png` | 1586 × 992 | 1.508.698 | íntegro |

Os arquivos JPG antigos não são utilizados nesta versão da página.
