// ─── Patient Module ───
const PatientModule = {

  async render() {
    const patients = await DB.getAll('patients');
    const rows = patients.length
      ? [...patients].reverse().map(p => `
        <tr style="cursor:pointer" onclick="PatientModule.viewDetails(${p.id})">
          <td><strong>#${p.id}</strong></td>
          <td>
            <div style="font-weight:600">${p.firstName} ${p.lastName}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${p.phone || ''}</div>
          </td>
          <td>${p.gender || '—'}</td>
          <td>${UI.formatDate(p.dateOfBirth)}</td>
          <td>${p.insuranceProvider || '—'}</td>
          <td>${p.outstandingBalance > 0
            ? `<strong style="color:var(--danger)">${UI.formatCurrency(p.outstandingBalance)}</strong>`
            : `<span style="color:var(--success)">Clear</span>`}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); PatientModule.viewDetails(${p.id})">
              <span class="material-icons-round">folder_open</span> View Profile
            </button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); PatientModule.delete(${p.id})">
              <span class="material-icons-round" style="color:var(--danger)">delete</span>
            </button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="7" class="table-empty">
          <span class="material-icons-round">people</span>
          No patients registered yet. Click "New Patient" to add the first one.
        </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Patient Directory</h1><p>${patients.length} patient(s) on record</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="PatientModule.showAddModal()">
            <span class="material-icons-round">person_add</span> New Patient
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">All Patients (Click row for full profile)</span>
          <div class="table-filters">
            <input class="form-control" style="width:200px" type="text" placeholder="Search…" oninput="PatientModule.filterTable(this.value)">
          </div>
        </div>
        <table id="patient-table">
          <thead>
            <tr>
              <th>ID</th><th>Name / Contact</th><th>Gender</th>
              <th>Date of Birth</th><th>Insurance</th><th>Balance</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  filterTable(q) {
    const rows = document.querySelectorAll('#patient-table tbody tr');
    rows.forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  showAddModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Register New Patient</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); PatientModule.save()">
              <div class="section-divider">Demographics</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">First Name <span class="required">*</span></label>
                  <input id="p-fname" class="form-control" required></div>
                <div class="form-group"><label class="form-label">Last Name <span class="required">*</span></label>
                  <input id="p-lname" class="form-control" required></div>
                <div class="form-group"><label class="form-label">Date of Birth</label>
                  <input id="p-dob" type="date" class="form-control"></div>
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select id="p-gender" class="form-control">
                    <option value="">Select…</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                  <div id="gender-other-container"></div>
                </div>
              </div>

              <div class="section-divider">Contact</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Phone</label>
                  <input id="p-phone" type="tel" class="form-control"></div>
                <div class="form-group"><label class="form-label">Email</label>
                  <input id="p-email" type="email" class="form-control"></div>
                <div class="form-group col-span-2"><label class="form-label">Address</label>
                  <input id="p-addr" class="form-control"></div>
              </div>

              <div class="section-divider">Next of Kin</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Name</label>
                  <input id="p-kin-name" class="form-control"></div>
                <div class="form-group">
                  <label class="form-label">Relationship</label>
                  <select id="p-kin-rel" class="form-control">
                    <option value="">Select…</option>
                    <option>Spouse</option>
                    <option>Parent</option>
                    <option>Sibling</option>
                    <option>Child</option>
                    <option>Other</option>
                  </select>
                  <div id="kin-other-container"></div>
                </div>
                <div class="form-group"><label class="form-label">Phone</label>
                  <input id="p-kin-phone" class="form-control"></div>
              </div>

              <div class="section-divider">Insurance</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Provider</label>
                  <select id="p-ins-prov" class="form-control">
                    <option value="">Select…</option>
                    <option>UAP</option>
                    <option>Jubilee</option>
                    <option>Prudential</option>
                    <option>Sanlam</option>
                    <option>Other</option>
                  </select>
                  <div id="ins-other-container"></div>
                </div>
                <div class="form-group"><label class="form-label">Policy Number</label>
                  <input id="p-ins-pol" class="form-control"></div>
              </div>

              <div class="section-divider">Medical Details</div>
              <div class="form-group"><label class="form-label">Known Allergies</label>
                <textarea id="p-allergies" class="form-control" placeholder="e.g. Penicillin, Sulfa drugs..."></textarea></div>
              <div class="form-group"><label class="form-label">Medical History</label>
                <textarea id="p-history" class="form-control" placeholder="e.g. Hypertension, Asthma..."></textarea></div>

              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);

    // Setup Custom Dynamic Other Inputs
    UI.setupOtherSelect('p-gender', 'gender-other-container', 'p-gender-custom', 'Enter Custom Gender...');
    UI.setupOtherSelect('p-kin-rel', 'kin-other-container', 'p-kin-rel-custom', 'Enter Custom Relationship...');
    UI.setupOtherSelect('p-ins-prov', 'ins-other-container', 'p-ins-prov-custom', 'Enter Custom Insurance...');
  },

  async save() {
    const genderSelect = document.getElementById('p-gender').value;
    const gender = genderSelect === 'Other' ? document.getElementById('p-gender-custom').value : genderSelect;

    const kinRelSelect = document.getElementById('p-kin-rel').value;
    const nextOfKinRelation = kinRelSelect === 'Other' ? document.getElementById('p-kin-rel-custom').value : kinRelSelect;

    const insSelect = document.getElementById('p-ins-prov').value;
    const insuranceProvider = insSelect === 'Other' ? document.getElementById('p-ins-prov-custom').value : insSelect;

    try {
      await DB.add('patients', {
        firstName:         document.getElementById('p-fname').value,
        lastName:          document.getElementById('p-lname').value,
        dateOfBirth:       document.getElementById('p-dob').value,
        gender,
        phone:             document.getElementById('p-phone').value,
        email:             document.getElementById('p-email').value,
        address:           document.getElementById('p-addr').value,
        nextOfKinName:     document.getElementById('p-kin-name').value,
        nextOfKinRelation,
        nextOfKinPhone:    document.getElementById('p-kin-phone').value,
        insuranceProvider,
        insurancePolicyNumber: document.getElementById('p-ins-pol').value,
        allergies:         document.getElementById('p-allergies').value,
        medicalHistory:    document.getElementById('p-history').value,
        outstandingBalance: 0,
      });
      UI.closeModal();
      UI.showToast('Patient registered successfully', 'success');
      App.navigate('/patients');
    } catch (e) {
      UI.showToast('Error saving patient: ' + e.message, 'error');
    }
  },

  async viewDetails(id) {
    const patient = await DB.get('patients', id);
    if (!patient) return;

    // Load related items
    const [consultations, vitals, admissions, invoices, lab_requests] = await Promise.all([
      DB.query('consultations',  c => c.patientId == id),
      DB.query('vitals',         v => v.patientId == id),
      DB.query('admissions',     a => a.patientId == id),
      DB.query('invoices',       i => i.patientId == id),
      DB.query('lab_requests',   l => l.patientId == id),
    ]);

    // Recalculate outstanding balance based on invoices
    const calculatedBalance = invoices.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
    if (calculatedBalance !== patient.outstandingBalance) {
      patient.outstandingBalance = calculatedBalance;
      await DB.put('patients', patient);
    }

    const billingRows = invoices.length
      ? invoices.map(inv => `
        <tr>
          <td>${inv.invoiceNumber}</td>
          <td>${UI.formatDate(inv.createdAt)}</td>
          <td>${UI.formatCurrency(inv.totalAmount)}</td>
          <td>${UI.formatCurrency(inv.amountPaid)}</td>
          <td style="${inv.balance > 0 ? 'color:var(--danger);font-weight:700' : 'color:var(--success)'}">${UI.formatCurrency(inv.balance)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="PatientModule.printReceipt(${inv.id})">
              <span class="material-icons-round">print</span> Receipt
            </button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:1rem;color:var(--text-muted)">No invoices created yet</td></tr>`;

    const clinicalTimeline = [...consultations, ...vitals, ...admissions, ...lab_requests]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(e => {
        let typeLabel = '', content = '';
        if (e.soapNotes !== undefined) {
          typeLabel = 'Consultation';
          content = `<strong>Diagnosis:</strong> ${e.diagnosis || '—'} (ICD-10: ${e.icd10 || '—'})<br><strong>Notes:</strong> ${e.soapNotes?.a || '—'}
          <br><button class="btn btn-sm btn-ghost" style="margin-top:0.5rem" onclick="ConsultationModule.showEditModal(${e.id})"><span class="material-icons-round" style="font-size:1.1rem;margin-right:4px">edit</span> Edit</button>`;
        } else if (e.temperature !== undefined) {
          typeLabel = 'Triage';
          content = `Temp: ${e.temperature || '—'}°C | BP: ${e.bloodPressure || '—'} | HR: ${e.heartRate || '—'} bpm | O₂: ${e.oxygenSat || '—'}%
          <br><button class="btn btn-sm btn-ghost" style="margin-top:0.5rem" onclick="TriageModule.showEditModal(${e.id})"><span class="material-icons-round" style="font-size:1.1rem;margin-right:4px">edit</span> Edit</button>`;
        } else if (e.testName !== undefined) {
          typeLabel = 'Laboratory';
          content = `<strong>Test:</strong> ${e.testName}<br>
                     <strong>Status:</strong> ${UI.pillStatus(e.status)}<br>
                     <strong>Result:</strong> ${e.status === 'complete' ? `<strong class="${e.isAbnormal ? 'vital-abnormal' : 'vital-normal'}">${e.result}</strong> (Ref: ${e.referenceRange || '—'})` : 'Pending'}
          <br><button class="btn btn-sm btn-ghost" style="margin-top:0.5rem" onclick="${e.status === 'complete' ? `LabModule.viewResult(${e.id})` : `LabModule.enterResult(${e.id})`}"><span class="material-icons-round" style="font-size:1.1rem;margin-right:4px">${e.status === 'complete' ? 'visibility' : 'science'}</span> ${e.status === 'complete' ? 'View Result' : 'Enter Result'}</button>`;
        } else {
          typeLabel = 'Admission';
          content = `Ward: ${e.ward || '—'} | Bed: ${e.bedNumber || '—'} (Status: ${e.status})<br>
          <button class="btn btn-sm btn-secondary" style="margin-top: 0.5rem;" onclick="PatientModule.generateAdmissionLetter(${e.id}, ${patient.id})">
            <span class="material-icons-round">description</span> Admission Letter
          </button>`;
        }
        return `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-date">${UI.formatDateTime(e.createdAt)}</div>
            <div class="timeline-card">
              <div class="timeline-type">${typeLabel}</div>
              <div class="timeline-content">${content}</div>
            </div>
          </div>`;
      }).join('') || `
        <div style="text-align:center;padding:2rem;color:var(--text-muted);background:var(--surface);border-radius:12px;border:1px dashed var(--border)">
          <span class="material-icons-round" style="font-size:3rem;opacity:0.5;margin-bottom:0.5rem">medical_information</span>
          <p>No clinical history, vitals, or consultations logged yet.</p>
        </div>`;

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-xl">
          <div class="modal-header">
            <span class="modal-title">Patient Profile — ${patient.firstName} ${patient.lastName} (ID: #${patient.id})</span>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
            </div>
          </div>
          <div class="modal-body">
            <div class="tabs">
              <button class="tab-btn active" onclick="PatientModule.switchTab('tab-details', this)">General & Demographics</button>
              <button class="tab-btn" onclick="PatientModule.switchTab('tab-clinical', this)">Clinical History & EMR</button>
              <button class="tab-btn" onclick="PatientModule.switchTab('tab-financial', this)">Billing & Financials</button>
            </div>

            <!-- Tab 1: Demographics -->
            <div id="tab-details" class="tab-content">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                <h2 style="margin:0;font-size:1.25rem">General Details</h2>
                <button class="btn btn-primary btn-sm" onclick="PatientModule.showEditForm(${patient.id})">
                  <span class="material-icons-round">edit</span> Edit Demographics
                </button>
              </div>
              <div class="two-col">
                <div class="card">
                  <div class="card-title">Personal Information</div>
                  <table style="width: 100%; font-size: 0.9rem;">
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Gender</td><td><strong>${patient.gender || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Date of Birth</td><td><strong>${UI.formatDate(patient.dateOfBirth)}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Phone</td><td><strong>${patient.phone || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Email</td><td><strong>${patient.email || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Address</td><td><strong>${patient.address || '—'}</strong></td></tr>
                  </table>
                </div>
                <div class="card">
                  <div class="card-title">Next of Kin & Insurance</div>
                  <table style="width: 100%; font-size: 0.9rem;">
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Kin Name</td><td><strong>${patient.nextOfKinName || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Relationship</td><td><strong>${patient.nextOfKinRelation || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Kin Phone</td><td><strong>${patient.nextOfKinPhone || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Insurance Provider</td><td><strong>${patient.insuranceProvider || '—'}</strong></td></tr>
                    <tr><td style="padding:0.5rem 0;color:var(--text-muted)">Policy Number</td><td><strong>${patient.insurancePolicyNumber || '—'}</strong></td></tr>
                  </table>
                </div>
              </div>
              <div class="card" style="margin-top:1.5rem">
                <div class="card-title">Medical Overview</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
                  <div>
                    <div style="font-weight:600;color:var(--danger)">Known Allergies</div>
                    <p style="margin-top:0.25rem">${patient.allergies || 'No known allergies.'}</p>
                  </div>
                  <div>
                    <div style="font-weight:600;color:var(--primary)">Medical History</div>
                    <p style="margin-top:0.25rem">${patient.medicalHistory || 'No pre-existing history registered.'}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab 2: Clinical -->
            <div id="tab-clinical" class="tab-content" style="display:none">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
                <h2 style="margin:0;font-size:1.25rem">Clinical Timeline</h2>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-secondary btn-sm" onclick="UI.closeModal(); App.navigate('/triage')">
                    <span class="material-icons-round">add_chart</span> Record Triage Vitals
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="UI.closeModal(); App.navigate('/consultations')">
                    <span class="material-icons-round">add</span> Add Consultation
                  </button>
                </div>
              </div>
              <div class="timeline">${clinicalTimeline}</div>
            </div>

            <!-- Tab 3: Financials -->
            <div id="tab-financial" class="tab-content" style="display:none">
              <div class="card" style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div class="stat-label">Outstanding Account Balance</div>
                  <div class="stat-value" style="${calculatedBalance > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">${UI.formatCurrency(calculatedBalance)}</div>
                </div>
                <button class="btn btn-primary" onclick="UI.closeModal(); App.navigate('/billing')">
                  <span class="material-icons-round">payment</span> Process Invoicing
                </button>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>Invoice Number</th><th>Date</th><th>Total Billed</th><th>Amount Paid</th><th>Balance</th><th>Actions</th></tr>
                  </thead>
                  <tbody>${billingRows}</tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>`);
  },

  switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  async showEditForm(id) {
    const patient = await DB.get('patients', id);
    if (!patient) return;

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Edit Patient Profile (ID: #${patient.id})</span>
            <button class="modal-close" onclick="PatientModule.viewDetails(${patient.id})"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); PatientModule.update(${patient.id})">
              <div class="section-divider">Demographics</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">First Name</label>
                  <input id="edit-p-fname" class="form-control" value="${patient.firstName}" required></div>
                <div class="form-group"><label class="form-label">Last Name</label>
                  <input id="edit-p-lname" class="form-control" value="${patient.lastName}" required></div>
                <div class="form-group"><label class="form-label">Date of Birth</label>
                  <input id="edit-p-dob" type="date" class="form-control" value="${patient.dateOfBirth || ''}"></div>
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select id="edit-p-gender" class="form-control">
                    <option ${patient.gender === 'Male' ? 'selected' : ''}>Male</option>
                    <option ${patient.gender === 'Female' ? 'selected' : ''}>Female</option>
                    <option ${['Male', 'Female'].includes(patient.gender) ? '' : 'selected'}>Other</option>
                  </select>
                  <div id="edit-gender-other-container"></div>
                </div>
              </div>

              <div class="section-divider">Contact Info</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Phone</label>
                  <input id="edit-p-phone" class="form-control" value="${patient.phone || ''}"></div>
                <div class="form-group"><label class="form-label">Email</label>
                  <input id="edit-p-email" type="email" class="form-control" value="${patient.email || ''}"></div>
                <div class="form-group col-span-2"><label class="form-label">Address</label>
                  <input id="edit-p-addr" class="form-control" value="${patient.address || ''}"></div>
              </div>

              <div class="section-divider">Next of Kin</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Name</label>
                  <input id="edit-p-kin-name" class="form-control" value="${patient.nextOfKinName || ''}"></div>
                <div class="form-group"><label class="form-label">Relationship</label>
                  <input id="edit-p-kin-rel" class="form-control" value="${patient.nextOfKinRelation || ''}"></div>
                <div class="form-group"><label class="form-label">Phone</label>
                  <input id="edit-p-kin-phone" class="form-control" value="${patient.nextOfKinPhone || ''}"></div>
              </div>

              <div class="section-divider">Insurance</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Provider</label>
                  <input id="edit-p-ins-prov" class="form-control" value="${patient.insuranceProvider || ''}"></div>
                <div class="form-group"><label class="form-label">Policy Number</label>
                  <input id="edit-p-ins-pol" class="form-control" value="${patient.insurancePolicyNumber || ''}"></div>
              </div>

              <div class="section-divider">Medical Info</div>
              <div class="form-group"><label class="form-label">Allergies</label>
                <textarea id="edit-p-allergies" class="form-control">${patient.allergies || ''}</textarea></div>
              <div class="form-group"><label class="form-label">Medical History</label>
                <textarea id="edit-p-history" class="form-control">${patient.medicalHistory || ''}</textarea></div>

              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="PatientModule.viewDetails(${patient.id})">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);

    UI.setupOtherSelect('edit-p-gender', 'edit-gender-other-container', 'edit-p-gender-custom', 'Enter Custom Gender...');
    if (!['Male', 'Female'].includes(patient.gender) && patient.gender) {
      document.getElementById('edit-p-gender-custom').value = patient.gender;
    }
  },

  async update(id) {
    const patient = await DB.get('patients', id);
    if (!patient) return;

    const genderSelect = document.getElementById('edit-p-gender').value;
    const gender = genderSelect === 'Other' ? document.getElementById('edit-p-gender-custom').value : genderSelect;

    try {
      const updated = {
        ...patient,
        firstName: document.getElementById('edit-p-fname').value,
        lastName: document.getElementById('edit-p-lname').value,
        dateOfBirth: document.getElementById('edit-p-dob').value,
        gender,
        phone: document.getElementById('edit-p-phone').value,
        email: document.getElementById('edit-p-email').value,
        address: document.getElementById('edit-p-addr').value,
        nextOfKinName: document.getElementById('edit-p-kin-name').value,
        nextOfKinRelation: document.getElementById('edit-p-kin-rel').value,
        nextOfKinPhone: document.getElementById('edit-p-kin-phone').value,
        insuranceProvider: document.getElementById('edit-p-ins-prov').value,
        insurancePolicyNumber: document.getElementById('edit-p-ins-pol').value,
        allergies: document.getElementById('edit-p-allergies').value,
        medicalHistory: document.getElementById('edit-p-history').value,
      };

      await DB.put('patients', updated);
      UI.showToast('Patient profile updated', 'success');
      PatientModule.viewDetails(id);
    } catch (e) {
      UI.showToast('Failed to update: ' + e.message, 'error');
    }
  },

  async delete(id) {
    if (!UI.confirm('Delete this patient? All history will be lost.')) return;
    await DB.delete('patients', id);
    UI.showToast('Patient record deleted', 'warning');
    App.navigate('/patients');
  },

  async printReceipt(invoiceId) {
    const inv = await DB.get('invoices', invoiceId);
    if (!inv) return;
    const patient = await DB.get('patients', inv.patientId);

    const items = inv.items || {};
    const itemRows = Object.entries(items)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `
        <tr>
          <td style="padding:0.5rem 0;text-transform:capitalize">${k}</td>
          <td style="text-align:right;padding:0.5rem 0">${UI.formatCurrency(v)}</td>
        </tr>`).join('');

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Receipt — ${inv.invoiceNumber}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body" id="receipt-print-area">
            <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px dashed var(--border)">
              <div style="font-size:1.5rem;font-weight:800;color:var(--primary)">🏥 CliniFlow General Hospital</div>
              <div style="color:var(--text-muted)">Uganda Shillings Receipt</div>
            </div>
            <div class="two-col" style="margin-bottom:1.5rem">
              <div>
                <strong>Patient:</strong> ${patient ? patient.firstName + ' ' + patient.lastName : '—'} (ID: #${patient?.id})<br>
                <strong>Phone:</strong> ${patient?.phone || '—'}
              </div>
              <div style="text-align:right">
                <strong>Receipt No:</strong> ${inv.invoiceNumber}<br>
                <strong>Date:</strong> ${UI.formatDate(inv.createdAt)}
              </div>
            </div>
            <table style="width:100%;margin-bottom:1.5rem">
              <thead>
                <tr>
                  <th style="text-align:left;padding:0.5rem 0;border-bottom:1px solid var(--border)">Item Description</th>
                  <th style="text-align:right;padding:0.5rem 0;border-bottom:1px solid var(--border)">Amount</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div style="border-top:1px dashed var(--border);padding-top:0.75rem">
              <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${UI.formatCurrency(inv.totalAmount)}</span></div>
              <div style="display:flex;justify-content:space-between;color:var(--success)"><span>Paid Amount:</span><span>${UI.formatCurrency(inv.amountPaid)}</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;color:${inv.balance > 0 ? 'var(--danger)' : 'var(--success)'}">
                <span>Remaining Balance:</span><span>${UI.formatCurrency(inv.balance)}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window.print()"><span class="material-icons-round">print</span> Print</button>
            <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
          </div>
        </div>
      </div>`);
  },

  async generateAdmissionLetter(admissionId, patientId) {
    const admission = await DB.get('admissions', admissionId);
    const patient = await DB.get('patients', patientId);
    if (!admission || !patient) return;

    const letterContent = `OFFICIAL ADMISSION LETTER
----------------------------------------
Facility: CliniFlow General Hospital
Patient Name: ${patient.firstName} ${patient.lastName} (ID: #${patient.id})
Age/Gender: ${patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth))/31557600000) : '—'} yrs / ${patient.gender || '—'}
Ward: ${admission.ward || '—'}
Bed Number: ${admission.bedNumber || '—'}
Admitting Doctor: ${admission.admittingDoctor || '—'}
Reason for Admission: ${admission.reason || '—'}
Admission Date: ${UI.formatDateTime(admission.admittedAt)}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(letterContent)}`;

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Official Admission Letter</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body" id="admission-letter-area" style="font-family: 'Courier New', monospace; white-space: pre-wrap; padding: 2rem; border: 1px solid var(--border); background-color: var(--surface-2);">
${letterContent}
          </div>
          <div class="modal-footer">
            <a href="${whatsappUrl}" target="_blank" class="btn btn-success">
              <span class="material-icons-round">share</span> Send via WhatsApp
            </a>
            <button class="btn btn-primary" onclick="window.print()">
              <span class="material-icons-round">print</span> Print / Save as PDF
            </button>
            <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
          </div>
        </div>
      </div>`);
  }
};

window.PatientModule = PatientModule;
