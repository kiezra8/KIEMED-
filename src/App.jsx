import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Auth from './pages/Auth'
import SetupWizard from './pages/SetupWizard'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Triage from './pages/Triage'
import Consultations from './pages/Consultations'
import Admissions from './pages/Admissions'
import Pharmacy from './pages/Pharmacy'
import Laboratory from './pages/Laboratory'
import Billing from './pages/Billing'
import Staff from './pages/Staff'
import Appointments from './pages/Appointments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Toast from './components/ui/Toast'
import { useClinicStore, useSyncStore, useAuthStore } from './store'

export default function App() {
  const { clinics, loadClinics, currentClinicId } = useClinicStore()
  const { setOnline, sync, startListening } = useSyncStore()
  const { user, loading, initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
    loadClinics()
  }, [])

  useEffect(() => {
    const handleOnline  = () => { setOnline(true);  sync(currentClinicId) }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine && currentClinicId) {
      sync(currentClinicId).then(() => startListening(currentClinicId))
    }

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [currentClinicId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏥</div>
          <div>Loading KIEMED...</div>
        </div>
      </div>
    )
  }

  // Auth guard: require account sign in or registration
  if (!user) {
    return (
      <>
        <Auth onAuthenticated={() => loadClinics()} />
        <Toast />
      </>
    )
  }

  // Show setup wizard if no clinics yet
  if (clinics.length === 0) {
    return (
      <>
        <SetupWizard />
        <Toast />
      </>
    )
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/patients/*"    element={<Patients />} />
          <Route path="/triage"        element={<Triage />} />
          <Route path="/consultations" element={<Consultations />} />
          <Route path="/admissions"    element={<Admissions />} />
          <Route path="/pharmacy"      element={<Pharmacy />} />
          <Route path="/laboratory"    element={<Laboratory />} />
          <Route path="/billing"       element={<Billing />} />
          <Route path="/staff"         element={<Staff />} />
          <Route path="/appointments"  element={<Appointments />} />
          <Route path="/reports"       element={<Reports />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="*"              element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
      <Toast />
    </BrowserRouter>
  )
}
