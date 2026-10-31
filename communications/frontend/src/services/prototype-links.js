import { isPrototypePath, prototypeDestination } from './prototype-mode.js'

// Quasar also renders its own router links. Keep their hrefs in the demo when
// visitors open a link in a new tab, without changing the production components.
export function observePrototypeLinks(router, root=document.body) {
  function update(anchor) {
    const href=anchor.getAttribute('href')||''
    if(!href.startsWith('/')||href.startsWith('//')||isPrototypePath(href)||anchor.hasAttribute('data-prototype-exit'))return
    const logicalHref=href.replace(/^\/comunicacao\/app(?=\/|$)/,'')||'/'
    const destination=prototypeDestination(router.resolve(logicalHref))
    anchor.setAttribute('href',router.resolve(destination).href)
  }
  function scan(node){if(node.nodeType!==1)return;if(node.matches('a[href]'))update(node);node.querySelectorAll('a[href]').forEach(update)}
  scan(root)
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')update(record.target);else record.addedNodes.forEach(scan)}})
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['href']})
  return ()=>observer.disconnect()
}
