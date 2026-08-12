// AudioWorkletProcessor that converts the mic's float32 samples to
// 16-bit PCM and posts each render quantum back to the main thread.
class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelData = inputs[0] && inputs[0][0]
    if (channelData && channelData.length) {
      const int16 = new Int16Array(channelData.length)
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]))
        int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      }
      this.port.postMessage(int16)
    }
    return true
  }
}

registerProcessor('pcm-recorder', PCMRecorderProcessor)
