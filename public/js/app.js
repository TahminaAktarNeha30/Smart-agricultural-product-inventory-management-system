// public/js/app.js
// PRESENTATION LAYER - main controller of the browser app.
// Jobs: login / logout, remember who is logged in, show the right menu tabs,
//       and send every request to the backend with the login token.

const App = {
  token: null,        // login token received from the server
  currentUser: null,  // { fullName, role, ... } of the logged-in person
  currentRole: null,  // 'Farm Manager' | 'Warehouse Officer' | 'Distributor'
  officerName: '',    // full name of the logged-in person

  // ---------------------------------------------------------------- start
  async init() {
    this.bindEvents();

    // After a page refresh, check if the saved token is still valid
    const savedToken = sessionStorage.getItem('agriToken');
    if (savedToken) {
      this.token = savedToken;
      try {
        const res = await this.apiRequest('/api/auth/me');
        this.startSession(res.data);
        return;
      } catch (err) {
        this.clearSession();
      }
    }
    this.showLoginScreen();
  },

  bindEvents() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });

    // Toggle password visibility (Show / Hide)
    const togglePassBtn = document.getElementById('togglePasswordBtn');
    const passInput = document.getElementById('loginPassword');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          togglePassBtn.textContent = 'Hide';
        } else {
          passInput.type = 'password';
          togglePassBtn.textContent = 'Show';
        }
      });
    }

    // "Demo accounts" links fill the login form
    document.querySelectorAll('.demo-fill').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginUsername').value = link.dataset.user;
        document.getElementById('loginPassword').value = link.dataset.pass;
      });
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.showSection(tab.getAttribute('data-target'));
      });
    });
  },

  // ---------------------------------------------------------------- login / logout
  async login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await this.apiRequest('/api/auth/login', 'POST', { username, password });
      this.token = res.data.token;
      sessionStorage.setItem('agriToken', this.token);
      this.startSession(res.data.user);
    } catch (err) {
      this.showLoginError(err.message);
    }
  },

  async logout() {
    try {
      await this.apiRequest('/api/auth/logout', 'POST'); // tell the server to forget the token
    } catch (err) {
      // even if the server says error, we still log out in the browser
    }
    this.clearSession();
    this.showLoginScreen();
  },

  /** Called after a successful login (or when a saved token is still valid). */
  startSession(user) {
    this.currentUser = user;
    this.currentRole = user.role;
    this.officerName = user.fullName;

    document.getElementById('userFullName').textContent = user.fullName;
    document.getElementById('userRoleBadge').textContent = user.role;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';

    // Clear stale in-memory module caches so switching accounts always displays latest database state
    if (window.CatalogModule) {
      CatalogModule.items = [];
      CatalogModule.warehouses = [];
      CatalogModule.suppliers = [];
    }
    if (window.InventoryModule) {
      InventoryModule.overviewData = null;
      InventoryModule.activeItems = [];
      InventoryModule.activeWarehouses = [];
      InventoryModule.activeSuppliers = [];
      const filterWh = document.getElementById('filterWarehouse');
      if (filterWh) filterWh.innerHTML = '<option value="">-- All Warehouses --</option>';
    }
    if (window.DispatchModule) {
      DispatchModule.orders = [];
    }
    if (window.DistributorModule) {
      DistributorModule.products = [];
    }

    this.updateRoleView();
  },

  clearSession() {
    this.token = null;
    this.currentUser = null;
    this.currentRole = null;
    this.officerName = '';
    sessionStorage.removeItem('agriToken');
  },

  showLoginScreen(message) {
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginForm').reset();
    const passInput = document.getElementById('loginPassword');
    const togglePassBtn = document.getElementById('togglePasswordBtn');
    if (passInput) passInput.type = 'password';
    if (togglePassBtn) togglePassBtn.textContent = 'Show';
    document.getElementById('loginError').style.display = 'none';
    if (message) this.showLoginError(message);
    this.hideBanner();
  },

  showLoginError(message) {
    const box = document.getElementById('loginError');
    box.textContent = message;
    box.style.display = 'block';
  },

  // ---------------------------------------------------------------- menu by role
  updateRoleView() {
    const isDistributor = this.currentRole === 'Distributor';
    const isOfficer = this.currentRole === 'Warehouse Officer';

    // Show only the tabs that this role may use (SRS 2.1, US-8A)
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const allowedRoles = (tab.getAttribute('data-roles') || '').split(',');
      tab.style.display = allowedRoles.includes(this.currentRole) ? 'flex' : 'none';
    });

    // Open the first page of this role: Dashboard for everyone!
    this.showSection('dashboard-sec');

    // Alert counter (Distributor is not allowed to see alerts)
    if (!isDistributor) {
      AlertsModule.refreshBadgeCounts();
    }
  },

  showSection(sectionId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-target') === sectionId);
    });

    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === sectionId);
    });

    // Load the data of the page we just opened
    if (sectionId === 'dashboard-sec') DashboardModule.loadDashboard();
    if (sectionId === 'item-catalog-sec') CatalogModule.loadItems();
    if (sectionId === 'warehouse-supplier-sec') CatalogModule.loadWarehousesAndSuppliers();
    if (sectionId === 'stock-view-sec') InventoryModule.loadStockOverview();
    if (sectionId === 'receive-stock-sec') InventoryModule.initReceiveForm();
    if (sectionId === 'usage-wastage-sec') InventoryModule.initUsageWastageForms();
    if (sectionId === 'dispatch-sec') DispatchModule.loadOrders();
    if (sectionId === 'alerts-sec') AlertsModule.loadAlerts();
    if (sectionId === 'distributor-catalog-sec') DistributorModule.loadProducts();
    if (sectionId === 'track-orders-sec') DistributorModule.initTrackingView();

    // Keep alert badge refreshed on other tabs
    if (sectionId !== 'alerts-sec' && this.currentRole !== 'Distributor') {
      AlertsModule.refreshBadgeCounts();
    }
  },

  // ---------------------------------------------------------------- talking to the backend
  /**
   * Sends a request to the backend API and returns the JSON answer.
   * The login token is added to every request so the server knows who we are.
   */
  async apiRequest(url, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config = { method, headers };
    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    // Token missing/expired (for example the server was restarted) -> back to login
    if (response.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/me') {
      this.clearSession();
      this.showLoginScreen('Your session has ended. Please log in again.');
    }
    if (!response.ok) {
      throw new Error(data.message || `HTTP error ${response.status}`);
    }
    return data;
  },

  /** Makes a unique id for one form so the same form cannot be saved twice (NFR-05). */
  newToken(prefix) {
    const random = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${random}`;
  },

  // Quick Role Switcher for seamless testing and demonstration
  async quickSwitchRole(roleKey) {
    const creds = {
      manager: { user: 'manager', pass: 'manager123' },
      officer: { user: 'officer', pass: 'officer123' },
      distributor: { user: 'distributor', pass: 'distributor123' }
    };
    const c = creds[roleKey];
    if (!c) return;
    try {
      const res = await this.apiRequest('/api/auth/login', 'POST', { username: c.user, password: c.pass });
      this.token = res.data.token;
      sessionStorage.setItem('agriToken', this.token);
      this.startSession(res.data.user);
      this.showBanner(`Switched role to ${res.data.user.role} (${res.data.user.fullName})`, 'success');
    } catch (err) {
      this.showBanner(`Failed to switch role: ${err.message}`, 'error');
    }
  },

  // Client-side CSV export helper
  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ---------------------------------------------------------------- messages
  showBanner(message, type = 'success') {
    const banner = document.getElementById('globalAlertBanner');
    if (!banner) return;
    banner.className = `alert-banner ${type}`;
    banner.innerHTML = `<span>${message}</span> <button class="btn btn-sm btn-outline" onclick="App.hideBanner()">✕</button>`;
    banner.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (type === 'success') {
      setTimeout(() => this.hideBanner(), 5000);
    }
  },

  hideBanner() {
    const banner = document.getElementById('globalAlertBanner');
    if (banner) banner.style.display = 'none';
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
