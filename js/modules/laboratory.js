// ─── Laboratory Module ───
const LabModule = {

  LAB_TESTS: [
    { name: 'Full Blood Count (FBC)',    refRange: 'Hb: 12-17 g/dL, WBC: 4-11 ×10⁹/L' },
    { name: 'Blood Glucose (Fasting)',   refRange: '3.9–5.5 mmol/L' },
    { name: 'Lipid Profile',            refRange: 'Total Chol: <5.2 mmol/L' },
    { name: 'Liver Function Tests',      refRange: 'ALT: 7-56 U/L, AST: 10-40 U/L' },
    { name: 'Kidney Function Tests',     refRange: 'Creatinine: 53-106 µmol/L, Urea: 2.5-6.7 mmol/L' },
    { name: 'Urinalysis',               refRange: 'pH: 4.5-8, Protein: Negative' },
    { name: 'Malaria RDT',              refRange: 'Negative' },
    { name: 'HIV Test',                 refRange: 'Non-reactive' },
    { name: 'Thyroid Function (TSH)',    refRange: '0.4–4.0 mIU/L' },
    { name: 'Prothrombin Time (PT/INR)', refRange: 'PT: 11-13s, INR: 0.8-1.2' },
  ],

  async render() {
    const [labRequests, patients] = await Promise.all([
      DB.getAll('lab_requests'),
      DB.getAll('patients'),
    ]);
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));
    window._labPatOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ${p.mrn}</option>`).join('');
    window._labTestOptions = this.LAB_TESTS.map(t =>
      `<option value="${t.name}" data-ref="${t.refRange}">${t.name}</option>`).join('');

    const pending  = labRequests.filter(l => l.status === 'pending');
    const complete = labRequests.filter(l => l.status === 'complete');

    const rows = labRequests.length
      ? [...labRequests].reverse().map(l => {
          const p = patMap[l.patientId];
          const isAbnormal = l.isAbnormal;
          return `
            <tr>
              <td>${UI.formatDateTime(l.createdAt)}</td>
              <td>
                <a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p?.id})" style="text-decoration:none;color:var(--primary);font-weight:600">
                  ${p ? p.firstName + ' ' + p.lastName : '—'}
                </a>
              </td>
              <td>${l.testName}</td>
              <td>${l.requestedBy || '—'}</td>
              <td>${l.status === 'complete'
                ? `<span class="${isAbnormal ? 'vital-abnormal' : 'vital-normal'}">${l.result}</span>`
                : '—'}</td>
              <td>${l.referenceRange || '—'}</td>
              <td>${UI.pillStatus(l.status)}</td>
              <td>
                ${l.status === 'pending'
                  ? `<button class="btn btn-sm btn-primary" onclick="LabModule.enterResult(${l.id})">
                      <span class="material-icons-round">science</span> Enter Result
                     </button>`
                  : `<button class="btn btn-sm btn-secondary" onclick="LabModule.viewResult(${l.id})">
                      <span class="material-icons-round">visibility</span> View
                     </button>`}
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="8" class="table-empty">
          <span class="material-icons-round">science</span>No lab requests yet
         </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Laboratory</h1>
          <p>${pending.length} pending, ${complete.length} complete</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="LabModule.showRequestModal()">
            <span class="material-icons-round">add</span> New Test Request
          </button>
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:#dbeafe;color:#1d4ed8">
            <span class="material-icons-round">pending</span></div></div>
          <div class="stat-value">${pending.length}</div>
          <div class="stat-label">Pending Tests</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--success-light);color:#065f46">
            <span class="material-icons-round">check_circle</span></div></div>
          <div class="stat-value">${complete.length}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
            <span class="material-icons-round">warning</span></div></div>
          <div class="stat-value">${labRequests.filter(l => l.isAbnormal).length}</div>
          <div class="stat-label">Abnormal Results</div>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">Lab Requests</span></div>
        <table>
          <thead><tr>
            <th>Date</th><th>Patient</th><th>Test</th><th>Requested By</th>
            <th>Result</th><th>Ref. Range</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  showRequestModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">New Lab Test Request</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); LabModule.saveRequest()">
              <div class="form-group">
                <label class="form-label">Patient <span class="required">*</span></label>
                <select id="lab-patient" class="form-control" required>
                  <option value="">Select patient…</option>${window._labPatOptions || ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Test <span class="required">*</span></label>
                <select id="lab-test" class="form-control" required onchange="LabModule._updateRef(this)">
                  <option value="">Select test…</option>${window._labTestOptions || ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Reference Range</label>
                <input id="lab-ref" class="form-control" placeholder="Auto-filled" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Requested By</label>
                <input id="lab-reqby" class="form-control" placeholder="Dr. …">
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">send</span> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  _updateRef(sel) {
    const opt = sel.options[sel.selectedIndex];
    const ref = opt?.dataset?.ref || '';
    document.getElementById('lab-ref').value = ref;
  },

  async saveRequest() {
    try {
      await DB.add('lab_requests', {
        patientId:      Number(document.getElementById('lab-patient').value),
        testName:       document.getElementById('lab-test').value,
        referenceRange: document.getElementById('lab-ref').value,
        requestedBy:    document.getElementById('lab-reqby').value,
        status:         'pending',
        result:         null,
        isAbnormal:     false,
      });
      UI.closeModal();
      UI.showToast('Lab request submitted', 'success');
      App.navigate('/laboratory');
    } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
  },

  async enterResult(id) {
    const req = await DB.get('lab_requests', id);
    if (!req) return;
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Enter Result — ${req.testName}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <p style="color:var(--text-muted);margin-bottom:1rem">Ref. Range: <strong>${req.referenceRange || '—'}</strong></p>
            <form onsubmit="event.preventDefault(); LabModule.saveResult(${id})">
              <div class="form-group"><label class="form-label">Result <span class="required">*</span></label>
                <input id="res-val" class="form-control" required placeholder="Enter result value…"></div>
              <div class="form-group"><label class="form-label">Performed By</label>
                <input id="res-by" class="form-control" placeholder="Lab technician…"></div>
              <div class="form-group"><label class="form-label">Notes</label>
                <textarea id="res-notes" class="form-control"></textarea></div>
              <div class="form-group">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
                  <input id="res-abnormal" type="checkbox"> Mark as Abnormal
                </label>
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Result
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async saveResult(id) {
    const req = await DB.get('lab_requests', id);
    if (!req) return;
    const isAbnormal = document.getElementById('res-abnormal').checked;
    await DB.put('lab_requests', {
      ...req,
      result:      document.getElementById('res-val').value,
      performedBy: document.getElementById('res-by').value,
      notes:       document.getElementById('res-notes').value,
      isAbnormal,
      status:      'complete',
      completedAt: new Date().toISOString(),
    });
    UI.closeModal();
    if (isAbnormal) UI.showToast('⚠️ Abnormal result recorded!', 'error');
    else UI.showToast('Result saved', 'success');
    App.navigate('/laboratory');
  },

  async viewResult(id) {
    const r = await DB.get('lab_requests', id);
    if (!r) return;
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">${r.testName}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <div class="two-col" style="margin-bottom:1rem">
              <div><small style="color:var(--text-muted)">Requested By</small><br><strong>${r.requestedBy || '—'}</strong></div>
              <div><small style="color:var(--text-muted)">Performed By</small><br><strong>${r.performedBy || '—'}</strong></div>
              <div><small style="color:var(--text-muted)">Reference Range</small><br>${r.referenceRange || '—'}</div>
              <div><small style="color:var(--text-muted)">Completed</small><br>${UI.formatDateTime(r.completedAt)}</div>
            </div>
            <div class="card" style="padding:1rem;text-align:center">
              <div style="font-size:0.8125rem;color:var(--text-muted)">Result</div>
              <div style="font-size:2rem;font-weight:800;color:${r.isAbnormal ? 'var(--danger)' : 'var(--success)'}">${r.result}</div>
              ${r.isAbnormal ? '<div class="pill pill-red">ABNORMAL</div>' : '<div class="pill pill-green">NORMAL</div>'}
            </div>
            ${r.notes ? `<div style="margin-top:1rem"><strong>Notes:</strong><p style="margin-top:0.25rem">${r.notes}</p></div>` : ''}
          </div>
        </div>
      </div>`);
  },
};

window.LabModule = LabModule;
