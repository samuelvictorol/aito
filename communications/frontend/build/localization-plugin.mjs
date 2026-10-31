import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'
import { parse as parseJs } from '@babel/parser'
import MagicString from 'magic-string'
import fs from 'node:fs'
import path from 'node:path'

const attributes = new Set(['label','title','caption','hint','placeholder','aria-label','alt','description','message','no-data-label','loading-label','rows-per-page-label'])
const internal = new Set(['class','style','type','name','key','id','value','icon','code','scope','permission','permissions','regex','event','channel','url','to','href','src','color','format','method','headers','template','model','modelId','confirmation','confirmationText','confirmDatabaseChange','confirmationKey'])
const comparison = /^(?:includes|startsWith|endsWith|replace|replaceAll|match|test|indexOf|matchMedia|select|populate|setItem|getItem|removeItem|querySelector|querySelectorAll|addEventListener|removeEventListener|on|off|emit|post|get|put|patch|delete|resolve|reject)$/
export function isCopy(value, explicit=false) {
  if (typeof value!=='string') return false
  const text=value.trim()
  if (!text || text.length>16000 || !/[A-Za-zÀ-ÿ]/.test(text)) return false
  if (/^(?:https?:|\/|\.|#[\w-]+$|[\w-]+\.[a-z]{2,8}$)/.test(text) || /^(?:q-|mdi-|text-|bg-|col-|row\b)/.test(text)) return false
  if (/^\s*<(?:!doctype|html|style|svg)|=>|\bfunction\s*\(|\bSELECT\b|\bINSERT\b/.test(text)) return false
  if (/^[+-][A-Za-z]|^\([\w-]+:|\bvar\(--|\dpx\b|\{\s*["']\w+["']\s*:/.test(text))return false
  if(!explicit&&/^[A-Z][A-Z0-9_ ]+$/.test(text))return false
  return explicit || /[À-ÿ]/.test(text) || (/\s/.test(text) && /[A-ZÀ-Ýa-zà-ÿ]{2}/.test(text))
}
function walk(node, visit, parent=null, display=false) {
  if (!node || typeof node!=='object') return
  if((node.type==='VariableDeclarator'||node.type==='FunctionDeclaration')&&/(?:labels?|titles?|captions?|descriptions?|hints?|placeholders?|names|(?:type|channel|status|action)Name|options)$/i.test(node.id?.name||''))display=true
  if(visit(node,parent,display)===false)return
  for (const [key,value] of Object.entries(node)) {
    if (['loc','start','end','extra','comments','tokens'].includes(key)) continue
    if (Array.isArray(value)) value.forEach(child=>walk(child,visit,node,display))
    else if(value && typeof value==='object') walk(value,visit,node,display)
  }
}
function canTranslate(node,parent) {
  if (!parent) return false
  if (/Import|Export/.test(parent.type) || parent.type==='Directive' || parent.type==='DirectiveLiteral') return false
  if (parent.type==='ObjectProperty') {
    if (parent.key===node) return false
    const key=parent.key?.name||parent.key?.value
    if(internal.has(key))return false
  }
  if (parent.type==='MemberExpression' || (parent.type==='BinaryExpression' && parent.operator!=='+')) return false
  if(parent.type==='CallExpression' && comparison.test(parent.callee?.property?.name||parent.callee?.name||''))return false
  if(parent.type==='CallExpression' && /^(?:uiText|\$ui|__uiText.*)$/.test(parent.callee?.name||''))return false
  return true
}
export function scriptCopies(code,{expression=false,translate=false,has=()=>true,helper='__uiText',display=false}={}) {
  const result=new MagicString(code),copies=[];let changes=0
  let ast;try{ast=parseJs(expression?'('+code+')':code,{sourceType:'module',plugins:['topLevelAwait','jsx']})}catch{return {code,copies,changes}}
  const offset=expression?1:0
  walk(ast,(node,parent,displayContext)=>{
    if(!canTranslate(node,parent))return
    if(node.type==='StringLiteral'&&node.value==='pt-BR'&&/toLocale|DateTimeFormat|NumberFormat/.test(parent?.callee?.property?.name||parent?.callee?.name||'')){
      if(translate){result.overwrite(node.start-offset,node.end-offset,helper==='\u0024ui'?'$locale()':`${helper}Locale()`);changes++}return false
    }
    if(node.type==='StringLiteral' && (isCopy(node.value,attributes.has(parent?.key?.name))||((display||displayContext)&&translate&&has(node.value.trim())&&/^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ-]+$/.test(node.value)))) {
      copies.push(node.value.trim())
      if(translate&&has(node.value.trim())){result.overwrite(node.start-offset,node.end-offset,`${helper}(${JSON.stringify(node.value)})`);changes++}
    }
    if(node.type==='TemplateLiteral' && parent?.type!=='TaggedTemplateExpression' && !node.expressions.some(expr=>expr.type==='TemplateLiteral')) {
      const value=node.quasis.map((part,index)=>(part.value.cooked??part.value.raw)+(index<node.expressions.length?`{${index}}`:'')).join('')
      if(!isCopy(value))return
      copies.push(value.trim())
      // Replacements in expressions are deliberately left intact: identifiers,
      // recipient data and protocol values never pass through the catalogue.
      if(translate&&has(value.trim())){const expressions=node.expressions.map(expr=>code.slice(expr.start-offset,expr.end-offset));result.overwrite(node.start-offset,node.end-offset,`${helper}(${JSON.stringify(value)},[${expressions.join(',')}])`);changes++;return false}
    }
  })
  return {code:result.toString(),copies,changes}
}
export function localizeSource(code,id,{translate=false,has=()=>true}={}) {
  const copies=[],result=new MagicString(code)
  if(!id.endsWith('.vue')){
    const js=scriptCopies(code,{translate,has});return {...js,code:js.changes?`import { uiText as __uiText, currentLocale as __uiTextLocale } from '/src/i18n/index.js'\n${js.code}`:code}
  }
  const {descriptor}=parseSfc(code)
  for(const block of [descriptor.script,descriptor.scriptSetup].filter(Boolean)){
    const helper=block.setup?'__uiTextSetup':'__uiText',js=scriptCopies(block.content,{translate,has,helper});copies.push(...js.copies)
    if(js.changes)result.overwrite(block.loc.start.offset,block.loc.end.offset,`\nimport { uiText as ${helper}, currentLocale as ${helper}Locale } from '/src/i18n/index.js'\n${js.code}`)
  }
  if(descriptor.template){
    const template=descriptor.template,ast=parseTemplate(template.content),base=template.loc.start.offset
    function visit(node,skip=false){
      skip ||= ['script','style','code','pre'].includes(node.tag)
      if(skip)return
      if(node.type===2 && isCopy(node.content,true)){
        copies.push(node.content.trim())
        if(translate&&has(node.content.trim()))result.overwrite(base+node.loc.start.offset,base+node.loc.end.offset,`{{ $ui(${JSON.stringify(node.content)}) }}`)
      }
      if(node.type===5){const js=scriptCopies(node.content.content,{expression:true,translate,has,helper:'$ui',display:true});copies.push(...js.copies);if(js.changes)result.overwrite(base+node.content.loc.start.offset,base+node.content.loc.end.offset,js.code)}
      for(const prop of node.props||[]){
        if(prop.type===6 && attributes.has(prop.name)&&prop.value&&isCopy(prop.value.content,true)){
          copies.push(prop.value.content.trim())
          if(translate&&has(prop.value.content.trim()))result.overwrite(base+prop.loc.start.offset,base+prop.loc.end.offset,`:${prop.name}="$ui(${JSON.stringify(prop.value.content).replace(/&/g,'&amp;').replace(/"/g,'&quot;')})"`)
        }
        if(prop.type===7 && prop.exp && prop.name!=='for'){
          const js=scriptCopies(prop.exp.content,{expression:true,translate,has,helper:'$ui',display:attributes.has(prop.arg?.content)});copies.push(...js.copies);if(js.changes)result.overwrite(base+prop.exp.loc.start.offset,base+prop.exp.loc.end.offset,js.code.replace(/&/g,'&amp;').replace(/"/g,'&quot;'))
        }
      }
      for(const child of node.children||[])visit(child,skip)
    }
    visit(ast)
  }
  return {code:result.toString(),copies}
}
export default function localizationPlugin({include}={}){
  let catalog,folded
  return {name:'notify-localized-interface',enforce:'pre',configResolved(config){catalog=JSON.parse(fs.readFileSync(path.join(config.root,'src/i18n/en.json'),'utf8'));folded=new Set(Object.keys(catalog).map(key=>key.toLocaleLowerCase('pt-BR')))},transform(code,id){
    const file=id.split('?')[0].replaceAll('\\','/')
    if(id.includes('?')||!file.includes('/src/')||file.includes('/src/i18n/')||! /\.(vue|js)$/.test(file)||file.endsWith('/main.js')||(include&&!include(file)))return
    const result=localizeSource(code,file,{translate:true,has:key=>Boolean(catalog[key])||folded.has(key.toLocaleLowerCase('pt-BR'))});if(result.code!==code)return {code:result.code,map:null}
  }}
}
