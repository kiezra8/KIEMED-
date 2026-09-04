import { useState, useEffect } from 'react'
import {
  BedDouble, Users, PlusCircle, CheckCircle2, AlertCircle,
  Clock, ArrowRight, UserMinus, Building2, Filter, LogOut
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut } from '../lib/db'
import Modal from '../components/ui/Modal'

const WARDS = [
  'General Ward',
  'Maternity Ward',
  'Pediatric Ward',
  'Female Medical/Surgical',
  'Male Medical/Surgical',
  'High Dependency Unit (HDU)',
]

export default function Admissions() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [admissions, setAdmissions] = useState([])
  const [beds, setBeds] = useState([])
  const [patients, setPatients] = useState([])
  const [selectedWard, setSelectedWard] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false)
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  const [dischargeNotes, setDischargeNotes] = useState('')

  // Admission Form
  const [formData, setFormData] = useState({
    patient_id: '',
    ward: 'General Ward',
    bed_number: 'B-01',
    admitting_doctor: 'Dr. Mukasa',
    reason: '',
  })

  useEffect(() => {
    loadData()
    const handler = (e) => {
      if (['admissions', 'beds', 'patients'].includes(e.detail?.table)) {
        loadData()
      }
    }
    window.addEventListener('kiemed-data-change', handler)
    return () => window.removeEventListener('kiemed-data-change', handler)
  }, [currentClinic?.id])

  const loadData = async () => {
    if (!currentClinic?.id) return
    const targetCapacity = Number(currentClinic?.bed_capacity || currentClinic?.total_beds || 20)
    const [adms, bds, pts] = await Promise.all([
      localGetAll('admissions', currentClinic.id),
      localGetAll('beds', currentClinic.id),
      localGetAll('patients', currentClinic.id),
    ])

    // Generate or balance beds strictly matching targetCapacity configured during account setup
    let currentBeds = bds
    if (!bds || bds.length === 0 || bds.length !== targetCapacity) {
      if (bds && bds.length > 0) {
        // Clear existing beds if capacity changed to maintain strict sync
        for (const b of bds) {
          if (b.id) await localDelete('beds', b.id)
        }
      }
      const newBeds = []
      const wardsCount = WARDS.length
      for (let i = 0; i < targetCapacity; i++) {
        const ward = WARDS[i % wardsCount]
        const bedNum = `BED-${(i + 1).toString().padStart(2, '0')}`
        newBeds.push({
          clinic_id: currentClinic.id,
          ward,
          bed_number: bedNum,
          status: 'available',
          patient_id: null,
          patient_name: null,
        })
      }
      for (const b of newBeds) {
        await localAdd('beds', b, currentClinic.id)
      }
      currentBeds = await localGetAll('beds', currentClinic.id)
    }

    setAdmissions(adms || [])
    setBeds(currentBeds || [])
    setPatients(pts || [])
  }

  const handleAdmit = async (e) => {
    e.preventDefault()
    if (!formData.patient_id) {
      toast('Please select a patient to admit', 'warning')
      return
    }

    const patient = patients.find(p => p.id === formData.patient_id)
    try {
      // 1. Create admission record
      const adm = await localAdd('admissions', {
        ...formData,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        status: 'admitted',
        admitted_at: new Date().toISOString(),
      }, currentClinic.id)

      // 2. Mark bed as occupied
      const targetBed = beds.find(b => b.ward === formData.ward && b.bed_number === formData.bed_number)
      if (targetBed) {
        await localPut('beds', {
          ...targetBed,
          status: 'occupied',
          patient_id: patient.id,
          patient_name: `${patient.first_name} ${patient.last_name}`,
        })
      }

      toast(`Patient ${patient.first_name} admitted to ${formData.ward} (${formData.bed_number})`, 'success')
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast('Failed to admit patient: ' + err.message, 'error')
    }
  }

  const handleDischarge = async () => {
    if (!selectedAdmission) return

    try {
      // 1. Update admission status
      await localPut('admissions', {
        ...selectedAdmission,
        status: 'discharged',
        discharged_at: new Date().toISOString(),
        discharge_notes: dischargeNotes,
      })

      // 2. Free up bed
      const targetBed = beds.find(b => b.ward === selectedAdmission.ward && b.bed_number === selectedAdmission.bed_number)
      if (targetBed) {
        await localPut('beds', {
          ...targetBed,
          status: 'available',
          patient_id: null,
          patient_name: null,
        })
      }

      toast(`Patient ${selectedAdmission.patient_name} discharged successfully`, 'success')
      setDischargeModalOpen(false)
      setSelectedAdmission(null)
      setDischargeNotes('')
      loadData()
    } catch (err) {
      toast('Failed to discharge: ' + err.message, 'error')
    }
  }

  const activeAdmissions = admissions.filter(a => a.status === 'admitted')
  const occupiedBedCount = beds.filter(b => b.status === 'occupied').length

  const filteredBeds = selectedWard === 'All'
    ? beds
    : beds.filter(b => b.ward === selectedWard)

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            Inpatient Admissions & Ward Bed Management
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Live bed status, admission intake, ward transfers & clinical discharges
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <PlusCircle size={16} />
          <span>Admit Patient</span>
        </button>
      </div>

      {/* Ward Occupancy Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="stat-card">
          <span className="stat-label">Total Inpatients</span>
          <h2 className="stat-value">{activeAdmissions.length}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Currently admitted</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Bed Occupancy Rate</span>
          <h2 className="stat-value">
            {beds.length > 0 ? Math.round((occupiedBedCount / beds.length) * 100) : 0}%
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--brand)' }}>{occupiedBedCount} of {beds.length} beds in use</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Available Beds</span>
          <h2 className="stat-value">{beds.length - occupiedBedCount}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready for intake</span>
        </div>
      </div>

      {/* Ward Filter Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setSelectedWard('All')}
          className={`btn btn-sm ${selectedWard === 'All' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Wards
        </button>
        {WARDS.map(w => (
          <button
            key={w}
            onClick={() => setSelectedWard(w)}
            className={`btn btn-sm ${selectedWard === w ? 'btn-primary' : 'btn-secondary'}`}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Bed Grid Visualizer */}
      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BedDouble size={18} color="var(--brand)" />
          Live Ward Bed Grid ({filteredBeds.length} Beds)
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1rem'
        }}>
          {filteredBeds.map(b => {
            const isOcc = b.status === 'occupied'
            return (
              <div
                key={b.id || b.bed_number}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: isOcc ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: isOcc ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{b.bed_number}</span>
                  <span className={`badge ${isOcc ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                    {isOcc ? 'Occupied' : 'Available'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.ward}</div>
                {isOcc && (
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
                    {b.patient_name || 'Patient Admitted'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Currently Admitted Patients Table */}
      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
          Currently Admitted Inpatients ({activeAdmissions.length})
        </div>

        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.8rem 1rem' }}>Patient</th>
              <th style={{ padding: '0.8rem 1rem' }}>Ward & Bed</th>
              <th style={{ padding: '0.8rem 1rem' }}>Admitting Diagnosis</th>
              <th style={{ padding: '0.8rem 1rem' }}>Admitted At</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeAdmissions.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No patients currently admitted in this clinic branch.
                </td>
              </tr>
            ) : (
              activeAdmissions.map(adm => (
                <tr key={adm.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>{adm.patient_name}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <div>{adm.ward}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bed {adm.bed_number}</span>
                  </td>
                  <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>{adm.reason || 'Medical Admission'}</td>
                  <td style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {adm.admitted_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedAdmission(adm)
                        setDischargeModalOpen(true)
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--danger)' }}
                    >
                      <LogOut size={13} />
                      <span>Discharge</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Admit Patient Modal */}
      {modalOpen && (
        <Modal title="Admit Patient to Inpatient Ward" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleAdmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Select Patient *</label>
              <select
                className="input"
                required
                value={formData.patient_id}
                onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.gender})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Target Ward *</label>
                <select
                  className="input"
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                >
                  {WARDS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Bed Number</label>
                <input
                  type="text"
                  className="input"
                  value={formData.bed_number}
                  onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Admitting Doctor</label>
              <input
                type="text"
                className="input"
                value={formData.admitting_doctor}
                onChange={(e) => setFormData({ ...formData, admitting_doctor: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Reason / Admitting Diagnosis *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Severe Malaria with dehydration, IV therapy"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Confirm Admission</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Discharge Summary Modal */}
      {dischargeModalOpen && selectedAdmission && (
        <Modal title={`Discharge Patient: ${selectedAdmission.patient_name}`} onClose={() => setDischargeModalOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Discharging will free up bed <strong>{selectedAdmission.bed_number}</strong> in <strong>{selectedAdmission.ward}</strong> and finalize the admission record.
            </p>

            <div>
              <label className="label">Discharge Summary & Instructions</label>
              <textarea
                className="input"
                rows="3"
                placeholder="Discharge condition, oral discharge medication prescribed, follow-up instructions..."
                value={dischargeNotes}
                onChange={(e) => setDischargeNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDischargeModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleDischarge}>Complete Discharge</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
