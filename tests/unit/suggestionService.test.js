// Feature 6: FIFO / FEFO batch suggestions
const { setupTestDb, resetTestDb, daysFromToday } = require('../helpers/testDb');
setupTestDb();
beforeEach(resetTestDb); // every test starts from the same clean data
const suggestionService = require('../../src/services/suggestionService');
const database = require('../../src/dal/database');

const pick = (result) => result.allocations.map(a => [a.batchId, a.allocatedQuantity]);

describe('FEFO (Fresh Tomatoes: T01 expires before T02)', () => {
  test('NORMAL: earliest expiry first (US-06 Conf 3)', () => {
    expect(pick(suggestionService.suggestBatchesForItem('ITEM-101', 100))).toEqual([['T01', 100]]);
  });

  test('NORMAL: quantity is split over two batches (US-06 Conf 5)', () => {
    const result = suggestionService.suggestBatchesForItem('ITEM-101', 250);
    expect(pick(result)).toEqual([['T01', 200], ['T02', 50]]);
    expect(result.fulfilled).toBe(true);
  });

  test('BOUNDARY: exactly all usable stock (350) is fulfilled, shortfall 0', () => {
    const result = suggestionService.suggestBatchesForItem('ITEM-101', 350);
    expect(result.fulfilled).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  test('BOUNDARY: one more than the stock (351) gives a shortfall of 1', () => {
    const result = suggestionService.suggestBatchesForItem('ITEM-101', 351);
    expect(result.fulfilled).toBe(false);
    expect(result.shortfall).toBe(1);
  });

  test('NORMAL: same expiry date -> earlier received date first (US-06 Conf 4)', () => {
    database.executeTransaction(state => {
      state.batches.find(b => b.id === 'T02').expiryDate = state.batches.find(b => b.id === 'T01').expiryDate;
    });
    expect(suggestionService.suggestBatchesForItem('ITEM-101', 10).allocations[0].batchId).toBe('T01'); // T01 received earlier
  });
});

describe('FIFO (Poultry Feed: FEED-A and FEED-B have the same receiving date)', () => {
  test('NORMAL: same date -> ordered by batch ID (US-06 Conf 2)', () => {
    expect(pick(suggestionService.suggestBatchesForItem('ITEM-103', 120))).toEqual([['FEED-A', 100], ['FEED-B', 20]]);
  });

  test('NORMAL: older received batch comes first (US-06 Conf 1)', () => {
    database.executeTransaction(state => {
      state.batches.find(b => b.id === 'FEED-B').receivingDate = daysFromToday(-10); // now the oldest
    });
    expect(suggestionService.suggestBatchesForItem('ITEM-103', 10).allocations[0].batchId).toBe('FEED-B');
  });
});

describe('Rules and invalid input', () => {
  test('INVALID: expired batch is never suggested (US-06 Conf 6)', () => {
    const result = suggestionService.suggestBatchesForItem('ITEM-104', 100);
    expect(result.allocations.map(a => a.batchId)).toEqual(['FERT-OK']);
    expect(result.fulfilled).toBe(false);
  });

  test('INVALID: zero quantity is rejected', () => {
    expect(() => suggestionService.suggestBatchesForItem('ITEM-101', 0)).toThrow('positive number');
  });

  test('INVALID: negative quantity is rejected', () => {
    expect(() => suggestionService.suggestBatchesForItem('ITEM-101', -5)).toThrow('positive number');
  });

  test('EXCEPTIONAL: unknown item throws', () => {
    expect(() => suggestionService.suggestBatchesForItem('NOPE', 5)).toThrow('not found');
  });
});
