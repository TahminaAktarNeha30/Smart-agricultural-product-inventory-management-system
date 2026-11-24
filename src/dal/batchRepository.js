// src/dal/batchRepository.js
// Handles batch level inventory records

const db = require('./database');

class BatchRepository {
  getAll() {
    return db.read().batches || [];
  }

  getById(id) {
    const list = this.getAll();
    return list.find(b => b.id === id) || null;
  }

  getByItemId(itemId) {
    const list = this.getAll();
    return list.filter(b => b.itemId === itemId);
  }

  getByWarehouseId(warehouseId) {
    const list = this.getAll();
    return list.filter(b => b.warehouseId === warehouseId);
  }

  create(batchData) {
    return db.executeTransaction(state => {
      // Check if batch ID already exists
      const existing = state.batches.find(b => b.id.toLowerCase() === batchData.id.toLowerCase());
      if (existing) {
        throw new Error(`Batch ID ${batchData.id} already exists.`);
      }
      state.batches.push(batchData);
      return batchData;
    });
  }

  update(id, updateData) {
    return db.executeTransaction(state => {
      const index = state.batches.findIndex(b => b.id === id);
      if (index === -1) {
        throw new Error(`Batch with ID ${id} not found.`);
      }
      state.batches[index] = { ...state.batches[index], ...updateData };
      return state.batches[index];
    });
  }
}

module.exports = new BatchRepository();
