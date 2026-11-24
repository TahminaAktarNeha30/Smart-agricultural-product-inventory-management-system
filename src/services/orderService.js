// src/services/orderService.js
// Business logic for Distributor Orders and Dispatch (Feature 7: US-7A to US-7F)

const db = require('../dal/database');
const itemRepository = require('../dal/itemRepository');
const batchRepository = require('../dal/batchRepository');
const orderRepository = require('../dal/orderRepository');
const warehouseRepository = require('../dal/warehouseRepository');
const suggestionService = require('./suggestionService');
const { ITEM_TYPES, ORDER_STATUS, getExpiryStatus } = require('../../config/constants');

class OrderService {
  /**
   * US-7A: Lists finished products with their usable (non-expired) quantity and price. Farming inputs are hidden.
   *
   * @returns {*} Array of products.
   */
  getAvailableFinishedProducts() {
    const items = itemRepository.getAll().filter(i => i.isActive && i.type === ITEM_TYPES.FINISHED_PRODUCT);
    const allBatches = batchRepository.getAll();

    return items.map(item => {
      // Calculate total usable (non-expired) stock across all warehouses
      const usableStock = allBatches
        .filter(b => b.itemId === item.id && getExpiryStatus(b.expiryDate) !== 'EXPIRED')
        .reduce((sum, b) => sum + Number(b.remainingQuantity), 0);

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        packagingDetails: item.packagingDetails,
        sellingPrice: item.sellingPrice,
        availableStock: Number(usableStock.toFixed(3))
      };
    });
  }

  /**
   * US-7B: Creates an order with status 'Placed'. The selling price is saved on each line and stock is NOT reserved.
   *
   * @param {object} orderData - { distributorName, distributorPhone, lines: [{ itemId, quantity }] }.
   * @returns {*} The new order (with order number and total).
   * @throws {Error} If a field is missing, quantity is not positive, item is a farming input, or stock is too low.
   */
  placeOrder(orderData) {
    const { distributorName, distributorPhone, lines } = orderData;

    if (!distributorName || !distributorName.trim()) {
      throw new Error('Distributor name is required.');
    }
    if (!distributorPhone || !distributorPhone.trim()) {
      throw new Error('Distributor contact phone number is required.');
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('Order must contain at least one product item.');
    }

    const allBatches = batchRepository.getAll();
    const processedLines = [];
    let orderTotal = 0;

    for (const line of lines) {
      const { itemId, quantity } = line;
      const numQty = Number(quantity);

      // US-7B, Confirmation 4: Reject zero or negative quantities
      if (isNaN(numQty) || numQty <= 0) {
        throw new Error('Order quantity must be a positive number greater than zero.');
      }

      const item = itemRepository.getById(itemId);
      if (!item || !item.isActive) {
        throw new Error(`Item ${itemId} is invalid or inactive.`);
      }
      if (item.type !== ITEM_TYPES.FINISHED_PRODUCT) {
        throw new Error(`Item "${item.name}" is a farming input. Only finished products can be ordered.`);
      }

      // Check current available usable stock
      const currentUsableStock = allBatches
        .filter(b => b.itemId === itemId && getExpiryStatus(b.expiryDate) !== 'EXPIRED')
        .reduce((sum, b) => sum + Number(b.remainingQuantity), 0);

      // US-7B, Confirmation 3: If request exceeds current available stock, reject
      if (numQty > currentUsableStock) {
        throw new Error(`Requested quantity for "${item.name}" (${numQty} ${item.unit}) exceeds currently available stock (${currentUsableStock} ${item.unit}).`);
      }

      // US-7B, Confirmation 2: Selling price is locked at order time
      const unitPrice = item.sellingPrice;
      const lineTotal = Number((unitPrice * numQty).toFixed(2));
      orderTotal += lineTotal;

      processedLines.push({
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        quantity: numQty,
        unitPrice: unitPrice,
        lineTotal: lineTotal
      });
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder = {
      id: `ORDER-${Date.now()}`,
      orderNumber,
      distributorName: distributorName.trim(),
      distributorPhone: distributorPhone.trim(),
      lines: processedLines,
      totalAmount: Number(orderTotal.toFixed(2)),
      status: ORDER_STATUS.PLACED,
      rejectionReason: null,
      placedAt: new Date().toISOString(),
      approvedAt: null,
      dispatchedAt: null,
      responsibleOfficer: null,
      dispatchAllocations: null
    };

    return orderRepository.create(newOrder);
  }

  /**
   * US-7C: Approves or rejects a 'Placed' order. Rejecting needs a reason.
   *
   * @param {string} orderId - Order ID.
   * @param {string} action - 'APPROVE' or 'REJECT'.
   * @param {string} rejectionReason - Required when rejecting.
   * @param {string} officerName - Reviewing officer.
   * @returns {*} The updated order.
   * @throws {Error} If the order is not Placed, or the reason is missing.
   */
  reviewOrder(orderId, action, rejectionReason = null, officerName = 'Warehouse Officer') {
    const order = orderRepository.getById(orderId);
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }

    if (order.status !== ORDER_STATUS.PLACED) {
      throw new Error(`Only orders with status "Placed" can be reviewed. Current status: "${order.status}".`);
    }

    if (action === 'APPROVE') {
      // US-7C, Confirmation 1: Status becomes Approved, stock neither deducted nor reserved
      return orderRepository.update(orderId, {
        status: ORDER_STATUS.APPROVED,
        approvedAt: new Date().toISOString(),
        reviewedBy: officerName
      });
    } else if (action === 'REJECT') {
      // US-7C, Confirmation 3: Rejection reason is required
      if (!rejectionReason || !rejectionReason.trim()) {
        throw new Error('A rejection reason must be provided to reject an order.');
      }
      return orderRepository.update(orderId, {
        status: ORDER_STATUS.REJECTED,
        rejectionReason: rejectionReason.trim(),
        reviewedBy: officerName
      });
    } else {
      throw new Error('Invalid review action. Must be APPROVE or REJECT.');
    }
  }

  /**
   * US-7D: Dispatches an Approved order completely or not at all. Re-checks expiry and stock, deducts from the chosen batches once, and records the officer.
   *
   * @param {string} orderId - Order ID.
   * @param {string} officerName - Dispatching officer.
   * @param {object} customBatchAllocations - Optional manual batch choice instead of the FIFO/FEFO suggestion.
   * @returns {*} The dispatched order.
   * @throws {Error} If not Approved, already dispatched, stock short or a batch is expired (nothing is deducted).
   */
  dispatchOrder(orderId, officerName = 'Warehouse Officer', customBatchAllocations = null) {
    const order = orderRepository.getById(orderId);
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }

    // US-7D, Confirmation 6: Duplicate dispatch check
    if (order.status === ORDER_STATUS.DISPATCHED) {
      throw new Error(`Order "${order.orderNumber}" has already been dispatched. No additional stock will be deducted.`);
    }

    // US-7D, Confirmation 4: Order must be Approved
    if (order.status !== ORDER_STATUS.APPROVED) {
      throw new Error(`Order cannot be dispatched because its status is "${order.status}". Only "Approved" orders can be dispatched.`);
    }

    // Determine batch allocations for each line
    const plannedAllocations = [];
    const allBatches = batchRepository.getAll();
    const batchMap = new Map(allBatches.map(b => [b.id, b]));

    for (const line of order.lines) {
      let lineAllocations = [];

      if (customBatchAllocations && customBatchAllocations[line.itemId]) {
        // Manual batch selection provided
        const userAllocs = customBatchAllocations[line.itemId];
        let totalManual = 0;

        for (const alloc of userAllocs) {
          const b = batchMap.get(alloc.batchId);
          if (!b) throw new Error(`Selected batch "${alloc.batchId}" does not exist.`);
          
          // US-7D, Confirmation 5: Check batch expiry
          const expStatus = getExpiryStatus(b.expiryDate);
          if (expStatus === 'EXPIRED') {
            throw new Error(`Dispatch blocked: Selected batch "${b.id}" for item "${line.itemName}" has expired.`);
          }

          const allocQty = Number(alloc.quantity);
          if (allocQty <= 0) throw new Error('Allocated quantity must be greater than zero.');
          if (allocQty > Number(b.remainingQuantity)) {
            throw new Error(`Dispatch blocked: Batch "${b.id}" has only ${b.remainingQuantity} ${b.unit} available, but ${allocQty} was requested.`);
          }

          totalManual += allocQty;
          lineAllocations.push({
            batchId: b.id,
            warehouseId: b.warehouseId,
            quantity: allocQty,
            unit: b.unit
          });
        }

        if (totalManual !== line.quantity) {
          throw new Error(`Dispatch blocked: Manual batch allocation sum (${totalManual}) does not match order line quantity (${line.quantity}) for "${line.itemName}".`);
        }
      } else {
        // US-06: Automatic FIFO/FEFO suggestion
        const suggestion = suggestionService.suggestBatchesForItem(line.itemId, line.quantity);
        if (!suggestion.fulfilled) {
          // US-7D, Confirmation 5 & 7: Shortage blocks entire dispatch
          throw new Error(`Dispatch blocked: Insufficient eligible non-expired stock for "${line.itemName}". Required: ${line.quantity} ${line.unit}, Available: ${suggestion.allocatedTotal} ${line.unit}. Order remains Approved.`);
        }
        lineAllocations = suggestion.allocations.map(a => ({
          batchId: a.batchId,
          warehouseId: a.warehouseId,
          warehouseName: a.warehouseName,
          quantity: a.allocatedQuantity,
          unit: a.unit
        }));
      }

      plannedAllocations.push({
        itemId: line.itemId,
        itemName: line.itemName,
        allocations: lineAllocations
      });
    }

    // Atomic execution of entire multi-line deduction (NFR-04, NFR-05, US-7D Confirmation 3)
    const dispatchTimestamp = new Date().toISOString();
    let updatedOrder;

    db.executeTransaction(state => {
      const liveOrder = state.orders.find(o => o.id === orderId);
      if (!liveOrder || liveOrder.status !== ORDER_STATUS.APPROVED) {
        throw new Error('Order status changed during transaction processing.');
      }

      // Deduct batches and create dispatch transaction records
      for (const linePlan of plannedAllocations) {
        for (const alloc of linePlan.allocations) {
          const batch = state.batches.find(b => b.id === alloc.batchId);
          if (!batch) {
            throw new Error(`Batch "${alloc.batchId}" not found in database.`);
          }

          if (getExpiryStatus(batch.expiryDate) === 'EXPIRED') {
            throw new Error(`Batch "${batch.id}" expired before transaction could commit.`);
          }

          if (Number(alloc.quantity) > Number(batch.remainingQuantity)) {
            throw new Error(`Concurrent modification: batch "${batch.id}" stock fell below required quantity.`);
          }

          batch.remainingQuantity = Number((batch.remainingQuantity - alloc.quantity).toFixed(3));

          const txRecord = {
            id: `TX-DISP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'Order Dispatch',
            orderId: liveOrder.id,
            orderNumber: liveOrder.orderNumber,
            batchId: batch.id,
            itemId: batch.itemId,
            warehouseId: batch.warehouseId,
            quantity: alloc.quantity,
            unit: batch.unit,
            officerName: officerName || 'Warehouse Officer',
            timestamp: dispatchTimestamp,
            details: {
              distributorName: liveOrder.distributorName,
              distributorPhone: liveOrder.distributorPhone
            }
          };
          state.transactions.push(txRecord);
        }
      }

      liveOrder.status = ORDER_STATUS.DISPATCHED;
      liveOrder.dispatchedAt = dispatchTimestamp;
      liveOrder.responsibleOfficer = officerName || 'Warehouse Officer';
      liveOrder.dispatchAllocations = plannedAllocations;
      updatedOrder = liveOrder;
    });

    return updatedOrder;
  }

  /**
   * US-7E: Shows an order only when order number AND phone number both match.
   *
   * @param {string} orderNumber - Order number.
   * @param {string} phone - Phone used when ordering.
   * @returns {*} The matching order.
   * @throws {Error} If either value is missing or they do not match.
   */
  trackOrder(orderNumber, phone) {
    if (!orderNumber || !phone) {
      throw new Error('Please enter both Order Number and Phone Number.');
    }
    const order = orderRepository.findByOrderNumberAndPhone(orderNumber, phone);
    // US-7E, Confirmation 2: If phone doesn't match or order doesn't exist, generic error & do not reveal details
    if (!order) {
      throw new Error('Order not found or the phone number does not match our records.');
    }
    return order;
  }

  /**
   * US-7F: Cancels a Placed or Approved order. Stock is unchanged.
   *
   * @param {string} orderId - Order ID.
   * @param {string} distributorPhone - Phone used when ordering.
   * @returns {*} The cancelled order.
   * @throws {Error} If the phone does not match or the order is Dispatched/Rejected/Cancelled.
   */
  cancelOrder(orderId, distributorPhone) {
    const order = orderRepository.getById(orderId);
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }

    // Verify distributor phone if supplied
    if (distributorPhone) {
      const clean1 = (distributorPhone || '').replace(/[\s\-\+]/g, '');
      const clean2 = (order.distributorPhone || '').replace(/[\s\-\+]/g, '');
      if (clean1 !== clean2) {
        throw new Error('Phone number does not match this order.');
      }
    }

    // US-7F, Confirmation 2: Block cancellation if Dispatched
    if (order.status === ORDER_STATUS.DISPATCHED) {
      throw new Error('Cannot cancel order because it has already been dispatched.');
    }

    // US-7F, Confirmation 3: Block cancellation if Rejected or Cancelled
    if (order.status === ORDER_STATUS.REJECTED || order.status === ORDER_STATUS.CANCELLED) {
      throw new Error(`Cannot cancel order because it is already "${order.status}".`);
    }

    // US-7F, Confirmation 1: Cancel Placed or Approved order without changing stock
    return orderRepository.update(orderId, {
      status: ORDER_STATUS.CANCELLED,
      cancelledAt: new Date().toISOString()
    });
  }

  /**
   * Returns all orders (used by the Warehouse Officer).
   *
   * @returns {*} Array of orders.
   */
  getAllOrders() {
    return orderRepository.getAll();
  }

  /**
   * Finds one order by ID.
   *
   * @param {string} id - Order ID.
   * @returns {*} The order object.
   * @throws {Error} If no order has this ID.
   */
  getOrderById(id) {
    return orderRepository.getById(id);
  }
}

module.exports = new OrderService();
