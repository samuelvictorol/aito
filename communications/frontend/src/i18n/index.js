import { createI18n } from 'vue-i18n'
import { shallowRef } from 'vue'
import pt from 'quasar/lang/pt-BR'
import en from 'quasar/lang/en-US'
import es from 'quasar/lang/es'

export const LOCALE_KEY='notify.locale'
export const languages=[{value:'pt-BR',label:'Português',short:'PT'},{value:'en-US',label:'English',short:'EN'},{value:'es',label:'Español',short:'ES'}]
export function normalizeLocale(value){return languages.some(item=>item.value===value)?value:'pt-BR'}
function savedLocale(){try{return localStorage.getItem(LOCALE_KEY)}catch{return null}}
async function bootLocale(){const saved=savedLocale();if(saved)return normalizeLocale(saved);if(import.meta.env.MODE!=='test'&&typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&!location.pathname.includes('/prototype'))try{const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api')+'/health/locale',{signal:AbortSignal.timeout(1800),cache:'no-store'});if(response.ok)return normalizeLocale((await response.json()).locale)}catch{}return 'pt-BR'}
async function messagesFor(locale){return locale==='en-US'?(await import('./en.json')).default:locale==='es'?(await import('./es.json')).default:{}}
const initialLocale=await bootLocale(),messages=shallowRef(await messagesFor(initialLocale))
let folded=new Map(Object.keys(messages.value).map(key=>[key.toLocaleLowerCase('pt-BR'),key]))
let quasarLang
export const i18n=createI18n({legacy:false,locale:initialLocale,fallbackLocale:'pt-BR',messages:{}})
export function currentLocale(){return i18n.global.locale.value}
export function uiText(value,values=[]){
  if(typeof value!=='string')return value
  if(!Array.isArray(values))values=[]
  const locale=currentLocale(),key=value.trim(),alias=folded.get(key.toLocaleLowerCase('pt-BR'))
  let message=locale==='pt-BR'?key:messages.value[key]||messages.value[alias]||key
  if(locale!=='pt-BR'&&!messages.value[key]&&alias&&key===key.toLocaleUpperCase('pt-BR'))message=message.toLocaleUpperCase(locale)
  const translated=value.slice(0,value.indexOf(key))+message+value.slice(value.indexOf(key)+key.length)
  return translated.replace(/\{(\d+)\}/g,(all,index)=>index in values?String(values[index]??''):all)
}
export function applyLocale(value){
  const locale=normalizeLocale(value);i18n.global.locale.value=locale
  quasarLang?.set({'pt-BR':pt,'en-US':en,es}[locale])
  if(typeof document!=='undefined')document.documentElement.lang=locale
  return locale
}
export async function setLocale(value,{reload=false}={}){
  messages.value=await messagesFor(normalizeLocale(value))
  folded=new Map(Object.keys(messages.value).map(key=>[key.toLocaleLowerCase('pt-BR'),key]))
  const locale=applyLocale(value);try{localStorage.setItem(LOCALE_KEY,locale)}catch{}
  if(reload)window.location.reload()
}
export async function initializeLocale(){
  applyLocale(initialLocale)
}
export function installLocalization(app,langApi){
  quasarLang=langApi;app.use(i18n);app.config.globalProperties.$ui=uiText;app.config.globalProperties.$locale=currentLocale;applyLocale(currentLocale())
}
