import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { localAdd, localPut, localGetAll, localDB, generateUUID } from '../lib/db'
import { flushPending, pullFromSupabase, startRealtime, stopRealtime } from '../lib/sync'

// ── Auth Store ────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: false,

      setUser: (user, session) => set({ user, session, loading: false }),
      setLoading: (loading) => set({ loading }),

      initAuth: async () => {
        try {
          // Safety timeout so getSession never hangs indefinitely
          const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1500))
          const sessionPromise = supabase.auth.getSession().then(({ data }) => data?.session).catch(() => null)
          const session = await Promise.race([sessionPromise, timeoutPromise])

          if (session?.user) {
            set({ user: session.user, session, loading: false })
          } else {
            const cachedUser = get().user
            // Strictly require a valid registered user account
            if (cachedUser?.email && cachedUser.email !== 'admin@kiemed.local') {
              set({ user: cachedUser, loading: false })
            } else {
              set({ user: null, session: null, loading: false })
            }
          }
        } catch (e) {
          console.warn('[auth] Init error:', e)
          set({ loading: false })
        }

        try {
          supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              set({ user: session.user, session, loading: false })
            } else if (_event === 'SIGNED_OUT') {
              set({ user: null, session: null, loading: false })
            }
          })
        } catch (e) {
          console.warn('[auth] Auth state change listener error:', e)
        }
      },

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        set({ user: data.user, session: data.session, loading: false })
        return data
      },

      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        set({ user: data.user, session: data.session, loading: false })
        return data
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut()
        } catch (e) {}
        set({ user: null, session: null, loading: false })
      },
    }),
    { name: 'kiemed-auth', partialize: s => ({ user: s.user, session: s.session }) }
  )
)

// ── Clinic Store ──────────────────────────────────────────────
export const useClinicStore = create(
  persist(
    (set, get) => ({
      currentClinicId: null,
      currentClinic: null,
      clinics: [],
      isLoaded: false,

      setCurrentClinic: (clinic) => set({ currentClinicId: clinic?.id, currentClinic: clinic }),

      loadClinics: async () => {
        let clinics = await localGetAll('clinics')

        // Always check Supabase for clinics when online so any device signing in sees all existing clinics
        if (navigator.onLine) {
          try {
            const { data } = await supabase.from('clinics').select('*').order('created_at', { ascending: true })
            if (data && data.length > 0) {
              for (const c of data) {
                const existing = await localDB.clinics.where('id').equals(c.id).first()
                if (existing) {
                  await localDB.clinics.where('id').equals(c.id).modify({ ...c, syncStatus: 'synced' })
                } else {
                  await localDB.clinics.add({ ...c, syncStatus: 'synced' })
                }
              }
              clinics = await localGetAll('clinics')
            }
          } catch (e) {
            console.warn('[clinic] Remote clinic check error:', e)
          }
        }

        const storedId = get().currentClinicId
        // Prioritize: stored clinic, or primary clinic with data, or first available clinic
        let active = (clinics || []).find(c => c.id === storedId)
        if (!active && clinics && clinics.length > 0) {
          active = clinics.find(c => c.id === 'df1dc645-616f-4743-ac4d-f8814c708181') || clinics[0]
        }

        set({
          clinics: clinics || [],
          currentClinicId: active?.id || null,
          currentClinic: active,
          isLoaded: true,
        })

        // Automatically initiate sync so all patients and medical files are pulled on this device immediately!
        if (active?.id && navigator.onLine) {
          useSyncStore.getState().sync(active.id).then(() => {
            useSyncStore.getState().startListening(active.id)
          })
        }

        return clinics
      },

      createClinic: async (data) => {
        const clinic = await localAdd('clinics', data)
        // Also create default settings
        await localAdd('clinic_settings', {
          clinic_id: clinic.id,
          pin_hash: null,
          show_finances: false,
          theme: 'dark',
          currency: 'UGX',
        })
        set(s => ({ clinics: [...s.clinics, clinic], currentClinicId: clinic.id, currentClinic: clinic, isLoaded: true }))
        return clinic
      },
    }),
    {
      name: 'kiemed-clinic',
      partialize: s => ({
        currentClinicId: s.currentClinicId,
        currentClinic: s.currentClinic,
        clinics: s.clinics,
      })
    }
  )
)

// ── Sync Store ────────────────────────────────────────────────
export const useSyncStore = create((set, get) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  syncError: null,

  setOnline: (val) => set({ isOnline: val }),
  setSyncing: (val) => set({ isSyncing: val }),

  sync: async (clinicId) => {
    if (get().isSyncing) return
    set({ isSyncing: true, syncError: null })
    try {
      await flushPending()
      await pullFromSupabase(clinicId)
      set({ lastSyncAt: new Date().toISOString(), isSyncing: false })
    } catch (e) {
      set({ syncError: e.message, isSyncing: false })
    }
  },

  startListening: (clinicId, onUpdate) => {
    startRealtime(clinicId, onUpdate)
  },

  stopListening: () => stopRealtime(),
}))

// ── Auth / PIN Store ──────────────────────────────────────────
export const usePinStore = create(
  persist(
    (set, get) => ({
      pinUnlocked: false,
      pinHash: null,
      hasPIN: false,

      setPinHash: (hash) => set({ pinHash: hash, hasPIN: !!hash }),
      unlock: () => set({ pinUnlocked: true }),
      lock: () => set({ pinUnlocked: false }),

      verifyPIN: async (pin) => {
        const hash = get().pinHash
        if (!hash) { set({ pinUnlocked: true }); return true }
        const inputHash = await hashPIN(pin)
        if (inputHash === hash) { set({ pinUnlocked: true }); return true }
        return false
      },

      savePIN: async (pin) => {
        const hash = await hashPIN(pin)
        set({ pinHash: hash, hasPIN: true })
        return hash
      },

      clearPIN: () => set({ pinHash: null, hasPIN: false, pinUnlocked: true }),
    }),
    { name: 'kiemed-pin', partialize: s => ({ pinHash: s.pinHash, hasPIN: s.hasPIN }) }
  )
)

async function hashPIN(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Toast Store ───────────────────────────────────────────────
export const useToastStore = create((set) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
