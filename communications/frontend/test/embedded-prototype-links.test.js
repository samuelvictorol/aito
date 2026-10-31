// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { observePrototypeLinks } from '../src/services/prototype-links.js'

describe('prototype links under the communication mount', () => {
  it('keeps ordinary cloned-page links in the sandbox without doubling the router base', () => {
    const router=createRouter({history:createMemoryHistory('/comunicacao/app/'),routes:[{path:'/:path(.*)*',component:{template:'<div/>'}}]})
    const root=document.createElement('div')
    root.innerHTML='<a href="/comunicacao/app/templates?channel=cloud">Templates</a><a href="/comunicacao/app/prototype/contacts">Contacts</a><a data-prototype-exit href="/admin/login" target="_top">Exit</a>'
    const stop=observePrototypeLinks(router,root)
    expect([...root.querySelectorAll('a')].map(item=>item.getAttribute('href'))).toEqual(['/comunicacao/app/prototype/templates?channel=cloud','/comunicacao/app/prototype/contacts','/admin/login'])
    stop()
  })
})
