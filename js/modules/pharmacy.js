// ─── Pharmacy Module ───
const PharmacyModule = {

  async render() {
    const [inventory, dispensing, patients] = await Promise.all([
      DB.getAll('inventory'),
      DB.getAll('dispensing'),
      DB.getAll('patients'),
    ]);

    const patMap = Object.fromEntries(patients.map(p => [p.id, p]));

    const lowStock  = inventory.filter(i => Number(i.currentStock) <= Number(i.reorderLevel || 10));
    const expiringSoon = inventory.filter(i => {
      if (!i.expiryDate) return false;
      const days = Math.floor((new Date(i.expiryDate) - new Date()) / 86400000);
      return days >= 0 && days <= 30;
    });

    const rows = inventory.length
      ? [...inventory].map(item => {
          const stock = Number(item.currentStock);
          const reorder = Number(item.reorderLevel || 10);
          const isLow = stock <= reorder;
          const expDays = item.expiryDate
            ? Math.floor((new Date(item.expiryDate) - new Date()) / 86400000)
            : null;
          const isExpiring = expDays !== null && expDays <= 30;
          return `
            <tr>
              <td>
                <strong>${item.itemName}</strong>
                <div style="font-size:0.75rem;color:var(--text-muted)">${item.genericName || ''}</div>
              </td>
              <td>${item.category || '—'}</td>
              <td>${item.batchNumber || '—'}</td>
              <td style="${isExpiring ? 'color:var(--danger);font-weight:600' : ''}">
                ${UI.formatDate(item.expiryDate)}
                ${isExpiring ? ` <span class="pill pill-red">${expDays}d</span>` : ''}
              </td>
              <td>
                <span style="${isLow ? 'color:var(--danger);font-weight:700' : ''}">${stock}</span>
                ${isLow ? '<span class="pill pill-red" style="margin-left:4px">Low</span>' : ''}
              </td>
              <td>${reorder}</td>
              <td>${UI.formatCurrency(item.sellingPrice)}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="PharmacyModule.showDispenseModal(${item.id})">
                  <span class="material-icons-round">medication</span> Dispense / Sell
                </button>
                <button class="btn btn-sm btn-ghost" onclick="PharmacyModule.delete(${item.id})">
                  <span class="material-icons-round" style="color:var(--danger)">delete</span>
                </button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="8" class="table-empty">
          <span class="material-icons-round">local_pharmacy</span>No inventory items. Add stock to get started.
         </td></tr>`;

    const recentDispHTML = dispensing.length
      ? [...dispensing].reverse().map(d => {
          const p = d.patientId ? patMap[d.patientId] : null;
          return `
            <tr>
              <td>${UI.formatDateTime(d.createdAt)}</td>
              <td>${d.itemName || '—'}</td>
              <td>${d.qty}</td>
              <td>${UI.formatCurrency(d.totalPrice)}</td>
              <td>${p ? `<a href="javascript:void(0)" onclick="PatientModule.viewDetails(${p.id})" style="text-decoration:none;color:var(--primary);font-weight:600">${p.firstName} ${p.lastName}</a>` : d.dispensedBy || 'Over the counter'}</td>
              <td>
                <button class="btn btn-sm btn-danger" onclick="PharmacyModule.removeSale(${d.id})">
                  <span class="material-icons-round">undo</span> Return Stock / Delete
                </button>
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6" class="table-empty">No drug sales logged yet</td></tr>`;

    return `
      <div class="page-header">
        <div><h1>Pharmacy & Drug Sales</h1><p>${inventory.length} items in stock</p></div>
        <div class="page-actions">
          <button class="btn btn-success" onclick="PharmacyModule.showGlobalDispenseModal()" style="margin-right:0.5rem;background:var(--success);color:white;border-color:var(--success)">
            <span class="material-icons-round">point_of_sale</span> Direct Sale
          </button>
          <button class="btn btn-primary" onclick="PharmacyModule.showAddModal()">
            <span class="material-icons-round">add</span> Add Inventory Item
          </button>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
            <span class="material-icons-round">inventory_2</span></div></div>
          <div class="stat-value">${inventory.length}</div>
          <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
            <span class="material-icons-round">warning</span></div></div>
          <div class="stat-value">${lowStock.length}</div>
          <div class="stat-label">Low Stock Alerts</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:var(--success-light);color:#065f46">
            <span class="material-icons-round">shopping_cart</span></div></div>
          <div class="stat-value">${dispensing.length}</div>
          <div class="stat-label">Total Sales</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" onclick="PharmacyModule.switchTab('pharmacy-inventory-tab', this)">Inventory Stock</button>
        <button class="tab-btn" onclick="PharmacyModule.switchTab('pharmacy-sales-tab', this)">Drug Sales Log</button>
      </div>

      <!-- Tab 1: Inventory -->
      <div id="pharmacy-inventory-tab" class="tab-content">
        <div class="table-wrap">
          <div class="table-toolbar">
            <span class="table-title">Drug Inventory List</span>
            <input class="form-control" style="width:200px" placeholder="Search stock…"
              oninput="PharmacyModule.filterTable(this.value,'pharma-table')">
          </div>
          <table id="pharma-table">
            <thead><tr>
              <th>Item / Generic Name</th><th>Category</th><th>Batch</th>
              <th>Expiry</th><th>Stock</th><th>Reorder Lvl</th><th>Unit Price</th><th>Actions</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Sales -->
      <div id="pharmacy-sales-tab" class="tab-content" style="display:none">
        <div class="table-wrap">
          <div class="table-toolbar">
            <span class="table-title">All Dispensed & Sold Drugs</span>
            <input class="form-control" style="width:200px" placeholder="Search sales…"
              oninput="PharmacyModule.filterTable(this.value,'sales-table')">
          </div>
          <table id="sales-table">
            <thead><tr>
              <th>Date / Time</th><th>Drug Name</th><th>Qty</th><th>Total Bill</th><th>Patient / Route</th><th>Actions</th>
            </tr></thead>
            <tbody>${recentDispHTML}</tbody>
          </table>
        </div>
      </div>`;
  },

  switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  filterTable(q, tableId) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  showAddModal() {
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">Add Inventory Item</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); PharmacyModule.saveItem()">
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Item Name <span class="required">*</span></label>
                  <input id="ph-name" class="form-control" required></div>
                <div class="form-group"><label class="form-label">Generic Name</label>
                  <input id="ph-generic" class="form-control"></div>
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="ph-cat" class="form-control">
                    <option>Antibiotic</option>
                    <option>Analgesic</option>
                    <option>Antihypertensive</option>
                    <option>Antidiabetic</option>
                    <option>Supplement</option>
                    <option>Other</option>
                  </select>
                  <div id="cat-other-container"></div>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit</label>
                  <select id="ph-unit" class="form-control">
                    <option>Tablet</option>
                    <option>Capsule</option>
                    <option>Vial</option>
                    <option>Bottle</option>
                    <option>Other</option>
                  </select>
                  <div id="unit-other-container"></div>
                </div>
                <div class="form-group"><label class="form-label">Batch Number</label>
                  <input id="ph-batch" class="form-control"></div>
                <div class="form-group"><label class="form-label">Expiry Date</label>
                  <input id="ph-expiry" type="date" class="form-control"></div>
                <div class="form-group"><label class="form-label">Supplier</label>
                  <input id="ph-supplier" class="form-control"></div>
                <div class="form-group"><label class="form-label">Purchase Price</label>
                  <input id="ph-cost" type="number" class="form-control" placeholder="0"></div>
                <div class="form-group"><label class="form-label">Selling Price</label>
                  <input id="ph-sell" type="number" class="form-control" placeholder="0"></div>
                <div class="form-group"><label class="form-label">Current Stock</label>
                  <input id="ph-stock" type="number" class="form-control" required></div>
                <div class="form-group"><label class="form-label">Reorder Level</label>
                  <input id="ph-reorder" type="number" class="form-control" value="10"></div>
              </div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">save</span> Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);

    UI.setupOtherSelect('ph-cat', 'cat-other-container', 'ph-cat-custom', 'Enter Custom Category...');
    UI.setupOtherSelect('ph-unit', 'unit-other-container', 'ph-unit-custom', 'Enter Custom Unit...');
  },

  async saveItem() {
    const catSelect = document.getElementById('ph-cat').value;
    const category = catSelect === 'Other' ? document.getElementById('ph-cat-custom').value : catSelect;

    const unitSelect = document.getElementById('ph-unit').value;
    const unit = unitSelect === 'Other' ? document.getElementById('ph-unit-custom').value : unitSelect;

    try {
      await DB.add('inventory', {
        itemName:      document.getElementById('ph-name').value,
        genericName:   document.getElementById('ph-generic').value,
        category,
        unit,
        batchNumber:   document.getElementById('ph-batch').value,
        expiryDate:    document.getElementById('ph-expiry').value,
        supplier:      document.getElementById('ph-supplier').value,
        purchasePrice: Number(document.getElementById('ph-cost').value) || 0,
        sellingPrice:  Number(document.getElementById('ph-sell').value) || 0,
        currentStock:  Number(document.getElementById('ph-stock').value) || 0,
        reorderLevel:  Number(document.getElementById('ph-reorder').value) || 10,
      });
      UI.closeModal();
      UI.showToast('Item saved to inventory', 'success');
      App.navigate('/pharmacy');
    } catch (e) { UI.showToast('Error: ' + e.message, 'error'); }
  },

  async showDispenseModal(itemId) {
    const item = await DB.get('inventory', itemId);
    if (!item) return;
    const patients = await DB.getAll('patients');
    const patOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');
    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Sell / Dispense — ${item.itemName}</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:1rem;color:var(--text-muted)">In Stock: <strong>${item.currentStock} ${item.unit}</strong></p>
            <form onsubmit="event.preventDefault(); PharmacyModule.dispense(${item.id})">
              <div class="form-group"><label class="form-label">Patient (Optional — leave empty for walk-in)</label>
                <select id="dp-patient" class="form-control">
                  <option value="">Walk-in Patient / Cash Sale</option>${patOptions}
                </select></div>
              <div class="form-group"><label class="form-label">Quantity to Sell <span class="required">*</span></label>
                <input id="dp-qty" type="number" min="1" max="${item.currentStock}" class="form-control" required></div>
              <div class="form-group"><label class="form-label">Dispensed By / Clerk</label>
                <input id="dp-by" class="form-control" placeholder="Pharmacist name"></div>
              <div class="form-group"><label class="form-label">Notes</label>
                <textarea id="dp-notes" class="form-control"></textarea></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <span class="material-icons-round">shopping_cart</span> Record Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async dispense(itemId) {
    const item = await DB.get('inventory', itemId);
    const qty  = Number(document.getElementById('dp-qty').value);
    const patientId = Number(document.getElementById('dp-patient').value) || null;
    if (!item || qty <= 0 || qty > item.currentStock) {
      return UI.showToast('Invalid quantity or insufficient stock', 'error');
    }

    try {
      const totalPrice = qty * Number(item.sellingPrice);

      // Add to sales logs
      await DB.add('dispensing', {
        itemId,
        itemName:    item.itemName,
        patientId,
        qty,
        dispensedBy: document.getElementById('dp-by').value || 'Pharmacy Counter',
        notes:       document.getElementById('dp-notes').value,
        unitPrice:   item.sellingPrice,
        totalPrice
      });

      // Deduct inventory stock automatically
      await DB.put('inventory', { ...item, currentStock: item.currentStock - qty });

      // If linked to a registered patient, update their bill invoice
      if (patientId) {
        const invoices = await DB.query('invoices', i => i.patientId === patientId && i.status !== 'paid');
        if (invoices.length > 0) {
          const activeInvoice = invoices[0];
          await DB.put('invoices', {
            ...activeInvoice,
            items: {
              ...activeInvoice.items,
              pharmacy: (Number(activeInvoice.items.pharmacy) || 0) + totalPrice
            },
            totalAmount: (Number(activeInvoice.totalAmount) || 0) + totalPrice,
            balance: (Number(activeInvoice.balance) || 0) + totalPrice
          });
        } else {
          // Create new invoice for pharmacy charge
          const invoiceNumber = 'INV-' + String(Date.now()).slice(-7);
          await DB.add('invoices', {
            invoiceNumber,
            patientId,
            items: { consultation: 0, pharmacy: totalPrice, lab: 0, admission: 0, procedure: 0 },
            discount: 0,
            insurance: 0,
            totalAmount: totalPrice,
            amountPaid: 0,
            balance: totalPrice,
            status: 'unpaid',
            paymentMethod: 'Cash',
            paymentDate: null,
            notes: `Direct drug purchase: ${item.itemName}`
          });
        }

        // Update patient's global balance
        const patient = await DB.get('patients', patientId);
        if (patient) {
          await DB.put('patients', {
            ...patient,
            outstandingBalance: (Number(patient.outstandingBalance) || 0) + totalPrice
          });
        }
      }

      UI.closeModal();
      UI.showToast(`Sold ${qty} × ${item.itemName} successfully`, 'success');
      App.navigate('/pharmacy');
    } catch (e) {
      UI.showToast('Error dispensing drug: ' + e.message, 'error');
    }
  },

  async showGlobalDispenseModal() {
    const inventory = await DB.getAll('inventory');
    if (inventory.length === 0) {
      return UI.showToast('Inventory is empty. Please add items first.', 'error');
    }
    const itemOptions = inventory.map(i =>
      `<option value="${i.id}">${i.itemName} (Stock: ${i.currentStock}) - ${UI.formatCurrency(i.sellingPrice)}</option>`).join('');
      
    const patients = await DB.getAll('patients');
    const patOptions = patients.map(p =>
      `<option value="${p.id}">${p.firstName} ${p.lastName} — ID: #${p.id}</option>`).join('');

    UI.openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Record Direct Drug Sale</span>
            <button class="modal-close" onclick="UI.closeModal()"><span class="material-icons-round">close</span></button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); PharmacyModule.globalDispense()">
              <div class="form-group"><label class="form-label">Drug / Item <span class="required">*</span></label>
                <select id="gdp-item" class="form-control" required>
                  <option value="" disabled selected>Select an item to sell...</option>
                  ${itemOptions}
                </select>
              </div>
              <div class="form-group"><label class="form-label">Patient (Optional — leave empty for walk-in)</label>
                <select id="gdp-patient" class="form-control">
                  <option value="">Walk-in Patient / Cash Sale</option>${patOptions}
                </select></div>
              <div class="form-group"><label class="form-label">Quantity to Sell <span class="required">*</span></label>
                <input id="gdp-qty" type="number" min="1" class="form-control" required></div>
              <div class="form-group"><label class="form-label">Dispensed By / Clerk</label>
                <input id="gdp-by" class="form-control" placeholder="Pharmacist name"></div>
              <div class="form-group"><label class="form-label">Notes</label>
                <textarea id="gdp-notes" class="form-control"></textarea></div>
              <div class="modal-footer" style="padding:0;margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" style="background:var(--success);border-color:var(--success)">
                  <span class="material-icons-round">point_of_sale</span> Complete Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
  },

  async globalDispense() {
    const itemId = Number(document.getElementById('gdp-item').value);
    if (!itemId) return UI.showToast('Please select an item', 'error');
    
    const qty = Number(document.getElementById('gdp-qty').value);
    const patientId = Number(document.getElementById('gdp-patient').value) || null;
    const dispensedBy = document.getElementById('gdp-by').value || 'Pharmacy Counter';
    const notes = document.getElementById('gdp-notes').value;

    const item = await DB.get('inventory', itemId);
    if (!item || qty <= 0 || qty > item.currentStock) {
      return UI.showToast('Invalid quantity or insufficient stock (' + (item ? item.currentStock : 0) + ' remaining)', 'error');
    }

    try {
      const totalPrice = qty * Number(item.sellingPrice);
      await DB.add('dispensing', {
        itemId, itemName: item.itemName, patientId, qty, dispensedBy, notes, unitPrice: item.sellingPrice, totalPrice
      });

      await DB.put('inventory', { ...item, currentStock: item.currentStock - qty });

      if (patientId) {
        const invoices = await DB.query('invoices', i => i.patientId === patientId && i.status !== 'paid');
        if (invoices.length > 0) {
          const activeInvoice = invoices[0];
          await DB.put('invoices', {
            ...activeInvoice,
            items: { ...activeInvoice.items, pharmacy: (Number(activeInvoice.items.pharmacy) || 0) + totalPrice },
            totalAmount: (Number(activeInvoice.totalAmount) || 0) + totalPrice,
            balance: (Number(activeInvoice.balance) || 0) + totalPrice
          });
        } else {
          await DB.add('invoices', {
            invoiceNumber: 'INV-' + String(Date.now()).slice(-7),
            patientId,
            items: { consultation: 0, pharmacy: totalPrice, lab: 0, admission: 0, procedure: 0 },
            discount: 0, insurance: 0, totalAmount: totalPrice, amountPaid: 0, balance: totalPrice,
            status: 'unpaid', paymentMethod: 'Cash', paymentDate: null, notes: `Direct drug purchase: ${item.itemName}`
          });
        }

        const patient = await DB.get('patients', patientId);
        if (patient) {
          await DB.put('patients', {
            ...patient, outstandingBalance: (Number(patient.outstandingBalance) || 0) + totalPrice
          });
        }
      }

      UI.closeModal();
      UI.showToast(`Sold ${qty} × ${item.itemName} successfully`, 'success');
      App.navigate('/pharmacy');
    } catch (e) {
      UI.showToast('Error dispensing drug: ' + e.message, 'error');
    }
  },

  async removeSale(id) {
    if (!UI.confirm('Delete/Cancel this sale? The quantity will be automatically returned to the inventory.')) return;
    try {
      const sale = await DB.get('dispensing', id);
      if (!sale) return;

      // 1. Return stock back to inventory automatically
      const item = await DB.get('inventory', sale.itemId);
      if (item) {
        await DB.put('inventory', {
          ...item,
          currentStock: item.currentStock + sale.qty
        });
      }

      // 2. Adjust patient's bill if linked to patient
      if (sale.patientId) {
        const invoices = await DB.query('invoices', i => i.patientId === sale.patientId && i.status !== 'paid');
        if (invoices.length > 0) {
          const invoice = invoices[0];
          const newPharmacyTotal = Math.max(0, (Number(invoice.items.pharmacy) || 0) - sale.totalPrice);
          const newTotalAmount = Math.max(0, (Number(invoice.totalAmount) || 0) - sale.totalPrice);
          const newBalance = Math.max(0, (Number(invoice.balance) || 0) - sale.totalPrice);
          await DB.put('invoices', {
            ...invoice,
            items: { ...invoice.items, pharmacy: newPharmacyTotal },
            totalAmount: newTotalAmount,
            balance: newBalance
          });
        }
        
        const patient = await DB.get('patients', sale.patientId);
        if (patient) {
          await DB.put('patients', {
            ...patient,
            outstandingBalance: Math.max(0, (Number(patient.outstandingBalance) || 0) - sale.totalPrice)
          });
        }
      }

      // 3. Delete dispensing log
      await DB.delete('dispensing', id);
      UI.showToast('Sale cancelled. Stock returned to inventory.', 'success');
      App.navigate('/pharmacy');
    } catch (e) {
      UI.showToast('Error: ' + e.message, 'error');
    }
  },

  async delete(id) {
    if (!UI.confirm('Delete this inventory item completely?')) return;
    await DB.delete('inventory', id);
    UI.showToast('Item deleted from catalog', 'warning');
    App.navigate('/pharmacy');
  }
};

window.PharmacyModule = PharmacyModule;
