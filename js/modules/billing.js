// ─── Billing Module ───
const BillingModule = {

  async render() {
    const [invoices, patients] = await Promise.all([
      DB.getAll('invoices'),
      DB.getAll('patients'),
    ]);
    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));
    window._billPatOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');

    const totalBilled     = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const totalPaid       = invoices.reduce((s, i) => s + Number(i.amountPaid  || 0), 0);
    const totalOutstanding= invoices.reduce((s, i) => s + Number(i.balance     || 0), 0);

    const rows = invoices.length
      ? [...invoices].reverse().map(inv => {
          const p = patMap[inv.patientId];
          return `
            <tr>
              <td><strong style="font-family:monospace">${inv.invoiceNumber}</strong></td>
              <td>
                <a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p?.id})" style="text-decoration:none;color:var(--primary);font-weight:600">
                  ${p ? p.firstName + ' ' + p.lastName : '—'}
                </a>
              </td>
              <td>${UI.formatDate(inv.createdAt)}</td>
              <td>${UI.formatCurrency(inv.totalAmount)}</td>
              <td>${UI.formatCurrency(inv.amountPaid)}</td>
              <td style="${inv.balance > 0 ? 'color:var(--danger);font-weight:700' : 'color:var(--success)'}">
                ${UI.formatCurrency(inv.balance)}
              </td>
              <td>${UI.pillStatus(inv.status)}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="BillingModule.viewInvoice(${inv.id})">
                  <span class="material-icons-round">receipt</span> View
                </button>
                ${inv.status !== 'paid' ? `
                <button class="btn btn-sm btn-success" onclick="BillingModule.recordPayment(${inv.id})">
                  <span class="material-icons-round">payments</span> Pay
                </button>` : ''}
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="8" class="table-empty">
          <span class="material-icons-round">receipt_long</span>No invoices yet
         </td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Billing & Payments</h1><p>${invoices.length} invoice(s)</p></div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="BillingModule.showCreateModal()">
            <span class="material-icons-round">add</span> New Invoice
          </button>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--info-light);color:var(--info)">
            <span class="material-icons-round">receipt_long</span></div></div>
          <div class="stat-value">${invoices.length}</div>
          <div class="stat-label">Total Invoices</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
            <span class="material-icons-round">paid</span></div></div>
          <div class="stat-value">${UI.formatCurrency(totalBilled)}</div>
          <div class="stat-label">Total Billed</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--success-light);color:#065f46">
            <span class="material-icons-round">payments</span></div></div>
          <div class="stat-value">${UI.formatCurrency(totalPaid)}</div>
          <div class="stat-label">Total Collected</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
            <span class="material-icons-round">account_balance</span></div></div>
          <div class="stat-value" style="color:var(--danger)">${UI.formatCurrency(totalOutstanding)}</div>
          <div class="stat-label">Outstanding</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">Invoices</span>
          <div class="table-filters">
            <input class="form-control" style="width:200px" placeholder="Search…"
              oninput="BillingModule._filter(this.value)">
          </div>
        </div>
        <table id="billing-table">
          <thead><tr>
            <th>Invoice #</th><th>Patient</th><th>Date</th>
            <th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _filter(q) {
    document.querySelectorAll('#billing-table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  showCreateModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Create Invoice</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); BillingModule.save()">
              <div class="form-group">
                <label class="form-label">Patient <span class="required">*</span></label>
                <select id="bill-patient" class="form-control" required>
                  <option value="">Select patient…</option>${window._billPatOptions || ''}
                </select>
              </div>

              <div class="section-divider">Charge Items</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Consultation Fee</label>
                  <input id="bill-consult" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Pharmacy Charges</label>
                  <input id="bill-pharmacy" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Lab Charges</label>
                  <input id="bill-lab" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Admission / Bed Charges</label>
                  <input id="bill-admission" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Procedure Charges</label>
                  <input id="bill-procedure" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Discount</label>
                  <input id="bill-discount" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
                <div class="form-group"><label class="form-label">Insurance Coverage</label>
                  <input id="bill-insurance" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
              </div>

              <div class="card" style="padding:1rem;margin-top:1rem;background:var(--surface-2)">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                  <span>Subtotal</span><strong id="calc-subtotal">UgShs 0</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;color:var(--success)">
                  <span>Discount + Insurance</span><strong id="calc-deductions">-UgShs 0</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:1.125rem;font-weight:700;border-top:1px solid var(--border);padding-top:0.5rem">
                  <span>Total Due</span><strong id="calc-total">UgShs 0</strong></div>
              </div>

              <div class="form-group" style="margin-top:1rem"><label class="form-label">Initial Payment</label>
                <input id="bill-paid" type="number" class="form-control" placeholder="0" oninput="BillingModule._calc()"></div>
              <div class="form-group"><label class="form-label">Payment Method</label>
                <select id="bill-method" class="form-control">
                  <option>Cash</option><option>Card</option><option>Mobile Money</option><option>Insurance</option>
                </select></div>
              <div class="form-group"><label class="form-label">Notes</label>
                <textarea id="bill-notes" class="form-control"></textarea></div>

              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  _calc() {
    const get = id => Number(document.getElementById(id)?.value) || 0;
    const subtotal = get('bill-consult') + get('bill-pharmacy') + get('bill-lab') +
                     get('bill-admission') + get('bill-procedure');
    const deductions = get('bill-discount') + get('bill-insurance');
    const total = Math.max(0, subtotal - deductions);
    if (document.getElementById('calc-subtotal')) {
      document.getElementById('calc-subtotal').textContent = UI.formatCurrency(subtotal);
      document.getElementById('calc-deductions').textContent = '-' + UI.formatCurrency(deductions);
      document.getElementById('calc-total').textContent = UI.formatCurrency(total);
    }
  },

  async save() {
    const get = id => Number(document.getElementById(id)?.value) || 0;
    const subtotal = get('bill-consult') + get('bill-pharmacy') + get('bill-lab') +
                     get('bill-admission') + get('bill-procedure');
    const deductions = get('bill-discount') + get('bill-insurance');
    const total = Math.max(0, subtotal - deductions);
    const paid  = get('bill-paid');
    const balance = Math.max(0, total - paid);
    const status  = balance === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    const invoiceNumber = 'INV-' + String(Date.now()).slice(-7);

    try {
      const patId = Number(document.getElementById('bill-patient').value);
      await DB.add('invoices', {
        invoiceNumber,
        patientId: patId,
        items: {
          consultation: get('bill-consult'),
          pharmacy:     get('bill-pharmacy'),
          lab:          get('bill-lab'),
          admission:    get('bill-admission'),
          procedure:    get('bill-procedure'),
        },
        discount:      get('bill-discount'),
        insurance:     get('bill-insurance'),
        totalAmount:   total,
        amountPaid:    paid,
        balance,
        status,
        paymentMethod: document.getElementById('bill-method').value,
        paymentDate:   paid > 0 ? new Date().toISOString() : null,
        notes:         document.getElementById('bill-notes').value,
      });

      // Update patient outstanding balance
      const patient = await DB.get('patients', patId);
      if (patient) {
        await DB.put('patients', {
          ...patient,
          outstandingBalance: (Number(patient.outstandingBalance) || 0) + balance,
        });
      }

      UI.closeModal();
      UI.showToast(`Invoice ${invoiceNumber} created`, 'success');
      App.navigate('/billing');
    } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
  },

  async recordPayment(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Record Payment — ${inv.invoiceNumber}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:1rem">Outstanding: <strong style="color:var(--danger)">${UI.formatCurrency(inv.balance)}</strong></p>
            <form onsubmit="event.preventDefault(); BillingModule.applyPayment(${id})">
              <div class="form-group"><label class="form-label">Amount <span class="required">*</span></label>
                <input id="pay-amount" type="number" max="${inv.balance}" class="form-control" required placeholder="0"></div>
              <div class="form-group"><label class="form-label">Method</label>
                <select id="pay-method" class="form-control">
                  <option>Cash</option><option>Card</option><option>Mobile Money</option><option>Insurance</option>
                </select></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                  <span class="material-icons-round">payments</span> Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async applyPayment(id) {
    const inv     = await DB.get('invoices', id);
    const amount  = Number(document.getElementById('pay-amount').value);
    const newPaid = Number(inv.amountPaid) + amount;
    const newBal  = Math.max(0, Number(inv.totalAmount) - newPaid);
    const status  = newBal === 0 ? 'paid' : 'partial';
    await DB.put('invoices', { ...inv, amountPaid: newPaid, balance: newBal, status, paymentDate: new Date().toISOString() });

    // Update patient balance
    const patient = await DB.get('patients', inv.patientId);
    if (patient) {
      await DB.put('patients', { ...patient, outstandingBalance: Math.max(0, Number(patient.outstandingBalance) - amount) });
    }
    UI.closeModal();
    UI.showToast('Payment recorded', 'success');
    App.navigate('/billing');
  },

  async viewInvoice(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    const patients = await DB.getAll('patients');
    const p = patients.find(pt => pt.id === inv.patientId);
    const items = inv.items || {};
    const itemRows = Object.entries(items).filter(([, v]) => v > 0)
      .map(([k, v]) => `<tr><td style="padding:0.5rem 0;text-transform:capitalize">${k}</td>
        <td style="text-align:right;padding:0.5rem 0">${UI.formatCurrency(v)}</td></tr>`).join('');

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Invoice — ${inv.invoiceNumber}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body" id="invoice-print-area">
            <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid var(--border)">
              <div style="font-size:1.5rem;font-weight:800;color:var(--primary)">🏥 CliniFlow</div>
              <div style="color:var(--text-muted)">Hospital & Clinic Management</div>
            </div>
            <div class="two-col" style="margin-bottom:1.5rem">
              <div>
                <div style="font-weight:700;margin-bottom:0.5rem">${p ? p.firstName + ' ' + p.lastName : '—'}</div>
                <div style="font-size:0.875rem;color:var(--text-muted)">ID: #${p?.id || ''}</div>
                <div style="font-size:0.875rem;color:var(--text-muted)">${p?.phone || ''}</div>
              </div>
              <div style="text-align:right">
                <div style="font-family:monospace;font-weight:700">${inv.invoiceNumber}</div>
                <div style="font-size:0.875rem;color:var(--text-muted)">${UI.formatDate(inv.createdAt)}</div>
                <div>${UI.pillStatus(inv.status)}</div>
              </div>
            </div>
            <table style="width:100%;margin-bottom:1rem">
              <thead><tr>
                <th style="text-align:left;padding:0.5rem 0;border-bottom:1px solid var(--border)">Service</th>
                <th style="text-align:right;padding:0.5rem 0;border-bottom:1px solid var(--border)">Amount</th>
              </tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div style="border-top:1px solid var(--border);padding-top:0.75rem">
              ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem"><span>Discount</span><span>-${UI.formatCurrency(inv.discount)}</span></div>` : ''}
              ${inv.insurance > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem"><span>Insurance</span><span>-${UI.formatCurrency(inv.insurance)}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;font-size:1.125rem;font-weight:700;padding-top:0.5rem">
                <span>Total</span><span>${UI.formatCurrency(inv.totalAmount)}</span></div>
              <div style="display:flex;justify-content:space-between;color:var(--success)">
                <span>Paid</span><span>${UI.formatCurrency(inv.amountPaid)}</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;color:${inv.balance > 0 ? 'var(--danger)' : 'var(--success)'}">
                <span>Balance</span><span>${UI.formatCurrency(inv.balance)}</span></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window.print()">
              <span class="material-icons-round">print</span> Print
            </button>
            <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
          </div>
        </div>
      </div>`);
  },
};

window.BillingModule = BillingModule;
