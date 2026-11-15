<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  items: { type: Array, required: true },
  progress: { type: Number, default: 1 },
  reducedMotion: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])
const $q = useQuasar()
const columns = computed(() => $q.screen.width < 650 ? 3 : $q.screen.width < 1080 ? 5 : 7)
const rows = computed(() => {
  const result = []
  let start = 0
  while (start < props.items.length) {
    const size = columns.value - (result.length % 2)
    result.push(props.items.slice(start, start + size).map((item, index) => ({ item, index: start + index })))
    start += size
  }
  return result
})

function cellStyle(index) {
  const progress = props.reducedMotion ? 1 : props.progress
  const spread = 1 - progress
  const compact = columns.value === 3
  return {
    '--open': compact ? Math.max(.8, progress) : progress,
    '--dx': `${Math.sin(index * 2.39 + 0.5) * (compact ? 2 : 17) * spread}vw`,
    '--dy': `${Math.cos(index * 2.39 + 0.5) * (compact ? 1 : 19) * spread}vh`,
    '--turn': `${Math.sin(index * 1.89) * 68 * spread}deg`,
  }
}
</script>

<template>
  <div class="case-hive" :style="{ '--columns': columns }" aria-label="Produtos e cases">
    <ul v-for="(row, index) in rows" :key="index" class="case-hive__row">
      <li v-for="{ item, index: cellIndex } in row" :key="item.name" :style="cellStyle(cellIndex)">
        <router-link v-if="item.product" :to="item.href" class="case-hive__cell">
          <span class="case-hive__hex" aria-hidden="true"></span>
          <span class="case-hive__label"><img :src="item.imgUrl" alt="" width="48" height="48" /><strong>{{ item.name }}</strong></span>
        </router-link>
        <button v-else type="button" class="case-hive__cell" @click="emit('select', item)">
          <span class="case-hive__hex" aria-hidden="true"></span>
          <span class="case-hive__label"><img :src="'/' + item.imgUrl.replace(/^\//, '')" alt="" loading="lazy" width="48" height="48" /><strong>{{ item.name }}</strong></span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.case-hive{--cell-width:min(calc((100% - (var(--columns) - 1) * 7px) / var(--columns)),166px);width:min(1220px,100%);margin:0 auto;isolation:isolate}
.case-hive__row{display:flex;justify-content:center;gap:7px;list-style:none;margin:0;padding:0}.case-hive__row+.case-hive__row{margin-top:clamp(-29px,-2vw,-11px)}.case-hive__row>li{flex:0 0 var(--cell-width);min-width:0;aspect-ratio:1.03;position:relative}
.case-hive__cell{display:grid;place-items:center;width:100%;height:100%;padding:0;position:relative;border:0;background:none;color:#edf9f5;text-decoration:none;font:inherit;cursor:pointer;border-radius:18px}.case-hive__cell:focus-visible{outline:2px solid #bdffe9;outline-offset:2px;z-index:2}
.case-hive__hex{--outer:calc(49% - var(--open) * 49%);--shoulder:calc(50% - var(--open) * 25%);--tip:calc(46% - var(--open) * 44%);position:absolute;inset:0;clip-path:polygon(50% var(--tip),calc(100% - var(--outer)) var(--shoulder),calc(100% - var(--outer)) calc(100% - var(--shoulder)),50% calc(100% - var(--tip)),var(--outer) calc(100% - var(--shoulder)),var(--outer) var(--shoulder));transform:translate(var(--dx),var(--dy)) rotate(var(--turn));background:linear-gradient(150deg,#7ce4cb,#214942 75%);opacity:clamp(0,var(--open) * 4,1);pointer-events:none}
.case-hive__hex::before{content:'';position:absolute;inset:2px;background:radial-gradient(ellipse at 30% 10%,#26564c,#132b2d 72%);clip-path:inherit;opacity:calc(var(--open) * var(--open));transition:background .18s ease}.case-hive__cell:hover .case-hive__hex::before,.case-hive__cell:focus-visible .case-hive__hex::before{background:#285c4d}
.case-hive__label{display:grid;justify-items:center;align-content:center;gap:6px;z-index:1;width:87%;opacity:clamp(0,(var(--open) - .38) * 1.7,1);color:inherit;font-size:clamp(.68rem,1vw,.93rem);line-height:1.1;text-align:center;overflow-wrap:anywhere}.case-hive__label img{width:clamp(30px,4vw,53px);height:clamp(30px,4vw,53px);object-fit:contain;border-radius:6px}.case-hive__label strong{font-weight:720}
.case-hive__cell:focus-visible :is(.case-hive__hex,.case-hive__label){--open:1;transform:none;opacity:1}
@media(max-width:650px){.case-hive{--cell-width:min(calc((100% - (var(--columns) - 1) * 7px) / var(--columns)),132px)}.case-hive__row+.case-hive__row{margin-top:-12px}.case-hive__label{font-size:.76rem}.case-hive__label img{width:33px;height:33px}}
</style>
