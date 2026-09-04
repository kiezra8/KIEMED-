import { useState, useEffect } from 'react'
import {
  Stethoscope, Users, UserCheck, Activity, Pill, FlaskConical,
  BedDouble, CheckCircle2, ChevronRight, AlertCircle, FileText,
  Calendar, Plus, Trash2, ArrowRight, History, Clock, AlertTriangle,
  User, Check, ShieldAlert
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd } from '../lib/db'
import { UGANDA_COMMON_DIAGNOSES } from '../lib/clinical'

export default function Consultations() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [patients, setPatients] = useState([])
  const [allVitals, setAllVitals] = useState([])
  const [allConsultations, setAllConsultations] = useState([])
  const [allLabs, setAllLabs] = useState([])
  const [allDispensing, setAllDispensing] = useState([])
  const [allAdmissions, setAllAdmissions] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('new_consult') // 'new_consult' | 'past_encounters'

  // Consultation Form
  const [consultForm, setConsultForm] = useState({
    doctor: 'Dr. Mukasa David (Medical Officer)',
    chief_complaint: '',
    history: '',
    examination: '',
    diagnosis: UGANDA_COMMON_DIAGNOSES[0],
    custom_diagnosis: '',
    plan: '',
    follow_up_date: '',
    disposition: 'Discharged on Medication', // 'Discharged on Medication', 'Admit to Ward', 'Refer to Regional Hospital'
  })

  // Prescriptions List
  const [prescriptions, setPrescriptions] = useState([
    { drug: 'Artemether/Lumefantrine 20/120mg (Coartem)', dose: '4 tabs', freq: 'BD', duration: '3 days' }
  ])

  // Lab Tests List
  const [labOrders, setLabOrders] = useState([
    { test: 'Malaria Blood Smear / mRDT', reason: 'Fever screening' }
  ])

  useEffect(() => {
    loadData()
    const handleDataChange = (e) => {
      if (!e.detail?.table || ['consultations', 'vitals', 'patients', 'lab_requests', 'dispensing', 'admissions'].includes(e.detail?.table)) {
        loadData()
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id])

  const loadData = async () => {
    if (!currentClinic?.id) return
    const [pts, vts, cns, lbs, dsp, adm] = await Promise.all([
      localGetAll('patients', currentClinic.id),
      localGetAll('vitals', currentClinic.id),
      localGetAll('consultations', currentClinic.id),
      localGetAll('lab_requests', currentClinic.id),
      localGetAll('dispensing', currentClinic.id),
      localGetAll('admissions', currentClinic.id),
    ])
    setPatients(pts || [])
    setAllVitals(vts || [])
    setAllConsultations(cns || [])
    setAllLabs(lbs || [])
    setAllDispensing(dsp || [])
    setAllAdmissions(adm || [])
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId)

  // Current and historical vitals for the selected patient
  const patientVitalsHistory = allVitals.filter(v => v.patient_id === selectedPatientId).reverse()
  const latestVital = patientVitalsHistory[0]

  // Historical consultations for the selected patient
  const patientPastConsultations = allConsultations.filter(c => c.patient_id === selectedPatientId).reverse()

  // Historical admissions for the selected patient
  const patientPastAdmissions = allAdmissions.filter(a => a.patient_id === selectedPatientId).reverse()

  // Historical labs for the selected patient
  const patientPastLabs = allLabs.filter(l => l.patient_id === selectedPatientId).reverse()

  // Total past visits count
  const pastVisitCount = patientPastConsultations.length

  const addPrescriptionRow = () => {
    setPrescriptions([...prescriptions, { drug: '', dose: '', freq: 'TDS', duration: '5 days' }])
  }

  const removePrescriptionRow = (index) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index))
  }

  const addLabRow = () => {
    setLabOrders([...labOrders, { test: '', reason: '' }])
  }

  const removeLabRow = (index) => {
    setLabOrders(labOrders.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      toast('Please select a patient from the queue', 'warning')
      return
    }

    setLoading(true)
    try {
      const finalDiagnosis = consultForm.custom_diagnosis || consultForm.diagnosis

      // 1. Save Consultation Record
      const consultRecord = await localAdd('consultations', {
        patient_id: selectedPatientId,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...consultForm,
        diagnosis: finalDiagnosis,
        prescriptions,
        lab_orders: labOrders,
        status: 'Completed',
      }, currentClinic.id)

      // 2. Automatically dispatch Lab Orders to Laboratory module
      for (const lab of labOrders) {
        if (lab.test?.trim()) {
          await localAdd('lab_requests', {
            patient_id: selectedPatientId,
            patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
            consultation_id: consultRecord.id,
            test_name: lab.test,
            tests: lab.test,
            clinical_notes: lab.reason,
            status: 'pending',
            requested_by: consultForm.doctor,
          }, currentClinic.id)
        }
      }

      // 3. Automatically dispatch Dispensing Order to Pharmacy module
      const drugItems = prescriptions.filter(p => p.drug?.trim())
      if (drugItems.length > 0) {
        await localAdd('dispensing', {
          patient_id: selectedPatientId,
          patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          consultation_id: consultRecord.id,
          items: drugItems.map(d => `${d.drug} (${d.dose} ${d.freq} x ${d.duration})`).join(', '),
          prescribed_items: drugItems,
          status: 'pending',
          dispensed_by: null,
          is_direct_sale: false,
        }, currentClinic.id)
      }

      // 4. If Disposition is 'Admit to Ward', create pending admission
      if (consultForm.disposition === 'Admit to Ward') {
        await localAdd('admissions', {
          patient_id: selectedPatientId,
          patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          admitting_doctor: consultForm.doctor,
          reason: finalDiagnosis,
          ward: selectedPatient.is_maternity ? 'Maternity Ward' : selectedPatient.is_pediatric ? 'Pediatric Ward' : 'General Ward',
          status: 'admitted',
          admitted_at: new Date().toISOString(),
        }, currentClinic.id)
        toast('Patient admitted to inpatient ward', 'info')
      }

      toast(`Consultation recorded and orders routed to Pharmacy & Lab!`, 'success')

      // Reset form
      setConsultForm({
        doctor: consultForm.doctor,
        chief_complaint: '',
        history: '',
        examination: '',
        diagnosis: UGANDA_COMMON_DIAGNOSES[0],
        custom_diagnosis: '',
        plan: '',
        follow_up_date: '',
        disposition: 'Discharged on Medication',
      })
      setPrescriptions([])
      setLabOrders([])
      loadData()
    } catch (err) {
      toast('Failed to record consultation: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
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
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
            Doctor Consultation & Clinical Diagnosis Desk
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Uganda Clinical Guidelines (UCG), comprehensive past visit history, lab and pharmacy integration
          </p>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('new_consult')}
            className={`btn ${activeTab === 'new_consult' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Stethoscope size={16} />
            <span>Active Consultation</span>
          </button>
          <button
            onClick={() => setActiveTab('past_encounters')}
            className={`btn ${activeTab === 'past_encounters' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <History size={16} />
            <span>Completed Encounters ({allConsultations.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'new_consult' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Patient Selection Card */}
          <div style={{
            background: 'var(--card-bg, #1e293b)',
            borderRadius: '12px',
            border: '1px solid var(--border, #334155)',
            padding: '1.25rem 1.5rem'
          }}>
            <label className="label" style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Select Patient from Waiting Queue *
            </label>
            <select
              className="input"
              required
              style={{ padding: '0.75rem 1rem', fontSize: '1rem', background: 'var(--surface-color, #0f172a)' }}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="">-- Choose Patient to begin Clinical Consultation --</option>
              {patients.map(p => {
                const pastCount = allConsultations.filter(c => c.patient_id === p.id).length
                return (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.gender}, Age: {p.age !== undefined && p.age !== null && p.age !== '' ? `${p.age} yrs` : p.date_of_birth ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs` : 'N/A'}) &middot; {pastCount > 0 ? `${pastCount} Previous Visit${pastCount > 1 ? 's' : ''}` : 'New Patient'} {p.is_maternity ? '[Maternity]' : ''} {p.is_pediatric ? '[Child <5y]' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* PATIENT VISIT HISTORY & PRIOR VISITS BANNER */}
          {selectedPatient && (
            <div style={{
              background: pastVisitCount > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
              border: pastVisitCount > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: pastVisitCount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: pastVisitCount > 0 ? 'var(--brand)' : '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    <History size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                      {pastVisitCount > 0 ? `Returning Patient: ${pastVisitCount} Previous Visit${pastVisitCount > 1 ? 's' : ''} at this Hospital` : `First-Time Patient at this Medical Centre`}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {selectedPatient.first_name} {selectedPatient.last_name} &middot; {selectedPatient.gender} &middot; {selectedPatient.phone || 'No phone'} &middot; {selectedPatient.district || 'Uganda'}
                      {selectedPatient.blood_group ? ` · Blood: ${selectedPatient.blood_group}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selectedPatient.is_maternity && <span className="badge badge-warning">Maternity Patient</span>}
                  {selectedPatient.is_pediatric && <span className="badge badge-info">Pediatric &lt;5y</span>}
                  {selectedPatient.allergies && <span className="badge badge-danger">Allergies: {selectedPatient.allergies}</span>}
                </div>
              </div>

              {/* TIMELINE OF PAST VISITS */}
              {pastVisitCount > 0 ? (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--brand)', marginBottom: '0.5rem' }}>
                    Summary of Prior Visits & Medical Encounters:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '260px', overflowY: 'auto' }}>
                    {patientPastConsultations.map((pc, idx) => (
                      <div
                        key={pc.id || idx}
                        style={{
                          background: 'var(--surface-color, #0f172a)',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            Visit #{patientPastConsultations.length - idx}: {pc.diagnosis}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {pc.created_at?.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>

                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Attending Clinician: <strong style={{ color: 'var(--text-primary)' }}>{pc.doctor}</strong> &middot; Outcome: {pc.disposition}
                        </div>

                        {pc.prescriptions && pc.prescriptions.length > 0 && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--brand)' }}>
                            Prescribed: {pc.prescriptions.map(p => p.drug).filter(Boolean).join(', ')}
                          </div>
                        )}

                        {pc.plan && (
                          <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Doctor's Plan / Notes: {pc.plan}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No prior clinical visits found for this patient. This is their first recorded medical encounter.
                </div>
              )}
            </div>
          )}

          {/* LATEST TRIAGE SIGNS BAR (IF AVAILABLE) */}
          {latestVital && (
            <div style={{
              background: 'var(--surface-color, #0f172a)',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              borderLeft: '5px solid var(--brand)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Today's Triage Signs ({latestVital.created_at?.slice(11, 16)})
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  BP: {latestVital.blood_pressure || '--/--'} &middot; Temp: {latestVital.temperature ? `${latestVital.temperature}°C` : '--'} &middot; Pulse: {latestVital.heart_rate || '--'} bpm &middot; SpO2: {latestVital.oxygen_sat ? `${latestVital.oxygen_sat}%` : '--'} &middot; Resp: {latestVital.respiratory_rate || '--'}/min
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Height: {latestVital.height || '--'} cm &middot; Weight: {latestVital.weight || '--'} kg &middot; <strong>BMI: {latestVital.bmi || '--'} ({latestVital.bmi_category || 'N/A'})</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {latestVital.apgar_total !== undefined && (
                  <span className="badge" style={{ background: '#ec4899', color: '#fff' }}>
                    APGAR: {latestVital.apgar_total}/10 ({latestVital.apgar_interpretation})
                  </span>
                )}
                {latestVital.imnci_classifications?.map((c, i) => (
                  <span key={i} className="badge badge-warning">
                    IMNCI: {c.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* MAIN FULL-WIDTH CONSULTATION WORKSPACE */}
          <div style={{
            background: 'var(--card-bg, #1e293b)',
            borderRadius: '12px',
            border: '1px solid var(--border, #334155)',
            padding: '1.75rem'
          }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Doctor and Disposition Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="label">Attending Doctor / Clinician *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={consultForm.doctor}
                    onChange={(e) => setConsultForm({ ...consultForm, doctor: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Patient Disposition *</label>
                  <select
                    className="input"
                    value={consultForm.disposition}
                    onChange={(e) => setConsultForm({ ...consultForm, disposition: e.target.value })}
                  >
                    <option value="Discharged on Medication">Discharge on Medication (OPD)</option>
                    <option value="Admit to Ward">Admit to Inpatient Ward</option>
                    <option value="Refer to Regional Hospital">Refer to Regional Referral Hospital (Mulago/Kiruddu/Kawempe)</option>
                  </select>
                </div>
              </div>

              {/* Chief Complaint & HPI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="label">Chief Complaint *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. High grade fever, vomiting, generalized body weakness"
                    value={consultForm.chief_complaint}
                    onChange={(e) => setConsultForm({ ...consultForm, chief_complaint: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">History of Presenting Illness (HPI)</label>
                  <textarea
                    className="input"
                    rows="2"
                    placeholder="Onset, character, duration, aggravating/relieving factors..."
                    value={consultForm.history}
                    onChange={(e) => setConsultForm({ ...consultForm, history: e.target.value })}
                  />
                </div>
              </div>

              {/* Physical Examination Findings */}
              <div>
                <label className="label">Physical Examination Findings</label>
                <textarea
                  className="input"
                  rows="2"
                  placeholder="General condition, respiratory system, cardiovascular, abdomen, CNS..."
                  value={consultForm.examination}
                  onChange={(e) => setConsultForm({ ...consultForm, examination: e.target.value })}
                />
              </div>

              {/* Uganda Clinical Guidelines Diagnosis Selection */}
              <div style={{
                background: 'var(--surface-color, #0f172a)',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <label className="label" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand)', marginBottom: '0.5rem' }}>
                  Clinical Diagnosis (Uganda Clinical Guidelines - UCG Standards) *
                </label>
                <select
                  className="input"
                  style={{ fontSize: '0.95rem', padding: '0.65rem 0.85rem' }}
                  value={consultForm.diagnosis}
                  onChange={(e) => setConsultForm({ ...consultForm, diagnosis: e.target.value })}
                >
                  {UGANDA_COMMON_DIAGNOSES.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="input"
                  placeholder="Or enter custom diagnosis / differential diagnosis..."
                  style={{ marginTop: '0.6rem' }}
                  value={consultForm.custom_diagnosis}
                  onChange={(e) => setConsultForm({ ...consultForm, custom_diagnosis: e.target.value })}
                />
              </div>

              {/* Prescriptions */}
              <div style={{
                background: 'var(--surface-color, #0f172a)',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Pill size={18} color="var(--brand)" /> Prescriptions & Pharmacy Orders
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addPrescriptionRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Plus size={14} /> Add Medicine
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {prescriptions.map((rx, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Drug name (e.g. Amoxicillin 500mg)"
                        value={rx.drug}
                        onChange={(e) => {
                          const updated = [...prescriptions]
                          updated[idx].drug = e.target.value
                          setPrescriptions(updated)
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Dose (e.g. 500mg)"
                        value={rx.dose}
                        onChange={(e) => {
                          const updated = [...prescriptions]
                          updated[idx].dose = e.target.value
                          setPrescriptions(updated)
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Freq (e.g. TDS)"
                        value={rx.freq}
                        onChange={(e) => {
                          const updated = [...prescriptions]
                          updated[idx].freq = e.target.value
                          setPrescriptions(updated)
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Duration (e.g. 5 days)"
                        value={rx.duration}
                        onChange={(e) => {
                          const updated = [...prescriptions]
                          updated[idx].duration = e.target.value
                          setPrescriptions(updated)
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removePrescriptionRow(idx)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab Orders */}
              <div style={{
                background: 'var(--surface-color, #0f172a)',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FlaskConical size={18} color="#a855f7" /> Diagnostic Laboratory Requests
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addLabRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Plus size={14} /> Add Test
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {labOrders.map((lb, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Test (e.g. CBC, Malaria BS, Urinalysis)"
                        value={lb.test}
                        onChange={(e) => {
                          const updated = [...labOrders]
                          updated[idx].test = e.target.value
                          setLabOrders(updated)
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Clinical indication / reason"
                        value={lb.reason}
                        onChange={(e) => {
                          const updated = [...labOrders]
                          updated[idx].reason = e.target.value
                          setLabOrders(updated)
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeLabRow(idx)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Management Plan & Follow-up */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="label">Clinical Management Plan & Counseling</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Fluid intake, nutrition, danger sign counseling, rest..."
                    value={consultForm.plan}
                    onChange={(e) => setConsultForm({ ...consultForm, plan: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Scheduled Follow-up Review Date</label>
                  <input
                    type="date"
                    className="input"
                    value={consultForm.follow_up_date}
                    onChange={(e) => setConsultForm({ ...consultForm, follow_up_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    padding: '0.85rem 2rem',
                    fontSize: '1.02rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{loading ? 'Finalizing Consultation...' : 'Finalize Consultation & Route Orders'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Completed Encounters Log Tab */
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            All Completed Doctor Consultations ({allConsultations.length})
          </div>

          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Patient Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Diagnosis</th>
                <th style={{ padding: '0.85rem 1rem' }}>Doctor</th>
                <th style={{ padding: '0.85rem 1rem' }}>Disposition</th>
                <th style={{ padding: '0.85rem 1rem' }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {allConsultations.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No completed consultations found.
                  </td>
                </tr>
              ) : (
                allConsultations.slice().reverse().map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{c.patient_name}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--brand)', fontWeight: 600 }}>{c.diagnosis}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{c.doctor}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{c.disposition}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {c.created_at?.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
