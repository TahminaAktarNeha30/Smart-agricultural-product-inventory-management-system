// src/middleware/auth.js
// Two small "guards" that run BEFORE a controller:
//   authenticate -> is the user logged in?   (401 if not)
//   requireRole  -> is this role allowed?     (403 if not)

const authService = require('../services/authService');

/** Reads "Authorization: Bearer <token>", finds the user and stores it in req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? authService.getUserFromToken(token) : null;

  if (!user) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  req.user = user;
  req.token = token;
  next();
}

/** Allows the request only if the logged-in user has one of the given roles. */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: the ${req.user.role} role cannot do this action.`
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
