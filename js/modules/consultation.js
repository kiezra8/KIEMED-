// ─── Consultations Module ───
const ConsultationModule = {

  async render() {
    const [consultations, patients] = await Promise.all([
      DB.getAll('consultations'),
      DB.getAll('patients'),
    ]);
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));
    const patOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');
    window._consultPatOptions = patOptions;

    const rows = consultations.length
      ? [...consultations].reverse().map(c => {
          const p = patMap[c.patientId];
          return `
            <tr>
              <td>${UI.formatDateTime(c.createdAt)}</td>
              <td>
                <a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p?.id})" style="text-decoration:none;color:var(--primary);font-weight:600">
                  ${p ? p.firstName + ' ' + p.lastName : '—'}
                </a>
                <br><small>ID: #${p?.id || ''}</small>
              </td>
              <td>${c.doctor || '—'}</td>
              <td>${c.diagnosis || '—'}</td>
              <td>${c.icd10 || '—'}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="ConsultationModule.viewDetail(${c.id})">
                  <span class="material-icons-round">visibility</span> View
                </button>
                <button class="btn btn-sm btn-ghost" onclick="ConsultationModule.showEditModal(${c.id})" title="Edit">
                  <span class="material-icons-round" style="color:var(--primary)">edit</span>
                </button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6" class="table-empty">
          <span class="material-icons-round">medical_services</span>No consultations recorded
         </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Consultations</h1><p>${consultations.length} consultation(s) on record</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="ConsultationModule.showAddModal()">
            <span class="material-icons-round">add</span> New Consultation
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">All Consultations</span></div>
        <table>
          <thead><tr>
            <th>Date / Time</th><th>Patient</th><th>Doctor</th>
            <th>Diagnosis</th><th>ICD-10</th><th>Actions</th>
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
            <span class="modal-title">New Consultation (SOAP)</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); ConsultationModule.save()">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Patient <span class="required">*</span></label>
                  <select id="c-patient" class="form-control" required>
                    <option value="">Select patient…</option>
                    ${window._consultPatOptions || ''}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Doctor / Clinician <span class="required">*</span></label>
                  <input id="c-doctor" class="form-control" required placeholder="Dr. John Smith">
                </div>
              </div>

              <div class="section-divider">SOAP Notes</div>
              <div class="form-group">
                <label class="form-label">S — Subjective (Patient's complaint)</label>
                <textarea id="c-soap-s" class="form-control" rows="2" placeholder="What the patient reports…"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">O — Objective (Examination findings)</label>
                <textarea id="c-soap-o" class="form-control" rows="2" placeholder="Clinical observations and measurements…"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">A — Assessment (Diagnosis)</label>
                <textarea id="c-soap-a" class="form-control" rows="2" placeholder="Clinical impression / diagnosis…"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">P — Plan (Treatment)</label>
                <textarea id="c-soap-p" class="form-control" rows="2" placeholder="Treatment plan, medications, follow-up…"></textarea>
              </div>

              <div class="section-divider">Classification</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Primary Diagnosis</label>
                  <input id="c-diagnosis" class="form-control" placeholder="e.g. Hypertension">
                </div>
                <div class="form-group">
                  <label class="form-label">ICD-10 Code</label>
                  <input id="c-icd10" class="form-control" placeholder="e.g. I10">
                </div>
                <div class="form-group">
                  <label class="form-label">Referral To</label>
                  <input id="c-referral" class="form-control" placeholder="Cardiology, Radiology…">
                </div>
                <div class="form-group">
                  <label class="form-label">Follow-Up Date</label>
                  <input id="c-followup" type="date" class="form-control">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Prescription / Medications</label>
                <textarea id="c-prescription" class="form-control" rows="2" placeholder="Drug name, dose, frequency…"></textarea>
              </div>

              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Consultation
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async save() {
    try {
      await DB.add('consultations', {
        patientId:   Number(document.getElementById('c-patient').value),
        doctor:      document.getElementById('c-doctor').value,
        soapNotes: {
          s: document.getElementById('c-soap-s').value,
          o: document.getElementById('c-soap-o').value,
          a: document.getElementById('c-soap-a').value,
          p: document.getElementById('c-soap-p').value,
        },
        diagnosis:    document.getElementById('c-diagnosis').value,
        icd10:        document.getElementById('c-icd10').value,
        referral:     document.getElementById('c-referral').value,
        followUpDate: document.getElementById('c-followup').value,
        prescription: document.getElementById('c-prescription').value,
      });
      UI.closeModal();
      UI.showToast('Consultation saved', 'success');
      App.navigate('/consultations');
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  async showEditModal(id) {
    const c = await DB.get('consultations', id);
    if (!c) return;

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Edit Consultation</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); ConsultationModule.update(${id})">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Patient</label>
                  <select id="edit-c-patient" class="form-control" disabled>
                    <option value="${c.patientId}" selected>Patient ID: #${c.patientId}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Doctor / Clinician <span class="required">*</span></label>
                  <input id="edit-c-doctor" class="form-control" required value="${c.doctor || ''}">
                </div>
              </div>

              <div class="section-divider">SOAP Notes</div>
              <div class="form-group">
                <label class="form-label">S — Subjective</label>
                <textarea id="edit-c-soap-s" class="form-control" rows="2">${c.soapNotes?.s || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">O — Objective</label>
                <textarea id="edit-c-soap-o" class="form-control" rows="2">${c.soapNotes?.o || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">A — Assessment</label>
                <textarea id="edit-c-soap-a" class="form-control" rows="2">${c.soapNotes?.a || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">P — Plan</label>
                <textarea id="edit-c-soap-p" class="form-control" rows="2">${c.soapNotes?.p || ''}</textarea>
              </div>

              <div class="section-divider">Classification</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Primary Diagnosis</label>
                  <input id="edit-c-diagnosis" class="form-control" value="${c.diagnosis || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">ICD-10 Code</label>
                  <input id="edit-c-icd10" class="form-control" value="${c.icd10 || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Referral To</label>
                  <input id="edit-c-referral" class="form-control" value="${c.referral || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Follow-Up Date</label>
                  <input id="edit-c-followup" type="date" class="form-control" value="${c.followUpDate || ''}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Prescription / Medications</label>
                <textarea id="edit-c-prescription" class="form-control" rows="2">${c.prescription || ''}</textarea>
              </div>

              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async update(id) {
    const c = await DB.get('consultations', id);
    if (!c) return;

    try {
      await DB.put('consultations', {
        ...c,
        doctor:      document.getElementById('edit-c-doctor').value,
        soapNotes: {
          s: document.getElementById('edit-c-soap-s').value,
          o: document.getElementById('edit-c-soap-o').value,
          a: document.getElementById('edit-c-soap-a').value,
          p: document.getElementById('edit-c-soap-p').value,
        },
        diagnosis:    document.getElementById('edit-c-diagnosis').value,
        icd10:        document.getElementById('edit-c-icd10').value,
        referral:     document.getElementById('edit-c-referral').value,
        followUpDate: document.getElementById('edit-c-followup').value,
        prescription: document.getElementById('edit-c-prescription').value,
      });
      UI.closeModal();
      UI.showToast('Consultation updated', 'success');
      App.handleRoute(); // re-render the current route
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  async viewDetail(id) {
    const c = await DB.get('consultations', id);
    if (!c) return;
    const patients = await DB.getAll('patients');
    const p = patients.find(pt => pt.id === c.patientId);
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Consultation — ${p ? p.firstName + ' ' + p.lastName : 'Unknown'}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <p style="color:var(--text-muted);margin-bottom:1.5rem">${UI.formatDateTime(c.createdAt)} — Dr. ${c.doctor}</p>
            ${['S','O','A','P'].map(k => `
              <div style="margin-bottom:1rem">
                <div style="font-weight:700;color:var(--primary);font-size:0.8125rem;text-transform:uppercase;margin-bottom:0.25rem">
                  ${k === 'S' ? 'Subjective' : k === 'O' ? 'Objective' : k === 'A' ? 'Assessment' : 'Plan'}
                </div>
                <div class="card" style="padding:0.75rem">${(c.soapNotes && c.soapNotes[k.toLowerCase()]) || '<span style="color:var(--text-muted)">—</span>'}</div>
              </div>`).join('')}
            <div class="form-grid" style="margin-top:1rem">
              <div><span style="color:var(--text-muted);font-size:0.8125rem">Diagnosis</span><br><strong>${c.diagnosis || '—'}</strong></div>
              <div><span style="color:var(--text-muted);font-size:0.8125rem">ICD-10</span><br><strong>${c.icd10 || '—'}</strong></div>
              <div><span style="color:var(--text-muted);font-size:0.8125rem">Referral</span><br>${c.referral || '—'}</div>
              <div><span style="color:var(--text-muted);font-size:0.8125rem">Follow-Up</span><br>${UI.formatDate(c.followUpDate)}</div>
            </div>
            ${c.prescription ? `<div class="section-divider">Prescription</div><div class="card" style="padding:0.75rem">${c.prescription}</div>` : ''}
          </div>
        </div>
      </div>`);
  },
};

window.ConsultationModule = ConsultationModule;
