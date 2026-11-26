// src/controllers/authController.js
// REQUEST HANDLING LAYER - receives login/logout requests and calls authService.

const authService = require('../services/authService');

class AuthController {
  login(req, res) {
    try {
      const { username, password } = req.body;
      const result = authService.login(username, password);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(401).json({ success: false, message: err.message });
    }
  }

  logout(req, res) {
    authService.logout(req.token);
    res.json({ success: true, message: 'Logged out successfully.' });
  }

  /** Lets the browser ask "who am I?" after a page refresh. */
  me(req, res) {
    res.json({ success: true, data: req.user });
  }
}

module.exports = new AuthController();
