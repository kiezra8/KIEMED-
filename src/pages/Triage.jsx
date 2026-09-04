import { useState, useEffect } from 'react'
import {
  Activity, Heart, Thermometer, UserCheck, AlertTriangle,
  Scale, ShieldAlert, CheckCircle2, ChevronRight, Baby, Sparkles,
  Info, Stethoscope
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd } from '../lib/db'
import {
  calculateBMI,
  APGAR_CRITERIA,
  computeApgarTotal,
  IMNCI_DANGER_SIGNS,
  evaluateIMNCI
} from '../lib/clinical'

export default function Triage() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [recentVitals, setRecentVitals] = useState([])
  const [loading, setLoading] = useState(false)

  // Standard Vitals Form State
  const [vitals, setVitals] = useState({
    temperature: '',
    blood_pressure: '',
    heart_rate: '',
    respiratory_rate: '',
    oxygen_sat: '',
    height: '',
    weight: '',
    blood_glucose: '',
    pain_scale: '0',
    chief_complaint: '',
    priority: 'Green (Non-urgent)', // Red (Emergency), Yellow (Priority), Green (Non-urgent)
    nurse_notes: '',
  })

  // APGAR Scores (For maternity mothers and newborn infants)
  const [enableApgar, setEnableApgar] = useState(false)
  const [apgarScores, setApgarScores] = useState({
    timing: '1min', // '1min' or '5min'
    appearance: 2,
    pulse: 2,
    grimace: 2,
    activity: 2,
    respiration: 2,
  })

  // IMNCI Pediatric Assessment (For under-5 children)
  const [enableImnci, setEnableImnci] = useState(false)
  const [imnciData, setImnciData] = useState({
    dangerSigns: [],
    chestIndrawing: false,
    stridor: false,
    fever: false,
    malariaRdt: 'Pending',
    stiffNeck: false,
    diarrheaDays: 0,
    sunkenEyes: false,
    skinPinch: 'Normal',
    bloodInStool: false,
    muacMm: 135,
    bilateralEdema: false,
  })

  useEffect(() => {
    loadData()
    const handleDataChange = (e) => {
      if (!e.detail?.table || ['vitals', 'patients'].includes(e.detail?.table)) {
        loadData()
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id])

  const loadData = async () => {
    if (!currentClinic?.id) return
    const [pts, vts] = await Promise.all([
      localGetAll('patients', currentClinic.id),
      localGetAll('vitals', currentClinic.id),
    ])
    setPatients(pts || [])
    setRecentVitals(vts?.slice(-10).reverse() || [])
  }

  // Current selected patient object
  const selectedPatient = patients.find(p => p.id === selectedPatientId)

  // When patient selection changes, auto-detect maternity or pediatric flags
  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.is_maternity) {
        setEnableApgar(true)
      } else {
        setEnableApgar(false)
      }

      if (selectedPatient.is_pediatric) {
        setEnableImnci(true)
      } else {
        setEnableImnci(false)
      }
    }
  }, [selectedPatientId])

  // Automatic BMI calculation
  const bmiResult = calculateBMI(vitals.weight, vitals.height)

  // Automatic APGAR calculation
  const apgarResult = enableApgar ? computeApgarTotal(apgarScores) : null

  // Automatic IMNCI calculation
  const imnciResult = enableImnci ? evaluateIMNCI({
    ...imnciData,
    respiratoryRate: parseInt(vitals.respiratory_rate) || 0,
  }) : null

  const handleDangerSignToggle = (signId) => {
    setImnciData(prev => {
      const exists = prev.dangerSigns.includes(signId)
      return {
        ...prev,
        dangerSigns: exists
          ? prev.dangerSigns.filter(id => id !== signId)
          : [...prev.dangerSigns, signId]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      toast('Please select a patient to record vitals for', 'warning')
      return
    }

    setLoading(true)
    try {
      const record = {
        patient_id: selectedPatientId,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...vitals,
        bmi: bmiResult ? bmiResult.bmi : null,
        bmi_category: bmiResult ? bmiResult.category : null,
        // Include APGAR if applicable
        ...(enableApgar ? {
          apgar_scores: apgarScores,
          apgar_total: apgarResult?.total,
          apgar_interpretation: apgarResult?.interpretation,
          apgar_action: apgarResult?.action,
        } : {}),
        // Include IMNCI if applicable
        ...(enableImnci ? {
          imnci_data: imnciData,
          imnci_classifications: imnciResult?.classifications,
          imnci_urgent_referral: imnciResult?.urgentReferral,
        } : {}),
      }

      await localAdd('vitals', record, currentClinic.id)
      toast(`Vitals and triage assessment saved for ${selectedPatient.first_name}`, 'success')

      // Reset form
      setVitals({
        temperature: '',
        blood_pressure: '',
        heart_rate: '',
        respiratory_rate: '',
        oxygen_sat: '',
        height: '',
        weight: '',
        blood_glucose: '',
        pain_scale: '0',
        chief_complaint: '',
        priority: 'Green (Non-urgent)',
        nurse_notes: '',
      })
      loadData()
    } catch (err) {
      toast('Failed to save triage data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
          Triage & Clinical Vitals Desk
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Automated BMI computation, Maternity APGAR newborn evaluation, and Uganda MoH IMNCI protocol
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Triage Form */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Patient Selector */}
            <div>
              <label className="label">Select Patient for Triage *</label>
              <select
                className="input"
                required
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.gender}, {p.date_of_birth || 'No DOB'}) {p.is_maternity ? '[Maternity]' : ''} {p.is_pediatric ? '[Pediatric]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedPatient && (
              <div style={{
                background: 'var(--surface-color, #0f172a)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.85rem'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{selectedPatient.first_name} {selectedPatient.last_name}</span> &middot; {selectedPatient.gender}
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Allergies: {selectedPatient.allergies || 'None'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {selectedPatient.is_maternity && <span className="badge badge-warning">Maternity Mother</span>}
                  {selectedPatient.is_pediatric && <span className="badge badge-info">Child &lt;5y</span>}
                </div>
              </div>
            )}

            {/* Standard Vitals Input Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="36.5"
                  value={vitals.temperature}
                  onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Blood Pressure</label>
                <input
                  type="text"
                  className="input"
                  placeholder="120/80"
                  value={vitals.blood_pressure}
                  onChange={(e) => setVitals({ ...vitals, blood_pressure: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Pulse (bpm)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="72"
                  value={vitals.heart_rate}
                  onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="label">SpO2 (%)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="98"
                  value={vitals.oxygen_sat}
                  onChange={(e) => setVitals({ ...vitals, oxygen_sat: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Resp Rate (/min)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="18"
                  value={vitals.respiratory_rate}
                  onChange={(e) => setVitals({ ...vitals, respiratory_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="label">RBS (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="5.4"
                  value={vitals.blood_glucose}
                  onChange={(e) => setVitals({ ...vitals, blood_glucose: e.target.value })}
                />
              </div>
            </div>

            {/* HEIGHT & WEIGHT -> AUTOMATIC BMI CALCULATION */}
            <div style={{
              background: 'var(--surface-color, #0f172a)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Scale size={18} color="var(--brand)" />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Anthropometry & Automatic BMI</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label className="label">Height (cm) *</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input"
                    placeholder="e.g. 165"
                    value={vitals.height}
                    onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    placeholder="e.g. 68.5"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                  />
                </div>
              </div>

              {/* Automatic BMI Output */}
              {bmiResult ? (
                <div style={{
                  marginTop: '0.85rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderLeft: `4px solid ${bmiResult.color}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Computed BMI (Auto)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: bmiResult.color }}>
                      {bmiResult.bmi} kg/m² &middot; {bmiResult.category}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {bmiResult.advice}
                    </div>
                  </div>
                  <span className="badge" style={{ background: bmiResult.color, color: '#fff', fontWeight: 700 }}>
                    {bmiResult.category}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Enter both height (cm) and weight (kg) to compute BMI automatically.
                </div>
              )}
            </div>

            {/* APGAR SECTION - FOR MATERNITY MOTHERS AND NEWBORNS */}
            <div style={{
              background: enableApgar ? 'rgba(236, 72, 153, 0.08)' : 'var(--surface-color, #0f172a)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: enableApgar ? '2px solid #ec4899' : '1px solid var(--border, #334155)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: enableApgar ? '1rem' : '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(236, 72, 153, 0.15)',
                    color: '#ec4899',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Baby size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                      Maternity Mother & Newborn APGAR Score
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Maternity or newborn encounter? <strong>Should the APGAR score be included?</strong>
                    </p>
                  </div>
                </div>

                {/* HIGH-VISIBILITY TICK / INCLUSION BUTTONS */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setEnableApgar(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      background: enableApgar ? '#ec4899' : 'rgba(236, 72, 153, 0.15)',
                      color: enableApgar ? '#ffffff' : '#f472b6',
                      border: enableApgar ? '2px solid #ec4899' : '1px dashed #ec4899',
                      boxShadow: enableApgar ? '0 0 14px rgba(236, 72, 153, 0.45)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Yes, Include APGAR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnableApgar(false)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: '8px',
                      fontWeight: 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      background: !enableApgar ? 'rgba(51, 65, 85, 0.8)' : 'transparent',
                      color: !enableApgar ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Skip APGAR
                  </button>
                </div>
              </div>

              {enableApgar ? (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(236, 72, 153, 0.2)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${apgarScores.timing === '1min' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setApgarScores({ ...apgarScores, timing: '1min' })}
                    >
                      1 Minute Assessment
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${apgarScores.timing === '5min' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setApgarScores({ ...apgarScores, timing: '5min' })}
                    >
                      5 Minute Assessment
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem' }}>
                    {Object.entries(APGAR_CRITERIA).map(([key, item]) => (
                      <div key={key}>
                        <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</label>
                        <select
                          className="input"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                          value={apgarScores[key]}
                          onChange={(e) => setApgarScores({ ...apgarScores, [key]: parseInt(e.target.value) })}
                        >
                          {item.options.map(opt => (
                            <option key={opt.score} value={opt.score}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {apgarResult && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.95)',
                      borderLeft: `5px solid ${apgarResult.color}`,
                      borderTop: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.15rem', color: apgarResult.color }}>
                          Total APGAR Score: {apgarResult.total} / 10 &middot; {apgarResult.interpretation}
                        </span>
                        <span className="badge" style={{ background: apgarResult.color, color: '#fff', padding: '0.3rem 0.6rem', fontWeight: 700 }}>
                          {apgarScores.timing} Post-Delivery
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', marginTop: '0.5rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        <strong>Clinical Action Protocol (Uganda MoH):</strong> {apgarResult.action}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  APGAR evaluation is currently skipped. Click "Yes, Include APGAR" above to score Appearance, Pulse, Grimace, Activity, and Respiration.
                </div>
              )}
            </div>

            {/* IMNCI PEDIATRIC PROTOCOL - FOR CHILDREN <5 YEARS */}
            <div style={{
              background: enableImnci ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-color, #0f172a)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: enableImnci ? '2px solid #f59e0b' : '1px solid var(--border, #334155)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: enableImnci ? '1rem' : '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                      Uganda MoH IMNCI Protocol (Child &lt; 5 Years)
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Patient under 5 years? <strong>Should the integrated IMNCI clinical assessment be included?</strong>
                    </p>
                  </div>
                </div>

                {/* HIGH-VISIBILITY TICK / INCLUSION BUTTONS */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setEnableImnci(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      background: enableImnci ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
                      color: enableImnci ? '#ffffff' : '#fbbf24',
                      border: enableImnci ? '2px solid #f59e0b' : '1px dashed #f59e0b',
                      boxShadow: enableImnci ? '0 0 14px rgba(245, 158, 11, 0.45)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Yes, Include IMNCI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnableImnci(false)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: '8px',
                      fontWeight: 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      background: !enableImnci ? 'rgba(51, 65, 85, 0.8)' : 'transparent',
                      color: !enableImnci ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Skip IMNCI
                  </button>
                </div>
              </div>

              {enableImnci ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  {/* General Danger Signs */}
                  <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.85rem' }}>
                    <label className="label" style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                      Check for General Danger Signs (Tick every sign observed):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {IMNCI_DANGER_SIGNS.map(sign => (
                        <label key={sign.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            style={{ width: '16px', height: '16px' }}
                            checked={imnciData.dangerSigns.includes(sign.id)}
                            onChange={() => handleDangerSignToggle(sign.id)}
                          />
                          <span>{sign.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Respiratory, Fever & Nutritional Signs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label className="label">Chest Indrawing</label>
                      <select
                        className="input"
                        value={imnciData.chestIndrawing ? 'yes' : 'no'}
                        onChange={(e) => setImnciData({ ...imnciData, chestIndrawing: e.target.value === 'yes' })}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes (Severe Pneumonia Sign)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Malaria mRDT Result</label>
                      <select
                        className="input"
                        value={imnciData.malariaRdt}
                        onChange={(e) => setImnciData({ ...imnciData, malariaRdt: e.target.value })}
                      >
                        <option value="Pending">Pending / Not Tested</option>
                        <option value="Positive">Positive (+)</option>
                        <option value="Negative">Negative (-)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">MUAC Tape (mm)</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="e.g. 135"
                        value={imnciData.muacMm}
                        onChange={(e) => setImnciData({ ...imnciData, muacMm: parseInt(e.target.value) || 0 })}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                        &lt;115mm: SAM (Red) &middot; 115-124mm: MAM (Yellow) &middot; &ge;125mm: Normal (Green)
                      </span>
                    </div>

                    <div>
                      <label className="label">Bilateral Edema (Kwashiorkor)</label>
                      <select
                        className="input"
                        value={imnciData.bilateralEdema ? 'yes' : 'no'}
                        onChange={(e) => setImnciData({ ...imnciData, bilateralEdema: e.target.value === 'yes' })}
                      >
                        <option value="no">No (Absent)</option>
                        <option value="yes">Yes (Severe Malnutrition / Kwashiorkor)</option>
                      </select>
                    </div>
                  </div>

                  {/* IMNCI Classification Summary */}
                  {imnciResult && (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '8px',
                      border: imnciResult.urgentReferral ? '2px solid var(--danger)' : '1px solid var(--brand)'
                    }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem', color: imnciResult.urgentReferral ? 'var(--danger)' : 'var(--brand)' }}>
                        Uganda MoH IMNCI Classification Results:
                      </div>
                      {imnciResult.classifications.map((c, i) => (
                        <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          <span className={`badge ${c.severity === 'RED' ? 'badge-danger' : c.severity === 'YELLOW' ? 'badge-warning' : 'badge-success'}`} style={{ marginRight: '0.5rem', fontWeight: 700 }}>
                            {c.title}
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>{c.treatment}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  IMNCI protocol assessment is currently skipped. Click "Yes, Include IMNCI" above to evaluate danger signs, pneumonia breathing rate, and MUAC.
                </div>
              )}
            </div>

            {/* Priority & Chief Complaint */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Uganda Triage Priority</label>
                <select
                  className="input"
                  value={vitals.priority}
                  onChange={(e) => setVitals({ ...vitals, priority: e.target.value })}
                >
                  <option value="Green (Non-urgent)">Green (Non-urgent / Routine)</option>
                  <option value="Yellow (Priority)">Yellow (Priority / Urgent)</option>
                  <option value="Red (Emergency)">Red (Immediate Resuscitation / Emergency)</option>
                </select>
              </div>

              <div>
                <label className="label">Chief Complaint</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. High fever for 3 days, cough"
                  value={vitals.chief_complaint}
                  onChange={(e) => setVitals({ ...vitals, chief_complaint: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Nurse / Triage Notes</label>
              <textarea
                className="input"
                rows="2"
                placeholder="Additional clinical observations..."
                value={vitals.nurse_notes}
                onChange={(e) => setVitals({ ...vitals, nurse_notes: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Saving Vitals...' : 'Save Vitals & Send to Doctor Queue'}</span>
            </button>
          </form>
        </div>

        {/* Recent Triage Queue */}
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '12px',
          border: '1px solid var(--border, #334155)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--brand)" />
            Recent Triage Assessments
          </h3>

          {recentVitals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              No vitals logged yet today. Complete the triage form to send patients to Doctor Consultation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '680px' }}>
              {recentVitals.map(v => (
                <div
                  key={v.id}
                  style={{
                    padding: '0.85rem',
                    background: 'var(--surface-color, #0f172a)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    borderLeft: v.priority?.includes('Red') ? '4px solid var(--danger)' : v.priority?.includes('Yellow') ? '4px solid var(--warning)' : '4px solid var(--brand)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{v.patient_name || 'Patient'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        {v.created_at?.slice(11, 16)}
                      </span>
                    </div>
                    <span className={`badge ${v.priority?.includes('Red') ? 'badge-danger' : v.priority?.includes('Yellow') ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                      {v.priority?.split(' ')[0]}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    BP: <strong>{v.blood_pressure || '--'}</strong> &middot; Temp: <strong>{v.temperature ? `${v.temperature}°C` : '--'}</strong> &middot; Pulse: <strong>{v.heart_rate || '--'} bpm</strong>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    BMI: <strong>{v.bmi || '--'} ({v.bmi_category || 'N/A'})</strong> &middot; SpO2: {v.oxygen_sat ? `${v.oxygen_sat}%` : '--'}
                  </div>

                  {v.apgar_total !== undefined && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: '#ec4899', fontWeight: 600 }}>
                      APGAR: {v.apgar_total}/10 ({v.apgar_interpretation})
                    </div>
                  )}

                  {v.imnci_classifications && v.imnci_classifications.length > 0 && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: '#f59e0b' }}>
                      IMNCI: {v.imnci_classifications.map(c => c.title).join(', ')}
                    </div>
                  )}

                  {v.chief_complaint && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      "{v.chief_complaint}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
