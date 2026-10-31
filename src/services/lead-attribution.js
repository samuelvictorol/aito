import { api } from '../boot/axios'
let current
export function attribution() {
  if(current)return {...current}
  try {
    let visitorId=localStorage.getItem('aito.visitor'); if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem('aito.visitor',visitorId)}
    let sessionId=sessionStorage.getItem('aito.visit'); if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem('aito.visit',sessionId)}
    const query=new URLSearchParams(location.search), saved=JSON.parse(sessionStorage.getItem('aito.campaign') || '{}')
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid'])if(query.has(key))saved[key]=String(query.get(key)).slice(0,180)
    sessionStorage.setItem('aito.campaign',JSON.stringify(saved)); current={visitorId,sessionId,...saved,referrer:document.referrer.split(/[?#]/)[0]}
    return {...current}
  } catch {return null}
}
export function trackJourney(path,event='page_view') {
  const value=attribution(); if(!value || /^(\/(admin|app|customer|affiliate|auth))(\/|$)/.test(path))return
  return api.post('/leads/visit',{...value,path:path.split(/[?#]/)[0],event}).catch(()=>{})
}
export function installLeadAttribution(router) {
  api.interceptors.request.use(config=>{
    if(config.method==='post' && config.url==='/leads' && config.data && typeof config.data==='object') config.data={...config.data,attribution:{...attribution(),path:location.pathname}}
    return config
  })
  router.afterEach(to=>{trackJourney(to.path)})
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href],button[data-funnel]'); if(!link)return
    const href=link.getAttribute('href') || '', funnel=link.dataset.funnel
    if(funnel || /wa.me|\/prototype|#planos/.test(href))trackJourney(location.pathname,funnel || (href.includes('prototype')?'demo_open':href.includes('wa.me')?'whatsapp_open':'offer_open'))
  })
}
