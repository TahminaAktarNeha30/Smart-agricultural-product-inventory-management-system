// src/services/authService.js
// BUSINESS LOGIC LAYER - Login / Logout (extra feature shared by all roles)
//
// How it works (simple version):
//  1. The user sends username + password.
//  2. We check the password against the stored hash (passwords are never saved as plain text).
//  3. If correct, we create a random "token" and remember it in memory (the "sessions" list).
//  4. The browser sends this token with every request. No valid token = no access.
//  5. Logout simply deletes the token.

const crypto = require('crypto');
const db = require('../dal/database');
const userRepository = require('../dal/userRepository');
const { ROLES } = require('../../config/constants');

const SESSION_HOURS = 8;
const sessions = new Map(); // token -> { user, expiresAt }

// Demo accounts created automatically the first time the server starts.
const DEFAULT_USERS = [
  { id: 'USER-01', username: 'manager', password: 'manager123', fullName: 'Rahim Uddin', role: ROLES.FARM_MANAGER },
  { id: 'USER-02', username: 'officer', password: 'officer123', fullName: 'Md. Tariqul Islam', role: ROLES.WAREHOUSE_OFFICER },
  { id: 'USER-03', username: 'distributor', password: 'distributor123', fullName: 'Dhaka Fresh Retailers', role: ROLES.DISTRIBUTOR }
];

/** Turns a password into "salt:hash" using scrypt (a safe one-way function). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

/** Checks a typed password against a stored "salt:hash" value. */
function passwordMatches(password, storedValue) {
  const [salt, savedHash] = storedValue.split(':');
  const typedHash = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(Buffer.from(savedHash, 'hex'), typedHash);
}

/** Returns only the safe fields (never the password hash). */
function toPublicUser(user) {
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
}

class AuthService {
  /** Creates the demo accounts if the database has no users yet. */
  seedDefaultUsers() {
    db.executeTransaction(state => {
      if (!state.users || state.users.length === 0) {
        state.users = DEFAULT_USERS.map(u => ({
          id: u.id,
          username: u.username,
          passwordHash: hashPassword(u.password),
          fullName: u.fullName,
          role: u.role
        }));
      }
    });
  }

  /**
   * Logs a user in.
   * @param {string} username - Typed username.
   * @param {string} password - Typed password.
   * @returns {{token: string, user: object}} Session token and the public user details.
   * @throws {Error} If a field is empty or the username/password is wrong.
   */
  login(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required.');
    }
    const user = userRepository.findByUsername(username);
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user || !passwordMatches(password, user.passwordHash)) {
      throw new Error('Invalid username or password.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    sessions.set(token, { user: toPublicUser(user), expiresAt });
    return { token, user: toPublicUser(user) };
  }

  /** Logs out by deleting the token. Safe to call with an unknown token. */
  logout(token) {
    sessions.delete(token);
  }

  /**
   * Finds the user that owns a token.
   * @param {string} token - Token sent by the browser.
   * @returns {object|null} The public user, or null if the token is unknown or expired.
   */
  getUserFromToken(token) {
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      sessions.delete(token);
      return null;
    }
    return session.user;
  }
}

module.exports = new AuthService();
