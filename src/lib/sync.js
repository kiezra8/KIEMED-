import { supabase } from './supabase'
import { localDB, getPending, localDB as db, nowISO } from './db'

const SYNC_TABLES = [
  'patients', 'vitals', 'consultations', 'admissions', 'beds',
  'inventory', 'dispensing', 'lab_requests', 'invoices',
  'staff', 'appointments', 'clinics', 'clinic_settings',
  'patient_documents',
]

let syncInProgress = false
let realtimeChannels = []

// ── Sanitize local records to match Supabase table schemas ─────
export function sanitizeRecordForSupabase(table, record) {
  const { localId, syncStatus, ...clean } = record
  if (!clean.id) return null

  switch (table) {
    case 'vitals': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        temperature: clean.temperature ? parseFloat(clean.temperature) || null : null,
        blood_pressure: clean.blood_pressure || null,
        heart_rate: clean.heart_rate ? parseInt(clean.heart_rate) || null : null,
        respiratory_rate: clean.respiratory_rate ? parseInt(clean.respiratory_rate) || null : null,
        oxygen_sat: clean.oxygen_sat ? parseFloat(clean.oxygen_sat) || null : null,
        weight: clean.weight ? parseFloat(clean.weight) || null : null,
        height: clean.height ? parseFloat(clean.height) || null : null,
        bmi: clean.bmi ? parseFloat(clean.bmi) || null : null,
        bmi_category: clean.bmi_category || null,
        muac: clean.muac ? parseFloat(clean.muac) || null : null,
        blood_glucose: clean.blood_glucose ? parseFloat(clean.blood_glucose) || null : null,
        pain_scale: clean.pain_scale !== undefined && clean.pain_scale !== '' ? parseInt(clean.pain_scale) || 0 : 0,
        chief_complaint: clean.chief_complaint || null,
        priority: clean.priority || 'Normal',
        nurse_notes: clean.nurse_notes || null,
        recorded_by: clean.recorded_by || null,
        apgar_1min: clean.apgar_1min ? parseInt(clean.apgar_1min) || null : null,
        apgar_5min: clean.apgar_5min ? parseInt(clean.apgar_5min) || null : null,
        apgar_10min: clean.apgar_10min ? parseInt(clean.apgar_10min) || null : null,
        apgar_total: clean.apgar_total !== undefined && clean.apgar_total !== null ? parseInt(clean.apgar_total) || null : null,
        apgar_interpretation: clean.apgar_interpretation || null,
        imnci_general_danger_signs: Array.isArray(clean.imnci_general_danger_signs) ? clean.imnci_general_danger_signs : [],
        imnci_classifications: Array.isArray(clean.imnci_classifications) ? clean.imnci_classifications : [],
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'lab_requests': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        patient_name: clean.patient_name || null,
        test_name: clean.test_name || clean.tests || 'Lab Investigation',
        status: clean.status || 'pending',
        results: clean.results || null,
        requested_by: clean.requested_by || 'Staff Clinician',
        completed_by: clean.completed_by || null,
        cost: clean.cost !== undefined && clean.cost !== '' ? parseFloat(clean.cost) || 0 : 0,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'consultations': {
      let prescriptionStr = clean.prescription || ''
      if (typeof clean.prescriptions === 'object') {
        try { prescriptionStr = JSON.stringify(clean.prescriptions) } catch (e) {}
      }
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        doctor: clean.doctor || 'Staff Doctor',
        complaint: clean.complaint || null,
        examination: clean.examination || null,
        diagnosis: clean.diagnosis || 'Clinical Consultation',
        plan: clean.plan || null,
        prescription: prescriptionStr || null,
        status: clean.status || 'completed',
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'invoices': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id || null,
        patient_name: clean.patient_name || 'Walk-in Patient',
        customer_phone: clean.customer_phone || null,
        category: clean.category || 'General Outpatient',
        description: clean.description || 'Medical Service Fee',
        amount_due: parseFloat(clean.amount_due) || 0,
        amount_paid: parseFloat(clean.amount_paid) || 0,
        balance: parseFloat(clean.balance) || 0,
        payment_method: clean.payment_method || 'Cash',
        status: clean.status || 'Unpaid',
        is_direct_sale: !!clean.is_direct_sale,
        last_payment_at: clean.last_payment_at || null,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'inventory': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        name: clean.name,
        category: clean.category || 'General',
        unit: clean.unit || 'Tablets',
        current_stock: parseInt(clean.current_stock) || 0,
        reorder_level: parseInt(clean.reorder_level) || 10,
        unit_price: parseFloat(clean.unit_price) || 0,
        supplier: clean.supplier || null,
        expiry_date: clean.expiry_date || null,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'dispensing': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id || null,
        patient_name: clean.patient_name || null,
        customer_phone: clean.customer_phone || null,
        items: typeof clean.items === 'object' ? JSON.stringify(clean.items) : String(clean.items || ''),
        is_direct_sale: !!clean.is_direct_sale,
        status: clean.status || 'dispensed',
        dispensed_by: clean.dispensed_by || null,
        dispensed_at: clean.dispensed_at || new Date().toISOString(),
        total_amount: parseFloat(clean.total_amount) || 0,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'patient_documents': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        patient_name: clean.patient_name || null,
        doc_type: clean.doc_type || 'Scan',
        title: clean.title || 'Patient Document',
        notes: clean.notes || null,
        file_name: clean.file_name || null,
        file_data: clean.file_data || null,
        uploaded_at: clean.uploaded_at || new Date().toISOString(),
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'admissions': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        patient_name: clean.patient_name || null,
        ward: clean.ward || 'General Medical Ward',
        bed_number: clean.bed_number || 'BED-01',
        admit_date: clean.admit_date || new Date().toISOString(),
        discharge_date: clean.discharge_date || null,
        admitted_by: clean.admitted_by || null,
        reason: clean.reason || null,
        status: clean.status || 'admitted',
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'beds': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        ward: clean.ward || 'General Medical Ward',
        bed_number: clean.bed_number || 'BED-01',
        status: clean.status || 'available',
        patient_id: clean.patient_id || null,
        patient_name: clean.patient_name || null,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'appointments': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_id: clean.patient_id,
        patient_name: clean.patient_name || null,
        doctor: clean.doctor || null,
        appointment_date: clean.appointment_date || new Date().toISOString().slice(0, 10),
        appointment_time: clean.appointment_time || null,
        department: clean.department || null,
        status: clean.status || 'scheduled',
        notes: clean.notes || null,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    case 'patients': {
      return {
        id: clean.id,
        clinic_id: clean.clinic_id,
        patient_number: clean.patient_number || null,
        first_name: clean.first_name || '',
        last_name: clean.last_name || '',
        date_of_birth: clean.date_of_birth || null,
        gender: clean.gender || 'Female',
        phone: clean.phone || null,
        nin: clean.nin || null,
        email: clean.email || null,
        address: clean.address || null,
        district: clean.district || 'Kampala',
        blood_group: clean.blood_group || null,
        allergies: clean.allergies || null,
        chronic_conditions: clean.chronic_conditions || null,
        next_of_kin: clean.next_of_kin || null,
        nok_phone: clean.nok_phone || null,
        outstanding_balance: parseFloat(clean.outstanding_balance) || 0,
        is_maternity: !!clean.is_maternity,
        is_pediatric: !!clean.is_pediatric,
        notes: clean.notes || null,
        created_at: clean.created_at || new Date().toISOString(),
        updated_at: clean.updated_at || new Date().toISOString(),
      }
    }

    default:
      return clean
  }
}

// ── Upload pending local records to Supabase ─────────────────
export async function flushPending(onProgress) {
  if (syncInProgress) return
  syncInProgress = true
  let synced = 0, failed = 0

  try {
    for (const table of SYNC_TABLES) {
      const pending = await getPending(table)
      for (const record of pending) {
        try {
          const payload = sanitizeRecordForSupabase(table, record)
          if (!payload) continue
          const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' })
          if (error) throw error
          await localDB[table].where('id').equals(record.id).modify({ syncStatus: 'synced' })
          synced++
        } catch (err) {
          console.warn(`[sync] Failed ${table}/${record.id}:`, err.message)
          failed++
        }
      }
    }
    if (onProgress) onProgress({ synced, failed })
  } finally {
    syncInProgress = false
  }
  return { synced, failed }
}

// ── Pull all records from Supabase into local ─────────────────
export async function pullFromSupabase(clinicId) {
  if (!clinicId) return
  let anyChanged = false
  for (const table of SYNC_TABLES) {
    try {
      let query = supabase.from(table).select('*')
      if (table === 'clinics') {
        query = query.eq('id', clinicId)
      } else {
        query = query.eq('clinic_id', clinicId)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) continue

      let tableChanged = false
      for (const record of data) {
        const existing = await localDB[table].where('id').equals(record.id).first()
        if (existing) {
          if (existing.syncStatus !== 'pending') {
            await localDB[table].where('id').equals(record.id).modify({ ...record, syncStatus: 'synced' })
            tableChanged = true
          }
        } else {
          await localDB[table].add({ ...record, syncStatus: 'synced' })
          tableChanged = true
        }
      }

      if (tableChanged) {
        anyChanged = true
        window.dispatchEvent(new CustomEvent('kiemed-data-change', {
          detail: { table, action: 'pull' }
        }))
      }
    } catch (err) {
      console.warn(`[sync] Pull failed for ${table}:`, err.message)
    }
  }

  if (anyChanged) {
    window.dispatchEvent(new CustomEvent('kiemed-data-change', {
      detail: { table: 'all', action: 'pull' }
    }))
  }
}

// ── Real-time Supabase subscriptions ─────────────────────────
export function startRealtime(clinicId, onUpdate) {
  stopRealtime()
  if (!clinicId) return

  const tables = [
    'clinic_settings', 'patients', 'vitals', 'consultations',
    'admissions', 'beds', 'inventory', 'lab_requests', 'invoices',
    'appointments', 'dispensing', 'patient_documents'
  ]

  tables.forEach(table => {
    const channelName = `realtime:${table}:${clinicId}`
    const filter = `clinic_id=eq.${clinicId}`

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter,
      }, async (payload) => {
        const record = payload.new || payload.old
        if (!record?.id) return

        try {
          if (payload.eventType === 'DELETE') {
            await localDB[table].where('id').equals(record.id).delete()
          } else {
            const existing = await localDB[table].where('id').equals(record.id).first()
            if (existing) {
              if (existing.syncStatus !== 'pending') {
                await localDB[table].where('id').equals(record.id).modify({ ...record, syncStatus: 'synced' })
              }
            } else {
              await localDB[table].add({ ...record, syncStatus: 'synced' })
            }
          }
          window.dispatchEvent(new CustomEvent('kiemed-data-change', {
            detail: { table, action: payload.eventType, source: 'realtime', record }
          }))
          if (onUpdate) onUpdate(table, payload.eventType)
        } catch (err) {
          console.warn(`[realtime] Error handling ${table}:`, err)
        }
      })
      .subscribe()

    realtimeChannels.push(channel)
  })
}

export function stopRealtime() {
  realtimeChannels.forEach(ch => supabase.removeChannel(ch))
  realtimeChannels = []
}
