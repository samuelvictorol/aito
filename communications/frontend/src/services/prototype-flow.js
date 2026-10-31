const action=(type,extra={})=>({type,headers:[],recipients:[],contactGroupIds:[],...extra})
const node=(nodeId,type,label,x,y,messages=[],extra={})=>({nodeId,type,position:{x,y},data:{label,messages:messages.map(text=>({type:'text',text,outputId:nodeId+'-text'})),action:action('http'),addTags:[],removeTags:[],...extra}})
const edge=(source,target,label='',keywords=[])=>({edgeId:source+'-'+target,source,target,label,keywords,regex:'',priority:0,matchMode:'any',event:''})
export const PROTOTYPE_FLOW={_id:'demo-flow',name:'Atendimento e relacionamento',description:'Explore o editor oficial. Suas alterações ficam apenas nesta tela.',active:true,channels:['whatsapp'],settings:{collectWindowMs:500,resetAfterMinutes:60,messageIntervalMs:500,fallbackMessage:'Digite 1, 2 ou 3 para escolher. Digite menu para recomeçar.',matchFirstMessage:false},nodes:[
  node('start','start','Boas-vindas',30,180,['*Olá! Bem-vindo(a).*\nComo podemos ajudar?\n\n1. Conhecer os serviços\n2. Tirar dúvidas com IA\n3. Falar com nossa equipe']),
  node('choice','choice','Escolha do contato',370,180),
  node('services','message','Nossos serviços',720,0,['Conheça nossas soluções de atendimento e automação. Podemos ajudar a organizar sua operação.']),
  node('ai','ai','Assistente de atendimento',720,230,['Envie sua dúvida. Nosso assistente ajuda com as orientações e transfere para a equipe quando necessário.'],{ai:{profileKey:'assistente-demo',includeHistory:true,historyLimit:12}}),
  node('human','action','Atendimento humano',720,480,['Vamos encaminhar você à equipe.'],{action:action('chat',{chatAction:'takeover',chatActionValue:60})}),
  node('end','end','Conclusão',1070,0,['Estamos à disposição. Para recomeçar, digite *menu*.']),
],edges:[edge('start','choice','Automático'),edge('choice','services','1 · Serviços',['1','serviços']),edge('choice','ai','2 · Assistente IA',['2','ia']),edge('choice','human','3 · Equipe',['3','equipe']),edge('services','end','Automático')]}

const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function simulatePrototypeFlow(input={}){
  const flow=input.flow||PROTOTYPE_FLOW,events=[],trace=label=>events.push({type:'trace',label,at:0}),context=JSON.parse(JSON.stringify(input.context||{}))
  context.variables={...context.variables,mensagem:String(input.text||'').slice(0,5000),nome:'Contato de exemplo',telefone:'5511900000001'}
  const text=normalized(input.text),nodes=flow.nodes||[],edges=flow.edges||[]
  const byId=id=>nodes.find(n=>n.nodeId===id),message=(node,text)=>events.push({type:'message',nodeId:node.nodeId,output:{type:'text',text},at:events.filter(e=>e.type==='message').length*250})
  const render=value=>String(value||'').replace(/\{\{([^}]+)\}\}/g,(_,key)=>String(context.variables[key.trim()]??''))
  const matches=e=>{const keys=e.keywords||[];if(keys.some(word=>normalized(word)===text))return true;if(e.regex&&String(e.regex).length<=100){try{return new RegExp(e.regex,'iu').test(String(input.text||'').slice(0,1000))}catch{return false}}return false}
  const outgoing=id=>edges.filter(e=>e.source===id).sort((a,b)=>(b.priority||0)-(a.priority||0))
  let current=byId(context.nodeId),enter=false
  if(!current||text==='menu'||context.mode==='closed'){current=nodes.find(n=>n.type==='start')||nodes[0];context.mode='bot';context.paymentNodeId=null;enter=true}
  else if(context.paymentNodeId){if(!input.paymentEvent)return {events,context};current=byId(outgoing(context.paymentNodeId).find(e=>e.event===input.paymentEvent)?.target);context.paymentNodeId=null;enter=true;trace('Pagamento apenas simulado; nenhuma cobrança foi criada.')}
  else if(context.mode==='human'){trace('Atendimento humano simulado. Nenhuma mensagem é enviada.');return {events,context}}
  else if(current.type==='ai'){message(current,input.aiResponse||'Resposta fictícia da IA: posso orientar sobre os serviços e encaminhar sua solicitação à equipe.');trace('OpenAI não foi chamada; consumo de tokens: zero.');return {events,context}}
  else{const next=outgoing(current.nodeId).find(matches);if(next){current=byId(next.target);enter=true}else{message(current,flow.settings?.fallbackMessage||'Escolha uma das opções ou digite menu.');return {events,context}}}
  for(let steps=0;current&&enter&&steps<40;steps++){
    context.nodeId=current.nodeId;trace('Card: '+current.data?.label)
    for(const output of current.data?.messages||[]){if(output.type==='text')message(current,render(output.text));else message(current,'['+({media:'Arquivo de demonstração',location:'Localização de exemplo',contact:'Contato fictício'}[output.type]||'Mídia')+']')}
    if(current.type==='end'){context.mode='closed';break}
    if(current.type==='ai'){context.mode='ai';break}
    if(current.type==='action'){
      const a=current.data?.action||{}
      if(a.type==='set_variable')context.variables[a.variableName]=render(a.variableValue)
      else if(a.type==='chat'&&a.chatAction==='takeover'){context.mode='human';break}
      else if(a.type==='infinitepay'){context.paymentNodeId=current.nodeId;context.variables.payment_url='[link de checkout fictício]';message(current,'Checkout demonstrativo. Use “Simular pago” ou “Simular recusado”. Nenhuma cobrança será criada.');break}
      else if(!['wait','set_variable'].includes(a.type)){trace('Ação '+a.type+' apenas ilustrativa. Nenhum endpoint ou destinatário é acionado.');const fixture=input.fixtures?.[current.nodeId];if(fixture)context.variables[a.resultVariable||'api_result']=fixture}
    }
    const auto=outgoing(current.nodeId).find(e=>!e.event&&!e.regex&&!e.keywords?.length)
    if(!auto||current.type==='choice')break
    current=byId(auto.target)
  }
  return {events,context,error:null}
}
