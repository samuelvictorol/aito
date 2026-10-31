import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { baseParse, NodeTypes, parserOptions } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

function dialogRoots(filename) {
  const source = readFileSync(fileURLToPath(new URL(`../src/modules/whatsapp-web/${filename}`, import.meta.url)), 'utf8')
  const template = parse(source).descriptor.template.content
  const roots = []
  const visit = (node) => {
    if (node.type === NodeTypes.ELEMENT && node.tag === 'q-dialog') {
      roots.push(node.children.find((child) => child.type === NodeTypes.ELEMENT))
    }
    for (const child of node.children || []) visit(child)
  }
  visit(baseParse(template, parserOptions))
  return roots
}

describe('área interativa dos diálogos do WhatsApp Web', () => {
  it.each([['WorkspaceLayout.vue', 1], ['pages/ChatsPage.vue', 5]])('usa raízes div reconhecidas pelo Quasar em %s', (filename, count) => {
    const roots = dialogRoots(filename)
    expect(roots).toHaveLength(count)
    for (const root of roots) expect(root.tag).toBe('div')
  })
})
