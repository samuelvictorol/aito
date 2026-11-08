// @vitest-environment jsdom
import {it,expect,vi} from 'vitest'
import {createApp,nextTick,h,ref} from 'vue'
vi.mock('quasar',async original=>{const actual=await original();const {h}=await import('vue');const box={setup:(_p,{slots})=>()=>h('div',slots.default?.())};return {...actual,QDialog:{props:['modelValue'],setup:(p,{slots})=>()=>p.modelValue?h('div',slots.default?.()):null},QCard:box,QCardSection:box,QBtn:box}})
import PendingAttachments from '../src/components/PendingAttachments.vue'
it('renders every file, opens its own preview, and releases removed blob URLs',async()=>{
 let n=0;URL.createObjectURL=vi.fn(()=> 'blob:preview-'+(++n));URL.revokeObjectURL=vi.fn()
 const a=new File(['image'],'photo.png',{type:'image/png'}),b=new File(['pdf'],'invoice.pdf',{type:'application/pdf'}),files=ref([a,b]);const removed=vi.fn()
 const root=document.createElement('div');document.body.append(root)
 const app=createApp({setup:()=>()=>h(PendingAttachments,{files:files.value,onRemove:removed})});app.config.globalProperties.$ui=value=>value;app.mount(root);await nextTick()
 expect(root.querySelectorAll('.pending-attachments article')).toHaveLength(2)
 root.querySelectorAll('.attachment-preview')[1].click();await nextTick()
 expect(root.querySelector('.attachment-viewer iframe').getAttribute('src')).toBe('blob:preview-2')
 root.querySelectorAll('.attachment-remove')[1].click();expect(removed).toHaveBeenCalledWith(1)
 files.value=[a];await nextTick();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2')
 app.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');root.remove()
})
