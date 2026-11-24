// src/services/itemService.js
// Business logic for Item Catalog Management (Feature 1: US-01A, US-01B, US-01C)

const itemRepository = require('../dal/itemRepository');
const batchRepository = require('../dal/batchRepository');
const orderRepository = require('../dal/orderRepository');
const transactionRepository = require('../dal/transactionRepository');
const { ITEM_TYPES, ROTATION_RULES } = require('../../config/constants');

class ItemService {
  /**
   * Returns every item in the catalog (active and inactive).
   *
   * @returns {*} Array of item objects.
   */
  getAllItems() {
    return itemRepository.getAll();
  }

  /**
   * Finds one item by its ID.
   *
   * @param {string} id - Item ID, e.g. 'ITEM-101'.
   * @returns {*} The item object.
   * @throws {Error} If no item has this ID.
   */
  getItemById(id) {
    const item = itemRepository.getById(id);
    if (!item) {
      throw new Error(`Item with ID ${id} not found.`);
    }
    return item;
  }

  /**
   * US-01A: Adds a new item after validating every field (unit, price, duplicate name+category).
   *
   * @param {object} data - Item details: name, category, type, unit, storageRequirements, packagingDetails, minStockLevel, rotationRule, sellingPrice.
   * @returns {*} The newly created item.
   * @throws {Error} If a required field is missing/invalid or the item already exists.
   */
  addItem(data) {
    const {
      name,
      category,
      type,
      unit,
      storageRequirements,
      packagingDetails,
      minStockLevel,
      rotationRule,
      sellingPrice
    } = data;

    // US-01A, Confirmation 1 & 2: Required validation
    if (!name || !name.trim()) throw new Error('Item name is required.');
    if (!category || !category.trim()) throw new Error('Item category is required.');
    if (!type || !Object.values(ITEM_TYPES).includes(type)) {
      throw new Error(`Item type must be either '${ITEM_TYPES.FARMING_INPUT}' or '${ITEM_TYPES.FINISHED_PRODUCT}'.`);
    }
    if (!unit || !unit.trim()) {
      // US-01A, Confirmation 2: System rejects the item and highlights missing unit
      throw new Error('Unit of measurement is required and cannot be empty.');
    }
    if (!storageRequirements || !storageRequirements.trim()) {
      throw new Error('Storage requirements are required.');
    }
    if (!packagingDetails || !packagingDetails.trim()) {
      throw new Error('Packaging details are required.');
    }
    if (minStockLevel === undefined || minStockLevel === null || isNaN(minStockLevel) || Number(minStockLevel) < 0) {
      throw new Error('Minimum stock level must be a non-negative number.');
    }
    if (!rotationRule || !Object.values(ROTATION_RULES).includes(rotationRule)) {
      throw new Error(`Rotation rule must be either '${ROTATION_RULES.FIFO}' or '${ROTATION_RULES.FEFO}'.`);
    }

    // US-01A, Confirmation 3: Finished product requires valid non-negative selling price
    let parsedPrice = null;
    if (type === ITEM_TYPES.FINISHED_PRODUCT) {
      if (sellingPrice === undefined || sellingPrice === null || sellingPrice === '' || isNaN(sellingPrice) || Number(sellingPrice) < 0) {
        throw new Error('Finished products must have a valid non-negative selling price.');
      }
      parsedPrice = Number(sellingPrice);
    }

    // US-01A, Confirmation 5: Duplicate check by name and category
    const existing = itemRepository.findByNameAndCategory(name, category);
    if (existing) {
      throw new Error(`An item named "${name}" in category "${category}" already exists.`);
    }

    const newItem = {
      id: `ITEM-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      category: category.trim(),
      type,
      unit: unit.trim(),
      storageRequirements: storageRequirements.trim(),
      packagingDetails: packagingDetails.trim(),
      minStockLevel: Number(minStockLevel),
      rotationRule,
      sellingPrice: parsedPrice,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    return itemRepository.create(newItem);
  }

  /**
   * US-01B: Updates item details. The stock unit cannot change once transactions exist.
   *
   * @param {string} id - Item ID.
   * @param {object} data - Fields to change.
   * @returns {*} The updated item.
   * @throws {Error} If the item is missing, the price is invalid, or the unit is locked.
   */
  updateItem(id, data) {
    const existing = this.getItemById(id);

    // US-01B, Confirmation 4: Block stock unit change if transactions exist
    if (data.unit && data.unit.trim().toLowerCase() !== existing.unit.toLowerCase()) {
      const hasTx = transactionRepository.hasTransactionsForItem(id);
      if (hasTx) {
        throw new Error(`Cannot change stock unit for item "${existing.name}" because historical transactions exist.`);
      }
    }

    // Validation for item type
    let newType = existing.type;
    if (data.type && Object.values(ITEM_TYPES).includes(data.type)) {
      newType = data.type;
    }

    // Validation for selling price if finished product
    let parsedPrice = existing.sellingPrice;
    if (newType === ITEM_TYPES.FINISHED_PRODUCT) {
      const priceToValidate = data.sellingPrice !== undefined ? data.sellingPrice : existing.sellingPrice;
      if (priceToValidate === null || priceToValidate === '' || isNaN(priceToValidate) || Number(priceToValidate) < 0) {
        throw new Error('Finished products must have a valid non-negative selling price.');
      }
      parsedPrice = Number(priceToValidate);
    } else {
      parsedPrice = null;
    }

    const updates = {
      name: data.name ? data.name.trim() : existing.name,
      category: data.category ? data.category.trim() : existing.category,
      type: newType,
      storageRequirements: data.storageRequirements !== undefined ? data.storageRequirements.trim() : existing.storageRequirements,
      packagingDetails: data.packagingDetails !== undefined ? data.packagingDetails.trim() : existing.packagingDetails,
      minStockLevel: data.minStockLevel !== undefined ? Number(data.minStockLevel) : existing.minStockLevel,
      rotationRule: data.rotationRule || existing.rotationRule,
      sellingPrice: parsedPrice,
      unit: data.unit ? data.unit.trim() : existing.unit
    };

    return itemRepository.update(id, updates);
  }

  /**
   * US-01C: Deactivates an item only when it has zero stock and no open orders.
   *
   * @param {string} id - Item ID.
   * @returns {*} The deactivated item.
   * @throws {Error} If stock remains or Placed/Approved orders exist.
   */
  deactivateItem(id) {
    const existing = this.getItemById(id);

    // US-01C, Confirmation 3 & 4: Check remaining stock and open orders
    const batches = batchRepository.getByItemId(id);
    const totalRemainingStock = batches.reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0);
    if (totalRemainingStock > 0) {
      throw new Error(`Cannot deactivate item "${existing.name}" because it still has ${totalRemainingStock} ${existing.unit} in stock.`);
    }

    const allOrders = orderRepository.getAll();
    const hasOpenOrder = allOrders.some(order => 
      ['Placed', 'Approved'].includes(order.status) &&
      order.lines.some(line => line.itemId === id)
    );

    if (hasOpenOrder) {
      throw new Error(`Cannot deactivate item "${existing.name}" because there are open orders (Placed/Approved) containing this item.`);
    }

    return itemRepository.update(id, { isActive: false });
  }

  /**
   * Makes a deactivated item active again.
   *
   * @param {string} id - Item ID.
   * @returns {*} The reactivated item.
   * @throws {Error} If the item is missing.
   */
  reactivateItem(id) {
    this.getItemById(id);
    return itemRepository.update(id, { isActive: true });
  }
}

module.exports = new ItemService();
