// src/dal/warehouseRepository.js
// Handles warehouse records persistence

const db = require('./database');

class WarehouseRepository {
  getAll() {
    return db.read().warehouses || [];
  }

  getById(id) {
    const list = this.getAll();
    return list.find(w => w.id === id) || null;
  }

  create(warehouseData) {
    return db.executeTransaction(state => {
      state.warehouses.push(warehouseData);
      return warehouseData;
    });
  }

  update(id, updateData) {
    return db.executeTransaction(state => {
      const index = state.warehouses.findIndex(w => w.id === id);
      if (index === -1) {
        throw new Error(`Warehouse with ID ${id} not found.`);
      }
      state.warehouses[index] = { ...state.warehouses[index], ...updateData };
      return state.warehouses[index];
    });
  }
}

module.exports = new WarehouseRepository();
