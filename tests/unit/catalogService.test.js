// Features 1 and 2: Item Catalog, Warehouses, Suppliers
const { setupTestDb, resetTestDb } = require('../helpers/testDb');
setupTestDb();
beforeEach(resetTestDb); // every test starts from the same clean data
const itemService = require('../../src/services/itemService');
const warehouseService = require('../../src/services/warehouseService');
const supplierService = require('../../src/services/supplierService');

const validItem = {
  name: 'Carrot', category: 'Vegetables', type: 'Finished Product', unit: 'kg',
  storageRequirements: 'Cool', packagingDetails: 'Bags', minStockLevel: 10,
  rotationRule: 'FEFO', sellingPrice: 30
};

describe('Item catalog (US-01A/B/C)', () => {
  test('NORMAL: a valid item is added and appears in the catalog', () => {
    const created = itemService.addItem(validItem);
    expect(itemService.getAllItems().some(i => i.id === created.id)).toBe(true);
  });

  test('INVALID: empty unit is rejected', () => {
    expect(() => itemService.addItem({ ...validItem, name: 'X1', unit: '' })).toThrow('Unit of measurement is required');
  });

  test('INVALID: negative selling price for a finished product is rejected', () => {
    expect(() => itemService.addItem({ ...validItem, name: 'X2', sellingPrice: -1 })).toThrow('non-negative selling price');
  });

  test('BOUNDARY: selling price 0 is allowed', () => {
    expect(itemService.addItem({ ...validItem, name: 'Free Sample', sellingPrice: 0 }).sellingPrice).toBe(0);
  });

  test('INVALID: same name + category is a duplicate', () => {
    expect(() => itemService.addItem({ ...validItem, name: 'Fresh Tomatoes' })).toThrow('already exists');
  });

  test('INVALID: unit cannot change after transactions exist', () => {
    expect(() => itemService.updateItem('ITEM-101', { unit: 'litres' })).toThrow('historical transactions exist');
  });

  test('NORMAL: price can change', () => {
    expect(itemService.updateItem('ITEM-101', { sellingPrice: 50 }).sellingPrice).toBe(50);
  });

  test('EXCEPTIONAL: item with stock cannot be deactivated', () => {
    expect(() => itemService.deactivateItem('ITEM-101')).toThrow('still has');
  });

  test('EXCEPTIONAL: unknown item ID throws', () => {
    expect(() => itemService.getItemById('NOPE')).toThrow();
  });
});

describe('Warehouses (US-02A)', () => {
  test('NORMAL: a warehouse is added', () => {
    const w = warehouseService.addWarehouse({ name: 'Warehouse C', location: 'East', storageType: 'Dry Storage' });
    expect(w.isActive).toBe(true);
  });

  test('INVALID: missing location is rejected', () => {
    expect(() => warehouseService.addWarehouse({ name: 'W', location: '', storageType: 'Dry' })).toThrow('location is required');
  });

  test('EXCEPTIONAL: warehouse with stock cannot be deactivated', () => {
    expect(() => warehouseService.deactivateWarehouse('WH-01')).toThrow('still holds');
  });
});

describe('Suppliers (US-02B/C)', () => {
  test('NORMAL: search by name finds the supplier', () => {
    expect(supplierService.searchSuppliers('green')[0].id).toBe('SUP-01');
  });

  test('NORMAL: search with no match returns an empty list', () => {
    expect(supplierService.searchSuppliers('zzz')).toEqual([]);
  });

  test('INVALID: supplier without phone is rejected', () => {
    expect(() => supplierService.addSupplier({ name: 'A', phone: '', address: 'B' })).toThrow('phone number is required');
  });

  test('NORMAL: deactivate then reactivate', () => {
    expect(supplierService.deactivateSupplier('SUP-01').isActive).toBe(false);
    expect(supplierService.getActiveSuppliers().some(s => s.id === 'SUP-01')).toBe(false);
    expect(supplierService.reactivateSupplier('SUP-01').isActive).toBe(true);
  });
});
