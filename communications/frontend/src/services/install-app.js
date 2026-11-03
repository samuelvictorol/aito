import { publicManifestUrl } from './pwa-branding.js'
import { shallowRef } from 'vue'
import { isPrototypePath } from './prototype-mode.js'
import { installedAppContext } from './embedded-host.js'
const promptEvent = shallowRef(null)
const installed = shallowRef(false)
let started = false, manifestMode
export function installTarget(path) { return isPrototypePath(path) ? '/whatsapp-solucoes/teste-gratis/app-mobile' : '/admin/comunicacao/app-mobile' }
export function configureInstallManifest(path) {
  const mode=isPrototypePath(path)?'prototype':'production'
  if(mode!==manifestMode){promptEvent.value=null;manifestMode=mode;installed.value=installedAppContext()}
  const link=document.querySelector('link[rel="manifest"]')
  if(link)link.href=mode==='prototype'?'/comunicacao/app/prototype.webmanifest':publicManifestUrl()
}
export function initializeInstallPrompt() {
  if(started || typeof window==='undefined')return
  started=true
  configureInstallManifest(window.location.pathname)
  installed.value=installedAppContext()
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent.value=event})
  window.addEventListener('appinstalled',()=>{promptEvent.value=null;installed.value=true})
}
export function useInstallApp() {
  initializeInstallPrompt()
  return {installed,async request(){const event=promptEvent.value;if(!event)return false;promptEvent.value=null;try{await event.prompt();await event.userChoice;return true}catch{return false}}}
}
