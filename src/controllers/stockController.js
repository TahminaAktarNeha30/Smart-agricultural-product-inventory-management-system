// src/controllers/stockController.js
// Handles HTTP requests for Stock Receiving, Levels, Usage, Wastage, and Suggestions

const stockService = require('../services/stockService');
const suggestionService = require('../services/suggestionService');

class StockController {
  receiveStock(req, res) {
    try {
      const officerName = req.user.fullName;
      const result = stockService.receiveStock(req.body, officerName);
      res.status(201).json({ success: true, message: 'Stock received and batch registered successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  getStockOverview(req, res) {
    try {
      const { warehouseId, itemId, showEmptyBatches } = req.query;
      const data = stockService.getStockOverview({ warehouseId, itemId, showEmptyBatches });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  recordUsage(req, res) {
    try {
      const officerName = req.user.fullName;
      const result = stockService.recordUsage(req.body, officerName);
      res.json({ success: true, message: 'Input usage recorded successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  recordWastage(req, res) {
    try {
      const officerName = req.user.fullName;
      const result = stockService.recordWastage(req.body, officerName);
      res.json({ success: true, message: 'Stock wastage recorded successfully.', data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  getBatchSuggestions(req, res) {
    try {
      const { itemId, quantity } = req.query;
      if (!itemId || !quantity) {
        return res.status(400).json({ success: false, message: 'Both itemId and quantity query parameters are required.' });
      }
      const suggestions = suggestionService.suggestBatchesForItem(itemId, quantity);
      res.json({ success: true, data: suggestions });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new StockController();
