// API test: starts the real Express server and calls it like the browser does.
// Proves that FRONTEND <-> BACKEND are connected, and that login / roles are enforced.
const { setupTestDb } = require('../helpers/testDb');
setupTestDb();
const app = require('../../server');

let server;
let baseUrl;

beforeAll(done => {
  server = app.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});
afterAll(done => { server.close(done); });

/** Small helper to call the API. */
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

async function loginAs(username, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: { username, password } });
  return res.body.data.token;
}

describe('Frontend files are served', () => {
  test('index.html (the page with the login form) loads', async () => {
    const res = await fetch(baseUrl + '/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('id="loginForm"');
  });
});

describe('Login and Logout', () => {
  test('wrong password -> 401', async () => {
    const res = await api('/api/auth/login', { method: 'POST', body: { username: 'officer', password: 'bad' } });
    expect(res.status).toBe(401);
  });

  test('no token -> 401 on a protected route', async () => {
    expect((await api('/api/items')).status).toBe(401);
  });

  test('fake token -> 401', async () => {
    expect((await api('/api/items', { token: 'fake' })).status).toBe(401);
  });

  test('login -> /auth/me works -> logout -> token stops working', async () => {
    const token = await loginAs('manager', 'manager123');
    const me = await api('/api/auth/me', { token });
    expect(me.body.data.role).toBe('Farm Manager');

    expect((await api('/api/auth/logout', { method: 'POST', token })).status).toBe(200);
    expect((await api('/api/auth/me', { token })).status).toBe(401);
  });
});

describe('Role permissions (use case diagram)', () => {
  test('Distributor cannot add an item or see alerts (403)', async () => {
    const token = await loginAs('distributor', 'distributor123');
    expect((await api('/api/items', { method: 'POST', token, body: {} })).status).toBe(403);
    expect((await api('/api/alerts', { token })).status).toBe(403);
  });

  test('Warehouse Officer cannot add an item (403) but can view stock (200)', async () => {
    const token = await loginAs('officer', 'officer123');
    expect((await api('/api/items', { method: 'POST', token, body: {} })).status).toBe(403);
    expect((await api('/api/stock/overview', { token })).status).toBe(200);
  });

  test('Farm Manager can view alerts but cannot dispatch orders', async () => {
    const token = await loginAs('manager', 'manager123');
    expect((await api('/api/alerts', { token })).status).toBe(200);
    expect((await api('/api/orders/X/dispatch', { method: 'POST', token })).status).toBe(403);
  });

  test('Unknown API address returns a JSON 404', async () => {
    const token = await loginAs('manager', 'manager123');
    expect((await api('/api/nothing-here', { token })).status).toBe(404);
  });
});

describe('Full flow through the API: order -> approve -> dispatch', () => {
  test('Distributor orders, Officer approves and dispatches, Distributor tracks', async () => {
    const distributor = await loginAs('distributor', 'distributor123');
    const officer = await loginAs('officer', 'officer123');

    const products = await api('/api/orders/products', { token: distributor });
    const milk = products.body.data.find(p => (p.name || p.itemName) === 'Cow Milk');
    expect(milk).toBeDefined();

    const placed = await api('/api/orders', {
      method: 'POST', token: distributor,
      body: { distributorName: 'Dhaka Mart', distributorPhone: '01700000001', lines: [{ itemId: milk.itemId || milk.id, quantity: 10 }] }
    });
    expect(placed.status).toBeLessThan(300);
    const order = placed.body.data;

    const approved = await api(`/api/orders/${order.id}/review`, { method: 'PATCH', token: officer, body: { action: 'APPROVE' } });
    expect(approved.status).toBe(200);

    const dispatched = await api(`/api/orders/${order.id}/dispatch`, { method: 'POST', token: officer, body: {} });
    expect(dispatched.body.data.status).toBe('Dispatched');
    expect(dispatched.body.data.dispatchedBy || JSON.stringify(dispatched.body.data)).toContain('Md. Tariqul Islam');

    const tracked = await api(`/api/orders/track?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=01700000001`, { token: distributor });
    expect(tracked.body.data.status).toBe('Dispatched');
  });
});
