// ─── Admissions & Ward/Bed Module ───
const AdmissionModule = {

  async render() {
    const [admissions, patients, inventory] = await Promise.all([
      DB.getAll('admissions'),
      DB.getAll('patients'),
      DB.getAll('inventory'),
    ]);
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));
    window._admissPatOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');
    
    // Cache inventory for treatment dropdown
    window._pharmacyInventoryOptions = inventory.map(item => 
      `<option value="${item.id}" data-name="${item.itemName}" data-price="${item.sellingPrice}" data-stock="${item.currentStock}">
        ${item.itemName} (${item.currentStock} ${item.unit || 'units'} left) — ${UI.formatCurrency(item.sellingPrice)}
      </option>`).join('');

    const active = admissions.filter(a => a.status === 'active');
    const discharged = admissions.filter(a => a.status === 'discharged');

    const rows = admissions.length
      ? [...admissions].reverse().map(a => {
          const p = patMap[a.patientId];
          const days = a.admittedAt
            ? Math.floor((new Date() - new Date(a.admittedAt)) / 86400000)
            : 0;
          return `
            <tr>
              <td>
                <a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p?.id})" style="text-decoration:none;color:var(--primary);font-weight:600">
                  ${p ? p.firstName + ' ' + p.lastName : '—'}
                </a>
                <br><small>ID: #${p?.id || ''}</small>
              </td>
              <td>${a.ward || '—'}</td>
              <td>${a.bedNumber || '—'}</td>
              <td>${a.admittingDoctor || '—'}</td>
              <td>${UI.formatDate(a.admittedAt)}</td>
              <td>${a.status === 'active' ? (days === 0 ? 'Today' : days + ' day(s)') : UI.formatDate(a.dischargedAt)}</td>
              <td>${UI.pillStatus(a.status)}</td>
              <td>
                ${a.status === 'active' ? `
                  <button class="btn btn-sm btn-primary" onclick="AdmissionModule.showTreatmentModal(${a.id}, ${a.patientId})">
                    <span class="material-icons-round">medical_services</span> Treat
                  </button>
                  <button class="btn btn-sm btn-secondary" onclick="AdmissionModule.discharge(${a.id})">
                    <span class="material-icons-round">logout</span> Discharge
                  </button>` : ''}
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="8" class="table-empty"><span class="material-icons-round">bed</span>No admissions yet</td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Admissions & Wards</h1>
          <p>${active.length} active, ${discharged.length} discharged</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="AdmissionModule.showAddModal()">
            <span class="material-icons-round">add</span> Admit Patient
          </button>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:#dbeafe;color:#1d4ed8">
            <span class="material-icons-round">bed</span></div></div>
          <div class="stat-value">${active.length}</div>
          <div class="stat-label">Active Admissions</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--success-light);color:#065f46">
            <span class="material-icons-round">check_circle</span></div></div>
          <div class="stat-value">${discharged.length}</div>
          <div class="stat-label">Discharged Patients</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--warning-light);color:#92400e">
            <span class="material-icons-round">hvac</span></div></div>
          <div class="stat-value">${active.map(a => a.ward).filter((v, i, self) => self.indexOf(v) === i).length}</div>
          <div class="stat-label">Active Wards</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar"><span class="table-title">Admissions Log</span></div>
        <table>
          <thead><tr>
            <th>Patient</th><th>Ward</th><th>Bed</th><th>Doctor</th>
            <th>Admitted</th><th>Duration / Discharged</th><th>Status</th><th>Actions</th>
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
            <span class="modal-title">Admit Patient</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); AdmissionModule.save()">
              <div class="form-group">
                <label class="form-label">Patient <span class="required">*</span></label>
                <select id="a-patient" class="form-control" required>
                  <option value="">Select patient…</option>
                  ${window._admissPatOptions || ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Ward Name (Type Custom Ward) <span class="required">*</span></label>
                <input id="a-ward" type="text" class="form-control" required placeholder="e.g. ICU, General Ward, Pediatric">
              </div>
              <div class="form-group">
                <label class="form-label">Bed Number (Type Custom Bed) <span class="required">*</span></label>
                <input id="a-bed" type="text" class="form-control" required placeholder="e.g. Bed 10, Bed B-4">
              </div>
              <div class="form-group">
                <label class="form-label">Admitting Doctor</label>
                <input id="a-doctor" class="form-control" placeholder="Dr. …">
              </div>
              <div class="form-group">
                <label class="form-label">Admission Reason</label>
                <textarea id="a-reason" class="form-control" placeholder="Reason for admission…"></textarea>
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Admit
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async save() {
    try {
      await DB.add('admissions', {
        patientId:      Number(document.getElementById('a-patient').value),
        ward:           document.getElementById('a-ward').value,
        bedNumber:      document.getElementById('a-bed').value,
        admittingDoctor:document.getElementById('a-doctor').value,
        reason:         document.getElementById('a-reason').value,
        status:         'active',
        admittedAt:     new Date().toISOString(),
      });
      UI.closeModal();
      UI.showToast('Patient admitted successfully', 'success');
      App.navigate('/admissions');
    } catch (e) { 
      UI.showToast('Error: ' + e.message, 'error'); 
    }
  },

  async discharge(id) {
    if (!UI.confirm('Discharge this patient?')) return;
    const admission = await DB.get('admissions', id);
    if (!admission) return;
    await DB.put('admissions', { 
      ...admission, 
      status: 'discharged', 
      dischargedAt: new Date().toISOString() 
    });
    UI.showToast('Patient discharged successfully', 'success');
    App.navigate('/admissions');
  },

  // ── Administer Treatment Modal ──
  showTreatmentModal(admissionId, patientId) {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Administer Medication / Treatment</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); AdmissionModule.saveTreatment(${admissionId}, ${patientId})">
              <div class="form-group">
                <label class="form-label">Medication (from Pharmacy Inventory) <span class="required">*</span></label>
                <select id="tr-item" class="form-control" required>
                  <option value="">Select medicine…</option>
                  ${window._pharmacyInventoryOptions || ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Quantity to Administer <span class="required">*</span></label>
                <input id="tr-qty" type="number" min="1" value="1" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Treatment Notes / Instructions</label>
                <textarea id="tr-notes" class="form-control" placeholder="Dosage, notes..."></textarea>
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">check_circle</span> Administer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async saveTreatment(admissionId, patientId) {
    const itemSelect = document.getElementById('tr-item');
    const itemId = Number(itemSelect.value);
    const qty = Number(document.getElementById('tr-qty').value);
    const notes = document.getElementById('tr-notes').value;

    if (!itemId) {
      UI.showToast('Please select a drug', 'error');
      return;
    }

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const itemName = selectedOption.dataset.name;
    const unitPrice = Number(selectedOption.dataset.price);
    const currentStock = Number(selectedOption.dataset.stock);

    if (qty > currentStock) {
      UI.showToast(`Insufficient stock in pharmacy! Only ${currentStock} left.`, 'error');
      return;
    }

    try {
      // 1. Deduct Pharmacy Inventory Stock automatically
      const item = await DB.get('inventory', itemId);
      await DB.put('inventory', {
        ...item,
        currentStock: item.currentStock - qty
      });

      // 2. Add a Pharmacy Dispensing Record (Sale)
      const chargeAmount = qty * unitPrice;
      await DB.add('dispensing', {
        itemId,
        itemName,
        patientId,
        qty,
        dispensedBy: 'Ward Treatment',
        notes: `Administered during admission. Notes: ${notes}`,
        unitPrice,
        totalPrice: chargeAmount
      });

      // 3. Add to Patient EMR Clinical History
      await DB.add('vitals', { // using vitals/timeline table for generic clinical updates
        patientId,
        createdAt: new Date().toISOString(),
        temperature: null,
        bloodPressure: 'Treatment given',
        heartRate: null,
        oxygenSat: null,
        weight: null,
        priority: 'normal',
        chiefComplaint: `Administered ${qty}x ${itemName}. Notes: ${notes}`
      });

      // 4. Update Billing: Add charge to patient's latest unpaid invoice or create a new one
      const invoices = await DB.query('invoices', i => i.patientId === patientId && i.status !== 'paid');
      if (invoices.length > 0) {
        const latestInvoice = invoices[0];
        const updatedPharmacyCost = (Number(latestInvoice.items.pharmacy) || 0) + chargeAmount;
        const newTotal = (Number(latestInvoice.totalAmount) || 0) + chargeAmount;
        const newBalance = (Number(latestInvoice.balance) || 0) + chargeAmount;
        
        await DB.put('invoices', {
          ...latestInvoice,
          items: {
            ...latestInvoice.items,
            pharmacy: updatedPharmacyCost
          },
          totalAmount: newTotal,
          balance: newBalance
        });
      } else {
        // Create new invoice with pharmacy charges
        const invoiceNumber = 'INV-' + String(Date.now()).slice(-7);
        await DB.add('invoices', {
          invoiceNumber,
          patientId,
          items: {
            consultation: 0,
            pharmacy: chargeAmount,
            lab: 0,
            admission: 0,
            procedure: 0
          },
          discount: 0,
          insurance: 0,
          totalAmount: chargeAmount,
          amountPaid: 0,
          balance: chargeAmount,
          status: 'unpaid',
          paymentMethod: 'Cash',
          paymentDate: null,
          notes: `Auto-generated from Ward Treatment: ${itemName}`
        });
      }

      // 5. Update Patient outstandingBalance
      const patient = await DB.get('patients', patientId);
      if (patient) {
        await DB.put('patients', {
          ...patient,
          outstandingBalance: (Number(patient.outstandingBalance) || 0) + chargeAmount
        });
      }

      UI.closeModal();
      UI.showToast(`Administered ${qty}x ${itemName}. Pharmacy stock updated. Billing updated.`, 'success');
      App.navigate('/admissions');
    } catch (e) {
      UI.showToast('Failed to save treatment: ' + e.message, 'error');
    }
  }
};

window.AdmissionModule = AdmissionModule;
