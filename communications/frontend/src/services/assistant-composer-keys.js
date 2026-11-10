export function createAssistantComposerKeys(send) {
  let lastEnter = null
  const reset = () => { lastEnter = null }
  function keydown(event) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) {
      reset()
      return
    }
    if (event.repeat || event.shiftKey || event.altKey) {
      reset()
      return
    }
    const now = event.timeStamp
    const doubleEnter = lastEnter !== null && now > lastEnter && now - lastEnter <= 320
    if (event.ctrlKey || event.metaKey || doubleEnter) {
      reset()
      event.preventDefault()
      void send()
      return
    }
    lastEnter = now
  }
  return { keydown, reset }
}
