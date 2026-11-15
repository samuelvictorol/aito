import { shallowRef } from 'vue'

const routes = {
  '/aitoia/video/generations': { kind: 'video', source: 'chat', title: 'Vídeo no chat' },
  '/aitoia/video/studio/generations': { kind: 'video', source: 'studio', title: 'Clipe do estúdio' },
  '/aitoia/video/studio/remakes': { kind: 'video', source: 'remake', title: 'Cena refeita' },
  '/aitoia/video/voice': { kind: 'voice', title: 'Locução' },
  '/aitoia/images/generations': { kind: 'image', source: 'chat', title: 'Imagem no chat' },
  '/aitoia/marketing/generations': { kind: 'image', source: 'marketing', title: 'Imagem de marketing' },
}

export const localGenerationActivity = shallowRef([])
export const removedGeneration = shallowRef(null)

function update(row) {
  const remaining = localGenerationActivity.value.filter(item =>
    (item.owner !== row.owner || item.requestId !== row.requestId) && item.createdAt > Date.now() - 86400000)
  localGenerationActivity.value = [row, ...remaining].slice(0, 40)
}

function dismiss(owner, requestId) {
  localGenerationActivity.value = localGenerationActivity.value.filter(row => row.owner !== owner || row.requestId !== requestId)
}

export function forgetLocalGeneration(owner, generation) {
  localGenerationActivity.value = localGenerationActivity.value.filter(row =>
    row.owner !== owner || !(row.id === generation.id || generation.requestId && row.requestId === generation.requestId))
  removedGeneration.value = { owner, id: generation.id }
}

export async function followGeneration(owner, path, options, current, submit) {
  const route = routes[path]
  if (!owner || !route) return submit()
  const requestId = options?.headers?.['X-Aito-Request-Id'] || crypto.randomUUID()
  const video = route.kind === 'video'
  const row = { ...route, owner, requestId, status: video ? 'submitting' : 'in_progress', createdAt: Date.now() }
  update(row)
  try {
    const response = await submit()
    if (current() && !options?.signal?.aborted) {
      const job = response.data?.data
      if (video) update({ ...row, id: job?.id, status: job?.status || 'submitting', modelLabel: job?.modelLabel })
      else update({ ...row, status: 'completed' })
    } else dismiss(owner, requestId)
    return response
  } catch (cause) {
    const apiError = cause.response?.data
    if (!current() || options?.signal?.aborted || apiError?.code === 'AITO_MEDIA_ACTIVE') dismiss(owner, requestId)
    else if (!video || cause.response && cause.response.status < 500) {
      update({ ...row, status: 'failed', message: typeof apiError?.message === 'string' ? apiError.message : undefined })
    }
    throw cause
  }
}
