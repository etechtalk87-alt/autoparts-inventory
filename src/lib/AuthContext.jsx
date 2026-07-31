import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [currentStaff, setCurrentStaff] = useState(null)
  const [activeBranchId, setActiveBranchIdState] = useState(() => localStorage.getItem('activeBranchId') || null)
  const [needsCompanySetup, setNeedsCompanySetup] = useState(false)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleSetActiveBranchId = (branchId) => {
    setActiveBranchIdState(branchId)
    if (branchId) {
      localStorage.setItem('activeBranchId', branchId)
    } else {
      localStorage.removeItem('activeBranchId')
    }
  }

  const fetchStaffForUser = async (authUser, skipInviteCheck = false) => {
    if (!authUser?.id) {
      setCurrentStaff(null)
      setNeedsCompanySetup(false)
      setActiveBranchIdState(null)
      setNeedsPasswordSetup(false)
      return
    }

    const userNeedsPassword = authUser?.user_metadata?.needs_password === true
    setNeedsPasswordSetup(userNeedsPassword)

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

        const { data: companyData } = await supabase
          .from('companies')
          .select('vat_enabled, trn_number')
          .eq('id', staffData.company_id)
          .maybeSingle()

        setCurrentStaff({
          ...staffData,
          branchIds,
          activeBranchId: effectiveActiveBranchId,
          vatEnabled: companyData?.vat_enabled || false,
          trnNumber: companyData?.trn_number || null,
        })
        setNeedsCompanySetup(false)
      } else {
        if (!skipInviteCheck) {
          // No staff row yet — check whether a pending invite can be auto-accepted
          const { data: acceptResult } = await supabase.rpc('accept_staff_invite')
          if (acceptResult?.success === true) {
            // Staff row now exists — re-fetch it.
            // skipInviteCheck=true prevents accept_staff_invite from being called again.
            await fetchStaffForUser(authUser, true)
            return
          }
        }
        // No pending invite (or post-accept re-fetch) — genuine new signup
        setCurrentStaff(null)
        setNeedsCompanySetup(true)
      }
    } else {
      console.error('Error fetching staff record:', staffError)
      setCurrentStaff(null)
      setNeedsCompanySetup(false)
    }
  }

  const clearPasswordSetupFlag = async () => {
    await supabase.auth.updateUser({ data: { needs_password: false } })
    setNeedsPasswordSetup(false)
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
      setNeedsPasswordSetup(false)
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
      needsPasswordSetup,
      loading,
      signIn,
      signOut,
      refreshStaff,
      clearPasswordSetupFlag,
    }),
    [user, session, currentStaff, activeBranchId, needsCompanySetup, needsPasswordSetup, loading],
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
