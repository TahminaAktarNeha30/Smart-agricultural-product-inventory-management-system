// src/routes/apiRoutes.js
// REQUEST HANDLING LAYER - maps every URL to a controller and says WHO may use it.
// Roles come from the use case diagram:
//   Farm Manager      -> items, warehouses, suppliers, alerts, stock view
//   Warehouse Officer -> receive, usage, wastage, review/dispatch orders, alerts, stock view
//   Distributor       -> view products, place / track / cancel orders

const express = require('express');
const router = express.Router();

const { authenticate, requireRole } = require('../middleware/auth');
const { ROLES } = require('../../config/constants');

const authController = require('../controllers/authController');
const itemController = require('../controllers/itemController');
const warehouseController = require('../controllers/warehouseController');
const supplierController = require('../controllers/supplierController');
const stockController = require('../controllers/stockController');
const orderController = require('../controllers/orderController');
const alertController = require('../controllers/alertController');

const MANAGER = ROLES.FARM_MANAGER;
const OFFICER = ROLES.WAREHOUSE_OFFICER;
const DISTRIBUTOR = ROLES.DISTRIBUTOR;

// ---------- Login (the only public route) ----------
router.post('/auth/login', (req, res) => authController.login(req, res));

// Everything below needs a logged-in user.
router.use(authenticate);

router.post('/auth/logout', (req, res) => authController.logout(req, res));
router.get('/auth/me', (req, res) => authController.me(req, res));

// ---------- Feature 1: Item Catalog (Farm Manager edits, Officer can read) ----------
router.get('/items', requireRole(MANAGER, OFFICER), (req, res) => itemController.getAll(req, res));
router.get('/items/:id', requireRole(MANAGER, OFFICER), (req, res) => itemController.getById(req, res));
router.post('/items', requireRole(MANAGER), (req, res) => itemController.create(req, res));
router.put('/items/:id', requireRole(MANAGER), (req, res) => itemController.update(req, res));
router.patch('/items/:id/deactivate', requireRole(MANAGER), (req, res) => itemController.deactivate(req, res));
router.patch('/items/:id/reactivate', requireRole(MANAGER), (req, res) => itemController.reactivate(req, res));

// ---------- Feature 2: Warehouses ----------
router.get('/warehouses', requireRole(MANAGER, OFFICER), (req, res) => warehouseController.getAll(req, res));
router.get('/warehouses/active', requireRole(MANAGER, OFFICER), (req, res) => warehouseController.getActive(req, res));
router.get('/warehouses/:id', requireRole(MANAGER, OFFICER), (req, res) => warehouseController.getById(req, res));
router.post('/warehouses', requireRole(MANAGER), (req, res) => warehouseController.create(req, res));
router.put('/warehouses/:id', requireRole(MANAGER), (req, res) => warehouseController.update(req, res));
router.patch('/warehouses/:id/deactivate', requireRole(MANAGER), (req, res) => warehouseController.deactivate(req, res));
router.patch('/warehouses/:id/reactivate', requireRole(MANAGER), (req, res) => warehouseController.reactivate(req, res));

// ---------- Feature 2: Suppliers ----------
router.get('/suppliers', requireRole(MANAGER, OFFICER), (req, res) => supplierController.getAll(req, res));
router.get('/suppliers/active', requireRole(MANAGER, OFFICER), (req, res) => supplierController.getActive(req, res));
router.get('/suppliers/:id', requireRole(MANAGER, OFFICER), (req, res) => supplierController.getById(req, res));
router.post('/suppliers', requireRole(MANAGER), (req, res) => supplierController.create(req, res));
router.put('/suppliers/:id', requireRole(MANAGER), (req, res) => supplierController.update(req, res));
router.patch('/suppliers/:id/deactivate', requireRole(MANAGER), (req, res) => supplierController.deactivate(req, res));
router.patch('/suppliers/:id/reactivate', requireRole(MANAGER), (req, res) => supplierController.reactivate(req, res));

// ---------- Feature 3 & 4: Receive stock, view stock ----------
router.post('/stock/receive', requireRole(OFFICER), (req, res) => stockController.receiveStock(req, res));
router.get('/stock/overview', requireRole(MANAGER, OFFICER), (req, res) => stockController.getStockOverview(req, res));

// ---------- Feature 5: Usage and wastage ----------
router.post('/stock/usage', requireRole(OFFICER), (req, res) => stockController.recordUsage(req, res));
router.post('/stock/wastage', requireRole(OFFICER), (req, res) => stockController.recordWastage(req, res));

// ---------- Feature 6: FIFO / FEFO suggestions ----------
router.get('/stock/suggestions', requireRole(OFFICER), (req, res) => stockController.getBatchSuggestions(req, res));

// ---------- Feature 7: Orders and dispatch ----------
// Distributor side (put the fixed words "products" and "track" before "/:id")
router.get('/orders/products', requireRole(DISTRIBUTOR), (req, res) => orderController.getAvailableProducts(req, res));
router.get('/orders/track', requireRole(DISTRIBUTOR), (req, res) => orderController.trackOrder(req, res));
router.post('/orders', requireRole(DISTRIBUTOR), (req, res) => orderController.placeOrder(req, res));
router.patch('/orders/:id/cancel', requireRole(DISTRIBUTOR), (req, res) => orderController.cancelOrder(req, res));
// Warehouse Officer side
router.get('/orders', requireRole(OFFICER), (req, res) => orderController.getAll(req, res));
router.get('/orders/:id', requireRole(OFFICER), (req, res) => orderController.getById(req, res));
router.patch('/orders/:id/review', requireRole(OFFICER), (req, res) => orderController.reviewOrder(req, res));
router.post('/orders/:id/dispatch', requireRole(OFFICER), (req, res) => orderController.dispatchOrder(req, res));

// ---------- Feature 8: Alerts ----------
router.get('/alerts', requireRole(MANAGER, OFFICER), (req, res) => alertController.getAlerts(req, res));

module.exports = router;
