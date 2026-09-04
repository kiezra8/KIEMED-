import { useState, useEffect } from 'react'
import {
  Pill, Plus, Search, AlertTriangle, CheckCircle2,
  Clock, PackageCheck, ShoppingCart, RefreshCw, Layers,
  ShoppingBag, DollarSign, User, Phone, Tag, Filter, Sparkles,
  Edit3, Trash2
} from 'lucide-react'
import { useClinicStore, useToastStore } from '../store'
import { localGetAll, localAdd, localPut, localDelete } from '../lib/db'
import Modal from '../components/ui/Modal'

// Comprehensive Uganda Ministry of Health (MOH) & UNMSHOP Drug Classes
export const DRUG_CATEGORIES = [
  'All Categories',
  'Antibiotics',
  'Antimalarials',
  'Analgesics & Antipyretics',
  'Antihypertensives',
  'Antidiabetics',
  'Antiretrovirals (ARVs)',
  'Antifungals',
  'Antiparasitics & Antihelminthics',
  'Antiepileptics & Neurological',
  'Antihistamines & Allergy',
  'Gastrointestinal',
  'Cardiovascular',
  'Respiratory & Bronchodilators',
  'Vitamins & Nutritional Supplements',
  'IV Fluids & Rehydration',
  'Pediatric Suspensions (IMNCI)',
  'Maternity & Obstetrics',
  'Dermatologicals & Topicals',
  'Ophthalmological (Eye Drops)',
  'Psychiatric & Psychotropic',
  'Vaccines & Immunologicals',
  'Surgical & Anaesthesia',
  'Medical Consumables',
  'Others',
]

export default function Pharmacy() {
  const { currentClinic } = useClinicStore()
  const { add: toast } = useToastStore()

  const [inventory, setInventory] = useState([])
  const [dispensingQueue, setDispensingQueue] = useState([])
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory' | 'dispensing' | 'direct_sales'
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [otcModalOpen, setOtcModalOpen] = useState(false)
  const [pharmacistName, setPharmacistName] = useState('Staff Pharmacist')

  // Direct OTC Pass-by Patient Sale Form
  const [otcForm, setOtcForm] = useState({
    customer_name: 'Walk-in Customer',
    customer_phone: '',
    drug_id: '',
    quantity: 1,
    payment_method: 'Cash',
    notes: '',
  })

  // New Drug Inventory Form
  const [newDrug, setNewDrug] = useState({
    name: '',
    category: 'Antibiotics',
    unit: 'Tablets',
    current_stock: '',
    reorder_level: '20',
    unit_price: '',
    supplier: 'National Medical Stores (NMS) / JMS',
    expiry_date: '',
  })
  const [customCategory, setCustomCategory] = useState('')

  // Edit Medicine State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDrug, setEditingDrug] = useState(null)
  const [editCustomCategory, setEditCustomCategory] = useState('')

  // Delete Medicine State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingDrug, setDeletingDrug] = useState(null)

  useEffect(() => {
    loadData()
    const handleDataChange = (e) => {
      if (['inventory', 'dispensing', 'invoices'].includes(e.detail?.table)) {
        loadData()
      }
    }
    window.addEventListener('kiemed-data-change', handleDataChange)
    return () => window.removeEventListener('kiemed-data-change', handleDataChange)
  }, [currentClinic?.id])

  const loadData = async () => {
    if (!currentClinic?.id) return
    const [inv, disp] = await Promise.all([
      localGetAll('inventory', currentClinic.id),
      localGetAll('dispensing', currentClinic.id),
    ])

    // Clean load: no auto-seeding dummy records as requested by user
    setInventory(inv || [])
    setDispensingQueue(disp || [])
  }

  const handleAddDrug = async (e) => {
    e.preventDefault()
    if (!newDrug.name.trim() || !newDrug.current_stock) {
      toast('Please enter medicine name and stock quantity', 'warning')
      return
    }

    const finalCategory = newDrug.category === 'Others'
      ? (customCategory.trim() || 'Others')
      : newDrug.category

    try {
      await localAdd('inventory', {
        ...newDrug,
        name: newDrug.name.trim(),
        category: finalCategory,
        current_stock: parseInt(newDrug.current_stock) || 0,
        reorder_level: parseInt(newDrug.reorder_level) || 10,
        unit_price: parseFloat(newDrug.unit_price) || 0,
      }, currentClinic.id)

      toast(`Added ${newDrug.name} to pharmacy inventory`, 'success')
      setModalOpen(false)
      setNewDrug({
        name: '',
        category: 'Antibiotics',
        unit: 'Tablets',
        current_stock: '',
        reorder_level: '20',
        unit_price: '',
        supplier: 'National Medical Stores (NMS) / JMS',
        expiry_date: '',
      })
      setCustomCategory('')
      loadData()
    } catch (err) {
      toast('Failed to add medicine: ' + err.message, 'error')
    }
  }

  // Open Edit Medicine Modal
  const handleOpenEdit = (drug) => {
    const isCustomCat = !DRUG_CATEGORIES.includes(drug.category) || drug.category === 'Others'
    setEditingDrug({
      ...drug,
      category: isCustomCat ? 'Others' : drug.category,
      current_stock: String(drug.current_stock ?? ''),
      reorder_level: String(drug.reorder_level ?? '10'),
      unit_price: String(drug.unit_price ?? ''),
    })
    setEditCustomCategory(isCustomCat ? drug.category : '')
    setEditModalOpen(true)
  }

  // Save Edited Medicine
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingDrug || !editingDrug.name.trim()) {
      toast('Please enter medicine name', 'warning')
      return
    }

    const finalCategory = editingDrug.category === 'Others'
      ? (editCustomCategory.trim() || 'Others')
      : editingDrug.category

    try {
      const updated = {
        ...editingDrug,
        name: editingDrug.name.trim(),
        category: finalCategory,
        current_stock: parseInt(editingDrug.current_stock) || 0,
        reorder_level: parseInt(editingDrug.reorder_level) || 10,
        unit_price: parseFloat(editingDrug.unit_price) || 0,
      }

      await localPut('inventory', updated)
      toast(`Updated ${updated.name} successfully`, 'success')
      setEditModalOpen(false)
      setEditingDrug(null)
      loadData()
    } catch (err) {
      toast('Failed to update medicine: ' + err.message, 'error')
    }
  }

  // Open Delete Confirmation Modal
  const handleOpenDelete = (drug) => {
    setDeletingDrug(drug)
    setDeleteModalOpen(true)
  }

  // Confirm Delete Medicine
  const handleConfirmDelete = async () => {
    if (!deletingDrug) return
    try {
      await localDelete('inventory', deletingDrug.id)
      toast(`Deleted "${deletingDrug.name}" from pharmacy stock`, 'success')
      setDeleteModalOpen(false)
      setDeletingDrug(null)
      loadData()
    } catch (err) {
      toast('Failed to delete medicine: ' + err.message, 'error')
    }
  }

  // Handle Direct OTC Pass-by Patient Sale
  const handleOtcSale = async (e) => {
    e.preventDefault()
    if (!otcForm.drug_id) {
      toast('Please select a medicine to sell', 'warning')
      return
    }

    const drug = inventory.find(d => d.id === otcForm.drug_id)
    if (!drug) {
      toast('Selected medicine was not found', 'error')
      return
    }

    const qty = parseInt(otcForm.quantity) || 1
    if (qty <= 0) {
      toast('Quantity must be at least 1', 'warning')
      return
    }

    if (qty > drug.current_stock) {
      toast(`Insufficient stock. Only ${drug.current_stock} ${drug.unit} available in stock.`, 'error')
      return
    }

    const unitPrice = Number(drug.unit_price) || 0
    const total = qty * unitPrice

    try {
      // 1. Deduct Stock immediately
      const newStock = drug.current_stock - qty
      await localPut('inventory', {
        ...drug,
        current_stock: newStock,
      })

      // 2. Log in Dispensing with direct_sale flag
      await localAdd('dispensing', {
        patient_id: null,
        patient_name: otcForm.customer_name || 'Walk-in Customer',
        customer_phone: otcForm.customer_phone || '',
        items: `${drug.name} (x${qty} ${drug.unit})`,
        is_direct_sale: true,
        status: 'dispensed',
        dispensed_by: pharmacistName,
        dispensed_at: new Date().toISOString(),
        total_amount: total,
      }, currentClinic.id)

      // 3. Create invoice tagged specifically as OTC / Direct Pharmacy Sale
      await localAdd('invoices', {
        patient_id: null,
        patient_name: otcForm.customer_name || 'Walk-in Customer',
        customer_phone: otcForm.customer_phone || '',
        category: 'OTC / Direct Drug Sale',
        description: `Direct OTC Sale: ${drug.name} (x${qty} ${drug.unit})`,
        amount_due: total,
        amount_paid: total,
        balance: 0,
        payment_method: otcForm.payment_method,
        status: 'Paid',
        is_direct_sale: true,
      }, currentClinic.id)

      toast(`Direct OTC sale finalized! Collected UGX ${total.toLocaleString()}`, 'success')
      setOtcModalOpen(false)
      setOtcForm({
        customer_name: 'Walk-in Customer',
        customer_phone: '',
        drug_id: '',
        quantity: 1,
        payment_method: 'Cash',
        notes: '',
      })
      loadData()
    } catch (err) {
      toast('Error processing direct sale: ' + err.message, 'error')
    }
  }

  const handleDispense = async (item) => {
    try {
      await localPut('dispensing', {
        ...item,
        status: 'dispensed',
        dispensed_by: pharmacistName,
        dispensed_at: new Date().toISOString(),
      })

      await localAdd('invoices', {
        patient_id: item.patient_id,
        patient_name: item.patient_name,
        category: 'Inpatient / OPD Prescription',
        description: `Prescription Dispensed: ${item.items || 'Medications'}`,
        amount_due: 15000,
        amount_paid: 15000,
        balance: 0,
        payment_method: 'Cash / Mobile Money',
        status: 'Paid',
        is_direct_sale: false,
      }, currentClinic.id)

      toast(`Medications dispensed to ${item.patient_name}`, 'success')
      loadData()
    } catch (err) {
      toast('Failed to dispense: ' + err.message, 'error')
    }
  }

  // Filtering: by category and text search
  const filteredInventory = inventory.filter(i => {
    const matchesSearch =
      (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (selectedCategory === 'All Categories') return true
    if (selectedCategory === 'Others') {
      const standardCats = DRUG_CATEGORIES.filter(c => c !== 'All Categories' && c !== 'Others')
      return !standardCats.includes(i.category) || i.category === 'Others'
    }
    return (i.category || '').toLowerCase() === selectedCategory.toLowerCase()
  })

  // Category counts
  const categoryCounts = inventory.reduce((acc, item) => {
    const cat = item.category || 'Others'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const pendingDispensing = dispensingQueue.filter(d => d.status === 'pending' && !d.is_direct_sale)
  const directSalesHistory = dispensingQueue.filter(d => d.is_direct_sale).reverse()

  const selectedOtcDrug = inventory.find(d => d.id === otcForm.drug_id)
  const otcCalculatedTotal = selectedOtcDrug
    ? (parseInt(otcForm.quantity) || 1) * (Number(selectedOtcDrug.unit_price) || 0)
    : 0

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
            Pharmacy & Drug Dispensing Unit
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Category-organized stock inventory, direct pass-by sales & clinic prescription fulfillment
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Direct OTC Sale Button */}
          <button
            onClick={() => setOtcModalOpen(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              borderColor: '#0284c7'
            }}
          >
            <ShoppingBag size={16} />
            <span>Direct OTC / Pass-by Drug Sale</span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Layers size={16} />
          <span>Stock Inventory ({inventory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dispensing')}
          className={`btn ${activeTab === 'dispensing' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ShoppingCart size={16} />
          <span>Prescriptions Queue ({pendingDispensing.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('direct_sales')}
          className={`btn ${activeTab === 'direct_sales' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ShoppingBag size={16} />
          <span>Direct Pass-by Sales ({directSalesHistory.length})</span>
        </button>
      </div>

      {activeTab === 'inventory' ? (
        <div>
          {/* Search + Category Browser Header */}
          <div style={{
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={16} style={{ color: 'var(--brand)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Select Drug Class / Category:</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap any category to filter medicines</span>
              </div>

              {/* Search bar */}
              <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search medicine name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2rem', height: 36, fontSize: '0.813rem' }}
                />
              </div>
            </div>

            {/* Category Pills Slider */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              scrollbarWidth: 'thin'
            }}>
              {DRUG_CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat
                const count = cat === 'All Categories'
                  ? inventory.length
                  : cat === 'Others'
                    ? (categoryCounts['Others'] || 0)
                    : (categoryCounts[cat] || 0)

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '6px 12px',
                      borderRadius: 20,
                      border: `1px solid ${isSelected ? 'var(--brand)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--brand)' : 'var(--surface-1)',
                      color: isSelected ? '#fff' : 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{cat}</span>
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: '0.7rem',
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                      color: isSelected ? '#fff' : 'var(--text-muted)'
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Medicines Table */}
          <div style={{
            background: 'var(--card-bg, var(--surface-1))',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Medicine Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Drug Category</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Stock Level</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Unit Price (UGX)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Expiry Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>💊</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No medicines found in this category</div>
                      <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.813rem' }}>
                        {inventory.length === 0
                          ? 'Your pharmacy inventory is clean. Click "Add Medicine" to register medications into stock.'
                          : `No medications matching "${selectedCategory}" or search query.`}
                      </p>
                      <button
                        onClick={() => {
                          setNewDrug(d => ({ ...d, category: selectedCategory === 'All Categories' ? 'Antibiotics' : selectedCategory }))
                          setModalOpen(true)
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={14} /> Add Medicine to {selectedCategory === 'All Categories' ? 'Inventory' : selectedCategory}
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map(item => {
                    const isLow = item.current_stock <= (item.reorder_level || 20)
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                          <div>{item.name}</div>
                          {item.supplier && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supplier: {item.supplier}</span>}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(13, 148, 136, 0.1)',
                            color: 'var(--brand)',
                            fontSize: '0.78rem',
                            fontWeight: 600
                          }}>
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                          {item.current_stock} {item.unit}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--brand)', fontWeight: 700 }}>
                          UGX {Number(item.unit_price || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {item.expiry_date || 'N/A'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {item.current_stock <= 0 ? (
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <AlertTriangle size={12} /> Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <AlertTriangle size={12} /> Low Stock
                            </span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => {
                                setOtcForm(prev => ({ ...prev, drug_id: item.id }))
                                setOtcModalOpen(true)
                              }}
                              className="btn btn-secondary btn-sm"
                              disabled={item.current_stock <= 0}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.75rem' }}
                              title="Sell OTC"
                            >
                              <ShoppingBag size={12} />
                              <span>Sell OTC</span>
                            </button>

                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.75rem' }}
                              title="Edit drug details & stock"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="btn btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: 'var(--danger, #ef4444)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                cursor: 'pointer'
                              }}
                              title="Delete drug from catalog"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'dispensing' ? (
        /* Dispensing Queue */
        <div style={{
          background: 'var(--card-bg, var(--surface-1))',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
            Clinic Doctor Prescriptions Pending Fulfillment ({pendingDispensing.length})
          </div>

          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Patient Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Prescribed Drugs</th>
                <th style={{ padding: '0.85rem 1rem' }}>Time Ordered</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Dispense</th>
              </tr>
            </thead>
            <tbody>
              {pendingDispensing.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No pending doctor prescriptions waiting in queue.
                  </td>
                </tr>
              ) : (
                pendingDispensing.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{item.patient_name}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem' }}>{item.items || 'Standard prescription'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {item.created_at?.slice(11, 16)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDispense(item)}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <PackageCheck size={14} />
                        <span>Dispense</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Direct OTC Pass-by Sales Log */
        <div style={{
          background: 'var(--card-bg, var(--surface-1))',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Direct Pass-by / OTC Patient Drug Sales ({directSalesHistory.length})</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--brand)', fontWeight: 700 }}>
              Total Revenue: UGX {directSalesHistory.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0).toLocaleString()}
            </span>
          </div>

          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Customer / Buyer</th>
                <th style={{ padding: '0.85rem 1rem' }}>Medication Sold</th>
                <th style={{ padding: '0.85rem 1rem' }}>Amount Collected</th>
                <th style={{ padding: '0.85rem 1rem' }}>Dispensed By</th>
                <th style={{ padding: '0.85rem 1rem' }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {directSalesHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No direct walk-in sales recorded yet. Click "Direct OTC / Pass-by Drug Sale" above to sell.
                  </td>
                </tr>
              ) : (
                directSalesHistory.map(sale => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      <div>{sale.patient_name || 'Walk-in Customer'}</div>
                      {sale.customer_phone && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sale.customer_phone}</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{sale.items}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--brand)' }}>
                      UGX {Number(sale.total_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {sale.dispensed_by || 'Staff Pharmacist'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {sale.dispensed_at?.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DIRECT OTC / PASS-BY PATIENT SALE MODAL */}
      {otcModalOpen && (
        <Modal title="Direct OTC / Pass-by Patient Drug Sale" onClose={() => setOtcModalOpen(false)}>
          <form onSubmit={handleOtcSale} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(2, 132, 199, 0.1)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
              color: '#38bdf8'
            }}>
              Direct sale for walk-in or pass-by patients without an OPD file. Revenue will be recorded under OTC Drug Sales and automatically computed in total revenue.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Buyer / Patient Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Walk-in Customer or Patient Name"
                  value={otcForm.customer_name}
                  onChange={(e) => setOtcForm({ ...otcForm, customer_name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 700 000 000"
                  value={otcForm.customer_phone}
                  onChange={(e) => setOtcForm({ ...otcForm, customer_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Select Medicine to Dispense *</label>
              <select
                className="input"
                required
                value={otcForm.drug_id}
                onChange={(e) => setOtcForm({ ...otcForm, drug_id: e.target.value })}
              >
                <option value="">-- Choose Medication from Inventory --</option>
                {inventory.map(d => (
                  <option key={d.id} value={d.id} disabled={d.current_stock <= 0}>
                    {d.name} &middot; ({d.category}) &middot; Stock: {d.current_stock} {d.unit} &middot; UGX {Number(d.unit_price || 0).toLocaleString()} {d.current_stock <= 0 ? '(Out of Stock)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Quantity to Sell *</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  required
                  value={otcForm.quantity}
                  onChange={(e) => setOtcForm({ ...otcForm, quantity: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Payment Mode *</label>
                <select
                  className="input"
                  value={otcForm.payment_method}
                  onChange={(e) => setOtcForm({ ...otcForm, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash (UGX)</option>
                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Bank Card / POS">Bank Card / POS</option>
                </select>
              </div>
            </div>

            {/* Calculated Total Price Card */}
            <div style={{
              background: 'var(--surface-2)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Amount to Collect:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand)' }}>
                  UGX {otcCalculatedTotal.toLocaleString()}
                </div>
              </div>
              <span className="badge badge-primary" style={{ padding: '0.4rem 0.75rem' }}>
                {otcForm.payment_method}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOtcModalOpen(false)}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedOtcDrug || selectedOtcDrug.current_stock < (parseInt(otcForm.quantity) || 1)}
              >
                Confirm Sale & Dispense
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Medicine Modal */}
      {modalOpen && (
        <Modal title="Add New Medicine to Stock" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleAddDrug} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Drug / Medicine Name *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Coartem 20/120mg or Ciprofloxacin 500mg"
                value={newDrug.name}
                onChange={(e) => setNewDrug({ ...newDrug, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Drug Category / Class *</label>
                <select
                  className="input"
                  value={newDrug.category}
                  onChange={(e) => setNewDrug({ ...newDrug, category: e.target.value })}
                >
                  {DRUG_CATEGORIES.filter(c => c !== 'All Categories').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Packaging Unit</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Tablets, Vials, Bottles, Strips"
                  value={newDrug.unit}
                  onChange={(e) => setNewDrug({ ...newDrug, unit: e.target.value })}
                />
              </div>
            </div>

            {/* Custom Category input if Others is chosen */}
            {newDrug.category === 'Others' && (
              <div style={{
                background: 'rgba(13, 148, 136, 0.08)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--brand)'
              }}>
                <label className="label" style={{ color: 'var(--brand)', fontWeight: 700 }}>
                  Enter Custom Category Name *
                </label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Antidotes, Dialysis Solutions, Dental..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  style={{ background: 'var(--surface-1)' }}
                />
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  This category will be saved and displayed with this drug.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Initial Stock Quantity *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  placeholder="100"
                  value={newDrug.current_stock}
                  onChange={(e) => setNewDrug({ ...newDrug, current_stock: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Reorder Warning Level</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="20"
                  value={newDrug.reorder_level}
                  onChange={(e) => setNewDrug({ ...newDrug, reorder_level: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Unit Selling Price (UGX) *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  placeholder="1500"
                  value={newDrug.unit_price}
                  onChange={(e) => setNewDrug({ ...newDrug, unit_price: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Expiry Date</label>
                <input
                  type="date"
                  className="input"
                  value={newDrug.expiry_date}
                  onChange={(e) => setNewDrug({ ...newDrug, expiry_date: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Supplier / Source</label>
                <input
                  type="text"
                  className="input"
                  placeholder="NMS, JMS, Private Distributor"
                  value={newDrug.supplier}
                  onChange={(e) => setNewDrug({ ...newDrug, supplier: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save to Stock</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Medicine Modal */}
      {editModalOpen && editingDrug && (
        <Modal title={`Edit Medicine: ${editingDrug.name}`} onClose={() => { setEditModalOpen(false); setEditingDrug(null) }}>
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
            <div>
              <label className="label">Medicine / Drug Name *</label>
              <input
                type="text"
                className="input"
                required
                value={editingDrug.name}
                onChange={(e) => setEditingDrug({ ...editingDrug, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label">Category / Drug Class *</label>
                <select
                  className="input"
                  value={editingDrug.category}
                  onChange={(e) => setEditingDrug({ ...editingDrug, category: e.target.value })}
                >
                  {DRUG_CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Unit / Packaging</label>
                <input
                  type="text"
                  className="input"
                  value={editingDrug.unit || 'Tablets'}
                  onChange={(e) => setEditingDrug({ ...editingDrug, unit: e.target.value })}
                />
              </div>
            </div>

            {/* Custom Category input if Others */}
            {editingDrug.category === 'Others' && (
              <div style={{
                background: 'rgba(13, 148, 136, 0.08)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--brand)'
              }}>
                <label className="label" style={{ color: 'var(--brand)', fontWeight: 700 }}>
                  Custom Category Name *
                </label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Antidotes, Dental, Infusions"
                  value={editCustomCategory}
                  onChange={(e) => setEditCustomCategory(e.target.value)}
                  style={{ background: 'var(--surface-1)' }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Current Stock Quantity *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  value={editingDrug.current_stock}
                  onChange={(e) => setEditingDrug({ ...editingDrug, current_stock: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Reorder Alert Level</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={editingDrug.reorder_level}
                  onChange={(e) => setEditingDrug({ ...editingDrug, reorder_level: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Unit Price (UGX) *</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  required
                  value={editingDrug.unit_price}
                  onChange={(e) => setEditingDrug({ ...editingDrug, unit_price: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="label">Expiry Date</label>
                <input
                  type="date"
                  className="input"
                  value={editingDrug.expiry_date || ''}
                  onChange={(e) => setEditingDrug({ ...editingDrug, expiry_date: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Supplier / Source</label>
                <input
                  type="text"
                  className="input"
                  value={editingDrug.supplier || ''}
                  onChange={(e) => setEditingDrug({ ...editingDrug, supplier: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditModalOpen(false); setEditingDrug(null) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && deletingDrug && (
        <Modal title={`Delete Medicine: ${deletingDrug.name}`} onClose={() => { setDeleteModalOpen(false); setDeletingDrug(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                Are you sure you want to delete this medicine?
              </div>
            </div>

            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
              You are about to permanently remove <strong>"{deletingDrug.name}"</strong> ({deletingDrug.category}, Current Stock: {deletingDrug.current_stock} {deletingDrug.unit}) from your pharmacy inventory and cloud records across all devices.
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDeleteModalOpen(false); setDeletingDrug(null) }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                style={{ background: 'var(--danger, #ef4444)', color: '#fff' }}
              >
                Delete Medicine
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
