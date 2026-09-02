/**
 * Test Routes
 * Simple test endpoint for connectivity verification
 */

const express = require('express');
const router = express.Router();

// GET /api/test
router.get('/test', (req, res) => {
  res.send("API WORKING");
});

module.exports = router;
