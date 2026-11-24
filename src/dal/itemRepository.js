// src/dal/itemRepository.js
// Handles all low-level persistence operations for Item Catalog records

const db = require('./database');

class ItemRepository {
  getAll() {
    return db.read().items || [];
  }

  getById(id) {
    const items = this.getAll();
    return items.find(i => i.id === id) || null;
  }

  findByNameAndCategory(name, category) {
    const items = this.getAll();
    return items.find(i => 
      i.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      i.category.trim().toLowerCase() === category.trim().toLowerCase()
    ) || null;
  }

  create(itemData) {
    return db.executeTransaction(state => {
      state.items.push(itemData);
      return itemData;
    });
  }

  update(id, updateData) {
    return db.executeTransaction(state => {
      const index = state.items.findIndex(i => i.id === id);
      if (index === -1) {
        throw new Error(`Item with ID ${id} not found.`);
      }
      state.items[index] = { ...state.items[index], ...updateData };
      return state.items[index];
    });
  }
}

module.exports = new ItemRepository();
