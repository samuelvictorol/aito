<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { spotlightRect, spotlightCardPosition, TOUR_HELP_URL } from '../../services/prototype-tour.js'
const props=defineProps({active:Boolean,step:{type:Object,required:true},index:Number,total:Number})
const emit=defineEmits(['next','previous','pause'])
const card=ref(null),rect=ref(null),viewport=ref({width:1024,height:800}),cardHeight=ref(420)
let interval,anchor,scrolled=false,previousFocus
const px=value=>typeof value==='number'?value+'px':value
const position=computed(()=>Object.fromEntries(Object.entries(spotlightCardPosition(rect.value,viewport.value,cardHeight.value)).map(([key,value])=>[key,px(value)])))
const hole=computed(()=>rect.value?{left:px(rect.value.left),top:px(rect.value.top),width:px(rect.value.width),height:px(rect.value.height)}:null)
const shades=computed(()=>{const {width,height}=viewport.value,r=rect.value;if(!r)return [{left:0,top:0,width,height}];return [{left:0,top:0,width,height:r.top},{left:0,top:r.top,width:r.left,height:r.height},{left:r.right,top:r.top,width:Math.max(0,width-r.right),height:r.height},{left:0,top:r.bottom,width,height:Math.max(0,height-r.bottom)}]})
function measure(){
  const nextViewport={width:window.innerWidth,height:window.innerHeight}
  if(nextViewport.width!==viewport.value.width||nextViewport.height!==viewport.value.height)viewport.value=nextViewport
  const screen=document.querySelector('.prototype-screen')
  const node=screen?.querySelector(props.step.target)
  if(node&&node.getBoundingClientRect().width&&node.getBoundingClientRect().height){
    if(anchor!==node){anchor=node;scrolled=false}
    if(!scrolled){scrolled=true;node.scrollIntoView({block:props.step.id==='flow'&&nextViewport.width<700?'start':'center',inline:'nearest',behavior:'instant'})}
    const box=node.getBoundingClientRect(),nextRect=spotlightRect(box,nextViewport)
    if(JSON.stringify(nextRect)!==JSON.stringify(rect.value))rect.value=nextRect
  }else if(rect.value)rect.value=null
  const height=card.value?.offsetHeight
  if(height&&height!==cardHeight.value)cardHeight.value=height
}
function keydown(event){
 if(!props.active)return
 if(event.key==='Escape'){event.preventDefault();emit('pause');return}
 if(event.key!=='Tab')return
 const items=[...(card.value?.querySelectorAll('button:not(:disabled),a[href]')||[])].filter(el=>el.getClientRects().length)
 if(!items.length)return
 const first=items[0],last=items.at(-1)
 if(!card.value.contains(document.activeElement)){event.preventDefault();first.focus()}
 else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function stop(){clearInterval(interval);interval=null;document.removeEventListener('keydown',keydown)}
watch(()=>[props.active,props.step.id],async()=>{
 stop();anchor=null;scrolled=false;rect.value=null
 if(!props.active){if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;return}
 previousFocus=document.activeElement
 await nextTick();measure();interval=setInterval(measure,140);document.addEventListener('keydown',keydown)
 card.value?.querySelector('[data-tour-primary]')?.focus({preventScroll:true})
},{immediate:true})
onBeforeUnmount(stop)
</script>
<template>
 <Teleport to="body"><div v-if="active" class="showroom-layer" :data-tone="step.tone">
  <div v-for="(shade,i) in shades" :key="i" class="showroom-shade" :style="Object.fromEntries(Object.entries(shade).map(([key,value])=>[key,px(value)]))"/>
  <div v-if="hole" class="showroom-hole" :style="hole" aria-hidden="true"><span/></div>
  <section ref="card" class="showroom-card" :style="position" role="dialog" aria-modal="true" aria-labelledby="showroom-title" aria-describedby="showroom-description">
   <header><span><i/> VISITA GUIADA <b>{{index+1}} / {{total}}</b></span><button class="showroom-close" type="button" aria-label="Pausar visita e explorar livremente" @click="emit('pause')"><q-icon name="close"/></button></header>
   <div class="showroom-copy"><div class="showroom-chapter"><q-icon :name="step.icon"/><span>{{step.chapter}}</span></div><h2 id="showroom-title">{{step.title}}</h2><p id="showroom-description">{{step.description}}</p><aside><q-icon name="tips_and_updates"/><span>{{step.benefit}}</span></aside><p class="showroom-activity">{{step.activity}}</p></div>
   <footer><div class="showroom-navigation"><button type="button" class="showroom-back" :disabled="index===0" aria-label="Etapa anterior" @click="emit('previous')"><q-icon name="arrow_back"/></button><button data-tour-primary type="button" class="showroom-primary" @click="emit('next')">{{step.action || 'Próximo destaque'}}<q-icon name="arrow_forward"/></button></div><button type="button" class="showroom-explore" @click="emit('pause')"><q-icon name="touch_app"/> Pausar e interagir com esta tela</button><a class="showroom-help" :href="TOUR_HELP_URL" target="_blank" rel="noopener noreferrer"><q-icon name="mdi-whatsapp"/> Precisa configurar? Fale com a AitoSoftwares</a></footer>
  </section>
 </div></Teleport>
</template>
<style scoped>
.showroom-layer{--tour-accent:#087c66;--tour-soft:#e3f7ee;position:fixed;inset:0;z-index:7000;pointer-events:none;color:#16362f;font-family:Inter,'Segoe UI',sans-serif}.showroom-layer[data-tone=blue]{--tour-accent:#126dad;--tour-soft:#e6f3ff}.showroom-layer[data-tone=violet]{--tour-accent:#7355b5;--tour-soft:#f0ebff}.showroom-layer[data-tone=rose]{--tour-accent:#b2445e;--tour-soft:#fceaf0}.showroom-shade{position:fixed;pointer-events:auto;background:#041412b5;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.showroom-hole{position:fixed;pointer-events:none;border:2px solid #b5ffe5;border-radius:15px;box-shadow:0 0 0 5px #36d8ac32,0 0 25px #4ae6bf44;overflow:hidden}.showroom-hole>span{position:absolute;right:12px;top:12px;width:7px;height:7px;border-radius:50%;background:#b5ffe5;box-shadow:0 0 13px #8dffdb}.showroom-card{position:fixed;display:flex;flex-direction:column;pointer-events:auto;overflow:auto;border:1px solid #ccede0;border-radius:21px;background:#fcfffd;box-shadow:0 22px 80px #001d2299;animation:showroom-appear .2s ease-out}.showroom-card>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 17px;border-bottom:1px solid #e2ede7}.showroom-card>header>span{display:flex;align-items:center;gap:7px;font-size:9px;font-weight:800;letter-spacing:.1em;color:#4b6d5f}.showroom-card>header b{font-weight:700;background:var(--tour-soft);color:var(--tour-accent);padding:5px 8px;border-radius:20px;margin-left:4px;letter-spacing:0}.showroom-card>header i{width:6px;height:6px;border-radius:50%;background:#1cbd8c;box-shadow:0 0 8px #1cbd8c55}.showroom-close,.showroom-back{display:grid;place-items:center;background:transparent;border:0;color:#577365;width:29px;height:29px;border-radius:8px;cursor:pointer;font-size:20px}.showroom-close:hover,.showroom-back:hover{background:#edf7f1}.showroom-copy{padding:19px 23px 10px}.showroom-chapter{display:flex;align-items:center;gap:10px;color:var(--tour-accent);font-size:10px;font-weight:750}.showroom-chapter>.q-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--tour-soft);font-size:22px}.showroom-card h2{font-size:24px;line-height:1.18;letter-spacing:-.035em;font-weight:700;margin:14px 0 11px;color:#153b32}.showroom-copy>p{font-size:12px;line-height:1.75;margin:0 0 14px;color:#4e6c60}.showroom-copy>aside{display:flex;gap:9px;border-radius:12px;padding:12px;background:var(--tour-soft);color:#365b4c;font-size:11px;line-height:1.7}.showroom-copy>aside .q-icon{font-size:20px;flex:none;color:var(--tour-accent);margin-top:1px}.showroom-copy>.showroom-activity{font-size:10px;line-height:1.7;margin:13px 0 0;color:#697e72}.showroom-card>footer{padding:13px 23px 17px;display:grid;gap:11px}.showroom-navigation{display:flex;gap:8px}.showroom-back{border:1px solid #d5e7dc;width:39px;height:39px;flex:none;font-size:18px}.showroom-back:disabled{opacity:.35;cursor:default}.showroom-primary{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:39px;flex:1;border:0;border-radius:10px;padding:9px 13px;background:var(--tour-accent);color:#fff;font:700 12px Inter,'Segoe UI',sans-serif;cursor:pointer}.showroom-primary>.q-icon{font-size:18px}.showroom-explore{display:flex;align-items:center;justify-content:center;gap:7px;border:0;background:transparent;color:var(--tour-accent);font:650 11px Inter,'Segoe UI',sans-serif;cursor:pointer;padding:2px}.showroom-help{display:flex;align-items:center;justify-content:center;gap:5px;color:#526f61;text-decoration:none;font-size:9px;padding-top:7px;border-top:1px solid #e1ede5}.showroom-help>.q-icon{color:#1d9d73;font-size:14px}.showroom-card button:focus-visible,.showroom-card a:focus-visible{outline:3px solid #78cdb1;outline-offset:3px}@keyframes showroom-appear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(max-width:699px){.showroom-card{border-radius:19px;bottom:max(12px,env(safe-area-inset-bottom,0px))!important}.showroom-copy{padding:14px 17px 7px}.showroom-card h2{font-size:21px;margin-top:11px}.showroom-copy>p{font-size:11px;line-height:1.65}.showroom-copy>aside{font-size:10px;padding:10px}.showroom-copy>.showroom-activity{font-size:9px;margin-top:10px}.showroom-card>footer{padding:10px 17px 14px;gap:10px}.showroom-card>header{padding:10px 14px}.showroom-chapter>.q-icon{width:32px;height:32px;font-size:20px}.showroom-help{font-size:9px}.showroom-shade{backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}}@media(prefers-reduced-motion:reduce){.showroom-card{animation:none}}
</style>
