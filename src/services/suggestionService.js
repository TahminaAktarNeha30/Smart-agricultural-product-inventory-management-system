// src/services/suggestionService.js
// Business logic for FIFO / FEFO Batch Suggestions (Feature 6: US-06)

const batchRepository = require('../dal/batchRepository');
const warehouseRepository = require('../dal/warehouseRepository');
const itemRepository = require('../dal/itemRepository');
const { ROTATION_RULES, getExpiryStatus } = require('../../config/constants');

class SuggestionService {
  /**
   * US-06: Suggests which batches to dispatch. FIFO = oldest received first; FEFO = earliest expiry first. Expired/empty batches are skipped and a large quantity is split across batches.
   *
   * @param {string} itemId - Item to dispatch.
   * @param {number} requiredQuantity - Quantity needed.
   * @returns {*} { fulfilled, shortfall, allocations: [{ batchId, allocatedQuantity, ... }] }.
   * @throws {Error} If the item does not exist or the quantity is not positive.
   */
  suggestBatchesForItem(itemId, requiredQuantity) {
    const item = itemRepository.getById(itemId);
    if (!item) {
      throw new Error(`Item with ID ${itemId} not found.`);
    }

    const neededQty = Number(requiredQuantity);
    if (isNaN(neededQty) || neededQty <= 0) {
      throw new Error('Required quantity must be a positive number.');
    }

    const warehouses = warehouseRepository.getAll();
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]));

    // US-06, Confirmation 6: Filter out batches that are expired or have zero remaining stock
    const batches = batchRepository.getByItemId(itemId).filter(b => {
      const remaining = Number(b.remainingQuantity);
      if (remaining <= 0) return false;
      const expiryStatus = getExpiryStatus(b.expiryDate);
      if (expiryStatus === 'EXPIRED') return false;
      return true;
    });

    // Sort batches according to item rule and tie-breakers (US-06, Confirmation 1-4)
    if (item.rotationRule === ROTATION_RULES.FEFO) {
      batches.sort((a, b) => {
        // Confirmation 3: Earlier expiry date first
        const expA = a.expiryDate || '9999-12-31';
        const expB = b.expiryDate || '9999-12-31';
        if (expA !== expB) {
          return expA.localeCompare(expB);
        }
        // Confirmation 4: Tie-breaker 1 -> earlier receiving date
        const recA = a.receivingDate || '';
        const recB = b.receivingDate || '';
        if (recA !== recB) {
          return recA.localeCompare(recB);
        }
        // Confirmation 4: Tie-breaker 2 -> batch ID
        return a.id.localeCompare(b.id);
      });
    } else {
      // FIFO
      batches.sort((a, b) => {
        // Confirmation 1: Oldest receiving date first
        const recA = a.receivingDate || '';
        const recB = b.receivingDate || '';
        if (recA !== recB) {
          return recA.localeCompare(recB);
        }
        // Confirmation 2: Tie-breaker -> batch ID
        return a.id.localeCompare(b.id);
      });
    }

    // Allocate across batches (US-06, Confirmation 5)
    let remainingToAllocate = neededQty;
    const suggestedAllocations = [];

    for (const batch of batches) {
      if (remainingToAllocate <= 0) break;

      const avail = Number(batch.remainingQuantity);
      const alloc = Math.min(avail, remainingToAllocate);

      suggestedAllocations.push({
        batchId: batch.id,
        warehouseId: batch.warehouseId,
        warehouseName: warehouseMap.get(batch.warehouseId) || batch.warehouseId,
        availableQuantity: avail,
        allocatedQuantity: Number(alloc.toFixed(3)),
        unit: batch.unit,
        receivingDate: batch.receivingDate,
        expiryDate: batch.expiryDate,
        expiryStatus: getExpiryStatus(batch.expiryDate)
      });

      remainingToAllocate = Number((remainingToAllocate - alloc).toFixed(3));
    }

    const totalAllocated = suggestedAllocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    const fulfilled = remainingToAllocate <= 0;

    return {
      itemId: item.id,
      itemName: item.name,
      rotationRule: item.rotationRule,
      requiredQuantity: neededQty,
      allocatedTotal: totalAllocated,
      shortfall: fulfilled ? 0 : Number((neededQty - totalAllocated).toFixed(3)),
      fulfilled,
      allocations: suggestedAllocations
    };
  }
}

module.exports = new SuggestionService();
