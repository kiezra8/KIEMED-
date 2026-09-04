import { useState } from 'react'
import { Lock, ShieldAlert, KeyRound } from 'lucide-react'
import { usePinStore, useToastStore } from '../../store'
import Modal from './Modal'

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const { hasPIN, verifyPIN, savePIN } = usePinStore()
  const { add: toast } = useToastStore()

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isSettingUp, setIsSettingUp] = useState(!hasPIN)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleDigit = (digit) => {
    setError('')
    if (isSettingUp) {
      if (pin.length < 4) {
        setPin(prev => prev + digit)
      } else if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + digit)
      }
    } else {
      if (pin.length < 4) {
        const next = pin + digit
        setPin(next)
        if (next.length === 4) {
          verifyEnteredPin(next)
        }
      }
    }
  }

  const handleBackspace = () => {
    setError('')
    if (isSettingUp) {
      if (confirmPin.length > 0) {
        setConfirmPin(prev => prev.slice(0, -1))
      } else if (pin.length > 0) {
        setPin(prev => prev.slice(0, -1))
      }
    } else {
      setPin(prev => prev.slice(0, -1))
    }
  }

  const verifyEnteredPin = async (val) => {
    setLoading(true)
    const valid = await verifyPIN(val)
    setLoading(false)
    if (valid) {
      toast('Financial metrics unlocked', 'success')
      setPin('')
      if (onSuccess) onSuccess()
      onClose()
    } else {
      setError('Incorrect PIN. Please try again.')
      setPin('')
    }
  }

  const handleSavePin = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match')
      setConfirmPin('')
      return
    }
    setLoading(true)
    await savePIN(pin)
    setLoading(false)
    toast('Finance security PIN created successfully!', 'success')
    setPin('')
    setConfirmPin('')
    if (onSuccess) onSuccess()
    onClose()
  }

  const handleSkipPIN = () => {
    usePinStore.getState().unlock()
    toast('Finances unlocked without PIN', 'info')
    if (onSuccess) onSuccess()
    onClose()
  }

  return (
    <Modal title={isSettingUp ? "Configure Finance PIN" : "Finance Authorization Required"} onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--brand-glow, rgba(16, 185, 129, 0.15))',
          color: 'var(--brand, #10b981)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem'
        }}>
          {isSettingUp ? <KeyRound size={28} /> : <Lock size={28} />}
        </div>

        {isSettingUp ? (
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>
              Create a 4-Digit Finance PIN
            </h3>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Financial collections and revenue stats are protected from unauthorized viewing. Enter a 4-digit PIN below or choose to skip.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                {pin.length < 4 ? 'Enter 4 digits:' : 'Confirm 4 digits:'}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', margin: '0.75rem 0' }}>
                {[0, 1, 2, 3].map((i) => {
                  const active = pin.length < 4 ? i < pin.length : i < confirmPin.length
                  return (
                    <div
                      key={i}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: active ? 'var(--brand, #10b981)' : 'var(--border, #334155)',
                        transition: 'background 0.2s',
                        boxShadow: active ? '0 0 8px var(--brand, #10b981)' : 'none'
                      }}
                    />
                  )
                })}
              </div>
            </div>

            {pin.length === 4 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--brand)', marginBottom: '0.5rem' }}>
                First 4 digits entered. Now confirm by re-entering.
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>
              Enter Security PIN
            </h3>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Enter your 4-digit PIN to access revenue, billing summaries, and financial reports.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', margin: '1rem 0 1.5rem' }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: i < pin.length ? 'var(--brand, #10b981)' : 'var(--border, #334155)',
                    transition: 'all 0.2s',
                    boxShadow: i < pin.length ? '0 0 10px var(--brand, #10b981)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            color: 'var(--danger, #ef4444)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}>
            <ShieldAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.6rem',
          maxWidth: '240px',
          margin: '0 auto 1.25rem'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleDigit(String(n))}
              className="btn btn-secondary"
              style={{
                height: '48px',
                fontSize: '1.25rem',
                fontWeight: 600,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="btn btn-ghost"
            style={{ height: '48px', fontSize: '0.9rem' }}
          >
            Del
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="btn btn-secondary"
            style={{
              height: '48px',
              fontSize: '1.25rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => { setPin(''); setConfirmPin(''); setError('') }}
            className="btn btn-ghost"
            style={{ height: '48px', fontSize: '0.85rem' }}
          >
            Clear
          </button>
        </div>

        {isSettingUp ? (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {pin.length === 4 && confirmPin.length === 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePin}
                disabled={loading}
              >
                Set PIN & Unlock
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleSkipPIN}
            >
              Skip (View without PIN)
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-link"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              onClick={() => setIsSettingUp(true)}
            >
              Reset or Change PIN
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
