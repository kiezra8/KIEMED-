import { useState, useEffect } from 'react'
import {
  Badge, UserPlus, Phone, Mail, Award, CheckCircle2,
  Trash2, ShieldCheck, Stethoscope
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localDelete } from '../lib/db'
import Modal from '../components/ui/Modal'

export default function Staff() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [staffList, setStaffList] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    role: 'Medical Officer (Doctor)',
    department: 'Clinical OPD',
    council_no: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    loadStaff()
  }, [currentClinic?.id])

  const loadStaff = async () => {
    if (!currentClinic?.id) return
    const data = await localGetAll('staff', currentClinic.id)
    setStaffList(data || [])
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast('Please enter staff name', 'warning')
      return
    }

    try {
      await localAdd('staff', formData, currentClinic.id)
      toast(`Staff member ${formData.name} added`, 'success')
      setModalOpen(false)
      setFormData({
        name: '',
        role: 'Medical Officer (Doctor)',
        department: 'Clinical OPD',
        council_no: '',
        phone: '',
        email: '',
      })
      loadStaff()
    } catch (err) {
      toast('Failed to add staff: ' + err.message, 'error')
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
            Medical Staff & Healthcare Providers
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Clinicians, Midwives, Pharmacists, and Laboratory Personnel for {currentClinic?.name}
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <UserPlus size={16} />
          <span>Add Healthcare Provider</span>
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {staffList.map(s => (
          <div
            key={s.id}
            style={{
              background: 'var(--card-bg, #1e293b)',
              borderRadius: '12px',
              border: '1px solid var(--border, #334155)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem'
              }}>
                {s.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{s.name}</h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  {s.role}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Department: <strong style={{ color: 'var(--text-primary)' }}>{s.department}</strong></div>
              {s.council_no && <div>Council Reg: <strong style={{ color: 'var(--text-primary)' }}>{s.council_no}</strong></div>}
              {s.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Phone size={13} /> {s.phone}</div>}
              {s.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Mail size={13} /> {s.email}</div>}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal title="Register Healthcare Provider / Staff" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Full Name *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Dr. Jane Akello"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Cadre / Professional Role *</label>
                <select
                  className="input"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="Medical Officer (Doctor)">Medical Officer (Doctor)</option>
                  <option value="Consultant Physician">Consultant Physician</option>
                  <option value="Clinical Officer">Clinical Officer</option>
                  <option value="Senior Midwife">Senior Midwife</option>
                  <option value="Registered Nurse">Registered Nurse</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Laboratory Technologist">Laboratory Technologist</option>
                  <option value="Cashier / Accounts">Cashier / Accounts</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div>
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Professional Council Registration No.</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. UMDPC/2022/9999 or UNMC/RN/1234"
                value={formData.council_no}
                onChange={(e) => setFormData({ ...formData, council_no: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 700 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="name@kiemed.ug"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Provider</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
