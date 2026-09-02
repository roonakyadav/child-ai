
/**
 * Main Server Entry Point
 * Loads configuration, creates Express app, registers middleware and routers
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const { PORT } = require('./config');

// Import middleware
const corsMiddleware = require('./middleware/cors');
const { generalLimiter, aiLimiter } = require('./middleware/rateLimit');

// Import routers
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const insightsRouter = require('./routes/insights');
const intelligenceRouter = require('./routes/intelligence');
const safetyRouter = require('./routes/safety');
const engagementRouter = require('./routes/engagement');
const reportsRouter = require('./routes/reports');
const testRouter = require('./routes/test');

const app = express();

// Trust proxy for rate limiting when behind reverse proxy (Vercel, etc.)
app.set('trust proxy', 1);

// Register middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(cookieParser());

// Register routers
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api', insightsRouter);
app.use('/api', intelligenceRouter);
app.use('/api', safetyRouter);
app.use('/api', engagementRouter);
app.use('/api', reportsRouter);
app.use('/api', testRouter);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});
