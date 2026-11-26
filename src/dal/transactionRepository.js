// src/dal/transactionRepository.js
// Handles audit trail and logging for stock receipt, usage, wastage, and dispatch transactions (NFR-10)

const db = require('./database');

class TransactionRepository {
  getAll() {
    return db.read().transactions || [];
  }

  create(transactionData) {
    return db.executeTransaction(state => {
      // Prevent duplicate transaction processing if ID already exists (NFR-05)
      const existing = state.transactions.find(t => t.id === transactionData.id);
      if (existing) {
        throw new Error(`Transaction ${transactionData.id} has already been processed.`);
      }
      state.transactions.push(transactionData);
      return transactionData;
    });
  }

  getByItemId(itemId) {
    const list = this.getAll();
    return list.filter(t => t.itemId === itemId);
  }

  hasTransactionsForItem(itemId) {
    const list = this.getAll();
    return list.some(t => t.itemId === itemId);
  }
}

module.exports = new TransactionRepository();
