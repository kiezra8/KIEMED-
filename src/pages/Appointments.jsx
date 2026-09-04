import { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon, Plus, CheckCircle2, Clock,
  Users, UserCheck, AlertCircle
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut } from '../lib/db'
import Modal from '../components/ui/Modal'

export default function Appointments() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    patient_id: '',
    appointment_type: 'Antenatal Care (ANC) Visit',
    appointment_date: '',
    appointment_time: '10:00',
    doctor: 'Dr. Mukasa',
    notes: '',
  })

  useEffect(() => {
    loadAppointments()
  }, [currentClinic?.id])

  const loadAppointments = async () => {
    if (!currentClinic?.id) return
    const [apts, pts] = await Promise.all([
      localGetAll('appointments', currentClinic.id),
      localGetAll('patients', currentClinic.id),
    ])

    setAppointments(apts || [])
    setPatients(pts || [])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.patient_id || !formData.appointment_date) {
      toast('Please select patient and appointment date', 'warning')
      return
    }

    const pt = patients.find(p => p.id === formData.patient_id)
    try {
      await localAdd('appointments', {
        ...formData,
        patient_name: `${pt.first_name} ${pt.last_name}`,
        status: 'Scheduled',
      }, currentClinic.id)

      toast(`Appointment scheduled for ${pt.first_name}`, 'success')
      setModalOpen(false)
      loadAppointments()
    } catch (err) {
      toast('Failed to schedule: ' + err.message, 'error')
    }
  }

  const handleMarkComplete = async (apt) => {
    try {
      await localPut('appointments', { ...apt, status: 'Completed' })
      toast('Appointment marked as attended', 'success')
      loadAppointments()
    } catch (err) {
      toast('Error updating: ' + err.message, 'error')
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
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
            Appointments & Clinic Scheduling
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            ANC visits, pediatric immunization schedules & chronic disease follow-ups
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          <span>Book Appointment</span>
        </button>
      </div>

      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        overflow: 'hidden'
      }}>
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.85rem 1rem' }}>Patient Name</th>
              <th style={{ padding: '0.85rem 1rem' }}>Clinic Service</th>
              <th style={{ padding: '0.85rem 1rem' }}>Date & Time</th>
              <th style={{ padding: '0.85rem 1rem' }}>Attending Clinician</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No appointments booked.
                </td>
              </tr>
            ) : (
              appointments.map(apt => (
                <tr key={apt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{apt.patient_name}</td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{apt.appointment_type}</td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                    <div>{apt.appointment_date}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{apt.appointment_time}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{apt.doctor}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className={`badge ${apt.status === 'Completed' ? 'badge-success' : 'badge-primary'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    {apt.status !== 'Completed' && (
                      <button
                        onClick={() => handleMarkComplete(apt)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Completed</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Book Patient Clinic Appointment" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Appointment Clinic / Purpose *</label>
              <select
                className="input"
                value={formData.appointment_type}
                onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
              >
                <option value="Antenatal Care (ANC) Visit">Antenatal Care (ANC) Visit</option>
                <option value="EPI / Child Immunization">EPI / Child Immunization (Uganda MoH)</option>
                <option value="Hypertension / Chronic Clinic">Hypertension / Cardiovascular Clinic</option>
                <option value="Diabetes Follow-up Clinic">Diabetes Mellitus Follow-up</option>
                <option value="Postnatal Care (PNC) Visit">Postnatal Care (PNC) Visit</option>
                <option value="General Outpatient Review">General Outpatient Review</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Appointment Date *</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Time</label>
                <input
                  type="time"
                  className="input"
                  value={formData.appointment_time}
                  onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Clinician</label>
              <input
                type="text"
                className="input"
                value={formData.doctor}
                onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Confirm Booking</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
