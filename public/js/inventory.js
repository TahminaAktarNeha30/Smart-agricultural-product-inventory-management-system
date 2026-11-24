// public/js/inventory.js
// Presentation layer logic for Stock Overview, Receiving, Usage, and Wastage (Features 3, 4, 5)

const InventoryModule = {
  overviewData: null,
  activeItems: [],
  activeWarehouses: [],
  activeSuppliers: [],

  async loadStockOverview() {
    try {
      const whFilter = document.getElementById('filterWarehouse')?.value || '';
      const emptyFilter = document.getElementById('filterShowEmpty')?.checked ? 'true' : 'false';

      let url = `/api/stock/overview?showEmptyBatches=${emptyFilter}`;
      if (whFilter) url += `&warehouseId=${encodeURIComponent(whFilter)}`;

      const res = await App.apiRequest(url);
      this.overviewData = res.data;
      this.renderStockOverview();
      this.populateWarehouseFilter();
    } catch (err) {
      App.showBanner(`Failed to load stock overview: ${err.message}`, 'error');
    }
  },

  populateWarehouseFilter() {
    const select = document.getElementById('filterWarehouse');
    if (!select) return;

    App.apiRequest('/api/warehouses').then(res => {
      select.innerHTML = '<option value="">-- All Warehouses --</option>';
      res.data.forEach(wh => {
        const opt = document.createElement('option');
        opt.value = wh.id;
        opt.textContent = wh.name;
        select.appendChild(opt);
      });
    });
  },

  searchQuery: '',

  filterSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderStockOverview();
  },

  renderStockOverview() {
    const tbody = document.getElementById('stockTableBody');
    if (!tbody || !this.overviewData) return;

    const { summaries } = this.overviewData;
    let { batches } = this.overviewData;

    const searchInput = document.getElementById('filterItemSearch')?.value.trim().toLowerCase();
    if (searchInput) {
      batches = batches.filter(b => 
        (b.itemName && b.itemName.toLowerCase().includes(searchInput)) ||
        (b.itemId && b.itemId.toLowerCase().includes(searchInput)) ||
        (b.id && b.id.toLowerCase().includes(searchInput))
      );
    }

    // Stat Cards
    let totalUsable = 0;
    let totalExpired = 0;
    summaries.forEach(s => {
      totalUsable += s.usableStock;
      totalExpired += s.expiredStock;
    });

    const statUsableEl = document.getElementById('statTotalUsable');
    const statExpiredEl = document.getElementById('statTotalExpired');
    const statBatchesEl = document.getElementById('statTotalBatches');
    if (statUsableEl) statUsableEl.innerText = totalUsable.toLocaleString();
    if (statExpiredEl) statExpiredEl.innerText = totalExpired.toLocaleString();
    if (statBatchesEl) statBatchesEl.innerText = batches.length;

    let filteredBatches = batches;
    if (this.searchQuery) {
      filteredBatches = filteredBatches.filter(b => 
        b.id.toLowerCase().includes(this.searchQuery) ||
        b.itemName.toLowerCase().includes(this.searchQuery) ||
        b.category.toLowerCase().includes(this.searchQuery) ||
        b.warehouseName.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filteredBatches.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
            <div style="font-size: 28px; margin-bottom: 8px;">📦</div>
            <strong>No stock records found matching filter.</strong><br>
            <small>${this.searchQuery ? 'Try adjusting your search query.' : 'Record a stock receipt to register initial batches.'}</small>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredBatches.map(batch => {
      let statusBadge = '<span class="badge badge-success">Active Usable</span>';
      if (batch.expiryStatus === 'EXPIRED') {
        // US-04, Confirmation 3: Displayed with "Expired" label and excluded from dispatch
        statusBadge = '<span class="badge badge-danger">EXPIRED</span>';
      } else if (batch.expiryStatus === 'EXPIRING_SOON') {
        statusBadge = '<span class="badge badge-warning">EXPIRING SOON</span>';
      }

      if (Number(batch.remainingQuantity) === 0) {
        statusBadge = '<span class="badge badge-secondary">DEPLETED (0)</span>';
      }

      const isOfficer = App.currentRole === 'Warehouse Officer';
      const isInput = batch.category === 'Animal Feed' || batch.category === 'Fertilizers' || batch.category === 'Seeds';

      return `
        <tr style="${batch.expiryStatus === 'EXPIRED' ? 'background-color: #2d1515;' : ''}">
          <td><strong>${batch.id}</strong></td>
          <td><strong>${batch.itemName}</strong><br><small style="color: var(--text-muted);">${batch.category}</small></td>
          <td>${batch.warehouseName}</td>
          <td><strong>${batch.remainingQuantity}</strong> ${batch.unit}</td>
          <td>${batch.initialQuantity} ${batch.unit}</td>
          <td>${batch.receivingDate}</td>
          <td>${batch.expiryDate ? batch.expiryDate : '<span style="color:var(--text-muted);">N/A</span>'}</td>
          <td>${statusBadge}</td>
          <td>
            ${isOfficer ? `
              <div style="display:flex; gap: 4px;">
                ${batch.expiryStatus !== 'EXPIRED' && Number(batch.remainingQuantity) > 0 && isInput ? `
                  <button class="btn btn-sm btn-outline" onclick="InventoryModule.openUsageModal('${batch.id}', '${batch.itemName}', ${batch.remainingQuantity}, '${batch.unit}')">Use</button>
                ` : ''}
                ${Number(batch.remainingQuantity) > 0 ? `
                  <button class="btn btn-sm btn-danger" onclick="InventoryModule.openWastageModal('${batch.id}', '${batch.itemName}', ${batch.remainingQuantity}, '${batch.unit}')">Wastage</button>
                ` : ''}
              </div>
            ` : '<span style="color: var(--text-muted); font-size: 12px;">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  // ----------------- Stock Receiving Form -----------------
  async initReceiveForm() {
    // One token per form: sending the same form twice cannot create two batches (NFR-05)
    this.receiptToken = App.newToken('TX-REC');
    try {
      const [itemsRes, whRes, supRes] = await Promise.all([
        App.apiRequest('/api/items'),
        App.apiRequest('/api/warehouses/active'),
        App.apiRequest('/api/suppliers/active')
      ]);

      this.activeItems = itemsRes.data.filter(i => i.isActive);
      this.activeWarehouses = whRes.data;
      this.activeSuppliers = supRes.data;

      const itemSelect = document.getElementById('recItemSelect');
      const whSelect = document.getElementById('recWarehouseSelect');
      const supSelect = document.getElementById('recSupplierSelect');

      if (itemSelect) {
        itemSelect.innerHTML = '<option value="">-- Select Active Item --</option>' +
          this.activeItems.map(i => `<option value="${i.id}" data-unit="${i.unit}" data-rotation="${i.rotationRule}">${i.name} (${i.type} - ${i.unit})</option>`).join('');
      }

      if (whSelect) {
        whSelect.innerHTML = '<option value="">-- Select Active Warehouse --</option>' +
          this.activeWarehouses.map(w => `<option value="${w.id}">${w.name} (${w.storageType})</option>`).join('');
      }

      if (supSelect) {
        supSelect.innerHTML = '<option value="">-- Select Active Supplier --</option>' +
          this.activeSuppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      }

      // Set today's date in Bangladesh Standard Time
      const today = new Date().toISOString().split('T')[0];
      const recDateInput = document.getElementById('recReceivingDate');
      if (recDateInput && !recDateInput.value) recDateInput.value = today;

    } catch (err) {
      App.showBanner(`Failed to load receipt form dependencies: ${err.message}`, 'error');
    }
  },

  onItemSelectChange(select) {
    const selectedOpt = select.options[select.selectedIndex];
    const unit = selectedOpt ? selectedOpt.getAttribute('data-unit') : '';
    const rotation = selectedOpt ? selectedOpt.getAttribute('data-rotation') : '';

    const unitAddon = document.getElementById('recUnitAddon');
    if (unitAddon) unitAddon.innerText = unit || 'units';

    const expiryLabel = document.getElementById('recExpiryLabel');
    const expiryInput = document.getElementById('recExpiryDate');
    if (rotation === 'FEFO') {
      if (expiryLabel) expiryLabel.classList.add('required');
      if (expiryInput) expiryInput.setAttribute('required', 'required');
    } else {
      if (expiryLabel) expiryLabel.classList.remove('required');
      if (expiryInput) expiryInput.removeAttribute('required');
    }
  },

  onSourceTypeChange(select) {
    const isSupplier = select.value === 'Supplier Purchase';
    document.getElementById('supplierSourceGroup').style.display = isSupplier ? 'block' : 'none';
    document.getElementById('farmSourceGroup').style.display = isSupplier ? 'none' : 'block';
  },

  async submitStockReceipt(event) {
    event.preventDefault();
    const batchId = document.getElementById('recBatchId').value;
    const itemId = document.getElementById('recItemSelect').value;
    const warehouseId = document.getElementById('recWarehouseSelect').value;
    const sourceType = document.getElementById('recSourceType').value;
    const supplierId = document.getElementById('recSupplierSelect').value;
    const farmSourceDescription = document.getElementById('recFarmDesc').value;
    const harvestDate = document.getElementById('recHarvestDate').value;
    const receivingDate = document.getElementById('recReceivingDate').value;
    const expiryDate = document.getElementById('recExpiryDate').value;
    const quantity = document.getElementById('recQuantity').value;

    const payload = {
      batchId, itemId, warehouseId, sourceType, supplierId,
      farmSourceDescription, harvestDate, receivingDate,
      expiryDate: expiryDate || null,
      quantity,
      transactionToken: this.receiptToken
    };

    try {
      const res = await App.apiRequest('/api/stock/receive', 'POST', payload);
      App.showBanner(`Stock received successfully: Batch "${res.data.batch.id}" with ${res.data.batch.remainingQuantity} ${res.data.batch.unit}.`, 'success');
      document.getElementById('stockReceiptForm').reset();
      this.initReceiveForm();
      App.showSection('stock-view-sec');
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  // ----------------- Usage & Wastage Forms -----------------
  async initUsageWastageForms() {
    await this.loadStockOverview();
  },

  openUsageModal(batchId, itemName, balance, unit) {
    this.usageToken = App.newToken('TX-USE'); // created once when the modal opens
    document.getElementById('usageBatchId').value = batchId;
    document.getElementById('usageItemName').value = itemName;
    document.getElementById('usageAvailable').value = `${balance} ${unit}`;
    document.getElementById('usageUnitAddon').innerText = unit;
    document.getElementById('usageQuantity').value = '';
    document.getElementById('usagePurpose').value = '';
    document.getElementById('usageDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('usageModal').classList.add('open');
  },

  closeUsageModal() {
    document.getElementById('usageModal').classList.remove('open');
  },

  async submitUsage(event) {
    event.preventDefault();
    const batchId = document.getElementById('usageBatchId').value;
    const quantity = document.getElementById('usageQuantity').value;
    const date = document.getElementById('usageDate').value;
    const purpose = document.getElementById('usagePurpose').value;

    try {
      const res = await App.apiRequest('/api/stock/usage', 'POST', {
        batchId, quantity, date, purpose, transactionToken: this.usageToken
      });
      App.showBanner(`Usage recorded: Remaining balance is ${res.data.remainingBalance} ${res.data.unit}.`, 'success');
      this.closeUsageModal();
      this.loadStockOverview();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  openWastageModal(batchId, itemName, balance, unit) {
    this.wastageToken = App.newToken('TX-WST'); // created once when the modal opens
    document.getElementById('wastageBatchId').value = batchId;
    document.getElementById('wastageItemName').value = itemName;
    document.getElementById('wastageAvailable').value = `${balance} ${unit}`;
    document.getElementById('wastageUnitAddon').innerText = unit;
    document.getElementById('wastageQuantity').value = '';
    document.getElementById('wastageReason').value = 'spoilage';
    document.getElementById('wastageDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('wastageModal').classList.add('open');
  },

  closeWastageModal() {
    document.getElementById('wastageModal').classList.remove('open');
  },

  async submitWastage(event) {
    event.preventDefault();
    const batchId = document.getElementById('wastageBatchId').value;
    const quantity = document.getElementById('wastageQuantity').value;
    const date = document.getElementById('wastageDate').value;
    const reason = document.getElementById('wastageReason').value;

    try {
      const res = await App.apiRequest('/api/stock/wastage', 'POST', {
        batchId, quantity, date, reason, transactionToken: this.wastageToken
      });
      App.showBanner(`Wastage recorded: Balance reduced to ${res.data.remainingBalance} ${res.data.unit}.`, 'success');
      this.closeWastageModal();
      this.loadStockOverview();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async openReceiveForItem(itemId) {
    App.showSection('receive-stock-sec');
    await this.initReceiveForm();
    const itemSelect = document.getElementById('recItemSelect');
    if (itemSelect) {
      itemSelect.value = itemId;
      this.onItemSelectChange(itemSelect);
    }
  },

  viewItemBatches(itemId) {
    App.showSection('stock-view-sec');
    const searchInput = document.getElementById('filterItemSearch');
    if (searchInput) {
      searchInput.value = itemId;
    }
    this.loadStockOverview();
  },

  exportCSV() {
    if (!this.overviewData || !this.overviewData.batches || this.overviewData.batches.length === 0) {
      App.showBanner('No stock batches to export.', 'error');
      return;
    }
    const headers = ['Batch ID', 'Item Code', 'Item Name', 'Category', 'Warehouse', 'Remaining Quantity', 'Initial Quantity', 'Unit', 'Receipt Date', 'Expiry Date', 'Status'];
    const rows = this.overviewData.batches.map(b => [
      `"${b.id}"`,
      `"${b.itemId}"`,
      `"${(b.itemName || '').replace(/"/g, '""')}"`,
      `"${(b.category || '').replace(/"/g, '""')}"`,
      `"${(b.warehouseName || '').replace(/"/g, '""')}"`,
      b.remainingQuantity,
      b.initialQuantity,
      `"${b.unit}"`,
      `"${b.receivingDate}"`,
      `"${b.expiryDate || 'N/A'}"`,
      `"${b.expiryStatus || 'ACTIVE'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    App.downloadCSV(csvContent, `stock-inventory-${new Date().toISOString().split('T')[0]}.csv`);
    App.showBanner('Stock inventory exported to CSV successfully.', 'success');
  }
};
