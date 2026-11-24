// src/controllers/itemController.js
// Handles HTTP requests for Item Catalog operations

const itemService = require('../services/itemService');

class ItemController {
  getAll(req, res) {
    try {
      const items = itemService.getAllItems();
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getById(req, res) {
    try {
      const item = itemService.getItemById(req.params.id);
      res.json({ success: true, data: item });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  }

  create(req, res) {
    try {
      const created = itemService.addItem(req.body);
      res.status(201).json({ success: true, message: 'Item created successfully.', data: created });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  update(req, res) {
    try {
      const updated = itemService.updateItem(req.params.id, req.body);
      res.json({ success: true, message: 'Item updated successfully.', data: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  deactivate(req, res) {
    try {
      const result = itemService.deactivateItem(req.params.id);
      res.json({ success: true, message: 'Item deactivated successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  reactivate(req, res) {
    try {
      const result = itemService.reactivateItem(req.params.id);
      res.json({ success: true, message: 'Item reactivate successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new ItemController();
