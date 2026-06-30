// ─── CliniFlow Local Database (IndexedDB) ───
const DB_NAME = 'CliniFlowDB';
const DB_VERSION = 3;

const STORES = [
  { name: 'patients',     keyPath: 'id' },
  { name: 'consultations',keyPath: 'id' },
  { name: 'vitals',       keyPath: 'id' },
  { name: 'admissions',   keyPath: 'id' },
  { name: 'inventory',    keyPath: 'id' },
  { name: 'dispensing',   keyPath: 'id' },
  { name: 'lab_requests', keyPath: 'id' },
  { name: 'invoices',     keyPath: 'id' },
  { name: 'staff',        keyPath: 'id' },
  { name: 'appointments', keyPath: 'id' },
  { name: 'audit_logs',   keyPath: 'id' },
  { name: 'beds',         keyPath: 'id' },
];

class LocalDB {
  constructor() { this.db = null; }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(({ name, keyPath }) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath, autoIncrement: true });
            store.createIndex('syncStatus', 'syncStatus', { unique: false });
            if (name !== 'audit_logs') {
              store.createIndex('firestoreId', 'firestoreId', { unique: false });
            }
          }
        });
      };
    });
  }

  _tx(store, mode = 'readonly') {
    return this.db.transaction([store], mode).objectStore(store);
  }

  add(storeName, data) {
    return new Promise((resolve, reject) => {
      const record = {
        ...data,
        syncStatus: 'pending',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const req = this._tx(storeName, 'readwrite').add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  put(storeName, data) {
    return new Promise((resolve, reject) => {
      const record = { ...data, syncStatus: 'pending', updatedAt: new Date().toISOString() };
      const req = this._tx(storeName, 'readwrite').put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror  = () => reject(req.error);
    });
  }

  get(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror  = () => reject(req.error);
    });
  }

  query(storeName, filterFn) {
    return this.getAll(storeName).then(all => all.filter(filterFn));
  }

  // Log to audit_logs (append-only)
  audit(action, entity, before, after, userId = 'system') {
    return this.add('audit_logs', {
      action, entity, before: JSON.stringify(before),
      after: JSON.stringify(after), userId,
      timestamp: new Date().toISOString(),
    });
  }
}

window.DB = new LocalDB();
