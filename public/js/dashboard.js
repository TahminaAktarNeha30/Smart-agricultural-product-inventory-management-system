// public/js/dashboard.js
// Presentation layer logic for the User Dashboard (Role-specific overview, quick actions & guide)

const DashboardModule = {
  async loadDashboard() {
    const user = App.currentUser;
    if (!user) return;

    // Welcome Header
    const nameEl = document.getElementById('dashWelcomeName');
    if (nameEl) nameEl.textContent = user.fullName;

    const descEl = document.getElementById('dashRoleDescription');
    if (descEl) {
      if (user.role === 'Farm Manager') {
        descEl.textContent = 'Role: Farm Manager — You have full oversight of item catalogs, warehouses, suppliers, and stock health.';
      } else if (user.role === 'Warehouse Officer') {
        descEl.textContent = 'Role: Warehouse Officer — You manage stock receiving, batch usage, wastage, and order dispatch.';
      } else if (user.role === 'Distributor') {
        descEl.textContent = 'Role: Distributor — You can browse fresh farm produce, submit bulk orders, and track deliveries.';
      }
    }

    const dateEl = document.getElementById('dashDate');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Render Stats, Quick Actions & Guide
    await Promise.all([
      this.renderStats(user.role),
      this.renderQuickActions(user.role),
      this.renderGuide(user.role)
    ]);
  },

  async renderStats(role) {
    const container = document.getElementById('dashStatsGrid');
    if (!container) return;

    try {
      if (role === 'Farm Manager') {
        const [itemsRes, whRes, supRes, stockRes] = await Promise.all([
          App.apiRequest('/api/items'),
          App.apiRequest('/api/warehouses'),
          App.apiRequest('/api/suppliers'),
          App.apiRequest('/api/stock/overview')
        ]);

        const totalItems = itemsRes.data.length;
        const totalWarehouses = whRes.data.filter(w => w.isActive).length;
        const totalSuppliers = supRes.data.filter(s => s.isActive).length;
        let totalStockUnits = 0;
        (stockRes.data.summaries || []).forEach(s => totalStockUnits += s.usableStock);

        container.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon green">📋</div>
            <div>
              <div class="stat-val">${totalItems}</div>
              <div class="stat-label">Catalog Items</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue">🏭</div>
            <div>
              <div class="stat-val">${totalWarehouses}</div>
              <div class="stat-label">Active Warehouses</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">🤝</div>
            <div>
              <div class="stat-val">${totalSuppliers}</div>
              <div class="stat-label">Trusted Suppliers</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">📦</div>
            <div>
              <div class="stat-val">${totalStockUnits.toLocaleString()}</div>
              <div class="stat-label">Total Usable Units</div>
            </div>
          </div>
        `;
      } else if (role === 'Warehouse Officer') {
        const [stockRes, ordersRes, alertsRes] = await Promise.all([
          App.apiRequest('/api/stock/overview'),
          App.apiRequest('/api/orders'),
          App.apiRequest('/api/alerts')
        ]);

        let totalUsable = 0;
        const totalBatches = (stockRes.data.batches || []).length;
        (stockRes.data.summaries || []).forEach(s => totalUsable += s.usableStock);

        const pendingOrders = (ordersRes.data || []).filter(o => o.status === 'Placed' || o.status === 'Approved').length;
        const totalAlerts = (alertsRes.data.summary.totalLowStock || 0) + (alertsRes.data.summary.totalExpiringSoon || 0) + (alertsRes.data.summary.totalExpired || 0);

        container.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon green">📦</div>
            <div>
              <div class="stat-val">${totalUsable.toLocaleString()}</div>
              <div class="stat-label">Usable Stock Units</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue">🏷️</div>
            <div>
              <div class="stat-val">${totalBatches}</div>
              <div class="stat-label">Active Batches</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">🚚</div>
            <div>
              <div class="stat-val">${pendingOrders}</div>
              <div class="stat-label">Pending Orders</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">🔔</div>
            <div>
              <div class="stat-val">${totalAlerts}</div>
              <div class="stat-label">Active Alerts</div>
            </div>
          </div>
        `;
      } else if (role === 'Distributor') {
        const prodsRes = await App.apiRequest('/api/orders/products');
        const availProducts = (prodsRes.data || []).length;
        const cartCount = (typeof DistributorModule !== 'undefined' && DistributorModule.cart)
          ? Object.keys(DistributorModule.cart).length
          : 0;

        container.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon green">🛒</div>
            <div>
              <div class="stat-val">${availProducts}</div>
              <div class="stat-label">Products in Stock</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue">🛍️</div>
            <div>
              <div class="stat-val">${cartCount}</div>
              <div class="stat-label">Items in Cart</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">⚡</div>
            <div>
              <div class="stat-val">Direct</div>
              <div class="stat-label">Farm Sourced</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">🛡️</div>
            <div>
              <div class="stat-val">100%</div>
              <div class="stat-label">Quality Assured</div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger-color); padding:10px;">Failed to load statistics: ${err.message}</div>`;
    }
  },

  renderQuickActions(role) {
    const container = document.getElementById('dashQuickActions');
    if (!container) return;

    if (role === 'Farm Manager') {
      container.innerHTML = `
        <button class="quick-action-btn" onclick="CatalogModule.openAddItemModal()">
          <span class="action-icon">➕</span>
          <span class="action-title">Add New Item</span>
          <span class="action-desc">Register input or finished product</span>
        </button>
        <button class="quick-action-btn" onclick="CatalogModule.openAddWarehouseModal()">
          <span class="action-icon">🏭</span>
          <span class="action-title">Add Warehouse</span>
          <span class="action-desc">Add new physical storage facility</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('stock-view-sec')">
          <span class="action-icon">📦</span>
          <span class="action-title">View Stock Levels</span>
          <span class="action-desc">Check quantities and expiration dates</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('alerts-sec')">
          <span class="action-icon">🔔</span>
          <span class="action-title">Review Alerts</span>
          <span class="action-desc">Check low stock and expiring items</span>
        </button>
      `;
    } else if (role === 'Warehouse Officer') {
      container.innerHTML = `
        <button class="quick-action-btn" onclick="App.showSection('receive-stock-sec')">
          <span class="action-icon">📥</span>
          <span class="action-title">Receive Stock</span>
          <span class="action-desc">Record harvest or supplier delivery</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('dispatch-sec')">
          <span class="action-icon">🚚</span>
          <span class="action-title">Manage Orders</span>
          <span class="action-desc">Approve and dispatch with FIFO/FEFO</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('stock-view-sec')">
          <span class="action-icon">📦</span>
          <span class="action-title">Stock & Batches</span>
          <span class="action-desc">Record usage or report wastage</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('alerts-sec')">
          <span class="action-icon">🔔</span>
          <span class="action-title">Check Alerts</span>
          <span class="action-desc">View items nearing expiration</span>
        </button>
      `;
    } else if (role === 'Distributor') {
      container.innerHTML = `
        <button class="quick-action-btn" onclick="App.showSection('distributor-catalog-sec')">
          <span class="action-icon">🛒</span>
          <span class="action-title">Browse Products</span>
          <span class="action-desc">View fresh produce & place orders</span>
        </button>
        <button class="quick-action-btn" onclick="App.showSection('track-orders-sec')">
          <span class="action-icon">🔍</span>
          <span class="action-title">Track My Order</span>
          <span class="action-desc">Look up order status or cancel</span>
        </button>
      `;
    }
  },

  renderGuide(role) {
    const container = document.getElementById('dashGuide');
    if (!container) return;

    if (role === 'Farm Manager') {
      container.innerHTML = `
        <div class="guide-grid">
          <div class="guide-card">
            <div class="guide-step-num">Step 1</div>
            <h4>📋 Maintain Item Catalog</h4>
            <p>Define farm inputs (fertilizer, seeds) and finished produce (rice, tomatoes). Assign rotation rules: <strong>FEFO</strong> for perishable goods, <strong>FIFO</strong> for non-perishables.</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 2</div>
            <h4>🏭 Manage Facilities & Suppliers</h4>
            <p>Configure storage locations (Cold storage, Ambient, Dry) and keep records of authorized suppliers for rapid restocking.</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 3</div>
            <h4>🔔 Monitor Inventory Health</h4>
            <p>Automated alerts notify you whenever stock drops below minimum safety thresholds or batches approach expiration.</p>
          </div>
        </div>
      `;
    } else if (role === 'Warehouse Officer') {
      container.innerHTML = `
        <div class="guide-grid">
          <div class="guide-card">
            <div class="guide-step-num">Step 1</div>
            <h4>📥 Stock Receiving</h4>
            <p>When harvest arrives or a supplier delivers, log the batch ID, quantity, warehouse, and expiry date. Every lot receives an individual tracking record.</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 2</div>
            <h4>🚚 Order Dispatch</h4>
            <p>Review distributor orders. The system automatically computes <strong>FIFO/FEFO batch allocations</strong> so the oldest or nearest-to-expire lots are sent out first!</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 3</div>
            <h4>📉 Usage & Wastage</h4>
            <p>Record inputs used on the farm (e.g. feeding, fertilizer) or write off damaged/expired stock to maintain 100% audit accuracy.</p>
          </div>
        </div>
      `;
    } else if (role === 'Distributor') {
      container.innerHTML = `
        <div class="guide-grid">
          <div class="guide-card">
            <div class="guide-step-num">Step 1</div>
            <h4>🛒 Choose Products</h4>
            <p>Browse live inventory of fresh farm produce with guaranteed fixed unit prices and live stock availability.</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 2</div>
            <h4>📝 Place Order</h4>
            <p>Add items to your order cart, specify quantities, enter your business name and contact phone, then submit.</p>
          </div>
          <div class="guide-card">
            <div class="guide-step-num">Step 3</div>
            <h4>🔍 Track Delivery</h4>
            <p>Use your <strong>Order Number</strong> and <strong>Phone Number</strong> to track verification, approval, and warehouse dispatch in real-time.</p>
          </div>
        </div>
      `;
    }
  }
};
