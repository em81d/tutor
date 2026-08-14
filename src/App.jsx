import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GeminiLiveClient } from './lib/geminiLiveClient'
import { supabase } from './lib/supabaseClient'
import { useUser } from './hooks/useUser'

const STATUS_LABEL = {
  idle: 'Start conversation',
  connecting: 'Connecting…',
  listening: 'End conversation',
  error: 'Try again',
}

// Persists the finished conversation + transcript, then asks the server to score
// which curriculum items it demonstrated. Fire-and-forget: failures are logged,
// not surfaced, since this shouldn't block the user from starting a new conversation.
async function saveConversation({ userId, startedAt, transcript }) {
  if (!supabase || !userId || transcript.length === 0) return

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({ user_id: userId, started_at: startedAt, ended_at: new Date().toISOString() })
    .select('id')
    .single()
  if (conversationError) {
    console.error('[conversation] failed to save:', conversationError.message)
    return
  }

  const { error: turnsError } = await supabase.from('transcript_turns').insert(
    transcript.map((turn, turnIndex) => ({
      conversation_id: conversation.id,
      turn_index: turnIndex,
      role: turn.role,
      text: turn.text,
    })),
  )
  if (turnsError) {
    console.error('[conversation] failed to save transcript:', turnsError.message)
    return
  }

  try {
    const response = await fetch('/api/analyze-conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversation.id }),
    })
    if (!response.ok) throw new Error(`analyze request failed (${response.status})`)
  } catch (err) {
    console.error('[conversation] failed to analyze:', err.message)
  }
}

function App() {
  const { user } = useUser()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState([])
  const clientRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const transcriptRef = useRef([])
  const startedAtRef = useRef(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => () => clientRef.current?.disconnect(), [])

  const appendTranscript = useCallback(({ role, text }) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1]
      const next = last && last.role === role ? [...prev.slice(0, -1), { role, text: last.text + text }] : [...prev, { role, text }]
      transcriptRef.current = next
      return next
    })
  }, [])

  const startConversation = useCallback(async () => {
    setError(null)
    setStatus('connecting')
    setTranscript([])
    transcriptRef.current = []
    startedAtRef.current = new Date().toISOString()
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
    saveConversation({ userId: user?.id, startedAt: startedAtRef.current, transcript: transcriptRef.current })
  }, [user?.id])

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
