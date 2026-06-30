// ─── Triage & Vitals Module ───
const TriageModule = {

  async render() {
    const vitals = await DB.getAll('vitals');
    const patients = await DB.getAll('patients');
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));

    const rows = vitals.length
      ? [...vitals].reverse().map(v => {
          const p = patMap[v.patientId];
          const hrClass = v.heartRate && (v.heartRate < 60 || v.heartRate > 100) ? 'vital-abnormal' : 'vital-normal';
          const o2Class = v.oxygenSat && v.oxygenSat < 95 ? 'vital-abnormal' : 'vital-normal';
          const tempClass = v.temperature && (v.temperature < 36 || v.temperature > 37.5) ? 'vital-abnormal' : 'vital-normal';
          return `
            <tr>
              <td>${UI.formatDateTime(v.createdAt)}</td>
              <td>
                <a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p?.id})" style="text-decoration:none;color:var(--primary);font-weight:600">
                  ${p ? p.firstName + ' ' + p.lastName : 'Unknown'}
                </a>
                <br><small>ID: #${p?.id || ''}</small>
              </td>
              <td class="${tempClass}">${v.temperature || '—'}°C</td>
              <td>${v.bloodPressure || '—'}</td>
              <td class="${hrClass}">${v.heartRate || '—'} bpm</td>
              <td class="${o2Class}">${v.oxygenSat || '—'}%</td>
              <td>${v.weight || '—'} kg</td>
              <td>${UI.pillStatus(v.priority || 'normal')}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="TriageModule.showEditModal(${v.id})" title="Edit Vitals">
                  <span class="material-icons-round" style="color:var(--primary)">edit</span>
                </button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="9" class="table-empty"><span class="material-icons-round">monitor_heart</span>No vitals recorded yet</td></tr>`;

    const patOptions = patients.map(p => `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');
    window._triagePatOptions = patOptions;

    return `
      <div class="page-header">
        <div><h1>Triage & Vitals</h1><p>Record and monitor patient vital signs</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="TriageModule.showAddModal()">
            <span class="material-icons-round">add_chart</span> Record Vitals
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">Vitals Log</span></div>
        <table>
          <thead><tr>
            <th>Recorded</th><th>Patient</th><th>Temp</th><th>BP</th>
            <th>Heart Rate</th><th>O₂ Sat</th><th>Weight</th><th>Priority</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

        </table>
      </div>`;
  },

  showAddModal() {
    const patOptions = window._triagePatOptions || '';
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Record Patient Vitals</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); TriageModule.save()">
              <div class="form-group" style="margin-bottom:1rem">
                <label class="form-label">Patient <span class="required">*</span></label>
                <select id="t-patient" class="form-control" required>
                  <option value="">Select patient…</option>
                  ${patOptions}
                </select>
              </div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Temperature (°C)</label>
                  <input id="t-temp" type="number" step="0.1" class="form-control" placeholder="37.0"></div>
                <div class="form-group"><label class="form-label">Blood Pressure</label>
                  <input id="t-bp" class="form-control" placeholder="120/80"></div>
                <div class="form-group"><label class="form-label">Heart Rate (bpm)</label>
                  <input id="t-hr" type="number" class="form-control" placeholder="72"></div>
                <div class="form-group"><label class="form-label">O₂ Saturation (%)</label>
                  <input id="t-o2" type="number" class="form-control" placeholder="98"></div>
                <div class="form-group"><label class="form-label">Weight (kg)</label>
                  <input id="t-weight" type="number" step="0.1" class="form-control"></div>
                <div class="form-group"><label class="form-label">Respiratory Rate</label>
                  <input id="t-rr" type="number" class="form-control" placeholder="16"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Triage Priority</label>
                <select id="t-priority" class="form-control">
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="critical">Critical / Immediate</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Chief Complaint</label>
                <textarea id="t-complaint" class="form-control" placeholder="Patient's main complaint…"></textarea></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Save Vitals</button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async save() {
    const hr = Number(document.getElementById('t-hr').value);
    const o2 = Number(document.getElementById('t-o2').value);
    const temp = Number(document.getElementById('t-temp').value);
    let priority = document.getElementById('t-priority').value;

    // Auto-flag critical values
    if ((hr > 120 || hr < 50) || o2 < 90 || temp > 39.5 || temp < 35) {
      priority = 'critical';
      UI.showToast('⚠️ Critical vitals detected! Priority set to Critical.', 'error');
    }

    try {
      await DB.add('vitals', {
        patientId:     Number(document.getElementById('t-patient').value),
        temperature:   temp || null,
        bloodPressure: document.getElementById('t-bp').value,
        heartRate:     hr || null,
        oxygenSat:     o2 || null,
        weight:        document.getElementById('t-weight').value,
        respiratoryRate: document.getElementById('t-rr').value,
        chiefComplaint:  document.getElementById('t-complaint').value,
        priority,
      });
      UI.closeModal();
      UI.showToast('Vitals recorded', 'success');
      App.navigate('/triage');
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  async showEditModal(id) {
    const vital = await DB.get('vitals', id);
    if (!vital) return;
    const patOptions = window._triagePatOptions || '';
    
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Edit Vitals Record</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); TriageModule.update(${id})">
              <div class="form-group" style="margin-bottom:1rem">
                <label class="form-label">Patient</label>
                <select id="edit-t-patient" class="form-control" disabled>
                  <option value="${vital.patientId}" selected>Patient ID: #${vital.patientId}</option>
                </select>
              </div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Temperature (°C)</label>
                  <input id="edit-t-temp" type="number" step="0.1" class="form-control" value="${vital.temperature || ''}"></div>
                <div class="form-group"><label class="form-label">Blood Pressure</label>
                  <input id="edit-t-bp" class="form-control" value="${vital.bloodPressure || ''}"></div>
                <div class="form-group"><label class="form-label">Heart Rate (bpm)</label>
                  <input id="edit-t-hr" type="number" class="form-control" value="${vital.heartRate || ''}"></div>
                <div class="form-group"><label class="form-label">O₂ Saturation (%)</label>
                  <input id="edit-t-o2" type="number" class="form-control" value="${vital.oxygenSat || ''}"></div>
                <div class="form-group"><label class="form-label">Weight (kg)</label>
                  <input id="edit-t-weight" type="number" step="0.1" class="form-control" value="${vital.weight || ''}"></div>
                <div class="form-group"><label class="form-label">Respiratory Rate</label>
                  <input id="edit-t-rr" type="number" class="form-control" value="${vital.respiratoryRate || ''}"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Triage Priority</label>
                <select id="edit-t-priority" class="form-control">
                  <option value="normal" ${vital.priority === 'normal' ? 'selected' : ''}>Normal</option>
                  <option value="low" ${vital.priority === 'low' ? 'selected' : ''}>Low</option>
                  <option value="critical" ${vital.priority === 'critical' ? 'selected' : ''}>Critical / Immediate</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Chief Complaint</label>
                <textarea id="edit-t-complaint" class="form-control">${vital.chiefComplaint || ''}</textarea></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async update(id) {
    const vital = await DB.get('vitals', id);
    if (!vital) return;

    const hr = Number(document.getElementById('edit-t-hr').value);
    const o2 = Number(document.getElementById('edit-t-o2').value);
    const temp = Number(document.getElementById('edit-t-temp').value);
    let priority = document.getElementById('edit-t-priority').value;

    if ((hr > 120 || hr < 50) || (o2 > 0 && o2 < 90) || (temp > 0 && (temp > 39.5 || temp < 35))) {
      priority = 'critical';
      UI.showToast('⚠️ Critical vitals detected! Priority set to Critical.', 'error');
    }

    try {
      await DB.put('vitals', {
        ...vital,
        temperature:   temp || null,
        bloodPressure: document.getElementById('edit-t-bp').value,
        heartRate:     hr || null,
        oxygenSat:     o2 || null,
        weight:        document.getElementById('edit-t-weight').value,
        respiratoryRate: document.getElementById('edit-t-rr').value,
        chiefComplaint:  document.getElementById('edit-t-complaint').value,
        priority,
      });
      UI.closeModal();
      UI.showToast('Vitals updated', 'success');
      App.handleRoute(); // re-render the current route so changes show in Patient Profile too!
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  }
};

window.TriageModule = TriageModule;
