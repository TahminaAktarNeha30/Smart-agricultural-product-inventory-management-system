// src/controllers/orderController.js
// Handles HTTP requests for Distributor Orders and Dispatch operations

const orderService = require('../services/orderService');

class OrderController {
  getAvailableProducts(req, res) {
    try {
      const products = orderService.getAvailableFinishedProducts();
      res.json({ success: true, data: products });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  placeOrder(req, res) {
    try {
      const order = orderService.placeOrder(req.body);
      res.status(201).json({
        success: true,
        message: `Order ${order.orderNumber} placed successfully.`,
        data: order
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  getAll(req, res) {
    try {
      const orders = orderService.getAllOrders();
      res.json({ success: true, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getById(req, res) {
    try {
      const order = orderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  reviewOrder(req, res) {
    try {
      const officerName = req.user.fullName;
      const { action, rejectionReason } = req.body;
      const updated = orderService.reviewOrder(req.params.id, action, rejectionReason, officerName);
      res.json({
        success: true,
        message: `Order ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully.`,
        data: updated
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  dispatchOrder(req, res) {
    try {
      const officerName = req.user.fullName;
      const { customAllocations } = req.body;
      const dispatched = orderService.dispatchOrder(req.params.id, officerName, customAllocations);
      res.json({
        success: true,
        message: `Order ${dispatched.orderNumber} dispatched successfully.`,
        data: dispatched
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  trackOrder(req, res) {
    try {
      const { orderNumber, phone } = req.query;
      const order = orderService.trackOrder(orderNumber, phone);
      res.json({ success: true, data: order });
    } catch (err) {
      // US-7E, Confirmation 2: Display error message and do not reveal order details
      res.status(404).json({ success: false, message: err.message });
    }
  }

  cancelOrder(req, res) {
    try {
      const { distributorPhone } = req.body;
      const cancelled = orderService.cancelOrder(req.params.id, distributorPhone);
      res.json({
        success: true,
        message: `Order ${cancelled.orderNumber} has been cancelled.`,
        data: cancelled
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new OrderController();
