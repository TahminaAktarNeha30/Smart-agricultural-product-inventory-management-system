// public/js/dispatch.js
// Presentation layer logic for Order Review, FIFO/FEFO Batch Allocation, and Dispatch (Features 6 & 7)

const DispatchModule = {
  orders: [],
  selectedOrder: null,
  currentAllocations: {},

  async loadOrders() {
    try {
      const res = await App.apiRequest('/api/orders');
      this.orders = res.data;
      this.renderOrdersTable();
    } catch (err) {
      App.showBanner(`Error loading orders: ${err.message}`, 'error');
    }
  },

  renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🚚</div>
            <strong>No distributor orders placed yet.</strong><br>
            <small>Orders submitted by distributors will appear here for review and dispatch.</small>
          </td>
        </tr>
      `;
      return;
    }

    const isOfficer = App.currentRole === 'Warehouse Officer';

    tbody.innerHTML = this.orders.map(order => {
      let statusBadge = `<span class="badge badge-info">${order.status}</span>`;
      if (order.status === 'Approved') statusBadge = '<span class="badge badge-warning">Approved</span>';
      if (order.status === 'Dispatched') statusBadge = '<span class="badge badge-success">Dispatched</span>';
      if (order.status === 'Rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';
      if (order.status === 'Cancelled') statusBadge = '<span class="badge badge-secondary">Cancelled</span>';

      const itemsSummary = order.lines.map(l => `${l.itemName} (${l.quantity} ${l.unit})`).join(', ');

      return `
        <tr>
          <td><strong>${order.orderNumber}</strong><br><small style="color:var(--text-muted);">${new Date(order.placedAt).toLocaleDateString()}</small></td>
          <td>${order.distributorName}<br><small style="color:var(--text-muted);">${order.distributorPhone}</small></td>
          <td>${itemsSummary}</td>
          <td><strong>BDT ${Number(order.totalAmount).toFixed(2)}</strong></td>
          <td>${statusBadge}</td>
          <td>
            ${order.rejectionReason ? `<small style="color: var(--danger-color);">Reason: ${order.rejectionReason}</small>` : ''}
            ${order.dispatchedAt ? `<small style="color: var(--text-muted);">Dispatched by ${order.responsibleOfficer || 'Staff'}</small>` : ''}
          </td>
          <td>
            ${isOfficer ? `
              <div style="display: flex; gap: 4px;">
                ${order.status === 'Placed' ? `
                  <button class="btn btn-sm btn-primary" onclick="DispatchModule.approveOrder('${order.id}')">Approve</button>
                  <button class="btn btn-sm btn-danger" onclick="DispatchModule.openRejectModal('${order.id}')">Reject</button>
                ` : ''}
                ${order.status === 'Approved' ? `
                  <button class="btn btn-sm btn-primary" onclick="DispatchModule.openDispatchModal('${order.id}')">Prepare Dispatch</button>
                ` : ''}
                ${order.status === 'Dispatched' ? `
                  <button class="btn btn-sm btn-outline" onclick="DispatchModule.viewDispatchDetails('${order.id}')">View Dispatch</button>
                ` : ''}
              </div>
            ` : '<span style="color: var(--text-muted); font-size:12px;">View Only</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  async approveOrder(orderId) {
    if (!confirm('Approve this order for fulfillment?')) return;
    try {
      await App.apiRequest(`/api/orders/${orderId}/review`, 'PATCH', { action: 'APPROVE' });
      App.showBanner('Order approved successfully. It can now be prepared for dispatch.', 'success');
      this.loadOrders();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  openRejectModal(orderId) {
    document.getElementById('rejectOrderId').value = orderId;
    document.getElementById('rejectReason').value = '';
    document.getElementById('rejectModal').classList.add('open');
  },

  closeRejectModal() {
    document.getElementById('rejectModal').classList.remove('open');
  },

  async submitRejectOrder(event) {
    event.preventDefault();
    const orderId = document.getElementById('rejectOrderId').value;
    const rejectionReason = document.getElementById('rejectReason').value;

    try {
      await App.apiRequest(`/api/orders/${orderId}/review`, 'PATCH', {
        action: 'REJECT',
        rejectionReason
      });
      App.showBanner('Order rejected and reason recorded.', 'success');
      this.closeRejectModal();
      this.loadOrders();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  // ----------------- Dispatch Modal with FIFO/FEFO Allocation -----------------
  async openDispatchModal(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;
    this.selectedOrder = order;

    document.getElementById('dispOrderNumber').innerText = order.orderNumber;
    document.getElementById('dispDistributorInfo').innerText = `${order.distributorName} (${order.distributorPhone})`;
    
    const container = document.getElementById('dispatchLinesContainer');
    container.innerHTML = '<p style="text-align:center; padding: 20px;">Analyzing batch stock and computing FIFO/FEFO allocations...</p>';
    document.getElementById('dispatchModal').classList.add('open');

    let allFulfilled = true;
    let linesHtml = '';

    for (const line of order.lines) {
      try {
        const res = await App.apiRequest(`/api/stock/suggestions?itemId=${line.itemId}&quantity=${line.quantity}`);
        const suggestion = res.data;

        let batchListHtml = '';
        if (suggestion.allocations.length === 0) {
          batchListHtml = '<div style="color: var(--danger-color); padding: 8px; font-weight: 600;">No eligible non-expired stock available!</div>';
        } else {
          batchListHtml = suggestion.allocations.map(alloc => `
            <div class="allocation-item">
              <div>
                <strong>Batch: ${alloc.batchId}</strong> (${alloc.warehouseName})<br>
                <small style="color:var(--text-muted);">
                  Receiving: ${alloc.receivingDate} | Expiry: ${alloc.expiryDate || 'N/A'} | Status: ${alloc.expiryStatus}
                </small>
              </div>
              <div style="text-align: right;">
                <span style="font-weight:700; color: var(--primary-color);">Allocated: ${alloc.allocatedQuantity} ${alloc.unit}</span><br>
                <small style="color: var(--text-muted);">Batch Avail: ${alloc.availableQuantity} ${alloc.unit}</small>
              </div>
            </div>
          `).join('');
        }

        if (!suggestion.fulfilled) {
          allFulfilled = false;
        }

        linesHtml += `
          <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
              <div>
                <strong>${line.itemName}</strong> - Requested: <strong>${line.quantity} ${line.unit}</strong>
              </div>
              <div>
                <span class="badge ${suggestion.rotationRule === 'FEFO' ? 'badge-warning' : 'badge-info'}">Rule: ${suggestion.rotationRule}</span>
                ${suggestion.fulfilled 
                  ? '<span class="badge badge-success">Fully Allocatable</span>' 
                  : `<span class="badge badge-danger">Shortage: ${suggestion.shortfall} ${line.unit}</span>`}
              </div>
            </div>
            ${batchListHtml}
          </div>
        `;
      } catch (err) {
        allFulfilled = false;
        linesHtml += `<div style="color:var(--danger-color); padding:10px;">Error calculating allocation for ${line.itemName}: ${err.message}</div>`;
      }
    }

    container.innerHTML = linesHtml;

    const confirmBtn = document.getElementById('btnConfirmDispatch');
    const warningNotice = document.getElementById('dispatchShortageWarning');

    if (!allFulfilled) {
      warningNotice.style.display = 'block';
      warningNotice.innerText = 'Cannot dispatch order: One or more items have insufficient eligible stock. Orders must be dispatched completely or not at all (Constraint 7).';
      confirmBtn.setAttribute('disabled', 'disabled');
    } else {
      warningNotice.style.display = 'none';
      confirmBtn.removeAttribute('disabled');
    }
  },

  closeDispatchModal() {
    document.getElementById('dispatchModal').classList.remove('open');
    this.selectedOrder = null;
  },

  async confirmDispatch() {
    if (!this.selectedOrder) return;
    if (!confirm(`Confirm complete dispatch for order ${this.selectedOrder.orderNumber}? Stock will be permanently deducted.`)) return;

    try {
      const res = await App.apiRequest(`/api/orders/${this.selectedOrder.id}/dispatch`, 'POST', {
        officerName: App.officerName
      });
      App.showBanner(`Order ${res.data.orderNumber} successfully dispatched. Stock levels updated.`, 'success');
      this.closeDispatchModal();
      this.loadOrders();
      if (App.currentRole === 'Warehouse Officer') {
        InventoryModule.loadStockOverview();
      }
    } catch (err) {
      App.showBanner(`Dispatch Failed: ${err.message}`, 'error');
    }
  },

  viewDispatchDetails(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    let detailsMsg = `Order Number: ${order.orderNumber}\n`;
    detailsMsg += `Dispatched on: ${new Date(order.dispatchedAt).toLocaleString()}\n`;
    detailsMsg += `Responsible Officer: ${order.responsibleOfficer || 'Warehouse Officer'}\n\n`;
    detailsMsg += `Batch Deductions:\n`;

    if (order.dispatchAllocations) {
      order.dispatchAllocations.forEach(line => {
        detailsMsg += `• ${line.itemName}:\n`;
        line.allocations.forEach(a => {
          detailsMsg += `   - Batch ${a.batchId} (${a.warehouseName || a.warehouseId}): ${a.quantity} ${a.unit}\n`;
        });
      });
    }

    alert(detailsMsg);
  },

  exportCSV() {
    if (!this.orders || this.orders.length === 0) {
      App.showBanner('No orders to export.', 'error');
      return;
    }
    const headers = ['Order Number', 'Date Placed', 'Distributor Name', 'Phone', 'Items Count', 'Total Amount (BDT)', 'Status', 'Responsible Officer'];
    const rows = this.orders.map(o => [
      `"${o.orderNumber}"`,
      `"${new Date(o.placedAt).toISOString().split('T')[0]}"`,
      `"${(o.distributorName || '').replace(/"/g, '""')}"`,
      `"${o.distributorPhone}"`,
      o.lines.length,
      Number(o.totalAmount).toFixed(2),
      `"${o.status}"`,
      `"${o.responsibleOfficer || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    App.downloadCSV(csvContent, `orders-${new Date().toISOString().split('T')[0]}.csv`);
    App.showBanner('Orders exported to CSV successfully.', 'success');
  }
};
