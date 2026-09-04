import { useState, useEffect } from 'react'
import {
  Receipt, Lock, Unlock, Plus, Search, CheckCircle2,
  AlertCircle, Building2, Shield, DollarSign, Wallet,
  CreditCard, ArrowDownRight, RefreshCw, Printer, Send, MessageSquare, Phone
} from 'lucide-react'
import { useClinicStore, usePinStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut } from '../lib/db'
import PinModal from '../components/ui/PinModal'
import Modal from '../components/ui/Modal'

export default function Billing() {
  const { currentClinic, clinics } = useClinicStore()
  const { pinUnlocked, hasPIN, lock } = usePinStore()
  const { add: toast } = useToastStore()

  const [invoices, setInvoices] = useState([])
  const [allClinicsInvoices, setAllClinicsInvoices] = useState([])
  const [patients, setPatients] = useState([])
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Add Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  // WhatsApp Receipt Modal State
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [targetReceiptInvoice, setTargetReceiptInvoice] = useState(null)
  const [recipientPhone, setRecipientPhone] = useState('')

  // Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    patient_id: '',
    description: 'General Outpatient Consultation & Medication',
    amount_due: '',
    amount_paid: '',
    payment_method: 'Cash',
  })

  useEffect(() => {
    loadBillingData()
    const handleDataChange = (e) => {
      if (!e.detail?.table || e.detail?.table === 'invoices') {
        loadBillingData()
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id])

  const loadBillingData = async () => {
    if (!currentClinic?.id) return
    const [invs, allInvs, pts] = await Promise.all([
      localGetAll('invoices', currentClinic.id),
      localGetAll('invoices'),
      localGetAll('patients', currentClinic.id),
    ])

    // Clean load: no dummy sample seeding
    setInvoices(invs || [])
    setAllClinicsInvoices(allInvs || [])
    setPatients(pts || [])
  }

  const handleCreateInvoice = async (e) => {
    e.preventDefault()
    if (!invoiceForm.patient_id) {
      toast('Please select a patient', 'warning')
      return
    }

    const patient = patients.find(p => p.id === invoiceForm.patient_id)
    const due = parseFloat(invoiceForm.amount_due) || 0
    const paid = parseFloat(invoiceForm.amount_paid) || 0
    const balance = Math.max(0, due - paid)
    const status = balance <= 0 ? 'Cleared' : paid > 0 ? 'Partial' : 'Unpaid'

    try {
      await localAdd('invoices', {
        ...invoiceForm,
        patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Patient',
        customer_phone: patient?.phone || '',
        amount_due: due,
        amount_paid: paid,
        balance,
        status,
        created_at: new Date().toISOString(),
      }, currentClinic.id)

      toast('Invoice created and payment recorded', 'success')
      setInvoiceModalOpen(false)
      setInvoiceForm({
        patient_id: '',
        description: 'General Outpatient Consultation & Medication',
        amount_due: '',
        amount_paid: '',
        payment_method: 'Cash',
      })
      loadBillingData()
    } catch (err) {
      toast('Failed to create invoice: ' + err.message, 'error')
    }
  }

  // Record an additional payment against an existing invoice
  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!selectedInvoice) return

    const payNow = parseFloat(paymentAmount) || 0
    if (payNow <= 0) {
      toast('Please enter a valid payment amount', 'warning')
      return
    }

    const currentDue = Number(selectedInvoice.amount_due) || 0
    const prevPaid = Number(selectedInvoice.amount_paid) || 0
    const newPaid = prevPaid + payNow
    const newBalance = Math.max(0, currentDue - newPaid)
    const newStatus = newBalance <= 0 ? 'Cleared' : 'Partial'

    try {
      await localPut('invoices', {
        ...selectedInvoice,
        amount_paid: newPaid,
        balance: newBalance,
        status: newStatus,
        payment_method: paymentMethod,
        last_payment_at: new Date().toISOString(),
      })

      toast(
        newBalance <= 0
          ? `Full payment settled! Invoice #${selectedInvoice.id?.slice(0, 6)} is Cleared ✓`
          : `Payment of UGX ${payNow.toLocaleString()} added. Remaining balance: UGX ${newBalance.toLocaleString()}`,
        'success'
      )

      setPaymentModalOpen(false)
      setSelectedInvoice(null)
      setPaymentAmount('')
      loadBillingData()
    } catch (err) {
      toast('Failed to record payment: ' + err.message, 'error')
    }
  }

  // Open WhatsApp with pre-formatted invoice receipt
  const handleSendWhatsAppReceipt = (invoice) => {
    // Find patient phone or use existing
    const linkedPatient = patients.find(p => p.id === invoice.patient_id)
    const phone = invoice.customer_phone || linkedPatient?.phone || ''
    setTargetReceiptInvoice(invoice)
    setRecipientPhone(phone)
    setWhatsappModalOpen(true)
  }

  const confirmAndLaunchWhatsApp = (e) => {
    e.preventDefault()
    if (!recipientPhone.trim()) {
      toast('Please enter patient or recipient phone number', 'warning')
      return
    }

    if (!targetReceiptInvoice) return

    // Clean phone number for WhatsApp wa.me
    let cleanPhone = recipientPhone.replace(/\D/g, '')
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '256' + cleanPhone.slice(1) // Uganda prefix
    } else if (!cleanPhone.startsWith('256') && cleanPhone.length === 9) {
      cleanPhone = '256' + cleanPhone
    }

    const due = Number(targetReceiptInvoice.amount_due || 0).toLocaleString()
    const paid = Number(targetReceiptInvoice.amount_paid || 0).toLocaleString()
    const bal = Number(targetReceiptInvoice.balance || 0).toLocaleString()
    const isCleared = (Number(targetReceiptInvoice.balance) || 0) <= 0

    const clinicTitle = currentClinic?.name || 'KIEMED HEALTH CENTER'
    const invNumber = (targetReceiptInvoice.id || 'INV').slice(0, 8).toUpperCase()
    const dateStr = targetReceiptInvoice.created_at ? targetReceiptInvoice.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)

    const textMessage =
`🏥 *${clinicTitle.toUpperCase()}*
*PAYMENT RECEIPT & BILLING ADVICE*
----------------------------------------
*Receipt No:* #${invNumber}
*Date:* ${dateStr}
*Patient Name:* ${targetReceiptInvoice.patient_name || 'Patient'}
*Service/Items:* ${targetReceiptInvoice.description || 'Medical Services'}
----------------------------------------
*Total Bill:* UGX ${due}
*Amount Paid:* UGX ${paid}
*Balance Remaining:* UGX ${bal}
*Status:* ${isCleared ? 'CLEARED ✓ (Paid in Full)' : 'OUTSTANDING BALANCE'}
*Payment Method:* ${targetReceiptInvoice.payment_method || 'Cash / Mobile Money'}
----------------------------------------
Thank you for entrusting us with your healthcare.
_Generated via KIEMED Hospital Management System_`

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMessage)}`
    window.open(waUrl, '_blank')
    toast('WhatsApp receipt window opened!', 'success')
    setWhatsappModalOpen(false)
  }

  // Print invoice receipt
  const handlePrintReceipt = (inv) => {
    const printWin = window.open('', '', 'width=650,height=750')
    const due = Number(inv.amount_due || 0).toLocaleString()
    const paid = Number(inv.amount_paid || 0).toLocaleString()
    const bal = Number(inv.balance || 0).toLocaleString()
    const isCleared = (Number(inv.balance) || 0) <= 0

    printWin.document.write(`
      <html>
        <head>
          <title>Receipt - ${inv.patient_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 1rem; margin-bottom: 1.5rem; }
            .hospital { font-size: 1.4rem; font-weight: 800; color: #0d9488; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; }
            .cleared { background: #dcfce7; color: #15803d; }
            .partial { background: #fef3c7; color: #b45309; }
            table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
            th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            .totals { margin-top: 1rem; text-align: right; }
            .footer { text-align: center; margin-top: 2rem; font-size: 0.8rem; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hospital">${currentClinic?.name || 'KIEMED HOSPITAL'}</div>
            <div>${currentClinic?.address || 'Uganda Clinical Facility'} &middot; Tel: ${currentClinic?.phone || 'N/A'}</div>
            <h3 style="margin-top: 0.5rem;">OFFICIAL PAYMENT RECEIPT</h3>
          </div>
          <p><strong>Receipt #:</strong> ${inv.id?.slice(0, 8).toUpperCase()}</p>
          <p><strong>Date:</strong> ${inv.created_at?.slice(0, 16).replace('T', ' ') || new Date().toLocaleString()}</p>
          <p><strong>Patient Name:</strong> ${inv.patient_name}</p>

          <table>
            <thead>
              <tr style="background: #f8fafc;">
                <th>Description</th>
                <th style="text-align: right;">Amount (UGX)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${inv.description}</td>
                <td style="text-align: right;">${due}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <p>Total Bill: <strong>UGX ${due}</strong></p>
            <p>Amount Paid: <strong style="color: #0d9488;">UGX ${paid}</strong></p>
            <p>Balance Due: <strong style="color: ${bal === '0' ? '#15803d' : '#e11d48'};">UGX ${bal}</strong></p>
            <p>Status: <span class="badge ${isCleared ? 'cleared' : 'partial'}">${isCleared ? 'CLEARED ✓' : 'PARTIAL / PENDING'}</span></p>
          </div>

          <div class="footer">
            <p>Thank you for choosing our medical services.</p>
            <p>Powered by KIEMED Hospital Management System</p>
          </div>
          <script>
            window.print();
          </script>
        </body>
      </html>
    `)
    printWin.document.close()
  }

  // Financial calculations
  const totalPaid = invoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)
  const totalBalance = invoices.reduce((sum, i) => sum + (Number(i.balance) || 0), 0)
  const totalBilled = invoices.reduce((sum, i) => sum + (Number(i.amount_due) || 0), 0)

  // Direct OTC / Pass-by Drug Sales
  const otcPaid = invoices
    .filter(i => i.is_direct_sale || i.category?.includes('OTC') || i.description?.includes('Direct Drug Sale') || i.description?.includes('OTC'))
    .reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)

  // MULTI-CLINIC REVENUE COMPUTATION
  const multiClinicTotalRevenue = allClinicsInvoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)

  const formatUGX = (val) => `UGX ${Number(val || 0).toLocaleString('en-US')}`

  const filteredInvoices = invoices.filter(i => {
    const matchesSearch = (i.patient_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (i.description || '').toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filterStatus === 'OTC Sales') {
      return i.is_direct_sale || i.category?.includes('OTC') || i.description?.includes('Direct Drug Sale') || i.description?.includes('OTC')
    }
    if (filterStatus === 'Cleared') {
      return (Number(i.balance) || 0) <= 0
    }
    if (filterStatus !== 'all' && i.status?.toLowerCase() !== filterStatus.toLowerCase()) return false
    return true
  })

  // IF PIN IS NOT UNLOCKED - SHOW SECURE ACCESS SHIELD
  if (!pinUnlocked) {
    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: '800px', margin: '3rem auto', textAlign: 'center' }}>
        <div style={{
          background: 'var(--card-bg, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--border, #334155)',
          padding: '3rem 2rem'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Lock size={32} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
            Finances & Billing Desk Protected
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto 1.75rem' }}>
            Hospital financial records, collections, and multi-clinic revenue totals are protected with a PIN to prevent unauthorized viewing.
          </p>

          <button
            onClick={() => setPinModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Shield size={18} />
            <span>{hasPIN ? 'Enter PIN to Access Finances' : 'Set PIN or Unlock Finances'}</span>
          </button>
        </div>

        <PinModal
          isOpen={pinModalOpen}
          onClose={() => setPinModalOpen(false)}
          onSuccess={() => setPinModalOpen(false)}
        />
      </div>
    )
  }

  // UNLOCKED STATE - FULL FINANCIAL DASHBOARD & MULTI-CLINIC REVENUE
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
            Billing, Patient Balances & Revenue
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Automated balance tracking, payments recording, WhatsApp receipts & multi-clinic oversight
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => lock()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)' }}
          >
            <Lock size={15} />
            <span>Lock Finances</span>
          </button>

          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Total Collections */}
        <div className="stat-card">
          <span className="stat-label">Total Collections ({currentClinic?.name})</span>
          <h2 className="stat-value" style={{ color: 'var(--brand)', margin: '0.5rem 0' }}>
            {formatUGX(totalPaid)}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From {invoices.length} invoices recorded</span>
        </div>

        {/* Direct Pass-by / OTC Pharmacy Sales */}
        <div className="stat-card" style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
          <span className="stat-label" style={{ color: '#38bdf8', fontWeight: 600 }}>Direct OTC / Pass-by Sales</span>
          <h2 className="stat-value" style={{ color: '#38bdf8', margin: '0.5rem 0' }}>
            {formatUGX(otcPaid)}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Walk-in customer drug sales</span>
        </div>

        {/* Outstanding Receivables */}
        <div className="stat-card">
          <span className="stat-label">Pending Patient Balances</span>
          <h2 className="stat-value" style={{ color: totalBalance > 0 ? 'var(--danger)' : '#10b981', margin: '0.5rem 0' }}>
            {formatUGX(totalBalance)}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {totalBalance > 0 ? 'Outstanding patient debt' : 'All accounts settled ✓'}
          </span>
        </div>

        {/* Multi-Clinic Aggregate Revenue */}
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.9))',
          border: '1px solid var(--brand)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={16} color="var(--brand)" />
            <span className="stat-label" style={{ color: 'var(--brand)', fontWeight: 600 }}>All-Clinics Consolidated Revenue</span>
          </div>
          <h2 className="stat-value" style={{ color: 'var(--brand)', margin: '0.5rem 0' }}>
            {formatUGX(multiClinicTotalRevenue)}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Aggregated across {clinics.length} branch{clinics.length > 1 ? 'es' : ''} under this account
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
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
            placeholder="Search invoice by patient or service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%', height: 38 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'Cleared', 'Partial', 'Unpaid', 'OTC Sales'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices & Patient Balances Table */}
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
              <th style={{ padding: '0.85rem 1rem' }}>Service Description</th>
              <th style={{ padding: '0.85rem 1rem' }}>Total Bill</th>
              <th style={{ padding: '0.85rem 1rem' }}>Paid to Date</th>
              <th style={{ padding: '0.85rem 1rem' }}>Balance Due</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Receipt size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 600 }}>No billing transactions found</div>
                  <p style={{ fontSize: '0.813rem', margin: '0.25rem 0 1rem' }}>
                    Click "Create Invoice" above or dispense medication to record patient charges.
                  </p>
                </td>
              </tr>
            ) : (
              filteredInvoices.map(inv => {
                const due = Number(inv.amount_due) || 0
                const paid = Number(inv.amount_paid) || 0
                const bal = Math.max(0, due - paid)
                const isCleared = bal <= 0 || inv.status === 'Cleared' || inv.status === 'Paid'

                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      <div>{inv.patient_name}</div>
                      {(inv.is_direct_sale || inv.category?.includes('OTC')) && (
                        <span className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '0.2rem', display: 'inline-block' }}>
                          OTC Direct Sale
                        </span>
                      )}
                      {inv.customer_phone && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inv.customer_phone}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{inv.description}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {formatUGX(due)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--brand)', fontWeight: 600 }}>
                      {formatUGX(paid)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: bal > 0 ? 'var(--danger)' : '#10b981' }}>
                      {formatUGX(bal)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {isCleared ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 20,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          <CheckCircle2 size={13} /> Cleared ✓
                        </span>
                      ) : paid > 0 ? (
                        <span className="badge badge-warning">
                          Partial (Bal: {formatUGX(bal)})
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        {/* Add Payment Button */}
                        {!isCleared && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv)
                              setPaymentAmount(bal.toString())
                              setPaymentModalOpen(true)
                            }}
                            className="btn btn-primary btn-sm"
                            title="Add Payment"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <DollarSign size={13} /> Pay
                          </button>
                        )}

                        {/* WhatsApp Receipt Button */}
                        <button
                          onClick={() => handleSendWhatsAppReceipt(inv)}
                          className="btn btn-secondary btn-sm"
                          title="Share Receipt on WhatsApp"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.75rem', color: '#22c55e' }}
                        >
                          <MessageSquare size={13} /> WhatsApp
                        </button>

                        {/* Print Receipt Button */}
                        <button
                          onClick={() => handlePrintReceipt(inv)}
                          className="btn btn-secondary btn-sm"
                          title="Print Receipt"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD PAYMENT MODAL */}
      {paymentModalOpen && selectedInvoice && (
        <Modal title="Record Patient Payment" onClose={() => setPaymentModalOpen(false)}>
          <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--surface-2)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '0.813rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Patient Account:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{selectedInvoice.patient_name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{selectedInvoice.description}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL DUE</div>
                  <div style={{ fontWeight: 700 }}>{formatUGX(selectedInvoice.amount_due)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ALREADY PAID</div>
                  <div style={{ fontWeight: 700, color: 'var(--brand)' }}>{formatUGX(selectedInvoice.amount_paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OUTSTANDING BAL</div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatUGX(selectedInvoice.balance)}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Amount Paid Now (UGX) *</label>
              <input
                type="number"
                min="100"
                className="input"
                required
                placeholder="e.g. 20000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                style={{ fontSize: '1.2rem', fontWeight: 700 }}
              />
            </div>

            <div>
              <label className="label">Payment Channel</label>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash">Cash (UGX)</option>
                <option value="MTN Mobile Money">MTN Mobile Money</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="Bank Card / POS">Bank Card / POS</option>
                <option value="Bank Transfer">Bank Transfer (Stanbic / Centenary / Equity)</option>
                <option value="Insurance Scheme">Insurance / Scheme</option>
              </select>
            </div>

            {/* Realtime balance preview */}
            {paymentAmount && (
              <div style={{
                background: (Number(selectedInvoice.balance) - Number(paymentAmount) <= 0) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${(Number(selectedInvoice.balance) - Number(paymentAmount) <= 0) ? '#10b981' : '#f59e0b'}`,
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Balance After Payment:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    {formatUGX(Math.max(0, Number(selectedInvoice.balance) - Number(paymentAmount)))}
                  </div>
                </div>
                {(Number(selectedInvoice.balance) - Number(paymentAmount) <= 0) ? (
                  <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                    <CheckCircle2 size={16} /> Will be Cleared ✓
                  </span>
                ) : (
                  <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
                    Remaining Partial
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save & Record Payment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* WHATSAPP RECEIPT MODAL */}
      {whatsappModalOpen && targetReceiptInvoice && (
        <Modal title="Send Payment Receipt on WhatsApp" onClose={() => setWhatsappModalOpen(false)}>
          <form onSubmit={confirmAndLaunchWhatsApp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
              color: '#22c55e'
            }}>
              Enter the patient or recipient's WhatsApp phone number to open a pre-filled official payment confirmation receipt.
            </div>

            <div>
              <label className="label">Patient's WhatsApp Phone Number *</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  className="input"
                  required
                  placeholder="e.g. 0772 123 456 or +256 700 000 000"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Ugandan numbers starting with 07... will automatically be prefixed with 256.
              </span>
            </div>

            {/* Receipt text preview */}
            <div style={{
              background: 'var(--surface-2)',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '180px',
              overflowY: 'auto'
            }}>
              {`🏥 ${currentClinic?.name || 'KIEMED HEALTH CENTER'}
Receipt #${(targetReceiptInvoice.id || '').slice(0, 8).toUpperCase()}
Patient: ${targetReceiptInvoice.patient_name}
Total Bill: UGX ${Number(targetReceiptInvoice.amount_due || 0).toLocaleString()}
Amount Paid: UGX ${Number(targetReceiptInvoice.amount_paid || 0).toLocaleString()}
Remaining Balance: UGX ${Number(targetReceiptInvoice.balance || 0).toLocaleString()}
Status: ${(Number(targetReceiptInvoice.balance) || 0) <= 0 ? 'CLEARED ✓' : 'PARTIAL'}`}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setWhatsappModalOpen(false)}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#22c55e', borderColor: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={15} /> Open WhatsApp Receipt
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Invoice Modal */}
      {invoiceModalOpen && (
        <Modal title="Create New Medical Invoice & Bill" onClose={() => setInvoiceModalOpen(false)}>
          <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Select Patient *</label>
              <select
                className="input"
                required
                value={invoiceForm.patient_id}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, patient_id: e.target.value })}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} &middot; ({p.gender}, {p.age_years || 'N/A'} yrs)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Service / Charge Description *</label>
              <input
                type="text"
                className="input"
                required
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Total Amount Due (UGX) *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  placeholder="e.g. 50000"
                  value={invoiceForm.amount_due}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount_due: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Amount Paid Now (UGX) *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  placeholder="e.g. 50000"
                  value={invoiceForm.amount_paid}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount_paid: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Payment Mode</label>
              <select
                className="input"
                value={invoiceForm.payment_method}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_method: e.target.value })}
              >
                <option value="Cash">Cash (UGX)</option>
                <option value="MTN Mobile Money">MTN Mobile Money (MoMoPay / Prompt)</option>
                <option value="Airtel Money">Airtel Money (Uganda)</option>
                <option value="Insurance - Jubilee/UAP/AAR">Insurance / Corporate Scheme</option>
                <option value="Bank Card / Transfer">Bank Card / Transfer (Stanbic/Centenary/Equity)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setInvoiceModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Process & Record Invoice</button>
            </div>
          </form>
        </Modal>
      )}

      {/* PIN Security Modal */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => setPinModalOpen(false)}
      />
    </div>
  )
}
