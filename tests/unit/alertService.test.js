// Feature 8: Low-stock and expiry alerts
const { setupTestDb, resetTestDb, daysFromToday } = require('../helpers/testDb');
setupTestDb();
beforeEach(resetTestDb); // every test starts from the same clean data
const alertService = require('../../src/services/alertService');
const database = require('../../src/dal/database');

const alertsFor = (role = 'Farm Manager') => alertService.getSystemAlerts(role);
const setItem = (id, changes) => database.executeTransaction(s => Object.assign(s.items.find(i => i.id === id), changes));
const setBatch = (id, changes) => database.executeTransaction(s => Object.assign(s.batches.find(b => b.id === id), changes));
const expiringIds = () => alertsFor().expiringSoonAlerts.map(a => a.batchId);

describe('Access (US-8A Conf 3)', () => {
  test('INVALID: Distributor is denied', () => {
    expect(() => alertsFor('Distributor')).toThrow('Access denied');
  });
  test('NORMAL: Farm Manager and Warehouse Officer can view', () => {
    expect(alertsFor('Farm Manager').summary).toBeDefined();
    expect(alertsFor('Warehouse Officer').summary).toBeDefined();
  });
});

describe('Low stock (US-8A)', () => {
  test('NORMAL: fertilizer (usable 25 < min 40) has a low-stock alert; expired stock is not counted', () => {
    const alert = alertsFor().lowStockAlerts.find(a => a.itemId === 'ITEM-104');
    expect(alert.currentUsableStock).toBe(25);
    expect(alert.shortage).toBe(15);
  });

  test('NORMAL: item above its minimum has no alert', () => {
    expect(alertsFor().lowStockAlerts.some(a => a.itemId === 'ITEM-101')).toBe(false);
  });

  test('BOUNDARY: stock EXACTLY at the minimum (350 = 350) -> no alert (US-8A Conf 2)', () => {
    setItem('ITEM-101', { minStockLevel: 350 });
    expect(alertsFor().lowStockAlerts.some(a => a.itemId === 'ITEM-101')).toBe(false);
  });

  test('BOUNDARY: stock ONE below the minimum (350 < 351) -> alert', () => {
    setItem('ITEM-101', { minStockLevel: 351 });
    expect(alertsFor().lowStockAlerts.some(a => a.itemId === 'ITEM-101')).toBe(true);
  });
});

describe('Expiry (US-8B)', () => {
  test('NORMAL: batches expiring in 1 and 3 days are listed, 5 days is not (US-8B Conf 1)', () => {
    const ids = expiringIds();
    expect(ids).toContain('M01'); // +1 day
    expect(ids).toContain('T01'); // +3 days
    expect(ids).not.toContain('T02'); // +5 days
  });

  test('BOUNDARY: expiry TODAY is "Expiring Soon", not "Expired" (US-8B Conf 2)', () => {
    setBatch('T02', { expiryDate: daysFromToday(0) });
    expect(expiringIds()).toContain('T02');
    expect(alertsFor().expiredAlerts.map(a => a.batchId)).not.toContain('T02');
  });

  test('BOUNDARY: expiry in 4 days is not an alert yet', () => {
    setBatch('T02', { expiryDate: daysFromToday(4) });
    expect(expiringIds()).not.toContain('T02');
  });

  test('NORMAL: expired yesterday is listed as Expired (US-8B Conf 3)', () => {
    expect(alertsFor().expiredAlerts.map(a => a.batchId)).toContain('FERT-OLD');
  });

  test('NORMAL: a batch with zero stock has no expiry alert (US-8B Conf 4)', () => {
    setBatch('M01', { remainingQuantity: 0 });
    expect(expiringIds()).not.toContain('M01');
  });

  test('NORMAL: summary counts match the lists', () => {
    const a = alertsFor();
    expect(a.summary.totalExpiringSoon).toBe(a.expiringSoonAlerts.length);
    expect(a.summary.totalExpired).toBe(a.expiredAlerts.length);
  });
});
