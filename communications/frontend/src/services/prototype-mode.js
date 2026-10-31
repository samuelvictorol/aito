export const isPrototypePath = path => /^\/prototype(?:\/|$)/.test(String(path || '').replace(/^\/comunicacao\/app(?=\/|$)/, '').split(/[?#]/)[0])
export function prototypeDestination(target) {
  if(isPrototypePath(target.path))return {path:target.path,query:target.query,hash:target.hash}
  const path=target.path==='/'?'/settings':target.path==='/whitelabel'&&target.hash==='#storage'?'/backup':target.path
  return {path:'/prototype'+path,query:target.query,hash:target.hash}
}
