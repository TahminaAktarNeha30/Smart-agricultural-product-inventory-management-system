// src/controllers/warehouseController.js
// Handles HTTP requests for Warehouse operations

const warehouseService = require('../services/warehouseService');

class WarehouseController {
  getAll(req, res) {
    try {
      const warehouses = warehouseService.getAllWarehouses();
      res.json({ success: true, data: warehouses });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getActive(req, res) {
    try {
      const active = warehouseService.getActiveWarehouses();
      res.json({ success: true, data: active });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getById(req, res) {
    try {
      const wh = warehouseService.getWarehouseById(req.params.id);
      res.json({ success: true, data: wh });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  }

  create(req, res) {
    try {
      const created = warehouseService.addWarehouse(req.body);
      res.status(201).json({ success: true, message: 'Warehouse added successfully.', data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  update(req, res) {
    try {
      const updated = warehouseService.updateWarehouse(req.params.id, req.body);
      res.json({ success: true, message: 'Warehouse updated successfully.', data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  deactivate(req, res) {
    try {
      const result = warehouseService.deactivateWarehouse(req.params.id);
      res.json({ success: true, message: 'Warehouse deactivated successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  reactivate(req, res) {
    try {
      const result = warehouseService.reactivateWarehouse(req.params.id);
      res.json({ success: true, message: 'Warehouse reactivated successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new WarehouseController();
