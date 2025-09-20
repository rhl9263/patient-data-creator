/**
 * Error handling utilities
 */

/**
 * Standard error response structure
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
export const createErrorResponse = (message, status = 500, details = {}) => {
  return {
    success: false,
    error: message,
    status,
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Handle API errors consistently
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @returns {Object} Formatted error response
 */
export const handleApiError = (error, context = 'API') => {
  console.error(`${context} Error:`, error);
  
  if (error.name === 'ValidationError') {
    return createErrorResponse(error.message, 400);
  }
  
  if (error.name === 'UnauthorizedError') {
    return createErrorResponse('Unauthorized access', 401);
  }
  
  if (error.name === 'NotFoundError') {
    return createErrorResponse('Resource not found', 404);
  }
  
  // Default server error
  return createErrorResponse(
    error.message || 'An unexpected error occurred',
    500,
    { context, errorName: error.name }
  );
};

/**
 * Validate required fields
 * @param {Object} data - Data to validate
 * @param {Array} requiredFields - Array of required field names
 * @throws {Error} Validation error if fields are missing
 */
export const validateRequiredFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
    error.name = 'ValidationError';
    throw error;
  }
};

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed JSON or default value
 */
export const safeJsonParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('JSON parse error:', error.message);
    return defaultValue;
  }
};

/**
 * Async error wrapper for better error handling
 * @param {Function} asyncFn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export const asyncErrorHandler = (asyncFn) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      return handleApiError(error, asyncFn.name);
    }
  };
};
