// Meta numbers restart in each component. Internal keys keep header_1 and
// body_1 independent while the outgoing parameters remain positional.
export function cloudTextTokens(text = '', type = 'body') {
  const source = String(text)
  const matches = [...source.matchAll(/{{\s*([^{}]+?)\s*}}/g)]
  const tokens = [...new Set(matches.map((match) => match[1]))]
  const rest = source.replace(/{{\s*([^{}]+?)\s*}}/g, '')
  if (/[{}]/.test(rest) || tokens.some((token) => !/^(?:[1-9]\d*|[a-z][a-z0-9_]{0,63})$/.test(token))) {
    return { tokens, error: 'Use marcadores como {{1}}, {{2}} ou {{nome}}, com duas chaves de cada lado.' }
  }
  const positional = tokens.some((token) => /^\d+$/.test(token))
  if (positional && tokens.some((token) => !/^\d+$/.test(token))) {
    return { tokens, error: 'Use apenas números ou apenas nomes no mesmo componente.' }
  }
  if (positional) tokens.sort((a, b) => Number(a) - Number(b))
  if (positional && tokens.some((token, index) => Number(token) !== index + 1)) {
    return { tokens, error: 'Numere as variáveis em sequência: {{1}}, {{2}}, {{3}}, sem pular números.' }
  }
  if (type === 'header' && tokens.length > 1) {
    return { tokens, error: 'O cabeçalho da Meta aceita uma variável. Coloque as demais no corpo.' }
  }
  if (tokens.length > 20) return { tokens, error: 'Use no máximo 20 variáveis por componente.' }
  return { tokens, positional, error: null }
}

export function cloudTextEditorValue(component = {}) {
  if (component.text) return component.text
  return (component.parameters || [])
    .filter((parameter) => ['text', 'currency', 'date_time'].includes(parameter.type))
    .map((parameter, index) => `{{${parameter.parameterName || index + 1}}}`).join(' ')
}

export function updateCloudText(component, text) {
  const parsed = cloudTextTokens(text, component.type)
  component.text = String(text)
  // Do not discard values while the user is halfway through typing a marker.
  if (parsed.error) return parsed
  const existing = component.parameters || []
  component.parameters = parsed.tokens.map((token, index) => {
    const previous = existing.find((parameter, parameterIndex) => (
      (parameter.parameterName || String(parameterIndex + 1)) === token
    ))
    const key = parsed.positional ? `${component.type}_${token}`
      : `${component.type}_${token}`.length <= 64 ? `${component.type}_${token}`
        : `${component.type}_${index + 1}_${token}`.slice(0, 64)
    return {
      type: 'text', key, label: `${component.type === 'header' ? 'Cabeçalho' : 'Corpo'} — {{${token}}}`,
      example: '', fixedValue: '', contentMode: 'dynamic',
      ...previous,
      parameterName: parsed.positional ? '' : token,
    }
  })
  return parsed
}

export function cloudTextParameterError(component = {}) {
  if (!['header', 'body'].includes(component.type) || !component.text) return null
  const parameters = component.parameters || []
  if (parameters.some((parameter) => ['image', 'video', 'document'].includes(parameter.type))) {
    return 'Cabeçalhos de mídia não aceitam texto de cabeçalho.'
  }
  const parsed = cloudTextTokens(component.text, component.type)
  if (parsed.error) return parsed.error
  const expected = parameters.map((parameter, index) => parameter.parameterName || String(index + 1))
  if (parsed.tokens.length !== expected.length || parsed.tokens.some((token) => !expected.includes(token))) {
    return `As variáveis do ${component.type === 'header' ? 'cabeçalho' : 'corpo'} devem corresponder aos marcadores do texto aprovado na Meta.`
  }
  return null
}
