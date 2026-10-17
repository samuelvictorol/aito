const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function positionFromSectionCenters(centers, viewportCenter) {
  if (!centers.length) return 0

  const nextIndex = centers.findIndex((center) => center >= viewportCenter)

  // The final section can extend beyond its center, especially on small screens.
  // Keep the last scene active instead of interpreting findIndex's -1 as the start.
  if (nextIndex === -1) return centers.length - 1
  if (nextIndex === 0) return 0

  const previousIndex = nextIndex - 1
  const range = Math.max(centers[nextIndex] - centers[previousIndex], 1)
  const amount = clamp((viewportCenter - centers[previousIndex]) / range, 0, 1)
  return previousIndex + amount
}
