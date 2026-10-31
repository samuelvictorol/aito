import { cp, mkdir, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source=path.join(root,'communications/frontend/dist')
await access(path.join(source,'index.html'))
const target=path.join(root,'dist/spa/comunicacao/app')
await mkdir(target,{recursive:true})
await cp(source,target,{recursive:true})
console.log('Comunicação incorporada em /comunicacao/app/.')
