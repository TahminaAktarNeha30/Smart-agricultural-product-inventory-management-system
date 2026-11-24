// src/services/warehouseService.js
// Business logic for Warehouse Management (Feature 2: US-02A)

const warehouseRepository = require('../dal/warehouseRepository');
const batchRepository = require('../dal/batchRepository');

class WarehouseService {
  /**
   * Returns every warehouse (active and inactive).
   *
   * @returns {*} Array of warehouses.
   */
  getAllWarehouses() {
    return warehouseRepository.getAll();
  }

  /**
   * Returns only active warehouses (used in the receiving form).
   *
   * @returns {*} Array of active warehouses.
   */
  getActiveWarehouses() {
    return warehouseRepository.getAll().filter(w => w.isActive);
  }

  /**
   * Finds one warehouse by ID.
   *
   * @param {string} id - Warehouse ID, e.g. 'WH-01'.
   * @returns {*} The warehouse object.
   * @throws {Error} If no warehouse has this ID.
   */
  getWarehouseById(id) {
    const wh = warehouseRepository.getById(id);
    if (!wh) {
      throw new Error(`Warehouse with ID ${id} not found.`);
    }
    return wh;
  }

  /**
   * US-02A: Adds a warehouse with name, location and storage type.
   *
   * @param {object} data - Warehouse details.
   * @returns {*} The new warehouse.
   * @throws {Error} If a required field is empty.
   */
  addWarehouse(data) {
    const { name, location, storageType } = data;

    if (!name || !name.trim()) throw new Error('Warehouse name is required.');
    if (!location || !location.trim()) throw new Error('Warehouse location is required.');
    if (!storageType || !storageType.trim()) throw new Error('Storage type is required.');

    const newWarehouse = {
      id: `WH-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      location: location.trim(),
      storageType: storageType.trim(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    return warehouseRepository.create(newWarehouse);
  }

  /**
   * Updates warehouse details.
   *
   * @param {string} id - Warehouse ID.
   * @param {object} data - Fields to change.
   * @returns {*} The updated warehouse.
   * @throws {Error} If the warehouse is missing.
   */
  updateWarehouse(id, data) {
    const existing = this.getWarehouseById(id);
    const updates = {
      name: data.name ? data.name.trim() : existing.name,
      location: data.location ? data.location.trim() : existing.location,
      storageType: data.storageType ? data.storageType.trim() : existing.storageType
    };
    return warehouseRepository.update(id, updates);
  }

  /**
   * US-02A: Deactivates a warehouse only when its stock balance is zero.
   *
   * @param {string} id - Warehouse ID.
   * @returns {*} The deactivated warehouse.
   * @throws {Error} If the warehouse still holds stock.
   */
  deactivateWarehouse(id) {
    const existing = this.getWarehouseById(id);

    // US-02A, Confirmation 2: Block if warehouse contains remaining stock
    const batches = batchRepository.getByWarehouseId(id);
    const totalStock = batches.reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0);

    if (totalStock > 0) {
      throw new Error(`Cannot deactivate warehouse "${existing.name}" because it still holds ${totalStock} units of stock. Stock balance must be zero.`);
    }

    return warehouseRepository.update(id, { isActive: false });
  }

  /**
   * Makes a deactivated warehouse active again.
   *
   * @param {string} id - Warehouse ID.
   * @returns {*} The reactivated warehouse.
   * @throws {Error} If the warehouse is missing.
   */
  reactivateWarehouse(id) {
    this.getWarehouseById(id);
    return warehouseRepository.update(id, { isActive: true });
  }
}

module.exports = new WarehouseService();
