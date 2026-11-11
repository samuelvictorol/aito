<script setup>
import { computed } from 'vue'
import { routeAllowed } from '../services/access.js'
import { inPrototype } from '../services/prototype-runtime.js'
import { whatsappWebNavigation } from '../modules/whatsapp-web/navigation.js'

const props = defineProps({ user: { type: Object, required: true }, compact: Boolean })
const base = inPrototype() ? '/prototype/whatsapp-web' : '/whatsapp-web'
const visible = computed(() => whatsappWebNavigation.filter(item => routeAllowed('/whatsapp-web' + item.path, props.user)))
const primary = computed(() => visible.value.filter(item => ['', '/connection', '/flows'].includes(item.path)))
const tools = computed(() => props.compact ? visible.value : visible.value.filter(item => !primary.value.includes(item)))
</script>

<template>
  <nav v-if="visible.length" class="whatsapp-shortcuts" :class="{ 'whatsapp-shortcuts--compact': compact }" aria-label="Atalhos do WhatsApp Web">
    <template v-if="!compact">
      <q-btn v-for="item in primary" :key="item.path" flat no-caps :icon="item.icon" :label="item.label" :to="base + item.path" />
    </template>
    <q-btn-dropdown v-if="tools.length" flat no-caps icon="apps" :label="compact ? 'WhatsApp Web' : 'Mais ferramentas'" auto-close>
      <q-list class="whatsapp-shortcuts__menu" aria-label="Ferramentas do WhatsApp Web">
        <q-item v-for="item in tools" :key="item.path" clickable :to="base + item.path">
          <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
  </nav>
</template>

<style scoped>
.whatsapp-shortcuts{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:5px;margin:0 0 18px;border:1px solid #cce7dc;border-radius:13px;background:#fafffc;color:#1b5743}
.whatsapp-shortcuts>.q-btn{min-height:40px;font-size:12px}
.whatsapp-shortcuts>.q-btn-dropdown{margin-left:auto}
.whatsapp-shortcuts--compact{flex:none;margin:0;padding:3px 12px;border-width:0 0 1px;border-radius:0;background:var(--aito-panel,#fafffc)}
.whatsapp-shortcuts--compact>.q-btn-dropdown{margin-left:0;font-size:11px}
.whatsapp-shortcuts__menu{min-width:240px;max-width:calc(100vw - 24px);max-height:65dvh;overflow:auto;padding:6px;color:#1b493d}
@media(max-width:600px){.whatsapp-shortcuts>.q-btn{font-size:11px;min-height:36px}.whatsapp-shortcuts>.q-btn-dropdown{margin-left:0}}
</style>
