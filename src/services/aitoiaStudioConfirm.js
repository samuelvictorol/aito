import { Dialog } from 'quasar'

export function confirmStudioRemoval(title, message, action, label = 'Remover') {
  Dialog.create({
    title,
    message,
    dark: true,
    persistent: true,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label, color: 'negative', unelevated: true, noCaps: true },
  }).onOk(action)
}
