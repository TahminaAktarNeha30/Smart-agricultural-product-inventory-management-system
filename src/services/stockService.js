// src/services/stockService.js
// Business logic for Stock Receiving, Viewing, Usage, and Wastage (Features 3, 4, 5)

const db = require('../dal/database');
const itemRepository = require('../dal/itemRepository');
const warehouseRepository = require('../dal/warehouseRepository');
const supplierRepository = require('../dal/supplierRepository');
const batchRepository = require('../dal/batchRepository');
const { ITEM_TYPES, ROTATION_RULES, WASTAGE_REASONS, getExpiryStatus } = require('../../config/constants');

class StockService {
  /**
   * US-03: Records incoming stock as a NEW batch and writes a receipt log. Rejects bad quantity, missing/invalid expiry, inactive supplier/warehouse and duplicate submissions.
   *
   * @param {object} data - Receipt details: itemId, warehouseId, sourceType, supplierId or farm details, receivingDate, expiryDate, quantity, transactionToken.
   * @param {string} officerName - Name of the logged-in officer (saved in the log).
   * @returns {*} The created batch and its transaction record.
   * @throws {Error} If any validation rule fails (nothing is saved).
   */
  receiveStock(data, officerName = 'Warehouse Officer') {
    const {
      batchId,
      itemId,
      warehouseId,
      sourceType,
      supplierId,
      farmSourceDescription,
      harvestDate,
      receivingDate,
      expiryDate,
      quantity,
      transactionToken // Prevents double submission (NFR-05, US-03 Confirmation 7)
    } = data;

    // US-03, Confirmation 6: Quantity must be strictly positive
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new Error('Receipt quantity must be a positive number greater than zero.');
    }

    // US-03, Confirmation 1: Active item and warehouse must exist
    const item = itemRepository.getById(itemId);
    if (!item) throw new Error(`Item with ID ${itemId} does not exist.`);
    if (!item.isActive) throw new Error(`Item "${item.name}" is deactivated and cannot receive stock.`);

    const warehouse = warehouseRepository.getById(warehouseId);
    if (!warehouse) throw new Error(`Warehouse with ID ${warehouseId} does not exist.`);
    if (!warehouse.isActive) throw new Error(`Warehouse "${warehouse.name}" is deactivated and cannot receive stock.`);

    if (!receivingDate) throw new Error('Receiving date is required.');

    // Source validation: Supplier Purchase vs Farm Production
    if (sourceType === 'Supplier Purchase') {
      if (!supplierId) {
        throw new Error('An active supplier must be selected for supplier purchases.');
      }
      const supplier = supplierRepository.getById(supplierId);
      if (!supplier) throw new Error(`Supplier with ID ${supplierId} does not exist.`);
      if (!supplier.isActive) throw new Error(`Supplier "${supplier.name}" is deactivated and cannot be selected.`);
    } else if (sourceType === 'Farm Production') {
      if (!farmSourceDescription || !farmSourceDescription.trim()) {
        throw new Error('Farm source description is required for farm production receipts.');
      }
      if (!harvestDate) {
        throw new Error('Harvest or production date is required for farm production receipts.');
      }
    } else {
      throw new Error('Invalid stock source. Must be either "Supplier Purchase" or "Farm Production".');
    }

    // US-03, Confirmation 5: Expiry validation
    const requiresExpiry = item.rotationRule === ROTATION_RULES.FEFO || item.category.toLowerCase().includes('perish');
    if (requiresExpiry) {
      if (!expiryDate) {
        throw new Error(`Item "${item.name}" uses FEFO rotation and requires an expiry date.`);
      }
      if (expiryDate < receivingDate) {
        throw new Error('Expiry date cannot be earlier than the receiving date.');
      }
    }

    const finalBatchId = (batchId && batchId.trim()) 
      ? batchId.trim() 
      : `B-${Date.now().toString().slice(-6)}`;

    // US-03, Confirmation 7 & NFR-05: Prevent duplicate receipt
    const existingBatch = batchRepository.getById(finalBatchId);
    if (existingBatch) {
      throw new Error(`Batch "${finalBatchId}" has already been confirmed. Duplicate receipt rejected.`);
    }

    const newBatch = {
      id: finalBatchId,
      itemId,
      warehouseId,
      sourceType,
      supplierId: sourceType === 'Supplier Purchase' ? supplierId : null,
      farmSourceDescription: sourceType === 'Farm Production' ? farmSourceDescription.trim() : null,
      harvestDate: sourceType === 'Farm Production' ? harvestDate : null,
      receivingDate,
      expiryDate: expiryDate || null,
      initialQuantity: numQty,
      remainingQuantity: numQty,
      unit: item.unit,
      createdAt: new Date().toISOString()
    };

    const txRecord = {
      id: transactionToken || `TX-REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'Stock Receipt',
      batchId: finalBatchId,
      itemId,
      warehouseId,
      quantity: numQty,
      unit: item.unit,
      officerName: officerName || 'Warehouse Officer',
      timestamp: new Date().toISOString(),
      details: {
        sourceType,
        supplierId: newBatch.supplierId,
        farmSourceDescription: newBatch.farmSourceDescription,
        receivingDate,
        expiryDate: newBatch.expiryDate
      }
    };

    // Atomic persistence of batch and receipt log (NFR-04)
    db.executeTransaction(state => {
      // Same form submitted twice (same token) -> do not create a second batch (US-03 Conf 7, NFR-05)
      if (transactionToken && state.transactions.some(t => t.id === transactionToken)) {
        throw new Error('Duplicate submission detected. This receipt was already confirmed.');
      }
      // Re-verify inside lock for concurrent safety
      if (state.batches.some(b => b.id.toLowerCase() === finalBatchId.toLowerCase())) {
        throw new Error(`Batch "${finalBatchId}" already exists.`);
      }
      state.batches.push(newBatch);
      state.transactions.push(txRecord);
    });

    return { batch: newBatch, transaction: txRecord };
  }

  /**
   * US-04: Returns stock grouped by item with a batch list. Empty batches are hidden unless requested; expired batches are labelled and not counted as usable.
   *
   * @param {object} filters - Optional { warehouseId, itemId, showEmptyBatches }.
   * @returns {*} Stock overview with totals and batches.
   */
  getStockOverview(filters = {}) {
    const { warehouseId, itemId, showEmptyBatches = false } = filters;
    const items = itemRepository.getAll();
    const warehouses = warehouseRepository.getAll();
    let batches = batchRepository.getAll();

    if (warehouseId) {
      batches = batches.filter(b => b.warehouseId === warehouseId);
    }
    if (itemId) {
      batches = batches.filter(b => b.itemId === itemId);
    }

    // US-04, Confirmation 4 & 5: Empty batches hidden by default unless toggle enabled
    const allowEmpty = showEmptyBatches === true || showEmptyBatches === 'true';
    if (!allowEmpty) {
      batches = batches.filter(b => Number(b.remainingQuantity) > 0);
    }

    // Enrich batches with item details, warehouse details, and expiry status
    const enrichedBatches = batches.map(batch => {
      const itm = items.find(i => i.id === batch.itemId) || { name: 'Unknown', unit: batch.unit, category: 'Unknown' };
      const wh = warehouses.find(w => w.id === batch.warehouseId) || { name: 'Unknown Warehouse' };
      const expiryStatus = getExpiryStatus(batch.expiryDate);

      // US-04, Confirmation 3: Expired batches excluded from dispatchable stock
      const isDispatchable = expiryStatus !== 'EXPIRED' && Number(batch.remainingQuantity) > 0;

      return {
        ...batch,
        itemName: itm.name,
        category: itm.category,
        warehouseName: wh.name,
        expiryStatus, // 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NONE'
        isDispatchable
      };
    });

    // Calculate aggregated item totals
    const itemSummaries = items.map(item => {
      const itemBatches = enrichedBatches.filter(b => b.itemId === item.id);
      const totalStock = itemBatches.reduce((acc, b) => acc + Number(b.remainingQuantity), 0);
      const usableStock = itemBatches
        .filter(b => b.expiryStatus !== 'EXPIRED')
        .reduce((acc, b) => acc + Number(b.remainingQuantity), 0);
      const expiredStock = totalStock - usableStock;

      return {
        item,
        totalStock,
        usableStock,
        expiredStock,
        batches: itemBatches
      };
    });

    return {
      batches: enrichedBatches,
      summaries: itemSummaries
    };
  }

  /**
   * US-05A: Deducts a farming input from one batch. Finished products and expired batches are blocked.
   *
   * @param {object} data - batchId, quantity, date, purpose, transactionToken.
   * @param {string} officerName - Name of the logged-in officer.
   * @returns {*} Remaining balance details.
   * @throws {Error} If quantity is invalid/too large, batch expired, or item is a finished product.
   */
  recordUsage(data, officerName = 'Warehouse Officer') {
    const { batchId, quantity, date, purpose, transactionToken } = data;

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new Error('Usage quantity must be a positive number greater than zero.');
    }
    if (!date) throw new Error('Usage date is required.');
    if (!purpose || !purpose.trim()) throw new Error('Usage purpose is required.');

    const batch = batchRepository.getById(batchId);
    if (!batch) throw new Error(`Batch with ID "${batchId}" not found.`);

    const item = itemRepository.getById(batch.itemId);
    if (!item) throw new Error('Associated item not found.');

    // US-05A, Confirmation 4: Finished products cannot be used in farming input usage
    if (item.type !== ITEM_TYPES.FARMING_INPUT) {
      throw new Error(`Item "${item.name}" is a Finished Product. Usage recording is only permitted for Farming Inputs.`);
    }

    // US-05A, Confirmation 3: Block expired inputs from normal usage
    const expiryStatus = getExpiryStatus(batch.expiryDate);
    if (expiryStatus === 'EXPIRED') {
      throw new Error(`Batch "${batch.id}" is expired and blocked from normal usage. Expired stock must be written off as wastage.`);
    }

    // US-05A, Confirmation 2: Remaining stock check
    if (numQty > Number(batch.remainingQuantity)) {
      throw new Error(`Requested usage quantity (${numQty} ${batch.unit}) exceeds available batch balance (${batch.remainingQuantity} ${batch.unit}). Balance remains ${batch.remainingQuantity} ${batch.unit}.`);
    }

    const txId = transactionToken || `TX-USE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Atomic stock deduction (NFR-04, NFR-05)
    let updatedBatch;
    db.executeTransaction(state => {
      // Duplicate prevention
      if (state.transactions.some(t => t.id === txId)) {
        throw new Error('Duplicate transaction detected. Usage will not be deducted again.');
      }

      const targetBatch = state.batches.find(b => b.id === batchId);
      if (!targetBatch) throw new Error('Batch not found in transaction.');
      if (numQty > Number(targetBatch.remainingQuantity)) {
        throw new Error('Insufficient stock remaining.');
      }

      targetBatch.remainingQuantity = Number((targetBatch.remainingQuantity - numQty).toFixed(3));
      updatedBatch = targetBatch;

      const txRecord = {
        id: txId,
        type: 'Input Usage',
        batchId,
        itemId: item.id,
        warehouseId: batch.warehouseId,
        quantity: numQty,
        unit: batch.unit,
        officerName: officerName || 'Warehouse Officer',
        timestamp: new Date().toISOString(),
        details: {
          usageDate: date,
          purpose: purpose.trim()
        }
      };
      state.transactions.push(txRecord);
    });

    return {
      success: true,
      batchId,
      remainingBalance: updatedBatch.remainingQuantity,
      unit: batch.unit
    };
  }

  /**
   * US-05B: Deducts spoiled/expired/damaged stock. A reason is mandatory; expired batches are allowed here.
   *
   * @param {object} data - batchId, quantity, date, reason, transactionToken.
   * @param {string} officerName - Name of the logged-in officer.
   * @returns {*} Remaining balance details.
   * @throws {Error} If reason is missing, quantity is invalid or exceeds the balance.
   */
  recordWastage(data, officerName = 'Warehouse Officer') {
    const { batchId, quantity, date, reason, transactionToken } = data;

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new Error('Wastage quantity must be a positive number greater than zero.');
    }
    if (!date) throw new Error('Wastage date is required.');

    // US-05B, Confirmation 2: Reason is mandatory: spoilage, expiry, damage, other
    if (!reason || !WASTAGE_REASONS.includes(reason.toLowerCase())) {
      throw new Error(`Wastage reason is required. Must be one of: ${WASTAGE_REASONS.join(', ')}.`);
    }

    const batch = batchRepository.getById(batchId);
    if (!batch) throw new Error(`Batch with ID "${batchId}" not found.`);

    const item = itemRepository.getById(batch.itemId);
    if (!item) throw new Error('Associated item not found.');

    // US-05B, Confirmation 3: Wastage cannot exceed remaining stock
    if (numQty > Number(batch.remainingQuantity)) {
      throw new Error(`Wastage quantity (${numQty} ${batch.unit}) exceeds remaining batch stock (${batch.remainingQuantity} ${batch.unit}). Submission rejected.`);
    }

    const txId = transactionToken || `TX-WST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let updatedBatch;
    db.executeTransaction(state => {
      // US-05B, Confirmation 5: Prevent duplicate deductions
      if (state.transactions.some(t => t.id === txId)) {
        throw new Error('Duplicate transaction detected. Wastage will not be deducted again.');
      }

      const targetBatch = state.batches.find(b => b.id === batchId);
      if (!targetBatch) throw new Error('Batch not found in transaction.');
      if (numQty > Number(targetBatch.remainingQuantity)) {
        throw new Error('Wastage quantity exceeds remaining stock.');
      }

      targetBatch.remainingQuantity = Number((targetBatch.remainingQuantity - numQty).toFixed(3));
      updatedBatch = targetBatch;

      const txRecord = {
        id: txId,
        type: 'Stock Wastage',
        batchId,
        itemId: item.id,
        warehouseId: batch.warehouseId,
        quantity: numQty,
        unit: batch.unit,
        officerName: officerName || 'Warehouse Officer',
        timestamp: new Date().toISOString(),
        details: {
          wastageDate: date,
          reason: reason.toLowerCase(),
          isExpiredBatch: getExpiryStatus(batch.expiryDate) === 'EXPIRED'
        }
      };
      state.transactions.push(txRecord);
    });

    return {
      success: true,
      batchId,
      remainingBalance: updatedBatch.remainingQuantity,
      unit: batch.unit
    };
  }
}

module.exports = new StockService();
