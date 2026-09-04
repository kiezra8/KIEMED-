import { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, Users, Activity, Lock, Unlock,
  Shield, Building2, Download, RefreshCw, HeartPulse, Baby
} from 'lucide-react'
import { useClinicStore, usePinStore, useToastStore } from '../store'
import { localGetAll } from '../lib/db'
import PinModal from '../components/ui/PinModal'

export default function Reports() {
  const { currentClinic, clinics } = useClinicStore()
  const { pinUnlocked, hasPIN, lock } = usePinStore()
  const { add: toast } = useToastStore()

  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [data, setData] = useState({
    patients: [],
    consultations: [],
    vitals: [],
    admissions: [],
    invoices: [],
    allClinicsInvoices: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReports()
  }, [currentClinic?.id])

  const loadReports = async () => {
    if (!currentClinic?.id) return
    setLoading(true)
    try {
      const [pts, cns, vts, adms, invs, allInvs] = await Promise.all([
        localGetAll('patients', currentClinic.id),
        localGetAll('consultations', currentClinic.id),
        localGetAll('vitals', currentClinic.id),
        localGetAll('admissions', currentClinic.id),
        localGetAll('invoices', currentClinic.id),
        localGetAll('invoices'),
      ])

      setData({
        patients: pts || [],
        consultations: cns || [],
        vitals: vts || [],
        admissions: adms || [],
        invoices: invs || [],
        allClinicsInvoices: allInvs || [],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Clinical Disease Breakdown
  const diagnosisCounts = {}
  data.consultations.forEach(c => {
    const diag = c.diagnosis || 'Unspecified'
    diagnosisCounts[diag] = (diagnosisCounts[diag] || 0) + 1
  })
  const topDiagnoses = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // Pediatric & Maternity Stats
  const imnciAssessments = data.vitals.filter(v => v.imnci_classifications?.length > 0)
  const apgarAssessments = data.vitals.filter(v => v.apgar_total !== undefined)
  const depressedNewborns = apgarAssessments.filter(v => v.apgar_total <= 6)

  // Financial Stats
  const branchRevenue = data.invoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)
  const multiClinicTotalRevenue = data.allClinicsInvoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)

  // Revenue by branch breakdown
  const branchBreakdown = {}
  clinics.forEach(c => { branchBreakdown[c.id] = { name: c.name, revenue: 0, count: 0 } })
  data.allClinicsInvoices.forEach(inv => {
    const cid = inv.clinic_id
    if (branchBreakdown[cid]) {
      branchBreakdown[cid].revenue += (Number(inv.amount_paid) || 0)
      branchBreakdown[cid].count += 1
    }
  })

  const formatUGX = (val) => `UGX ${Number(val || 0).toLocaleString('en-US')}`

  const exportReport = () => {
    const reportSummary = {
      clinic: currentClinic?.name,
      date: new Date().toISOString(),
      totalPatients: data.patients.length,
      totalConsultations: data.consultations.length,
      topDiagnoses,
      imnciCases: imnciAssessments.length,
      apgarAssessments: apgarAssessments.length,
      ...(pinUnlocked ? {
        branchRevenue,
        multiClinicTotalRevenue,
        branchBreakdown: Object.values(branchBreakdown)
      } : { finances: 'LOCKED_BY_PIN' })
    }

    const blob = new Blob([JSON.stringify(reportSummary, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KIEMED_Report_${currentClinic?.name}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast('Report exported successfully', 'success')
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            Health Management & Multi-Clinic Analytics
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Uganda MoH HMIS 105 Morbidity indicators, IMNCI/APGAR quality audits & multi-clinic financials
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={exportReport}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={15} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Clinical Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        <div className="stat-card">
          <span className="stat-label">Total Outpatients (OPD)</span>
          <h2 className="stat-value">{data.consultations.length}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--brand)' }}>Completed consultations</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Under-5 IMNCI Audits</span>
          <h2 className="stat-value">{imnciAssessments.length}</h2>
          <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Children evaluated</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Maternity APGAR Scores</span>
          <h2 className="stat-value">{apgarAssessments.length}</h2>
          <span style={{ fontSize: '0.8rem', color: '#ec4899' }}>
            {depressedNewborns.length} required resuscitation support
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Ward Admissions</span>
          <h2 className="stat-value">{data.admissions.length}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inpatient admissions</span>
        </div>
      </div>

      {/* Top Clinical Morbidities (Uganda MoH HMIS) */}
      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        padding: '1.5rem',
        marginBottom: '1.75rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HeartPulse size={18} color="var(--brand)" />
          Top Diagnosed Conditions (HMIS 105 Morbidity Spectrum)
        </h3>

        {topDiagnoses.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
            No consultation diagnoses recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {topDiagnoses.map(([disease, count]) => {
              const pct = Math.round((count / data.consultations.length) * 100) || 0
              return (
                <div key={disease}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600 }}>{disease}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} cases ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)', borderRadius: '4px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PIN PROTECTED MULTI-CLINIC FINANCIAL ANALYTICS */}
      <div style={{
        background: 'var(--card-bg, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border, #334155)',
        padding: '1.5rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: pinUnlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: pinUnlocked ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {pinUnlocked ? <Unlock size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Multi-Clinic Financial Performance
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {pinUnlocked
                  ? 'PIN verified. Consolidated collections across all clinic locations.'
                  : 'Financial analytics are protected by PIN.'}
              </p>
            </div>
          </div>

          <div>
            {pinUnlocked ? (
              <button onClick={() => lock()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={14} />
                <span>Lock Analytics</span>
              </button>
            ) : (
              <button onClick={() => setPinModalOpen(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Shield size={14} />
                <span>Authenticate PIN</span>
              </button>
            )}
          </div>
        </div>

        {pinUnlocked ? (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ padding: '1rem', background: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Branch Collections</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--brand)', marginTop: '0.3rem' }}>
                  {formatUGX(branchRevenue)}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid var(--brand)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--brand)', fontWeight: 600 }}>All-Clinics Consolidated Revenue</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand)', marginTop: '0.3rem' }}>
                  {formatUGX(multiClinicTotalRevenue)}
                </div>
              </div>
            </div>

            {/* Branch by Branch Breakdown Table */}
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Branch Revenue Distribution</h4>
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Clinic Branch</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Transactions</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Collections</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Share of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(branchBreakdown).map(([id, b]) => {
                    const share = multiClinicTotalRevenue > 0
                      ? Math.round((b.revenue / multiClinicTotalRevenue) * 100)
                      : 0
                    return (
                      <tr key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{b.count} invoices</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--brand)' }}>
                          {formatUGX(b.revenue)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{share}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            <Lock size={32} style={{ marginBottom: '0.5rem' }} />
            <div>Financial reports are protected by PIN. Click "Authenticate PIN" above to view multi-clinic revenue.</div>
          </div>
        )}
      </div>

      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => setPinModalOpen(false)}
      />
    </div>
  )
}
