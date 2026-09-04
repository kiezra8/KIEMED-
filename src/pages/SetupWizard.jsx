import { useState } from 'react'
import { Building2, MapPin, Phone, ArrowRight, Lock, Shield, BedDouble } from 'lucide-react'
import { useClinicStore, usePinStore, useToastStore } from '../store'

export default function SetupWizard() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', address: '', phone: '', district: '', bed_capacity: '20' })
  const [pinSetup, setPinSetup] = useState('skip') // 'setup' | 'skip'
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)

  const { createClinic } = useClinicStore()
  const { savePIN, clearPIN } = usePinStore()
  const { add: toast } = useToastStore()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFinish = async () => {
    if (!form.name.trim()) return toast('Clinic name is required', 'error')
    if (pinSetup === 'setup') {
      if (pin.length !== 4) return toast('PIN must be 4 digits', 'error')
      if (pin !== confirmPin) return toast('PINs do not match', 'error')
    }
    setLoading(true)
    try {
      await createClinic({
        ...form,
        bed_capacity: parseInt(form.bed_capacity) || 20,
      })
      if (pinSetup === 'setup') await savePIN(pin)
      else clearPIN()
      toast(`Welcome to KIEMED! ${form.name} is ready.`, 'success')
    } catch (e) {
      toast('Setup failed: ' + e.message, 'error')
    }
    setLoading(false)
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        {/* Logo */}
        <div className="setup-logo">
          <div className="brand-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: '1.8rem' }}>🏥</div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-.02em' }}>KIEMED</div>
            <div style={{ fontSize: '.75rem', color: 'var(--brand)', fontWeight: 700, letterSpacing: '.1em' }}>HOSPITAL MANAGEMENT SYSTEM</div>
          </div>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? 'var(--brand)' : 'var(--surface-2)',
              transition: 'background .3s'
            }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>Set Up Your Clinic</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: 24 }}>
              Enter your clinic or hospital details to get started. You can add more clinics later from Settings.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Clinic / Hospital Name <span className="req">*</span></label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-control" style={{ paddingLeft: 32 }} value={form.name}
                    onChange={e => set('name', e.target.value)} placeholder="e.g. KIEMED Hospital Kampala" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-control" style={{ paddingLeft: 32 }} value={form.address}
                    onChange={e => set('address', e.target.value)} placeholder="Plot 14, Nakasero, Kampala" />
                </div>
              </div>
              <div className="form-grid-2 form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-control" style={{ paddingLeft: 32 }} value={form.phone}
                      onChange={e => set('phone', e.target.value)} placeholder="+256 700 000000" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">District</label>
                  <input className="form-control" value={form.district}
                    onChange={e => set('district', e.target.value)} placeholder="Kampala" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Total Inpatient Bed Capacity <span className="req">*</span></label>
                <div style={{ position: 'relative' }}>
                  <BedDouble size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    style={{ paddingLeft: 32 }}
                    value={form.bed_capacity}
                    onChange={e => set('bed_capacity', e.target.value)}
                    placeholder="e.g. 20"
                    required
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Define your hospital/clinic bed capacity for inpatient admissions.
                </span>
              </div>
            </div>
            <button className="btn btn-primary w-full" style={{ marginTop: 24 }}
              onClick={() => form.name.trim() ? setStep(2) : toast('Clinic name required', 'error')}>
              Continue <ArrowRight size={16} />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>Finance PIN Protection</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: 24 }}>
              Optionally set a 4-digit PIN to protect financial data. Revenue, billing totals, and reports will be hidden behind this PIN.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['setup', 'skip'].map(opt => (
                <div key={opt} onClick={() => setPinSetup(opt)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${pinSetup === opt ? 'var(--brand)' : 'var(--border)'}`,
                    cursor: 'pointer', background: pinSetup === opt ? 'rgba(13,148,136,.08)' : 'var(--surface-2)',
                    transition: 'all .2s'
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: pinSetup === opt ? 'rgba(13,148,136,.2)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {opt === 'setup' ? <Lock size={18} color={pinSetup === opt ? 'var(--brand)' : 'var(--text-muted)'} /> : <Shield size={18} color={pinSetup === opt ? 'var(--brand)' : 'var(--text-muted)'} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{opt === 'setup' ? 'Set a Finance PIN' : 'Skip — No PIN'}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                      {opt === 'setup' ? 'Secure billing & revenue with a 4-digit PIN' : 'Financial data will be visible to anyone using the app'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pinSetup === 'setup' && (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Enter 4-digit PIN</label>
                  <input className="form-control" type="password" inputMode="numeric" maxLength={4}
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••" style={{ letterSpacing: '0.5rem', fontSize: '1.2rem', textAlign: 'center' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm PIN</label>
                  <input className="form-control" type="password" inputMode="numeric" maxLength={4}
                    value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••" style={{ letterSpacing: '0.5rem', fontSize: '1.2rem', textAlign: 'center' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>Ready to Launch!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: 24 }}>Review your setup and click Launch to start using KIEMED.</p>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Clinic', form.name],
                ['Address', form.address || '—'],
                ['Phone', form.phone || '—'],
                ['District', form.district || '—'],
                ['Finance PIN', pinSetup === 'setup' ? '🔒 Enabled' : '🔓 Disabled'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFinish} disabled={loading}>
                {loading ? 'Setting up…' : '🚀 Launch KIEMED'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
