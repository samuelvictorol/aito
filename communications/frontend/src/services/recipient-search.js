export function searchRecipientOptions(options, search) {
  const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[\s()+.-]/g, '')
  const needle = normalize(search)
  return needle ? options.filter(option => normalize(option.searchText || option.label).includes(needle)) : options
}
