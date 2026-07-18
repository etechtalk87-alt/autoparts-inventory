import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Branches from './pages/Branches'
import Customers from './pages/Customers'
import DonorVehicles from './pages/DonorVehicles'
import Parts from './pages/Parts'
import PartsImport from './pages/PartsImport'
import Transfers from './pages/Transfers'
import Sales from './pages/Sales'
import SetupCompany from './pages/SetupCompany'
import { supabase } from './lib/supabaseClient'

function App() {
  const { user, loading, currentStaff, needsCompanySetup } = useAuth()

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from('branches').select('*')

      if (error) {
        console.error('Error fetching branches:', error)
        return
      }

      console.log('Branches data:', data)
    }

    if (user) {
      fetchBranches()
    }
  }, [user])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/setup-company" element={needsCompanySetup ? <SetupCompany /> : <Navigate to="/" replace />} />
          {needsCompanySetup ? (
            <Route path="*" element={<Navigate to="/setup-company" replace />} />
          ) : (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/branches"
                element={currentStaff?.role === 'company_admin' ? <Branches /> : <Navigate to="/" replace />}
              />
              <Route
                path="/customers"
                element={currentStaff?.role === 'company_admin' ? <Customers /> : <Navigate to="/" replace />}
              />
              <Route path="/donor-vehicles" element={<DonorVehicles />} />
              <Route path="/parts" element={<Parts />} />
              <Route path="/parts/import" element={currentStaff?.role === 'company_admin' || currentStaff?.role === 'branch_staff' ? <PartsImport /> : <Navigate to="/parts" replace />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
