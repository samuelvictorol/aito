import test from 'node:test'
import assert from 'node:assert/strict'
import { commonVideoType, prepareCompatibleVideo } from '../src/services/aitoiaVideoCompatibility.js'

test('common phone and browser video containers retain their real MIME before normalization', () => {
  for (const [name, type] of [['camera.mov','video/quicktime'],['camera.m4v','video/x-m4v'],['capture.webm','video/webm'],['clip.mkv','video/x-matroska'],['capture.avi','video/x-msvideo'],['phone.3gp','video/3gpp']]) {
    assert.equal(commonVideoType(new File(['original'],name)),type)
  }
  assert.throws(() => commonVideoType(new File(['source'],'sound.mp3',{type:'audio/mpeg'})),/Use um vídeo/)
  assert.throws(() => commonVideoType(new File([], 'empty.mov')),/válido/)
})

test('a MOV is actually processed before provider upload, cached only after success and never relabeled as MP4', async () => {
  const source = new File(['mov-source'],'Camera.MOV',{type:'video/quicktime'})
  const calls=[]
  const post=async(url,file,config)=>{calls.push({url,file,config});return {data:new Blob(['converted-mp4'],{type:'video/mp4'})}}
  const signal=new AbortController().signal
  const output=await prepareCompatibleVideo(source,{post,signal})
  assert.equal(output.name,'Camera.mp4');assert.equal(output.type,'video/mp4');assert.equal(await output.text(),'converted-mp4')
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/aitoia/video/normalize');assert.equal(calls[0].file,source)
  assert.equal(calls[0].config.headers['Content-Type'],'video/quicktime');assert.equal(calls[0].config.signal,signal)
  assert.equal(await prepareCompatibleVideo(source,{post,signal}),output);assert.equal(calls.length,1)
})

test('failed, canceled or invalid conversion cannot produce a fake MP4 or leave a successful cache', async () => {
  const source=new File(['webm-source'],'camera.webm',{type:'video/webm'})
  await assert.rejects(prepareCompatibleVideo(source,{post:async()=>({data:new Blob(['html'],{type:'text/html'})})}),/MP4 válido/)
  const controller=new AbortController();controller.abort()
  let calls=0
  await assert.rejects(prepareCompatibleVideo(source,{post:async()=>{calls++;return{}},signal:controller.signal}),{name:'AbortError'})
  assert.equal(calls,0)
  await assert.rejects(prepareCompatibleVideo(source),/Entre na sua conta/)
})
