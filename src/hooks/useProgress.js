import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Cycles a tracked item through: untouched -> learning (yellow) -> mastered (green) -> untouched
// Progress is stored per-user in Supabase, keyed by the item's id string.
export function useProgress(userId) {
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('progress')
      .select('item_id, status')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[progress] failed to load:', error.message)
          setProgress({})
        } else {
          setProgress(Object.fromEntries(data.map((row) => [row.item_id, row.status])))
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const cycleStatus = useCallback(
    (itemId) => {
      setProgress((prev) => {
        const current = prev[itemId]
        const next = current === 'learning' ? 'mastered' : current === 'mastered' ? undefined : 'learning'
        const updated = { ...prev }
        if (next) {
          updated[itemId] = next
        } else {
          delete updated[itemId]
        }

        if (next) {
          supabase
            .from('progress')
            .upsert({ user_id: userId, item_id: itemId, status: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,item_id' })
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
