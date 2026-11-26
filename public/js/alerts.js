// public/js/alerts.js
// Presentation layer logic for Low-Stock and Expiry Alerts (Feature 8: US-8A, US-8B)

const AlertsModule = {
  alertsData: null,

  getStorageKey() {
    const userId = (App.currentUser && App.currentUser.id) || App.currentRole || 'default';
    return `agri_read_alerts_${userId}`;
  },

  getReadAlertIds() {
    try {
      const key = this.getStorageKey();
      const raw = window.localStorage ? window.localStorage.getItem(key) : sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  },

  saveReadAlertIds(ids) {
    try {
      const key = this.getStorageKey();
      const data = JSON.stringify(ids);
      if (window.localStorage) {
        window.localStorage.setItem(key, data);
      }
      sessionStorage.setItem(key, data);
    } catch (_) {}
  },

  getAlertUniqueIds(data) {
    if (!data) return [];
    const ids = [];
    (data.lowStockAlerts || []).forEach(a => ids.push(`low_${a.itemId}`));
    (data.expiringSoonAlerts || []).forEach(b => ids.push(`exp_${b.batchId}`));
    (data.expiredAlerts || []).forEach(b => ids.push(`expired_${b.batchId}`));
    return ids;
  },

  async refreshBadgeCounts() {
    if (App.currentRole === 'Distributor') return;

    try {
      const res = await App.apiRequest('/api/alerts');
      this.alertsData = res.data;

      const currentIds = this.getAlertUniqueIds(res.data);
      const readIds = new Set(this.getReadAlertIds());
      const unreadCount = currentIds.filter(id => !readIds.has(id)).length;

      const badge = document.getElementById('alertsTabBadge');
      if (badge) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount;
          badge.style.display = 'inline-block';
        } else {
          badge.innerText = '0';
          badge.style.display = 'none';
        }
      }
    } catch (_) {
      // Ignored if unauthorized
    }
  },

  async loadAlerts() {
    if (App.currentRole === 'Distributor') {
      App.showBanner('Access Denied: Distributors cannot view internal alerts.', 'error');
      App.showSection('distributor-catalog-sec');
      return;
    }

    try {
      const res = await App.apiRequest('/api/alerts');
      this.alertsData = res.data;
      this.renderAlertsView();

      // Mark all current active alerts as read when user views the alerts section
      const currentIds = this.getAlertUniqueIds(res.data);
      this.saveReadAlertIds(currentIds);

      // Hide the unread badge once viewed
      const badge = document.getElementById('alertsTabBadge');
      if (badge) {
        badge.innerText = '0';
        badge.style.display = 'none';
      }
    } catch (err) {
      App.showBanner(`Error loading alerts: ${err.message}`, 'error');
    }
  },

  renderAlertsView() {
    if (!this.alertsData) return;
    const { currentBangladeshDate, summary, lowStockAlerts, expiringSoonAlerts, expiredAlerts } = this.alertsData;

    document.getElementById('alertsDateNotice').innerText = `Checked as of Bangladesh Date: ${currentBangladeshDate}`;

    // Stat counters
    document.getElementById('statLowStockCount').innerText = summary.totalLowStock;
    document.getElementById('statExpiringSoonCount').innerText = summary.totalExpiringSoon;
    document.getElementById('statExpiredCount').innerText = summary.totalExpired;

    // Render Low Stock Alerts (US-8A)
    const isOfficer = App.currentRole === 'Warehouse Officer';
    const isManager = App.currentRole === 'Farm Manager';

    const lowStockContainer = document.getElementById('lowStockAlertsList');
    if (lowStockAlerts.length === 0) {
      lowStockContainer.innerHTML = '<div style="color:var(--text-muted); padding:10px; font-size:13px;">All items are at or above their minimum stock levels.</div>';
    } else {
      lowStockContainer.innerHTML = lowStockAlerts.map(a => `
        <div style="border-left: 4px solid var(--danger-color); padding: 12px 16px; background-color: var(--danger-bg); border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #3b1717; border-left: 4px solid var(--danger-color);">
          <div>
            <strong>${a.itemName}</strong> (${a.category})<br>
            <span style="font-size:13px; color: var(--danger-color); font-weight:600;">
              Usable Stock: ${a.currentUsableStock} ${a.unit} | Min Required: ${a.minStockLevel} ${a.unit} (Shortage: -${a.shortage} ${a.unit})
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-danger">${a.severity}</span>
            ${isOfficer ? `<button class="btn btn-sm btn-primary" onclick="InventoryModule.openReceiveForItem('${a.itemId}')">+ Restock</button>` : ''}
            ${isManager ? `<button class="btn btn-sm btn-outline" onclick="CatalogModule.openEditItemModal('${a.itemId}')">Edit</button>` : ''}
          </div>
        </div>
      `).join('');
    }

    // Render Expiring Soon Alerts (US-8B)
    const expiringSoonContainer = document.getElementById('expiringSoonAlertsList');
    if (expiringSoonAlerts.length === 0) {
      expiringSoonContainer.innerHTML = '<div style="color:var(--text-muted); padding:10px; font-size:13px;">No batches expiring within 3 calendar days.</div>';
    } else {
      expiringSoonContainer.innerHTML = expiringSoonAlerts.map(b => `
        <div style="border-left: 4px solid var(--warning-color); padding: 12px 16px; background-color: var(--warning-bg); border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #3b2f0a; border-left: 4px solid var(--warning-color);">
          <div>
            <strong>Batch ${b.batchId}</strong> - ${b.itemName} (${b.warehouseName})<br>
            <span style="font-size:13px; color: var(--warning-color); font-weight:600;">
              Quantity: ${b.remainingQuantity} ${b.unit} | Expiry Date: ${b.expiryDate} (Expiring Soon)
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-warning">Expiring Soon</span>
            ${isOfficer ? `<button class="btn btn-sm btn-outline" onclick="InventoryModule.viewItemBatches('${b.batchId}')">View</button>` : ''}
          </div>
        </div>
      `).join('');
    }

    // Render Expired Alerts (US-8B)
    const expiredContainer = document.getElementById('expiredAlertsList');
    if (expiredAlerts.length === 0) {
      expiredContainer.innerHTML = '<div style="color:var(--text-muted); padding:10px; font-size:13px;">No expired batches in storage.</div>';
    } else {
      expiredContainer.innerHTML = expiredAlerts.map(b => `
        <div style="border-left: 4px solid var(--danger-color); padding: 12px 16px; background-color: var(--danger-bg); border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #3b1717; border-left: 4px solid var(--danger-color);">
          <div>
            <strong>Batch ${b.batchId}</strong> - ${b.itemName} (${b.warehouseName})<br>
            <span style="font-size:13px; color: var(--danger-color); font-weight:600;">
              Quantity: ${b.remainingQuantity} ${b.unit} | Expired on: ${b.expiryDate} (Blocked from normal usage & dispatch)
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-danger">EXPIRED</span>
            ${isOfficer ? `<button class="btn btn-sm btn-danger" onclick="InventoryModule.openWastageModal('${b.batchId}', '${b.itemName}', ${b.remainingQuantity}, '${b.unit}')">Write Off</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }
};
