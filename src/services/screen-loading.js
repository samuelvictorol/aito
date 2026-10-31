import { ref } from 'vue'
export const screenLoading=ref(/^\/(admin|app|customer|affiliate)(\/|$)/.test(location.pathname))
let generation=0
export function beginScreen(){generation++;screenLoading.value=true;return generation}
export function finishScreen(token=generation){requestAnimationFrame(()=>{if(token===generation)screenLoading.value=false})}
export function installScreenLoading(router){let token;router.beforeEach(to=>{if(/^\/(admin|app|customer|affiliate)(\/|$)/.test(to.path)||to.meta.communicationDemo)token=beginScreen();else{generation++;screenLoading.value=false}});router.afterEach((to,_from,failure)=>{if(failure||(!to.path.startsWith('/admin/comunicacao/')&&to.path!=='/admin/comunicacao'&&!to.meta.communicationDemo)||to.path==='/admin/comunicacao/sistema')finishScreen(token)});router.onError(()=>finishScreen())}
