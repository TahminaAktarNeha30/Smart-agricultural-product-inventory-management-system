// public/js/catalog.js
// Presentation layer logic for Item Catalog, Warehouses, and Suppliers (Features 1 & 2)

const CatalogModule = {
  items: [],
  warehouses: [],
  suppliers: [],

  async loadItems() {
    try {
      const [res, stockRes] = await Promise.all([
        App.apiRequest('/api/items'),
        App.apiRequest('/api/stock/overview').catch(() => null)
      ]);
      const stockMap = {};
      if (stockRes && stockRes.data && stockRes.data.itemSummaries) {
        stockRes.data.itemSummaries.forEach(s => {
          if (s.item && s.item.id) {
            stockMap[s.item.id] = s.totalStock;
          }
        });
      }
      this.items = (res.data || []).map(item => ({
        ...item,
        currentStock: stockMap[item.id] !== undefined ? stockMap[item.id] : 0
      }));
      this.populateCategoryFilter();
      this.renderItemsTable();
    } catch (err) {
      App.showBanner(`Error loading items: ${err.message}`, 'error');
    }
  },

  filterQuery: '',
  categoryFilter: '',

  populateCategoryFilter() {
    const select = document.getElementById('catalogCategoryFilter');
    if (!select) return;
    const categories = [...new Set(this.items.map(i => i.category).filter(Boolean))].sort();
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (currentVal && categories.includes(currentVal)) {
      select.value = currentVal;
    }
  },

  filterByCategory(cat) {
    this.categoryFilter = (cat || '').toLowerCase().trim();
    this.renderItemsTable();
  },

  filterItems(query) {
    this.filterQuery = (query || '').toLowerCase().trim();
    this.renderItemsTable();
  },

  renderItemsTable() {
    const tbody = document.getElementById('itemTableBody');
    if (!tbody) return;

    let itemsToRender = this.items;
    if (this.categoryFilter) {
      itemsToRender = itemsToRender.filter(i => (i.category || '').toLowerCase() === this.categoryFilter);
    }
    if (this.filterQuery) {
      itemsToRender = itemsToRender.filter(i => 
        i.name.toLowerCase().includes(this.filterQuery) || 
        i.id.toLowerCase().includes(this.filterQuery) ||
        i.category.toLowerCase().includes(this.filterQuery)
      );
    }

    const countNotice = document.getElementById('catalogCountNotice');
    if (countNotice) {
      countNotice.textContent = `Showing ${itemsToRender.length} of ${this.items.length} items`;
    }

    if (itemsToRender.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🌾</div>
            <strong>No items match your criteria.</strong><br>
            <small>${this.filterQuery ? 'Try clearing your search term.' : 'Click "+ Add New Item" above to add your first product.'}</small>
          </td>
        </tr>
      `;
      return;
    }

    const isFarmManager = App.currentRole === 'Farm Manager';
    const isOfficer = App.currentRole === 'Warehouse Officer';
    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) addBtn.style.display = isFarmManager ? 'inline-flex' : 'none';

    tbody.innerHTML = itemsToRender.map(item => {
      const statusBadge = item.isActive 
        ? '<span class="badge badge-success">Active</span>' 
        : '<span class="badge badge-secondary">Deactivated</span>';
      
      const typeBadge = item.type === 'Finished Product'
        ? '<span class="badge badge-info">Finished Product</span>'
        : '<span class="badge badge-warning">Farming Input</span>';

      const priceDisplay = item.type === 'Finished Product'
        ? `BDT ${Number(item.sellingPrice).toFixed(2)}`
        : '<span style="color: var(--text-muted);">-</span>';

      let healthBadge = '';
      if (item.currentStock === 0) {
        healthBadge = '<span class="badge badge-out-of-stock">Out of Stock</span>';
      } else if (item.currentStock < item.minStockLevel) {
        healthBadge = '<span class="badge badge-low-stock">Low Stock</span>';
      } else {
        healthBadge = '<span class="badge badge-optimal">In Stock</span>';
      }

      const currentStockDisplay = `
        <div>
          ${item.currentStock > 0 
            ? `<strong style="color: var(--accent-color);">${item.currentStock} ${item.unit}</strong>` 
            : `<span style="color: var(--text-muted);">0 ${item.unit}</span>`}
          <div style="margin-top: 4px;">${healthBadge}</div>
        </div>
      `;

      return `
        <tr>
          <td><strong>${item.name}</strong><br><small style="color: var(--text-muted);">${item.id}</small></td>
          <td>${item.category}</td>
          <td>${typeBadge}</td>
          <td>${currentStockDisplay}</td>
          <td>${item.unit}</td>
          <td>${item.minStockLevel} ${item.unit}</td>
          <td><span class="badge ${item.rotationRule === 'FEFO' ? 'badge-warning' : 'badge-info'}">${item.rotationRule}</span></td>
          <td>${priceDisplay}</td>
          <td>${statusBadge}</td>
          <td>
            ${isFarmManager ? `
              <button class="btn btn-sm btn-outline" onclick="CatalogModule.openEditItemModal('${item.id}')">Edit</button>
              ${item.isActive 
                ? `<button class="btn btn-sm btn-danger" onclick="CatalogModule.deactivateItem('${item.id}')">Deactivate</button>` 
                : `<button class="btn btn-sm btn-primary" onclick="CatalogModule.reactivateItem('${item.id}')">Reactivate</button>`}
            ` : (isOfficer ? `
              <div style="display:flex; gap: 4px;">
                <button class="btn btn-sm btn-primary" onclick="InventoryModule.openReceiveForItem('${item.id}')" title="Receive / add stock">+ Stock</button>
                <button class="btn btn-sm btn-outline" onclick="InventoryModule.viewItemBatches('${item.id}')" title="View batches & adjust stock">Batches</button>
              </div>
            ` : '<span style="color: var(--text-muted); font-size:12px;">View Only</span>')}
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddItemModal() {
    document.getElementById('itemModalTitle').innerText = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemIdField').value = '';
    document.getElementById('itemUnit').removeAttribute('disabled');
    document.getElementById('sellingPriceGroup').style.display = 'none';
    document.getElementById('itemModal').classList.add('open');
  },

  openEditItemModal(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('itemModalTitle').innerText = `Edit Item: ${item.name}`;
    document.getElementById('itemIdField').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemType').value = item.type;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemStorage').value = item.storageRequirements;
    document.getElementById('itemPackaging').value = item.packagingDetails;
    document.getElementById('itemMinStock').value = item.minStockLevel;
    document.getElementById('itemRotationRule').value = item.rotationRule;

    const priceInput = document.getElementById('itemSellingPrice');
    const priceGroup = document.getElementById('sellingPriceGroup');
    if (item.type === 'Finished Product') {
      priceGroup.style.display = 'block';
      priceInput.value = item.sellingPrice || '';
    } else {
      priceGroup.style.display = 'none';
      priceInput.value = '';
    }

    document.getElementById('itemModal').classList.add('open');
  },

  closeItemModal() {
    document.getElementById('itemModal').classList.remove('open');
  },

  onTypeChange(selectElem) {
    const priceGroup = document.getElementById('sellingPriceGroup');
    if (selectElem.value === 'Finished Product') {
      priceGroup.style.display = 'block';
    } else {
      priceGroup.style.display = 'none';
    }
  },

  async saveItem(event) {
    event.preventDefault();
    const id = document.getElementById('itemIdField').value;
    const name = document.getElementById('itemName').value;
    const category = document.getElementById('itemCategory').value;
    const type = document.getElementById('itemType').value;
    const unit = document.getElementById('itemUnit').value;
    const storageRequirements = document.getElementById('itemStorage').value;
    const packagingDetails = document.getElementById('itemPackaging').value;
    const minStockLevel = document.getElementById('itemMinStock').value;
    const rotationRule = document.getElementById('itemRotationRule').value;
    const sellingPrice = document.getElementById('itemSellingPrice').value;

    const payload = {
      name, category, type, unit, storageRequirements,
      packagingDetails, minStockLevel, rotationRule,
      sellingPrice: type === 'Finished Product' ? sellingPrice : null
    };

    try {
      if (id) {
        await App.apiRequest(`/api/items/${id}`, 'PUT', payload);
        App.showBanner(`Item "${name}" updated successfully.`, 'success');
      } else {
        await App.apiRequest('/api/items', 'POST', payload);
        App.showBanner(`Item "${name}" added to catalog.`, 'success');
      }
      this.closeItemModal();
      this.loadItems();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async deactivateItem(id) {
    if (!confirm('Are you sure you want to deactivate this item? It will be removed from new transactions.')) return;
    try {
      await App.apiRequest(`/api/items/${id}/deactivate`, 'PATCH');
      App.showBanner('Item deactivated successfully.', 'success');
      this.loadItems();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async reactivateItem(id) {
    try {
      await App.apiRequest(`/api/items/${id}/reactivate`, 'PATCH');
      App.showBanner('Item reactivated successfully.', 'success');
      this.loadItems();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  exportCSV() {
    if (!this.items || this.items.length === 0) {
      App.showBanner('No items to export.', 'error');
      return;
    }
    const headers = ['Item Code', 'Item Name', 'Category', 'Type', 'Current Stock', 'Unit', 'Min Stock Level', 'Rotation Rule', 'Selling Price (BDT)', 'Status'];
    const rows = this.items.map(i => [
      `"${i.id}"`,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.category || '').replace(/"/g, '""')}"`,
      `"${i.type}"`,
      i.currentStock,
      `"${i.unit}"`,
      i.minStockLevel,
      `"${i.rotationRule}"`,
      i.sellingPrice || 0,
      i.isActive ? 'Active' : 'Deactivated'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    App.downloadCSV(csvContent, `item-catalog-${new Date().toISOString().split('T')[0]}.csv`);
    App.showBanner('Catalog exported to CSV successfully.', 'success');
  },

  // ----------------- Warehouses & Suppliers -----------------
  async loadWarehousesAndSuppliers() {
    try {
      const [whRes, supRes] = await Promise.all([
        App.apiRequest('/api/warehouses'),
        App.apiRequest('/api/suppliers')
      ]);
      this.warehouses = whRes.data;
      this.suppliers = supRes.data;
      this.renderWarehouses();
      this.renderSuppliers();
    } catch (err) {
      App.showBanner(`Failed to load warehouse or supplier data: ${err.message}`, 'error');
    }
  },

  renderWarehouses() {
    const container = document.getElementById('warehouseListContainer');
    if (!container) return;
    const isManager = App.currentRole === 'Farm Manager';

    container.innerHTML = this.warehouses.map(w => `
      <div class="card" style="margin-bottom: 12px; border-left: 4px solid ${w.isActive ? 'var(--primary-color)' : '#9e9e9e'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="margin: 0;">${w.name} ${w.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</h4>
            <p style="font-size: 13px; color: var(--text-muted); margin: 4px 0;"><strong>Location:</strong> ${w.location}</p>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0;"><strong>Storage Type:</strong> ${w.storageType}</p>
          </div>
          ${isManager ? `
            <div>
              ${w.isActive 
                ? `<button class="btn btn-sm btn-danger" onclick="CatalogModule.deactivateWarehouse('${w.id}')">Deactivate</button>` 
                : `<button class="btn btn-sm btn-primary" onclick="CatalogModule.reactivateWarehouse('${w.id}')">Reactivate</button>`}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  renderSuppliers() {
    const container = document.getElementById('supplierListContainer');
    if (!container) return;
    const isManager = App.currentRole === 'Farm Manager';

    container.innerHTML = this.suppliers.map(s => `
      <div class="card" style="margin-bottom: 12px; border-left: 4px solid ${s.isActive ? 'var(--info-color)' : '#9e9e9e'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="margin: 0;">${s.name} ${s.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</h4>
            <p style="font-size: 13px; color: var(--text-muted); margin: 4px 0;"><strong>Phone:</strong> ${s.phone} | <strong>Address:</strong> ${s.address}</p>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;"><strong>Supplied Items:</strong> ${(s.suppliedItems || []).join(', ')}</p>
          </div>
          ${isManager ? `
            <div>
              ${s.isActive 
                ? `<button class="btn btn-sm btn-danger" onclick="CatalogModule.deactivateSupplier('${s.id}')">Deactivate</button>` 
                : `<button class="btn btn-sm btn-primary" onclick="CatalogModule.reactivateSupplier('${s.id}')">Reactivate</button>`}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  openAddWarehouseModal() {
    document.getElementById('warehouseForm').reset();
    document.getElementById('warehouseModal').classList.add('open');
  },

  closeWarehouseModal() {
    document.getElementById('warehouseModal').classList.remove('open');
  },

  async saveWarehouse(event) {
    event.preventDefault();
    const name = document.getElementById('whName').value;
    const location = document.getElementById('whLocation').value;
    const storageType = document.getElementById('whStorageType').value;

    try {
      await App.apiRequest('/api/warehouses', 'POST', { name, location, storageType });
      App.showBanner(`Warehouse "${name}" created.`, 'success');
      this.closeWarehouseModal();
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async deactivateWarehouse(id) {
    if (!confirm('Deactivate this warehouse? Action is only allowed if stock balance is zero.')) return;
    try {
      await App.apiRequest(`/api/warehouses/${id}/deactivate`, 'PATCH');
      App.showBanner('Warehouse deactivated successfully.', 'success');
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async reactivateWarehouse(id) {
    try {
      await App.apiRequest(`/api/warehouses/${id}/reactivate`, 'PATCH');
      App.showBanner('Warehouse reactivated.', 'success');
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  openAddSupplierModal() {
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierModal').classList.add('open');
  },

  closeSupplierModal() {
    document.getElementById('supplierModal').classList.remove('open');
  },

  async saveSupplier(event) {
    event.preventDefault();
    const name = document.getElementById('supName').value;
    const phone = document.getElementById('supPhone').value;
    const address = document.getElementById('supAddress').value;
    const suppliedItems = document.getElementById('supItems').value;

    try {
      await App.apiRequest('/api/suppliers', 'POST', { name, phone, address, suppliedItems });
      App.showBanner(`Supplier "${name}" registered.`, 'success');
      this.closeSupplierModal();
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async deactivateSupplier(id) {
    try {
      await App.apiRequest(`/api/suppliers/${id}/deactivate`, 'PATCH');
      App.showBanner('Supplier deactivated.', 'success');
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async reactivateSupplier(id) {
    try {
      await App.apiRequest(`/api/suppliers/${id}/reactivate`, 'PATCH');
      App.showBanner('Supplier reactivated.', 'success');
      this.loadWarehousesAndSuppliers();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  }
};
