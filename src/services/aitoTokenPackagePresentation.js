const levels = [
  [500, 'Hobby', 'sand'],
  [1000, 'Pessoal', 'jade'],
  [1500, 'Criador', 'lavender'],
  [2500, 'Projetos', 'azure'],
  [5000, 'Uso intensivo', 'rose'],
  [Infinity, 'Profissional', 'amber'],
]

export function aitoTokenPackagePresentation(pack) {
  const [, usage, tone] = levels.find(([maximum]) => pack.usdCents <= maximum) || levels.at(-1)
  const totalTokens = pack.approximateTokens
  if (!Number.isSafeInteger(totalTokens) || totalTokens <= 0) return { usage, tone }
  const bonusTokens = Math.floor(totalTokens / 10)
  return { usage, tone, baseTokens: totalTokens - bonusTokens, bonusTokens, totalTokens }
}
