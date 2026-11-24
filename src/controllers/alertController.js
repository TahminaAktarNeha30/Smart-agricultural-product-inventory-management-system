// src/controllers/alertController.js
// Handles HTTP requests for Low-Stock and Expiry Alerts (Feature 8)

const alertService = require('../services/alertService');
const { ROLES } = require('../../config/constants');

class AlertController {
  getAlerts(req, res) {
    try {
      const userRole = req.user.role; // set by the login guard (middleware/auth.js)
      
      // US-8A, Confirmation 3: Distributor access denied
      if (userRole === ROLES.DISTRIBUTOR) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Distributors are not authorized to view inventory alerts.'
        });
      }

      const alerts = alertService.getSystemAlerts(userRole);
      res.json({ success: true, data: alerts });
    } catch (err) {
      const statusCode = err.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AlertController();
