/**
 * Main Server Entry Point
 * Loads configuration, creates Express app, registers observability, middleware,
 * routes, centralized error handling, and graceful shutdown listeners.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const { PORT, TRUST_PROXY } = require('./config');
const logger = require('./lib/logger');

// Import middleware
const { requestIdMiddleware } = require('./middleware/requestId');
const { requestLoggerMiddleware } = require('./middleware/requestLogger');
const securityHeadersMiddleware = require('./middleware/securityHeaders');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');

// Import routers
const { router: healthRouter } = require('./routes/health');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const insightsRouter = require('./routes/insights');
const intelligenceRouter = require('./routes/intelligence');
const safetyRouter = require('./routes/safety');
const engagementRouter = require('./routes/engagement');
const reportsRouter = require('./routes/reports');
const testRouter = require('./routes/test');
const configRouter = require('./routes/config');

const app = express();

// Suppress Express framework fingerprinting
app.disable('x-powered-by');

// Trust proxy for rate limiting and HTTPS detection when behind reverse proxy (Vercel, Cloudflare, AWS ALB)
app.set('trust proxy', TRUST_PROXY);

// Register observability and security middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());

// Register routers
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/config', configRouter);
app.use('/api', insightsRouter);
app.use('/api', intelligenceRouter);
app.use('/api', safetyRouter);
app.use('/api', engagementRouter);
app.use('/api', reportsRouter);
app.use('/api', testRouter);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// Register centralized error handling middleware (must be last)
app.use(errorHandler);

/**
 * Start the HTTP server with graceful shutdown handling
 */
function startServer(port = PORT) {
  const server = app.listen(port, () => {
    logger.info('server.started', { port });
  });

  const handleShutdown = (signal) => {
    if (!server.listening) return;
    logger.info('server.shutdown.initiated', { signal });

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error('server.shutdown.error', { error: err.message });
        process.exit(1);
      }
      logger.info('server.shutdown.completed', { signal });
      process.exit(0);
    });

    // Bounded shutdown timeout: force termination after 5 seconds if connections linger
    const forceTimer = setTimeout(() => {
      logger.warn('server.shutdown.forced', { signal, timeoutMs: 5000 });
      process.exit(1);
    }, 5000);

    if (forceTimer.unref) {
      forceTimer.unref();
    }
  };

  const onSigterm = () => handleShutdown('SIGTERM');
  const onSigint = () => handleShutdown('SIGINT');

  process.on('SIGTERM', onSigterm);
  process.on('SIGINT', onSigint);

  server.on('close', () => {
    process.removeListener('SIGTERM', onSigterm);
    process.removeListener('SIGINT', onSigint);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
