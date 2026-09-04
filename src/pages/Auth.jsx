import { useState } from 'react'
import { Mail, Lock, LogIn, UserPlus, Hospital, Globe } from 'lucide-react'
import { useAuthStore, useToastStore } from '../store'

export default function Auth({ onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn, signUp, setUser } = useAuthStore()
  const { add: toast } = useToastStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      return toast('Please enter email and password', 'warning')
    }

    if (!isLogin && password !== confirmPassword) {
      return toast('Passwords do not match', 'error')
    }

    if (password.length < 6) {
      return toast('Password must be at least 6 characters', 'warning')
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email.trim(), password)
        toast('Logged in successfully', 'success')
      } else {
        await signUp(email.trim(), password)
        toast('Account created successfully! Welcome to KIEMED.', 'success')
      }
      if (onAuthenticated) onAuthenticated()
    } catch (err) {
      console.error(err)
      toast(err.message || 'Authentication failed. Please check details.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="setup-card" style={{ maxWidth: 440, width: '100%', padding: '2.5rem 2rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--brand) 0%, #0284c7 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(13, 148, 136, 0.25)',
            marginBottom: '1rem'
          }}>
            <Hospital size={30} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', margin: 0, color: 'var(--text-main)' }}>
            KIEMED
          </h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.08em', marginTop: '0.25rem', textTransform: 'uppercase' }}>
            Hospital Management System
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'rgba(13, 148, 136, 0.1)',
            color: 'var(--brand)',
            fontSize: '0.725rem',
            fontWeight: 600,
            marginTop: '0.5rem'
          }}>
            <Globe size={12} /> Uganda Clinical Guidelines (UCG / MOH)
          </div>
        </div>

        {/* Tab switch */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--surface-2)',
          padding: 4,
          borderRadius: 'var(--radius)',
          marginBottom: '1.5rem',
          border: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.875rem',
              background: isLogin ? 'var(--brand)' : 'transparent',
              color: isLogin ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.875rem',
              background: !isLogin ? 'var(--brand)' : 'transparent',
              color: !isLogin ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.813rem', fontWeight: 600 }}>Staff Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: 38 }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@hospital.org"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.813rem', fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: 38 }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.813rem', fontWeight: 600 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', height: 44, fontSize: '0.938rem', fontWeight: 700, gap: 8 }}
            disabled={loading}
          >
            {loading ? (
              'Processing...'
            ) : isLogin ? (
              <>
                <LogIn size={18} /> Sign In to Hospital
              </>
            ) : (
              <>
                <UserPlus size={18} /> Register Hospital Account
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
