import {expect,it} from 'vitest'
import {searchRecipientOptions} from '../src/services/recipient-search.js'
it('filters recipient names, accents and formatted phones without replacing selected values',()=>{
 const options=[{label:'Samuel',value:'a',searchText:'Samuel +55 (61) 99999-0000'},{label:'Láura',value:'b',searchText:'Láura laura@example.com'}]
 expect(searchRecipientOptions(options,'laura').map(item=>item.value)).toEqual(['b'])
 expect(searchRecipientOptions(options,'5561999990000').map(item=>item.value)).toEqual(['a'])
 expect(searchRecipientOptions(options,'absent')).toEqual([])
 expect(searchRecipientOptions(options,'')).toBe(options)
 expect(options[0].value).toBe('a')
})
