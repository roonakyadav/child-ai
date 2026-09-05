/**
 * Configuration Routes
 * Provides authenticated parent endpoints to read, update, and migrate
 * server-authoritative parental controls and AI safety configuration.
 */

const express = require('express');
const router = express.Router();
const { requireParentAuth } = require('../middleware/auth');
const { validateBody } = require('../validation/middleware');
const configService = require('../services/configService');
const logger = require('../lib/logger');

// GET /api/config/parent - Retrieve authoritative parent configuration
router.get('/parent', requireParentAuth, (req, res) => {
  try {
    const config = configService.getParentConfig();
    res.status(200).json({ config });
  } catch (error) {
    logger.error('config.retrieve.failed', { requestId: req.id, errorName: error.name || 'Error' });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

// PUT /api/config/parent - Update authoritative parent configuration
router.put('/parent', requireParentAuth, validateBody('parentConfigUpdate'), (req, res) => {
  try {
    const updated = configService.updateParentConfig(req.body);
    res.status(200).json({
      success: true,
      config: updated
    });
  } catch (error) {
    logger.error('config.update.failed', { requestId: req.id, errorName: error.name || 'Error' });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// POST /api/config/parent/migrate - One-time migration of legacy localStorage settings
router.post('/parent/migrate', requireParentAuth, validateBody('parentConfigMigrate'), (req, res) => {
  try {
    const updated = configService.migrateLegacyConfig(req.body);
    res.status(200).json({
      success: true,
      migrated: true,
      config: updated
    });
  } catch (error) {
    logger.error('config.migrate.failed', { requestId: req.id, errorName: error.name || 'Error' });
    res.status(500).json({ error: 'Failed to migrate configuration' });
  }
});

const { deleteSession } = require('../services/authService');

// DELETE /api/config/parent - Reset parent configuration and invalidate session
router.delete('/parent', requireParentAuth, (req, res) => {
  try {
    configService.resetParentConfig();

    const sessionId = req.cookies ? req.cookies.parent_session : null;
    if (sessionId) {
      deleteSession(sessionId);
    }

    res.clearCookie('parent_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: 'Parent configuration successfully reset'
    });
  } catch (error) {
    logger.error('config.reset.failed', { requestId: req.id, errorName: error.name || 'Error' });
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

module.exports = router;
