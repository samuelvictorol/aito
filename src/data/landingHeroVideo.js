// Set src to a file in public (e.g. /videos/apresentacao.mp4), an HTTPS
// video URL, or a YouTube watch/share URL. No video request is made while empty.
export const landingHeroVideo = Object.freeze({
  src: 'https://youtu.be/uOTy7V6n_WU',
  poster: ''
})

// The product presentation has its own source; adding it does not change the
// institutional presentation. Keep empty until the product video is available.
export const botBuilderHeroVideo = Object.freeze({
  src: '',
  poster: ''
})

export const desktopSolutionVideos = Object.freeze({
  botBuilder: { src: '', poster: '' },
  notifications: { src: '', poster: '' },
  installation: { src: '', poster: '' },
})
