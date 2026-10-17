import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { positionFromSectionCenters } from './landingScrollPosition'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function useLandingScroll(sectionCount = 1) {
  const scrollProgress = ref(0)
  const sectionPosition = ref(0)
  const viewportHeight = ref(0)
  const prefersReducedMotion = ref(false)

  let mediaQuery
  let measurementFrame = 0
  let transitionFrame = 0
  let transitionStartedAt = 0
  let transitionTarget = null
  let wheelAccumulator = 0
  let wheelLocked = false
  let lastWheelAt = 0

  const activeSection = computed(() =>
    clamp(Math.round(sectionPosition.value), 0, Math.max(sectionCount - 1, 0))
  )

  const measure = () => {
    measurementFrame = 0
    viewportHeight.value = window.innerHeight

    const sections = getSections()

    if (sections.length) {
      const viewportCenter = window.scrollY + window.innerHeight / 2
      const centers = sections.map((section) => {
        const rect = section.getBoundingClientRect()
        return window.scrollY + rect.top + rect.height / 2
      })

      const measuredPosition = positionFromSectionCenters(centers, viewportCenter)

      sectionPosition.value = clamp(
        measuredPosition,
        0,
        Math.max(sections.length - 1, 0)
      )
      scrollProgress.value = clamp(
        sectionPosition.value / Math.max(sections.length - 1, 1),
        0,
        1
      )
      return
    }

    const scrollableHeight = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1
    )

    scrollProgress.value = clamp(window.scrollY / scrollableHeight, 0, 1)
    sectionPosition.value = scrollProgress.value * Math.max(sectionCount - 1, 0)
  }

  const scheduleMeasurement = () => {
    if (measurementFrame) return
    measurementFrame = window.requestAnimationFrame(measure)
  }

  const updateMotionPreference = (event) => {
    prefersReducedMotion.value = event.matches
  }

  const getSections = () =>
    Array.from(document.querySelectorAll('[data-landing-3d-section]'))

  const finishTransition = () => {
    wheelLocked = false
    wheelAccumulator = 0
    transitionTarget = null
    transitionFrame = 0
    measure()
  }

  const monitorTransition = (timestamp) => {
    if (!transitionTarget) {
      finishTransition()
      return
    }

    const reachedTarget = Math.abs(transitionTarget.getBoundingClientRect().top) < 2
    const wheelIsQuiet = timestamp - lastWheelAt > 160
    const transitionExpired = timestamp - transitionStartedAt > 1800

    if ((reachedTarget && wheelIsQuiet) || transitionExpired) {
      finishTransition()
      return
    }

    transitionFrame = window.requestAnimationFrame(monitorTransition)
  }

  const startTransition = (target) => {
    const sections = getSections()
    const targetIndex = typeof target === 'number'
      ? target
      : sections.findIndex((section) => section.id === target)
    const targetSection = sections[clamp(targetIndex, 0, sections.length - 1)]

    if (!targetSection) return

    if (transitionFrame) {
      window.cancelAnimationFrame(transitionFrame)
    }

    wheelLocked = true
    wheelAccumulator = 0
    transitionTarget = targetSection
    transitionStartedAt = performance.now()
    lastWheelAt = Math.min(lastWheelAt, transitionStartedAt - 200)

    targetSection.scrollIntoView({
      behavior: prefersReducedMotion.value ? 'auto' : 'smooth',
      block: 'start'
    })

    transitionFrame = window.requestAnimationFrame(monitorTransition)
  }

  const normalizeWheelDelta = (event) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight
    return event.deltaY
  }

  const handleWheel = (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

    const direction = Math.sign(event.deltaY)
    const sections = getSections()
    const current = sections.find(section => {
      const rect = section.getBoundingClientRect()
      return rect.top <= 2 && rect.bottom > 2
    })
    if (current) {
      const rect = current.getBoundingClientRect()
      if (rect.height > window.innerHeight + 4 &&
          ((direction > 0 && rect.bottom > window.innerHeight + 2) ||
           (direction < 0 && rect.top < -2))) return
    }
    event.preventDefault()
    lastWheelAt = performance.now()

    if (wheelLocked) return

    wheelAccumulator += normalizeWheelDelta(event)
    if (Math.abs(wheelAccumulator) < 18) return

    const stepDirection = Math.sign(wheelAccumulator)
    const nextSection = clamp(
      (current ? sections.indexOf(current) : activeSection.value) + stepDirection,
      0,
      Math.max(sectionCount - 1, 0)
    )

    wheelAccumulator = 0
    if (nextSection === activeSection.value) return

    startTransition(nextSection)
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mediaQuery.matches

    document.documentElement.classList.add('landing-3d-scroll')
    document.body.classList.add('landing-3d-scroll')

    window.addEventListener('scroll', scheduleMeasurement, { passive: true })
    window.addEventListener('resize', scheduleMeasurement, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: false })
    mediaQuery.addEventListener?.('change', updateMotionPreference)

    measure()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', scheduleMeasurement)
    window.removeEventListener('resize', scheduleMeasurement)
    window.removeEventListener('wheel', handleWheel)
    mediaQuery?.removeEventListener?.('change', updateMotionPreference)

    document.documentElement.classList.remove('landing-3d-scroll')
    document.body.classList.remove('landing-3d-scroll')

    if (measurementFrame) {
      window.cancelAnimationFrame(measurementFrame)
    }

    if (transitionFrame) {
      window.cancelAnimationFrame(transitionFrame)
    }
  })

  return {
    activeSection,
    prefersReducedMotion,
    scrollProgress,
    scrollToSection: startTransition,
    sectionPosition,
    viewportHeight
  }
}
