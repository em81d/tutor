import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { analyzeConversation } from './progressAnalysis.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT = process.env.PORT || 8787
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-live-preview'
const VOICE = process.env.GEMINI_VOICE || 'Kore'
const SYSTEM_INSTRUCTION =
  process.env.GEMINI_SYSTEM_INSTRUCTION ||
  'You are a friendly, encouraging conversation partner. Keep replies short.'
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.1-flash'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!GEMINI_API_KEY) {
  console.warn('[server] GEMINI_API_KEY is not set — /api/live-token will fail until it is.')
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[server] SUPABASE_URL / SUPABASE_ANON_KEY are not set — /api/analyze-conversation will fail until they are.')
}

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const app = express()
app.use(express.json())

// Mints a short-lived, single-use token scoped to our model/voice config.
// The real API key never leaves this server or reaches the browser.
app.post('/api/live-token', async (req, res) => {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        bidiGenerateContentSetup: {
          model: `models/${MODEL}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
            },
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`token mint failed (${response.status}): ${detail}`)
    }

    const data = await response.json()
    res.json({
      token: data.name,
      model: MODEL,
      voice: VOICE,
      systemInstruction: SYSTEM_INSTRUCTION,
    })
  } catch (err) {
    console.error('[server] /api/live-token error:', err.message)
    res.status(500).json({ error: 'Could not create a Live API session token.' })
  }
})

// Scores which curriculum items a just-finished conversation demonstrated, using the
// transcript already persisted to Supabase by the client. Runs server-side because it
// needs the Gemini API key.
app.post('/api/analyze-conversation', async (req, res) => {
  const { conversationId } = req.body ?? {}
  if (!conversationId) {
    res.status(400).json({ error: 'conversationId is required' })
    return
  }
  if (!supabase) {
    res.status(500).json({ error: 'Supabase is not configured on the server.' })
    return
  }

  try {
    const result = await analyzeConversation({
      supabase,
      conversationId,
      apiKey: GEMINI_API_KEY,
      model: ANALYSIS_MODEL,
    })
    res.json(result)
  } catch (err) {
    console.error('[server] /api/analyze-conversation error:', err.message)
    res.status(500).json({ error: 'Could not analyze the conversation.' })
  }
})

// Serves the built frontend so the whole app is one deployable process.
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
