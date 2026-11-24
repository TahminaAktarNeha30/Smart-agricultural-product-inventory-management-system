// src/dal/orderRepository.js
// Handles distributor orders persistence

const db = require('./database');

class OrderRepository {
  getAll() {
    return db.read().orders || [];
  }

  getById(id) {
    const list = this.getAll();
    return list.find(o => o.id === id) || null;
  }

  findByOrderNumberAndPhone(orderNumber, phone) {
    const list = this.getAll();
    const cleanPhone = (phone || '').replace(/[\s\-\+]/g, '');
    return list.find(o => {
      const oNumMatch = o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase();
      const oPhoneClean = (o.distributorPhone || '').replace(/[\s\-\+]/g, '');
      return oNumMatch && oPhoneClean === cleanPhone;
    }) || null;
  }

  create(orderData) {
    return db.executeTransaction(state => {
      state.orders.push(orderData);
      return orderData;
    });
  }

  update(id, updateData) {
    return db.executeTransaction(state => {
      const index = state.orders.findIndex(o => o.id === id);
      if (index === -1) {
        throw new Error(`Order with ID ${id} not found.`);
      }
      state.orders[index] = { ...state.orders[index], ...updateData };
      return state.orders[index];
    });
  }
}

module.exports = new OrderRepository();
