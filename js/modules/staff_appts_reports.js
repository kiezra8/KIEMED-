// ─── Staff Module ───
const StaffModule = {
  async render() {
    const staff = await DB.getAll('staff');
    const rows = staff.length
      ? [...staff].reverse().map(s => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div class="user-avatar" style="width:36px;height:36px;font-size:0.875rem">
                  ${(s.firstName[0] || '') + (s.lastName[0] || '')}
                </div>
                <div>
                  <div style="font-weight:600">${s.firstName} ${s.lastName}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${s.email || ''}</div>
                </div>
              </div>
            </td>
            <td>${s.role || '—'}</td>
            <td>${s.department || '—'}</td>
            <td>${s.phone || '—'}</td>
            <td>${UI.formatDate(s.hireDate)}</td>
            <td>${UI.pillStatus(s.status || 'active')}</td>
            <td>
              <button class="btn btn-sm btn-ghost" onclick="StaffModule.delete(${s.id})">
                <span class="material-icons-round" style="color:var(--danger)">delete</span>
              </button>
            </td>
          </tr>`)
        .join('')
      : `<tr><td colspan="7" class="table-empty">
          <span class="material-icons-round">badge</span>No staff profiles yet
         </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Staff Management</h1><p>${staff.length} staff member(s)</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="StaffModule.showAddModal()">
            <span class="material-icons-round">person_add</span> Add Staff
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">All Staff</span></div>
        <table>
          <thead><tr>
            <th>Name</th><th>Role</th><th>Department</th>
            <th>Phone</th><th>Hire Date</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  showAddModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Add Staff Member</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); StaffModule.save()">
              <div class="form-grid">
                <div class="form-group"><label class="form-label">First Name <span class="required">*</span></label>
                  <input id="st-fname" class="form-control" required></div>
                <div class="form-group"><label class="form-label">Last Name <span class="required">*</span></label>
                  <input id="st-lname" class="form-control" required></div>
                <div class="form-group">
                  <label class="form-label">Role</label>
                  <select id="st-role" class="form-control">
                    <option>Doctor</option>
                    <option>Nurse</option>
                    <option>Pharmacist</option>
                    <option>Lab Technician</option>
                    <option>Receptionist</option>
                    <option>Accountant</option>
                    <option>Admin</option>
                    <option>Other</option>
                  </select>
                  <div id="st-role-other-container"></div>
                </div>
                <div class="form-group"><label class="form-label">Department</label>
                  <input id="st-dept" class="form-control" placeholder="General Medicine, ICU…"></div>
                <div class="form-group"><label class="form-label">Phone</label>
                  <input id="st-phone" class="form-control"></div>
                <div class="form-group"><label class="form-label">Email</label>
                  <input id="st-email" type="email" class="form-control"></div>
                <div class="form-group"><label class="form-label">Hire Date</label>
                  <input id="st-hire" type="date" class="form-control"></div>
                <div class="form-group"><label class="form-label">Specialization</label>
                  <input id="st-spec" class="form-control"></div>
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);

    UI.setupOtherSelect('st-role', 'st-role-other-container', 'st-role-custom', 'Enter Custom Role...');
  },

  async save() {
    const roleSelect = document.getElementById('st-role').value;
    const role = roleSelect === 'Other' ? document.getElementById('st-role-custom').value : roleSelect;

    try {
      await DB.add('staff', {
        firstName:      document.getElementById('st-fname').value,
        lastName:       document.getElementById('st-lname').value,
        role,
        department:     document.getElementById('st-dept').value,
        phone:          document.getElementById('st-phone').value,
        email:          document.getElementById('st-email').value,
        hireDate:       document.getElementById('st-hire').value,
        specialization: document.getElementById('st-spec').value,
        status:         'active',
      });
      UI.closeModal();
      UI.showToast('Staff member added', 'success');
      App.navigate('/staff');
    } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
  },

  async delete(id) {
    if (!UI.confirm('Remove this staff member?')) return;
    await DB.delete('staff', id);
    UI.showToast('Staff member removed', 'warning');
    App.navigate('/staff');
  },
};

// ─── Appointments Module ───
const AppointmentModule = {
  async render() {
    const [appointments, patients, staff] = await Promise.all([
      DB.getAll('appointments'),
      DB.getAll('patients'),
      DB.getAll('staff'),
    ]);
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));
    window._apptPatOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');
    window._apptDocOptions = staff.filter(s => s.role === 'Doctor')
      .map(s => `<option>Dr. ${s.firstName} ${s.lastName}</option>`).join('');

    const today = new Date().toDateString();
    const todayAppts = appointments.filter(a => a.date && new Date(a.date).toDateString() === today);

    const rows = appointments.length
      ? [...appointments].sort((a, b) => new Date(a.date) - new Date(b.date)).map(a => {
          const p = patMap[a.patientId];
          const isPast = a.date && new Date(a.date) < new Date();
          return `
            <tr>
              <td>${UI.formatDateTime(a.date)}</td>
              <td><strong>${p ? p.firstName + ' ' + p.lastName : a.patientName || '—'}</strong></td>
              <td>${a.doctor || '—'}</td>
              <td>${a.reason || '—'}</td>
              <td>${UI.pillStatus(a.status || 'pending')}</td>
              <td>
                ${!isPast ? `
                  <button class="btn btn-sm btn-success" onclick="AppointmentModule.markDone(${a.id})">
                    <span class="material-icons-round">check</span>
                  </button>` : ''}
                <button class="btn btn-sm btn-ghost" onclick="AppointmentModule.delete(${a.id})">
                  <span class="material-icons-round" style="color:var(--danger)">delete</span>
                </button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6" class="table-empty">
          <span class="material-icons-round">event</span>No appointments scheduled
         </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Appointments</h1><p>${todayAppts.length} appointment(s) today</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="AppointmentModule.showAddModal()">
            <span class="material-icons-round">add</span> Book Appointment
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">All Appointments</span></div>
        <table>
          <thead><tr>
            <th>Date & Time</th><th>Patient</th><th>Doctor</th>
            <th>Reason</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  showAddModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Book Appointment</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); AppointmentModule.save()">
              <div class="form-group"><label class="form-label">Patient <span class="required">*</span></label>
                <select id="apt-patient" class="form-control" required>
                  <option value="">Select patient…</option>${window._apptPatOptions || ''}
                </select></div>
              <div class="form-group">
                <label class="form-label">Doctor</label>
                <select id="apt-doctor" class="form-control">
                  <option value="">Select doctor…</option>
                  ${window._apptDocOptions || ''}
                  <option>Other</option>
                </select>
                <div id="appt-doc-other-container"></div>
              </div>
              <div class="form-group"><label class="form-label">Date & Time <span class="required">*</span></label>
                <input id="apt-date" type="datetime-local" class="form-control" required></div>
              <div class="form-group"><label class="form-label">Reason</label>
                <input id="apt-reason" class="form-control" placeholder="Follow-up, consultation…"></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">event_available</span> Book
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);

    UI.setupOtherSelect('apt-doctor', 'appt-doc-other-container', 'apt-doctor-custom', 'Enter Custom Doctor Name...');
  },

  async save() {
    const docSelect = document.getElementById('apt-doctor').value;
    const doctor = docSelect === 'Other' ? document.getElementById('apt-doctor-custom').value : docSelect;

    const patId = Number(document.getElementById('apt-patient').value);
    const patients = await DB.getAll('patients');
    const p = patients.find(pt => pt.id === patId);
    try {
      await DB.add('appointments', {
        patientId:   patId,
        patientName: p ? `${p.firstName} ${p.lastName}` : '',
        doctor,
        date:        document.getElementById('apt-date').value,
        reason:      document.getElementById('apt-reason').value,
        status:      'pending',
      });
      UI.closeModal();
      UI.showToast('Appointment booked', 'success');
      App.navigate('/appointments');
    } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
  },

  async markDone(id) {
    const a = await DB.get('appointments', id);
    if (a) await DB.put('appointments', { ...a, status: 'active' });
    UI.showToast('Appointment marked as complete', 'success');
    App.navigate('/appointments');
  },

  async delete(id) {
    if (!UI.confirm('Cancel this appointment?')) return;
    await DB.delete('appointments', id);
    UI.showToast('Appointment cancelled', 'warning');
    App.navigate('/appointments');
  },
};

// ─── Reports Module ───
const ReportsModule = {
  async render() {
    const [patients, invoices, inventory, admissions, consultations, vitals, labs] = await Promise.all([
      DB.getAll('patients'),
      DB.getAll('invoices'),
      DB.getAll('inventory'),
      DB.getAll('admissions'),
      DB.getAll('consultations'),
      DB.getAll('vitals'),
      DB.getAll('lab_requests')
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
    const totalBilled  = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const collectionRate = totalBilled > 0 ? ((totalRevenue / totalBilled) * 100).toFixed(1) : 0;
    const lowStock = inventory.filter(i => Number(i.currentStock) <= Number(i.reorderLevel || 10));

    // Revenue Segmentation
    let totalPharmacyRev = 0;
    let totalClinicRev = 0;

    invoices.forEach(inv => {
      const items = inv.items || {};
      const pharmacyCost = Number(items.pharmacy) || 0;
      const consultationCost = Number(items.consultation) || 0;
      const admissionCost = Number(items.admission) || 0;
      const otherCost = (Number(items.lab) || 0) + (Number(items.procedure) || 0);
      const clinicalCost = consultationCost + admissionCost + otherCost;
      const totalCost = pharmacyCost + clinicalCost;

      const paid = Number(inv.amountPaid) || 0;

      if (totalCost > 0) {
        const pharmacyRatio = pharmacyCost / totalCost;
        totalPharmacyRev += paid * pharmacyRatio;
        totalClinicRev += paid * (1 - pharmacyRatio);
      } else {
        totalClinicRev += paid;
      }
    });

    const exportPatients = () => {
      const csv = ['ID,First Name,Last Name,Gender,DOB,Phone,Insurance,Balance',
        ...patients.map(p => `${p.id},${p.firstName},${p.lastName},${p.gender || ''},${p.dateOfBirth || ''},${p.phone || ''},${p.insuranceProvider || ''},${p.outstandingBalance || 0}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cliniflow_patients_${Date.now()}.csv`;
      a.click();
      UI.showToast('Patient data exported as CSV', 'success');
    };
    window._exportPatients = exportPatients;

    const exportInvoices = () => {
      const csv = ['Invoice #,Patient ID,Total,Paid,Balance,Status,Date',
        ...invoices.map(i => `${i.invoiceNumber},${i.patientId},${i.totalAmount},${i.amountPaid},${i.balance},${i.status},${i.createdAt || ''}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cliniflow_invoices_${Date.now()}.csv`;
      a.click();
      UI.showToast('Invoice data exported as CSV', 'success');
    };
    window._exportInvoices = exportInvoices;

    return `
      <div class="page-header">
        <div><h1>Reports & Analytics</h1><p>Comprehensive overview of clinical and financial metrics</p></div>
      </div>

      <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
            <span class="material-icons-round">group</span></div></div>
          <div class="stat-value">${patients.length}</div>
          <div class="stat-label">Total Patients</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--success-light);color:#065f46">
            <span class="material-icons-round">local_pharmacy</span></div></div>
          <div class="stat-value" style="font-size:1.3rem;">${UI.formatCurrency(totalPharmacyRev)}</div>
          <div class="stat-label">Pharmacy Revenue (UgShs)</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:#dbeafe;color:#1d4ed8">
            <span class="material-icons-round">medical_services</span></div></div>
          <div class="stat-value" style="font-size:1.3rem;">${UI.formatCurrency(totalClinicRev)}</div>
          <div class="stat-label">Clinic Rev (Consults & Adm)</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--warning-light);color:#92400e">
            <span class="material-icons-round">payments</span></div></div>
          <div class="stat-value" style="font-size:1.3rem;">${UI.formatCurrency(totalRevenue)}</div>
          <div class="stat-label">Total Cash Collected</div>
        </div>
      </div>

      <div class="two-col">
        <!-- Clinic Operations Summary Report Card -->
        <div class="card">
          <div class="card-header"><span class="card-title">Clinical Operations Report</span></div>
          <table style="width: 100%; font-size: 0.9rem;">
            <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Total Consultations Recorded</td><td><strong>${consultations.length}</strong></td></tr>
            <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Total Patient Admissions</td><td><strong>${admissions.length}</strong></td></tr>
            <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Vitals Check-ins Recorded</td><td><strong>${vitals.length}</strong></td></tr>
            <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Lab Tests Completed</td><td><strong>${labs.length}</strong></td></tr>
            <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Active Hospital Admitted Patients</td><td><strong>${admissions.filter(a => a.status === 'active').length}</strong></td></tr>
          </table>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Inventory & Stock Alerts</span></div>
          ${lowStock.length > 0
            ? lowStock.map(i => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--border)">
                  <div>
                    <div style="font-weight:600">${i.itemName}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Reorder Level: ${i.reorderLevel}</div>
                  </div>
                  <span class="pill pill-red">${i.currentStock} remaining</span>
                </div>`).join('')
            : `<p style="color:var(--text-muted)">All items are adequately stocked ✓</p>`}
        </div>
      </div>

      <div class="card" style="margin-top:1.5rem">
        <div class="card-header"><span class="card-title">Actionable Reports</span></div>
        <div style="display:grid;grid-template-columns: 1fr 1fr; gap:1.5rem">
          <div>
            <p style="color:var(--text-muted); margin-bottom: 0.75rem;">Download complete datasets in CSV format for local analysis and audit reviews.</p>
            <div style="display:flex; gap:0.75rem">
              <button class="btn btn-secondary" onclick="window._exportPatients()">
                <span class="material-icons-round">download</span> Export Patients (CSV)
              </button>
              <button class="btn btn-secondary" onclick="window._exportInvoices()">
                <span class="material-icons-round">download</span> Export Invoices (CSV)
              </button>
            </div>
          </div>
          <div style="text-align: right">
            <button class="btn btn-primary" onclick="window.print()">
              <span class="material-icons-round">print</span> Print Full Clinic Summary Report
            </button>
          </div>
        </div>
      </div>`;
  },
};

// ─── Settings Module ───
const SettingsModule = {
  render() {
    const theme = localStorage.getItem('cf_theme') || 'light';
    return `
      <div class="page-header">
        <div><h1>Settings</h1><p>Facility configuration and preferences</p></div>
      </div>
      <div class="two-col">
        <div class="card">
          <div class="card-title" style="margin-bottom:1rem">Facility Profile</div>
          <div class="form-group"><label class="form-label">Facility Name</label>
            <input class="form-control" value="CliniFlow General Hospital" id="fac-name"></div>
          <div class="form-group"><label class="form-label">Address</label>
            <input class="form-control" value="123 Health Avenue" id="fac-addr"></div>
          <div class="form-group"><label class="form-label">Phone</label>
            <input class="form-control" value="+256 (0) 700-000000" id="fac-phone"></div>
          <div class="form-group"><label class="form-label">Email</label>
            <input class="form-control" value="admin@cliniflow.health" id="fac-email"></div>
          <div class="form-group"><label class="form-label">Currency</label>
            <select class="form-control" id="fac-currency">
              <option>UgShs (Ugandan Shilling)</option>
              <option>USD ($)</option>
            </select></div>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="UI.showToast('Settings saved','success')">
            <span class="material-icons-round">save</span> Save Settings
          </button>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:1rem">Appearance</div>
          <div class="form-group">
            <label class="form-label">Theme</label>
            <select class="form-control" id="theme-select" onchange="UI._toggleTheme()">
              <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark"  ${theme === 'dark'  ? 'selected' : ''}>Dark</option>
            </select>
          </div>
          <div class="card-title" style="margin:1.5rem 0 1rem">Danger Zone</div>
          <button class="btn btn-danger" onclick="SettingsModule.clearData()">
            <span class="material-icons-round">delete_forever</span> Clear All Local Data
          </button>
        </div>
      </div>`;
  },

  async clearData() {
    if (!UI.confirm('This will delete ALL local data permanently. Are you sure?')) return;
    const stores = ['patients','consultations','vitals','admissions','inventory','dispensing','lab_requests','invoices','staff','appointments','audit_logs','beds'];
    for (const s of stores) {
      const all = await DB.getAll(s);
      for (const r of all) await DB.delete(s, r.id);
    }
    UI.showToast('All local data cleared', 'warning');
    App.navigate('/dashboard');
  },
};

window.StaffModule       = StaffModule;
window.AppointmentModule = AppointmentModule;
window.ReportsModule     = ReportsModule;
window.SettingsModule    = SettingsModule;
