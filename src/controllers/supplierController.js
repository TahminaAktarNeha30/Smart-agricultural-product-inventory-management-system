// src/controllers/supplierController.js
// Handles HTTP requests for Supplier operations

const supplierService = require('../services/supplierService');

class SupplierController {
  getAll(req, res) {
    try {
      const { search } = req.query;
      const suppliers = search ? supplierService.searchSuppliers(search) : supplierService.getAllSuppliers();
      res.json({ success: true, data: suppliers });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getActive(req, res) {
    try {
      const suppliers = supplierService.getActiveSuppliers();
      res.json({ success: true, data: suppliers });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getById(req, res) {
    try {
      const s = supplierService.getSupplierById(req.params.id);
      res.json({ success: true, data: s });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  }

  create(req, res) {
    try {
      const created = supplierService.addSupplier(req.body);
      res.status(201).json({ success: true, message: 'Supplier added successfully.', data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  update(req, res) {
    try {
      const updated = supplierService.updateSupplier(req.params.id, req.body);
      res.json({ success: true, message: 'Supplier updated successfully.', data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  deactivate(req, res) {
    try {
      const result = supplierService.deactivateSupplier(req.params.id);
      res.json({ success: true, message: 'Supplier deactivated successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  reactivate(req, res) {
    try {
      const result = supplierService.reactivateSupplier(req.params.id);
      res.json({ success: true, message: 'Supplier reactivated successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new SupplierController();
