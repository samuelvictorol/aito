import { ref } from 'vue'
export function useChatFocus(channel) {
  const key = `aito.communication.chat-focus:${channel}`
  let initial = false
  try { initial = localStorage.getItem(key) === 'true' } catch { /* optional preference */ }
  const chatListCollapsed = ref(initial)
  function toggleChatList(onMobileBack) {
    if (window.innerWidth <= 850 && typeof onMobileBack === 'function') { onMobileBack(); return }
    chatListCollapsed.value = !chatListCollapsed.value
    try { localStorage.setItem(key, String(chatListCollapsed.value)) } catch { /* optional preference */ }
  }
  return { chatListCollapsed, toggleChatList }
}
