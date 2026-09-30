let guard
export function registerEditorGuard(callback) {
  guard = callback
  return () => { if (guard === callback) guard = undefined }
}
export function canLeaveBotEditor() { return guard ? guard() : true }
