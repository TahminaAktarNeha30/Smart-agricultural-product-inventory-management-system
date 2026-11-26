// Feature 7: Distributor orders and dispatch
const { setupTestDb, resetTestDb, daysFromToday } = require('../helpers/testDb');
setupTestDb();
beforeEach(resetTestDb); // every test starts from the same clean data
const orderService = require('../../src/services/orderService');
const stockService = require('../../src/services/stockService');
const database = require('../../src/dal/database');

const PHONE = '01799887766';
const order = (lines) => orderService.placeOrder({ distributorName: 'Dhaka Mart', distributorPhone: PHONE, lines });
const batchQty = (id) => stockService.getStockOverview({ showEmptyBatches: true }).batches.find(b => b.id === id).remainingQuantity;

describe('Placing orders (US-7A, US-7B)', () => {
  test('NORMAL: 30 litres at BDT 60 = BDT 1,800, status Placed, stock NOT reserved', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 30 }]);
    expect(o.status).toBe('Placed');
    expect(o.totalAmount).toBe(1800);
    expect(batchQty('M01')).toBe(50);
  });

  test('NORMAL: only finished products are listed for distributors', () => {
    const names = orderService.getAvailableFinishedProducts().map(p => p.name || p.itemName);
    expect(names).not.toContain('Poultry Starter Feed');
  });

  test('NORMAL: later price change does not change an old order (US-7B Conf 2)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 1 }]);
    database.executeTransaction(state => { state.items.find(i => i.id === 'ITEM-102').sellingPrice = 99; });
    expect(orderService.getOrderById(o.id).totalAmount).toBe(60);
  });

  test('INVALID: farming input cannot be ordered', () => {
    expect(() => order([{ itemId: 'ITEM-103', quantity: 5 }])).toThrow('Only finished products');
  });

  test('INVALID: quantity above usable stock is rejected (US-7B Conf 3)', () => {
    expect(() => order([{ itemId: 'ITEM-102', quantity: 51 }])).toThrow('exceeds currently available stock');
  });

  test('BOUNDARY: exactly the available stock (50) is accepted', () => {
    expect(order([{ itemId: 'ITEM-102', quantity: 50 }]).status).toBe('Placed');
  });

  test('INVALID: zero and negative quantity are rejected (US-7B Conf 4)', () => {
    expect(() => order([{ itemId: 'ITEM-102', quantity: 0 }])).toThrow('positive number');
    expect(() => order([{ itemId: 'ITEM-102', quantity: -3 }])).toThrow('positive number');
  });

  test('INVALID: missing name, phone or lines are rejected', () => {
    expect(() => orderService.placeOrder({ distributorName: '', distributorPhone: PHONE, lines: [{ itemId: 'ITEM-102', quantity: 1 }] })).toThrow('name is required');
    expect(() => orderService.placeOrder({ distributorName: 'A', distributorPhone: '', lines: [{ itemId: 'ITEM-102', quantity: 1 }] })).toThrow('phone number is required');
    expect(() => order([])).toThrow('at least one');
  });
});

describe('Review, track, cancel (US-7C, 7E, 7F)', () => {
  test('NORMAL: approve keeps stock unchanged (US-7C Conf 1)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    orderService.reviewOrder(o.id, 'APPROVE', null, 'Officer');
    expect(orderService.getOrderById(o.id).status).toBe('Approved');
    expect(batchQty('M01')).toBe(50);
  });

  test('NORMAL: reject with a reason keeps the reason (US-7C Conf 2)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    orderService.reviewOrder(o.id, 'REJECT', 'Out of schedule', 'Officer');
    const saved = orderService.getOrderById(o.id);
    expect(saved.status).toBe('Rejected');
    expect(JSON.stringify(saved)).toContain('Out of schedule');
  });

  test('INVALID: reject without a reason is refused and order stays Placed (US-7C Conf 3)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    expect(() => orderService.reviewOrder(o.id, 'REJECT', '  ')).toThrow('rejection reason');
    expect(orderService.getOrderById(o.id).status).toBe('Placed');
  });

  test('INVALID: an order can only be reviewed once', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    expect(() => orderService.reviewOrder(o.id, 'APPROVE')).toThrow('Only orders with status "Placed"');
  });

  test('NORMAL / INVALID: tracking needs BOTH order number and matching phone (US-7E)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    expect(orderService.trackOrder(o.orderNumber, PHONE).id).toBe(o.id);
    expect(() => orderService.trackOrder(o.orderNumber, '01900000000')).toThrow('does not match');
    expect(() => orderService.trackOrder('', PHONE)).toThrow('both Order Number and Phone');
  });

  test('NORMAL: a Placed order can be cancelled, stock unchanged (US-7F Conf 1)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    expect(orderService.cancelOrder(o.id, PHONE).status).toBe('Cancelled');
    expect(batchQty('M01')).toBe(50);
  });

  test('INVALID: cancelling twice or with a wrong phone is refused (US-7F Conf 3)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 5 }]);
    expect(() => orderService.cancelOrder(o.id, '01900000000')).toThrow('does not match');
    orderService.cancelOrder(o.id, PHONE);
    expect(() => orderService.cancelOrder(o.id, PHONE)).toThrow('already "Cancelled"');
  });
});

describe('Dispatch (US-7D)', () => {
  test('NORMAL: dispatch deducts stock once and records the officer (US-7D Conf 1)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 30 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    const done = orderService.dispatchOrder(o.id, 'Officer Rahim');
    expect(done.status).toBe('Dispatched');
    expect(JSON.stringify(done)).toContain('Officer Rahim');
    expect(batchQty('M01')).toBe(20);
  });

  test('EXCEPTIONAL: dispatching twice does not deduct twice (US-7D Conf 6)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 10 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    orderService.dispatchOrder(o.id, 'Officer');
    const after = batchQty('M01');
    expect(() => orderService.dispatchOrder(o.id, 'Officer')).toThrow('already been dispatched');
    expect(batchQty('M01')).toBe(after);
  });

  test('INVALID: order that is not Approved cannot be dispatched (US-7D Conf 2)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 1 }]);
    expect(() => orderService.dispatchOrder(o.id, 'Officer')).toThrow('Only "Approved" orders');
  });

  test('INVALID: Dispatched order cannot be cancelled', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 1 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    orderService.dispatchOrder(o.id, 'Officer');
    expect(() => orderService.cancelOrder(o.id, PHONE)).toThrow('already been dispatched');
  });

  test('EXCEPTIONAL: stock fell after approval -> NOTHING is deducted, order stays Approved (US-7D Conf 5)', () => {
    const o = order([{ itemId: 'ITEM-102', quantity: 40 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    stockService.recordWastage({ batchId: 'M01', quantity: 30, date: daysFromToday(0), reason: 'spoilage', transactionToken: 'W-FALL' }, 'O');
    expect(() => orderService.dispatchOrder(o.id, 'Officer')).toThrow('Dispatch blocked');
    expect(orderService.getOrderById(o.id).status).toBe('Approved');
    expect(batchQty('M01')).toBe(20);
  });

  test('EXCEPTIONAL: a batch expired after approval blocks the dispatch', () => {
    const o = order([{ itemId: 'ITEM-101', quantity: 10 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    database.executeTransaction(state => {
      state.batches.filter(b => b.itemId === 'ITEM-101').forEach(b => { b.expiryDate = daysFromToday(-1); });
    });
    expect(() => orderService.dispatchOrder(o.id, 'Officer')).toThrow('Dispatch blocked');
    expect(orderService.getOrderById(o.id).status).toBe('Approved');
  });

  test('EXCEPTIONAL: multi-line order - if ONE line fails, NO line is dispatched (US-7D Conf 7, NFR-04)', () => {
    // fresh data: use a second order for tomatoes + milk where milk will be short
    const o = order([{ itemId: 'ITEM-101', quantity: 100 }, { itemId: 'ITEM-102', quantity: 5 }]);
    orderService.reviewOrder(o.id, 'APPROVE');
    database.executeTransaction(state => { // make milk impossible to fulfil
      state.batches.find(b => b.id === 'M01').remainingQuantity = 1;
    });
    const tomatoesBefore = batchQty('T01') + batchQty('T02');
    expect(() => orderService.dispatchOrder(o.id, 'Officer')).toThrow('Dispatch blocked');
    expect(batchQty('T01') + batchQty('T02')).toBe(tomatoesBefore); // tomatoes untouched
    expect(orderService.getOrderById(o.id).status).toBe('Approved');
  });
});
