export function connectionMemoryState(resources = {}) {
  return {
    blocked: resources?.canStart === false,
    awaitingManualRecovery: resources?.paused === true && resources?.canStart === true,
  }
}
