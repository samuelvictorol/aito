import { ref } from 'vue'

export function useVoiceRecorder(onFile, onError) {
  const recording = ref(false), seconds = ref(0), starting = ref(false)
  let recorder, stream, timer, generation = 0
  function release() { clearInterval(timer); stream?.getTracks().forEach(track => track.stop()); stream = null; recording.value = false }
  function cancel() {
    generation += 1
    if (recorder?.state === 'recording') recorder.stop()
    release(); starting.value = false
  }
  async function start() {
    if (starting.value || recording.value) return
    const run = ++generation
    starting.value = true
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador não permite gravar áudio. Você pode anexar um arquivo de áudio.')
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (run !== generation) { captured.getTracks().forEach(track => track.stop()); return }
      stream = captured
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder = current
      const chunks = []
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      current.onstop = () => {
        if (run !== generation) { captured.getTracks().forEach(track => track.stop()); return }
        release()
        const type = current.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type })
        if (!blob.size) return onError('A gravação ficou vazia. Tente novamente.')
        onFile(new File([blob], `audio-${Date.now()}.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`, { type }))
      }
      current.onerror = () => { if (run !== generation) return; cancel(); onError('Não foi possível concluir a gravação.') }
      recorder.start(); seconds.value = 0; recording.value = true
      timer = setInterval(() => { seconds.value += 1; if (seconds.value >= 180) stop() }, 1000)
    } catch (error) { if (run === generation) { release(); onError(error.name === 'NotAllowedError' ? 'Permita o microfone no navegador para gravar áudio.' : error.message) } }
    finally { if (run === generation) starting.value = false }
  }
  function stop() { if (recorder?.state === 'recording') recorder.stop() }
  return { recording, seconds, starting, start, stop, cancel }
}
