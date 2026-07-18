import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Branches from './pages/Branches'
import Customers from './pages/Customers'
import DonorVehicles from './pages/DonorVehicles'
import Parts from './pages/Parts'
import PartsImport from './pages/PartsImport'
import Transfers from './pages/Transfers'
import Sales from './pages/Sales'
import { supabase } from './lib/supabaseClient'

function App() {
  const { user, loading, currentStaff } = useAuth()

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
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
