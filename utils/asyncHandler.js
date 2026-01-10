/**
 * Async Handler Wrapper
 * Wraps async functions to automatically catch errors and pass them to error middleware
 * Eliminates the need for try-catch blocks in every controller
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
     return (req, res, next) => {
          Promise.resolve(fn(req, res, next)).catch(next);
     };
};

module.exports = asyncHandler;
