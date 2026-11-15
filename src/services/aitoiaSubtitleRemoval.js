export function readSubtitleRegion(region) {
  const { x, y, width: regionWidth, height: regionHeight } = region ?? {}
  if (![x, y, regionWidth, regionHeight].every(Number.isFinite) || x < 0 || x >= 1 || y < 0 || y >= 1 || regionWidth <= 0 ||
      regionHeight <= 0 || x + regionWidth > 1.000001 || y + regionHeight > 1.000001) return
  if (x === 0 && y === 0 && regionWidth === 1 && regionHeight === 1) return
  return { x, y, width: regionWidth, height: regionHeight }
}

export function createSubtitleRegionCleaner(width, height, region) {
  const area = readSubtitleRegion(region)
  if (!area) throw new Error('Marque apenas a área da legenda, deixando parte do quadro ao redor.')
  const { x, y, width: regionWidth, height: regionHeight } = area
  const left = Math.floor(x * width)
  const top = Math.floor(y * height)
  const right = Math.min(width, Math.ceil((x + regionWidth) * width))
  const bottom = Math.min(height, Math.ceil((y + regionHeight) * height))
  const west = left > 0
  const east = right < width
  const north = top > 0
  const south = bottom < height
  const hasColumns = west || east
  const hasRows = north || south
  if (!hasColumns && !hasRows) throw new Error('Marque apenas a área da legenda, deixando parte do quadro ao redor.')

  const canvas = document.createElement('canvas')
  Object.assign(canvas, { width, height })
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) throw new Error('O navegador não conseguiu preparar a remoção da legenda.')

  const patchWidth = right - left
  const patchHeight = bottom - top
  const offsetX = Number(west)
  const offsetY = Number(north)
  const windowWidth = patchWidth + offsetX + Number(east)
  const windowHeight = patchHeight + offsetY + Number(south)
  const windowStride = windowWidth * 4
  const firstColumn = west ? 0 : windowStride - 4
  const lastColumn = east ? windowStride - 4 : 0
  const firstRow = north ? 0 : (windowHeight - 1) * windowStride
  const lastRow = south ? (windowHeight - 1) * windowStride : 0
  const replacement = context.createImageData(patchWidth, patchHeight)

  return sample => {
    sample.draw(context, 0, 0, width, height)
    const original = context.getImageData(left - offsetX, top - offsetY, windowWidth, windowHeight).data
    const pixels = replacement.data
    let index = 0
    for (let row = 0; row < patchHeight; row++) {
      const rowOffset = (row + offsetY) * windowStride
      const vertical = (row + 1) / (patchHeight + 1)
      const rowDistance = Math.min(north ? row + 1 : Infinity, south ? patchHeight - row : Infinity)
      for (let column = 0; column < patchWidth; column++) {
        const columnOffset = (column + offsetX) * 4
        const horizontal = (column + 1) / (patchWidth + 1)
        const columnDistance = Math.min(west ? column + 1 : Infinity, east ? patchWidth - column : Infinity)
        // Reconstruct every marked pixel using unmarked edges. Favor the nearest edge so the patch follows its surroundings.
        const horizontalWeight = hasColumns ? hasRows ? rowDistance / (rowDistance + columnDistance) : 1 : 0
        for (let channel = 0; channel < 3; channel++) {
          const leftValue = original[rowOffset + firstColumn + channel]
          const topValue = original[firstRow + columnOffset + channel]
          const horizontalValue = leftValue + horizontal * (original[rowOffset + lastColumn + channel] - leftValue)
          const verticalValue = topValue + vertical * (original[lastRow + columnOffset + channel] - topValue)
          pixels[index++] = horizontalValue * horizontalWeight + verticalValue * (1 - horizontalWeight)
        }
        pixels[index++] = 255
      }
    }
    context.putImageData(replacement, left, top)
    return canvas
  }
}
