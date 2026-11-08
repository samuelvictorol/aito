import {it,expect,vi} from 'vitest'
import {sendAttachmentBatch} from '../src/services/attachment-batch.js'
it('stops on failure and acknowledges only accepted files without retrying',async()=>{
 const upload=vi.fn(async f=>{if(f==='b')throw Error('failure')}),accepted=vi.fn()
 await expect(sendAttachmentBatch(['a','b','c'],{isActive:()=>true,upload,accepted})).rejects.toThrow('failure')
 expect(upload.mock.calls.map(c=>c[0])).toEqual(['a','b']);expect(accepted.mock.calls).toEqual([['a']])
})
it('does not send remaining attachments after changing conversation',async()=>{
 let active=true;const upload=vi.fn(async()=>{active=false}),accepted=vi.fn()
 await sendAttachmentBatch(['a','b'],{isActive:()=>active,upload,accepted})
 expect(upload).toHaveBeenCalledTimes(1);expect(accepted).not.toHaveBeenCalled()
})
