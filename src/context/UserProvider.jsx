import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { UserContext } from './UserContext.js'

const STORAGE_KEY = 'curriculumUser'

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)
  const [error, setError] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = async (rawName) => {
    const name = rawName.trim()
    if (!name) return
    setError(null)
    setLoggingIn(true)
    try {
      const { data: existing, error: selectError } = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', name)
        .maybeSingle()
      if (selectError) throw selectError

      if (existing) {
        setUser(existing)
        return
      }

      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({ name })
        .select('id, name')
        .single()
      if (insertError) throw insertError

      setUser(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = () => setUser(null)

  return (
    <UserContext.Provider value={{ user, login, logout, error, loggingIn }}>{children}</UserContext.Provider>
  )
}
