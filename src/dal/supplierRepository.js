// src/dal/supplierRepository.js
// Handles supplier records persistence and search

const db = require('./database');

class SupplierRepository {
  getAll() {
    return db.read().suppliers || [];
  }

  getById(id) {
    const list = this.getAll();
    return list.find(s => s.id === id) || null;
  }

  searchByName(query) {
    const list = this.getAll();
    if (!query) return list;
    const q = query.trim().toLowerCase();
    return list.filter(s => s.name.toLowerCase().includes(q));
  }

  create(supplierData) {
    return db.executeTransaction(state => {
      state.suppliers.push(supplierData);
      return supplierData;
    });
  }

  update(id, updateData) {
    return db.executeTransaction(state => {
      const index = state.suppliers.findIndex(s => s.id === id);
      if (index === -1) {
        throw new Error(`Supplier with ID ${id} not found.`);
      }
      state.suppliers[index] = { ...state.suppliers[index], ...updateData };
      return state.suppliers[index];
    });
  }
}

module.exports = new SupplierRepository();
