import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GeminiLiveClient } from './lib/geminiLiveClient'

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
    <div id="center" className="relative flex grow flex-col items-center justify-center gap-5 box-border px-5 py-8">
      <Link
        to="/curriculum"
        className="absolute top-5 right-5 text-[15px] text-accent no-underline hover:underline"
      >
        View curriculum
      </Link>

      <button
        className={`text-xl font-medium text-white rounded-full px-10 py-5 cursor-pointer transition-[transform,box-shadow] duration-150 shadow-[var(--shadow)] not-disabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 ${
          status === 'listening' ? 'bg-danger animate-pulse-glow' : 'bg-accent'
        }`}
        onClick={handleClick}
        disabled={status === 'connecting'}
      >
        {STATUS_LABEL[status]}
      </button>

      {error && <p className="max-w-[480px] text-[15px] text-danger">{error}</p>}

      {transcript.length > 0 && (
        <div className="w-full max-w-[560px] max-h-[40vh] overflow-y-auto text-left border border-border rounded-xl px-5 py-4 box-border">
          {transcript.map((turn, i) => (
            <p key={i} className="mb-3 leading-[145%]">
              <span className={`block text-[13px] font-semibold mb-0.5 ${turn.role === 'user' ? 'text-accent' : 'text-text-h'}`}>
                {turn.role === 'user' ? 'You' : 'Gemini'}
              </span>
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
