// Features 3, 4, 5: Receive stock, Stock view, Usage and Wastage
const { setupTestDb, resetTestDb, daysFromToday } = require('../helpers/testDb');
setupTestDb();
beforeEach(resetTestDb); // every test starts from the same clean data
const stockService = require('../../src/services/stockService');

const today = daysFromToday(0);

const farmReceipt = (extra = {}) => ({
  batchId: 'NEW-1', itemId: 'ITEM-101', warehouseId: 'WH-01',
  sourceType: 'Farm Production', farmSourceDescription: 'Plot 1', harvestDate: today,
  receivingDate: today, expiryDate: daysFromToday(5), quantity: 100,
  ...extra
});

describe('Feature 3: receiveStock', () => {
  test('NORMAL: creates a new batch with the received quantity (US-03 Conf 1)', () => {
    const result = stockService.receiveStock(farmReceipt(), 'Officer');
    expect(result.batch.remainingQuantity).toBe(100);
    expect(result.transaction.officerName).toBe('Officer');
  });

  test('INVALID: zero quantity is rejected (US-03 Conf 6)', () => {
    expect(() => stockService.receiveStock(farmReceipt({ batchId: 'Z', quantity: 0 }))).toThrow('positive number');
  });

  test('INVALID: negative quantity is rejected', () => {
    expect(() => stockService.receiveStock(farmReceipt({ batchId: 'N', quantity: -5 }))).toThrow('positive number');
  });

  test('BOUNDARY: smallest positive quantity (0.001) is accepted', () => {
    expect(stockService.receiveStock(farmReceipt({ batchId: 'TINY', quantity: 0.001 })).batch.remainingQuantity).toBe(0.001);
  });

  test('INVALID: expiry earlier than receiving date (US-03 Conf 5)', () => {
    expect(() => stockService.receiveStock(farmReceipt({ batchId: 'E1', expiryDate: daysFromToday(-1) }))).toThrow('cannot be earlier');
  });

  test('BOUNDARY: expiry equal to receiving date is accepted', () => {
    expect(stockService.receiveStock(farmReceipt({ batchId: 'E2', expiryDate: today })).batch.expiryDate).toBe(today);
  });

  test('INVALID: FEFO item without expiry date is rejected', () => {
    expect(() => stockService.receiveStock(farmReceipt({ batchId: 'E3', expiryDate: null }))).toThrow('requires an expiry date');
  });

  test('INVALID: supplier purchase needs an ACTIVE supplier (US-03 Conf 3)', () => {
    const purchase = { ...farmReceipt({ batchId: 'S1', itemId: 'ITEM-103', warehouseId: 'WH-02', expiryDate: null }), sourceType: 'Supplier Purchase' };
    expect(() => stockService.receiveStock({ ...purchase, supplierId: '' })).toThrow('active supplier');
    expect(() => stockService.receiveStock({ ...purchase, supplierId: 'SUP-02' })).toThrow('deactivated');
  });

  test('EXCEPTIONAL: same form sent twice (same token) creates only ONE batch (US-03 Conf 7)', () => {
    const data = farmReceipt({ batchId: 'DUP-1', transactionToken: 'TOKEN-1' });
    stockService.receiveStock(data);
    expect(() => stockService.receiveStock({ ...data, batchId: 'DUP-2' })).toThrow('Duplicate');
    const ids = stockService.getStockOverview({}).batches.map(b => b.id);
    expect(ids).toContain('DUP-1');
    expect(ids).not.toContain('DUP-2');
  });
});

describe('Feature 4: getStockOverview', () => {
  test('NORMAL: totals per item (US-04 Conf 1)', () => {
    const tomato = stockService.getStockOverview({ itemId: 'ITEM-101' }).summaries.find(s => s.item.id === 'ITEM-101');
    expect(tomato.usableStock).toBeGreaterThanOrEqual(350);
  });

  test('NORMAL: warehouse filter (US-04 Conf 2)', () => {
    const ids = stockService.getStockOverview({ warehouseId: 'WH-02' }).batches.map(b => b.warehouseId);
    expect(ids.every(w => w === 'WH-02')).toBe(true);
  });

  test('NORMAL: expired batch is labelled and not dispatchable (US-04 Conf 3)', () => {
    const old = stockService.getStockOverview({}).batches.find(b => b.id === 'FERT-OLD');
    expect(old.expiryStatus).toBe('EXPIRED');
    expect(old.isDispatchable).toBe(false);
  });

  test('NORMAL: empty batches hidden by default, shown with the filter (US-04 Conf 4, 5)', () => {
    stockService.recordUsage({ batchId: 'FEED-B', quantity: 40, date: today, purpose: 'Use all', transactionToken: 'EMPTY-1' }, 'O');
    expect(stockService.getStockOverview({}).batches.some(b => b.id === 'FEED-B')).toBe(false);
    expect(stockService.getStockOverview({ showEmptyBatches: true }).batches.some(b => b.id === 'FEED-B')).toBe(true);
  });
});

describe('Feature 5: recordUsage', () => {
  const usage = (extra = {}) => ({ batchId: 'FEED-A', quantity: 20, date: today, purpose: 'Feeding', transactionToken: `U-${Math.random()}`, ...extra });

  test('NORMAL: balance goes down (US-05A Conf 1)', () => {
    expect(stockService.recordUsage(usage(), 'O').remainingBalance).toBe(80);
  });

  test('BOUNDARY: using exactly the whole balance (100) leaves 0', () => {
    expect(stockService.recordUsage(usage({ quantity: 100 }), 'O').remainingBalance).toBe(0);
  });

  test('INVALID: more than the balance is rejected, balance unchanged (US-05A Conf 2)', () => {
    expect(() => stockService.recordUsage(usage({ batchId: 'FERT-OK', quantity: 26 }), 'O')).toThrow('exceeds available');
    const fert = stockService.getStockOverview({}).batches.find(b => b.id === 'FERT-OK');
    expect(fert.remainingQuantity).toBe(25);
  });

  test('INVALID: expired batch is blocked (US-05A Conf 3)', () => {
    expect(() => stockService.recordUsage(usage({ batchId: 'FERT-OLD', quantity: 1 }), 'O')).toThrow('expired');
  });

  test('INVALID: finished products cannot be "used" (US-05A Conf 4)', () => {
    expect(() => stockService.recordUsage(usage({ batchId: 'T01' }), 'O')).toThrow('only permitted for Farming Inputs');
  });

  test('INVALID: purpose is required', () => {
    expect(() => stockService.recordUsage(usage({ batchId: 'FERT-OK', purpose: ' ' }), 'O')).toThrow('purpose is required');
  });

  test('EXCEPTIONAL: repeating the same confirmation deducts only once (NFR-05)', () => {
    const data = usage({ batchId: 'FERT-OK', quantity: 5, transactionToken: 'SAME-USE' });
    stockService.recordUsage(data, 'O');
    expect(() => stockService.recordUsage(data, 'O')).toThrow('Duplicate');
    const fert = stockService.getStockOverview({}).batches.find(b => b.id === 'FERT-OK');
    expect(fert.remainingQuantity).toBe(20);
  });
});

describe('Feature 5: recordWastage', () => {
  const wastage = (extra = {}) => ({ batchId: 'T02', quantity: 10, date: today, reason: 'spoilage', transactionToken: `W-${Math.random()}`, ...extra });

  test('NORMAL: balance goes down and reason is kept (US-05B Conf 1)', () => {
    expect(stockService.recordWastage(wastage(), 'O').remainingBalance).toBe(140);
  });

  test('INVALID: missing reason is rejected (US-05B Conf 2)', () => {
    expect(() => stockService.recordWastage(wastage({ reason: '' }), 'O')).toThrow('reason is required');
  });

  test('INVALID: reason outside the allowed list is rejected', () => {
    expect(() => stockService.recordWastage(wastage({ reason: 'stolen' }), 'O')).toThrow('reason is required');
  });

  test('INVALID: more than the remaining stock is rejected (US-05B Conf 3)', () => {
    expect(() => stockService.recordWastage(wastage({ quantity: 9999 }), 'O')).toThrow('exceeds');
  });

  test('NORMAL: an EXPIRED batch can still be written off (US-05B Conf 4)', () => {
    expect(stockService.recordWastage(wastage({ batchId: 'FERT-OLD', quantity: 30, reason: 'expiry' }), 'O').remainingBalance).toBe(0);
  });

  test('EXCEPTIONAL: repeated confirmation deducts only once (US-05B Conf 5)', () => {
    const data = wastage({ batchId: 'M01', quantity: 5, transactionToken: 'SAME-WST' });
    stockService.recordWastage(data, 'O');
    expect(() => stockService.recordWastage(data, 'O')).toThrow('Duplicate');
    expect(stockService.getStockOverview({}).batches.find(b => b.id === 'M01').remainingQuantity).toBe(45);
  });
});
