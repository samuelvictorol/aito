import { publicManifestUrl } from './pwa-branding.js'
import { shallowRef } from 'vue'
import { isPrototypePath } from './prototype-mode.js'
const promptEvent = shallowRef(null)
const installed = shallowRef(false)
let started = false, manifestMode
export function installTarget(path) { return isPrototypePath(path) ? '/comunicacao/app/prototype/app-mobile' : '/comunicacao/app/app-mobile' }
export function configureInstallManifest(path) {
  const mode=isPrototypePath(path)?'prototype':'production'
  if(mode!==manifestMode){promptEvent.value=null;manifestMode=mode;installed.value=window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone===true}
  const link=document.querySelector('link[rel="manifest"]')
  if(link)link.href=mode==='prototype'?'/comunicacao/app/prototype.webmanifest':publicManifestUrl()
}
export function initializeInstallPrompt() {
  if(started || typeof window==='undefined')return
  started=true
  configureInstallManifest(window.location.pathname)
  installed.value=window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone===true
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent.value=event})
  window.addEventListener('appinstalled',()=>{promptEvent.value=null;installed.value=true})
}
export function useInstallApp() {
  initializeInstallPrompt()
  return {installed,async request(){const event=promptEvent.value;if(!event)return false;promptEvent.value=null;try{await event.prompt();await event.userChoice;return true}catch{return false}}}
}
