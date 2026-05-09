'use client'

import { useEffect, useState } from 'react'
import { type User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseUserResult {
  user: User | null
  loading: boolean
  error: Error | null
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Carrega sessão inicial
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) setError(error)
      setUser(data.user)
      setLoading(false)
    })

    // Subscreve mudanças de estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error }
}
