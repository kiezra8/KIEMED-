import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Activity, Stethoscope, BedDouble, Receipt, Shield,
  Lock, Unlock, ChevronRight, PlusCircle, AlertCircle, Building2,
  TrendingUp, Clock, RefreshCw, HeartPulse, Baby
} from 'lucide-react'
import { useClinicStore, usePinStore, useSyncStore } from '../store'
import { localGetAll } from '../lib/db'
import PinModal from '../components/ui/PinModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentClinic, clinics } = useClinicStore()
  const { pinUnlocked, hasPIN, lock } = usePinStore()
  const { isOnline, sync } = useSyncStore()

  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [stats, setStats] = useState({
    patientsCount: 0,
    todayConsults: 0,
    occupiedBeds: 0,
    totalBeds: 0,
    pendingTriage: 0,
    pendingLabs: 0,
    todayRevenue: 0,
    totalRevenue: 0,
    otcRevenue: 0,
    multiClinicRevenue: 0,
  })
  const [recentPatients, setRecentPatients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    const handleDataChange = (e) => {
      loadDashboardData()
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id])

  const loadDashboardData = async () => {
    if (!currentClinic?.id) return
    setLoading(true)

    try {
      const [allPatients, allConsults, allBeds, allVitals, allLabs, allInvoices] = await Promise.all([
        localGetAll('patients', currentClinic.id),
        localGetAll('consultations', currentClinic.id),
        localGetAll('beds', currentClinic.id),
        localGetAll('vitals', currentClinic.id),
        localGetAll('lab_requests', currentClinic.id),
        localGetAll('invoices', currentClinic.id),
      ])

      // Calculate clinic revenue
      const today = new Date().toISOString().slice(0, 10)
      const clinicRevenue = allInvoices.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0)
      const todayRev = allInvoices
        .filter(inv => (inv.created_at || '').startsWith(today))
        .reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0)

      // Direct Pass-by / OTC Pharmacy sales
      const otcSales = allInvoices
        .filter(inv => inv.is_direct_sale || inv.category?.includes('OTC') || inv.description?.includes('Direct Drug Sale') || inv.description?.includes('OTC'))
        .reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0)

      // Multi-clinic revenue computation across ALL branches
      const allClinicsInvoices = await localGetAll('invoices')
      const totalMultiRevenue = allClinicsInvoices.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0)

      const occupied = allBeds.filter(b => b.status === 'occupied').length
      const bedCap = Number(currentClinic?.bed_capacity || currentClinic?.total_beds || allBeds.length || 20)

      setStats({
        patientsCount: allPatients.length,
        todayConsults: allConsults.filter(c => (c.created_at || '').startsWith(today)).length,
        occupiedBeds: occupied,
        totalBeds: bedCap,
        pendingTriage: allPatients.length - allVitals.length > 0 ? allPatients.length - allVitals.length : 0,
        pendingLabs: allLabs.filter(l => l.status === 'pending').length,
        todayRevenue: todayRev,
        totalRevenue: clinicRevenue,
        otcRevenue: otcSales,
        multiClinicRevenue: totalMultiRevenue,
      })

      // Most recent 5 patients
      setRecentPatients(allPatients.slice(-5).reverse())
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amt) => {
    return `UGX ${Number(amt || 0).toLocaleString('en-US')}`
  }

  return (
    <div className="dashboard-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner with Hospital/Clinic Name - NO KIEMED */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.75rem',
        background: 'var(--card-bg, #1e293b)',
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #f8fafc)', letterSpacing: '-0.02em' }}>
            {currentClinic?.name || 'Medical Centre & Hospital'}
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem' }}>
            {currentClinic?.address ? `${currentClinic.address} &middot; ` : ''}{currentClinic?.district || 'Uganda'} &middot; Inpatient Bed Capacity: <strong>{stats.totalBeds} Beds</strong> &middot; Real-Time Clinical Management
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => loadDashboardData()}
            className="btn btn-secondary btn-sm"
            title="Refresh Metrics"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate('/patients/new')}
            className="btn btn-primary btn-sm"
          >
            <PlusCircle size={15} />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Patients */}
        <div className="stat-card" onClick={() => navigate('/patients')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Total Patients</span>
              <h2 className="stat-value" style={{ margin: '0.5rem 0' }}>{stats.patientsCount}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered at this branch</span>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Users size={22} />
            </div>
          </div>
        </div>

        {/* Triage & Consultations */}
        <div className="stat-card" onClick={() => navigate('/consultations')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Today's Consults</span>
              <h2 className="stat-value" style={{ margin: '0.5rem 0' }}>{stats.todayConsults}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--brand)' }}>Active clinical encounters</span>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Stethoscope size={22} />
            </div>
          </div>
        </div>

        {/* Ward Bed Occupancy */}
        <div className="stat-card" onClick={() => navigate('/admissions')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Bed Occupancy</span>
              <h2 className="stat-value" style={{ margin: '0.5rem 0' }}>
                {stats.occupiedBeds} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {stats.totalBeds}</span>
              </h2>
              <span style={{ fontSize: '0.8rem', color: stats.occupiedBeds > stats.totalBeds * 0.8 ? 'var(--danger)' : 'var(--text-muted)' }}>
                {stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0}% capacity
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <BedDouble size={22} />
            </div>
          </div>
        </div>

        {/* Diagnostics & Lab Orders */}
        <div className="stat-card" onClick={() => navigate('/laboratory')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Pending Lab Tests</span>
              <h2 className="stat-value" style={{ margin: '0.5rem 0' }}>{stats.pendingLabs}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Malaria / CBC / Urinalysis</span>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
              <Activity size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* PIN PROTECTED FINANCE CARD - STRICT REQUIREMENT */}
      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        padding: '1.5rem',
        marginBottom: '1.75rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border, #334155)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: pinUnlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: pinUnlocked ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {pinUnlocked ? <Unlock size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Financial Overview & Total Collections
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {pinUnlocked
                  ? 'PIN verified. Displaying branch collections and multi-clinic aggregates.'
                  : 'Financial figures are protected. Authorization PIN required to view revenue.'}
              </p>
            </div>
          </div>

          <div>
            {pinUnlocked ? (
              <button
                onClick={() => lock()}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Lock size={14} />
                <span>Hide / Lock Finances</span>
              </button>
            ) : (
              <button
                onClick={() => setPinModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Shield size={14} />
                <span>{hasPIN ? 'Enter PIN to View' : 'Unlock Finances'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial figures masked or revealed */}
        {pinUnlocked ? (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Today's Collections ({currentClinic?.name})</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--brand)', marginTop: '0.4rem' }}>
                  {formatCurrency(stats.todayRevenue)}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Branch Total Revenue</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                  {formatCurrency(stats.totalRevenue)}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Direct OTC / Pass-by Pharmacy</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.4rem' }}>
                  {formatCurrency(stats.otcRevenue)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Part of branch & multi-clinic total
                </div>
              </div>

              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.2))',
                borderRadius: '8px',
                border: '1px solid var(--brand)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={16} color="var(--brand)" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--brand)', fontWeight: 600 }}>All Clinics Total Revenue</span>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--brand)', marginTop: '0.4rem' }}>
                  {formatCurrency(stats.multiClinicRevenue)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Aggregated across {clinics.length} branch{clinics.length > 1 ? 'es' : ''}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => navigate('/billing')}
                className="btn btn-link btn-sm"
                style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                Go to Full Billing & Invoicing Desk <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            border: '1px dashed var(--border)'
          }}>
            <Lock size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
            <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)' }}>Financial Statistics Hidden</h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              To protect sensitive financial records from onlookers in public clinic areas, revenue metrics remain confidential until authenticated.
            </p>
            <button
              onClick={() => setPinModalOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              Authenticate with PIN
            </button>
          </div>
        )}
      </div>

      {/* Two Column: Clinical Programs (IMNCI / APGAR / Quick Launch) + Recent Patients */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Uganda MoH Clinical Shortcuts */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.25rem'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HeartPulse size={18} color="var(--brand)" />
            Clinical Guidance & Triage Standards
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              onClick={() => navigate('/triage')}
              style={{
                padding: '0.85rem',
                background: 'var(--surface-color, #0f172a)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Activity size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Vital Signs & Automatic BMI</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Auto-calculates BMI from Height & Weight with Underweight/Normal/Obese flags
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            <div
              onClick={() => navigate('/triage')}
              style={{
                padding: '0.85rem',
                background: 'var(--surface-color, #0f172a)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Baby size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Maternity & APGAR Score</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  1-min & 5-min newborn assessment with resuscitation protocol prompts
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            <div
              onClick={() => navigate('/triage')}
              style={{
                padding: '0.85rem',
                background: 'var(--surface-color, #0f172a)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pediatric IMNCI Assessment</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Uganda MoH integrated protocol: Danger signs, Pneumonia, Dehydration & MUAC
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>
        </div>

        {/* Recent Patients */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Recent Patient Registrations</h3>
            <button
              onClick={() => navigate('/patients')}
              className="btn btn-link btn-sm"
              style={{ color: 'var(--brand)', padding: 0 }}
            >
              View All
            </button>
          </div>

          {recentPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              No patients registered yet in this clinic branch.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {recentPatients.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--surface-color, #0f172a)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {p.first_name} {p.last_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.gender} &middot; {p.phone || 'No phone'} &middot; {p.district || 'Uganda'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {p.is_maternity && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Maternity</span>}
                    {p.is_pediatric && <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Child &lt;5y</span>}
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PIN Security Modal */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => setPinModalOpen(false)}
      />
    </div>
  )
}
