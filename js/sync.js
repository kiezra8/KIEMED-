// ─── CliniFlow Bidirectional Sync Engine ───
const SyncEngine = {
  isOnline: navigator.onLine,
  facilityId: 'fac-default', // Default facility scoping since Auth is open-access

  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      UI.showToast('Back online. Syncing pending data...', 'success');
      this.flushPending();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      UI.showToast('Offline mode. Changes saved locally.', 'error');
    });

    // Check online status and start synchronization
    if (this.isOnline) {
      this.flushPending();
      this.startListening();
    }
  },

  isFirebaseConfigured() {
    return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
  },

  async flushPending() {
    if (!this.isOnline) return;
    if (!this.isFirebaseConfigured()) {
      console.log('Firebase not configured yet. Offline-first data is securely stored in IndexedDB.');
      return;
    }

    const db = firebase.firestore();
    const stores = [
      'patients', 'consultations', 'vitals', 'admissions', 
      'inventory', 'dispensing', 'lab_requests', 'invoices', 
      'staff', 'appointments', 'beds'
    ];

    console.log('Flushing pending records to Firestore...');
    for (const storeName of stores) {
      try {
        // Query IndexedDB for records with syncStatus = 'pending'
        const pendingRecords = await DB.query(storeName, r => r.syncStatus === 'pending');
        for (const record of pendingRecords) {
          const docId = record.firestoreId || db.collection('dummy').doc().id;
          
          // Prepare clean document for firestore
          const uploadData = { ...record };
          delete uploadData.id;
          delete uploadData.syncStatus;
          uploadData.firestoreId = docId;
          uploadData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

          // Write to Firestore under the facility path
          await db.collection('facilities')
            .doc(this.facilityId)
            .collection(storeName)
            .doc(docId)
            .set(uploadData, { merge: true });

          // Update local IndexedDB syncStatus
          await DB.put(storeName, {
            ...record,
            firestoreId: docId,
            syncStatus: 'synced',
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Failed to sync store ${storeName}:`, err);
      }
    }
  },

  startListening() {
    if (!this.isOnline || !this.isFirebaseConfigured()) return;

    const db = firebase.firestore();
    const stores = [
      'patients', 'consultations', 'vitals', 'admissions', 
      'inventory', 'dispensing', 'lab_requests', 'invoices', 
      'staff', 'appointments', 'beds'
    ];

    stores.forEach(storeName => {
      db.collection('facilities')
        .doc(this.facilityId)
        .collection(storeName)
        .onSnapshot(async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added' || change.type === 'modified') {
              const remoteData = change.doc.data();
              const firestoreId = change.doc.id;

              // Check if local copy exists
              const localMatch = await DB.query(storeName, r => r.firestoreId === firestoreId);
              
              if (localMatch.length > 0) {
                const localRecord = localMatch[0];
                // Simple conflict resolution: Remote server wins if local record is not dirty/pending
                if (localRecord.syncStatus !== 'pending') {
                  const updatedRecord = {
                    ...localRecord,
                    ...remoteData,
                    syncStatus: 'synced'
                  };
                  await DB.put(storeName, updatedRecord);
                }
              } else {
                // New record from server: add to local IndexedDB
                const newRecord = {
                  ...remoteData,
                  firestoreId,
                  syncStatus: 'synced'
                };
                await DB.add(storeName, newRecord);
              }
            }
          }
        }, err => {
          console.warn(`Firestore listener error on ${storeName}:`, err);
        });
    });
  }
};

window.SyncEngine = SyncEngine;
