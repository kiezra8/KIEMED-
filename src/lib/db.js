import Dexie from 'dexie'

export const localDB = new Dexie('KIEMEDLocal')

localDB.version(1).stores({
  patients:       '++localId, id, clinic_id, syncStatus, created_at',
  vitals:         '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  consultations:  '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  admissions:     '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  beds:           '++localId, id, clinic_id, ward, syncStatus',
  inventory:      '++localId, id, clinic_id, syncStatus, created_at',
  dispensing:     '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  lab_requests:   '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  invoices:       '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  staff:          '++localId, id, clinic_id, syncStatus',
  appointments:   '++localId, id, clinic_id, patient_id, syncStatus, created_at',
  audit_logs:     '++localId, id, clinic_id, created_at',
  clinics:        '++localId, id, syncStatus',
  clinic_settings:'++localId, id, clinic_id, syncStatus',
  pending_ops:    '++localId, table_name, record_id, operation, created_at',
})

localDB.version(2).stores({
  patient_documents: '++localId, id, clinic_id, patient_id, syncStatus, created_at',
})

// ── Helpers ───────────────────────────────────────────────────

export function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

export function nowISO() { return new Date().toISOString() }

export async function localAdd(table, data, clinicId) {
  const record = {
    ...data,
    id: data.id || generateUUID(),
    clinic_id: clinicId || data.clinic_id,
    syncStatus: 'pending',
    created_at: data.created_at || nowISO(),
    updated_at: nowISO(),
  }
  await localDB[table].add(record)
  window.dispatchEvent(new CustomEvent('kiemed-data-change', { detail: { table, action: 'add', record } }))
  if (navigator.onLine) {
    import('./sync').then(s => s.flushPending().catch(() => {}))
  }
  return record
}

export async function localPut(table, data) {
  const record = { ...data, syncStatus: 'pending', updated_at: nowISO() }
  await localDB[table].where('id').equals(data.id).modify(record)
  window.dispatchEvent(new CustomEvent('kiemed-data-change', { detail: { table, action: 'put', record } }))
  if (navigator.onLine) {
    import('./sync').then(s => s.flushPending().catch(() => {}))
  }
  return record
}

export async function localDelete(table, id) {
  await localDB[table].where('id').equals(id).delete()
  window.dispatchEvent(new CustomEvent('kiemed-data-change', { detail: { table, action: 'delete', id } }))
  if (navigator.onLine) {
    import('./sync').then(s => s.flushPending().catch(() => {}))
  }
}

export async function localGetAll(table, clinicId) {
  if (clinicId) return localDB[table].where('clinic_id').equals(clinicId).toArray()
  return localDB[table].toArray()
}

export async function localGet(table, id) {
  return localDB[table].where('id').equals(id).first()
}

export async function getPending(table) {
  return localDB[table].where('syncStatus').equals('pending').toArray()
}
