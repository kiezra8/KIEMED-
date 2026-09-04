import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Building2, Plus, Shield, Lock,
  Unlock, KeyRound, Wifi, RefreshCw, Database, Download,
  CheckCircle2, AlertTriangle, Trash2
} from 'lucide-react'
import { useClinicStore, usePinStore, useSyncStore, useToastStore } from '../store'
import { localGetAll, localAdd } from '../lib/db'
import PinModal from '../components/ui/PinModal'
import Modal from '../components/ui/Modal'

export default function Settings() {
  const { clinics, currentClinic, setCurrentClinic, createClinic } = useClinicStore()
  const { hasPIN, clearPIN } = usePinStore()
  const { isOnline, isSyncing, lastSyncAt, sync } = useSyncStore()
  const { add: toast } = useToastStore()

  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [clinicModalOpen, setClinicModalOpen] = useState(false)
  const [dbStats, setDbStats] = useState({
    patients: 0,
    vitals: 0,
    consultations: 0,
    admissions: 0,
    invoices: 0,
    inventory: 0,
  })

  // New Clinic Form
  const [clinicForm, setClinicForm] = useState({
    name: '',
    address: '',
    phone: '',
    district: 'Kampala',
    bed_capacity: '20',
  })

  useEffect(() => {
    loadDbStats()
  }, [currentClinic?.id])

  const loadDbStats = async () => {
    try {
      const [pts, vts, cns, adms, invs, drugs] = await Promise.all([
        localGetAll('patients'),
        localGetAll('vitals'),
        localGetAll('consultations'),
        localGetAll('admissions'),
        localGetAll('invoices'),
        localGetAll('inventory'),
      ])
      setDbStats({
        patients: pts.length,
        vitals: vts.length,
        consultations: cns.length,
        admissions: adms.length,
        invoices: invs.length,
        inventory: drugs.length,
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddClinic = async (e) => {
    e.preventDefault()
    if (!clinicForm.name.trim()) return

    try {
      await createClinic({
        ...clinicForm,
        bed_capacity: parseInt(clinicForm.bed_capacity) || 20,
      })
      toast(`Clinic branch "${clinicForm.name}" created with ${clinicForm.bed_capacity} beds`, 'success')
      setClinicModalOpen(false)
      setClinicForm({ name: '', address: '', phone: '', district: 'Kampala', bed_capacity: '20' })
    } catch (err) {
      toast('Failed to create clinic: ' + err.message, 'error')
    }
  }

  const handleForceSync = () => {
    if (!isOnline) {
      toast('Device is offline. Connect to internet to sync.', 'warning')
      return
    }
    sync(currentClinic?.id).then(() => {
      toast('Offline records synchronized with Supabase cloud', 'success')
    })
  }

  const handleRemovePIN = () => {
    if (confirm('Are you sure you want to remove PIN protection? Financial metrics will be visible to all users.')) {
      clearPIN()
      toast('Finance PIN protection removed', 'info')
    }
  }

  const handleBackupExport = async () => {
    try {
      const [pts, vts, cns, adms, invs, drugs, clns] = await Promise.all([
        localGetAll('patients'),
        localGetAll('vitals'),
        localGetAll('consultations'),
        localGetAll('admissions'),
        localGetAll('invoices'),
        localGetAll('inventory'),
        localGetAll('clinics'),
      ])

      const backup = {
        app: 'KIEMED HMS',
        exported_at: new Date().toISOString(),
        clinics: clns,
        patients: pts,
        vitals: vts,
        consultations: cns,
        admissions: adms,
        invoices: invs,
        inventory: drugs,
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KIEMED_Complete_Backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      toast('Database backup exported', 'success')
    } catch (err) {
      toast('Export failed: ' + err.message, 'error')
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
          System Configuration & Multi-Clinic Management
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Clinic branches, finance PIN security, offline-first sync & cloud backup
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Clinic Branches Management */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="var(--brand)" />
              Clinic Branches ({clinics.length})
            </h3>
            <button
              onClick={() => setClinicModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Plus size={14} /> Add Branch
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {clinics.map(c => {
              const isCurrent = c.id === currentClinic?.id
              return (
                <div
                  key={c.id}
                  onClick={() => setCurrentClinic(c)}
                  style={{
                    padding: '0.85rem',
                    background: isCurrent ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-color)',
                    borderRadius: '8px',
                    border: isCurrent ? '1px solid var(--brand)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.address || 'Uganda'} {c.phone ? `· ${c.phone}` : ''} &middot; <strong style={{ color: 'var(--brand)' }}>{c.bed_capacity || 20} Inpatient Beds</strong>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      Active Branch
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Finance PIN Protection Setting */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="var(--brand)" />
            Finance & Revenue PIN Security
          </h3>

          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Protect revenue numbers on Dashboard, Billing, and Reports. If enabled, staff must enter this 4-digit PIN to view financial figures.
          </p>

          <div style={{
            padding: '1rem',
            background: 'var(--surface-color)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {hasPIN ? 'PIN Protection Active' : 'No PIN Configured'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {hasPIN ? 'Financial metrics are locked by default.' : 'Finances can be viewed without a PIN prompt.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPinModalOpen(true)}
                className="btn btn-secondary btn-sm"
              >
                {hasPIN ? 'Change PIN' : 'Set Security PIN'}
              </button>
              {hasPIN && (
                <button
                  onClick={handleRemovePIN}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                >
                  Disable PIN
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Offline Sync & Supabase Diagnostics */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={18} color={isOnline ? 'var(--brand)' : 'var(--danger)'} />
            Offline-First Sync & Supabase
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Connection Status:</span>
              <span style={{ fontWeight: 600, color: isOnline ? 'var(--brand)' : 'var(--danger)' }}>
                {isOnline ? 'Online (Connected)' : 'Offline (Local-Only Mode)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Supabase Project:</span>
              <span style={{ fontWeight: 600 }}>gabapoeejwqueautmkew</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Sync:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {lastSyncAt ? lastSyncAt.slice(0, 19).replace('T', ' ') : 'Not yet synced'}
              </span>
            </div>
          </div>

          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Syncing with Supabase...' : 'Force Sync Now'}</span>
          </button>
        </div>

        {/* Local Storage & Backup Export */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="var(--brand)" />
            Local IndexedDB Database (Dexie)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.patients}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Patients</div>
            </div>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.vitals}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vitals</div>
            </div>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.consultations}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Consults</div>
            </div>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.admissions}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Admissions</div>
            </div>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.invoices}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Invoices</div>
            </div>
            <div style={{ background: 'var(--surface-color)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand)' }}>{dbStats.inventory}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Medicines</div>
            </div>
          </div>

          <button
            onClick={handleBackupExport}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <Download size={14} />
            <span>Export Offline Backup (JSON)</span>
          </button>
        </div>
      </div>

      {/* Add Clinic Modal */}
      {clinicModalOpen && (
        <Modal title="Create New Clinic Branch" onClose={() => setClinicModalOpen(false)}>
          <form onSubmit={handleAddClinic} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Clinic Branch Name *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. KIEMED Jinja Branch"
                value={clinicForm.name}
                onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Physical Address</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Plot 14 Main Street"
                value={clinicForm.address}
                onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">District</label>
                <input
                  type="text"
                  className="input"
                  value={clinicForm.district}
                  onChange={(e) => setClinicForm({ ...clinicForm, district: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Contact Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 700 000 000"
                  value={clinicForm.phone}
                  onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Total Inpatient Bed Capacity *</label>
              <input
                type="number"
                min="1"
                className="input"
                required
                placeholder="20"
                value={clinicForm.bed_capacity}
                onChange={(e) => setClinicForm({ ...clinicForm, bed_capacity: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                Defined by administrator during branch account setup.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setClinicModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Branch</button>
            </div>
          </form>
        </Modal>
      )}

      {/* PIN Security Modal */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => setPinModalOpen(false)}
      />
    </div>
  )
}
