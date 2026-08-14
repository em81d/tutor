import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { LEARNING_SCORE, MASTERED_SCORE, scoreToBucket } from '../lib/progressScore'

// Tracks a 1-10 score per item, keyed by the item's id string, persisted per-user in Supabase.
// The UI only cares about the derived bucket (see scoreToBucket): untouched -> learning -> mastered.
export function useProgress(userId) {
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('progress')
      .select('item_id, score')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[progress] failed to load:', error.message)
          setProgress({})
        } else {
          setProgress(Object.fromEntries(data.map((row) => [row.item_id, row.score])))
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Manual click cycle: untouched -> learning -> mastered -> untouched, same as before,
  // just backed by a score instead of a status string.
  const cycleStatus = useCallback(
    (itemId) => {
      setProgress((prev) => {
        const currentBucket = scoreToBucket(prev[itemId])
        const nextScore =
          currentBucket === 'learning' ? MASTERED_SCORE : currentBucket === 'mastered' ? undefined : LEARNING_SCORE
        const updated = { ...prev }
        if (nextScore) {
          updated[itemId] = nextScore
        } else {
          delete updated[itemId]
        }

        if (nextScore) {
          supabase
            .from('progress')
            .upsert(
              { user_id: userId, item_id: itemId, score: nextScore, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,item_id' },
            )
            .then(({ error }) => {
              if (error) console.error('[progress] failed to save:', error.message)
            })
        } else {
          supabase
            .from('progress')
            .delete()
            .eq('user_id', userId)
            .eq('item_id', itemId)
            .then(({ error }) => {
              if (error) console.error('[progress] failed to clear:', error.message)
            })
        }

        return updated
      })
    },
    [userId],
  )

  return { progress, cycleStatus, loading }
}
