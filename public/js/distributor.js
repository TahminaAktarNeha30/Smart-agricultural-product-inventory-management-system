// public/js/distributor.js
// Presentation layer logic for Distributor Catalog, Order Placement, and Tracking (Feature 7)

const DistributorModule = {
  products: [],
  cart: {}, // { itemId: quantity }

  async loadProducts() {
    try {
      const res = await App.apiRequest('/api/orders/products');
      this.products = res.data;
      this.renderProductCatalog();
      this.renderCartSummary();
    } catch (err) {
      App.showBanner(`Failed to load product catalog: ${err.message}`, 'error');
    }
  },

  renderProductCatalog() {
    const container = document.getElementById('distributorProductList');
    if (!container) return;

    if (this.products.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">No finished products currently available for distribution.</div>';
      return;
    }

    container.innerHTML = this.products.map(p => `
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h4 style="margin: 0; color: var(--primary-color);">${p.name}</h4>
            <span class="badge badge-info">${p.category}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin: 6px 0;"><strong>Packaging:</strong> ${p.packagingDetails || 'Standard packaging'}</p>
          <p style="font-size: 14px; margin: 4px 0;"><strong>Price:</strong> <span style="font-size: 16px; color: var(--primary-color); font-weight:700;">BDT ${Number(p.sellingPrice).toFixed(2)}</span> / ${p.unit}</p>
          <p style="font-size: 13px; color: ${p.availableStock > 0 ? 'var(--success-color)' : 'var(--danger-color)'}; margin: 4px 0;">
            <strong>Available Usable Stock:</strong> ${p.availableStock} ${p.unit}
          </p>
        </div>
        <div style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <div class="input-with-unit" style="margin-bottom: 8px;">
            <input type="number" id="qty_${p.id}" class="form-control" placeholder="Qty" min="1" max="${p.availableStock}" value="${this.cart[p.id] || ''}">
            <span class="unit-addon">${p.unit}</span>
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%; justify-content:center;" onclick="DistributorModule.updateCartItem('${p.id}')">
            ${this.cart[p.id] ? 'Update Order Line' : 'Add to Order'}
          </button>
        </div>
      </div>
    `).join('');
  },

  updateCartItem(itemId) {
    const input = document.getElementById(`qty_${itemId}`);
    if (!input) return;
    const qty = Number(input.value);

    if (isNaN(qty) || qty <= 0) {
      delete this.cart[itemId];
      input.value = '';
      App.showBanner('Item removed from order.', 'info');
    } else {
      const product = this.products.find(p => p.id === itemId);
      if (product && qty > product.availableStock) {
        App.showBanner(`Requested quantity (${qty} ${product.unit}) exceeds available stock (${product.availableStock} ${product.unit}).`, 'error');
        return;
      }
      this.cart[itemId] = qty;
      App.showBanner(`Added ${qty} ${product ? product.unit : ''} of ${product ? product.name : ''} to order.`, 'success');
    }

    this.renderCartSummary();
  },

  renderCartSummary() {
    const container = document.getElementById('cartSummaryContainer');
    const totalEl = document.getElementById('cartTotalAmount');
    if (!container) return;

    const itemIds = Object.keys(this.cart);
    if (itemIds.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No items selected yet. Select products from the catalog above.</p>';
      if (totalEl) totalEl.innerText = 'BDT 0.00';
      return;
    }

    let grandTotal = 0;
    container.innerHTML = itemIds.map(id => {
      const p = this.products.find(prod => prod.id === id);
      if (!p) return '';
      const qty = this.cart[id];
      const lineTotal = Number((p.sellingPrice * qty).toFixed(2));
      grandTotal += lineTotal;

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size:13px;">
          <div>
            <strong>${p.name}</strong> (${qty} ${p.unit} @ BDT ${p.sellingPrice})
          </div>
          <div style="display:flex; align-items:center; gap: 8px;">
            <span>BDT ${lineTotal.toFixed(2)}</span>
            <button class="btn btn-sm btn-outline" style="padding: 2px 6px; color: var(--danger-color);" onclick="DistributorModule.removeCartItem('${id}')">✕</button>
          </div>
        </div>
      `;
    }).join('');

    if (totalEl) totalEl.innerText = `BDT ${grandTotal.toFixed(2)}`;
  },

  removeCartItem(id) {
    delete this.cart[id];
    const input = document.getElementById(`qty_${id}`);
    if (input) input.value = '';
    this.renderCartSummary();
  },

  async submitOrder(event) {
    event.preventDefault();
    const distributorName = document.getElementById('distName').value;
    const distributorPhone = document.getElementById('distPhone').value;

    const itemIds = Object.keys(this.cart);
    if (itemIds.length === 0) {
      App.showBanner('Please select at least one product before placing an order.', 'error');
      return;
    }

    const lines = itemIds.map(id => ({
      itemId: id,
      quantity: this.cart[id]
    }));

    try {
      const res = await App.apiRequest('/api/orders', 'POST', {
        distributorName,
        distributorPhone,
        lines
      });

      const order = res.data;
      App.showBanner(`Order placed successfully! Your Order Number is: ${order.orderNumber}. Save this number with your phone number to track order status.`, 'success');

      // Clear cart
      this.cart = {};
      document.getElementById('distributorOrderForm').reset();
      this.renderProductCatalog();
      this.renderCartSummary();

      // Pre-fill tracking form
      document.getElementById('trackOrderNumber').value = order.orderNumber;
      document.getElementById('trackPhone').value = distributorPhone;
      App.showSection('track-orders-sec');
      this.searchOrderTracking();
    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  // ----------------- Order Tracking -----------------
  initTrackingView() {
    // Ready for input
  },

  renderOrderStepper(status) {
    const container = document.getElementById('trackResStepperContainer');
    if (!container) return;

    if (status === 'Cancelled') {
      container.innerHTML = `
        <div class="order-stepper">
          <div class="stepper-line"><div class="stepper-line-progress" style="width: 100%; background: var(--danger-color);"></div></div>
          <div class="stepper-step completed">
            <div class="step-circle">✓</div>
            <div class="step-title">Order Placed</div>
            <div class="step-sub">Submitted</div>
          </div>
          <div class="stepper-step rejected">
            <div class="step-circle">✕</div>
            <div class="step-title">Order Cancelled</div>
            <div class="step-sub">By Distributor</div>
          </div>
        </div>
      `;
      return;
    }

    if (status === 'Rejected') {
      container.innerHTML = `
        <div class="order-stepper">
          <div class="stepper-line"><div class="stepper-line-progress" style="width: 100%; background: var(--danger-color);"></div></div>
          <div class="stepper-step completed">
            <div class="step-circle">✓</div>
            <div class="step-title">Order Placed</div>
            <div class="step-sub">Submitted</div>
          </div>
          <div class="stepper-step rejected">
            <div class="step-circle">✕</div>
            <div class="step-title">Order Rejected</div>
            <div class="step-sub">See Reason Below</div>
          </div>
        </div>
      `;
      return;
    }

    // Normal progression: Placed -> Approved -> Dispatched
    let step1Class = 'stepper-step completed';
    let step2Class = 'stepper-step';
    let step3Class = 'stepper-step';
    let progressWidth = '15%';

    if (status === 'Placed') {
      step1Class = 'stepper-step active';
      progressWidth = '15%';
    } else if (status === 'Approved') {
      step1Class = 'stepper-step completed';
      step2Class = 'stepper-step active';
      progressWidth = '50%';
    } else if (status === 'Dispatched') {
      step1Class = 'stepper-step completed';
      step2Class = 'stepper-step completed';
      step3Class = 'stepper-step completed';
      progressWidth = '100%';
    }

    container.innerHTML = `
      <div class="order-stepper">
        <div class="stepper-line"><div class="stepper-line-progress" style="width: ${progressWidth};"></div></div>
        <div class="${step1Class}">
          <div class="step-circle">1</div>
          <div class="step-title">Order Placed</div>
          <div class="step-sub">Received</div>
        </div>
        <div class="${step2Class}">
          <div class="step-circle">2</div>
          <div class="step-title">Approved</div>
          <div class="step-sub">Stock Reserved</div>
        </div>
        <div class="${step3Class}">
          <div class="step-circle">3</div>
          <div class="step-title">Dispatched</div>
          <div class="step-sub">Completed</div>
        </div>
      </div>
    `;
  },

  async searchOrderTracking(event) {
    if (event) event.preventDefault();
    const orderNumber = document.getElementById('trackOrderNumber').value.trim();
    const phone = document.getElementById('trackPhone').value.trim();

    const resultBox = document.getElementById('trackingResultBox');
    resultBox.style.display = 'none';

    try {
      const res = await App.apiRequest(`/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`);
      const order = res.data;

      resultBox.style.display = 'block';
      document.getElementById('trackResOrderNum').innerText = order.orderNumber;
      document.getElementById('trackResDistributor').innerText = `${order.distributorName} (${order.distributorPhone})`;
      document.getElementById('trackResPlacedAt').innerText = new Date(order.placedAt).toLocaleString();
      document.getElementById('trackResTotal').innerText = `BDT ${Number(order.totalAmount).toFixed(2)}`;

      const statusEl = document.getElementById('trackResStatus');
      let statusBadge = `<span class="badge badge-info">${order.status}</span>`;
      if (order.status === 'Approved') statusBadge = '<span class="badge badge-warning">Approved (Awaiting Dispatch)</span>';
      if (order.status === 'Dispatched') statusBadge = '<span class="badge badge-success">Dispatched</span>';
      if (order.status === 'Rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';
      if (order.status === 'Cancelled') statusBadge = '<span class="badge badge-secondary">Cancelled</span>';
      statusEl.innerHTML = statusBadge;

      // Render Visual Progress Stepper
      this.renderOrderStepper(order.status);

      const reasonRow = document.getElementById('trackResRejectionRow');
      if (order.status === 'Rejected' && order.rejectionReason) {
        reasonRow.style.display = 'block';
        document.getElementById('trackResRejectionReason').innerText = order.rejectionReason;
      } else {
        reasonRow.style.display = 'none';
      }

      // Render order lines
      const linesTbody = document.getElementById('trackResLinesBody');
      linesTbody.innerHTML = order.lines.map(l => `
        <tr>
          <td>${l.itemName}</td>
          <td>${l.quantity} ${l.unit}</td>
          <td>BDT ${Number(l.unitPrice).toFixed(2)}</td>
          <td>BDT ${Number(l.lineTotal).toFixed(2)}</td>
        </tr>
      `).join('');

      // Cancellation button logic (US-7F)
      const cancelBtn = document.getElementById('btnCancelOrder');
      if (order.status === 'Placed' || order.status === 'Approved') {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.onclick = () => DistributorModule.cancelOrder(order.id, phone);
      } else {
        cancelBtn.style.display = 'none';
      }

    } catch (err) {
      App.showBanner(err.message, 'error');
    }
  },

  async cancelOrder(orderId, phone) {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be reversed.')) return;
    try {
      const res = await App.apiRequest(`/api/orders/${orderId}/cancel`, 'PATCH', {
        distributorPhone: phone
      });
      App.showBanner(`Order ${res.data.orderNumber} has been cancelled.`, 'success');
      this.searchOrderTracking();
    } catch (err) {
      App.showBanner(`Cancellation failed: ${err.message}`, 'error');
    }
  }
};
