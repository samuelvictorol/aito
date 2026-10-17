# Site Portfolio (site_portfolio)

A Quasar Project

## Vídeo e identidade da landing page

Configure `src/data/landingHeroVideo.js`: `src` aceita um arquivo em `public`
(por exemplo `/videos/apresentacao.mp4`), uma URL de vídeo ou um link do
YouTube. `poster` é opcional. Sem fonte, a moldura mostra uma apresentação
estática; vídeos só são criados perto da área visível, com `preload="none"`,
e o player do YouTube só é carregado após um clique.

A logo restaurada está em `public/aito-logo-restored.png`, gerada com a
ferramenta integrada de imagens a partir da referência da logo antiga.
Prompt: “Recreate and restore this exact AitoSoftwares old logo from the small
reference: a turquoise/teal 3D cloud speech bubble, left half stylized brain
grooves and right half a recessed heart shape. Preserve the recognizable
silhouette, orientation and proportions, smooth sculpted rounded edges and
subtle mint highlights. Single centered isolated brand mark, large clear
silhouette with modest padding. High resolution crisp professional 3D icon.
Transparent background, no text, no added elements, no background square,
no ground shadow. Reference is the edit target.”

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
