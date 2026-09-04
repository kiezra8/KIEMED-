import { useState, useEffect } from 'react'
import {
  FlaskConical, Plus, Search, CheckCircle2, Clock,
  FileCheck, AlertCircle, RefreshCw
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut } from '../lib/db'
import Modal from '../components/ui/Modal'

const COMMON_LAB_TESTS = [
  { name: 'Malaria Blood Smear / mRDT', price: 5000, normal: 'Negative for Malaria parasites' },
  { name: 'Complete Blood Count (CBC)', price: 20000, normal: 'Hb: 12.0 - 16.0 g/dL, WBC: 4.0 - 11.0 x10^9/L' },
  { name: 'Hemoglobin (Hb) Estimation', price: 5000, normal: '12.0 - 16.0 g/dL' },
  { name: 'Urinalysis (Dipstick & Microscopy)', price: 8000, normal: 'Pus cells 0-2/hpf, Protein Nil, Glucose Nil' },
  { name: 'Random Blood Sugar (RBS)', price: 5000, normal: '3.9 - 7.8 mmol/L' },
  { name: 'Widal / Typhoid Antibody Test', price: 10000, normal: 'Titres < 1:80' },
  { name: 'Stool Analysis (Microscopy)', price: 7000, normal: 'No ova, cysts, or parasites seen' },
  { name: 'HIV 1/2 Rapid (MoH Algorithm)', price: 0, normal: 'Non-Reactive (Free MoH screening)' },
  { name: 'Hepatitis B Surface Antigen (HBsAg)', price: 10000, normal: 'Negative' },
  { name: 'Syphilis Rapid / VDRL', price: 7000, normal: 'Non-Reactive' },
  { name: 'Pregnancy Test (Urine hCG)', price: 5000, normal: 'Negative' },
]

export default function Laboratory() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [labRequests, setLabRequests] = useState([])
  const [patients, setPatients] = useState([])
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'completed'
  const [modalOpen, setModalOpen] = useState(false)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [resultText, setResultText] = useState('')
  const [resultNotes, setResultNotes] = useState('')

  // Walk-in / Direct Lab Order Form
  const [orderForm, setOrderForm] = useState({
    patient_id: '',
    test_name: COMMON_LAB_TESTS[0].name,
    requested_by: 'Lab Desk / Direct Order',
    clinical_notes: '',
  })

  useEffect(() => {
    loadData()
  }, [currentClinic?.id])

  const loadData = async () => {
    if (!currentClinic?.id) return
    const [reqs, pts] = await Promise.all([
      localGetAll('lab_requests', currentClinic.id),
      localGetAll('patients', currentClinic.id),
    ])
    setLabRequests(reqs?.slice().reverse() || [])
    setPatients(pts || [])
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!orderForm.patient_id) {
      toast('Please select a patient', 'warning')
      return
    }

    const patient = patients.find(p => p.id === orderForm.patient_id)
    try {
      await localAdd('lab_requests', {
        ...orderForm,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        tests: orderForm.test_name,
        status: 'pending',
      }, currentClinic.id)

      toast(`Lab request created for ${patient.first_name}`, 'success')
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast('Failed to create lab request: ' + err.message, 'error')
    }
  }

  const handleSaveResult = async () => {
    if (!selectedRequest || !resultText) {
      toast('Please enter test results', 'warning')
      return
    }

    try {
      // 1. Update lab request
      await localPut('lab_requests', {
        ...selectedRequest,
        status: 'completed',
        results: resultText,
        result_notes: resultNotes,
        completed_at: new Date().toISOString(),
      })

      // 2. Add billing charge for the test
      const testItem = COMMON_LAB_TESTS.find(t => t.name === selectedRequest.test_name)
      const charge = testItem ? testItem.price : 10000
      if (charge > 0) {
        await localAdd('invoices', {
          patient_id: selectedRequest.patient_id,
          patient_name: selectedRequest.patient_name,
          description: `Laboratory: ${selectedRequest.test_name}`,
          amount_due: charge,
          amount_paid: charge,
          balance: 0,
          payment_method: 'Cash / Mobile Money',
          status: 'Paid',
        }, currentClinic.id)
      }

      toast(`Test results finalized and released to chart!`, 'success')
      setResultModalOpen(false)
      setSelectedRequest(null)
      setResultText('')
      setResultNotes('')
      loadData()
    } catch (err) {
      toast('Failed to save result: ' + err.message, 'error')
    }
  }

  const filteredRequests = labRequests.filter(r => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'completed') return r.status === 'completed'
    return true
  })

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
            Diagnostic Laboratory
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Diagnostic testing queue, result validation & automatic patient chart integration
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          <span>New Lab Request</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setFilter('all')}
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Requests ({labRequests.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Pending Tests ({labRequests.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`btn btn-sm ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Completed Results ({labRequests.filter(r => r.status === 'completed').length})
        </button>
      </div>

      {/* Lab Requests Table */}
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
              <th style={{ padding: '0.85rem 1rem' }}>Requested Test</th>
              <th style={{ padding: '0.85rem 1rem' }}>Requested By</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem' }}>Result Findings</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No laboratory requests found matching this filter.
                </td>
              </tr>
            ) : (
              filteredRequests.map(req => {
                const isPending = req.status === 'pending'
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{req.patient_name}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{req.test_name || req.tests}</div>
                      {req.clinical_notes && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Note: {req.clinical_notes}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {req.requested_by || 'Doctor'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`badge ${isPending ? 'badge-warning' : 'badge-success'}`}>
                        {isPending ? 'Pending' : 'Completed'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                      {req.results ? (
                        <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{req.results}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting lab analysis</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {isPending ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedRequest(req)
                            const matched = COMMON_LAB_TESTS.find(t => t.name === req.test_name)
                            setResultText(matched ? matched.normal : '')
                            setResultModalOpen(true)
                          }}
                        >
                          Enter Result
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedRequest(req)
                            setResultText(req.results || '')
                            setResultNotes(req.result_notes || '')
                            setResultModalOpen(true)
                          }}
                        >
                          View / Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* New Request Modal */}
      {modalOpen && (
        <Modal title="Create Laboratory Investigation Request" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Select Patient *</label>
              <select
                className="input"
                required
                value={orderForm.patient_id}
                onChange={(e) => setOrderForm({ ...orderForm, patient_id: e.target.value })}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.gender})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Test to Perform *</label>
              <select
                className="input"
                value={orderForm.test_name}
                onChange={(e) => setOrderForm({ ...orderForm, test_name: e.target.value })}
              >
                {COMMON_LAB_TESTS.map(t => (
                  <option key={t.name} value={t.name}>{t.name} (UGX {t.price.toLocaleString()})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Clinical Indication / Reason</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Acute febrile illness, suspected malaria"
                value={orderForm.clinical_notes}
                onChange={(e) => setOrderForm({ ...orderForm, clinical_notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit Lab Request</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Result Entry Modal */}
      {resultModalOpen && selectedRequest && (
        <Modal title={`Enter Test Results: ${selectedRequest.test_name}`} onClose={() => setResultModalOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Patient:</span>
              <div style={{ fontWeight: 600 }}>{selectedRequest.patient_name}</div>
            </div>

            <div>
              <label className="label">Diagnostic Findings / Result *</label>
              <textarea
                className="input"
                rows="3"
                required
                placeholder="e.g. Malaria Parasites (P. falciparum trophozoites) Seen +++"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Lab Technologist Comments / Verification Notes</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Verified by Senior Lab Technologist"
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResultModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveResult}>Validate & Release Result</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
