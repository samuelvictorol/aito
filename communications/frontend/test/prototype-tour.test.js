import { describe, expect, it } from 'vitest'
import { SHOWROOM_STEPS, TOUR_HELP_URL, SOURCE_SOLUTIONS_URL, restoreTour, storeTour, tourIndexForPath, spotlightRect, spotlightCardPosition } from '../src/services/prototype-tour.js'
import { prototypeSection } from '../src/services/prototype-data.js'

describe('curated prototype showroom',()=>{
 it('takes visitors through official campaigns, an actual local flow editor, human attendance and both extra channels without leaving the sandbox',()=>{
  expect(new Set(SHOWROOM_STEPS.map(step=>step.id)).size).toBe(SHOWROOM_STEPS.length)
  for(const step of SHOWROOM_STEPS){expect(step.path.startsWith('/prototype/')).toBe(true);expect(prototypeSection(step.path)?.key).toBe(step.key);expect(step.target).toBeTruthy();expect(step.description.length).toBeGreaterThan(60)}
  expect(SHOWROOM_STEPS.find(step=>step.id==='flow').path).toBe('/prototype/whatsapp-web/flows/demo-flow')
  expect(SHOWROOM_STEPS.find(step=>step.id==='official').description).toContain('API oficial da Meta')
  expect(SHOWROOM_STEPS.find(step=>step.id==='flow').description).toContain('QR Code')
  expect(SHOWROOM_STEPS.map(step=>step.key)).toEqual(expect.arrayContaining(['telegram','email','collaborators']))
  expect(new URL(TOUR_HELP_URL).pathname).toBe('/5561982637865')
  expect(new URL(SOURCE_SOLUTIONS_URL).pathname).toBe('/whatsapp-solucoes-whitelabel')
 })
 it('restores only valid checkpoint IDs and supports repeated app-mobile checkpoints without jumping back to the beginning',()=>{
  expect(restoreTour(null)).toEqual({index:0,started:false,completed:false})
  expect(restoreTour({step:'made-up',started:'yes',completed:1})).toEqual({index:0,started:false,completed:false})
  const last=SHOWROOM_STEPS.length-1
  expect(restoreTour(storeTour({index:last,started:true,completed:false}))).toEqual({index:last,started:true,completed:false})
  expect(tourIndexForPath('/prototype/app-mobile?source=demo',last)).toBe(last)
  expect(tourIndexForPath('/prototype/whatsapp-web/flows/demo-flow',0)).toBe(SHOWROOM_STEPS.findIndex(step=>step.id==='flow'))
  expect(tourIndexForPath('/admin')).toBe(-1)
 })
 it('falls back safely for missing or offscreen anchors and clamps the spotlight and card to small viewports',()=>{
  expect(spotlightRect(null,{width:390,height:650})).toBeNull()
  expect(spotlightRect({top:-500,left:20,width:100,height:20},{width:390,height:650})).toBeNull()
  expect(spotlightRect({top:20,left:-50,width:500,height:900},{width:390,height:650})).toEqual({top:12,left:8,width:374,height:630,right:382,bottom:642})
  const mobile=spotlightCardPosition(null,{width:390,height:650},500)
  expect(mobile.left).toBe(12);expect(mobile.right).toBe(12);expect(mobile.bottom).toBe(12);expect(mobile.maxHeight).toBeLessThan(650)
  const desktop=spotlightCardPosition({top:500,left:1200,width:200,height:300,right:1400,bottom:800},{width:1440,height:900},450)
  expect(desktop.left).toBeGreaterThanOrEqual(12);expect(desktop.left+desktop.width).toBeLessThanOrEqual(1440-12);expect(desktop.top).toBeGreaterThanOrEqual(12)
 })
})
