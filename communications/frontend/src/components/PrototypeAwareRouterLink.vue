<script>
import { computed, defineComponent, h } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { isPrototypePath, prototypeDestination } from '../services/prototype-mode.js'
export default defineComponent({
  inheritAttrs:false,props:RouterLink.props,
  setup(props,{attrs,slots}){
    const route=useRoute(),router=useRouter()
    const target=computed(()=>{
      if(!isPrototypePath(route.path))return props.to
      if(typeof props.to==='string'&&/^(?:https?:|mailto:|tel:|\/\/)/i.test(props.to))return props.to
      return prototypeDestination(router.resolve(props.to))
    })
    return ()=>h(RouterLink,{...attrs,...props,to:target.value},slots)
  },
})
</script>
