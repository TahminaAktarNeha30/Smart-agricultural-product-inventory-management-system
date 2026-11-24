// src/services/supplierService.js
// Business logic for Supplier Management (Feature 2: US-02B, US-02C)

const supplierRepository = require('../dal/supplierRepository');

class SupplierService {
  /**
   * Returns every supplier (active and inactive).
   *
   * @returns {*} Array of suppliers.
   */
  getAllSuppliers() {
    return supplierRepository.getAll();
  }

  /**
   * Returns only active suppliers (used in the receiving form).
   *
   * @returns {*} Array of active suppliers.
   */
  getActiveSuppliers() {
    return supplierRepository.getAll().filter(s => s.isActive);
  }

  /**
   * Finds one supplier by ID.
   *
   * @param {string} id - Supplier ID.
   * @returns {*} The supplier object.
   * @throws {Error} If no supplier has this ID.
   */
  getSupplierById(id) {
    const s = supplierRepository.getById(id);
    if (!s) {
      throw new Error(`Supplier with ID ${id} not found.`);
    }
    return s;
  }

  /**
   * US-02B: Searches suppliers by name (not case-sensitive).
   *
   * @param {string} query - Part of the supplier name.
   * @returns {*} Array of matching suppliers.
   */
  searchSuppliers(query) {
    return supplierRepository.searchByName(query);
  }

  /**
   * US-02B: Adds a supplier with name, phone, address and supplied items.
   *
   * @param {object} data - Supplier details.
   * @returns {*} The new supplier.
   * @throws {Error} If name, phone or address is empty.
   */
  addSupplier(data) {
    const { name, phone, address, suppliedItems } = data;

    if (!name || !name.trim()) throw new Error('Supplier name is required.');
    if (!phone || !phone.trim()) throw new Error('Supplier phone number is required.');
    if (!address || !address.trim()) throw new Error('Supplier address is required.');

    let itemsArr = [];
    if (Array.isArray(suppliedItems)) {
      itemsArr = suppliedItems;
    } else if (typeof suppliedItems === 'string') {
      itemsArr = suppliedItems.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newSupplier = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      suppliedItems: itemsArr,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    return supplierRepository.create(newSupplier);
  }

  /**
   * Updates the details of a supplier.
   *
   * @param {string} id - Supplier ID.
   * @param {object} data - Fields to change.
   * @returns {*} The updated supplier.
   * @throws {Error} If the supplier is missing or a field is invalid.
   */
  updateSupplier(id, data) {
    const existing = this.getSupplierById(id);
    let itemsArr = existing.suppliedItems;
    if (data.suppliedItems !== undefined) {
      if (Array.isArray(data.suppliedItems)) {
        itemsArr = data.suppliedItems;
      } else if (typeof data.suppliedItems === 'string') {
        itemsArr = data.suppliedItems.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const updates = {
      name: data.name ? data.name.trim() : existing.name,
      phone: data.phone ? data.phone.trim() : existing.phone,
      address: data.address ? data.address.trim() : existing.address,
      suppliedItems: itemsArr
    };

    return supplierRepository.update(id, updates);
  }

  /**
   * US-02C: Deactivates a supplier. Old receipts keep the supplier name.
   *
   * @param {string} id - Supplier ID.
   * @returns {*} The deactivated supplier.
   * @throws {Error} If the supplier is missing.
   */
  deactivateSupplier(id) {
    this.getSupplierById(id);
    return supplierRepository.update(id, { isActive: false });
  }

  /**
   * US-02C: Makes an inactive supplier selectable again.
   *
   * @param {string} id - Supplier ID.
   * @returns {*} The reactivated supplier.
   * @throws {Error} If the supplier is missing.
   */
  reactivateSupplier(id) {
    this.getSupplierById(id);
    return supplierRepository.update(id, { isActive: true });
  }
}

module.exports = new SupplierService();
