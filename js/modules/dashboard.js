// ─── Dashboard Module ───
const DashboardModule = {

  async render() {
    const [patients, admissions, inventory, invoices, appointments] = await Promise.all([
      DB.getAll('patients'),
      DB.getAll('admissions'),
      DB.getAll('inventory'),
      DB.getAll('invoices'),
      DB.getAll('appointments'),
    ]);

    const today = new Date().toDateString();
    const patientsToday = patients.filter(p => p.createdAt && new Date(p.createdAt).toDateString() === today).length;
    const activeAdmissions = admissions.filter(a => a.status === 'active').length;
    const discharges = admissions.filter(a => a.status === 'discharged' && a.dischargedAt && new Date(a.dischargedAt).toDateString() === today).length;
    const lowStock = inventory.filter(i => i.currentStock <= (i.reorderLevel || 10)).length;
    
    // Revenue Segmentation calculations
    let todayPharmacyRevenue = 0;
    let todayClinicRevenue = 0;
    let totalPharmacyRevenue = 0;
    let totalClinicRevenue = 0;

    invoices.forEach(inv => {
      const items = inv.items || {};
      const pharmacyCost = Number(items.pharmacy) || 0;
      const consultationCost = Number(items.consultation) || 0;
      const admissionCost = Number(items.admission) || 0;
      const otherCost = (Number(items.lab) || 0) + (Number(items.procedure) || 0);
      const clinicalCost = consultationCost + admissionCost + otherCost;
      const totalCost = pharmacyCost + clinicalCost;

      const paid = Number(inv.amountPaid) || 0;
      let pharmacyPaid = 0;
      let clinicPaid = 0;

      if (totalCost > 0) {
        const pharmacyRatio = pharmacyCost / totalCost;
        pharmacyPaid = paid * pharmacyRatio;
        clinicPaid = paid * (1 - pharmacyRatio);
      } else {
        // Fallback if no specific item charges
        clinicPaid = paid;
      }

      totalPharmacyRevenue += pharmacyPaid;
      totalClinicRevenue += clinicPaid;

      if (inv.paymentDate && new Date(inv.paymentDate).toDateString() === today) {
        todayPharmacyRevenue += pharmacyPaid;
        todayClinicRevenue += clinicPaid;
      }
    });

    const outstandingTotal = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (Number(i.balance) || 0), 0);
    const apptToday = appointments.filter(a => a.date && new Date(a.date).toDateString() === today).length;

    const stats = [
      { label: 'Patients Today',      value: patientsToday,              icon: 'person_add',   color: 'teal',   trend: '+3 this week',  up: true },
      { label: 'Active Admissions',   value: activeAdmissions,           icon: 'bed',          color: 'blue',   trend: null },
      { label: 'Discharges Today',    value: discharges,                 icon: 'logout',       color: 'green',  trend: null },
      { label: "Pharmacy Rev (Today)", value: UI.formatCurrency(todayPharmacyRevenue), icon: 'local_pharmacy', color: 'purple', trend: null },
      { label: "Clinic Rev (Today)",   value: UI.formatCurrency(todayClinicRevenue), icon: 'medical_services', color: 'blue', trend: null },
      { label: 'Outstanding Balance', value: UI.formatCurrency(outstandingTotal), icon: 'account_balance', color: 'amber', trend: null },
      { label: 'Low Stock Alerts',    value: lowStock,                   icon: 'warning',      color: 'red',    trend: null },
      { label: 'Total Patients',      value: patients.length,            icon: 'group',        color: 'teal',   trend: null },
    ];

    const colorMap = {
      teal:   { icon: 'stat-icon', bg: 'var(--primary-light)',    fg: 'var(--primary)' },
      blue:   { icon: 'stat-icon', bg: '#dbeafe',                 fg: '#1d4ed8' },
      green:  { icon: 'stat-icon', bg: 'var(--success-light)',    fg: '#065f46' },
      purple: { icon: 'stat-icon', bg: 'var(--info-light)',       fg: 'var(--info)' },
      amber:  { icon: 'stat-icon', bg: 'var(--warning-light)',    fg: '#92400e' },
      red:    { icon: 'stat-icon', bg: 'var(--danger-light)',     fg: 'var(--danger)' },
    };

    const statCards = stats.map(s => {
      const c = colorMap[s.color] || colorMap.teal;
      return `
        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-icon" style="background:${c.bg};color:${c.fg}">
              <span class="material-icons-round">${s.icon}</span>
            </div>
            ${s.trend ? `<div class="stat-trend ${s.up ? 'up' : 'down'}">
              <span class="material-icons-round" style="font-size:0.875rem">${s.up ? 'trending_up' : 'trending_down'}</span>
              ${s.trend}
            </div>` : ''}
          </div>
          <div class="stat-value" style="font-size:1.4rem;">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>`;
    }).join('');

    // Recent patients
    const recentPatients = [...patients].reverse().slice(0, 6);
    const recentRows = recentPatients.length
      ? recentPatients.map(p => `
        <tr style="cursor:pointer" onclick="PatientModule.viewDetails(${p.id})">
          <td><strong>#${p.id}</strong></td>
          <td>${p.firstName} ${p.lastName}</td>
          <td>${p.gender || '—'}</td>
          <td>${UI.formatDate(p.createdAt)}</td>
          <td>${p.outstandingBalance > 0 ? `<span style="color:var(--danger);font-weight:600">${UI.formatCurrency(p.outstandingBalance)}</span>` : '<span style="color:var(--success)">Clear</span>'}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="table-empty"><span class="material-icons-round">people</span>No patients yet</td></tr>`;

    // Recent appointments
    const recentAppts = [...appointments].reverse().slice(0, 4);
    const apptRows = recentAppts.length
      ? recentAppts.map(a => `
        <tr>
          <td>${a.patientName || '—'}</td>
          <td>${a.doctor || '—'}</td>
          <td>${UI.formatDateTime(a.date)}</td>
          <td>${UI.pillStatus(a.status || 'pending')}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="table-empty"><span class="material-icons-round">event</span>No appointments</td></tr>`;

    return `
      <div class="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p>${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="PatientModule.showAddModal()">
            <span class="material-icons-round">person_add</span> New Patient
          </button>
        </div>
      </div>

      <div class="stats-grid">${statCards}</div>

      <div class="two-col">
        <div class="table-wrap">
          <div class="table-toolbar">
            <span class="table-title">Recent Patients</span>
            <a href="#/patients" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Gender</th><th>Registered</th><th>Balance</th></tr></thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>

        <div class="table-wrap">
          <div class="table-toolbar">
            <span class="table-title">Today's Appointments</span>
            <a href="#/appointments" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <table>
            <thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>${apptRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }
};

window.DashboardModule = DashboardModule;
