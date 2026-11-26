// tests/helpers/testDb.js
// Creates a TEMPORARY database for each test file so the real data/db.json is never changed.
// Dates are calculated from "today", so the tests never go out of date.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildBaseline, daysFromToday } = require('../../data/baseline');

/** Call this BEFORE requiring any service. It points the app to a temporary db file. */
function setupTestDb() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-test-'));
  process.env.DB_PATH = path.join(folder, 'db.json');
  fs.writeFileSync(process.env.DB_PATH, JSON.stringify(buildBaseline(), null, 2));
}

/** Puts the temporary database back to the starting data (call in beforeEach). */
function resetTestDb() {
  fs.writeFileSync(process.env.DB_PATH, JSON.stringify(buildBaseline(), null, 2));
}

module.exports = { setupTestDb, resetTestDb, buildBaseline, daysFromToday };
