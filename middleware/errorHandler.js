const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

/**
 * Global Error Handler Middleware
 * Handles all errors passed to next() in the application
 * Provides consistent error response format
 */
const errorHandler = (err, req, res, next) => {
     // Default error values
     let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
     let message = err.message || MESSAGES.INTERNAL_ERROR;
     let status = err.status || 'error';

     // Log error in development
     if (process.env.NODE_ENV === 'development') {
          console.error('Error:', {
               message: err.message,
               stack: err.stack,
               statusCode: statusCode
          });
     }

     // PostgreSQL specific error handling
     if (err.code) {
          switch (err.code) {
               case '23505': // Unique violation
                    statusCode = HTTP_STATUS.CONFLICT;
                    message = 'A record with this information already exists';
                    break;
               case '23503': // Foreign key violation
                    statusCode = HTTP_STATUS.BAD_REQUEST;
                    message = 'Referenced record does not exist';
                    break;
               case '23502': // Not null violation
                    statusCode = HTTP_STATUS.BAD_REQUEST;
                    message = 'Required field is missing';
                    break;
               case '22P02': // Invalid text representation
                    statusCode = HTTP_STATUS.BAD_REQUEST;
                    message = 'Invalid data format provided';
                    break;
          }
     }

     // Response structure
     const errorResponse = {
          success: false,
          status: status,
          message: message,
          ...(err.errors && { errors: err.errors }), // Include validation errors if present
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
     };

     res.status(statusCode).json(errorResponse);
};

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
     const error = new Error(`Route ${req.originalUrl} not found`);
     error.statusCode = HTTP_STATUS.NOT_FOUND;
     error.status = 'fail';
     next(error);
};

module.exports = { errorHandler, notFoundHandler };
