// Public Desktop pages never share administrator or other installations' sessions.
const raw=new URLSearchParams(globalThis.location?.search||'').get('desktop')||''
export const desktopSlug=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw)?raw:''
export const desktopApi=desktopSlug?'https://api.aitosoftwares.com/desktop-public/'+desktopSlug+'/api':''
export const desktopPublicRoute=path=>/^\/(?:invite\/[a-zA-Z0-9_-]+|notificacao\/[a-zA-Z0-9_-]+|meu-perfil|whatsapp-web\/catalogo\/[a-zA-Z0-9_-]+)\/?$/.test(path)
