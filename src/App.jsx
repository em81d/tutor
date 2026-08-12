import { useCallback, useEffect, useRef, useState } from 'react'
import { GeminiLiveClient } from './lib/geminiLiveClient'
import './App.css'

const STATUS_LABEL = {
  idle: 'Start conversation',
  connecting: 'Connecting…',
  listening: 'End conversation',
  error: 'Try again',
}

function App() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState([])
  const clientRef = useRef(null)
  const transcriptEndRef = useRef(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => () => clientRef.current?.disconnect(), [])

  const appendTranscript = useCallback(({ role, text }) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { role, text: last.text + text }]
      }
      return [...prev, { role, text }]
    })
  }, [])

  const startConversation = useCallback(async () => {
    setError(null)
    setStatus('connecting')
    try {
      const client = new GeminiLiveClient({
        onStatusChange: setStatus,
        onTranscript: appendTranscript,
        onError: (err) => setError(err.message),
      })
      clientRef.current = client
      await client.connect()
      await client.startMic()
    } catch (err) {
      setError(err.message)
      setStatus('error')
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [appendTranscript])

  const endConversation = useCallback(() => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setStatus('idle')
  }, [])

  const handleClick = () => {
    if (status === 'listening') {
      endConversation()
    } else if (status === 'idle' || status === 'error') {
      startConversation()
    }
  }

  return (
    <div id="center">
      <button
        className={`talk-button ${status}`}
        onClick={handleClick}
        disabled={status === 'connecting'}
      >
        {STATUS_LABEL[status]}
      </button>

      {error && <p className="error">{error}</p>}

      {transcript.length > 0 && (
        <div className="transcript">
          {transcript.map((turn, i) => (
            <p key={i} className={`turn ${turn.role}`}>
              <span className="role">{turn.role === 'user' ? 'You' : 'Gemini'}</span>
              {turn.text}
            </p>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  )
}

export default App
