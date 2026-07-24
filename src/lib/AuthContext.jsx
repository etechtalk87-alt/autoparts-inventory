import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [currentStaff, setCurrentStaff] = useState(null)
  const [activeBranchId, setActiveBranchIdState] = useState(() => localStorage.getItem('activeBranchId') || null)
  const [needsCompanySetup, setNeedsCompanySetup] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleSetActiveBranchId = (branchId) => {
    setActiveBranchIdState(branchId)
    if (branchId) {
      localStorage.setItem('activeBranchId', branchId)
    } else {
      localStorage.removeItem('activeBranchId')
    }
  }

  const fetchStaffForUser = async (authUser) => {
    if (!authUser?.id) {
      setCurrentStaff(null)
      setNeedsCompanySetup(false)
      setActiveBranchIdState(null)
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, company_id, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!staffError) {
      if (staffData) {
        let branchIds = []

        if (staffData.role !== 'company_admin') {
          const { data: branchRows } = await supabase
            .from('staff_branches')
            .select('branch_id')
            .eq('staff_id', staffData.id)

          branchIds = branchRows?.map((r) => r.branch_id) || []
        }

        const savedBranchId = localStorage.getItem('activeBranchId')
        let effectiveActiveBranchId = null

        if (branchIds.length > 0) {
          if (savedBranchId && branchIds.includes(savedBranchId)) {
            effectiveActiveBranchId = savedBranchId
          } else {
            effectiveActiveBranchId = branchIds[0] || null
          }
        } else {
          effectiveActiveBranchId = savedBranchId || null
        }

        if (effectiveActiveBranchId) {
          localStorage.setItem('activeBranchId', effectiveActiveBranchId)
        } else {
          localStorage.removeItem('activeBranchId')
        }

        setActiveBranchIdState(effectiveActiveBranchId)
        setCurrentStaff({
          ...staffData,
          branchIds,
          activeBranchId: effectiveActiveBranchId,
        })
        setNeedsCompanySetup(false)
      } else {
        setCurrentStaff(null)
        setNeedsCompanySetup(true)
      }
    } else {
      console.error('Error fetching staff record:', staffError)
      setCurrentStaff(null)
      setNeedsCompanySetup(false)
    }
  }

  const refreshStaff = async () => {
    await fetchStaffForUser(user)
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
      setActiveBranchIdState(null)
      localStorage.removeItem('activeBranchId')
      setNeedsCompanySetup(false)
    }

    setLoading(false)
    return { error }
  }

  const value = useMemo(
    () => ({
      user,
      session,
      currentStaff: currentStaff ? { ...currentStaff, activeBranchId } : null,
      activeBranchId,
      setActiveBranchId: handleSetActiveBranchId,
      needsCompanySetup,
      loading,
      signIn,
      signOut,
      refreshStaff,
    }),
    [user, session, currentStaff, activeBranchId, needsCompanySetup, loading],
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
