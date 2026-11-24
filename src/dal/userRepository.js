// src/dal/userRepository.js
// DATA ACCESS LAYER - reads user accounts (used by login).

const db = require('./database');

class UserRepository {
  /** Returns every user account (older db files may not have a "users" list yet). */
  getAll() {
    return db.read().users || [];
  }

  /** Finds one user by username (not case-sensitive). Returns null if not found. */
  findByUsername(username) {
    const wanted = String(username || '').trim().toLowerCase();
    return this.getAll().find(u => u.username.toLowerCase() === wanted) || null;
  }
}

module.exports = new UserRepository();
