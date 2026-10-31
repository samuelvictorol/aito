import { http, unwrap } from './http.js'

export const adminAccountsApi = {
  list: params => http.get('/admin-accounts', { params }).then(unwrap),
  create: input => http.post('/admin-accounts', input).then(unwrap),
}
