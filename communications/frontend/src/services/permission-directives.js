import { canAction } from './access.js'
import { getStoredUser } from './tokens.js'
const original = new WeakMap()
function permitted(value){return (Array.isArray(value)?value:[value]).some(key=>{if(typeof key!=='string'||!key.includes('.'))return false;const [area,...parts]=key.split('.');return canAction(getStoredUser(),area,parts.join('.'))})}
function apply(el,binding){if(!original.has(el))original.set(el,{display:el.style.display});const allowed=permitted(binding.value);el.style.display=allowed?original.get(el).display:'none';if(allowed)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden','true')}
export const vCanAction={beforeMount:apply,updated:apply,unmounted:el=>original.delete(el)}
