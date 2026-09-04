import { useState, useEffect } from 'react'
import {
  Users, Plus, Search, Filter, Phone, Calendar, Heart,
  Activity, Baby, Stethoscope, ChevronRight, AlertCircle,
  FileText, Shield, MapPin, Printer, Share2, Image, Upload,
  Trash2, Eye, Download, MessageSquare, Send, CheckCircle2, FlaskConical, Pill
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localDelete } from '../lib/db'
import Modal from '../components/ui/Modal'

export default function Patients() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'maternity' | 'pediatric'
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [chartActiveTab, setChartActiveTab] = useState('overview') // 'overview' | 'scans' | 'vitals' | 'consults' | 'labs' | 'dispensing' | 'billing'

  // Image Upload state
  const [docUploadModalOpen, setDocUploadModalOpen] = useState(false)
  const [docForm, setDocForm] = useState({
    title: '',
    doc_type: 'X-Ray Scan', // 'X-Ray Scan', 'Ultrasound Scan', 'CT / MRI Scan', 'Lab Photo', 'Other'
    notes: '',
    file_data: null,
    file_name: '',
  })
  const [previewImage, setPreviewImage] = useState(null)
  const [viewFullImage, setViewFullImage] = useState(null)

  // WhatsApp Patient File Modal State
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [waRecipientPhone, setWaRecipientPhone] = useState('')

  // Unified patient chart records
  const [patientRecords, setPatientRecords] = useState({
    vitals: [],
    consults: [],
    labs: [],
    dispensing: [],
    invoices: [],
    admissions: [],
    documents: [],
  })

  // Patient registration form
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: 'Female',
    date_of_birth: '',
    phone: '',
    nin: '',
    district: 'Kampala',
    address: '',
    next_of_kin: '',
    nok_phone: '',
    blood_group: 'O+',
    allergies: '',
    chronic_conditions: '',
    is_maternity: false,
    is_pediatric: false,
  })

  useEffect(() => {
    loadPatients()
    const handleDataChange = (e) => {
      const tbl = e.detail?.table
      if (!tbl || tbl === 'all' || [
        'patients', 'vitals', 'consultations', 'lab_requests',
        'invoices', 'dispensing', 'admissions', 'patient_documents'
      ].includes(tbl)) {
        loadPatients()
        if (selectedPatient) openPatientChart(selectedPatient)
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id, selectedPatient?.id])

  const loadPatients = async () => {
    if (!currentClinic?.id) return
    setLoading(true)
    try {
      const data = await localGetAll('patients', currentClinic.id)
      setPatients(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDobChange = (dob) => {
    if (!dob) {
      setFormData(prev => ({ ...prev, date_of_birth: dob, is_pediatric: false }))
      return
    }
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    const isChild = age < 5
    const isWomanReproAge = formData.gender === 'Female' && age >= 12 && age <= 50

    setFormData(prev => ({
      ...prev,
      date_of_birth: dob,
      is_pediatric: isChild,
      is_maternity: isWomanReproAge ? prev.is_maternity : false,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.first_name || !formData.last_name) {
      toast('Please enter both first and last name', 'warning')
      return
    }

    try {
      const newPatient = await localAdd('patients', {
        ...formData,
        outstanding_balance: 0,
      }, currentClinic.id)

      toast(`Patient ${formData.first_name} ${formData.last_name} registered`, 'success')
      setPatients(prev => [newPatient, ...prev])
      setModalOpen(false)
      setFormData({
        first_name: '',
        last_name: '',
        gender: 'Female',
        date_of_birth: '',
        phone: '',
        nin: '',
        district: 'Kampala',
        address: '',
        next_of_kin: '',
        nok_phone: '',
        blood_group: 'O+',
        allergies: '',
        chronic_conditions: '',
        is_maternity: false,
        is_pediatric: false,
      })
    } catch (err) {
      toast('Failed to register patient: ' + err.message, 'error')
    }
  }

  const openPatientChart = async (patient) => {
    setSelectedPatient(patient)
    setChartActiveTab('overview')
    try {
      const [allVitals, allConsults, allLabs, allDispense, allInvoices, allAdm, allDocs] = await Promise.all([
        localGetAll('vitals', currentClinic.id),
        localGetAll('consultations', currentClinic.id),
        localGetAll('lab_requests', currentClinic.id),
        localGetAll('dispensing', currentClinic.id),
        localGetAll('invoices', currentClinic.id),
        localGetAll('admissions', currentClinic.id),
        localGetAll('patient_documents', currentClinic.id),
      ])

      setPatientRecords({
        vitals: (allVitals || []).filter(v => v.patient_id === patient.id),
        consults: (allConsults || []).filter(c => c.patient_id === patient.id),
        labs: (allLabs || []).filter(l => l.patient_id === patient.id),
        dispensing: (allDispense || []).filter(d => d.patient_id === patient.id),
        invoices: (allInvoices || []).filter(i => i.patient_id === patient.id),
        admissions: (allAdm || []).filter(a => a.patient_id === patient.id),
        documents: (allDocs || []).filter(doc => doc.patient_id === patient.id),
      })
    } catch (e) {
      console.error(e)
    }
  }

  // Handle Image / Scan File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 8 * 1024 * 1024) {
      toast('File size exceeds 8MB limit. Please choose a smaller image.', 'warning')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setDocForm(prev => ({
        ...prev,
        file_data: reader.result,
        file_name: file.name,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
      }))
      setPreviewImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Save Scan Image / Document to patient_documents
  const handleSaveDocument = async (e) => {
    e.preventDefault()
    if (!docForm.file_data) {
      toast('Please select an image or scan to upload', 'warning')
      return
    }
    if (!selectedPatient) return

    try {
      await localAdd('patient_documents', {
        patient_id: selectedPatient.id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        doc_type: docForm.doc_type,
        title: docForm.title || 'Medical Scan Image',
        notes: docForm.notes || '',
        file_name: docForm.file_name,
        file_data: docForm.file_data,
        uploaded_at: new Date().toISOString(),
      }, currentClinic.id)

      toast(`${docForm.doc_type} saved to patient's file!`, 'success')
      setDocUploadModalOpen(false)
      setDocForm({
        title: '',
        doc_type: 'X-Ray Scan',
        notes: '',
        file_data: null,
        file_name: '',
      })
      setPreviewImage(null)

      // Refresh patient records
      openPatientChart(selectedPatient)
    } catch (err) {
      toast('Failed to upload image: ' + err.message, 'error')
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this scan/image from the patient file?')) return
    try {
      await localDelete('patient_documents', docId)
      toast('Document removed from patient file', 'info')
      openPatientChart(selectedPatient)
    } catch (e) {
      toast('Failed to delete document', 'error')
    }
  }

  // Launch WhatsApp with full patient file summary
  const handleSendFullPatientFileWhatsApp = (e) => {
    e.preventDefault()
    if (!waRecipientPhone.trim()) {
      toast('Please enter WhatsApp phone number', 'warning')
      return
    }
    if (!selectedPatient) return

    let cleanPhone = waRecipientPhone.replace(/\D/g, '')
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '256' + cleanPhone.slice(1)
    } else if (!cleanPhone.startsWith('256') && cleanPhone.length === 9) {
      cleanPhone = '256' + cleanPhone
    }

    const clinicTitle = currentClinic?.name || 'KIEMED HOSPITAL'
    const fullName = `${selectedPatient.first_name} ${selectedPatient.last_name}`
    const latestVitals = patientRecords.vitals[0]
    const latestConsult = patientRecords.consults[0]
    const totalBilled = patientRecords.invoices.reduce((sum, i) => sum + (Number(i.amount_due) || 0), 0)
    const totalPaid = patientRecords.invoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)
    const balance = Math.max(0, totalBilled - totalPaid)

    const message =
`🏥 *${clinicTitle.toUpperCase()}*
*COMPLETE PATIENT MEDICAL FILE & SUMMARY*
=========================================
*Patient Name:* ${fullName}
*Gender / Age:* ${selectedPatient.gender}, DOB: ${selectedPatient.date_of_birth || 'N/A'}
*District / Phone:* ${selectedPatient.district || 'Uganda'} &middot; ${selectedPatient.phone || 'N/A'}
*Blood Group:* ${selectedPatient.blood_group || 'O+'}
*Allergies:* ${selectedPatient.allergies || 'None Known'}
*Chronic Conditions:* ${selectedPatient.chronic_conditions || 'None'}

--- 🩺 CLINICAL SUMMARY ---
• Total Clinic Consultations: ${patientRecords.consults.length}
• Latest Diagnosis: ${latestConsult ? latestConsult.diagnosis : 'None recorded'}
• Attending Doctor: ${latestConsult ? (latestConsult.doctor || 'Physician') : 'N/A'}
• Latest Vitals: ${latestVitals ? `BP: ${latestVitals.blood_pressure || '--'}, Pulse: ${latestVitals.heart_rate || '--'}bpm, Temp: ${latestVitals.temperature || '--'}°C, BMI: ${latestVitals.bmi || '--'}` : 'No vitals recorded'}

--- 🔬 INVESTIGATIONS & SCANS ---
• Lab Tests Done: ${patientRecords.labs.length} tests recorded
• Medical Scans / X-Rays Attached: ${patientRecords.documents.length} images/documents on file

--- 💊 MEDICATIONS DISPENSED ---
• Prescriptions Dispensed: ${patientRecords.dispensing.length} records

--- 💳 FINANCIAL BALANCE ---
• Total Billed: UGX ${totalBilled.toLocaleString()}
• Total Paid: UGX ${totalPaid.toLocaleString()}
• Outstanding Balance: UGX ${balance.toLocaleString()} (${balance <= 0 ? 'CLEARED ✓' : 'OUTSTANDING'})
=========================================
_Official Medical File generated via KIEMED Hospital Management System._`

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
    toast('WhatsApp patient file summary opened!', 'success')
    setWhatsappModalOpen(false)
  }

  // Print full official medical file to PDF
  const handlePrintFullPatientFile = () => {
    if (!selectedPatient) return

    const printWin = window.open('', '', 'width=900,height=900')
    const fullName = `${selectedPatient.first_name} ${selectedPatient.last_name}`
    const clinicName = currentClinic?.name || 'KIEMED HOSPITAL'
    const clinicAddr = currentClinic?.address || 'Uganda Clinical Facility'
    const clinicPhone = currentClinic?.phone || '+256 700 000 000'

    printWin.document.write(`
      <html>
        <head>
          <title>Medical File - ${fullName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2.5rem; color: #0f172a; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 1rem; margin-bottom: 1.5rem; }
            .hospital-name { font-size: 1.6rem; font-weight: 800; color: #0d9488; letter-spacing: -0.02em; }
            .file-title { font-size: 1.1rem; font-weight: 700; margin-top: 0.5rem; color: #334155; }
            .section { margin-bottom: 1.75rem; }
            .section-title { font-size: 1rem; font-weight: 700; color: #0d9488; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.875rem; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
            th { background: #f8fafc; font-weight: 700; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.875rem; background: #f8fafc; padding: 1rem; border-radius: 6px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; }
            .badge-cleared { background: #dcfce7; color: #15803d; }
            .badge-warn { background: #fef3c7; color: #b45309; }
            .footer { margin-top: 3rem; text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hospital-name">${clinicName}</div>
            <div>${clinicAddr} &middot; Tel: ${clinicPhone}</div>
            <div class="file-title">CONFIDENTIAL PATIENT COMPREHENSIVE MEDICAL RECORD</div>
          </div>

          <div class="section">
            <div class="section-title">Patient Identification & Demographics</div>
            <div class="grid">
              <div><strong>Full Name:</strong> ${fullName}</div>
              <div><strong>Gender:</strong> ${selectedPatient.gender}</div>
              <div><strong>Date of Birth:</strong> ${selectedPatient.date_of_birth || 'N/A'}</div>
              <div><strong>Blood Group:</strong> ${selectedPatient.blood_group || 'O+'}</div>
              <div><strong>Known Allergies:</strong> ${selectedPatient.allergies || 'None reported'}</div>
              <div><strong>Chronic Conditions:</strong> ${selectedPatient.chronic_conditions || 'None reported'}</div>
              <div><strong>Phone Number:</strong> ${selectedPatient.phone || 'N/A'}</div>
              <div><strong>National ID (NIN):</strong> ${selectedPatient.nin || 'N/A'}</div>
              <div><strong>Next of Kin:</strong> ${selectedPatient.next_of_kin || 'N/A'} (${selectedPatient.nok_phone || ''})</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Triage & Vitals History (${patientRecords.vitals.length} records)</div>
            ${patientRecords.vitals.length === 0 ? '<p>No vitals recorded.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>BP</th>
                    <th>Pulse</th>
                    <th>Temp (°C)</th>
                    <th>SpO2</th>
                    <th>BMI / Category</th>
                    <th>Special Protocol (APGAR / IMNCI)</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientRecords.vitals.map(v => `
                    <tr>
                      <td>${v.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td>${v.blood_pressure || '--'}</td>
                      <td>${v.heart_rate || '--'} bpm</td>
                      <td>${v.temperature || '--'}°C</td>
                      <td>${v.oxygen_sat || '--'}%</td>
                      <td>${v.bmi || '--'} (${v.bmi_category || ''})</td>
                      <td>
                        ${v.apgar_total ? `APGAR: ${v.apgar_total}/10 (${v.apgar_interpretation})` : ''}
                        ${v.imnci_classifications ? `IMNCI: ${v.imnci_classifications.map(c => c.title).join(', ')}` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section">
            <div class="section-title">Consultations & Diagnoses (${patientRecords.consults.length} records)</div>
            ${patientRecords.consults.length === 0 ? '<p>No consultations recorded.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Diagnosis</th>
                    <th>Doctor</th>
                    <th>Clinical Notes / Treatment Plan</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientRecords.consults.map(c => `
                    <tr>
                      <td>${c.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td><strong>${c.diagnosis || 'Undiagnosed'}</strong></td>
                      <td>${c.doctor || 'Attending Physician'}</td>
                      <td>${c.plan || c.examination || 'No notes'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section">
            <div class="section-title">Laboratory Investigations (${patientRecords.labs.length} tests)</div>
            ${patientRecords.labs.length === 0 ? '<p>No laboratory requests on file.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Test Ordered</th>
                    <th>Result / Findings</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientRecords.labs.map(l => `
                    <tr>
                      <td>${l.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td>${l.test_name || l.tests}</td>
                      <td>${l.results || 'Pending Lab Processing'}</td>
                      <td>${l.status}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section">
            <div class="section-title">Medical Scans & Attached Images (${patientRecords.documents.length} files)</div>
            ${patientRecords.documents.length === 0 ? '<p>No medical scan images attached.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Document Type</th>
                    <th>File Title / Description</th>
                    <th>File Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientRecords.documents.map(d => `
                    <tr>
                      <td>${d.uploaded_at?.slice(0, 16).replace('T', ' ') || ''}</td>
                      <td><strong>${d.doc_type}</strong></td>
                      <td>${d.title || d.file_name} ${d.notes ? `(${d.notes})` : ''}</td>
                      <td>Archived in Patient Digital Chart</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section">
            <div class="section-title">Pharmacy Dispensing History (${patientRecords.dispensing.length} records)</div>
            ${patientRecords.dispensing.length === 0 ? '<p>No medications dispensed.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Medications Dispensed</th>
                    <th>Dispensed By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${patientRecords.dispensing.map(d => `
                    <tr>
                      <td>${d.dispensed_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td>${d.items}</td>
                      <td>${d.dispensed_by || 'Pharmacist'}</td>
                      <td>Dispensed</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="footer">
            <p>Certified Official Medical Record &middot; ${clinicName} &middot; Generated on ${new Date().toLocaleString()}</p>
            <p>Powered by KIEMED Hospital Management System (Offline-first & Cloud-synced)</p>
          </div>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `)
    printWin.document.close()
  }

  const filteredPatients = patients.filter(p => {
    const q = search.toLowerCase()
    const matchesSearch =
      (p.first_name || '').toLowerCase().includes(q) ||
      (p.last_name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q) ||
      (p.nin || '').toLowerCase().includes(q)

    if (!matchesSearch) return false
    if (filterType === 'maternity') return p.is_maternity
    if (filterType === 'pediatric') return p.is_pediatric
    return true
  })

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
            Patients Registry & Unified Medical Files
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Comprehensive patient charts, scans & X-ray media uploads, WhatsApp records & clinical history
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--surface-2)',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        marginBottom: '1.25rem',
        alignItems: 'center'
      }}>
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, phone number, or NIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%', height: 38 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterType('all')}
            className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Patients ({patients.length})
          </button>
          <button
            onClick={() => setFilterType('maternity')}
            className={`btn btn-sm ${filterType === 'maternity' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Maternity Mothers
          </button>
          <button
            onClick={() => setFilterType('pediatric')}
            className={`btn btn-sm ${filterType === 'pediatric' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Children &lt;5y (IMNCI)
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div style={{
        background: 'var(--card-bg, var(--surface-1))',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.85rem 1rem' }}>Patient Name</th>
              <th style={{ padding: '0.85rem 1rem' }}>Gender / Age</th>
              <th style={{ padding: '0.85rem 1rem' }}>Phone & Location</th>
              <th style={{ padding: '0.85rem 1rem' }}>Clinical Flags</th>
              <th style={{ padding: '0.85rem 1rem' }}>Blood Group</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Patient File</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 600 }}>No patients registered yet</div>
                  <p style={{ fontSize: '0.813rem', margin: '0.25rem 0 1rem' }}>
                    Click "Register New Patient" above to create an official patient chart.
                  </p>
                </td>
              </tr>
            ) : (
              filteredPatients.map(p => (
                <tr
                  key={p.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => openPatientChart(p)}
                >
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                    <div>{p.first_name} {p.last_name}</div>
                    {p.nin && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NIN: {p.nin}</span>}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                    {p.gender} &middot; {p.date_of_birth ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs` : 'Age N/A'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                    <div>{p.phone || 'No phone'}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.district}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {p.is_maternity && (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          Maternity Mother
                        </span>
                      )}
                      {p.is_pediatric && (
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          Child &lt;5y / IMNCI
                        </span>
                      )}
                      {!p.is_maternity && !p.is_pediatric && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                          General OPD
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="badge badge-outline" style={{ fontWeight: 600 }}>{p.blood_group || 'O+'}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); openPatientChart(p) }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <FileText size={13} />
                      <span>Full File</span>
                      <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* COMPREHENSIVE PATIENT FILE MODAL */}
      {selectedPatient && (
        <Modal
          title={`Medical File: ${selectedPatient.first_name} ${selectedPatient.last_name}`}
          size="lg"
          onClose={() => setSelectedPatient(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Patient Summary Header */}
            <div style={{
              background: 'var(--surface-2)',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </h3>
                  <span className="badge badge-outline">{selectedPatient.blood_group || 'O+'}</span>
                </div>
                <div style={{ fontSize: '0.813rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {selectedPatient.gender} &middot; DOB: {selectedPatient.date_of_birth || 'N/A'} &middot; Phone: {selectedPatient.phone || 'N/A'} &middot; {selectedPatient.district}
                </div>
              </div>

              {/* Action Buttons: WhatsApp & PDF Print */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setWaRecipientPhone(selectedPatient.phone || '')
                    setWhatsappModalOpen(true)
                  }}
                  className="btn btn-sm"
                  style={{
                    background: '#22c55e',
                    borderColor: '#22c55e',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700
                  }}
                >
                  <MessageSquare size={14} /> Send File on WhatsApp
                </button>

                <button
                  onClick={handlePrintFullPatientFile}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
              </div>
            </div>

            {/* Navigation Tabs for Patient File */}
            <div style={{
              display: 'flex',
              gap: '0.4rem',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem',
              overflowX: 'auto'
            }}>
              {[
                { id: 'overview', label: 'File Overview' },
                { id: 'scans', label: `Scans & Images (${patientRecords.documents.length})` },
                { id: 'vitals', label: `Triage & Vitals (${patientRecords.vitals.length})` },
                { id: 'consults', label: `Consultations (${patientRecords.consults.length})` },
                { id: 'labs', label: `Lab Tests (${patientRecords.labs.length})` },
                { id: 'dispensing', label: `Pharmacy (${patientRecords.dispensing.length})` },
                { id: 'billing', label: `Invoices & Billing (${patientRecords.invoices.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setChartActiveTab(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.813rem',
                    fontWeight: chartActiveTab === tab.id ? 700 : 500,
                    background: chartActiveTab === tab.id ? 'var(--brand)' : 'transparent',
                    color: chartActiveTab === tab.id ? '#fff' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {chartActiveTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem'
                }}>
                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Emergency / Next of Kin</span>
                    <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{selectedPatient.next_of_kin || 'None specified'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedPatient.nok_phone || ''}</div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Known Drug Allergies</span>
                    <div style={{ fontWeight: 700, color: selectedPatient.allergies ? 'var(--danger)' : 'var(--text-main)', marginTop: '0.25rem' }}>
                      {selectedPatient.allergies || 'None Known / Reported'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chronic Conditions</span>
                    <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{selectedPatient.chronic_conditions || 'None Recorded'}</div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clinical Cohort</span>
                    <div style={{ marginTop: '0.25rem' }}>
                      {selectedPatient.is_maternity && <span className="badge badge-warning" style={{ marginRight: 4 }}>Maternity Mother</span>}
                      {selectedPatient.is_pediatric && <span className="badge badge-info">Pediatric IMNCI</span>}
                      {!selectedPatient.is_maternity && !selectedPatient.is_pediatric && <span className="badge badge-secondary">General OPD</span>}
                    </div>
                  </div>
                </div>

                {/* Quick counts */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.75rem'
                }}>
                  <div className="stat-card" style={{ padding: '0.85rem' }}>
                    <span className="stat-label">Scans Attached</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand)' }}>{patientRecords.documents.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.85rem' }}>
                    <span className="stat-label">Consultations</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{patientRecords.consults.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.85rem' }}>
                    <span className="stat-label">Lab Tests</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{patientRecords.labs.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.85rem' }}>
                    <span className="stat-label">Prescriptions</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{patientRecords.dispensing.length}</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCANS & IMAGES (MEDIA) */}
            {chartActiveTab === 'scans' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Attached Scans, X-Rays & Imaging</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Store digital ultrasound, x-ray films, and reports directly in this patient's file</span>
                  </div>
                  <button
                    onClick={() => setDocUploadModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Upload size={14} /> Upload Scan / Image
                  </button>
                </div>

                {patientRecords.documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <Image size={36} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600 }}>No scans or images uploaded yet</div>
                    <p style={{ fontSize: '0.813rem', color: 'var(--text-muted)', margin: '0.25rem 0 1rem' }}>
                      Add ultrasound images, chest X-rays, ECGs or lab photos to this patient's medical file.
                    </p>
                    <button
                      onClick={() => setDocUploadModalOpen(true)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Upload size={14} /> Upload First Scan
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1rem'
                  }}>
                    {patientRecords.documents.map(doc => (
                      <div
                        key={doc.id}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Image Thumbnail */}
                        <div
                          style={{
                            height: 140,
                            background: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                          onClick={() => setViewFullImage(doc)}
                        >
                          {doc.file_data?.startsWith('data:image') ? (
                            <img
                              src={doc.file_data}
                              alt={doc.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ color: '#fff', textAlign: 'center', padding: '1rem' }}>
                              <FileText size={32} />
                              <div style={{ fontSize: '0.72rem', marginTop: 4 }}>PDF Document</div>
                            </div>
                          )}
                          <div style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Eye size={12} /> View Full
                          </div>
                        </div>

                        {/* Card Info */}
                        <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', marginBottom: 4 }}>
                              {doc.doc_type}
                            </span>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginTop: 2 }}>{doc.title}</div>
                            {doc.notes && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{doc.notes}</div>
                            )}
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {doc.uploaded_at?.slice(0, 10)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                            <button
                              onClick={() => setViewFullImage(doc)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                            >
                              <Eye size={12} /> Preview
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', color: 'var(--danger)', fontSize: '0.72rem' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: VITALS */}
            {chartActiveTab === 'vitals' && (
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Triage Vital Signs Timeline</h4>
                {patientRecords.vitals.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No vitals recorded in Triage yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {patientRecords.vitals.map(v => (
                      <div key={v.id} style={{ padding: '0.85rem', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--brand)' }}>
                            BP: {v.blood_pressure || '--/--'} &middot; Pulse: {v.heart_rate || '--'} bpm &middot; Temp: {v.temperature ? `${v.temperature}°C` : '--'} &middot; SpO2: {v.oxygen_sat ? `${v.oxygen_sat}%` : '--'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.created_at?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          Height: {v.height || '--'} cm &middot; Weight: {v.weight || '--'} kg &middot; <strong>BMI: {v.bmi || '--'} ({v.bmi_category || 'N/A'})</strong>
                        </div>
                        {v.apgar_total !== undefined && v.apgar_total !== null && (
                          <div style={{ marginTop: '0.35rem', color: '#ec4899', fontWeight: 700 }}>
                            Maternity APGAR Score: {v.apgar_total}/10 ({v.apgar_interpretation})
                          </div>
                        )}
                        {v.imnci_classifications && v.imnci_classifications.length > 0 && (
                          <div style={{ marginTop: '0.35rem', color: '#f59e0b', fontWeight: 700 }}>
                            IMNCI Signs: {v.imnci_classifications.map(c => c.title).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CONSULTATIONS */}
            {chartActiveTab === 'consults' && (
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Doctor Consultations & Diagnoses</h4>
                {patientRecords.consults.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No clinical consultations recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {patientRecords.consults.map(c => (
                      <div key={c.id} style={{ padding: '0.85rem', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--brand)', fontSize: '0.95rem' }}>{c.diagnosis || 'Clinical Review'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.created_at?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ fontSize: '0.813rem', color: 'var(--text-muted)' }}>Attending Doctor: {c.doctor || 'Physician'}</div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                          <strong>Notes / Treatment Plan:</strong>
                          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                            {c.plan || c.examination || 'No notes entered.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: LABS */}
            {chartActiveTab === 'labs' && (
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Laboratory Tests</h4>
                {patientRecords.labs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No lab tests requested yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {patientRecords.labs.map(l => (
                      <div key={l.id} style={{ padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700 }}>{l.test_name || l.tests}</span>
                          <span className="badge badge-primary">{l.status}</span>
                        </div>
                        {l.results && (
                          <div style={{ marginTop: '0.35rem', color: 'var(--brand)', fontSize: '0.85rem' }}>
                            <strong>Result:</strong> {l.results}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: DISPENSING */}
            {chartActiveTab === 'dispensing' && (
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Dispensed Medications</h4>
                {patientRecords.dispensing.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pharmacy dispensing records for this patient.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {patientRecords.dispensing.map(d => (
                      <div key={d.id} style={{ padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700 }}>{d.items}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Dispensed on {d.dispensed_at?.slice(0, 16).replace('T', ' ')} by {d.dispensed_by || 'Pharmacist'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 7: BILLING */}
            {chartActiveTab === 'billing' && (
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Invoices & Payment Balances</h4>
                {patientRecords.invoices.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No billing records for this patient.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {patientRecords.invoices.map(inv => {
                      const due = Number(inv.amount_due) || 0
                      const paid = Number(inv.amount_paid) || 0
                      const bal = Math.max(0, due - paid)
                      const isCleared = bal <= 0

                      return (
                        <div key={inv.id} style={{ padding: '0.85rem', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{inv.description}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Billed: UGX {due.toLocaleString()} &middot; Paid: UGX {paid.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: bal > 0 ? 'var(--danger)' : '#10b981' }}>
                              Bal: UGX {bal.toLocaleString()}
                            </div>
                            <span className={`badge ${isCleared ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                              {isCleared ? 'Cleared ✓' : 'Partial'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* UPLOAD SCAN / IMAGE MODAL */}
      {docUploadModalOpen && selectedPatient && (
        <Modal title={`Upload Scan / Image for ${selectedPatient.first_name} ${selectedPatient.last_name}`} onClose={() => setDocUploadModalOpen(false)}>
          <form onSubmit={handleSaveDocument} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Scan / Image Category *</label>
              <select
                className="input"
                value={docForm.doc_type}
                onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })}
              >
                <option value="X-Ray Scan">X-Ray Scan (Chest, Limb, Spine, etc.)</option>
                <option value="Ultrasound Scan">Ultrasound Scan (Obstetric / Pelvic / Abdominal)</option>
                <option value="CT / MRI Scan">CT Scan / MRI</option>
                <option value="ECG / Cardiac Strip">ECG / Cardiac Trace</option>
                <option value="Lab Test Photo">Laboratory Micrograph / Strip Photo</option>
                <option value="Clinical Photo">Clinical Lesion / Physical Exam Photo</option>
                <option value="Referral Letter / Report">Referral Letter / External Medical Report</option>
                <option value="Other Medical Scan">Other Medical Document / Scan</option>
              </select>
            </div>

            <div>
              <label className="label">Document Title / Finding Description *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Chest X-Ray PA View - Normal or Pelvic US"
                value={docForm.title}
                onChange={e => setDocForm({ ...docForm, title: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Choose Image or Scan File *</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="input"
                required
                onChange={handleFileChange}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Supports JPG, PNG, WEBP, and PDF scans (up to 8MB).
              </span>
            </div>

            {previewImage && (
              <div style={{ textAlign: 'center', background: '#000', borderRadius: 8, padding: '0.5rem', maxHeight: 220, overflow: 'hidden' }}>
                <img
                  src={previewImage}
                  alt="Preview"
                  style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

            <div>
              <label className="label">Doctor / Radiographer Notes (Optional)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Clinical impressions, radiologist comments..."
                value={docForm.notes}
                onChange={e => setDocForm({ ...docForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDocUploadModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save to Patient File</button>
            </div>
          </form>
        </Modal>
      )}

      {/* FULL IMAGE VIEW MODAL */}
      {viewFullImage && (
        <Modal title={`${viewFullImage.doc_type}: ${viewFullImage.title}`} size="lg" onClose={() => setViewFullImage(null)}>
          <div style={{ textAlign: 'center', background: '#090d16', padding: '1rem', borderRadius: 8 }}>
            {viewFullImage.file_data?.startsWith('data:image') ? (
              <img
                src={viewFullImage.file_data}
                alt={viewFullImage.title}
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 6 }}
              />
            ) : (
              <div style={{ padding: '3rem', color: '#fff' }}>
                <FileText size={48} />
                <p style={{ marginTop: '1rem' }}>PDF document: {viewFullImage.file_name}</p>
                <a
                  href={viewFullImage.file_data}
                  download={viewFullImage.file_name || 'medical_scan.pdf'}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={16} /> Download File
                </a>
              </div>
            )}
          </div>
          {viewFullImage.notes && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 6, fontSize: '0.85rem' }}>
              <strong>Clinical Notes:</strong> {viewFullImage.notes}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <a
              href={viewFullImage.file_data}
              download={viewFullImage.file_name || 'patient_scan.jpg'}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> Download Image
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => setViewFullImage(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* WHATSAPP FULL PATIENT FILE MODAL */}
      {whatsappModalOpen && selectedPatient && (
        <Modal title="Send Full Medical File on WhatsApp" onClose={() => setWhatsappModalOpen(false)}>
          <form onSubmit={handleSendFullPatientFileWhatsApp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
              color: '#22c55e'
            }}>
              Send an official comprehensive medical record summary for <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong> to the patient or consulting doctor via WhatsApp.
            </div>

            <div>
              <label className="label">Recipient WhatsApp Phone Number *</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  className="input"
                  required
                  placeholder="e.g. 0772 123 456 or +256 700 000 000"
                  value={waRecipientPhone}
                  onChange={(e) => setWaRecipientPhone(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
            </div>

            <div style={{
              background: 'var(--surface-2)',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              Includes: Demographics, Blood Group, Allergies, Consultation history, Diagnoses, Triage Vitals, Lab test requests, Medications dispensed, Attached Scans list, and Billing balance.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setWhatsappModalOpen(false)}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#22c55e', borderColor: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={15} /> Open WhatsApp File
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PATIENT REGISTRATION MODAL */}
      {modalOpen && (
        <Modal title="Register New Patient (KIEMED)" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">First Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Gender *</label>
                <select
                  className="input"
                  value={formData.gender}
                  onChange={(e) => {
                    const g = e.target.value
                    setFormData(prev => ({
                      ...prev,
                      gender: g,
                      is_maternity: g === 'Female' ? prev.is_maternity : false
                    }))
                  }}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>

              <div>
                <label className="label">Date of Birth</label>
                <input
                  type="date"
                  className="input"
                  value={formData.date_of_birth}
                  onChange={(e) => handleDobChange(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Blood Group</label>
                <select
                  className="input"
                  value={formData.blood_group}
                  onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clinical Target Flags */}
            <div style={{
              background: 'var(--surface-2)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Clinical Cohort Flags
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.gender === 'Female' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_maternity}
                      onChange={(e) => setFormData({ ...formData, is_maternity: e.target.checked })}
                    />
                    <span>Maternity / Antenatal Mother (Enables Newborn APGAR Scoring in Triage)</span>
                  </label>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_pediatric}
                    onChange={(e) => setFormData({ ...formData, is_pediatric: e.target.checked })}
                  />
                  <span>Pediatric Child &lt; 5 Years (Enables Uganda MoH IMNCI Protocol in Triage)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
                <label className="label">National Identification (NIN)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="CMXXXXXXXXXXXXXX"
                  value={formData.nin}
                  onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">District</label>
                <input
                  type="text"
                  className="input"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Address / Village / Zone</label>
                <input
                  type="text"
                  className="input"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Next of Kin Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.next_of_kin}
                  onChange={(e) => setFormData({ ...formData, next_of_kin: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Next of Kin Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={formData.nok_phone}
                  onChange={(e) => setFormData({ ...formData, nok_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Known Drug Allergies</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Penicillin, Sulfa, NSAIDs"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Save Patient Record
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
