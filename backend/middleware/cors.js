/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing with origin validation
 */

const cors = require('cors');
const { allowedOrigins } = require('../config');

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no Origin header (e.g., same-origin, server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in the allowlist
    if (allowedOrigins && allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Required for HTTP-only cookies
};

module.exports = cors(corsOptions);
