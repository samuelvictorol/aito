import { financeHeaders } from './purchase-history.js'

export function adminConfirmationHeaders(confirmation) {
  return {
    headers: {
      ...financeHeaders(true).headers,
      'X-Aito-Admin-Confirmation': confirmation.confirmationToken,
    },
  }
}
