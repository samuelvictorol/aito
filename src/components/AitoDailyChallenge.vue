<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { useAitoIATheme } from 'src/composables/useAitoIATheme'
import { createDailyChallengeTracker, dailyChallengeSession } from 'src/services/aitoDailyChallenge'

const props = defineProps({ enabled: { type: Boolean, default: true } })
const route = useRoute()
const { isDark } = useAitoIATheme()
const open = ref(false)
const challenge = ref(null)
const complete = computed(() => challenge.value?.completed === true)
const rewarded = computed(() => challenge.value?.rewarded === true)
const streak = computed(() => challenge.value?.streak || 0)
const title = computed(() => complete.value ? 'Você completou os 3 dias!' : streak.value === 1 ? 'Seu primeiro dia está valendo' : 'Dois dias. Falta só mais um!')
const description = computed(() => {
  if (complete.value) return rewarded.value
    ? 'Mais 25.000 AitoTokens já estão na sua carteira. Hora de dar vida à próxima ideia.'
    : 'Seus três dias foram confirmados. Os 25.000 AitoTokens estão aguardando liberação e serão creditados automaticamente.'
  return streak.value === 1
    ? 'Você começou com 25.000 AitoTokens. Volte nos próximos dois dias para ganhar mais 25.000.'
    : 'Seu acesso de hoje foi registrado. Volte amanhã para completar o desafio e ganhar mais 25.000 AitoTokens.'
})

let tracker
const visible = () => props.enabled && document.visibilityState === 'visible'
const enter = () => { void tracker?.enter() }
function storageChanged(event) { tracker?.storageChanged(event); enter() }
const stopRouteWatch = watch(() => route.fullPath, enter)
watch(() => props.enabled, enabled => { if (enabled) enter(); else open.value = false })

onMounted(() => {
  tracker = createDailyChallengeTracker({
    getSession: () => dailyChallengeSession(localStorage), storage: localStorage, visible,
    request: async token => (await api.post('/auth/daily-challenge/visit', {}, { headers: { Authorization: `Bearer ${token}` } })).data.data,
    onChange: value => {
      if ('challenge' in value) challenge.value = value.challenge
      if ('open' in value) open.value = value.open
    },
    onReward: () => window.dispatchEvent(new CustomEvent('aito:wallet-updated')),
  })
  document.addEventListener('visibilitychange', enter)
  window.addEventListener('focus', enter)
  window.addEventListener('aito:session-changed', enter)
  window.addEventListener('storage', storageChanged)
  enter()
})

onBeforeUnmount(() => {
  stopRouteWatch()
  tracker?.dispose()
  document.removeEventListener('visibilitychange', enter)
  window.removeEventListener('focus', enter)
  window.removeEventListener('aito:session-changed', enter)
  window.removeEventListener('storage', storageChanged)
})
</script>

<template>
  <q-dialog v-model="open" aria-labelledby="aito-daily-challenge-title" aria-describedby="aito-daily-challenge-description">
    <q-card :dark="isDark" class="aito-ai-theme daily-challenge" :class="{ 'daily-challenge--complete': complete }">
      <button type="button" class="daily-challenge__close" aria-label="Fechar desafio diário" @click="open = false"><q-icon name="mdi-close" size="22px" /></button>
      <div class="daily-challenge__hero" aria-hidden="true"><q-icon :name="complete ? 'mdi-gift-open-outline' : 'mdi-calendar-check-outline'" size="36px" /></div>
      <span class="daily-challenge__eyebrow">{{ complete ? 'Desafio concluído' : 'Desafio de boas-vindas' }}</span>
      <h2 id="aito-daily-challenge-title">{{ title }}</h2>
      <p id="aito-daily-challenge-description" class="daily-challenge__description">{{ description }}</p>

      <ol class="daily-challenge__days" :aria-label="`${streak} de 3 dias consecutivos concluídos`">
        <li v-for="day in 3" :key="day" :class="{ 'is-done': day <= streak, 'is-next': day === streak + 1 }" :aria-current="day === streak ? 'step' : undefined">
          <span class="daily-challenge__step"><q-icon v-if="day <= streak" name="mdi-check" size="22px" aria-hidden="true" /><span v-else>{{ day }}</span></span>
          <strong>Dia {{ day }}</strong>
          <small>{{ day <= streak ? 'Concluído' : day === streak + 1 ? 'Amanhã' : 'Na sequência' }}</small>
        </li>
      </ol>

      <div class="daily-challenge__prize">
        <img src="/aitotokens.svg" width="40" height="40" alt="" />
        <div><span>{{ complete ? rewarded ? 'Bônus recebido' : 'Bônus confirmado' : 'Sua recompensa ao completar' }}</span><strong>+25.000 <small>AitoTokens</small></strong></div>
        <q-icon v-if="rewarded" name="mdi-check-decagram" size="25px" aria-label="Bônus creditado" />
      </div>

      <p v-if="challenge?.reset && !complete" class="daily-challenge__reset" role="status"><q-icon name="mdi-refresh" size="18px" aria-hidden="true" /> Um dia ficou de fora. Sua sequência recomeçou hoje; o bônus continua disponível.</p>
      <p v-if="!complete" class="daily-challenge__rule">Entre em 3 dias seguidos. Se faltar um dia, a contagem recomeça. Cada dia segue o horário de Brasília.</p>
      <p v-else-if="!rewarded" class="daily-challenge__rule">Você não precisa refazer o desafio. A recompensa será liberada na mesma carteira.</p>
      <button type="button" class="daily-challenge__continue" @click="open = false">{{ complete ? 'Continuar criando' : 'Combinado, até amanhã!' }}<q-icon name="mdi-arrow-right" size="20px" aria-hidden="true" /></button>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.daily-challenge { --daily-on-accent: #03120f; position: relative; width: min(92vw, 440px); max-height: calc(100dvh - 40px); padding: 30px 28px 25px; overflow-y: auto; border: 1px solid var(--aito-ai-line); border-radius: 24px; color: var(--aito-ai-text); background: radial-gradient(circle at 50% 0, var(--aito-ai-accent-soft), transparent 260px), var(--aito-ai-surface); box-shadow: 0 28px 90px var(--aito-ai-shadow); text-align: center; }
html[data-aito-ia-theme='light'] .daily-challenge { --daily-on-accent: #fff; }
.daily-challenge__close { position: absolute; top: 12px; right: 12px; display: grid; width: 40px; height: 40px; place-items: center; border: 0; border-radius: 50%; color: var(--aito-ai-muted); background: transparent; cursor: pointer; }
.daily-challenge__close:hover { color: var(--aito-ai-text); background: var(--aito-ai-accent-soft); }
.daily-challenge__hero { display: grid; width: 72px; height: 72px; margin: 0 auto 18px; place-items: center; border: 1px solid var(--aito-ai-line); border-radius: 22px; color: var(--aito-ai-accent); background: var(--aito-ai-accent-soft); transform: rotate(-5deg); }
.daily-challenge--complete .daily-challenge__hero { color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); border-color: var(--aito-ai-gold-line); }
.daily-challenge__eyebrow { color: var(--aito-ai-accent); font-size: .67rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.daily-challenge h2 { margin: 8px 0 10px; color: var(--aito-ai-text); font-size: clamp(1.28rem, 5vw, 1.6rem); font-weight: 780; line-height: 1.2; }
.daily-challenge__description { margin: 0; color: var(--aito-ai-muted); font-size: .88rem; line-height: 1.6; }
.daily-challenge__days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 25px 0; padding: 0; list-style: none; }
.daily-challenge__days li { display: grid; justify-items: center; gap: 5px; min-width: 0; color: var(--aito-ai-muted); }
.daily-challenge__step { display: grid; width: 45px; height: 45px; margin-bottom: 3px; place-items: center; border: 1px dashed var(--aito-ai-line); border-radius: 50%; font-size: 1rem; font-weight: 750; background: var(--aito-ai-panel); }
.daily-challenge__days .is-done .daily-challenge__step { color: var(--daily-on-accent); border-style: solid; border-color: var(--aito-ai-accent); background: var(--aito-ai-accent); }
.daily-challenge__days .is-next .daily-challenge__step { color: var(--aito-ai-accent); border-color: var(--aito-ai-accent); }
.daily-challenge__days strong { color: var(--aito-ai-text); font-size: .8rem; }
.daily-challenge__days small { font-size: .67rem; }
.daily-challenge__prize { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 15px 12px; border: 1px solid var(--aito-ai-gold-line); border-radius: 15px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); text-align: left; }
.daily-challenge__prize img { flex: none; }
.daily-challenge__prize div { display: grid; gap: 3px; }
.daily-challenge__prize span { font-size: .67rem; }
.daily-challenge__prize strong { font-size: 1.3rem; line-height: 1.25; }
.daily-challenge__prize small { font-size: .74rem; font-weight: 600; }
.daily-challenge__reset { display: flex; gap: 7px; margin: 16px 0 0; color: var(--aito-ai-text); font-size: .76rem; line-height: 1.5; text-align: left; }
.daily-challenge__reset .q-icon { flex: none; margin-top: 2px; color: var(--aito-ai-accent); }
.daily-challenge__rule { margin: 16px 2px; color: var(--aito-ai-muted); font-size: .72rem; line-height: 1.6; }
.daily-challenge__continue { display: flex; width: 100%; min-height: 48px; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; padding: 11px 13px; border: 1px solid var(--aito-ai-accent); border-radius: 12px; color: var(--daily-on-accent); background: var(--aito-ai-accent); font: inherit; font-size: .84rem; font-weight: 750; cursor: pointer; }
.daily-challenge__close:focus-visible, .daily-challenge__continue:focus-visible { outline: 3px solid var(--aito-ai-gold); outline-offset: 3px; }
@media (max-width: 380px) { .daily-challenge { padding: 25px 19px 20px; } .daily-challenge__days { gap: 7px; } .daily-challenge__prize strong { font-size: 1.15rem; } }
</style>
