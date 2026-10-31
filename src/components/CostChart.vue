<template>
  <section class="cost-chart">
    <div class="cost-chart__head">
      <span>{{ title }}</span>
      <q-icon name="mdi-chart-donut" aria-hidden="true" />
    </div>
    <div class="cost-chart__canvas">
      <canvas ref="canvasElement"></canvas>
      <p v-if="!values.length" class="cost-chart__empty">Sem dados ainda</p>
    </div>
  </section>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart } from 'chart.js/auto'

const props = defineProps({
  light: Boolean,
  title: { type: String, required: true },
  type: { type: String, default: 'doughnut' },
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  colors: { type: Array, default: () => ['#13bc9d', '#8fffee', '#23917d', '#50dcc4', '#12ad89'] },
})
const emit = defineEmits(['select'])

const canvasElement = ref(null)
let chart

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

async function renderChart() {
  await nextTick()
  if (!canvasElement.value) return
  chart?.destroy()
  if (!props.values.length) return

  chart = new Chart(canvasElement.value, {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: [{
        label: 'Valor',
        data: props.values,
        backgroundColor: props.colors,
        borderColor: props.light?'#ffffff':'#061819',
        borderWidth: 2,
        borderRadius: props.type === 'bar' ? 6 : 0,
      }],
    },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: {
          display: props.type !== 'bar',
          labels: { color: props.light?'#557463':'#bffaf0', boxWidth: 12, usePointStyle: true },
        },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${formatMoney(context.raw)}` } },
        onClick: (_event, elements) => {
          const element = elements?.[0]
          if (element) emit('select', { index: element.index, label: props.labels[element.index] })
        },
      },
      scales: props.type === 'bar'
        ? {
            x: { ticks: { color: props.light?'#557463':'#9cefe0' }, grid: { color: props.light?'#cfe5d8':'rgba(143,255,238,.08)' } },
            y: { ticks: { color: props.light?'#557463':'#9cefe0', callback: (value) => formatMoney(value) }, grid: { color: props.light?'#cfe5d8':'rgba(143,255,238,.08)' } },
          }
        : undefined,
    },
  })
}

watch(() => [props.labels, props.values, props.type], renderChart, { deep: true })
onMounted(renderChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<style scoped>
.cost-chart { min-width: 0; padding: 1rem; border: 1px solid rgba(19,188,157,.22); border-radius: .7rem; background: rgba(4,24,25,.68); }
.cost-chart__head { display: flex; align-items: center; justify-content: space-between; gap: .8rem; color: #effffb; font-size: .75rem; font-weight: 800; }
.cost-chart__head .q-icon { color: #8fffee; }
.cost-chart__canvas { position: relative; height: 220px; margin-top: .8rem; }
.cost-chart__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: rgba(229,255,250,.5); font-size: .72rem; }
</style>
