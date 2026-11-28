// tests/helpers/testDb.js
// Creates a TEMPORARY database for each test file so the real data/db.json is never changed.
// Dates are calculated from "today", so the tests never go out of date.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getBangladeshDateString, addDaysToDateString } = require('../../config/constants');

/** Returns a YYYY-MM-DD date N days from today (Bangladesh date). daysFromToday(-1) = yesterday. */
function daysFromToday(n) {
  return addDaysToDateString(getBangladeshDateString(), n);
}

function item(id, name, category, type, unit, min, rule, price) {
  return {
    id, name, category, type, unit,
    storageRequirements: 'Cool and dry', packagingDetails: 'Bags',
    minStockLevel: min, rotationRule: rule, sellingPrice: price,
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function batch(id, itemId, warehouseId, received, expiry, qty, unit, supplierId = null) {
  return {
    id, itemId, warehouseId,
    sourceType: supplierId ? 'Supplier Purchase' : 'Farm Production',
    supplierId,
    farmSourceDescription: supplierId ? null : 'Greenhouse plot',
    harvestDate: supplierId ? null : received,
    receivingDate: received, expiryDate: expiry,
    initialQuantity: qty, remainingQuantity: qty, unit,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

/** The known starting data used by every test. */
function buildBaseline() {
  return {
    items: [
      item('ITEM-101', 'Fresh Tomatoes', 'Vegetables', 'Finished Product', 'kg', 50, 'FEFO', 45),
      item('ITEM-102', 'Cow Milk', 'Dairy', 'Finished Product', 'litres', 30, 'FEFO', 60),
      item('ITEM-103', 'Poultry Starter Feed', 'Animal Feed', 'Farming Input', 'kg', 100, 'FIFO', null),
      item('ITEM-104', 'Organic Fertilizer NPK', 'Fertilizers', 'Farming Input', 'kg', 40, 'FIFO', null)
    ],
    warehouses: [
      { id: 'WH-01', name: 'Warehouse A', location: 'North', storageType: 'Cold Storage', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'WH-02', name: 'Warehouse B', location: 'South', storageType: 'Dry Storage', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }
    ],
    suppliers: [
      { id: 'SUP-01', name: 'Green Agro Inputs Ltd.', phone: '01711223344', address: 'Dhaka', suppliedItems: ['Poultry Starter Feed'], isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'SUP-02', name: 'Bengal Seed Solutions', phone: '01819876543', address: 'Bogra', suppliedItems: ['Seeds'], isActive: false, createdAt: '2026-01-01T00:00:00.000Z' }
    ],
    batches: [
      batch('T01', 'ITEM-101', 'WH-01', daysFromToday(-3), daysFromToday(3), 200, 'kg'),   // expires sooner
      batch('T02', 'ITEM-101', 'WH-01', daysFromToday(-2), daysFromToday(5), 150, 'kg'),
      batch('M01', 'ITEM-102', 'WH-01', daysFromToday(-2), daysFromToday(1), 50, 'litres'),
      batch('FEED-A', 'ITEM-103', 'WH-02', daysFromToday(-5), null, 100, 'kg', 'SUP-01'),  // same date as FEED-B
      batch('FEED-B', 'ITEM-103', 'WH-02', daysFromToday(-5), null, 40, 'kg', 'SUP-01'),
      batch('FERT-OK', 'ITEM-104', 'WH-02', daysFromToday(-4), daysFromToday(60), 25, 'kg'),
      batch('FERT-OLD', 'ITEM-104', 'WH-02', daysFromToday(-30), daysFromToday(-1), 30, 'kg') // already expired
    ],
    orders: [],
    transactions: [
      { id: 'TX-INIT-01', type: 'Stock Receipt', batchId: 'T01', itemId: 'ITEM-101', warehouseId: 'WH-01', quantity: 200, unit: 'kg', officerName: 'Warehouse Supervisor', timestamp: '2026-01-01T00:00:00.000Z' }
    ],
    users: []
  };
}

/** Call this BEFORE requiring any service. It points the app to a temporary db file. */
function setupTestDb() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-test-'));
  process.env.DB_PATH = path.join(folder, 'db.json');
  fs.writeFileSync(process.env.DB_PATH, JSON.stringify(buildBaseline(), null, 2));
}

/** Puts the temporary database back to the starting data (call in beforeEach). */
function resetTestDb() {
  fs.writeFileSync(process.env.DB_PATH, JSON.stringify(buildBaseline(), null, 2));
}

module.exports = { setupTestDb, resetTestDb, buildBaseline, daysFromToday };
