import test from 'node:test'
import assert from 'node:assert/strict'
import { observeLandingEdges } from '../src/services/landingFloatingActions.js'
import { readFile } from 'node:fs/promises'
import * as Vue from 'vue'
import { parse as parseSfc, compileTemplate } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'

function fixture({ observer = true, boundaryOnly = false } = {}) {
  const listeners = new Map(), frames = new Map(), observers = []
  let nextFrame = 0
  const view = { innerHeight: 800,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type) },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelAnimationFrame: id => frames.delete(id),
  }
  if (observer) view.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.elements = []; this.intersections = new Map(); this.notifications = 0; observers.push(this) }
    intersects(element) {
      const inset = -Number.parseFloat(this.options.rootMargin)
      const rect = element.getBoundingClientRect()
      // IntersectionObserver counts edge-adjacent rectangles as intersecting,
      // even when their intersection area is zero.
      return rect.top <= view.innerHeight - inset && rect.bottom >= inset
    }
    observe(element) { this.elements.push(element); this.intersections.set(element, this.intersects(element)) }
    check() {
      let changed = false
      for (const element of this.elements) {
        const next = this.intersects(element)
        if (this.intersections.get(element) !== next) changed = true
        this.intersections.set(element, next)
      }
      if (changed || !boundaryOnly) { this.notifications++; this.callback() }
    }
    disconnect() { this.disconnected = true }
  }
  let scroll = 0
  const section = (top, height) => ({ getBoundingClientRect: () => ({ top: top - scroll, bottom: top + height - scroll }) })
  const first = section(0, 1000), last = section(6000, 1800), changes = []
  const stop = observeLandingEdges({ first, last, view, onChange: visible => changes.push(visible) })
  return { view, listeners, frames, observers, first, last, changes, stop,
    scrollTo(value) { scroll = value; if (observer) observers.at(-1).check(); else listeners.get('scroll')?.() },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) },
  }
}

test('floating actions follow only first and final sections, including long mobile screens', () => {
  const page = fixture()
  assert.deepEqual(page.observers[0].elements, [page.first, page.last])
  assert.equal(page.observers[0].options.rootMargin, '-399px 0px -399px 0px')
  assert.deepEqual(page.changes, [true])
  page.scrollTo(610) // A sliver of the hero remains above the viewport center.
  assert.deepEqual(page.changes, [true, false])
  page.scrollTo(2500)
  assert.deepEqual(page.changes, [true, false])
  page.scrollTo(5601)
  assert.deepEqual(page.changes, [true, false, true])
  page.scrollTo(7000) // Keep the actions while reading the long contact form.
  assert.deepEqual(page.changes, [true, false, true])
  page.scrollTo(4000)
  assert.deepEqual(page.changes, [true, false, true, false])
  page.stop()
})

test('viewport resizing rebuilds the observer and pending callbacks are removed on navigation', () => {
  const page = fixture()
  page.view.innerHeight = 500
  page.listeners.get('resize')()
  page.listeners.get('resize')()
  assert.equal(page.frames.size, 1)
  page.flush()
  assert.equal(page.observers[0].disconnected, true)
  assert.equal(page.observers[1].options.rootMargin, '-249px 0px -249px 0px')
  page.listeners.get('resize')()
  page.stop()
  assert.equal(page.frames.size, 0)
  assert.equal(page.listeners.size, 0)
  assert.equal(page.observers[1].disconnected, true)
  const before = page.changes.length
  page.observers[0].callback()
  page.observers[1].callback()
  assert.equal(page.changes.length, before)
})

test('pixel-by-pixel edge reentry cannot miss the only threshold-zero observer callback', () => {
  const page = fixture({ boundaryOnly: true })
  page.scrollTo(602) // First section ends just above the observation band.
  assert.equal(page.changes.at(-1), false)
  page.scrollTo(601) // Its lower edge touches the band: the sole entry callback.
  assert.equal(page.changes.at(-1), true)
  const firstNotifications = page.observers[0].notifications
  page.scrollTo(600)
  page.scrollTo(599)
  assert.equal(page.observers[0].notifications, firstNotifications)
  assert.equal(page.changes.at(-1), true)

  page.scrollTo(5598) // Last section starts just below the observation band.
  assert.equal(page.changes.at(-1), false)
  page.scrollTo(5599) // Its upper edge touches the band: the sole entry callback.
  assert.equal(page.changes.at(-1), true)
  const lastNotifications = page.observers[0].notifications
  page.scrollTo(5600)
  page.scrollTo(5601)
  assert.equal(page.observers[0].notifications, lastNotifications)
  assert.equal(page.changes.at(-1), true)
  page.stop()
})

test('the passive fallback measures scroll once per frame and cleans up without IntersectionObserver', () => {
  const page = fixture({ observer: false })
  assert.equal(page.listeners.has('scroll'), true)
  page.scrollTo(1800)
  page.scrollTo(2200)
  assert.equal(page.frames.size, 1)
  page.flush()
  assert.deepEqual(page.changes, [true, false])
  page.scrollTo(6300)
  page.flush()
  assert.deepEqual(page.changes, [true, false, true])
  page.stop()
  assert.equal(page.listeners.size, 0)
})

test('a missing landing section hides its actions safely', () => {
  const page = fixture()
  page.stop()
  const changes = []
  const stop = observeLandingEdges({ view: page.view, onChange: value => changes.push(value) })
  assert.deepEqual(changes, [false])
  stop()
})

test('all actual LP floating controls, including desktop section navigation, render only at the page edges', async () => {
  const source = await readFile(new URL('../src/pages/AitoLanding3DPage.vue', import.meta.url), 'utf8')
  const template = parseSfc(source).descriptor.template.content
  const classes = ['landing-3d__header', 'landing-3d__progress', 'landing-3d__floating-links',
    'landing-3d__ai-float', 'landing-3d__surprise-float']
  const controls = []
  function find(node) {
    if (node.type === 1 && node.props.some(prop => prop.type === 6 && prop.name === 'class' && classes.includes(prop.value?.content))) {
      controls.push(node.loc.source)
      return
    }
    node.children?.forEach(find)
  }
  find(parseTemplate(template))
  assert.equal(controls.length, classes.length)
  const compiled = compileTemplate({ source: controls.join('\n'), filename: 'LandingFloatingControls.vue', id: 'landing-controls' })
  assert.deepEqual(compiled.errors, [])
  const code = compiled.code.replace(/^import \{([^}]+)\} from "vue"/m, (_match, helpers) =>
    `const {${helpers.split(',').map(helper => helper.trim().replace(/ as /, ':')).join(',')}} = Vue`)
    .replace('export function render', 'function render')
  const render = new Function('Vue', `${code}\nreturn render`)(Vue)
  for (const edge of [true, false, true]) {
    const app = Vue.createSSRApp({ setup: () => ({ floatingActionsVisible: edge, introTextVisible: true,
      activeSection: edge ? 0 : 1, accountLabel: 'Entrar', landing3dSections: [
        { id: 'inicio', title: 'Início', secondaryCta: { label: 'WhatsApp', to: '/whatsapp-solucoes' } }, { id: 'contato', title: 'Contato' }],
      scrollTo() {}, openAccessChooser() {}, router: { push() {} },
    }), render })
    app.component('RouterLink', { setup(_props, { slots }) { return () => Vue.h('a', {}, slots.default?.()) } })
    app.component('QIcon', { render() { return null } })
    app.component('QTooltip', { render() { return null } })
    const html = await renderToString(app)
    for (const name of classes) assert.equal(html.includes(`class="${name}"`), edge, `${name}: ${edge ? 'edge' : 'middle'}`)
  }
})
