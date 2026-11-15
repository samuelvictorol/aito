export const videoCatalog = [
  { id: 'seedance-2.5', maker: 'ByteDance', name: 'Seedance 2.5', summary: 'Direção de cena e movimento de câmera com referências multimídia.', poster: '0% 0%' },
  { id: 'genjutsu-light', maker: 'Higgsfield', name: 'Genjutsu Light', summary: 'Transfere movimentos de um vídeo para personagens e cenários de referência.', poster: '100% 0%', mode: 'genjutsu-light' },
  { id: 'genjutsu', maker: 'Higgsfield', name: 'Genjutsu', summary: 'Muda personagens, cenários e estilos preservando o movimento original.', poster: '0% 33.3333%', mode: 'genjutsu', referenceId: 'genjutsu-object-swap' },
  { id: 'kling-4.0', maker: 'Kling', name: 'Kling 4.0', summary: 'Cenas cinematográficas com ações e enquadramentos detalhados.', poster: '100% 33.3333%' },
  { id: 'kling-4.0-flash', maker: 'Kling', name: 'Kling 4.0 Flash', summary: 'Clipes rápidos em 720p para experimentar uma ideia.', poster: '0% 66.6667%' },
  { id: 'minimax-h3', maker: 'MiniMax', name: 'MiniMax H3', summary: 'Movimento de personagem e detalhes em até 2K.', poster: '100% 66.6667%' },
  { id: 'wan-3.0-prime', maker: 'Alibaba', name: 'Wan 3.0 Prime', summary: 'Geração rápida para cenas em movimento e estilos variados.', poster: '0% 100%' },
  { id: 'seedance-2.0', maker: 'ByteDance', name: 'Seedance 2.0', summary: 'Cria clipes a partir de texto ou referências, com som opcional.' },
  { id: 'cinema-studio-4.0', maker: 'Higgsfield', name: 'Cinema Studio 4.0', summary: 'Direção automática para composição e movimento de câmera.', type: 'workflow' },
  { id: 'genjutsu-motion-transfer', familyId: 'genjutsu', maker: 'Higgsfield', name: 'Genjutsu · Transferência de movimento', summary: 'Aplica o movimento do vídeo a personagens, produtos ou roupas.', type: 'workflow', mode: 'genjutsu', referenceId: 'genjutsu' },
  { id: 'wan-3.0', maker: 'Alibaba', name: 'Wan 3.0', summary: 'Transforma texto ou imagens em clipes com áudio nativo.' },
  { id: 'ltx-2.5-fast', maker: 'Lightricks', name: 'LTX 2.5 Fast', summary: 'Geração rápida com controles de câmera e áudio nativo.' },
  { id: 'ltx-2.5-pro', maker: 'Lightricks', name: 'LTX 2.5 Pro', summary: 'Cenas em alta definição com áudio e movimento de câmera.' },
  { id: 'grok-imagine-video-1.5', maker: 'xAI', name: 'Grok Imagine Video 1.5', summary: 'Cria clipes em 1080p a partir de texto ou imagens.' },
  { id: 'wan-2.7', maker: 'Alibaba', name: 'Wan 2.7', summary: 'Mantém a identidade visual dos personagens entre cenas.' },
  { id: 'happy-horse-1.1', maker: 'Alibaba', name: 'Happy Horse 1.1', summary: 'Clipes em 1080p a partir de texto e referências visuais.' },
  { id: 'kling-3.0', maker: 'Kling', name: 'Kling 3.0', summary: 'Clipes com vários planos e áudio nativo.' },
  { id: 'happy-horse-1.0', maker: 'Alibaba', name: 'Happy Horse 1.0', summary: 'Cria vídeos a partir de texto ou imagens de referência.' },
  { id: 'pixverse-6', maker: 'PixVerse', name: 'PixVerse 6', summary: 'Combina som nativo e controle dos quadros inicial e final.' },
  { id: 'kling-o3', maker: 'Kling', name: 'Kling O3', summary: 'Cria e edita clipes com imagens, vídeo-base e áudio nativo.' },
  { id: 'kling-2.6', maker: 'Kling', name: 'Kling 2.6', summary: 'Gera cenas com diálogos, efeitos e som ambiente.' },
  { id: 'kling-o1-omni', maker: 'Kling', name: 'Kling O1 (Omni)', summary: 'Cria e edita vídeos com referências e quadros inicial e final.', mode: 'reference' },
  { id: 'wan-2.6', maker: 'Alibaba', name: 'Wan 2.6', summary: 'Clipes com vários planos, áudio nativo e referências opcionais.' },
  { id: 'minimax-hailuo-2.3', maker: 'MiniMax', name: 'MiniMax Hailuo 2.3', summary: 'Movimentos corporais fluidos e expressões naturais.' },
  { id: 'kling-2.5', maker: 'Kling', name: 'Kling 2.5', summary: 'Geração rápida com resposta precisa às instruções do prompt.' },
  { id: 'grok-imagine-2.0', maker: 'xAI', name: 'Grok Imagine 2.0', summary: 'Cria e edita imagens com atenção aos detalhes.', poster: '100% 100%', type: 'image', limitation: 'Geração de imagem' },
]

export function chatVideoModels(catalog, { hasVideo = false, imageCount = 0 } = {}) {
  const accepts = (model, supportsLegacyVideo = false) => (!hasVideo || (model.supportsVideo ?? supportsLegacyVideo)) &&
    (hasVideo || !model.requiresVideo) && (model.maxImageReferences ?? 0) >= imageCount
  const text = (catalog?.videoModels || []).filter(model => accepts(model))
  const references = (catalog?.referenceModels || []).filter(model => model.mode !== 'continuation' && accepts(model, true))
  return [...text, ...references]
}
