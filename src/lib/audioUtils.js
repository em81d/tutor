// Helpers for converting between the browser's audio types and the
// base64 raw-PCM payloads the Gemini Live API sends/expects.

export function int16ArrayToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64ToInt16Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

function int16ToFloat32(int16) {
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    const s = int16[i]
    float32[i] = s < 0 ? s / 0x8000 : s / 0x7fff
  }
  return float32
}

// Schedules incoming 24kHz PCM chunks back-to-back so playback stays
// gapless even though chunks arrive over the network at irregular times.
export class PcmPlayer {
  constructor(sampleRate = 24000) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    this.ctx = new Ctx({ sampleRate })
    this.nextStartTime = 0
    this.activeSources = new Set()
  }

  resume() {
    return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve()
  }

  enqueue(int16Data) {
    const float32 = int16ToFloat32(int16Data)
    const buffer = this.ctx.createBuffer(1, float32.length, this.ctx.sampleRate)
    buffer.copyToChannel(float32, 0)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)

    const startAt = Math.max(this.ctx.currentTime, this.nextStartTime)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration

    this.activeSources.add(source)
    source.onended = () => this.activeSources.delete(source)
  }

  // Called when the model is interrupted (barge-in) so stale audio
  // that's already scheduled doesn't keep playing over the user.
  clear() {
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
    }
    this.activeSources.clear()
    this.nextStartTime = this.ctx.currentTime
  }

  close() {
    this.clear()
    return this.ctx.close()
  }
}
