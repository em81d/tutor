import { getCurriculumItems } from '../src/data/curriculumItems.js'

const GEMINI_TEXT_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          correctness: { type: 'string', enum: ['correct', 'partial', 'incorrect'] },
          spontaneous: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['item_id', 'correctness', 'spontaneous', 'evidence'],
      },
    },
  },
  required: ['items'],
}

// correct+spontaneous use is worth more than a scaffolded/repeated one; a wrong
// attempt nudges the score down rather than resetting it, since one mistake
// after several correct uses shouldn't erase that progress.
function scoreDelta({ correctness, spontaneous }) {
  if (correctness === 'correct') return spontaneous ? 2 : 1
  if (correctness === 'partial') return spontaneous ? 1 : 0
  return -1
}

function clampScore(score) {
  return Math.max(1, Math.min(10, score))
}

function buildPrompt(turns, curriculumItems) {
  const transcriptText = turns.map((t) => `${t.role === 'user' ? 'User' : 'Tutor'}: ${t.text}`).join('\n')
  const itemsText = curriculumItems.map((i) => `${i.id} :: ${i.es} (${i.en}) [${i.type}]`).join('\n')

  return `You are grading a Spanish learner's practice conversation against a curriculum item list.

Below is a transcript of a spoken conversation between the User (the learner, speaking Spanish) and the Tutor (an AI conversation partner). Identify which curriculum items the User actually demonstrated correct or incorrect use of in their own turns — do not count an item just because the Tutor said it.

For grammar items, judge whether the User's own sentences correctly apply that grammar concept (e.g. correct verb conjugation, correct use of ser/estar, correct gender agreement), not whether they merely used a related word.

Only include items with clear evidence in the User's turns. Do not guess or include items that weren't actually used.

Mark "spontaneous" true if the User produced it on their own; false if they were clearly just repeating/echoing something the Tutor just said.

Curriculum items (id :: Spanish (English) [type]):
${itemsText}

Transcript:
${transcriptText}`
}

async function callGemini({ apiKey, model, prompt }) {
  const response = await fetch(GEMINI_TEXT_ENDPOINT(model), {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini analysis request failed (${response.status}): ${detail}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini analysis response had no text content')
  return JSON.parse(text).items ?? []
}

export async function analyzeConversation({ supabase, conversationId, apiKey, model }) {
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .single()
  if (conversationError) throw new Error(`could not load conversation: ${conversationError.message}`)

  const { data: turns, error: turnsError } = await supabase
    .from('transcript_turns')
    .select('role, text')
    .eq('conversation_id', conversationId)
    .order('turn_index', { ascending: true })
  if (turnsError) throw new Error(`could not load transcript: ${turnsError.message}`)
  if (!turns.length) return { scored: [] }

  const curriculumItems = getCurriculumItems()
  const prompt = buildPrompt(turns, curriculumItems)
  const findings = await callGemini({ apiKey, model, prompt })

  const validIds = new Set(curriculumItems.map((i) => i.id))
  const scored = []

  for (const finding of findings) {
    if (!validIds.has(finding.item_id)) continue
    const delta = scoreDelta(finding)

    const { data: existing, error: existingError } = await supabase
      .from('progress')
      .select('score')
      .eq('user_id', conversation.user_id)
      .eq('item_id', finding.item_id)
      .maybeSingle()
    if (existingError) throw new Error(`could not read progress: ${existingError.message}`)

    const baseline = existing?.score ?? 0
    const nextScore = clampScore(baseline + delta)

    if (existing || delta > 0) {
      const { error: upsertError } = await supabase
        .from('progress')
        .upsert(
          { user_id: conversation.user_id, item_id: finding.item_id, score: nextScore, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,item_id' },
        )
      if (upsertError) throw new Error(`could not save progress: ${upsertError.message}`)
    }

    const { error: eventError } = await supabase.from('progress_events').insert({
      user_id: conversation.user_id,
      item_id: finding.item_id,
      conversation_id: conversationId,
      delta,
      evidence: finding.evidence,
    })
    if (eventError) throw new Error(`could not log progress event: ${eventError.message}`)

    scored.push({ item_id: finding.item_id, delta, score: existing || delta > 0 ? nextScore : baseline })
  }

  return { scored }
}
