// Tests the date rules (SRS US-8B): Expired / Expiring Soon / Active
const { setupTestDb, daysFromToday } = require('../helpers/testDb');
setupTestDb();
const { getExpiryStatus, addDaysToDateString } = require('../../config/constants');

describe('getExpiryStatus (boundary values)', () => {
  test('no expiry date -> NONE', () => {
    expect(getExpiryStatus(null)).toBe('NONE');
  });
  test('expires today -> EXPIRING_SOON, not EXPIRED (US-8B Conf 2)', () => {
    expect(getExpiryStatus(daysFromToday(0))).toBe('EXPIRING_SOON');
  });
  test('expires in exactly 3 days -> EXPIRING_SOON', () => {
    expect(getExpiryStatus(daysFromToday(3))).toBe('EXPIRING_SOON');
  });
  test('expires in 4 days -> ACTIVE', () => {
    expect(getExpiryStatus(daysFromToday(4))).toBe('ACTIVE');
  });
  test('expired yesterday -> EXPIRED (US-8B Conf 3)', () => {
    expect(getExpiryStatus(daysFromToday(-1))).toBe('EXPIRED');
  });
});

describe('addDaysToDateString', () => {
  test('adds days across a month end', () => {
    expect(addDaysToDateString('2026-01-30', 3)).toBe('2026-02-02');
  });
});
