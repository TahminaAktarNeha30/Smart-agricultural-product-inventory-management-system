# TDD (Test-Driven Development) Report

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Institution:** Independent University, Bangladesh (IUB)

---

## 1. Testing Framework and Strategy
- **Framework:** Jest 29.x
- **Test Runner Command:** `npm test` (executes `jest --coverage`)
- **Isolation:** Tests use an in-memory test database fixture (`tests/helpers/testDb.js`), completely isolating tests from production `data/db.json`.

---

## 2. Summary of Test Results
- **Test Suites:** 8 passed, 8 total
- **Tests:** 111 passed, 111 total
- **Execution Time:** ~15.4 seconds
- **Pass Rate:** 100%

### Test Suites Breakdown:
| Test Suite | Associated Feature | Tests Passed | Focus Areas |
|---|---|---|---|
| `catalogService.test.js` | F1 (Items) & F2 (Warehouses & Suppliers) | 16 | Normal creation, duplicate codes, empty fields, boundary unit validations |
| `authService.test.js` & `api.test.js` | Login / Logout & Role Guards | 24 | Salted scrypt hashing, session tokens, 401 unauthorized, 403 forbidden |
| `stockService.test.js` | F3 (Stock Receiving) & F4 (Stock View) & F5 (Usage/Wastage) | 28 | Batch creation, stock arithmetic, zero/negative stock guards, wastage recording |
| `suggestionService.test.js` | F6 (FIFO / FEFO Suggestions) | 15 | FIFO order, FEFO expiry ordering, batch exhaustion, split batches |
| `orderService.test.js` | F7 (Distributor Orders & Dispatch) | 18 | Order status lifecycle (Pending -> Approved -> Dispatched), stock locking |
| `alertService.test.js` | F8 (Low-Stock & Expiry Alerts) | 10 | Expiry calculation against BD timezone, minimum threshold triggers |

---

## 3. Code Coverage Metrics
- **Core Services Coverage:** ~84% Lines covered
- **Configuration & Constants:** 100%
- **Middleware & Guards:** 100%
