import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Activity, Stethoscope, BedDouble,
  Pill, FlaskConical, Receipt, Badge, Calendar, BarChart3,
  Settings, ChevronRight, Menu, X, Wifi, WifiOff, RefreshCw,
  Building2, Plus
} from 'lucide-react'
import { useClinicStore, useSyncStore, useToastStore } from '../../store'
import Modal from '../ui/Modal'

const NAV = [
  { to: '/dashboard',     label: 'Dashboard',     Icon: LayoutDashboard },
  { to: '/patients',      label: 'Patients',      Icon: Users },
  { to: '/triage',        label: 'Triage & Vitals', Icon: Activity },
  { to: '/consultations', label: 'Consultations', Icon: Stethoscope },
  { to: '/admissions',    label: 'Admissions',    Icon: BedDouble },
  { to: '/pharmacy',      label: 'Pharmacy',      Icon: Pill },
  { to: '/laboratory',    label: 'Laboratory',    Icon: FlaskConical },
  { to: '/billing',       label: 'Billing',       Icon: Receipt },
  { to: '/staff',         label: 'Staff',         Icon: Badge },
  { to: '/appointments',  label: 'Appointments',  Icon: Calendar },
  { to: '/reports',       label: 'Reports',       Icon: BarChart3 },
  { to: '/settings',      label: 'Settings',      Icon: Settings },
]

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clinicModal, setClinicModal] = useState(false)
  const { currentClinic, clinics, setCurrentClinic, createClinic } = useClinicStore()
  const { isOnline, isSyncing, lastSyncAt, sync } = useSyncStore()
  const { add: toast } = useToastStore()
  const navigate = useNavigate()

  const [newClinicName, setNewClinicName] = useState('')
  const [newClinicAddr, setNewClinicAddr] = useState('')

  const handleSync = () => {
    if (!isOnline) { toast('You are offline. Data will sync when connected.', 'warning'); return }
    sync(currentClinic?.id).then(() => toast('Sync complete!', 'success'))
  }

  const handleCreateClinic = async (e) => {
    e.preventDefault()
    if (!newClinicName.trim()) return
    await createClinic({ name: newClinicName.trim(), address: newClinicAddr.trim() })
    toast(`Clinic "${newClinicName}" created`, 'success')
    setNewClinicName(''); setNewClinicAddr('')
    setClinicModal(false)
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">🏥</div>
          <div>
            <div className="brand-name truncate" style={{ maxWidth: '150px', fontSize: '1.05rem' }}>
              {currentClinic?.name || 'HMS Portal'}
            </div>
            <div className="brand-sub">Clinical Management</div>
          </div>
        </div>

        {/* Clinic switcher */}
        <div className="sidebar-clinic-badge" onClick={() => setClinicModal(true)}>
          <Building2 size={14} color="var(--brand)" />
          <span className="clinic-badge-name truncate">{currentClinic?.name || 'No Clinic'}</span>
          <ChevronRight size={12} color="var(--text-muted)" />
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <Icon size={17} className="nav-icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">AD</div>
            <div>
              <div className="user-name">{currentClinic?.name || 'KIEMED'}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="app-main">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <button className="btn-icon" onClick={() => setSidebarOpen(s => !s)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          <div className="header-right">
            {/* Sync status */}
            <div className="sync-status" title={lastSyncAt ? `Last sync: ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Not synced'}>
              <div className={`sync-dot${isSyncing ? ' syncing' : isOnline ? ' online' : ''}`} />
              {isOnline ? (isSyncing ? 'Syncing…' : 'Online') : 'Offline'}
            </div>
            <button className="btn-icon" onClick={handleSync} title="Sync now">
              <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="app-content">
          {children}
        </div>
      </div>

      {/* Clinic modal */}
      {clinicModal && (
        <Modal title="Clinic Management" onClose={() => setClinicModal(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>YOUR CLINICS</div>
            <div className="clinic-switcher">
              {clinics.map(c => (
                <div
                  key={c.id}
                  className={`clinic-option${c.id === currentClinic?.id ? ' active' : ''}`}
                  onClick={() => { setCurrentClinic(c); setClinicModal(false); toast(`Switched to ${c.name}`, 'success') }}
                >
                  <div className="clinic-dot" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{c.name}</div>
                    {c.address && <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{c.address}</div>}
                  </div>
                  {c.id === currentClinic?.id && <span style={{ fontSize: '.7rem', color: 'var(--brand)', fontWeight: 700 }}>ACTIVE</span>}
                </div>
              ))}
            </div>
          </div>
          <hr className="divider" />
          <form onSubmit={handleCreateClinic}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>ADD NEW CLINIC</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Clinic Name <span className="req">*</span></label>
              <input className="form-control" value={newClinicName} onChange={e => setNewClinicName(e.target.value)} placeholder="e.g. KIEMED Kampala Branch" required />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Address</label>
              <input className="form-control" value={newClinicAddr} onChange={e => setNewClinicAddr(e.target.value)} placeholder="e.g. Plot 12, Nakasero, Kampala" />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              <Plus size={15} /> Create Clinic
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
