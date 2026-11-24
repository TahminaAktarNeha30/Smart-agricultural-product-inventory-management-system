// Tests Login / Logout
const { setupTestDb } = require('../helpers/testDb');
setupTestDb();
const authService = require('../../src/services/authService');

beforeAll(() => authService.seedDefaultUsers());

describe('login', () => {
  test('valid username and password returns a token and the user', () => {
    const result = authService.login('officer', 'officer123');
    expect(result.token).toHaveLength(48);
    expect(result.user.role).toBe('Warehouse Officer');
    expect(result.user.passwordHash).toBeUndefined(); // hash must never be sent out
  });

  test('username is not case-sensitive', () => {
    expect(authService.login('MANAGER', 'manager123').user.role).toBe('Farm Manager');
  });

  test('wrong password is rejected', () => {
    expect(() => authService.login('officer', 'wrong')).toThrow('Invalid username or password');
  });

  test('unknown user gets the SAME message (no information leak)', () => {
    expect(() => authService.login('nobody', 'x')).toThrow('Invalid username or password');
  });

  test('empty fields are rejected', () => {
    expect(() => authService.login('', '')).toThrow('required');
  });
});

describe('logout / token', () => {
  test('a token works until logout, then it is invalid', () => {
    const { token } = authService.login('distributor', 'distributor123');
    expect(authService.getUserFromToken(token).role).toBe('Distributor');
    authService.logout(token);
    expect(authService.getUserFromToken(token)).toBeNull();
  });

  test('unknown token returns null', () => {
    expect(authService.getUserFromToken('not-a-token')).toBeNull();
  });

  test('seeding twice does not create duplicate users', () => {
    authService.seedDefaultUsers();
    authService.seedDefaultUsers();
    expect(require('../../src/dal/userRepository').getAll()).toHaveLength(3);
  });
});
