import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { desktopSolutions, desktopSolutionsFaq, desktopSolutionsSeo } from '../src/data/desktopSolutions.js'

const target = new URL('../dist/spa/whatsapp-solucoes/', import.meta.url)
const source = await readFile(new URL('../index.html', target), 'utf8')
const seo = desktopSolutionsSeo()
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const tag = (name, { innerHTML = '', ...attributes }) => {
  const props = Object.entries(attributes).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ')
  const open = `<${name} ${props} data-desktop-seo>`
  return name === 'script' ? `${open}${innerHTML}</script>` : open
}
const head = ['meta', 'link', 'script'].flatMap(name => Object.values(seo[name]).map(attributes => tag(name, attributes))).join('\n')
const features = ['notifications', 'bot', 'agent'].map(key => {
  const module = desktopSolutions[key]
  const list = module.features.map(({ title, text }) => `<li><strong>${escapeHtml(title)}</strong> ${escapeHtml(text)}</li>`).join('')
  return `<section><h2>${escapeHtml(module.title)}</h2><p>${escapeHtml(module.summary)}</p><ul>${list}</ul></section>`
}).join('')
const faq = desktopSolutionsFaq.map(({ question, answer }) => `<dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd>`).join('')
const fallback = `<noscript><main><h1>Notificações e chatbots para WhatsApp no Desktop</h1><p>${escapeHtml(desktopSolutions.intro)}</p>${features}<h2>Perguntas frequentes</h2><dl>${faq}</dl></main></noscript>`
const page = source
  .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
  .replace(/<meta name=(?:"description"|description)\s[^>]*>/, '')
  .replace('</head>', `${head}\n</head>`)
  .replace('</body>', `${fallback}</body>`)

await mkdir(target, { recursive: true })
await writeFile(new URL('index.html', target), page)
console.log('Metadados e conteúdo inicial preparados para /whatsapp-solucoes.')
