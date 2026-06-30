// ─── CliniFlow SPA Router & Application ───
const App = {
  root: null,

  ROUTES: {
    '/dashboard':     { title: 'Dashboard',        module: () => DashboardModule.render() },
    '/patients':      { title: 'Patient Directory', module: () => PatientModule.render() },
    '/triage':        { title: 'Triage & Vitals',   module: () => TriageModule.render() },
    '/consultations': { title: 'Consultations',     module: () => ConsultationModule.render() },
    '/admissions':    { title: 'Admissions & Wards',module: () => AdmissionModule.render() },
    '/pharmacy':      { title: 'Pharmacy',          module: () => PharmacyModule.render() },
    '/laboratory':    { title: 'Laboratory',        module: () => LabModule.render() },
    '/billing':       { title: 'Billing & Payments',module: () => BillingModule.render() },
    '/staff':         { title: 'Staff Management',  module: () => StaffModule.render() },
    '/appointments':  { title: 'Appointments',      module: () => AppointmentModule.render() },
    '/reports':       { title: 'Reports & Analytics',module: () => ReportsModule.render() },
    '/settings':      { title: 'Settings',          module: () => Promise.resolve(SettingsModule.render()) },
  },

  async init() {
    this.root = document.getElementById('app-root');

    // Apply saved theme
    const savedTheme = localStorage.getItem('cf_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    try {
      await DB.init();
      SyncEngine.init();
    } catch (e) {
      this.root.innerHTML = `<div style="padding:2rem;color:var(--danger)">Failed to initialize database: ${e.message}</div>`;
      return;
    }

    // Render the shell layout
    this.root.innerHTML = UI.createLayout();

    // Listen for route changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Initial route
    const hash = window.location.hash.slice(1);
    if (!hash || hash === '/' || !(hash in this.ROUTES)) {
      window.location.hash = '/dashboard';
    } else {
      this.handleRoute();
    }
  },

  async handleRoute() {
    const route = window.location.hash.slice(1) || '/dashboard';
    const routeConfig = this.ROUTES[route];

    UI.updateNav(route);

    const content = document.getElementById('app-content');
    if (!content) return;

    content.innerHTML = `<div class="loader-wrap" style="height:300px"><div class="spinner"></div></div>`;

    if (!routeConfig) {
      content.innerHTML = `
        <div style="text-align:center;padding:4rem">
          <span class="material-icons-round" style="font-size:3rem;color:var(--text-light)">search_off</span>
          <h2 style="margin-top:1rem">Page Not Found</h2>
          <p style="color:var(--text-muted);margin-top:0.5rem">The route "${route}" doesn't exist.</p>
          <a href="#/dashboard" class="btn btn-primary" style="margin-top:1.5rem">Go to Dashboard</a>
        </div>`;
      return;
    }

    UI.setTitle(routeConfig.title);
    document.title = `${routeConfig.title} — CliniFlow`;

    try {
      const html = await routeConfig.module();
      content.innerHTML = html;
    } catch (e) {
      console.error('Route error:', e);
      content.innerHTML = `<div style="padding:2rem;color:var(--danger)">
        <strong>Error loading module:</strong> ${e.message}
      </div>`;
    }
  },

  navigate(path) {
    const targetHash = path.startsWith('#') ? path : '#' + path;
    if (window.location.hash === targetHash) {
      this.handleRoute(); // Force a re-render if already on the same route
    } else {
      window.location.hash = path;
    }
  },
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => App.init());
