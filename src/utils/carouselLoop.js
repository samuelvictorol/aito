export function wrapPosition(position, count) {
  if (count < 2) return 0
  return ((position + count / 2) % count + count) % count - count / 2
}

export function nearestLoopTarget(target, current, count) {
  if (count < 2) return 0
  return target + Math.round((current - target) / count) * count
}
