const { schemas } = require('./schemas');

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
        const errors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Invalid request',
          details: errors
        });
      }
      
      // Handle other errors (e.g., JSON parsing)
      console.error('Validation error:', error);
      return res.status(400).json({
        error: 'Invalid request',
        details: ['Request body could not be processed']
      });
    }
  };
}

module.exports = { validateBody };
