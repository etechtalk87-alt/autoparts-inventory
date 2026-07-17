import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [currentStaff, setCurrentStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStaffForUser = async (authUser) => {
    if (!authUser?.id) {
      setCurrentStaff(null)
      return
    }

    const { data, error } = await supabase
      .from('staff')
      .select('company_id, branch_id, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!error) {
      setCurrentStaff(data)
    } else {
      console.error('Error fetching staff record:', error)
      setCurrentStaff(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession()
      const initialSession = data?.session ?? null
      const initialUser = initialSession?.user ?? null

      if (isMounted) {
        setSession(initialSession)
        setUser(initialUser)
        setLoading(false)
        await fetchStaffForUser(initialUser)
      }
    }

    initializeAuth()

    const { data: authData } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return

      const nextUser = currentSession?.user ?? null
      setSession(currentSession)
      setUser(nextUser)
      setLoading(false)
      await fetchStaffForUser(nextUser)
    })

    return () => {
      isMounted = false
      authData?.subscription?.unsubscribe?.()
    }
  }, [])

  const signIn = async (email, password) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      setSession(data.session)
      setUser(data.user)
      await fetchStaffForUser(data.user)
    }

    setLoading(false)
    return { data, error }
  }

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()

    if (!error) {
      setSession(null)
      setUser(null)
      setCurrentStaff(null)
    }

    setLoading(false)
    return { error }
  }

  const value = useMemo(
    () => ({
      user,
      session,
      currentStaff,
      loading,
      signIn,
      signOut,
    }),
    [user, session, currentStaff, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
