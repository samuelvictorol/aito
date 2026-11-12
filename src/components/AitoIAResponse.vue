<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ text: { type: String, default: '' } })
const copied = ref(-1)
const blocks = computed(() => {
  const result = []
  let pending = []
  let language = null
  const flush = () => {
    if (pending.length) result.push({ code: language !== null, language, text: pending.join('\n') })
    pending = []
  }
  for (const line of props.text.split('\n')) {
    if (/^\s*\x60{3}/.test(line)) {
      flush()
      language = language === null ? line.replace(/^\s*\x60{3}/, '').trim().slice(0, 30) : null
    } else pending.push(line)
  }
  flush()
  return result
})

function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

function inline(value) {
  const parts = []
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\x60([^\x60\n]+)\x60/g
  let from = 0
  for (const match of value.matchAll(pattern)) {
    if (match.index > from) parts.push({ text: value.slice(from, match.index) })
    if (match[1]) parts.push({ text: match[1], href: safeUrl(match[2]) })
    else parts.push({ text: match[3] || match[4], kind: match[3] ? 'strong' : 'code' })
    from = match.index + match[0].length
  }
  if (from < value.length) parts.push({ text: value.slice(from) })
  return parts
}

function lines(value) {
  return value.split('\n').map(text => {
    if (/^#{1,6}\s+/.test(text)) return { heading: true, parts: inline(text.replace(/^#{1,6}\s+/, '')) }
    return { parts: inline(text.replace(/^\s*[-*]\s+/, '• ')) }
  })
}

async function copy(value, index) {
  try { await navigator.clipboard.writeText(value); copied.value = index } catch { copied.value = -1 }
}

function download(block) {
  const ext = { javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', html: 'html', css: 'css', json: 'json', sql: 'sql', yaml: 'yml' }[block.language] || 'txt'
  const url = URL.createObjectURL(new Blob([block.text], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'aitoia-codigo.' + ext
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="aito-response">
    <template v-for="(block, index) in blocks" :key="index">
      <div v-if="block.code" class="aito-response__code">
        <div class="aito-response__toolbar">
          <span>{{ block.language || 'Código' }}</span>
          <button type="button" aria-label="Baixar código" @click="download(block)"><q-icon name="mdi-download-outline" size="18px" /></button>
          <button type="button" :aria-label="copied === index ? 'Código copiado' : 'Copiar código'" @click="copy(block.text, index)"><q-icon :name="copied === index ? 'mdi-check' : 'mdi-content-copy'" size="17px" /></button>
        </div>
        <pre><code>{{ block.text }}</code></pre>
      </div>
      <div v-else class="aito-response__text">
        <div v-for="(line, position) in lines(block.text)" :key="position" :class="{ 'aito-response__heading': line.heading }">
          <template v-for="(part, i) in line.parts" :key="i">
            <a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
            <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
            <code v-else-if="part.kind === 'code'">{{ part.text }}</code>
            <template v-else>{{ part.text }}</template>
          </template><br v-if="!line.parts.length" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.aito-response { color: #ece8f2; font-size: .95rem; line-height: 1.7; overflow-wrap: anywhere; }
.aito-response__text { white-space: pre-wrap; }
.aito-response__text a { color: #d0baff; text-underline-offset: 3px; }
.aito-response__text code { padding: 1px 4px; border-radius: 4px; color: #e2cdfb; background: #2a2435; }
.aito-response__heading { font-weight: 750; }
.aito-response__code { margin: .75rem 0; overflow: hidden; border: 1px solid #393242; border-radius: 11px; background: #141119; }
.aito-response__toolbar { display: flex; gap: .3rem; align-items: center; padding: .3rem .65rem; color: #c6bccf; background: #221c2b; font-size: .74rem; }
.aito-response__toolbar span { flex: 1; }
.aito-response__toolbar button { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; color: inherit; background: transparent; cursor: pointer; }
.aito-response__toolbar button:hover { color: #fff; background: #ffffff12; }
.aito-response__code pre { margin: 0; overflow: auto; padding: 1rem; font-size: .83rem; line-height: 1.55; }
</style>
