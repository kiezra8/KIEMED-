import { useToastStore } from '../../store'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={18} />,
  error:   <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info:    <Info size={18} />,
}

export default function Toast() {
  const { toasts, remove } = useToastStore()
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className={`toast-icon ${t.type}`}>{ICONS[t.type] || ICONS.info}</span>
          <span style={{ flex: 1, fontSize: '.875rem' }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
