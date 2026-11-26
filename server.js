// server.js
// Starts the web server. It does 3 jobs:
//   1. serves the frontend files in /public (HTML, CSS, browser JavaScript)
//   2. serves the backend API under /api
//   3. creates the demo login accounts the first time it runs

const express = require('express');
const path = require('path');
const apiRoutes = require('./src/routes/apiRoutes');
const authService = require('./src/services/authService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // frontend
app.use('/api', apiRoutes);                               // backend

// Unknown /api address -> JSON error (not the web page)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Any other address -> the single page app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Last safety net for unexpected errors
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An internal server error occurred.' });
});

authService.seedDefaultUsers();

// Only start listening when run with "npm start" (tests import "app" without starting it)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('==========================================================');
    console.log('Smart Agricultural Product Inventory Management System');
    console.log(`Open in your browser: http://localhost:${PORT}`);
    console.log('==========================================================');
  });
}

module.exports = app;
