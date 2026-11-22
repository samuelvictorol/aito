const guestRoutes = new Set(['aito-ia', 'aito-ia-video-studio', 'aito-ia-marketing-studio'])

export const GUEST_RECHARGE_DELAY = 3000

export function shouldOfferGuestRecharge(routeName, { userToken, adminToken } = {}) {
  return guestRoutes.has(routeName) && !userToken && !adminToken
}
