import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { buildPublicPages } from '../scripts/build-public-pages.mjs'
import { publicPageAliases, publicPageSeo, publicPages } from '../src/data/publicPagesSeo.js'

test('public URLs and aliases have a robot social preview and consistent canonicals', async () => {
  const titleSet = new Set()
  for (const [path, page] of Object.entries(publicPages)) {
    const { title, meta, link } = publicPageSeo(path)
    assert.equal(title, page.title)
    assert.ok(!titleSet.has(title), `Repeated title for ${path}`)
    titleSet.add(title)
    assert.equal(meta.description.content, page.description)
    assert.equal(meta.ogUrl.content, link.canonical.href)
    assert.equal(meta.ogImage.content, 'https://aitosoftwares.com/icons/aitoia-512.png')
    assert.match(meta.ogImageAlt.content, /Robô/)
    assert.deepEqual(publicPageSeo(`${path}/`), publicPageSeo(path))
  }
  for (const [alias, path] of Object.entries(publicPageAliases)) assert.deepEqual(publicPageSeo(alias), publicPageSeo(path))
  assert.equal(publicPageSeo('/admin/').link, undefined)
  const robot = await readFile(new URL('../public/icons/aitoia-512.png', import.meta.url))
  assert.equal(robot.readUInt32BE(16), 512)
  assert.equal(robot.readUInt32BE(20), 512)
})

test('static build publishes crawlable content, unique metadata, redirects and canonical sitemap', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'aito-public-pages-'))
  const dist = pathToFileURL(temp + sep)
  const fallback = '<!doctype html><html lang="pt-BR"><head><title>AitoSoftwares</title></head><body><div id="q-app"></div></body></html>'
  try {
    await writeFile(new URL('index.html', dist), fallback)
    await buildPublicPages(dist, '/comunicacao/app/* /comunicacao/app/index.html 200\r\n/* /index.html 200\r\n')
    const home = await readFile(new URL('index.html', dist), 'utf8')
    assert.match(home, /<title>Aito IA \| Chat, Vídeo e Marketing com IA \| AitoSoftwares<\/title>/)
    assert.match(home, /<link rel="canonical" href="https:\/\/aitosoftwares.com\/"/)
    assert.match(home, /<meta property="og:image" content="https:\/\/aitosoftwares.com\/icons\/aitoia-512.png"/)
    assert.match(home, /<a href="\/whatsapp-solucoes">Soluções para WhatsApp<\/a>/)
    assert.equal((home.match(/name="description"/g) || []).length, 1)
    const siteSchema = JSON.parse(home.match(/<script type="application\/ld\+json" data-public-seo>([^<]+)<\/script>/)[1])
    assert.deepEqual(siteSchema['@graph'].map(item => item['@type']), ['Organization', 'WebSite'])
    const desktop = await readFile(new URL('seo-pages/whatsapp-solucoes.html', dist), 'utf8')
    assert.match(desktop, /Qual é a diferença entre WhatsApp oficial e WhatsApp Web\?/)
    assert.match(desktop, /"@type":"SoftwareApplication"/)
    const sitemap = await readFile(new URL('sitemap.xml', dist), 'utf8')
    assert.deepEqual(Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]), Object.keys(publicPages).map(path => publicPageSeo(path).link.canonical.href))
    const redirects = await readFile(new URL('_redirects', dist), 'utf8')
    assert.equal(redirects.trim().split('\n').at(-1), '/* /seo-pages/app.html 200')
    assert.doesNotMatch(redirects, /^\/\* \/index\.html/m)
    for (const line of redirects.trim().split('\n').slice(1)) {
      const [, target] = line.split(' ')
      const targetUrl = new URL(target.slice(1), dist)
      assert.ok(dirname(fileURLToPath(targetUrl)).startsWith(temp))
      assert.ok(await readFile(targetUrl, 'utf8'))
    }
    assert.equal(await readFile(new URL('seo-pages/app.html', dist), 'utf8'), fallback)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
