const { schemas } = require('./schemas');
const logger = require('../lib/logger');

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a Zod schema
 * @param {string} schemaName - Name of the schema to use
 * @returns {Function} Express middleware function
 */
function validateBody(schemaName) {
  const schema = schemas[schemaName];
  
  if (!schema) {
    throw new Error(`Schema '${schemaName}' not found`);
  }
  
  return (req, res, next) => {
    try {
      // Parse and validate request body
      const validatedData = schema.parse(req.body);
      
      // Replace request body with validated data (removes unexpected fields)
      req.body = validatedData;
      
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const issues = error.issues || error.errors || [];
        const errors = issues.map(err => ({
          path: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Invalid request',
          details: errors
        });
      }
      
      // Handle other errors (e.g., JSON parsing)
      logger.warn('validation.failed', {
        schema: schemaName,
        errorName: error.name || 'ValidationError'
      });
      return res.status(400).json({
        error: 'Invalid request',
        details: ['Request body could not be processed']
      });
    }
  };
}

module.exports = { validateBody };
