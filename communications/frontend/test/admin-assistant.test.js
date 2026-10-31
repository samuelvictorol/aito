import { beforeEach, describe, expect, it, vi } from 'vitest'
const http = vi.hoisted(() => ({ get:vi.fn(),post:vi.fn(),put:vi.fn(),delete:vi.fn() }))
vi.mock('../src/services/http.js', () => ({ http,unwrap:response=>response.data }))
import { assistantApi, assistantFilePath, actionConfirmationAllowed, assistantSafeDetails, assistantAttachmentError, assistantCapabilities, assistantConfigInput, assistantTheme, formatAssistantCost, parseAssistantBlocks } from '../src/services/admin-assistant.js'

beforeEach(()=>vi.clearAllMocks())
describe('Aito I.A action review and protected files',()=>{
  it('uses server capabilities for collaborators and never assumes configuration or execution rights from missing flags',()=>{
    expect(assistantCapabilities({},'collaborator')).toEqual({sharedAccount:true,canConfigure:false,canExecute:false})
    expect(assistantCapabilities({canExecute:true,canConfigure:false},'collaborator')).toEqual({sharedAccount:true,canConfigure:false,canExecute:true})
    expect(assistantCapabilities({sharedAccount:true})).toEqual({sharedAccount:true,canConfigure:false,canExecute:false})
    expect(assistantCapabilities({},'admin')).toEqual({sharedAccount:false,canConfigure:true,canExecute:true})
  })
  it('requires review and exact typed approval for destructive actions, refuses stale or already executed actions',()=>{
    const action={id:'qa',status:'pending',confirmationText:'EXCLUIR CONTATOS 48'}
    expect(actionConfirmationAllowed(action,{reviewed:true,phrase:'EXCLUIR CONTATOS 48'})).toBe(true)
    for(const form of [{reviewed:false,phrase:'EXCLUIR CONTATOS 48'},{reviewed:true,phrase:'excluir contatos 48'},{reviewed:true,phrase:'sim'},{reviewed:true}])expect(actionConfirmationAllowed(action,form)).toBe(false)
    expect(actionConfirmationAllowed({...action,status:'succeeded'},{reviewed:true,phrase:action.confirmationText})).toBe(false)
    expect(actionConfirmationAllowed({...action,expiresAt:new Date(Date.now()-1000).toISOString()},{reviewed:true,phrase:action.confirmationText})).toBe(false)
    expect(actionConfirmationAllowed({status:'pending'},{reviewed:false})).toBe(false)
    expect(actionConfirmationAllowed({status:'pending'},{reviewed:true})).toBe(true)
    expect(actionConfirmationAllowed({status:'pending',destructive:true},{reviewed:true})).toBe(false)
  })
  it('only fetches authenticated files from the assistant namespace, never arbitrary URLs or credential routes',async()=>{
    expect(assistantFilePath('/api/admin-assistant/files/qa_1-2')).toBe('/admin-assistant/files/qa_1-2')
    for(const path of ['https://example.test/file','//example.test/file','/settings','/admin-assistant/files/../config','/admin-assistant/files/%2e%2e','/admin-assistant/files/a?token=secret','/admin-assistant/files/a#x','/admin-assistant/files/a/b','/admin-assistant/files/a\\b'])expect(()=>assistantFilePath(path)).toThrow('indisponível')
    await expect(assistantApi.download('https://example.test/file')).rejects.toThrow()
    expect(http.get).not.toHaveBeenCalled()
  })
  it('masks nested credential values while preserving destination and content details for review',()=>{
    const input={to:'samuel@example.test',html:'<p>Mensagem</p>',settings:{GMAIL_APP_PASSWORD:'never expose',openaiApiKey:'hidden',nested:[{accessToken:'private',name:'Contato'}]}}
    const redacted=assistantSafeDetails(input)
    expect(JSON.stringify(redacted)).not.toMatch(/never expose|hidden|private/)
    expect(redacted.to).toBe(input.to);expect(redacted.html).toBe(input.html);expect(redacted.settings.nested[0].name).toBe('Contato')
    expect(input.settings.GMAIL_APP_PASSWORD).toBe('never expose')
  })
  it('preserves raw JSON/code for download without interpreting markup as executable content',()=>{
    const source='Fluxo pronto.\n```json\n{"name":"<script>alert(1)</script>"}\n```\nRevise antes de aplicar.'
    const blocks=parseAssistantBlocks(source)
    expect(blocks.map(block=>block.type)).toEqual(['text','code','text'])
    expect(JSON.parse(blocks[1].text).name).toBe('<script>alert(1)</script>')
    expect(blocks[2].text).toContain('Revise')
  })
  it('rejects oversized and unsupported attachments and does not misrepresent missing costs as zero',()=>{
    expect(assistantAttachmentError({name:'print.png',size:1024})).toBe('')
    expect(assistantAttachmentError({name:'programa.exe',size:1024})).not.toBe('')
    expect(assistantAttachmentError({name:'print.png',size:21*1024*1024})).toContain('20 MB')
    expect(assistantAttachmentError({name:'vazio.txt',size:0})).toContain('vazio')
    expect(formatAssistantCost(null)).toBe('Não disponível');expect(formatAssistantCost(0)).toBe('$0.00')
  })
  it('does not freeze automatic model tariffs into a manual override when switching models',()=>{
    const config={model:'gpt-6-astra',effort:'high',speed:'standard',apiKey:'',pricing:{inputPerMillion:2,outputPerMillion:10,cachedInputPerMillion:.1}}
    expect(assistantConfigInput(config,{enabled:false})).toEqual({model:config.model,effort:'high',speed:'standard'})
    expect(assistantConfigInput(config,{enabled:false},true).pricing).toBe(null)
    expect(assistantConfigInput(config,{enabled:true,input:'2',output:'10',cached:'0'}).pricing).toEqual({inputPerMillion:2,outputPerMillion:10,cachedInputPerMillion:0})
    expect(()=>assistantConfigInput(config,{enabled:true,input:' ',output:'10',cached:'0'})).toThrow('três preços')
    expect(assistantConfigInput({...config,apiKey:'   '},{enabled:false})).not.toHaveProperty('apiKey')
  })
  it('imports by source ID without including the old key or requiring a plaintext reveal',async()=>{
    const config={model:'gpt-6.1-sol',effort:'high',speed:'standard',keyMode:'import',keySourceId:'profile:chatgpt-whatsapp',apiKey:'sk-should-not-leave-this-form'}
    expect(assistantConfigInput(config,{enabled:false})).toEqual({model:config.model,effort:'high',speed:'standard',keySourceId:'profile:chatgpt-whatsapp'})
    expect(()=>assistantConfigInput({...config,keySourceId:null},{enabled:false})).toThrow('Selecione')
    http.get.mockResolvedValue({data:{items:[{id:config.keySourceId,label:'Perfil WhatsApp',available:true}]}})
    expect((await assistantApi.keySources()).items[0].id).toBe(config.keySourceId)
    expect(http.get).toHaveBeenCalledWith('/admin-assistant/key-sources')
  })
  it('keeps readable dialog text and button contrast even with very light or malformed brand colors',()=>{
    const light=assistantTheme({primaryColor:'#FFFFFF'}),dark=assistantTheme({primaryColor:'#000000'})
    expect(light['--aito-text']).toBe('#19352f')
    expect(light['--aito-accent']).toBe('#707070')
    expect(dark['--aito-background']).toBe('#f9f9f9')
    expect(assistantTheme({primaryColor:'url(malicious)'})).toEqual(assistantTheme())
    expect(assistantTheme({primaryColor:'#C000C0'})['--aito-brand']).toBe('#C000C0')
  })
})
