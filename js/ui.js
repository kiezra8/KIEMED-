// ─── CliniFlow UI Utilities ───
const UI = {

  // ── Toast notifications ──
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="material-icons-round">${icons[type] || 'info'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ── Confirm dialog ──
  confirm(message) {
    return window.confirm(message);
  },

  // ── Modal helpers ──
  openModal(html) {
    document.getElementById('modal-root').innerHTML = html;
  },
  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },

  // ── Main app layout ──
  createLayout() {
    const navItems = [
      { route: '/dashboard',    label: 'Dashboard',   icon: 'dashboard' },
      { route: '/patients',     label: 'Patients',    icon: 'people' },
      { route: '/triage',       label: 'Triage',      icon: 'monitor_heart' },
      { route: '/consultations',label: 'Consultations',icon: 'medical_services' },
      { route: '/admissions',   label: 'Admissions',  icon: 'bed' },
      { route: '/pharmacy',     label: 'Pharmacy',    icon: 'local_pharmacy' },
      { route: '/laboratory',   label: 'Laboratory',  icon: 'science' },
      { route: '/billing',      label: 'Billing',     icon: 'receipt_long' },
      { route: '/staff',        label: 'Staff',       icon: 'badge' },
      { route: '/appointments', label: 'Appointments',icon: 'event' },
      { route: '/reports',      label: 'Reports',     icon: 'bar_chart' },
      { route: '/settings',     label: 'Settings',    icon: 'settings' },
    ];

    const navHTML = navItems.map(n => `
      <div class="nav-item">
        <a class="nav-link" href="#${n.route}" data-route="${n.route}" onclick="UI._closeDrawer()">
          <span class="material-icons-round">${n.icon}</span>
          ${n.label}
        </a>
      </div>
    `).join('');

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon"><span class="material-icons-round" style="font-size:1.1rem;">local_hospital</span></div>
          <div>
            <div class="brand-text">CliniFlow</div>
            <div class="brand-sub">HMS</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Navigation</div>
          ${navHTML}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">CF</div>
            <div class="user-info">
              <div class="user-name">CliniFlow Admin</div>
              <div class="user-role">Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      <main class="app-main">
        <header class="app-header">
          <div class="header-left">
            <button class="icon-btn" id="menu-toggle" onclick="UI._toggleDrawer()" title="Menu">
              <span class="material-icons-round">menu</span>
            </button>
            <div>
              <div class="header-title" id="header-title">Dashboard</div>
            </div>
          </div>
          <div class="header-right">
            <div class="header-search">
              <span class="material-icons-round">search</span>
              <input type="text" placeholder="Search patients, records…" id="global-search">
            </div>
            <button class="icon-btn" onclick="UI._toggleTheme()" title="Toggle dark mode">
              <span class="material-icons-round">dark_mode</span>
            </button>
          </div>
        </header>
        <div class="app-content" id="app-content">
          <div class="loader-wrap"><div class="spinner"></div></div>
        </div>
      </main>

      <div id="modal-root"></div>
    `;
  },

  updateNav(route) {
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-route') === route);
    });
  },

  setTitle(title) {
    const el = document.getElementById('header-title');
    if (el) el.textContent = title;
  },

  setContent(html) {
    const el = document.getElementById('app-content');
    if (el) el.innerHTML = html;
  },

  _toggleDrawer() {
    document.getElementById('app-sidebar').classList.toggle('open');
  },
  _closeDrawer() {
    document.getElementById('app-sidebar').classList.remove('open');
  },
  _toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    localStorage.setItem('cf_theme', dark ? 'light' : 'dark');
  },

  // ── Helpers ──
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  },
  formatCurrency(n) {
    return 'UgShs ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },
  pillStatus(status) {
    const map = {
      pending:    'pill pill-amber',
      active:     'pill pill-teal',
      discharged: 'pill pill-gray',
      paid:       'pill pill-green',
      unpaid:     'pill pill-red',
      partial:    'pill pill-amber',
      synced:     'pill pill-green',
      low:        'pill pill-red',
      normal:     'pill pill-teal',
      critical:   'pill pill-red',
    };
    return `<span class="${map[status] || 'pill pill-gray'}">${status}</span>`;
  },

  setupOtherSelect(selectId, inputContainerId, inputId, placeholder = "Please specify...") {
    const select = document.getElementById(selectId);
    const container = document.getElementById(inputContainerId);
    if (!select || !container) return;
    
    const checkValue = () => {
      if (select.value === 'Other') {
        container.innerHTML = `<input id="${inputId}" class="form-control" placeholder="${placeholder}" required style="margin-top: 0.5rem;">`;
      } else {
        container.innerHTML = '';
      }
    };
    
    select.addEventListener('change', checkValue);
    checkValue();
  }
};

window.UI = UI;
