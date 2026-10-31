import { reactive } from 'vue'
import { api, currentUser, socket } from './services.js'
export const conversationProfile = reactive({ current: null, profiles: [], canChoose: false, loading: false })
export async function loadConversationProfile() {
  conversationProfile.loading = true
  try { Object.assign(conversationProfile, (await api.get('/conversation-profile')).data) }
  finally { conversationProfile.loading = false }
}
async function refreshActor(data) {
  Object.assign(conversationProfile, data)
  currentUser.value = (await api.get('/auth/me')).data.user
  socket.disconnect(); socket.connect()
  return data.current
}
export async function chooseConversationProfile(profileId) { return refreshActor((await api.post('/conversation-profile', { profileId })).data) }
export async function updateAdminSignature(input) { return refreshActor((await api.patch('/conversation-profile/admin', input)).data) }
