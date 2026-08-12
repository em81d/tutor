import { int16ArrayToBase64, base64ToInt16Array, PcmPlayer } from './audioUtils'

// The "Constrained" WS method + v1alpha are what ephemeral tokens use;
// standard API keys instead use v1beta's plain BidiGenerateContent.
const WS_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained'

const MIC_SAMPLE_RATE = 16000
const PLAYBACK_SAMPLE_RATE = 24000
const SEND_INTERVAL_MS = 150

// Thin wrapper around the Gemini Live API's WebSocket protocol: fetches
// a short-lived session token from our own backend, opens the socket,
// streams mic audio to it, and plays back the model's audio response
// as it arrives. The real Gemini API key never reaches the browser.
export class GeminiLiveClient {
  constructor({ onStatusChange = () => {}, onTranscript = () => {}, onError = () => {} } = {}) {
    this.onStatusChange = onStatusChange
    this.onTranscript = onTranscript
    this.onError = onError

    this.ws = null
    this.setupDone = false
    this.player = new PcmPlayer(PLAYBACK_SAMPLE_RATE)

    this.micStream = null
    this.micContext = null
    this.micWorklet = null
    this.pendingChunks = []
    this.sendTimer = null
  }

  async fetchSessionConfig() {
    const response = await fetch('/api/live-token', { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error || `Could not get a session token (${response.status}).`)
    }
    return response.json()
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.fetchSessionConfig()
        .then(({ token, model, voice, systemInstruction }) => {
          const url = `${WS_ENDPOINT}?access_token=${encodeURIComponent(token)}`
          this.ws = new WebSocket(url)

          this.ws.onopen = () => {
            this.ws.send(
              JSON.stringify({
                setup: {
                  model: `models/${model}`,
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                    },
                  },
                  systemInstruction: systemInstruction
                    ? { parts: [{ text: systemInstruction }] }
                    : undefined,
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                },
              }),
            )
          }

          this.attachSocketHandlers(resolve, reject)
        })
        .catch((err) => {
          this.onError(err)
          reject(err)
        })
    })
  }

  attachSocketHandlers(resolve, reject) {
    this.ws.onmessage = async (event) => {
      const text = typeof event.data === 'string' ? event.data : await event.data.text()
      const message = JSON.parse(text)

      if (message.setupComplete) {
        this.setupDone = true
        this.onStatusChange('listening')
        resolve()
        return
      }

      this.handleServerMessage(message)
    }

    this.ws.onerror = () => {
      this.onError(new Error('WebSocket error — check the server logs and your network connection.'))
      reject(new Error('WebSocket error'))
    }

    this.ws.onclose = (event) => {
      this.onStatusChange('idle')
      if (!this.setupDone) {
        reject(new Error(`Connection closed before setup finished (code ${event.code}).`))
      }
    }
  }

  handleServerMessage(message) {
    const content = message.serverContent
    if (!content) return

    if (content.interrupted) {
      this.player.clear()
    }

    const parts = content.modelTurn?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.data) {
        this.player.resume()
        this.player.enqueue(base64ToInt16Array(part.inlineData.data))
      }
    }

    if (content.inputTranscription?.text) {
      this.onTranscript({ role: 'user', text: content.inputTranscription.text })
    }
    if (content.outputTranscription?.text) {
      this.onTranscript({ role: 'model', text: content.outputTranscription.text })
    }
  }

  async startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const Ctx = window.AudioContext || window.webkitAudioContext
    this.micContext = new Ctx({ sampleRate: MIC_SAMPLE_RATE })
    await this.micContext.audioWorklet.addModule('/worklets/pcm-recorder-worklet.js')

    const source = this.micContext.createMediaStreamSource(this.micStream)
    this.micWorklet = new AudioWorkletNode(this.micContext, 'pcm-recorder')
    this.micWorklet.port.onmessage = (event) => {
      this.pendingChunks.push(event.data)
    }

    source.connect(this.micWorklet)

    this.sendTimer = setInterval(() => this.flushMicBuffer(), SEND_INTERVAL_MS)
  }

  flushMicBuffer() {
    if (!this.pendingChunks.length || this.ws?.readyState !== WebSocket.OPEN) return

    const totalLength = this.pendingChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of this.pendingChunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    this.pendingChunks = []

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: int16ArrayToBase64(combined),
            mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
          },
        },
      }),
    )
  }

  stopMic() {
    if (this.sendTimer) {
      clearInterval(this.sendTimer)
      this.sendTimer = null
    }
    this.flushMicBuffer()

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }))
    }

    this.micWorklet?.port.close()
    this.micWorklet?.disconnect()
    this.micContext?.close()
    this.micStream?.getTracks().forEach((track) => track.stop())

    this.micWorklet = null
    this.micContext = null
    this.micStream = null
    this.pendingChunks = []
  }

  disconnect() {
    this.stopMic()
    this.player.close()
    this.ws?.close()
    this.ws = null
    this.setupDone = false
  }
}
