// src/services/alertService.js
// Business logic for Low-Stock and Expiry Alerts (Feature 8: US-8A, US-8B)

const itemRepository = require('../dal/itemRepository');
const batchRepository = require('../dal/batchRepository');
const warehouseRepository = require('../dal/warehouseRepository');
const { getBangladeshDateString, getExpiryStatus, ROLES } = require('../../config/constants');

class AlertService {
  /**
   * US-8A and US-8B: Builds the Low-Stock and Expiry alerts.
   * Low stock = total usable (non-expired) stock is BELOW the item's minimum level.
   * Expiring soon = expiry date is today up to 3 days ahead (Bangladesh date).
   * Expired = today is later than the expiry date.
   *
   * @param {string} userRole - Role of the person asking (Distributor is refused).
   * @returns {*} { summary, lowStockAlerts, expiringSoonAlerts, expiredAlerts }.
   * @throws {Error} If the role is Distributor.
   */
  getSystemAlerts(userRole) {
    if (userRole === ROLES.DISTRIBUTOR) {
      throw new Error('Access denied: Distributors are not permitted to view internal inventory alerts.');
    }

    const items = itemRepository.getAll().filter(i => i.isActive);
    const batches = batchRepository.getAll();
    const warehouses = warehouseRepository.getAll();
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]));
    const itemMap = new Map(items.map(i => [i.id, i]));

    const todayBD = getBangladeshDateString();

    // 1. Calculate Low-Stock Alerts (US-8A)
    const lowStockAlerts = [];
    for (const item of items) {
      const itemBatches = batches.filter(b => b.itemId === item.id);
      
      // Calculate total usable (non-expired) stock across ALL warehouses
      const usableStock = itemBatches
        .filter(b => getExpiryStatus(b.expiryDate) !== 'EXPIRED')
        .reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0);

      // US-8A, Confirmation 1 & 2: Alert if usable stock < minimum stock level
      if (usableStock < Number(item.minStockLevel)) {
        lowStockAlerts.push({
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          unit: item.unit,
          currentUsableStock: Number(usableStock.toFixed(3)),
          minStockLevel: Number(item.minStockLevel),
          shortage: Number((item.minStockLevel - usableStock).toFixed(3)),
          severity: usableStock === 0 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    // 2. Calculate Expiry Alerts (US-8B)
    const expiringSoonAlerts = [];
    const expiredAlerts = [];

    for (const batch of batches) {
      const remaining = Number(batch.remainingQuantity) || 0;

      // US-8B, Confirmation 4: Zero remaining stock batches have NO active expiry alert
      if (remaining <= 0) continue;
      if (!batch.expiryDate) continue;

      const expiryStatus = getExpiryStatus(batch.expiryDate);
      const item = itemMap.get(batch.itemId) || { name: 'Unknown Item', unit: batch.unit };
      const warehouseName = warehouseMap.get(batch.warehouseId) || batch.warehouseId;

      const alertPayload = {
        batchId: batch.id,
        itemId: batch.itemId,
        itemName: item.name,
        warehouseId: batch.warehouseId,
        warehouseName: warehouseName,
        remainingQuantity: remaining,
        unit: batch.unit,
        receivingDate: batch.receivingDate,
        expiryDate: batch.expiryDate,
        status: expiryStatus
      };

      if (expiryStatus === 'EXPIRING_SOON') {
        // US-8B, Confirmation 1 & 2: Today up to 3 days ahead in Bangladesh date
        expiringSoonAlerts.push(alertPayload);
      } else if (expiryStatus === 'EXPIRED') {
        // US-8B, Confirmation 3: Today later than expiry date
        expiredAlerts.push(alertPayload);
      }
    }

    return {
      currentBangladeshDate: todayBD,
      summary: {
        totalLowStock: lowStockAlerts.length,
        totalExpiringSoon: expiringSoonAlerts.length,
        totalExpired: expiredAlerts.length
      },
      lowStockAlerts,
      expiringSoonAlerts,
      expiredAlerts
    };
  }
}

module.exports = new AlertService();
