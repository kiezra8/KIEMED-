# CliniFlow — Progressive Web App (PWA)

CliniFlow is a professional-grade, offline-first Hospital and Clinic Management System designed as a high-performance Progressive Web App (PWA). It runs directly in the browser on desktop, tablet, and mobile platforms, supporting standalone installation.

## 🚀 Key Features

*   **Responsive Clinical UI:** Premium Material 3 color system (Teals, Slates) with high-density layouts and native system dark/light mode support.
*   **Offline-First Architecture:** Complete data capture, modification, and query capabilities work 100% offline using a robust browser-based IndexedDB engine.
*   **Bidirectional Sync Engine:** Pre-configured to sync IndexedDB tables (patients, triage, EMR, billing, pharmacy, labs) bidirectionally with Cloud Firestore using server-side timestamps for conflict resolution when internet connection is active.
*   **Modules Included:**
    *   **Dashboard:** Live interactive statistics (admissions, today's revenue, low stock alerts, patient traffic).
    *   **Patient Registration & EMR:** Detailed clinical histories, allergies, demographics, and clinical timeline.
    *   **Triage & Vitals:** High-speed vital sign recording with automatic flagging of abnormal values.
    *   **Consultations:** SOAP Notes format clinical assessments with ICD-10 categorization.
    *   **Admissions & Ward/Bed Management:** Multi-ward occupancy monitoring, live interactive bed status grid.
    *   **Pharmacy Inventory & Dispense:** Real-time stock counts, reorder alerts, expiry indicators, and auto-deductions.
    *   **Laboratory:** Test ordering, reference ranges, and result management with abnormality flags.
    *   **Billing & Payments:** Complete receipting system with automated fee calculations and printable layout.
    *   **Staff & Duty Roster:** Profile management and shift allocation.
    *   **Appointments:** Scheduling calendar with live status updates.
    *   **Reports & CSV Export:** Excel-compatible data extraction for patients and invoices.
    *   **Settings:** Dark mode toggling, facility profile styling, and database reset.

---

## 🛠️ Project Structure

```
KIEMED/
├── index.html              # Main Single Page App (SPA) entry point & Firebase scripts
├── manifest.json           # PWA metadata for installation
├── sw.js                   # Service Worker (pre-caches views for offline launch)
├── css/
│   └── styles.css          # Design system, CSS variables, Dark Mode, animations
└── js/
    ├── app.js              # SPA Routing configuration
    ├── auth.js             # Authentication stub (bypassed for open clinical access)
    ├── db.js               # IndexedDB database definition (auto-creates schemas)
    ├── sync.js             # Firestore client-to-cloud sync engine
    ├── ui.js               # High-level layout widgets and toasts
    └── modules/            # Feature directories
        ├── dashboard.js
        ├── patient.js
        ├── triage.js
        ├── consultation.js
        ├── admissions.js
        ├── pharmacy.js
        ├── laboratory.js
        ├── billing.js
        └── staff_appts_reports.js
```

---

## 💻 Setup & First-Run Instructions

Because the application is built entirely on client-side Web Standard APIs (Vanilla HTML, CSS, JS, IndexedDB, Service Workers), it does not require a complex build system or compiler. 

### 1. Serve the application locally
To allow Service Workers and IndexedDB to initialize properly under standard security policies, serve the codebase directory from a local web server:

*   **Option A (Python 3):**
    ```bash
    python -m http.server 8000
    ```
    Then visit: `http://localhost:8000`

*   **Option B (Node.js / npm):**
    ```bash
    npx serve .
    ```
    Then visit: `http://localhost:3000`

*   **Option C (VS Code Extension):**
    Install **Live Server**, right-click `index.html` and select **"Open with Live Server"**.

### 2. Configure Firebase Sync (Optional)
If you want to sync your offline IndexedDB data with Cloud Firestore:
1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore** in test mode or with security rules matching those specified in `firestore.rules`.
3. In `index.html`, initialize the Firebase SDK by adding your configuration object inside a `<script>` tag before `js/app.js`:
    ```javascript
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
    firebase.initializeApp(firebaseConfig);
    ```
4. Once initialized, `js/sync.js` will automatically detect the Firebase instance and trigger live bidirectional sync.

---

## 📱 PWA Deployment & Installation

### Running on Mobile / Tablet
*   **Android:** Open the URL in Google Chrome, tap the **three dots menu**, and choose **"Install App"** or **"Add to Home screen"**.
*   **iOS:** Open the URL in Safari, tap the **Share button** (square with up arrow), and select **"Add to Home Screen"**.

### Hosting Online
To host this app for free:
*   **GitHub Pages:** Push this folder to a GitHub repository, enable GitHub Pages in settings, and select the master branch.
*   **Firebase Hosting:** Install `firebase-tools`, run `firebase init hosting` pointing to this directory, and run `firebase deploy`.
