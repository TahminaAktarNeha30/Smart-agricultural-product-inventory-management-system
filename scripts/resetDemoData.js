// scripts/resetDemoData.js
// Replaces data/db.json with fresh demo data whose dates are relative to TODAY
// (so demo batches are never already expired). Run:  npm run demo-data
// WARNING: this deletes the current data. Login accounts are re-created when the server starts.

const fs = require('fs');
const path = require('path');
const { buildBaseline } = require('../data/baseline');

const dbFile = path.join(__dirname, '../data/db.json');
fs.writeFileSync(dbFile, JSON.stringify(buildBaseline(), null, 2), 'utf8');
console.log('Demo data created in data/db.json. Start the server with: npm start');
