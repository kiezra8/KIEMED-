import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, size = '' }) {
  const ref = useRef()

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${size ? ' modal-' + size : ''}`} ref={ref}>
        {title !== undefined && (
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            {onClose && (
              <button className="btn-icon" onClick={onClose} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
