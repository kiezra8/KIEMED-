import { useState, useEffect } from 'react'
import {
  FlaskConical, Plus, Search, CheckCircle2, Clock,
  FileCheck, AlertCircle, RefreshCw, Trash2, Tag, DollarSign
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut } from '../lib/db'
import Modal from '../components/ui/Modal'

export const COMMON_LAB_TESTS = [
  { id: 't1', name: 'Malaria Blood Smear / mRDT', price: 5000, normal: 'Negative for Malaria parasites' },
  { id: 't2', name: 'Complete Blood Count (CBC)', price: 20000, normal: 'Hb: 12.0 - 16.0 g/dL, WBC: 4.0 - 11.0 x10^9/L' },
  { id: 't3', name: 'Hemoglobin (Hb) Estimation', price: 5000, normal: '12.0 - 16.0 g/dL' },
  { id: 't4', name: 'Urinalysis (Dipstick & Microscopy)', price: 8000, normal: 'Pus cells 0-2/hpf, Protein Nil, Glucose Nil' },
  { id: 't5', name: 'Random Blood Sugar (RBS)', price: 5000, normal: '3.9 - 7.8 mmol/L' },
  { id: 't6', name: 'Widal / Typhoid Antibody Test', price: 10000, normal: 'Titres < 1:80' },
  { id: 't7', name: 'Stool Analysis (Microscopy)', price: 7000, normal: 'No ova, cysts, or parasites seen' },
  { id: 't8', name: 'HIV 1/2 Rapid (MoH Algorithm)', price: 0, normal: 'Non-Reactive (Free MoH screening)' },
  { id: 't9', name: 'Hepatitis B Surface Antigen (HBsAg)', price: 10000, normal: 'Negative' },
  { id: 't10', name: 'Syphilis Rapid / VDRL', price: 7000, normal: 'Non-Reactive' },
  { id: 't11', name: 'Pregnancy Test (Urine hCG)', price: 5000, normal: 'Negative' },
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

  // Multi-Test Order Form State
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedStandardTests, setSelectedStandardTests] = useState({}) // { [testName]: { selected: boolean, price: number } }
  const [customTests, setCustomTests] = useState([]) // [{ id, name, price }]
  const [customTestInput, setCustomTestInput] = useState('')
  const [customPriceInput, setCustomPriceInput] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Real-time synchronization event listener
  useEffect(() => {
    loadData()
    const handleDataChange = (e) => {
      const tbl = e.detail?.table
      if (!tbl || tbl === 'all' || ['lab_requests', 'patients'].includes(tbl)) {
        loadData()
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
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

  // Open create modal & reset form
  const handleOpenCreateModal = () => {
    // Reset selections
    const initialMap = {}
    COMMON_LAB_TESTS.forEach(t => {
      initialMap[t.name] = { selected: false, price: t.price }
    })
    setSelectedStandardTests(initialMap)
    setCustomTests([])
    setCustomTestInput('')
    setCustomPriceInput('')
    setClinicalNotes('')
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id)
    }
    setModalOpen(true)
  }

  // Toggle standard test checkbox
  const handleToggleStandardTest = (testName, defaultPrice) => {
    setSelectedStandardTests(prev => {
      const current = prev[testName] || { selected: false, price: defaultPrice }
      return {
        ...prev,
        [testName]: {
          selected: !current.selected,
          price: current.price !== undefined ? current.price : defaultPrice
        }
      }
    })
  }

  // Change price for a standard test
  const handleStandardPriceChange = (testName, priceVal) => {
    setSelectedStandardTests(prev => ({
      ...prev,
      [testName]: {
        selected: prev[testName]?.selected ?? true,
        price: parseFloat(priceVal) || 0
      }
    }))
  }

  // Add a custom test to "Others"
  const handleAddCustomTest = () => {
    if (!customTestInput.trim()) {
      toast('Please write the name of the custom test', 'warning')
      return
    }
    const newCustom = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'c_' + Date.now(),
      name: customTestInput.trim(),
      price: parseFloat(customPriceInput) || 0,
    }
    setCustomTests(prev => [...prev, newCustom])
    setCustomTestInput('')
    setCustomPriceInput('')
  }

  // Remove a custom test
  const handleRemoveCustomTest = (id) => {
    setCustomTests(prev => prev.filter(c => c.id !== id))
  }

  // Calculate total price of all selected standard tests and custom tests
  const selectedStandardList = Object.entries(selectedStandardTests)
    .filter(([_, data]) => data.selected)
    .map(([name, data]) => ({ name, price: data.price }))

  const allSelectedTests = [
    ...selectedStandardList,
    ...customTests
  ]

  const totalOrderPrice = allSelectedTests.reduce((sum, t) => sum + (Number(t.price) || 0), 0)

  // Submit the multi-test order
  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      toast('Please select a patient', 'warning')
      return
    }

    if (allSelectedTests.length === 0) {
      toast('Please select at least one test or add a custom test under Others', 'warning')
      return
    }

    setSubmitting(true)
    const patient = patients.find(p => p.id === selectedPatientId)
    const patientFullName = patient ? `${patient.first_name} ${patient.last_name}` : 'Walk-in Patient'

    try {
      // 1. Create a lab request record for EACH selected test
      for (const test of allSelectedTests) {
        await localAdd('lab_requests', {
          patient_id: selectedPatientId,
          patient_name: patientFullName,
          test_name: test.name,
          cost: parseFloat(test.price) || 0,
          status: 'pending',
          requested_by: 'Lab Desk / Doctor Order',
          clinical_notes: clinicalNotes || null,
        }, currentClinic.id)
      }

      // 2. Automatically generate an invoice record for the lab tests bill
      if (totalOrderPrice > 0) {
        await localAdd('invoices', {
          patient_id: selectedPatientId,
          patient_name: patientFullName,
          category: 'Laboratory Investigation',
          description: `Lab Tests: ${allSelectedTests.map(t => t.name).join(', ')}`,
          amount_due: totalOrderPrice,
          amount_paid: totalOrderPrice,
          balance: 0,
          payment_method: 'Cash / Mobile Money',
          status: 'Paid',
        }, currentClinic.id)
      }

      toast(`Successfully created ${allSelectedTests.length} lab test(s) for ${patientFullName}`, 'success')
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast('Failed to create lab requests: ' + err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Finalize / Release result
  const handleSaveResult = async () => {
    if (!selectedRequest || !resultText.trim()) {
      toast('Please enter diagnostic test findings', 'warning')
      return
    }

    try {
      // Update lab request status
      await localPut('lab_requests', {
        ...selectedRequest,
        status: 'completed',
        results: resultText.trim(),
        completed_by: 'Staff Lab Technologist',
        updated_at: new Date().toISOString(),
      })

      toast(`Test results finalized and released to patient file!`, 'success')
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
            Multi-test ordering, custom pricing, and real-time cross-device diagnostic updates
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
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
              <th style={{ padding: '0.85rem 1rem' }}>Test Investigation</th>
              <th style={{ padding: '0.85rem 1rem' }}>Cost (UGX)</th>
              <th style={{ padding: '0.85rem 1rem' }}>Requested By</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem' }}>Result Findings</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
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
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--brand)', fontWeight: 700 }}>
                      UGX {Number(req.cost || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {req.requested_by || 'Staff Clinician'}
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
                            setResultNotes(req.clinical_notes || '')
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

      {/* Multi-Test Order Modal */}
      {modalOpen && (
        <Modal title="Request Diagnostic Laboratory Tests" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {/* Patient selector */}
            <div>
              <label className="label">Select Patient *</label>
              <select
                className="input"
                required
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.gender})</option>
                ))}
              </select>
            </div>

            {/* Standard Tests List with Checkboxes & Custom Price Inputs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0, fontWeight: 700 }}>
                  Select Tests to Perform (Choose Multiple & Set Prices):
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {allSelectedTests.length} test(s) chosen
                </span>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                background: 'var(--surface-color, #0f172a)',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                {COMMON_LAB_TESTS.map(test => {
                  const testData = selectedStandardTests[test.name] || { selected: false, price: test.price }
                  const isChecked = testData.selected

                  return (
                    <div
                      key={test.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        background: isChecked ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                        border: isChecked ? '1px solid var(--brand)' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStandardTest(test.name, test.price)}
                          style={{ width: 16, height: 16, accentColor: 'var(--brand)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: isChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {test.name}
                        </span>
                      </label>

                      {/* Custom price input for this test */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UGX:</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={testData.price}
                          onChange={(e) => handleStandardPriceChange(test.name, e.target.value)}
                          placeholder="Price"
                          style={{
                            width: '95px',
                            height: '28px',
                            padding: '2px 6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            background: 'var(--card-bg, #1e293b)',
                            color: 'var(--brand)'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* "Others" Custom Test Section */}
            <div style={{
              background: 'var(--surface-color, #0f172a)',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Tag size={15} color="var(--brand)" />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Others / Write Custom Test:</span>
              </div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Type your own test name and set your custom price to add it to this patient's lab request.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  style={{ flex: 2, minWidth: '150px' }}
                  placeholder="e.g. H. Pylori Antigen / Lipid Panel"
                  value={customTestInput}
                  onChange={(e) => setCustomTestInput(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="500"
                  className="input"
                  style={{ flex: 1, minWidth: '100px' }}
                  placeholder="Price (UGX)"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddCustomTest}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Add Test
                </button>
              </div>

              {/* List of custom tests added under Others */}
              {customTests.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {customTests.map(ct => (
                    <div
                      key={ct.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.6rem',
                        background: 'rgba(2, 132, 199, 0.1)',
                        borderRadius: '4px',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{ct.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: 'var(--brand)', fontWeight: 700 }}>
                          UGX {Number(ct.price).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomTest(ct.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }}
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Price Summary Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)',
              border: '1px solid var(--brand)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Tests Selected ({allSelectedTests.length})
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {allSelectedTests.map(t => t.name).join(', ') || 'No tests chosen'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Cost to Bill:</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand)' }}>
                  UGX {Number(totalOrderPrice).toLocaleString()}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Clinical Indication / Notes (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Acute fever, rule out malaria and typhoid"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" disabled={submitting || allSelectedTests.length === 0} className="btn btn-primary">
                {submitting ? 'Creating Requests...' : `Submit ${allSelectedTests.length} Lab Request(s)`}
              </button>
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
