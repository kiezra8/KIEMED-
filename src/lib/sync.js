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
          const { localId, syncStatus, ...clean } = record
          const { error } = await supabase.from(table).upsert(clean, { onConflict: 'id' })
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
