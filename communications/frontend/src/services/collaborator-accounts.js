import { http, unwrap } from './http.js'
export const collaboratorAccountsApi = {
  list:()=>http.get('/collaborators').then(unwrap),
  permissions:()=>http.get('/collaborators/permissions').then(unwrap),
  create:input=>http.post('/collaborators',input).then(unwrap),
  update:(id,input)=>http.put('/collaborators/'+id,input).then(unwrap),
}
