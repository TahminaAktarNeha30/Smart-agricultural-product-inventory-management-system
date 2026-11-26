// src/dal/database.js
// DATA ACCESS LAYER - the only file that touches the database file (data/db.json).
// It reads/writes the JSON file safely and makes every change "all or nothing" (NFR-04, NFR-08).

const fs = require('fs');
const path = require('path');
const { getBangladeshDateString } = require('../../config/constants');

// Tests set DB_PATH to a temporary file so the real data is never touched.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/db.json');
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');

const EMPTY_DB = {
  items: [],
  warehouses: [],
  suppliers: [],
  batches: [],
  orders: [],
  transactions: [],
  users: []
};

class Database {
  constructor() {
    this.ensureStorage();
    this.createBackup(); // NFR-09: one backup per day
  }

  /** Creates the data folder, backup folder and an empty db file if they are missing. */
  ensureStorage() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    }
  }

  /** Reads the whole database file and returns it as a JavaScript object. */
  read() {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (err) {
      throw new Error('Database read failure: ' + err.message);
    }
  }

  /**
   * Saves data safely: write to a temporary file first, then rename it.
   * If the program crashes in the middle, the old file is still intact (NFR-08).
   */
  write(data) {
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
  }

  /**
   * Runs several changes as ONE unit (NFR-04, NFR-05).
   * - We work on a copy of the data.
   * - If everything succeeds, the copy is saved.
   * - If anything throws an error, nothing is saved (automatic rollback).
   */
  executeTransaction(changeFunction) {
    const copy = this.read();
    const result = changeFunction(copy); // may throw -> nothing saved
    this.write(copy);
    return result;
  }

  /** Copies the database into data/backups/backup-YYYY-MM-DD.json once per day (NFR-09). */
  createBackup() {
    const backupFile = path.join(BACKUP_DIR, `backup-${getBangladeshDateString()}.json`);
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(DB_PATH, backupFile);
    }
  }
}

module.exports = new Database();
