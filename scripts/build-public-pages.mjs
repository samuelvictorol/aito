import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { publicPageAliases, publicPageSeo, publicPages } from '../src/data/publicPagesSeo.js'

const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function makeTag(name, { innerHTML = '', ...attributes }) {
  const props = Object.entries(attributes).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ')
  const open = `<${name} ${props} data-public-seo>`
  return name === 'script' ? `${open}${innerHTML}</script>` : open
}

function featureList(features = []) {
  if (!features.length) return ''
  return `<ul>${features.map(({ title, text }) => `<li><strong>${escapeHtml(title)}</strong> ${escapeHtml(text)}</li>`).join('')}</ul>`
}

function fallbackBody(page) {
  const sections = (page.sections || []).map(({ title, summary, features }) =>
    `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p>${featureList(features)}</section>`).join('')
  const faq = page.faq ? `<h2>Perguntas frequentes</h2><dl>${page.faq.map(({ question, answer }) =>
    `<dt>${escapeHtml(question)}</dt><dd>${escapeHtml(answer)}</dd>`).join('')}</dl>` : ''
  const links = page.links ? `<nav aria-label="Páginas relacionadas"><ul>${page.links.map(({ path, label }) =>
    `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`).join('')}</ul></nav>` : ''
  return `<noscript><main><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.intro || page.description)}</p>${featureList(page.features)}${sections}${faq}${links}</main></noscript>`
}

function renderPage(source, path) {
  const seo = publicPageSeo(path)
  const head = ['meta', 'link', 'script'].flatMap(name => Object.values(seo[name]).map(attributes => makeTag(name, attributes))).join('\n')
  return source.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
    .replace('</head>', `${head}\n</head>`)
    .replace('</body>', `${fallbackBody(publicPages[path])}</body>`)
}

const outputPath = path => path === '/' ? '/index.html' : `/seo-pages${path}.html`

export async function buildPublicPages(dist, redirects) {
  const source = await readFile(new URL('index.html', dist), 'utf8')
  const paths = Object.keys(publicPages)
  const sitemap = paths.map(path => `  <url><loc>${escapeHtml(publicPageSeo(path).link.canonical.href)}</loc></url>`).join('\n')
  const pageRoutes = { ...Object.fromEntries(paths.filter(path => path !== '/').map(path => [path, path])), ...publicPageAliases }
  const rules = Object.entries(pageRoutes).map(([route, path]) => `${route} ${outputPath(path)} 200`)
  const existingRules = redirects.trimEnd().replace(/(?:^|\r?\n)\/\* \/index\.html 200$/, '')
  await mkdir(new URL('seo-pages/', dist), { recursive: true })
  await Promise.all([
    ...paths.map(path => writeFile(new URL(outputPath(path).slice(1), dist), renderPage(source, path))),
    writeFile(new URL('seo-pages/app.html', dist), source),
    writeFile(new URL('_redirects', dist), `${existingRules}\n${rules.join('\n')}\n/* /seo-pages/app.html 200\n`),
    writeFile(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>\n`),
  ])
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')
  await buildPublicPages(new URL('../dist/spa/', import.meta.url), redirects)
  console.log('Páginas públicas, prévias sociais e sitemap preparados.')
}
